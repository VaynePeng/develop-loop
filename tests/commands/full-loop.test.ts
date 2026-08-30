import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { stringify } from 'yaml'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { executeSubmitAnalysis } from '../../src/commands/analysis-command'
import {
  executeApproveDesign,
  executeSubmitDesignFeedback
} from '../../src/commands/design-command'
import { executePassFinalVerify } from '../../src/commands/final-verify-command'
import { executeNextCommand } from '../../src/commands/next-command'
import { executeResumeCommand } from '../../src/commands/resume-command'
import { executeStartCommand } from '../../src/commands/start-command'
import {
  executeFailTaskStage,
  executePassTaskStage
} from '../../src/commands/task-command'
import { AUDIT_FILE_NAME } from '../../src/runtime/audit-log'
import { CHECKPOINTS_DIRECTORY_NAME } from '../../src/runtime/checkpoint-store'
import { REQUEST_FILE_NAME } from '../../src/runtime/request-store'
import { DEVELOP_LOOP_DIRECTORY } from '../../src/runtime/state-store'

const DESIGN = `# 退款能力系分

## 需求概述
退款需求。
## 现状分析
现有服务缺少退款入口。
## 目标架构
新增退款服务。
## 数据模型
新增退款记录。
## 接口设计
新增退款 API。
## 兼容性与迁移
保持旧接口兼容。
## 安全与风险
校验订单权限和幂等键。
## 测试策略
覆盖单元和集成测试。
## 研发任务拆分
实现退款服务。
`

