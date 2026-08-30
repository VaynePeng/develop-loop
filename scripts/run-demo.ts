import { resolve } from 'node:path'

import { createDemoProject, runBundledCli } from './demo-fixture'

const projectRoot = await createDemoProject()
const startOutput = runBundledCli(projectRoot, ['start'])
const nextOutput = runBundledCli(projectRoot, ['next'])

console.log(`Demo 项目：${projectRoot}`)
console.log(startOutput)
console.log(nextOutput)
console.log(`状态文件：${resolve(projectRoot, '.develop-loop/state.json')}`)
console.log('Demo 目录会保留，便于继续执行 analysis submit。')
