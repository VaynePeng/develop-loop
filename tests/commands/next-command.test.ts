import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { stringify } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { executeNextCommand } from '../../src/commands/next-command'
import { executeStartCommand } from '../../src/commands/start-command'
import { REQUEST_FILE_NAME } from '../../src/runtime/request-store'
import { DEVELOP_LOOP_DIRECTORY } from '../../src/runtime/state-store'

describe('next 命令', () => {
  let projectRoot = ''

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-next-'))
    await mkdir(join(projectRoot, DEVELOP_LOOP_DIRECTORY), { recursive: true })
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  async function writeRequest(prdPath?: string): Promise<void> {
    await writeFile(
      join(projectRoot, DEVELOP_LOOP_DIRECTORY, REQUEST_FILE_NAME),
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '根据 PRD 做后端系分',
        resources: [
          {
            id: 'repository',
            label: '当前仓库',
            kind: 'REPOSITORY',
            path: '.',
            required: true
          },
          {
            id: 'prd',
            label: '退款 PRD',
            kind: 'PRD',
            path: prdPath,
            required: true
          }
        ]
      }),
      'utf8'
    )
  }

  it('缺资料时只允许向用户索要 missingResources', async () => {
    await writeRequest()
    await executeStartCommand({ projectRoot })

    const next = await executeNextCommand(projectRoot)

    expect(next.action).toBe('ASK_USER_FOR_MISSING_INPUT')
    expect(next.status).toBe('WAITING_USER')
    expect(next.promptPath).toBeUndefined()
    expect(next.context.missingResources).toEqual([
      expect.objectContaining({
        id: 'prd',
        kind: 'PRD'
      })
    ])
  })

  it('输入齐全后给出系分 prompt 和两个模板', async () => {
    await writeFile(join(projectRoot, 'prd.md'), '# 退款需求\n', 'utf8')
    await writeRequest('prd.md')
    await executeStartCommand({ projectRoot })

    const next = await executeNextCommand(projectRoot)

    expect(next.action).toBe('CREATE_SYSTEM_ANALYSIS')
    expect(next.status).toBe('SYSTEM_ANALYSIS')
    expect(next.promptPath).toMatch(/system-analysis\.md$/)
    expect(next.templatePaths).toEqual([
      expect.stringMatching(/design\.md$/),
      expect.stringMatching(/task-plan\.yaml$/)
    ])
    expect(next.context.analysisType).toBe('backend')
  })
})
