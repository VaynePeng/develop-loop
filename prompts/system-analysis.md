# 系统分析执行规范

阅读 `next` 返回的原始需求、全部可用资源和目标仓库代码。先建立现状证据，再完成目标设计；禁止根据文件名猜测现有实现。

按 `next.context.analysisType` 调整深度，不要删掉必填章节：

- `backend`：以数据模型、接口、事务、幂等、权限和迁移为主；前端只写对接约束。
- `frontend`：以信息架构、页面/组件、状态、路由、接口消费和空错态为主；不要发明后端表结构。
- `fullstack`：前后端契约必须对齐，任务拆分覆盖两侧且依赖顺序可执行。

无对应变更的必填章节写明「无变更及原因」。

产出两个文件，写在 `.develop-loop/design/`：

1. 按 `design.md` 生成系分 Markdown，所有必填章节必须保留。
2. 按 `task-plan.yaml` 生成可执行任务计划。任务按依赖顺序排列，路径范围必须具体，验收标准和验证命令必须可执行。

完成后运行自包含运行时的子命令（不要调用全局 `develop-loop`）：

```text
analysis submit --design <系分文件> --tasks <任务计划文件>
```

JSON `status` 变为 `WAITING_DESIGN_APPROVAL` 后，向用户展示 `designPath`、`taskPlanPath` 和系分摘要，等待明确确认。
