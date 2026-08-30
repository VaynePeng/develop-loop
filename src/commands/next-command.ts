import { StateStore } from '../runtime/state-store'
import { TaskPlanStore } from '../runtime/task-plan-store'
import { WorkflowLoader } from '../runtime/workflow-loader'
import type { DevLoopState } from '../schema/state'

export interface NextAction {
  status: DevLoopState['status']
  action: string
  promptPath?: string
  templatePaths: string[]
  context: Record<string, unknown>
}

const TASK_TEMPLATE: Record<string, string> = {
  PLAN: 'templates/task-stage-plan.md',
  IMPLEMENT: 'templates/implementation-report.md',
  VERIFY: 'templates/verify-report.yaml',
  REVIEW: 'templates/review-report.yaml',
  SCOPE_CHECK: 'templates/scope-report.yaml'
}

export async function executeNextCommand(
  projectRoot: string
): Promise<NextAction> {
  const state = await new StateStore(projectRoot).read()
  const loader = new WorkflowLoader()
  const workflow = await loader.load()

  if (state.status === 'WAITING_USER') {
    return {
      status: state.status,
      action: 'ASK_USER_FOR_MISSING_INPUT',
      templatePaths: [],
      context: {
        missingResources: state.input.resources.filter(
          (resource) => state.input.missingResourceIds.includes(resource.id)
        )
      }
    }
  }

  if (state.status === 'SYSTEM_ANALYSIS') {
    const isRevision = state.design.feedback.length > 0
    return {
      status: state.status,
      action: isRevision ? 'REVISE_SYSTEM_ANALYSIS' : 'CREATE_SYSTEM_ANALYSIS',
      promptPath: await loader.resolveAsset(
        isRevision
          ? workflow.systemAnalysis.revisionPrompt
          : workflow.systemAnalysis.prompt
      ),
      templatePaths: await Promise.all([
        loader.resolveAsset(workflow.systemAnalysis.designTemplate),
        loader.resolveAsset(workflow.systemAnalysis.taskPlanTemplate)
      ]),
      context: {
        analysisType: state.input.analysisType,
        originalRequest: state.input.originalRequest,
        resources: state.input.resources,
        currentRevision: state.design.revision,
        feedback: state.design.feedback
      }
    }
  }

  if (state.status === 'WAITING_DESIGN_APPROVAL') {
    return {
      status: state.status,
      action: 'ASK_USER_TO_APPROVE_OR_REVISE_DESIGN',
      templatePaths: [],
      context: {
        revision: state.design.revision,
        designPath: state.design.artifactPath,
        taskPlanPath: state.design.taskPlanPath
      }
    }
  }

  if (state.status === 'DEVELOPMENT') {
    const task = state.development.tasks[state.development.currentTaskIndex]
    if (!task || task.stage === 'DONE') throw new Error('当前研发任务状态不合法')
    const stage = workflow.development.stages.find(
      (candidate) => candidate.id === task.stage
    )
    if (!stage) throw new Error(`工作流未定义阶段：${task.stage}`)
    const taskPlan = await new TaskPlanStore(projectRoot).read(
      state.design.taskPlanPath!
    )

    return {
      status: state.status,
      action: `EXECUTE_TASK_${task.stage}`,
      promptPath: await loader.resolveAsset(stage.prompt),
      templatePaths: [await loader.resolveAsset(TASK_TEMPLATE[task.stage]!)],
      context: {
        task: taskPlan.tasks.find((candidate) => candidate.id === task.id),
        runtimeTask: task,
        taskIndex: state.development.currentTaskIndex,
        taskCount: state.development.tasks.length,
        lockedDesignPath: state.design.artifactPath
      }
    }
  }

  if (state.status === 'FINAL_VERIFY') {
    return {
      status: state.status,
      action: 'EXECUTE_FINAL_VERIFY',
      promptPath: await loader.resolveAsset(workflow.sdlc.finalVerify.prompt),
      templatePaths: [
        await loader.resolveAsset(workflow.sdlc.finalVerify.template)
      ],
      context: {
        requiredChecks: workflow.sdlc.finalVerify.requiredChecks,
        attempts: state.development.finalVerifyAttempts,
        lockedDesignPath: state.design.artifactPath
      }
    }
  }

  return {
    status: state.status,
    action: state.status,
    templatePaths: [],
    context: {
      completedAt: state.completedAt,
      lastError: state.lastError,
      finalReportPath: state.development.finalVerification.reportPath
    }
  }
}
