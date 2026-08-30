export const DEVELOP_LOOP_VERSION = '0.1.0'

export {
  AnalysisTypeSchema,
  DesignFeedbackSchema,
  DevelopmentTaskSchema,
  FinalVerificationSchema,
  DevLoopStateSchema,
  DevLoopStatusSchema,
  InputResourceIdSchema,
  InputResourceKindSchema,
  InputResourceSchema,
  Sha256Schema,
  TaskStageSchema,
  TaskStatusSchema,
  WorkflowErrorSchema
} from './schema/state'

export type {
  AnalysisType,
  DevelopmentTask,
  DevLoopState,
  DevLoopStatus,
  InputResource,
  InputResourceKind,
  TaskStage
} from './schema/state'

export * from './schema/task-plan'
export * from './schema/workflow'

export {
  RunRequestResourceSchema,
  RunRequestSchema
} from './schema/run-request'

export type {
  RunRequest,
  RunRequestResource
} from './schema/run-request'

export {
  DEVELOP_LOOP_DIRECTORY,
  STATE_FILE_NAME,
  StateStore,
  StateStoreError
} from './runtime/state-store'

export {
  INPUTS_DIRECTORY_NAME,
  InputSnapshotStore,
  InputSnapshotStoreError,
  calculateFileSha256
} from './runtime/input-snapshot-store'

export type {
  InputSnapshotResult
} from './runtime/input-snapshot-store'

export {
  REQUEST_FILE_NAME,
  RunRequestStore,
  RunRequestStoreError
} from './runtime/request-store'

export {
  DEFAULT_WORKFLOW,
  createInitialState,
  normalizeInputResources
} from './runtime/state-factory'

export type {
  CreateInitialStateOptions,
  InitialInputResource
} from './runtime/state-factory'

export {
  InputGateError,
  resumeInputGate,
  runInputGate
} from './gates/input-gate'

export {
  formatStateResult
} from './commands/command-result'

export type {
  StateCommandResult
} from './commands/command-result'

export { executeStartCommand } from './commands/start-command'

export type { StartCommandOptions } from './commands/start-command'

export { executeIntakeCommand } from './commands/intake-command'

export type { IntakeCommandOptions } from './commands/intake-command'

export {
  executeResumeCommand,
  ResumeCommandError
} from './commands/resume-command'

export type { ResumeCommandOptions } from './commands/resume-command'

export * from './runtime/audit-log'
export * from './runtime/checkpoint-store'
export * from './runtime/project-file'
export * from './runtime/task-plan-store'
export * from './runtime/transition'
export * from './runtime/workflow-loader'

export * from './commands/analysis-command'
export * from './commands/design-command'
export * from './commands/final-verify-command'
export * from './commands/next-command'
export * from './commands/status-command'
export * from './commands/task-command'

export * from './validators/design-lock-validator'
export * from './validators/design-validator'
export * from './validators/report-validator'
export * from './validators/scope-validator'
