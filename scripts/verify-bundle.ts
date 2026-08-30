import { access, readFile, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  bundledRuntime,
  createDemoProject,
  runBundledCli
} from './demo-fixture'

const projectRoot = await createDemoProject()

try {
  await access(bundledRuntime)
  const startOutput = runBundledCli(projectRoot, ['start'])
  if (!startOutput.includes('SYSTEM_ANALYSIS')) {
    throw new Error(`unexpected start output: ${startOutput}`)
  }

  const next = JSON.parse(runBundledCli(projectRoot, ['next'])) as {
    action?: string
    promptPath?: string
    templatePaths?: string[]
  }
  if (next.action !== 'CREATE_SYSTEM_ANALYSIS') {
    throw new Error(`unexpected next action: ${next.action}`)
  }
  if (!next.promptPath || next.templatePaths?.length !== 2) {
    throw new Error('bundled workflow assets were not resolved')
  }

  const runtimeDirectory = resolve(projectRoot, '.develop-loop')
  const audit = await readFile(resolve(runtimeDirectory, 'audit.jsonl'), 'utf8')
  const checkpoints = await readdir(resolve(runtimeDirectory, 'checkpoints'))
  if (!audit.includes('INPUT_ACCEPTED') || checkpoints.length < 3) {
    throw new Error('bundle did not create audit/checkpoint evidence')
  }
} finally {
  await rm(projectRoot, { recursive: true, force: true })
}
