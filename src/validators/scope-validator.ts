import type { ScopeReport, TaskPlanTask } from '../schema/task-plan'

function normalize(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function matchesPrefix(path: string, prefix: string): boolean {
  const normalizedPath = normalize(path)
  const normalizedPrefix = normalize(prefix)

  return normalizedPrefix === '.' ||
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
}

export function validateTaskScope(
  task: TaskPlanTask,
  report: ScopeReport
): void {
  const violations = report.changedPaths.filter((path) => {
    const allowed = task.allowedPaths.some((prefix) => matchesPrefix(path, prefix))
    const forbidden = task.forbiddenPaths.some((prefix) => matchesPrefix(path, prefix))

    return !allowed || forbidden
  })

  if (violations.length > 0) {
    throw new Error(`任务 ${task.id} 存在越界改动：${violations.join('、')}`)
  }
}
