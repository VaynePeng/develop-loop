import { z } from 'zod'

import { TaskStageSchema } from './state'

export const WorkflowReferenceSchema = z.object({
  file: z.string().min(1)
})

export const SdlcWorkflowSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  version: z.string().min(1),
  maxRetries: z.number().int().nonnegative(),
  workflows: z.object({
    systemAnalysis: WorkflowReferenceSchema,
    development: WorkflowReferenceSchema
  }),
  finalVerify: z.object({
    prompt: z.string().min(1),
    template: z.string().min(1),
    requiredChecks: z.array(z.string().min(1)).min(1)
  })
})

export const SystemAnalysisWorkflowSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.literal('system-analysis'),
  prompt: z.string().min(1),
  revisionPrompt: z.string().min(1),
  designTemplate: z.string().min(1),
  taskPlanTemplate: z.string().min(1),
  requiredDesignSections: z.array(z.string().min(1)).min(1)
})

export const DevelopmentWorkflowSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.literal('development'),
  stages: z.array(z.object({
    id: TaskStageSchema.exclude(['DONE']),
    prompt: z.string().min(1),
    artifactRequired: z.boolean()
  })).length(5)
}).superRefine((workflow, context) => {
  const expectedStages = ['PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'SCOPE_CHECK']
  const actualStages = workflow.stages.map((stage) => stage.id)

  if (actualStages.join(',') !== expectedStages.join(',')) {
    context.addIssue({
      code: 'custom',
      path: ['stages'],
      message: `研发阶段必须严格按 ${expectedStages.join(' -> ')} 排列`
    })
  }
})

export const WorkflowBundleSchema = z.object({
  sdlc: SdlcWorkflowSchema,
  systemAnalysis: SystemAnalysisWorkflowSchema,
  development: DevelopmentWorkflowSchema
})

export type SdlcWorkflow = z.infer<typeof SdlcWorkflowSchema>
export type SystemAnalysisWorkflow = z.infer<typeof SystemAnalysisWorkflowSchema>
export type DevelopmentWorkflow = z.infer<typeof DevelopmentWorkflowSchema>
export type WorkflowBundle = z.infer<typeof WorkflowBundleSchema>
