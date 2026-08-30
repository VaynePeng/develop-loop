import {
  InputSnapshotStore,
  type InputSnapshotResult
} from '../runtime/input-snapshot-store'

export interface IntakeCommandOptions {
  projectRoot: string
  resourceId: string
  sourcePath: string
}

/**
 * Skill 使用的内部命令：把会话附件持久化并返回 request.yaml 可用字段。
 */
export async function executeIntakeCommand(
  options: IntakeCommandOptions
): Promise<InputSnapshotResult> {
  return new InputSnapshotStore(options.projectRoot).snapshot(
    options.resourceId,
    options.sourcePath
  )
}
