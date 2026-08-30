import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parse } from 'yaml'

import {
  RunRequestSchema,
  type RunRequest
} from '../schema/run-request'
import { DEVELOP_LOOP_DIRECTORY } from './state-store'

export const REQUEST_FILE_NAME = 'request.yaml'

export class RunRequestStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'RunRequestStoreError'
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

/**
 * 读取 Codex Skill 生成的 .develop-loop/request.yaml。
 * 这个类只处理机器协议，不尝试理解用户自然语言。
 */
export class RunRequestStore {
  readonly projectRoot: string
  readonly requestFile: string

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot)
    this.requestFile = resolve(
      this.projectRoot,
      DEVELOP_LOOP_DIRECTORY,
      REQUEST_FILE_NAME
    )
  }

  async read(): Promise<RunRequest> {
    let content: string

    try {
      content = await readFile(this.requestFile, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new RunRequestStoreError(
          `未找到请求文件：${this.requestFile}`,
          error
        )
      }

      throw new RunRequestStoreError(
        `无法读取请求文件：${this.requestFile}`,
        error
      )
    }

    let yaml: unknown

    try {
      yaml = parse(content)
    } catch (error) {
      throw new RunRequestStoreError(
        `请求文件不是合法 YAML：${this.requestFile}`,
        error
      )
    }

    const result = RunRequestSchema.safeParse(yaml)

    if (!result.success) {
      throw new RunRequestStoreError(
        [
          `请求文件结构不合法：${this.requestFile}`,
          JSON.stringify(result.error.issues, null, 2)
        ].join('\n'),
        result.error
      )
    }

    return result.data
  }
}
