import { describe, expect, it } from 'vitest'

import { formatStateResult } from '../../src/commands/command-result'
import { createInitialState } from '../../src/runtime/state-factory'

describe('formatStateResult', () => {
  it('把缺资料状态收成 agent 可解析的 JSON 字段', () => {
    const state = createInitialState({
      projectRoot: '/tmp/develop-loop-result',
      originalRequest: '根据 PRD 做后端系分',
      analysisType: 'backend',
      resources: [
        {
          id: 'repository',
          label: '当前仓库',
          kind: 'REPOSITORY',
          path: '.'
        },
        {
          id: 'prd',
          label: '退款 PRD',
          kind: 'PRD',
          required: true
        }
      ]
    })

    const result = formatStateResult({
      ...state,
      status: 'WAITING_USER',
      input: {
        ...state.input,
        missingResourceIds: ['prd']
      }
    })

    expect(result.status).toBe('WAITING_USER')
    expect(result.analysisType).toBe('backend')
    expect(result.missingResources).toEqual([
      {
        id: 'prd',
        label: '退款 PRD',
        kind: 'PRD'
      }
    ])
  })

  it('把绝对产物路径收成仓库相对路径，并带上当前任务', () => {
    const state = createInitialState({
      projectRoot: '/tmp/develop-loop-result',
      originalRequest: '根据 PRD 做后端系分',
      analysisType: 'backend',
      resources: [
        {
          id: 'repository',
          kind: 'REPOSITORY',
          path: '.'
        }
      ]
    })

    const result = formatStateResult({
      ...state,
      status: 'DEVELOPMENT',
      design: {
        ...state.design,
        revision: 1,
        artifactPath: `${state.projectRoot}/.develop-loop/design/design.md`,
        taskPlanPath: `${state.projectRoot}/.develop-loop/design/task-plan.yaml`,
        lockedHash: 'a'.repeat(64)
      },
      development: {
        ...state.development,
        currentTaskIndex: 0,
        tasks: [
          {
            id: 'refund-service',
            title: '实现退款服务',
            stage: 'VERIFY',
            status: 'RUNNING',
            attempts: {},
            artifactPaths: []
          }
        ]
      }
    })

    expect(result.designPath).toBe('.develop-loop/design/design.md')
    expect(result.taskPlanPath).toBe('.develop-loop/design/task-plan.yaml')
    expect(result.lockedHash).toBe('a'.repeat(64))
    expect(result.currentTask).toEqual({
      id: 'refund-service',
      title: '实现退款服务',
      stage: 'VERIFY',
      status: 'RUNNING',
      index: 0,
      taskCount: 1
    })
  })
})
