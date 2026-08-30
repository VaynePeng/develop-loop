import { z } from 'zod'

import {
  AnalysisTypeSchema,
  InputResourceIdSchema,
  InputResourceKindSchema,
  Sha256Schema
} from './state'

/**
 * Codex Skill 从自然语言和附件中整理出的单个输入资源。
 * path 缺失表示用户尚未提供对应文件，后续由 Input Gate 暂停等待。
 */
export const RunRequestResourceSchema = z.object({
  id: InputResourceIdSchema,
  label: z.string().min(1),
  kind: InputResourceKindSchema,
  path: z.string().min(1).optional(),
  sha256: Sha256Schema.optional(),
  required: z.boolean().default(true)
})

/**
 * .develop-loop/request.yaml 的机器协议。
 * Skill 负责生成它，CLI 只负责校验和执行，不再理解自然语言。
 */
export const RunRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceType: z.literal('prd'),
    analysisType: AnalysisTypeSchema,
    originalRequest: z.string().min(1),
    resources: z.array(RunRequestResourceSchema).min(1)
  })
  .superRefine((request, context) => {
    const seenResourceIds = new Set<string>()

    request.resources.forEach((resource, index) => {
      if (seenResourceIds.has(resource.id)) {
        context.addIssue({
          code: 'custom',
          path: ['resources', index, 'id'],
          message: `资源 id 重复：${resource.id}`
        })
      }

      seenResourceIds.add(resource.id)
    })
  })

export type RunRequestResource = z.infer<typeof RunRequestResourceSchema>

export type RunRequest = z.infer<typeof RunRequestSchema>
