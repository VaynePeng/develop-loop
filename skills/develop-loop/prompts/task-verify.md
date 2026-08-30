# Task VERIFY 阶段

执行任务计划中的全部 verifyCommands，并按验收标准检查行为。不得把未运行的命令记录为成功；任一必要命令失败时调用自包含运行时的 `task fail --error <原因>`，修复后在同一阶段重试。

全部通过后生成符合 `verify-report.yaml` 的报告，保存到 `.develop-loop/tasks/<task-id>/`，并用 `task pass --artifact <报告>` 提交。
