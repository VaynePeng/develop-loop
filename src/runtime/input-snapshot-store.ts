import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  copyFile,
  mkdir,
  rename,
  rm,
  stat
} from 'node:fs/promises'
import {
  basename,
  extname,
  relative,
  resolve,
  sep
} from 'node:path'

import { InputResourceIdSchema } from '../schema/state'
import { DEVELOP_LOOP_DIRECTORY } from './state-store'

export const INPUTS_DIRECTORY_NAME = 'inputs'

export interface InputSnapshotResult {
  resourceId: string
  requestPath: string
  snapshotPath: string
  sha256: string
}

export class InputSnapshotStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'InputSnapshotStoreError'
  }
}

export async function calculateFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')

  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk)
  }

  return hash.digest('hex')
}

function toRequestPath(projectRoot: string, filePath: string): string {
  return relative(projectRoot, filePath).split(sep).join('/')
}

/**
 * 把 Codex 会话中的附件复制到目标项目的 .develop-loop/inputs。
 * 相同内容重复导入会复用快照；同名不同内容会保留两个版本。
 */
export class InputSnapshotStore {
  readonly projectRoot: string
  readonly inputsDirectory: string

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot)
    this.inputsDirectory = resolve(
      this.projectRoot,
      DEVELOP_LOOP_DIRECTORY,
      INPUTS_DIRECTORY_NAME
    )
  }

  async snapshot(
    resourceId: string,
    sourcePath: string
  ): Promise<InputSnapshotResult> {
    const resourceIdResult = InputResourceIdSchema.safeParse(resourceId)

    if (!resourceIdResult.success) {
      throw new InputSnapshotStoreError(
        `资源 id 不合法：${resourceId}`,
        resourceIdResult.error
      )
    }

    const absoluteSourcePath = resolve(sourcePath)
    let sourceStat: Awaited<ReturnType<typeof stat>>

    try {
      sourceStat = await stat(absoluteSourcePath)
    } catch (error) {
      throw new InputSnapshotStoreError(
        `无法读取附件：${absoluteSourcePath}`,
        error
      )
    }

    if (!sourceStat.isFile()) {
      throw new InputSnapshotStoreError(
        `附件必须是普通文件：${absoluteSourcePath}`
      )
    }

    const sha256 = await calculateFileSha256(absoluteSourcePath)
    const resourceDirectory = resolve(
      this.inputsDirectory,
      resourceIdResult.data
    )
    const sourceFileName = basename(absoluteSourcePath)

    await mkdir(resourceDirectory, { recursive: true })

    let snapshotPath = resolve(resourceDirectory, sourceFileName)

    try {
      const existingStat = await stat(snapshotPath)

      if (existingStat.isFile()) {
        const existingHash = await calculateFileSha256(snapshotPath)

        if (existingHash === sha256) {
          return {
            resourceId: resourceIdResult.data,
            requestPath: toRequestPath(this.projectRoot, snapshotPath),
            snapshotPath,
            sha256
          }
        }
      }

      const extension = extname(sourceFileName)
      const stem = sourceFileName.slice(
        0,
        sourceFileName.length - extension.length
      )
      snapshotPath = resolve(
        resourceDirectory,
        `${stem}-${sha256.slice(0, 12)}${extension}`
      )
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw new InputSnapshotStoreError(
          `无法检查附件快照：${snapshotPath}`,
          error
        )
      }
    }

    const temporaryPath = resolve(
      resourceDirectory,
      `.${basename(snapshotPath)}.${process.pid}.${randomUUID()}.tmp`
    )

    try {
      await copyFile(absoluteSourcePath, temporaryPath)
      await rename(temporaryPath, snapshotPath)
    } catch (error) {
      await rm(temporaryPath, { force: true })

      throw new InputSnapshotStoreError(
        `无法保存附件快照：${snapshotPath}`,
        error
      )
    }

    return {
      resourceId: resourceIdResult.data,
      requestPath: toRequestPath(this.projectRoot, snapshotPath),
      snapshotPath,
      sha256
    }
  }
}
