# develop-loop

`develop-loop` 是一套可断点续跑、可审计的软件开发生命周期 Agent Skill。它会把自然语言需求和附件，整理成目标仓库 `.develop-loop/` 下的运行时状态。

V1 已实现：附件快照、请求规范化、`WAITING_USER`、系分修订、显式设计确认、五阶段研发循环、最大重试、不可变设计锁定、最终验证、checkpoint、仅追加的审计日志，以及面向自包含 Skill 运行时的 JSON 命令协议。

## 从 GitHub 安装

仓库地址：[https://github.com/VaynePeng/develop-loop](https://github.com/VaynePeng/develop-loop)

本仓库只包含一个 Skill。常规安装命令：

```bash
pnpx skills add VaynePeng/develop-loop
```

安装器会发现 `skills/develop-loop/SKILL.md`，并询问安装位置。若要在当前项目里非交互地装给 Codex，使用：

```bash
pnpx skills add VaynePeng/develop-loop --skill develop-loop --agent codex
```

全局安装给 Codex：

```bash
pnpx skills add VaynePeng/develop-loop --skill develop-loop --agent codex --global
```

只想查看仓库里有哪些 Skill、暂不安装时，使用：

```bash
pnpx skills add VaynePeng/develop-loop --list
```

安装后，附上 PRD 或参考文档，然后调用：

```text
$develop-loop 帮我根据这份 PRD 做后端系分
```

也可以输入 `/skills`，再选择 **系分研发循环**。Agent Skills 使用 `$` 提及；第三方仓库无法注册原生的顶级 `/develop-loop` 命令。

## 安装原理

`pnpx` 执行的是第三方 `skills` 安装器。它会下载本 GitHub 仓库，找到 `skills/develop-loop/SKILL.md`，再把该 Skill 装到所选 Agent 的项目目录或用户目录。

安装后的 Skill 是自包含的：

```text
skills/develop-loop/
├── SKILL.md
├── agents/openai.yaml
├── references/
├── prompts/
├── templates/
├── workflows/
└── scripts/develop-loop.js
```

`scripts/develop-loop.js` 是打包后的 Node.js 运行时。Prompt、模板和工作流 YAML 会在构建时复制进 Skill。它们需要提交进仓库，因为 `pnpx skills add` 只会安装 Skill 目录，不会带走本仓库根目录的 `dist/` 或 `node_modules/`。

## 生命周期

```text
输入门禁
  -> WAITING_USER（缺输入，可恢复）
  -> SYSTEM_ANALYSIS
  -> WAITING_DESIGN_APPROVAL
     -> 反馈 -> SYSTEM_ANALYSIS
     -> 确认 -> DEVELOPMENT
  -> PLAN -> IMPLEMENT -> VERIFY -> REVIEW -> SCOPE_CHECK
  -> FINAL_VERIFY
  -> COMPLETED
```

运行证据保存在目标仓库的 `.develop-loop/`：`state.json`、`audit.jsonl`、不可变的 `checkpoints/`、系分修订、任务产物，以及最终报告。

## 本地开发

环境要求：

- Node.js 20 或更新
- pnpm 10

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm demo
```

`pnpm build` 会同时产出 `dist/` 下的开发包，以及可分发的自包含运行时 `skills/develop-loop/scripts/develop-loop.js`。

`pnpm demo` 会创建临时的退款 PRD 仓库、启动自包含运行时，并打印解析后的系分 prompt、模板和 `state.json` 路径，方便本地检查或继续执行。

发布前请运行：

```bash
pnpm verify
pnpx skills add . --skill develop-loop --agent codex --copy
```
