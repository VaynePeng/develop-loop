import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createInitialState } from '../../src/runtime/state-factory'
import { StateStore } from '../../src/runtime/state-store'

describe('StateStore', () => {
  let projectRoot = ''

  beforeEach(async () => {
    /**
     * 每个测试创建独立项目目录，
     * 避免测试之间共享 state.json。
     */
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-state-store-'))
  })

  afterEach(async () => {
    /**
     * 只删除当前测试创建的临时目录。
     */
    await rm(projectRoot, {
      recursive: true,
      force: true
    })
  })

  function createTestState() {
    return createInitialState({
      projectRoot,

      originalRequest: '请根据附件完成后端系分',

      analysisType: 'backend',

      resources: [
        {
          id: 'prd',
          kind: 'PRD',
          path: 'docs/prd.md',
          required: true
        }
      ]
    })
  }

  it('创建合法的初始状态', () => {
    const state = createTestState()

    expect(state.schemaVersion).toBe(1)
    expect(state.workflow.name).toBe('develop-loop')
    expect(state.status).toBe('NEW')
    expect(state.projectRoot).toBe(projectRoot)

    expect(state.input.resources).toHaveLength(1)

    expect(state.input.resources[0]?.path).toBe(
      resolve(projectRoot, 'docs/prd.md')
    )

    expect(state.input.resources[0]?.availability).toBe('UNKNOWN')

    expect(state.createdAt).toBe(state.updatedAt)
  })

  it('创建并重新读取 state.json', async () => {
    const store = new StateStore(projectRoot)
    const initialState = createTestState()

    expect(await store.exists()).toBe(false)

    const created = await store.create(initialState)

    expect(await store.exists()).toBe(true)
    expect(created).toEqual(initialState)

    const restored = await store.read()

    expect(restored).toEqual(initialState)
  })

  it('拒绝覆盖已经存在的状态', async () => {
    const store = new StateStore(projectRoot)
    const initialState = createTestState()

    await store.create(initialState)

    await expect(store.create(initialState)).rejects.toThrow(
      '状态文件已经存在，请使用 resume'
    )
  })

  it('更新状态并刷新 updatedAt', async () => {
    const store = new StateStore(projectRoot)

    const initialState = {
      ...createTestState(),

      /**
       * 固定旧时间，避免测试依赖毫秒级等待。
       */
      updatedAt: '2020-01-01T00:00:00.000Z'
    }

    await store.create(initialState)

    const updated = await store.update((current) => ({
      ...current,
      status: 'INPUT_GATE'
    }))

    expect(updated.status).toBe('INPUT_GATE')

    expect(updated.updatedAt).not.toBe(initialState.updatedAt)

    const restored = await store.read()

    expect(restored.status).toBe('INPUT_GATE')
    expect(restored.updatedAt).toBe(updated.updatedAt)
  })
})
