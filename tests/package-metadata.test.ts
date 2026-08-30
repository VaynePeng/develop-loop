import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DEVELOP_LOOP_VERSION } from '../src/index'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

describe('distribution metadata', () => {
  it('keeps the development package and CLI identities aligned', async () => {
    const packageJson = await readJson(resolve(projectRoot, 'package.json'))

    expect(packageJson.name).toBe('develop-loop')
    expect(packageJson.version).toBe(DEVELOP_LOOP_VERSION)
    expect(packageJson.private).toBe(true)
    expect(packageJson.bin).toEqual({
      'develop-loop': './dist/cli.js'
    })
  })

  it('distributes a matching self-contained develop-loop Skill', async () => {
    const skill = await readFile(
      resolve(projectRoot, 'skills/develop-loop/SKILL.md'),
      'utf8'
    )

    expect(skill).toMatch(/^---\nname: develop-loop\n/)
    expect(skill).toContain('$develop-loop')
    expect(skill).toContain('scripts/develop-loop.js')
    expect(skill).toContain('examples.md')

    await expect(
      access(resolve(projectRoot, 'skills/develop-loop/examples.md'))
    ).resolves.toBeUndefined()

    await expect(
      access(
        resolve(
          projectRoot,
          'skills/develop-loop/scripts/develop-loop.js'
        )
      )
    ).resolves.toBeUndefined()

    const systemAnalysisPrompt = await readFile(
      resolve(projectRoot, 'prompts/system-analysis.md'),
      'utf8'
    )
    expect(systemAnalysisPrompt).not.toContain('develop-loop analysis submit')
    expect(systemAnalysisPrompt).toContain('analysisType')
  })
})
