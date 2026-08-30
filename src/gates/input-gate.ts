import { stat } from 'node:fs/promises'

import type { DevLoopState, InputResource } from '../schema/state'
import { calculateFileSha256 } from '../runtime/input-snapshot-store'
import { StateStore } from '../runtime/state-store'
import { commitTransition } from '../runtime/transition'

const INPUT_GATE_ALLOWED_STATUSES: ReadonlySet<DevLoopState['status']> =
  new Set(['NEW', 'INPUT_GATE', 'WAITING_USER'])

export class InputGateError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'InputGateError'
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

/**
 * 判断资源是否存在，并且类型是否符合约定。
 *
 * REPOSITORY 必须是目录；其余输入资源必须是普通文件。
 * 符号链接会由 stat 跟随到最终目标。
 */
async function isResourceAvailable(resource: InputResource): Promise<boolean> {
  if (!resource.path) return false

  try {
    const resourceStat = await stat(resource.path)

    if (resource.kind === 'REPOSITORY') return resourceStat.isDirectory()

    if (!resourceStat.isFile()) return false

    if (resource.sha256) {
      const actualSha256 = await calculateFileSha256(resource.path)

      return actualSha256 === resource.sha256
    }

    return true
  } catch (error) {
    if (
      isNodeError(error) &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return false
    }

    throw new InputGateError(
      `无法检查输入资源 ${resource.id}：${resource.path}`,
      error
    )
  }
}

/**
 * 执行 Input Gate，并把检查结果持久化到 state.json。
 *
 * 必填资源缺失时暂停到 WAITING_USER；全部必填资源可用时，
 * 进入 SYSTEM_ANALYSIS。可选资源缺失会被记录，但不会阻塞流程。
 */
export async function runInputGate(store: StateStore): Promise<DevLoopState> {
  const current = await store.read()

  if (!INPUT_GATE_ALLOWED_STATUSES.has(current.status)) {
    throw new InputGateError(`当前状态 ${current.status} 不允许执行 Input Gate`)
  }

  const checkingState = await commitTransition(store, 'INPUT_GATE_STARTED', (state) => ({
    ...state,
    status: 'INPUT_GATE'
  }))

  const resources = await Promise.all(
    checkingState.input.resources.map(async (resource) => ({
      ...resource,
      availability: (await isResourceAvailable(resource))
        ? ('AVAILABLE' as const)
        : ('MISSING' as const)
    }))
  )

  const missingResourceIds = resources
    .filter(
      (resource) => resource.required && resource.availability === 'MISSING'
    )
    .map((resource) => resource.id)

  return commitTransition(
    store,
    missingResourceIds.length > 0 ? 'INPUT_REQUIRED' : 'INPUT_ACCEPTED',
    (state) => ({
    ...state,
    status: missingResourceIds.length > 0 ? 'WAITING_USER' : 'SYSTEM_ANALYSIS',
    input: {
      ...state.input,
      resources,
      missingResourceIds
    }
  }),
    { missingResourceIds }
  )
}

/**
 * 用户补齐资料后的恢复入口。
 * 这里只重新执行 Input Gate，不直接跳过输入检查。
 */
export async function resumeInputGate(
  store: StateStore
): Promise<DevLoopState> {
  const current = await store.read()

  if (current.status !== 'WAITING_USER') {
    throw new InputGateError(
      `只有 WAITING_USER 状态可以恢复 Input Gate，当前状态为 ${current.status}`
    )
  }

  return runInputGate(store)
}
