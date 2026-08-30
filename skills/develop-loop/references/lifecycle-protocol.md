# 生命周期协议

所有命令都通过自包含运行时，在目标仓库根目录执行。
不要调用全局 `develop-loop` 可执行文件：

```text
node <skill-dir>/scripts/develop-loop.js <command>
```

`start`、`resume`、`status`、`analysis`、`design`、`task`、`final` 会打印 JSON。从中读取 `status`。`next` 打印当前唯一允许的动作。

产物写到以下仓库相对路径：

```text
.develop-loop/design/design.md
.develop-loop/design/task-plan.yaml
.develop-loop/tasks/<task-id>/
.develop-loop/final/final-verify-report.yaml
```

## 系统分析

1. 运行 `next`，阅读它返回的 prompt 和模板。
2. 在 `.develop-loop/design/` 中创建系分 Markdown 和任务计划 YAML。
3. 一并提交：

```text
analysis submit --design <path> --tasks <path>
```

运行时会校验必填系分章节、任务 ID、依赖顺序、允许路径、验收标准和验证命令。合法提交后一定进入 `WAITING_DESIGN_APPROVAL`。

用 `design feedback --file <path>` 记录反馈。用 `design approve` 记录用户的明确确认。

## 研发任务阶段

固定顺序为：

```text
PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SCOPE_CHECK -> DONE
```

每个阶段开始前先运行 `next`。用下面的命令提交产物：

```text
task pass --artifact <path>
```

真实失败时：

```text
task fail --error <concise-reason>
```

`VERIFY`、`REVIEW`、`SCOPE_CHECK` 报告会做机器校验。范围路径必须落在任务的 `allowedPaths` 内，且不能命中 `forbiddenPaths`。产品改动列表不要包含 `.develop-loop/` 运行时文件。

## 最终验证

执行 `next` 返回的每一项必做检查。成功时：

```text
final pass --report <path>
```

失败时：

```text
final fail --error <concise-reason>
```

每次 `task pass` 和 `final pass`，运行时都会校验已锁定的系分哈希。每次失败消耗一次重试；超过 `maxRetries` 后进入 `FAILED`。

## 运行时证据

- `.develop-loop/state.json`：当前已校验状态。
- `.develop-loop/audit.jsonl`：仅追加的状态迁移事件。
- `.develop-loop/checkpoints/`：不可变状态快照。
- `.develop-loop/design/`：系分修订和任务计划。
- `.develop-loop/tasks/`：任务阶段报告。
- `.develop-loop/final/`：最终验证报告。
