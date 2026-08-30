import { readFile } from 'node:fs/promises'

import { calculateFileSha256 } from '../runtime/input-snapshot-store'
import { resolveProjectFile } from '../runtime/project-file'

export interface ValidatedDesign {
  path: string
  sha256: string
  sections: string[]
}

export async function validateDesign(
  projectRoot: string,
  path: string,
  requiredSections: string[]
): Promise<ValidatedDesign> {
  const absolutePath = await resolveProjectFile(projectRoot, path)
  const content = await readFile(absolutePath, 'utf8')
  const sections = [...content.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)]
    .map((match) => match[1]!.trim())
  const missingSections = requiredSections.filter(
    (required) => !sections.includes(required)
  )

  if (missingSections.length > 0) {
    throw new Error(`系分缺少必填章节：${missingSections.join('、')}`)
  }

  return {
    path: absolutePath,
    sha256: await calculateFileSha256(absolutePath),
    sections
  }
}
