#!/usr/bin/env node

import { Command } from 'commander'

import { executeIntakeCommand } from './commands/intake-command'
import { executeResumeCommand } from './commands/resume-command'
import { executeStartCommand } from './commands/start-command'
import { executeSubmitAnalysis } from './commands/analysis-command'
import {
  executeApproveDesign,
  executeSubmitDesignFeedback
} from './commands/design-command'
import {
  executeFailFinalVerify,
  executePassFinalVerify
} from './commands/final-verify-command'
import { executeNextCommand } from './commands/next-command'
import { executeStatusCommand } from './commands/status-command'
import {
  executeFailTaskStage,
  executePassTaskStage
} from './commands/task-command'
import { formatStateResult } from './commands/command-result'
import { DEVELOP_LOOP_VERSION } from './index'
import type { DevLoopState } from './schema/state'

function printStateResult(state: DevLoopState): void {
  console.log(JSON.stringify(formatStateResult(state), null, 2))
}

const program = new Command()

program
  .name('develop-loop')
  .description('面向系分与可验证研发的 Codex 软件开发生命周期循环编排器')
  .version(DEVELOP_LOOP_VERSION)
  .action(() => {
    program.outputHelp()
  })

program
  .command('intake')
  .description('内部命令：把附件保存到 .develop-loop/inputs')
  .argument('<resource-id>', 'request.yaml 中的资源 id')
  .argument('<source-path>', 'Codex 可访问的附件路径')
  .action(async (resourceId: string, sourcePath: string) => {
    const result = await executeIntakeCommand({
      projectRoot: process.cwd(),
      resourceId,
      sourcePath
    })

    console.log(JSON.stringify({
      resourceId: result.resourceId,
      path: result.requestPath,
      sha256: result.sha256
    }, null, 2))
  })

program
  .command('start')
  .description('读取 .develop-loop/request.yaml 并启动系分研发循环')
  .action(async () => {
    const state = await executeStartCommand({
      projectRoot: process.cwd()
    })

    printStateResult(state)
  })

program
  .command('resume')
  .description('从 state.json 恢复系分研发循环；缺输入时会重新执行输入门禁')
  .action(async () => {
    const state = await executeResumeCommand({
      projectRoot: process.cwd()
    })

    printStateResult(state)
  })

program
  .command('status')
  .description('读取并输出当前运行状态')
  .option('--json', '输出完整 JSON 状态')
  .action(async (options: { json?: boolean }) => {
    const state = await executeStatusCommand(process.cwd())
    if (options.json) console.log(JSON.stringify(state, null, 2))
    else printStateResult(state)
  })

program
  .command('next')
  .description('根据当前状态输出 Codex 唯一允许执行的下一步')
  .action(async () => {
    console.log(JSON.stringify(await executeNextCommand(process.cwd()), null, 2))
  })

const analysis = program
  .command('analysis')
  .description('提交和校验系统分析产物')

analysis
  .command('submit')
  .requiredOption('--design <path>', '仓库内的系分 Markdown 文件')
  .requiredOption('--tasks <path>', '仓库内的任务计划 YAML 文件')
  .action(async (options: { design: string; tasks: string }) => {
    printStateResult(await executeSubmitAnalysis({
      projectRoot: process.cwd(),
      designPath: options.design,
      taskPlanPath: options.tasks
    }))
  })

const design = program
  .command('design')
  .description('处理用户对系分的反馈和确认')

design
  .command('feedback')
  .option('--message <feedback>', '用户反馈原文')
  .option('--file <path>', '包含用户反馈原文的仓库内文件')
  .action(async (options: { message?: string; file?: string }) => {
    printStateResult(await executeSubmitDesignFeedback({
      projectRoot: process.cwd(),
      feedback: options.message,
      feedbackFile: options.file
    }))
  })

design
  .command('approve')
  .description('仅在用户明确确认后锁定系分并进入研发')
  .action(async () => {
    printStateResult(await executeApproveDesign(process.cwd()))
  })

const task = program
  .command('task')
  .description('驱动当前研发任务的五阶段循环')

task
  .command('pass')
  .requiredOption('--artifact <path>', '当前阶段的仓库内产物或验证报告')
  .action(async (options: { artifact: string }) => {
    printStateResult(await executePassTaskStage({
      projectRoot: process.cwd(),
      artifactPath: options.artifact
    }))
  })

task
  .command('fail')
  .requiredOption('--error <message>', '当前阶段失败原因')
  .action(async (options: { error: string }) => {
    printStateResult(
      await executeFailTaskStage(process.cwd(), options.error)
    )
  })

const finalVerify = program
  .command('final')
  .description('记录整体验证结果')

finalVerify
  .command('pass')
  .requiredOption('--report <path>', '最终验证报告 YAML')
  .action(async (options: { report: string }) => {
    printStateResult(
      await executePassFinalVerify(process.cwd(), options.report)
    )
  })

finalVerify
  .command('fail')
  .requiredOption('--error <message>', '最终验证失败原因')
  .action(async (options: { error: string }) => {
    printStateResult(
      await executeFailFinalVerify(process.cwd(), options.error)
    )
  })

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : String(error)

  console.error(`develop-loop 执行失败：${message}`)
  process.exitCode = 1
})
