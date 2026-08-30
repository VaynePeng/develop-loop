import { z } from 'zod'

import { InputResourceIdSchema } from './state'

export const RepositoryPathSchema = z.string().min(1).superRefine((path, context) => {
  if (path.startsWith('/') || path.split('/').includes('..')) {
    context.addIssue({
      code: 'custom',
      message: '路径必须是仓库内的相对路径，且不能包含 ..'
    })
  }
})

export const TaskPlanTaskSchema = z.object({
  id: InputResourceIdSchema,
  title: z.string().min(1),
  objective: z.string().min(1),
  dependsOn: z.array(InputResourceIdSchema).default([]),
  allowedPaths: z.array(RepositoryPathSchema).min(1),
  forbiddenPaths: z.array(RepositoryPathSchema).default([]),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  verifyCommands: z.array(z.string().min(1)).min(1)
})

export const TaskPlanSchema = z.object({
  schemaVersion: z.literal(1),
  tasks: z.array(TaskPlanTaskSchema).min(1)
}).superRefine((plan, context) => {
  const taskIds = new Set(plan.tasks.map((task) => task.id))

  plan.tasks.forEach((task, index) => {
    if (plan.tasks.findIndex((candidate) => candidate.id === task.id) !== index) {
      context.addIssue({
        code: 'custom',
        path: ['tasks', index, 'id'],
        message: `任务 id 重复：${task.id}`
      })
    }

    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) {
        context.addIssue({
          code: 'custom',
          path: ['tasks', index, 'dependsOn'],
          message: `依赖的任务不存在：${dependency}`
        })
      }

      if (dependency === task.id) {
        context.addIssue({
          code: 'custom',
          path: ['tasks', index, 'dependsOn'],
          message: '任务不能依赖自身'
        })
      }

      const dependencyIndex = plan.tasks.findIndex(
        (candidate) => candidate.id === dependency
      )

      if (dependencyIndex >= index) {
        context.addIssue({
          code: 'custom',
          path: ['tasks', index, 'dependsOn'],
          message: `依赖任务必须排在当前任务之前：${dependency}`
        })
      }
    }
  })
})

export const VerifyReportSchema = z.object({
  schemaVersion: z.literal(1),
  result: z.literal('passed'),
  commands: z.array(z.object({
    command: z.string().min(1),
    exitCode: z.literal(0),
    summary: z.string().min(1)
  })).min(1)
})

export const ReviewReportSchema = z.object({
  schemaVersion: z.literal(1),
  result: z.literal('passed'),
  blockers: z.array(z.never()).length(0),
  observations: z.array(z.string().min(1)).default([])
})

export const ScopeReportSchema = z.object({
  schemaVersion: z.literal(1),
  result: z.literal('passed'),
  changedPaths: z.array(RepositoryPathSchema),
  summary: z.string().min(1)
})

export const FinalVerifyReportSchema = z.object({
  schemaVersion: z.literal(1),
  result: z.literal('passed'),
  checks: z.array(z.object({
    id: z.string().min(1),
    passed: z.literal(true),
    evidence: z.string().min(1)
  })).min(1),
  summary: z.string().min(1)
})

export type TaskPlan = z.infer<typeof TaskPlanSchema>
export type TaskPlanTask = z.infer<typeof TaskPlanTaskSchema>
export type VerifyReport = z.infer<typeof VerifyReportSchema>
export type ReviewReport = z.infer<typeof ReviewReportSchema>
export type ScopeReport = z.infer<typeof ScopeReportSchema>
export type FinalVerifyReport = z.infer<typeof FinalVerifyReportSchema>
