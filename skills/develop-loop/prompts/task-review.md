# Task REVIEW 阶段

审查当前任务的 diff，重点检查正确性、回归、错误处理、数据一致性、安全和测试缺口。存在阻断问题时先修复并重新 VERIFY，不能提交伪造的通过报告。

无阻断问题后生成符合 `review-report.yaml` 的报告，保存到 `.develop-loop/tasks/<task-id>/`，并用自包含运行时的 `task pass --artifact <报告>` 提交。
