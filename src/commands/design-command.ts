import { readFile } from 'node:fs/promises'

import { calculateFileSha256 } from '../runtime/input-snapshot-store'
import { resolveProjectFile } from '../runtime/project-file'
import { StateStore } from '../runtime/state-store'
import { TaskPlanStore } from '../runtime/task-plan-store'
import { commitTransition } from '../runtime/transition'
import type { DevLoopState } from '../schema/state'

export interface SubmitDesignFeedbackOptions {
  projectRoot: string
  feedback?: string
  feedbackFile?: string
}

export async function executeSubmitDesignFeedback(
  options: SubmitDesignFeedbackOptions
): Promise<DevLoopState> {
  const store = new StateStore(options.projectRoot)
  const current = await store.read()

  if (current.status !== 'WAITING_DESIGN_APPROVAL') {
    throw new Error(`当前状态 ${current.status} 不能提交设计反馈`)
  }

  const content = options.feedbackFile
    ? await readFile(
        await resolveProjectFile(options.projectRoot, options.feedbackFile),
        'utf8'
      )
    : options.feedback

  if (!content?.trim()) throw new Error('设计反馈不能为空')

  return commitTransition(
    store,
    'DESIGN_FEEDBACK_RECEIVED',
    (state) => ({
      ...state,
      status: 'SYSTEM_ANALYSIS',
      design: {
        ...state.design,
        feedback: [
          ...state.design.feedback,
          {
            revision: state.design.revision,
            content: content.trim(),
            createdAt: new Date().toISOString()
          }
        ],
        lockedAt: undefined,
        lockedHash: undefined
      },
      lastError: undefined
    }),
    { revision: current.design.revision, feedback: content.trim() }
  )
}

export async function executeApproveDesign(
  projectRoot: string
): Promise<DevLoopState> {
  const store = new StateStore(projectRoot)
  const current = await store.read()

  if (current.status !== 'WAITING_DESIGN_APPROVAL') {
    throw new Error(`当前状态 ${current.status} 不能确认设计`)
  }

  if (!current.design.artifactPath || !current.design.taskPlanPath) {
    throw new Error('系分产物或任务计划不存在')
  }

  const designPath = await resolveProjectFile(
    projectRoot,
    current.design.artifactPath
  )
  const taskPlan = await new TaskPlanStore(projectRoot).read(
    current.design.taskPlanPath
  )
  const lockedHash = await calculateFileSha256(designPath)

  return commitTransition(
    store,
    'DESIGN_APPROVED',
    (state) => ({
      ...state,
      status: 'DEVELOPMENT',
      design: {
        ...state.design,
        lockedAt: new Date().toISOString(),
        lockedHash
      },
      development: {
        ...state.development,
        currentTaskIndex: 0,
        tasks: taskPlan.tasks.map((task, index) => ({
          id: task.id,
          title: task.title,
          stage: 'PLAN' as const,
          status: index === 0 ? 'RUNNING' as const : 'PENDING' as const,
          attempts: {},
          artifactPaths: []
        }))
      },
      lastError: undefined
    }),
    {
      revision: current.design.revision,
      lockedHash,
      taskCount: taskPlan.tasks.length
    }
  )
}
