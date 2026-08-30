import { resolveProjectFile } from '../runtime/project-file'
import { StateStore } from '../runtime/state-store'
import { TaskPlanStore } from '../runtime/task-plan-store'
import { commitTransition } from '../runtime/transition'
import { WorkflowLoader } from '../runtime/workflow-loader'
import type {
  DevelopmentTask,
  DevLoopState,
  TaskStage
} from '../schema/state'
import { assertDesignLockIntact } from '../validators/design-lock-validator'
import {
  validateReviewReport,
  validateScopeReport,
  validateVerifyReport
} from '../validators/report-validator'
import { validateTaskScope } from '../validators/scope-validator'

const NEXT_STAGE: Record<Exclude<TaskStage, 'DONE'>, TaskStage> = {
  PLAN: 'IMPLEMENT',
  IMPLEMENT: 'VERIFY',
  VERIFY: 'REVIEW',
  REVIEW: 'SCOPE_CHECK',
  SCOPE_CHECK: 'DONE'
}

type RunningDevelopmentTask = DevelopmentTask & {
  stage: Exclude<TaskStage, 'DONE'>
}

function getCurrentTask(state: DevLoopState): RunningDevelopmentTask {
  if (state.status !== 'DEVELOPMENT') {
    throw new Error(`当前状态 ${state.status} 不能执行研发任务`)
  }

  const task = state.development.tasks[state.development.currentTaskIndex]
  if (!task) throw new Error('找不到当前研发任务')
  if (task.stage === 'DONE') throw new Error(`任务 ${task.id} 已完成`)

  return task as RunningDevelopmentTask
}

async function validateStageArtifact(
  state: DevLoopState,
  artifactPath: string
): Promise<string> {
  const task = getCurrentTask(state)
  const artifact = await resolveProjectFile(state.projectRoot, artifactPath)

  if (task.stage === 'VERIFY') {
    await validateVerifyReport(state.projectRoot, artifact)
  } else if (task.stage === 'REVIEW') {
    await validateReviewReport(state.projectRoot, artifact)
  } else if (task.stage === 'SCOPE_CHECK') {
    const report = await validateScopeReport(state.projectRoot, artifact)
    const plan = await new TaskPlanStore(state.projectRoot).read(
      state.design.taskPlanPath!
    )
    const plannedTask = plan.tasks.find((candidate) => candidate.id === task.id)

    if (!plannedTask) throw new Error(`任务计划中找不到任务：${task.id}`)
    validateTaskScope(plannedTask, report)
  }

  return artifact
}

async function recordTaskFailure(
  store: StateStore,
  error: unknown
): Promise<DevLoopState> {
  const current = await store.read()
  const task = getCurrentTask(current)
  const message = error instanceof Error ? error.message : String(error)
  const attempts = (task.attempts[task.stage] ?? 0) + 1
  const exhausted = attempts > current.workflow.maxRetries

  return commitTransition(
    store,
    exhausted ? 'TASK_RETRY_EXHAUSTED' : 'TASK_STAGE_FAILED',
    (state) => {
      const tasks = state.development.tasks.map((candidate, index) =>
        index === state.development.currentTaskIndex
          ? {
              ...candidate,
              status: exhausted ? 'FAILED' as const : 'RUNNING' as const,
              attempts: {
                ...candidate.attempts,
                [candidate.stage]: attempts
              },
              lastError: message
            }
          : candidate
      )

      return {
        ...state,
        status: exhausted ? 'FAILED' : 'DEVELOPMENT',
        development: { ...state.development, tasks },
        lastError: {
          code: exhausted ? 'MAX_RETRIES_EXCEEDED' : 'TASK_STAGE_FAILED',
          message,
          phase: 'DEVELOPMENT',
          recoverable: !exhausted,
          occurredAt: new Date().toISOString()
        }
      }
    },
    {
      taskId: task.id,
      stage: task.stage,
      attempts,
      maxRetries: current.workflow.maxRetries,
      message
    }
  )
}

export interface PassTaskStageOptions {
  projectRoot: string
  artifactPath: string
}

export async function executePassTaskStage(
  options: PassTaskStageOptions
): Promise<DevLoopState> {
  const store = new StateStore(options.projectRoot)
  const current = await store.read()
  const task = getCurrentTask(current)

  let artifact: string
  let nextStage: TaskStage

  try {
    await assertDesignLockIntact(current)
    const workflow = await new WorkflowLoader().load()
    const stageConfig = workflow.development.stages.find(
      (stage) => stage.id === task.stage
    )

    if (!stageConfig) throw new Error(`工作流未定义阶段：${task.stage}`)
    if (stageConfig.artifactRequired && !options.artifactPath) {
      throw new Error(`阶段 ${task.stage} 必须提供产物`)
    }

    artifact = await validateStageArtifact(current, options.artifactPath)
    nextStage = NEXT_STAGE[task.stage]
  } catch (error) {
    await recordTaskFailure(store, error)
    throw error
  }

  const isTaskDone = nextStage === 'DONE'
  const isLastTask =
    current.development.currentTaskIndex === current.development.tasks.length - 1

  return commitTransition(
    store,
    'TASK_STAGE_PASSED',
    (state) => {
      const tasks = state.development.tasks.map((candidate, index) => {
        if (index === state.development.currentTaskIndex) {
          return {
            ...candidate,
            stage: nextStage,
            status: isTaskDone ? 'PASSED' as const : 'RUNNING' as const,
            artifactPaths: [...candidate.artifactPaths, artifact],
            lastError: undefined
          }
        }

        if (isTaskDone && index === state.development.currentTaskIndex + 1) {
          return { ...candidate, status: 'RUNNING' as const }
        }

        return candidate
      })

      return {
        ...state,
        status: isTaskDone && isLastTask ? 'FINAL_VERIFY' : 'DEVELOPMENT',
        development: {
          ...state.development,
          tasks,
          currentTaskIndex: isTaskDone && !isLastTask
            ? state.development.currentTaskIndex + 1
            : state.development.currentTaskIndex
        },
        lastError: undefined
      }
    },
    { taskId: task.id, stage: task.stage, artifact }
  )
}

export async function executeFailTaskStage(
  projectRoot: string,
  error: string
): Promise<DevLoopState> {
  if (!error.trim()) throw new Error('失败原因不能为空')
  const store = new StateStore(projectRoot)
  return recordTaskFailure(store, new Error(error.trim()))
}
