# request.yaml 协议

在目标仓库根目录创建 `.develop-loop/request.yaml`。

```yaml
schemaVersion: 1
sourceType: prd
analysisType: backend
originalRequest: |-
  用户原始需求文本
resources:
  - id: repository
    label: 当前代码仓库
    kind: REPOSITORY
    path: .
    required: true
  - id: prd
    label: 产品需求文档
    kind: PRD
    path: .develop-loop/inputs/prd/product-requirement.md
    sha256: 0000000000000000000000000000000000000000000000000000000000000000
    required: true
```

## 字段

- `schemaVersion`：当前协议固定为 `1`。
- `sourceType`：当前固定为 `prd`。
- `analysisType`：`backend`、`frontend` 或 `fullstack`。
- `originalRequest`：保留用户的自然语言意图。
- `resources`：规范化后的输入，ID 必须语义唯一。
- `resources[].kind`：只能是 `PRD`、`REPOSITORY`、`API_DOC`、`DATABASE_SCHEMA` 或 `REFERENCE`。
- `resources[].path`：`intake` 返回的仓库相对稳定路径。缺失资源不要写这个字段。`REPOSITORY` 使用 `path: .`。
- `resources[].sha256`：`intake` 为快照文件返回的 SHA-256。
- `resources[].required`：缺失时是否阻塞流程。

对每个已提供的非仓库文件，在目标仓库根目录运行：

```text
node <skill-dir>/scripts/develop-loop.js intake <resource-id> <source-path>
```

原样使用返回的 `path` 和 `sha256`。不要猜测附件路径，不要把仓库复制进 `.develop-loop`，也不要悄悄把必填资源改成可选。
