import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillRoot = resolve(projectRoot, 'skills/develop-loop')
const assetDirectories = ['workflows', 'prompts', 'templates'] as const

await mkdir(skillRoot, { recursive: true })

for (const directory of assetDirectories) {
  const source = resolve(projectRoot, directory)
  const target = resolve(skillRoot, directory)

  await rm(target, { recursive: true, force: true })
  await cp(source, target, { recursive: true })
}
