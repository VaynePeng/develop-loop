import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import { stringify } from 'yaml'

export const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..'
)
export const bundledRuntime = resolve(
  packageRoot,
  'skills/develop-loop/scripts/develop-loop.js'
)

export async function createDemoProject(): Promise<string> {
  const projectRoot = await mkdtemp(joinTempPrefix('develop-loop-demo-'))
  const runtimeDirectory = resolve(projectRoot, '.develop-loop')

  await mkdir(runtimeDirectory, { recursive: true })
  await writeFile(
    resolve(projectRoot, 'refund-prd.md'),
    '# 退款需求\n\n订单支付成功后允许用户申请一次退款。\n',
    'utf8'
  )
  await writeFile(
    resolve(runtimeDirectory, 'request.yaml'),
    stringify({
      schemaVersion: 1,
      sourceType: 'prd',
      analysisType: 'backend',
      originalRequest: '根据退款 PRD 生成后端系分并进入研发 Loop',
      resources: [
        {
          id: 'repository',
          label: 'Demo 仓库',
          kind: 'REPOSITORY',
          path: '.',
          required: true
        },
        {
          id: 'prd',
          label: '退款 PRD',
          kind: 'PRD',
          path: 'refund-prd.md',
          required: true
        }
      ]
    }),
    'utf8'
  )

  return projectRoot
}

function joinTempPrefix(name: string): string {
  return resolve(tmpdir(), name)
}

export function runBundledCli(
  projectRoot: string,
  args: string[]
): string {
  const result = spawnSync(process.execPath, [bundledRuntime, ...args], {
    cwd: projectRoot,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(
      `bundled runtime failed: ${result.stderr || result.stdout}`
    )
  }

  return result.stdout.trim()
}
