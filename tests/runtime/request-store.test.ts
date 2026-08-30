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

import {
  REQUEST_FILE_NAME,
  RunRequestStore,
  RunRequestStoreError
} from '../../src/runtime/request-store'
import { DEVELOP_LOOP_DIRECTORY } from '../../src/runtime/state-store'

describe('RunRequestStore', () => {
  let projectRoot = ''
  let requestFile = ''

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-request-store-'))
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

  it('读取并校验 Skill 生成的 request.yaml', async () => {
    await writeFile(
      requestFile,
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '请根据这些附件完成后端系分',
        resources: [
          {
            id: 'prd',
            label: '产品需求文档',
            kind: 'PRD',
            path: 'docs/prd.md'
          }
        ]
      }),
      'utf8'
    )

    const request = await new RunRequestStore(projectRoot).read()

    expect(request.analysisType).toBe('backend')
    expect(request.resources[0]?.required).toBe(true)
  })

  it('允许必填资源暂时没有 path', async () => {
    await writeFile(
      requestFile,
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '先开始，缺文件再问我',
        resources: [
          {
            id: 'prd',
            label: '产品需求文档',
            kind: 'PRD',
            required: true
          }
        ]
      }),
      'utf8'
    )

    const request = await new RunRequestStore(projectRoot).read()

    expect(request.resources[0]?.path).toBeUndefined()
  })

  it('拒绝重复的资源 id', async () => {
    await writeFile(
      requestFile,
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '执行后端系分',
        resources: [
          {
            id: 'prd',
            label: '第一份 PRD',
            kind: 'PRD'
          },
          {
            id: 'prd',
            label: '第二份 PRD',
            kind: 'PRD'
          }
        ]
      }),
      'utf8'
    )

    await expect(new RunRequestStore(projectRoot).read())
      .rejects.toBeInstanceOf(RunRequestStoreError)
  })
})
