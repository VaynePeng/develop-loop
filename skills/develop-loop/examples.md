# 系分研发循环示例

以下命令都是 `node <skill-dir>/scripts/develop-loop.js <command>`。
不要调用全局 `develop-loop` 可执行文件。

## 用附件 PRD 启动一次后端系分

用户：

```text
$develop-loop 帮我根据这份 PRD 做后端系分
```

Agent：

1. 用 `intake prd <attachment>` 为附件 PRD 做快照。
2. 写入 `.develop-loop/request.yaml`，设置 `analysisType: backend`、仓库资源，以及快照后的 PRD 路径和哈希。
3. 运行 `start`。若 JSON `status` 为 `WAITING_USER`，只向用户索要 `missingResources`。
4. 运行 `resume`，再运行 `next`。执行 `CREATE_SYSTEM_ANALYSIS`。
5. 写出 `.develop-loop/design/design.md` 和 `.develop-loop/design/task-plan.yaml`。
6. 运行 `analysis submit --design ... --tasks ...`。
7. 向用户展示 JSON 中的 `designPath` 和 `taskPlanPath`。在用户明确确认或给出反馈前停止。

## 用户补齐缺失接口文档后恢复

`start` 返回：

```json
{
  "status": "WAITING_USER",
  "missingResources": [
    {
      "id": "api-doc",
      "label": "接口文档",
      "kind": "API_DOC"
    }
  ]
}
```

用户附上文件后：

1. `intake api-doc <attachment>`
2. 只更新 `request.yaml` 中对应资源
3. `resume`
4. 仅在 JSON `status` 为 `SYSTEM_ANALYSIS` 后继续

## 先反馈修订，再确认设计

用户：「补充重复退款的幂等策略」

1. 把反馈原文保存到仓库文件。
2. `design feedback --file <path>`
3. `next` 返回 `REVISE_SYSTEM_ANALYSIS`
4. 同时修订两份产物，再次 `analysis submit`
5. 仅在用户明确确认后调用 `design approve`

## 执行一个研发任务

确认后，`next` 返回 `EXECUTE_TASK_PLAN`：

1. 把计划写到 `.develop-loop/tasks/<task-id>/`
2. `task pass --artifact <path>`
3. 对 `IMPLEMENT`、`VERIFY`、`REVIEW`、`SCOPE_CHECK` 重复同样流程
4. 当 `next` 返回 `EXECUTE_FINAL_VERIFY` 时，写出 `.develop-loop/final/final-verify-report.yaml`，再调用 `final pass`