describe('完整系分和研发 Loop', () => {
  let projectRoot = ''
  let runtimeDirectory = ''
  let artifactsDirectory = ''

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'develop-loop-full-'))
    runtimeDirectory = join(projectRoot, DEVELOP_LOOP_DIRECTORY)
    artifactsDirectory = join(runtimeDirectory, 'artifacts')

    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(artifactsDirectory, { recursive: true })
    await writeFile(join(projectRoot, 'prd.md'), '# 退款需求\n', 'utf8')
    await writeFile(
      join(runtimeDirectory, REQUEST_FILE_NAME),
      stringify({
        schemaVersion: 1,
        sourceType: 'prd',
        analysisType: 'backend',
        originalRequest: '根据 PRD 完成后端系分并研发',
        resources: [
          {
            id: 'repository',
            label: '当前仓库',
            kind: 'REPOSITORY',
            path: '.',
            required: true
          },
          {
            id: 'prd',
            label: '退款 PRD',
            kind: 'PRD',
            path: 'prd.md',
            required: true
          }
        ]
      }),
      'utf8'
    )
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  async function submitDesign(): Promise<void> {
    await writeFile(join(runtimeDirectory, 'design.md'), DESIGN, 'utf8')
    await writeFile(
      join(runtimeDirectory, 'task-plan.yaml'),
      stringify({
        schemaVersion: 1,
        tasks: [
          {
            id: 'refund-service',
            title: '实现退款服务',
            objective: '交付可验证的退款服务',
            dependsOn: [],
            allowedPaths: ['src'],
            forbiddenPaths: ['src/unrelated'],
            acceptanceCriteria: ['退款请求可成功创建'],
            verifyCommands: ['pnpm test']
          }
        ]
      }),
      'utf8'
    )

    await executeSubmitAnalysis({
      projectRoot,
      designPath: '.develop-loop/design.md',
      taskPlanPath: '.develop-loop/task-plan.yaml'
    })
  }

  async function prepareApprovedRun(): Promise<void> {
    expect((await executeStartCommand({ projectRoot })).status)
      .toBe('SYSTEM_ANALYSIS')
    await submitDesign()
    expect((await executeApproveDesign(projectRoot)).status).toBe('DEVELOPMENT')
  }

  it('经过修订确认、五阶段 task 和 final verify 后完成', async () => {
    expect((await executeStartCommand({ projectRoot })).status)
      .toBe('SYSTEM_ANALYSIS')
    expect((await executeNextCommand(projectRoot)).action)
      .toBe('CREATE_SYSTEM_ANALYSIS')

    await submitDesign()
    const waiting = await executeNextCommand(projectRoot)
    expect(waiting.action).toBe('ASK_USER_TO_APPROVE_OR_REVISE_DESIGN')

    const revising = await executeSubmitDesignFeedback({
      projectRoot,
      feedback: '补充重复退款的幂等策略'
    })
    expect(revising.status).toBe('SYSTEM_ANALYSIS')
    expect((await executeNextCommand(projectRoot)).action)
      .toBe('REVISE_SYSTEM_ANALYSIS')

    await writeFile(
      join(runtimeDirectory, 'design.md'),
      `${DESIGN}\n补充：退款请求使用订单号作为幂等键。\n`,
      'utf8'
    )
    const submittedAgain = await executeSubmitAnalysis({
      projectRoot,
      designPath: '.develop-loop/design.md',
      taskPlanPath: '.develop-loop/task-plan.yaml'
    })
    expect(submittedAgain.design.revision).toBe(2)

    const approved = await executeApproveDesign(projectRoot)
    expect(approved.status).toBe('DEVELOPMENT')
    expect(approved.design.lockedHash).toMatch(/^[a-f0-9]{64}$/)
    expect(approved.development.tasks[0]?.stage).toBe('PLAN')

    const artifactPaths = {
      PLAN: join(artifactsDirectory, 'plan.md'),
      IMPLEMENT: join(artifactsDirectory, 'implementation.md'),
      VERIFY: join(artifactsDirectory, 'verify.yaml'),
      REVIEW: join(artifactsDirectory, 'review.yaml'),
      SCOPE_CHECK: join(artifactsDirectory, 'scope.yaml')
    }
    await writeFile(artifactPaths.PLAN, '# 实施计划\n', 'utf8')
    await writeFile(artifactPaths.IMPLEMENT, '# 实施结果\n', 'utf8')
    await writeFile(artifactPaths.VERIFY, stringify({
      schemaVersion: 1,
      result: 'passed',
      commands: [{ command: 'pnpm test', exitCode: 0, summary: '测试通过' }]
    }), 'utf8')
    await writeFile(artifactPaths.REVIEW, stringify({
      schemaVersion: 1,
      result: 'passed',
      blockers: [],
      observations: []
    }), 'utf8')
    await writeFile(artifactPaths.SCOPE_CHECK, stringify({
      schemaVersion: 1,
      result: 'passed',
      changedPaths: ['src/refund-service.ts'],
      summary: '改动位于允许范围'
    }), 'utf8')

    for (const stage of ['PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'SCOPE_CHECK'] as const) {
      const result = await executePassTaskStage({
        projectRoot,
        artifactPath: artifactPaths[stage]
      })

      if (stage !== 'SCOPE_CHECK') {
        expect(result.status).toBe('DEVELOPMENT')
      }
    }

    expect((await executeNextCommand(projectRoot)).status).toBe('FINAL_VERIFY')

    const finalReport = join(artifactsDirectory, 'final.yaml')
    await writeFile(finalReport, stringify({
      schemaVersion: 1,
      result: 'passed',
      checks: [
        'task-completion',
        'test-suite',
        'typecheck',
        'scope-integrity',
        'design-lock'
      ].map((id) => ({ id, passed: true, evidence: `${id} 已验证` })),
      summary: '整体验证通过'
    }), 'utf8')

    const completed = await executePassFinalVerify(projectRoot, finalReport)
    expect(completed.status).toBe('COMPLETED')
    expect(completed.completedAt).toBeDefined()
    expect((await executeResumeCommand({ projectRoot })).status).toBe('COMPLETED')

    const auditLines = (await readFile(
      join(runtimeDirectory, AUDIT_FILE_NAME),
      'utf8'
    )).trim().split('\n')
    expect(auditLines.length).toBeGreaterThan(10)
    expect(auditLines.map((line) => JSON.parse(line).event))
      .toContain('WORKFLOW_COMPLETED')
    expect((await readdir(join(runtimeDirectory, CHECKPOINTS_DIRECTORY_NAME))).length)
      .toBe(auditLines.length)
  })

  it('超过 task 阶段最大重试次数后进入 FAILED', async () => {
    await prepareApprovedRun()

    for (let index = 0; index < 3; index += 1) {
      const retrying = await executeFailTaskStage(projectRoot, `失败 ${index + 1}`)
      expect(retrying.status).toBe('DEVELOPMENT')
    }

    const failed = await executeFailTaskStage(projectRoot, '第四次失败')
    expect(failed.status).toBe('FAILED')
    expect(failed.development.tasks[0]?.attempts.PLAN).toBe(4)
    expect(failed.lastError?.recoverable).toBe(false)
  })
})
