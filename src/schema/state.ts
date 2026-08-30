import { z } from 'zod'

/**
 * 整个 Develop Loop 当前所处的阶段。
 * engine.ts 后续会根据这个字段决定下一步做什么。
 */
/* 
| 状态 | 含义 |
|---|---|
| `NEW` | 刚创建运行记录，尚未检查输入 |
| `INPUT_GATE` | 检查 PRD、项目目录、接口文档等资料 |
| `WAITING_USER` | 缺资料，暂停等待用户 |
| `SYSTEM_ANALYSIS` | Codex 正在生成或修订系分 |
| `WAITING_DESIGN_APPROVAL` | 系分已完成，等待用户确认 |
| `DEVELOPMENT` | 按 task 执行研发循环 |
| `FINAL_VERIFY` | 所有 task 完成后的整体验证 |
| `COMPLETED` | 全部完成 |
| `FAILED` | 超过重试上限或遇到不可恢复错误 | 
*/
export const DevLoopStatusSchema = z.enum([
  'NEW',
  'INPUT_GATE',
  'WAITING_USER',
  'SYSTEM_ANALYSIS',
  'WAITING_DESIGN_APPROVAL',
  'DEVELOPMENT',
  'FINAL_VERIFY',
  'COMPLETED',
  'FAILED'
])

export const AnalysisTypeSchema = z.enum([
  'backend',
  'frontend',
  'fullstack'
])

export const InputResourceKindSchema = z.enum([
  'PRD',
  'REPOSITORY',
  'API_DOC',
  'DATABASE_SCHEMA',
  'REFERENCE'
])

export const InputResourceIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/)

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

/**
 * 用户输入的资料不一定都是普通文件，
 * 也可能是代码仓库目录或参考资料。
 */
export const InputResourceSchema = z.object({
  id: InputResourceIdSchema,

  label: z.string().min(1),

  kind: InputResourceKindSchema,

  /**
   * 缺少附件时 path 可以暂时不存在。
   * Input Gate 会把这种资源标记为 MISSING，等待用户补充。
   */
  path: z.string().min(1).optional(),

  /**
   * intake 快照生成的内容哈希。
   * Input Gate 会用它检查附件在 resume 前是否被修改。
   */
  sha256: Sha256Schema.optional(),

  required: z.boolean(),

  availability: z.enum(['UNKNOWN', 'AVAILABLE', 'MISSING'])
})

/**
 * 用户对系分的每一轮反馈都要保存，
 * 这样重新进入 SYSTEM_ANALYSIS 时不会丢失上下文。
 */
export const DesignFeedbackSchema = z.object({
  revision: z.number().int().positive(),
  content: z.string().min(1),
  createdAt: z.iso.datetime()
})

/**
 * 单个研发任务内部严格执行的五个阶段。
 */
export const TaskStageSchema = z.enum([
  'PLAN', // 任务计划阶段
  'IMPLEMENT', // 任务实现阶段
  'VERIFY', // 任务验证阶段
  'REVIEW', // 任务评审阶段
  'SCOPE_CHECK', // 任务范围检查阶段
  'DONE' // 任务完成阶段
])

export const TaskStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'PASSED',
  'FAILED'
])

/**
 * development task 的运行状态。
 *
 * attempts 按阶段记录重试次数，例如：
 * {
 *   "IMPLEMENT": 2,
 *   "VERIFY": 1
 * }
 */
export const DevelopmentTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),

  stage: TaskStageSchema,
  status: TaskStatusSchema,

  attempts: z.record(z.string(), z.number().int().nonnegative()),

  artifactPaths: z.array(z.string()),

  lastError: z.string().min(1).optional()
})

export const FinalVerificationSchema = z.object({
  reportPath: z.string().min(1).optional(),
  completedChecks: z.array(z.string().min(1)),
  lastError: z.string().min(1).optional()
})

/**
 * 最近一次错误。
 *
 * recoverable 表示这个错误能否通过 resume 或 retry 恢复。
 */
export const WorkflowErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  phase: DevLoopStatusSchema,
  recoverable: z.boolean(),
  occurredAt: z.iso.datetime()
})

/**
 * state.json 的完整结构。
 */
export const DevLoopStateSchema = z.object({
  /**
   * 状态文件格式版本。
   * 将来升级结构时，可以根据它进行数据迁移。
   */
  schemaVersion: z.literal(1),

  /**
   * 每次运行的唯一标识。
   * 审计日志、checkpoint 和最终报告都用它关联。
   */
  runId: z.uuid(),

  /**
   * 当前加载的工作流及关键配置快照。
   * 保存 maxRetries 是为了避免 resume 时 YAML 已被别人修改。
   */
  workflow: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    maxRetries: z.number().int().nonnegative()
  }),

  status: DevLoopStatusSchema,

  /**
   * 被分析和开发的业务项目路径，
   * 不是 develop-loop npm 包自身的路径。
   */
  projectRoot: z.string().min(1),

  input: z.object({
    sourceType: z.literal('prd'),

    analysisType: AnalysisTypeSchema,

    /**
     * 保存用户最初输入的自然语言请求，
     * 便于审计和问题复现。
     */
    originalRequest: z.string().min(1),

    resources: z.array(InputResourceSchema),
    missingResourceIds: z.array(z.string())
  }),

  design: z.object({
    /**
     * 0 表示尚未生成系分；
     * 第一次生成后为 1，每次修订递增。
     */
    revision: z.number().int().nonnegative(),

    artifactPath: z.string().min(1).optional(),
    taskPlanPath: z.string().min(1).optional(),

    feedback: z.array(DesignFeedbackSchema),

    /**
     * 用户确认后记录锁定时间和 SHA-256。
     * 后续可以通过 hash 检查系分是否被偷偷修改。
     */
    lockedAt: z.iso.datetime().optional(),
    lockedHash: Sha256Schema.optional()
  }),

  development: z.object({
    tasks: z.array(DevelopmentTaskSchema),

    /**
     * 当前任务在 tasks 数组中的位置。
     * 使用 index 可以确定 resume 后从哪个任务继续。
     */
    currentTaskIndex: z.number().int().nonnegative(),

    finalVerifyAttempts: z.number().int().nonnegative(),
    finalVerification: FinalVerificationSchema
  }),

  retry: z.object({
    counters: z.record(z.string(), z.number().int().nonnegative())
  }),

  lastError: WorkflowErrorSchema.optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional()
})

export type DevLoopStatus = z.infer<typeof DevLoopStatusSchema>

export type AnalysisType = z.infer<typeof AnalysisTypeSchema>

export type InputResourceKind = z.infer<typeof InputResourceKindSchema>

export type InputResource = z.infer<typeof InputResourceSchema>

export type DevelopmentTask = z.infer<typeof DevelopmentTaskSchema>

export type TaskStage = z.infer<typeof TaskStageSchema>

export type DevLoopState = z.infer<typeof DevLoopStateSchema>
