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

import { executeIntakeCommand } from '../../src/commands/intake-command'
import { executeResumeCommand } from '../../src/commands/resume-command'
import { executeStartCommand } from '../../src/commands/start-command'
import { REQUEST_FILE_NAME } from '../../src/runtime/request-store'
import { DEVELOP_LOOP_DIRECTORY } from '../../src/runtime/state-store'

describe('start 和 resume 命令', () => {
  let projectRoot = ''
  let requestFile = ''

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-command-'))
    const runtimeDirectory = join(projectRoot, DEVELOP_LOOP_DIRECTORY)
    requestFile = join(runtimeDirectory, REQUEST_FILE_NAME)

    await mkdir(runtimeDirectory, { recursive: true })
  })

  afterEach(async () => {
    await rm(projectRoot, {
      recursive: true,
      force: true
    })
  })

  async function writeRequest(
    prdPath?: string,
    prdSha256?: string
  ): Promise<void> {
    await writeFile(
      requestFile,
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '这是退款需求，请根据附件做后端系分',
        resources: [
          {
            id: 'repository',
            label: '当前代码仓库',
            kind: 'REPOSITORY',
            path: '.',
            required: true
          },
          {
            id: 'prd',
            label: '退款需求 PRD',
            kind: 'PRD',
            path: prdPath,
            sha256: prdSha256,
            required: true
          }
        ]
      }),
      'utf8'
    )
  }

  it('缺少附件时暂停，更新 request.yaml 后可以恢复', async () => {
    await writeRequest()

    const waiting = await executeStartCommand({ projectRoot })

    expect(waiting.status).toBe('WAITING_USER')
    expect(waiting.input.missingResourceIds).toEqual(['prd'])
    expect(waiting.input.resources[1]?.path).toBeUndefined()

    const uploadsDirectory = join(projectRoot, 'uploads')
    const uploadPath = join(uploadsDirectory, 'refund-prd.md')
    await mkdir(uploadsDirectory)
    await writeFile(uploadPath, '# 退款需求\n')

    const snapshot = await executeIntakeCommand({
      projectRoot,
      resourceId: 'prd',
      sourcePath: uploadPath
    })

    await writeRequest(snapshot.requestPath, snapshot.sha256)

    const resumed = await executeResumeCommand({ projectRoot })

    expect(resumed.status).toBe('SYSTEM_ANALYSIS')
    expect(resumed.input.missingResourceIds).toEqual([])
    expect(resumed.input.resources[1]?.availability).toBe('AVAILABLE')
    expect(resumed.input.resources[1]?.sha256).toBe(snapshot.sha256)
  })
})
