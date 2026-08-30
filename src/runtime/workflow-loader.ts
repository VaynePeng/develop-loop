import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from 'yaml'

import {
  DevelopmentWorkflowSchema,
  SdlcWorkflowSchema,
  SystemAnalysisWorkflowSchema,
  WorkflowBundleSchema,
  type WorkflowBundle
} from '../schema/workflow'

export class WorkflowLoaderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'WorkflowLoaderError'
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readYaml(path: string): Promise<unknown> {
  try {
    return parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new WorkflowLoaderError(`无法读取工作流：${path}`, error)
  }
}

/**
 * 同时支持三种运行位置：src、dist，以及 Skill 内的单文件 bundle。
 */
export async function findAssetRoot(): Promise<string> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(moduleDirectory, '../..'),
    resolve(moduleDirectory, '..')
  ]

  for (const candidate of candidates) {
    if (await exists(resolve(candidate, 'workflows/sdlc.yaml'))) {
      return candidate
    }
  }

  throw new WorkflowLoaderError(
    `找不到 workflows/sdlc.yaml，已检查：${candidates.join(', ')}`
  )
}

export class WorkflowLoader {
  private bundle?: WorkflowBundle
  private assetRoot?: string

  async load(): Promise<WorkflowBundle> {
    if (this.bundle) return this.bundle

    const assetRoot = await findAssetRoot()
    const workflowRoot = resolve(assetRoot, 'workflows')
    const sdlc = SdlcWorkflowSchema.parse(
      await readYaml(resolve(workflowRoot, 'sdlc.yaml'))
    )
    const systemAnalysis = SystemAnalysisWorkflowSchema.parse(
      await readYaml(resolve(workflowRoot, sdlc.workflows.systemAnalysis.file))
    )
    const development = DevelopmentWorkflowSchema.parse(
      await readYaml(resolve(workflowRoot, sdlc.workflows.development.file))
    )

    this.assetRoot = assetRoot
    this.bundle = WorkflowBundleSchema.parse({
      sdlc,
      systemAnalysis,
      development
    })

    return this.bundle
  }

  async resolveAsset(relativePath: string): Promise<string> {
    if (!this.assetRoot) await this.load()

    const path = resolve(this.assetRoot!, relativePath)
    const relative = path.slice(this.assetRoot!.length)

    if (!relative.startsWith('/') || relative.includes('/../')) {
      throw new WorkflowLoaderError(`非法资源路径：${relativePath}`)
    }

    if (!(await exists(path))) {
      throw new WorkflowLoaderError(`工作流资源不存在：${path}`)
    }

    return path
  }
}
