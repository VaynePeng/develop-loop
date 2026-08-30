import { TaskPlanStore } from '../runtime/task-plan-store'
import { StateStore } from '../runtime/state-store'
import { commitTransition } from '../runtime/transition'
import { recordRetryFailure } from '../runtime/retry'
import { WorkflowLoader } from '../runtime/workflow-loader'
import type { DevLoopState } from '../schema/state'
import { validateDesign } from '../validators/design-validator'
import { resolveProjectFile } from '../runtime/project-file'

export interface SubmitAnalysisOptions {
  projectRoot: string
  designPath: string
  taskPlanPath: string
}

export async function executeSubmitAnalysis(
  options: SubmitAnalysisOptions
): Promise<DevLoopState> {
  const store = new StateStore(options.projectRoot)
  const current = await store.read()

  if (current.status !== 'SYSTEM_ANALYSIS') {
    throw new Error(`当前状态 ${current.status} 不能提交系分`)
  }

  let design: Awaited<ReturnType<typeof validateDesign>>
  let taskPlanPath: string

  try {
    const workflow = await new WorkflowLoader().load()
    design = await validateDesign(
      options.projectRoot,
      options.designPath,
      workflow.systemAnalysis.requiredDesignSections
    )
    taskPlanPath = await resolveProjectFile(
      options.projectRoot,
      options.taskPlanPath
    )
    await new TaskPlanStore(options.projectRoot).read(taskPlanPath)
  } catch (error) {
    await recordRetryFailure(store, 'SYSTEM_ANALYSIS', 'SYSTEM_ANALYSIS', error)
    throw error
  }

  return commitTransition(
    store,
    'DESIGN_SUBMITTED',
    (state) => ({
      ...state,
      status: 'WAITING_DESIGN_APPROVAL',
      design: {
        ...state.design,
        revision: state.design.revision + 1,
        artifactPath: design.path,
        taskPlanPath,
        lockedAt: undefined,
        lockedHash: undefined
      },
      lastError: undefined
    }),
    {
      designPath: design.path,
      taskPlanPath,
      sha256: design.sha256
    }
  )
}
