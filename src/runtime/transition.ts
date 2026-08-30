import { randomUUID } from 'node:crypto'

import type { DevLoopState } from '../schema/state'
import { AuditLog } from './audit-log'
import { CheckpointStore } from './checkpoint-store'
import { StateStore } from './state-store'

export type StateUpdater = (
  current: DevLoopState
) => DevLoopState | Promise<DevLoopState>

export async function recordInitialState(
  store: StateStore,
  state: DevLoopState
): Promise<void> {
  await new CheckpointStore(store.projectRoot).write(state, 'run-created')
  await new AuditLog(store.projectRoot).append({
    schemaVersion: 1,
    eventId: randomUUID(),
    runId: state.runId,
    event: 'RUN_CREATED',
    fromStatus: null,
    toStatus: state.status,
    occurredAt: new Date().toISOString(),
    details: {}
  })
}

export async function commitTransition(
  store: StateStore,
  event: string,
  updater: StateUpdater,
  details: Record<string, unknown> = {}
): Promise<DevLoopState> {
  const before = await store.read()
  const after = await store.update(updater)

  await new CheckpointStore(store.projectRoot).write(after, event)
  await new AuditLog(store.projectRoot).append({
    schemaVersion: 1,
    eventId: randomUUID(),
    runId: after.runId,
    event,
    fromStatus: before.status,
    toStatus: after.status,
    occurredAt: new Date().toISOString(),
    details
  })

  return after
}
