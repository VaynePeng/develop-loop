import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  InputGateError,
  resumeInputGate,
  runInputGate,
} from '../../src/gates/input-gate'
import {
  createInitialState,
  type InitialInputResource,
} from '../../src/runtime/state-factory'
import { calculateFileSha256 } from '../../src/runtime/input-snapshot-store'
import { StateStore } from '../../src/runtime/state-store'

describe('Input Gate', () => {
  let projectRoot = ''
  let store: StateStore

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-input-gate-'))
    store = new StateStore(projectRoot)
  })

  afterEach(async () => {
    await rm(projectRoot, {
      recursive: true,
      force: true,
    })
  })

  async function createState(
    resources: InitialInputResource[],
  ): Promise<void> {
    await store.create(createInitialState({
      projectRoot,
      originalRequest: 'develop-loop prd 后端系分',
      analysisType: 'backend',
      resources,
    }))
  }

  it('必填资源缺失时进入 WAITING_USER', async () => {
    await createState([
      {
        id: 'prd',
        kind: 'PRD',
        path: 'docs/prd.md',
      },
    ])

    const result = await runInputGate(store)

    expect(result.status).toBe('WAITING_USER')
    expect(result.input.missingResourceIds).toEqual(['prd'])
    expect(result.input.resources[0]?.availability).toBe('MISSING')
    expect(await store.read()).toEqual(result)
  })

  it('文件和仓库目录都可用时进入 SYSTEM_ANALYSIS', async () => {
    await mkdir(join(projectRoot, 'docs'), { recursive: true })
    await mkdir(join(projectRoot, 'repository'))
    await writeFile(join(projectRoot, 'docs/prd.md'), '# PRD\n', 'utf8')

    await createState([
      {
        id: 'prd',
        kind: 'PRD',
        path: 'docs/prd.md',
      },
      {
        id: 'repository',
        kind: 'REPOSITORY',
        path: 'repository',
      },
    ])

    const result = await runInputGate(store)

    expect(result.status).toBe('SYSTEM_ANALYSIS')
    expect(result.input.missingResourceIds).toEqual([])
    expect(result.input.resources.map((resource) => resource.availability))
      .toEqual(['AVAILABLE', 'AVAILABLE'])
  })

  it('可选资源缺失不会阻塞流程', async () => {
    await mkdir(join(projectRoot, 'docs'), { recursive: true })
    await writeFile(join(projectRoot, 'docs/prd.md'), '# PRD\n', 'utf8')

    await createState([
      {
        id: 'prd',
        kind: 'PRD',
        path: 'docs/prd.md',
      },
      {
        id: 'api-doc',
        kind: 'API_DOC',
        path: 'docs/api.md',
        required: false,
      },
    ])

    const result = await runInputGate(store)

    expect(result.status).toBe('SYSTEM_ANALYSIS')
    expect(result.input.missingResourceIds).toEqual([])
    expect(result.input.resources[1]?.availability).toBe('MISSING')
  })

  it('用户补齐资料后可从 WAITING_USER 恢复', async () => {
    await createState([
      {
        id: 'prd',
        kind: 'PRD',
        path: 'docs/prd.md',
      },
    ])

    const waiting = await runInputGate(store)
    expect(waiting.status).toBe('WAITING_USER')

    await mkdir(join(projectRoot, 'docs'), { recursive: true })
    await writeFile(join(projectRoot, 'docs/prd.md'), '# PRD\n', 'utf8')

    const resumed = await resumeInputGate(store)

    expect(resumed.status).toBe('SYSTEM_ANALYSIS')
    expect(resumed.input.missingResourceIds).toEqual([])
    expect(resumed.input.resources[0]?.availability).toBe('AVAILABLE')
  })

  it('非 WAITING_USER 状态不能调用恢复入口', async () => {
    await createState([])

    await expect(resumeInputGate(store)).rejects.toBeInstanceOf(InputGateError)
  })

  it('附件内容与 request 中的哈希不一致时视为缺失', async () => {
    await mkdir(join(projectRoot, 'docs'), { recursive: true })
    const prdPath = join(projectRoot, 'docs/prd.md')
    await writeFile(prdPath, '# 第一版 PRD\n', 'utf8')
    const expectedSha256 = await calculateFileSha256(prdPath)

    await writeFile(prdPath, '# 被修改的 PRD\n', 'utf8')

    await createState([
      {
        id: 'prd',
        kind: 'PRD',
        path: 'docs/prd.md',
        sha256: expectedSha256,
      },
    ])

    const result = await runInputGate(store)

    expect(result.status).toBe('WAITING_USER')
    expect(result.input.missingResourceIds).toEqual(['prd'])
    expect(result.input.resources[0]?.availability).toBe('MISSING')
  })
})
