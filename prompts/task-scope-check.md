# Task SCOPE_CHECK 阶段

读取版本控制中的实际变更路径，排除 `.develop-loop/` 运行产物，然后与当前任务的 allowedPaths 和 forbiddenPaths 比较。

越界时调用自包含运行时的 `task fail --error <原因>` 并清理或拆分越界修改。通过后生成符合 `scope-report.yaml` 的报告，保存到 `.develop-loop/tasks/<task-id>/`，并用 `task pass --artifact <报告>` 提交。
