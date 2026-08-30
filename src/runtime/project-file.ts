import { stat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

export class ProjectFileError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'ProjectFileError'
  }
}

export async function resolveProjectFile(
  projectRoot: string,
  path: string
): Promise<string> {
  const absoluteRoot = resolve(projectRoot)
  const absolutePath = resolve(absoluteRoot, path)
  const relativePath = relative(absoluteRoot, absolutePath)

  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\')
  ) {
    throw new ProjectFileError(`文件必须位于目标仓库内：${path}`)
  }

  try {
    if (!(await stat(absolutePath)).isFile()) {
      throw new ProjectFileError(`目标不是普通文件：${absolutePath}`)
    }
  } catch (error) {
    if (error instanceof ProjectFileError) throw error
    throw new ProjectFileError(`无法读取文件：${absolutePath}`, error)
  }

  return absolutePath
}
