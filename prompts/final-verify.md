# 最终整体验证

所有任务完成后，验证任务完整性、完整测试套件、类型检查、整体范围和锁定系分哈希。需要真实执行项目适用的命令，并检查任务间集成结果。

任一检查失败时调用自包含运行时的 `final fail --error <原因>`，修复并重新验证。全部通过后生成 `final-verify-report.yaml`，保存到 `.develop-loop/final/`，再调用 `final pass --report <报告>`。
