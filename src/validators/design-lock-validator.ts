import { calculateFileSha256 } from '../runtime/input-snapshot-store'
import { resolveProjectFile } from '../runtime/project-file'
import type { DevLoopState } from '../schema/state'

export async function assertDesignLockIntact(state: DevLoopState): Promise<void> {
  if (!state.design.artifactPath || !state.design.lockedHash) {
    throw new Error('系分尚未锁定')
  }

  const path = await resolveProjectFile(state.projectRoot, state.design.artifactPath)
  const actualHash = await calculateFileSha256(path)

  if (actualHash !== state.design.lockedHash) {
    throw new Error('锁定后的系分文件已被修改，请停止研发并重新确认设计')
  }
}
