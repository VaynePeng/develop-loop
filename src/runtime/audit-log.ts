import { mkdir, open } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { DevLoopState } from '../schema/state'
import { DEVELOP_LOOP_DIRECTORY } from './state-store'

export const AUDIT_FILE_NAME = 'audit.jsonl'

export interface AuditEvent {
  schemaVersion: 1
  eventId: string
  runId: string
  event: string
  fromStatus: DevLoopState['status'] | null
  toStatus: DevLoopState['status']
  occurredAt: string
  details: Record<string, unknown>
}

export class AuditLog {
  readonly file: string

  constructor(projectRoot: string) {
    this.file = resolve(projectRoot, DEVELOP_LOOP_DIRECTORY, AUDIT_FILE_NAME)
  }

  async append(event: AuditEvent): Promise<void> {
    await mkdir(resolve(this.file, '..'), { recursive: true })
    const handle = await open(this.file, 'a')

    try {
      await handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
}
