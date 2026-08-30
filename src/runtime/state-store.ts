import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'

import {
  DevLoopStateSchema,
  type DevLoopState,
} from '../schema/state'

export const DEVELOP_LOOP_DIRECTORY = '.develop-loop'
export const STATE_FILE_NAME = 'state.json'

/**
 * StateStore 自己抛出的错误。
 *
 * 这样 CLI 后续可以区分：
 * - 用户输入错误
 * - state.json 错误
 * - Codex 执行错误
 */
export class StateStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'StateStoreError'
  }
}

/**
 * 判断 unknown 错误是否是 Node.js 文件系统错误。
 */
function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export class StateStore {
  readonly projectRoot: string
  readonly runtimeDirectory: string
  readonly stateFile: string

  constructor(projectRoot: string) {
    /**
     * 保存绝对路径。
     *
     * 这样用户切换终端目录后，resume 仍然指向同一个项目。
     */
    this.projectRoot = resolve(projectRoot)

    this.runtimeDirectory = resolve(
      this.projectRoot,
      DEVELOP_LOOP_DIRECTORY,
    )

    this.stateFile = resolve(
      this.runtimeDirectory,
      STATE_FILE_NAME,
    )
  }

  /**
   * 判断当前项目是否已经有运行状态。
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.stateFile, constants.F_OK)
      return true
    }
    catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT')
        return false

      throw new StateStoreError(
        `无法检查状态文件：${this.stateFile}`,
        error,
      )
    }
  }

  /**
   * 首次创建 state.json。
   *
   * 如果已经存在则拒绝覆盖，防止用户误执行 start
   * 导致正在进行的研发流程丢失。
   */
  async create(
    initialState: DevLoopState,
  ): Promise<DevLoopState> {
    if (await this.exists()) {
      throw new StateStoreError(
        `状态文件已经存在，请使用 resume：${this.stateFile}`,
      )
    }

    return this.write(initialState)
  }

  /**
   * 读取并校验 state.json。
   */
  async read(): Promise<DevLoopState> {
    let content: string

    try {
      content = await readFile(this.stateFile, 'utf8')
    }
    catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        throw new StateStoreError(
          `未找到状态文件，请先执行 start：${this.stateFile}`,
          error,
        )
      }

      throw new StateStoreError(
        `无法读取状态文件：${this.stateFile}`,
        error,
      )
    }

    let json: unknown

    try {
      json = JSON.parse(content)
    }
    catch (error) {
      throw new StateStoreError(
        `状态文件不是合法 JSON：${this.stateFile}`,
        error,
      )
    }

    const result = DevLoopStateSchema.safeParse(json)

    if (!result.success) {
      throw new StateStoreError(
        [
          `状态文件结构不合法：${this.stateFile}`,
          JSON.stringify(result.error.issues, null, 2),
        ].join('\n'),
        result.error,
      )
    }

    return result.data
  }

  /**
   * 读取当前状态，执行修改，然后安全写回。
   *
   * engine 后续不用重复编写 read → modify → write。
   */
  async update(
    updater: (
      current: DevLoopState,
    ) => DevLoopState | Promise<DevLoopState>,
  ): Promise<DevLoopState> {
    const current = await this.read()
    const next = await updater(current)

    return this.write({
      ...next,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * 写入前再次使用 Zod 校验。
   *
   * 即使 engine 中存在 bug，也不允许把非法状态写入磁盘。
   */
  private async write(
    state: DevLoopState,
  ): Promise<DevLoopState> {
    const validatedState = DevLoopStateSchema.parse(state)

    await mkdir(this.runtimeDirectory, {
      recursive: true,
    })

    /**
     * 临时文件必须与 state.json 位于同一目录，
     * 才能保证 rename 在同一文件系统中完成。
     */
    const temporaryFile = resolve(
      dirname(this.stateFile),
      `.${STATE_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
    )

    const serialized = `${JSON.stringify(
      validatedState,
      null,
      2,
    )}\n`

    try {
      /**
       * wx 表示只创建新文件。
       * 如果随机临时文件已经存在，就拒绝覆盖。
       */
      const handle = await open(temporaryFile, 'wx')

      try {
        await handle.writeFile(serialized, 'utf8')

        /**
         * 请求操作系统把缓存内容刷新到磁盘。
         */
        await handle.sync()
      }
      finally {
        await handle.close()
      }

      await rename(temporaryFile, this.stateFile)
    }
    catch (error) {
      /**
       * 只清理由当前写入生成的精确临时文件，
       * 不删除 state.json。
       */
      await rm(temporaryFile, {
        force: true,
      })

      throw new StateStoreError(
        `无法写入状态文件：${this.stateFile}`,
        error,
      )
    }

    return validatedState
  }
}
