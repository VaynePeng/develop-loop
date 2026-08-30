import { relative, sep } from 'node:path'

import type { DevLoopState } from '../schema/state'

function toRepoPath(
  projectRoot: string,
  path?: string
): string | undefined {
  if (!path) return undefined

  const value = relative(projectRoot, path).split(sep).join('/')

  if (!value || value === '..' || value.startsWith('../')) return path

  return value
}

export interface StateCommandResult {
  status: DevLoopState['status']
  runId: string
  analysisType: DevLoopState['input']['analysisType']
  revision: number
  designPath?: string
  taskPlanPath?: string
  lockedHash?: string
  currentTask?: {
    id: string
    title: string
    stage: string
    status: string
    index: number
    taskCount: number
  }
  missingResources: Array<{
    id: string
    label: string
    kind: string
    path?: string
  }>
  lastError?: DevLoopState['lastError']
  completedAt?: string
  finalReportPath?: string
}

export function formatStateResult(state: DevLoopState): StateCommandResult {
  const task = state.development.tasks[state.development.currentTaskIndex]

  return {
    status: state.status,
    runId: state.runId,
    analysisType: state.input.analysisType,
    revision: state.design.revision,
    designPath: toRepoPath(state.projectRoot, state.design.artifactPath),
    taskPlanPath: toRepoPath(state.projectRoot, state.design.taskPlanPath),
    lockedHash: state.design.lockedHash,
    currentTask: task && state.status === 'DEVELOPMENT'
      ? {
          id: task.id,
          title: task.title,
          stage: task.stage,
          status: task.status,
          index: state.development.currentTaskIndex,
          taskCount: state.development.tasks.length
        }
      : undefined,
    missingResources: state.input.resources
      .filter((resource) =>
        state.input.missingResourceIds.includes(resource.id)
      )
      .map((resource) => ({
        id: resource.id,
        label: resource.label,
        kind: resource.kind,
        ...(resource.path
          ? { path: toRepoPath(state.projectRoot, resource.path) }
          : {})
      })),
    lastError: state.lastError,
    completedAt: state.completedAt,
    finalReportPath: toRepoPath(
      state.projectRoot,
      state.development.finalVerification.reportPath
    )
  }
}
