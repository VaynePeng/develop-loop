import { runInputGate } from '../gates/input-gate'
import { RunRequestStore } from '../runtime/request-store'
import { createInitialState } from '../runtime/state-factory'
import { StateStore } from '../runtime/state-store'
import { recordInitialState } from '../runtime/transition'
import { WorkflowLoader } from '../runtime/workflow-loader'
import type { DevLoopState } from '../schema/state'

export interface StartCommandOptions {
  projectRoot: string
}

export async function executeStartCommand(
  options: StartCommandOptions
): Promise<DevLoopState> {
  const store = new StateStore(options.projectRoot)
  const requestStore = new RunRequestStore(options.projectRoot)
  const request = await requestStore.read()
  const workflow = await new WorkflowLoader().load()

  const initialState = createInitialState({
    projectRoot: options.projectRoot,
    originalRequest: request.originalRequest,
    analysisType: request.analysisType,
    resources: request.resources,
    workflow: {
      name: workflow.sdlc.name,
      version: workflow.sdlc.version,
      maxRetries: workflow.sdlc.maxRetries
    }
  })

  const created = await store.create(initialState)
  await recordInitialState(store, created)

  return runInputGate(store)
}
