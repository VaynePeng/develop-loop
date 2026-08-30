---
name: develop-loop
description: 根据自然语言需求和附件中的 PRD、接口文档、数据库、仓库或参考资料，启动或恢复可断点续跑的系分与研发循环。用于系统分析、develop-loop、软件开发生命周期以及需要确定性输入门禁的研发流程；不要用于普通一次性编码任务。
---

# 系分研发循环

把对话当作人机界面，把本 Skill 自带的运行时当作确定性引擎。不要让用户手打资源路径、分析类型开关或内部 CLI 命令。

用户会以 `$develop-loop <request>` 显式调用本流程，并可能在同一条消息里附带文档。

## 运行时

把 `<skill-dir>` 解析为包含本 `SKILL.md` 的目录。用下面的自包含运行时执行命令：

```text
node <skill-dir>/scripts/develop-loop.js <command>
```

该运行时必须在 `pnpx skills add` 安装后存在。若缺失，报告安装不完整，不要去找全局 `develop-loop` CLI，也不要重写运行时。

`start`、`resume`、`status`、`analysis`、`design`、`task`、`final` 会打印 JSON。从中读取 `status`。`intake` 和 `next` 同样打印 JSON；下一步动作只以 `next` 的返回为准。

## 受理输入

1. 阅读用户的自然语言请求，并检查每一份已提供的文件。
2. 仅在意图明确时推断 `analysisType`：
   - 后端或 backend -> `backend`
   - 前端或 frontend -> `frontend`
   - 全栈或 fullstack -> `fullstack`
3. 分析类型不明确时，停下来只问一个简短问题。
4. 把资料分类为 `PRD`、`API_DOC`、`DATABASE_SCHEMA`、`REPOSITORY` 或 `REFERENCE`。用户已给出的标签要保留。
5. 对每个非仓库文件，先运行自包含运行时的 `intake` 命令，再写 `request.yaml`。
6. 使用命令返回的 JSON `path` 和 `sha256`；不要持久化会话里的临时附件路径。
7. 已知的必填资料即使还没拿到，也要写进资源列表，但省略 `path`，以便输入门禁进入 `WAITING_USER`。

创建或更新 `.develop-loop/request.yaml` 前，先阅读 [request-protocol.md](references/request-protocol.md)。

## 启动

当 `.develop-loop/state.json` 不存在时：

1. 根据规范化后的输入创建或更新 `.develop-loop/request.yaml`。
2. 在目标仓库根目录运行 `node <skill-dir>/scripts/develop-loop.js start`。
3. 若 JSON `status` 为 `WAITING_USER`，只向用户索要运行时报告的 `missingResources`。
4. 仅在 JSON `status` 变为 `SYSTEM_ANALYSIS` 后继续。

## 补齐缺失输入后恢复

当 `.develop-loop/state.json` 为 `WAITING_USER` 时：

1. 把新文件匹配到缺失的资源 ID。
2. 用自包含运行时的 `intake` 命令为每个新文件做快照。
3. 更新 `.develop-loop/request.yaml`，保留原始意图和此前已识别的资源。
4. 在目标仓库根目录运行 `node <skill-dir>/scripts/develop-loop.js resume`。
5. 若仍缺必填资料就继续追问；JSON `status` 变为 `SYSTEM_ANALYSIS` 后再继续。

## 路由每一次进行中的运行

对任何已存在的运行，先执行 `resume`，再执行 `next`。把 `next` 返回的 JSON 当作唯一允许的动作。只阅读返回的 `promptPath` 和 `templatePaths`；不要根据对话历史猜测下一阶段。

当 `next` 返回系分、研发或最终验证动作时，阅读 [lifecycle-protocol.md](references/lifecycle-protocol.md)。

## 设计确认门禁

系分产物写到 `.develop-loop/design/`。执行 `analysis submit` 后，向用户展示 JSON 中的 `designPath` 和 `taskPlanPath`，并停在 `WAITING_DESIGN_APPROVAL`。

- 收到反馈时，把原文保存到仓库文件，再调用 `design feedback --file <path>`。然后执行 `next` 返回的修订动作，重新提交两份产物，再次询问。
- 仅在用户明确确认当前修订后，才调用 `design approve`。确认会锁定系分哈希并创建研发任务。
- 不要把沉默、要求解释或部分反馈当成确认。

## 研发与最终验证

任务阶段产物写到 `.develop-loop/tasks/<task-id>/`，最终报告写到 `.develop-loop/final/`。对每个研发阶段，按返回的 prompt 执行工作，按模板写产物，再用 `task pass` 提交。真实执行或校验失败时使用 `task fail`。不要伪造通过的验证、评审或范围报告。持续调用 `next`，直到返回 `FINAL_VERIFY`，再用同样规则执行 `final pass` 或 `final fail`。

## 边界

- 把 `request.yaml` 当作机器契约，把 `state.json` 当作运行时所有。
- 不要手改状态来跳过门禁。
- 仓库资源保持 `path: .`；不要把仓库复制进 `.develop-loop/inputs`。
- 不要绕过附件快照和哈希校验。
- 设计确认落盘前，不要开始实现。
- 保留已有 checkpoint，并按当前状态路由已存在的运行。
- 不要编辑 `state.json`、`audit.jsonl`、checkpoint 或已锁定的系分来强行推进。
- JSON `status` 为 `FAILED` 时停止；报告 `lastError` 和重试次数，不要绕过最大重试。

## 更多资料

- 请求文件契约：[request-protocol.md](references/request-protocol.md)
- 命令与产物规则：[lifecycle-protocol.md](references/lifecycle-protocol.md)
- 完整示例：[examples.md](examples.md)
