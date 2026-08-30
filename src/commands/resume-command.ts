import { resumeInputGate } from '../gates/input-gate'
import { RunRequestStore } from '../runtime/request-store'
import { normalizeInputResources } from '../runtime/state-factory'
import { StateStore } from '../runtime/state-store'
import type { DevLoopState } from '../schema/state'

export interface ResumeCommandOptions {
  projectRoot: string
}

export class ResumeCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeCommandError'
  }
}

/**
 * 重新读取 Skill 更新后的 request.yaml，把新附件同步到 state.json，
 * 然后重新执行 Input Gate。
 */
export async function executeResumeCommand(
  options: ResumeCommandOptions
): Promise<DevLoopState> {
  const store = new StateStore(options.projectRoot)
  const current = await store.read()

  if (current.status !== 'WAITING_USER') return current

  const request = await new RunRequestStore(options.projectRoot).read()
  const resources = normalizeInputResources(
    options.projectRoot,
    request.resources
  )

  await store.update((state) => ({
    ...state,
    input: {
      sourceType: request.sourceType,
      analysisType: request.analysisType,
      originalRequest: request.originalRequest,
      resources,
      missingResourceIds: state.input.missingResourceIds
    }
  }))

  return resumeInputGate(store)
}
