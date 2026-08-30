import { resolveProjectFile } from '../runtime/project-file'
import { StateStore } from '../runtime/state-store'
import { commitTransition } from '../runtime/transition'
import { WorkflowLoader } from '../runtime/workflow-loader'
import type { DevLoopState } from '../schema/state'
import { assertDesignLockIntact } from '../validators/design-lock-validator'
import { validateFinalVerifyReport } from '../validators/report-validator'

async function recordFinalFailure(
  store: StateStore,
  error: unknown
): Promise<DevLoopState> {
  const current = await store.read()
  if (current.status !== 'FINAL_VERIFY') {
    throw new Error(`当前状态 ${current.status} 不能记录最终验证失败`)
  }

  const message = error instanceof Error ? error.message : String(error)
  const attempts = current.development.finalVerifyAttempts + 1
  const exhausted = attempts > current.workflow.maxRetries

  return commitTransition(
    store,
    exhausted ? 'FINAL_VERIFY_RETRY_EXHAUSTED' : 'FINAL_VERIFY_FAILED',
    (state) => ({
      ...state,
      status: exhausted ? 'FAILED' : 'FINAL_VERIFY',
      development: {
        ...state.development,
        finalVerifyAttempts: attempts,
        finalVerification: {
          ...state.development.finalVerification,
          lastError: message
        }
      },
      lastError: {
        code: exhausted ? 'MAX_RETRIES_EXCEEDED' : 'FINAL_VERIFY_FAILED',
        message,
        phase: 'FINAL_VERIFY',
        recoverable: !exhausted,
        occurredAt: new Date().toISOString()
      }
    }),
    { attempts, maxRetries: current.workflow.maxRetries, message }
  )
}

export async function executePassFinalVerify(
  projectRoot: string,
  reportPath: string
): Promise<DevLoopState> {
  const store = new StateStore(projectRoot)
  const current = await store.read()

  if (current.status !== 'FINAL_VERIFY') {
    throw new Error(`当前状态 ${current.status} 不能完成最终验证`)
  }

  let report: Awaited<ReturnType<typeof validateFinalVerifyReport>>
  let absoluteReportPath: string

  try {
    await assertDesignLockIntact(current)
    const workflow = await new WorkflowLoader().load()
    report = await validateFinalVerifyReport(
      projectRoot,
      reportPath,
      workflow.sdlc.finalVerify.requiredChecks
    )
    absoluteReportPath = await resolveProjectFile(projectRoot, reportPath)
  } catch (error) {
    await recordFinalFailure(store, error)
    throw error
  }

  return commitTransition(
    store,
    'WORKFLOW_COMPLETED',
    (state) => ({
      ...state,
      status: 'COMPLETED',
      development: {
        ...state.development,
        finalVerification: {
          reportPath: absoluteReportPath,
          completedChecks: report.checks.map((check) => check.id)
        }
      },
      lastError: undefined,
      completedAt: new Date().toISOString()
    }),
    { reportPath: absoluteReportPath }
  )
}

export async function executeFailFinalVerify(
  projectRoot: string,
  error: string
): Promise<DevLoopState> {
  if (!error.trim()) throw new Error('失败原因不能为空')
  return recordFinalFailure(
    new StateStore(projectRoot),
    new Error(error.trim())
  )
}
