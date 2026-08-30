import { StateStore } from '../runtime/state-store'
import type { DevLoopState } from '../schema/state'

export async function executeStatusCommand(
  projectRoot: string
): Promise<DevLoopState> {
  return new StateStore(projectRoot).read()
}
