import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

import {
  DevLoopStateSchema,
  type AnalysisType,
  type DevLoopState,
  type InputResource
} from '../schema/state'

export interface InitialInputResource {
  id: string
  label?: string
  kind: InputResource['kind']
  path?: string
  sha256?: string
  required?: boolean
}

export interface CreateInitialStateOptions {
  projectRoot: string
  originalRequest: string
  analysisType: AnalysisType
  resources: InitialInputResource[]
  workflow?: {
    name: string
    version: string
    maxRetries: number
  }
}

export const DEFAULT_WORKFLOW = {
  name: 'develop-loop',
  version: '1.0',
  maxRetries: 3
} as const

export function normalizeInputResources(
  projectRoot: string,
  resources: InitialInputResource[]
): InputResource[] {
  const absoluteProjectRoot = resolve(projectRoot)

  return resources.map((resource) => ({
    id: resource.id,
    label: resource.label ?? resource.id,
    kind: resource.kind,
    path: resource.path
      ? resolve(absoluteProjectRoot, resource.path)
      : undefined,
    sha256: resource.sha256,
    required: resource.required ?? true,
    availability: 'UNKNOWN'
  }))
}

export function createInitialState(
  options: CreateInitialStateOptions
): DevLoopState {
  const now = new Date().toISOString()
  const projectRoot = resolve(options.projectRoot)
  const resources = normalizeInputResources(projectRoot, options.resources)

  const state: DevLoopState = {
    schemaVersion: 1,
    runId: randomUUID(),
    workflow: options.workflow ?? DEFAULT_WORKFLOW,
    status: 'NEW',
    projectRoot,
    input: {
      sourceType: 'prd',
      analysisType: options.analysisType,
      originalRequest: options.originalRequest,
      resources,
      /**
       * 尚未执行 Input Gate，所以暂时不知道缺什么。
       */
      missingResourceIds: []
    },
    design: {
      revision: 0,
      feedback: []
    },
    development: {
      tasks: [],
      currentTaskIndex: 0,
      finalVerifyAttempts: 0,
      finalVerification: {
        completedChecks: []
      }
    },
    retry: {
      counters: {}
    },
    createdAt: now,
    updatedAt: now
  }

  /**
   * Factory 返回前再次经过 Zod。
   * 如果初始状态结构和 Schema 不一致，
   * 会在这里立即暴露，而不是写入磁盘后才发现。
   */
  return DevLoopStateSchema.parse(state)
}
