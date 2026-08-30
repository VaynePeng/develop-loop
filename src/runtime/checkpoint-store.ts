import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import type { DevLoopState } from '../schema/state'
import { DEVELOP_LOOP_DIRECTORY } from './state-store'

export const CHECKPOINTS_DIRECTORY_NAME = 'checkpoints'

export class CheckpointStore {
  readonly directory: string

  constructor(projectRoot: string) {
    this.directory = resolve(
      projectRoot,
      DEVELOP_LOOP_DIRECTORY,
      CHECKPOINTS_DIRECTORY_NAME
    )
  }

  async write(state: DevLoopState, event: string): Promise<string> {
    await mkdir(this.directory, { recursive: true })
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    const safeEvent = event.replaceAll(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
    const path = resolve(
      this.directory,
      `${timestamp}-${safeEvent}-${randomUUID()}.json`
    )

    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })

    return path
  }
}
