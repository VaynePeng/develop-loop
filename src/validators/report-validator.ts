import { readFile } from 'node:fs/promises'

import { parse } from 'yaml'

import {
  FinalVerifyReportSchema,
  ReviewReportSchema,
  ScopeReportSchema,
  VerifyReportSchema,
  type FinalVerifyReport,
  type ReviewReport,
  type ScopeReport,
  type VerifyReport
} from '../schema/task-plan'
import { resolveProjectFile } from '../runtime/project-file'

async function readReport(projectRoot: string, path: string): Promise<unknown> {
  const absolutePath = await resolveProjectFile(projectRoot, path)
  return parse(await readFile(absolutePath, 'utf8'))
}

export async function validateVerifyReport(
  projectRoot: string,
  path: string
): Promise<VerifyReport> {
  return VerifyReportSchema.parse(await readReport(projectRoot, path))
}

export async function validateReviewReport(
  projectRoot: string,
  path: string
): Promise<ReviewReport> {
  return ReviewReportSchema.parse(await readReport(projectRoot, path))
}

export async function validateScopeReport(
  projectRoot: string,
  path: string
): Promise<ScopeReport> {
  return ScopeReportSchema.parse(await readReport(projectRoot, path))
}

export async function validateFinalVerifyReport(
  projectRoot: string,
  path: string,
  requiredChecks: string[]
): Promise<FinalVerifyReport> {
  const report = FinalVerifyReportSchema.parse(
    await readReport(projectRoot, path)
  )
  const completedChecks = new Set(report.checks.map((check) => check.id))
  const missingChecks = requiredChecks.filter(
    (check) => !completedChecks.has(check)
  )

  if (missingChecks.length > 0) {
    throw new Error(`最终验证缺少检查项：${missingChecks.join('、')}`)
  }

  return report
}
