import type { DevLoopState } from '../schema/state'
import { StateStore } from './state-store'
import { commitTransition } from './transition'

export async function recordRetryFailure(
  store: StateStore,
  key: string,
  phase: DevLoopState['status'],
  error: unknown
): Promise<DevLoopState> {
  const message = error instanceof Error ? error.message : String(error)
  const current = await store.read()
  const attempts = (current.retry.counters[key] ?? 0) + 1
  const exhausted = attempts > current.workflow.maxRetries

  return commitTransition(
    store,
    exhausted ? 'RETRY_EXHAUSTED' : 'RETRY_RECORDED',
    (state) => ({
      ...state,
      status: exhausted ? 'FAILED' : state.status,
      retry: {
        counters: {
          ...state.retry.counters,
          [key]: attempts
        }
      },
      lastError: {
        code: exhausted ? 'MAX_RETRIES_EXCEEDED' : 'RETRYABLE_FAILURE',
        message,
        phase,
        recoverable: !exhausted,
        occurredAt: new Date().toISOString()
      }
    }),
    { key, attempts, maxRetries: current.workflow.maxRetries, message }
  )
}
