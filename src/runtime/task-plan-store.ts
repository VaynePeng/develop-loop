import { readFile } from 'node:fs/promises'

import { parse } from 'yaml'

import { TaskPlanSchema, type TaskPlan } from '../schema/task-plan'
import { resolveProjectFile } from './project-file'

export class TaskPlanStore {
  constructor(private readonly projectRoot: string) {}

  async read(path: string): Promise<TaskPlan> {
    const absolutePath = await resolveProjectFile(this.projectRoot, path)
    const content = await readFile(absolutePath, 'utf8')

    try {
      return TaskPlanSchema.parse(parse(content))
    } catch (error) {
      throw new Error(`任务计划不合法：${absolutePath}`, { cause: error })
    }
  }
}
