# Runtime 模式

Runtime 模式是 Harness-Comet 的结构化场景执行引擎。它使用 YAML 场景、fixture、adapter、inspector 和 oracle 驱动测试，不等同于标准 Playwright Test 模式。

## 当前状态

Runtime 模式目前可以使用。

仓库集成测试覆盖了以下流程：

```text
init → validate → scenario list → run → JSON result
```

同时覆盖 blocking assertion 失败时的非零退出码。默认 `memory` adapter 也有实际实现。

但 Runtime 不是当前主推模式。业务 UI、端到端流程和线上问题回归仍推荐使用 Playwright 模式。

## 适用场景

适合：

- 非 UI 的结构化场景；
- API、CLI、后台服务或领域模型；
- 自定义协议和执行系统；
- 自定义 adapter 开发；
- 快速验证 Harness schema、fixture、oracle 和结果输出。

不确定时优先选择：

```bash
pnpm exec harness-comet setup --mode playwright
```

## 初始化方式

只初始化 Harness Runtime：

```bash
pnpm exec harness-comet init \
  --mode runtime \
  --adapter memory \
  --yes
```

同时初始化 Harness Runtime、Comet 和 Agent 项目入口：

```bash
pnpm exec harness-comet setup --mode runtime
```

两者区别：

| 命令 | Harness Runtime | Comet | `.agents` 和 Agent 入口 |
|---|---|---|---|
| `init --mode runtime` | 是 | 否 | 否 |
| `setup --mode runtime` | 是 | 是 | 是 |

生成的 Runtime 目录：

```text
harness-comet.config.ts
harness/
  scenarios/
  fixtures/
  adapters/
  oracles/
```

## 常用命令

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet scenario list
pnpm exec harness-comet run --scenario example-smoke
pnpm exec harness-comet run --tag smoke
pnpm exec harness-comet run --all
pnpm exec harness-comet run --scenario example-smoke --dry-run
pnpm exec harness-comet --json run --scenario example-smoke
```

## 场景示例

```yaml
schemaVersion: 1
id: example-smoke
title: Example smoke
adapter: memory
tags: [smoke]
fixtureRefs: [example-empty]
steps:
  - action: memory.set
    input:
      key: greeting
      value: Hello Harness
assertions:
  - inspect: memory.get
    input:
      key: greeting
    oracle: value.equals
    expected: Hello Harness
```

执行模型：

```text
fixture
→ adapter.setup
→ actions
→ inspectors
→ oracles
→ adapter.teardown
→ structured result
```

## Memory adapter

默认 memory adapter 支持：

```text
Actions
- memory.set
- memory.merge
- memory.delete

Inspectors
- memory.get
- memory.all
```

它主要用于示例、runtime 自检和自定义 adapter 开发参考，不提供持久化能力。

## 自定义 adapter

Runtime 的主要扩展点是 `HarnessAdapter`。adapter 可以提供：

- `setup` / `teardown`；
- actions；
- inspectors；
- 自定义 oracles。

在配置中注册包或本地模块：

```ts
adapter: {
  default: "my-system",
  entries: {
    "my-system": "./harness/adapters/my-system.ts"
  }
}
```

## 与 Playwright 模式的区别

| 能力 | Playwright | Runtime |
|---|---|---|
| 标准 Web UI / E2E | 推荐 | 不优先 |
| YAML 场景 | 否 | 是 |
| 自定义 adapter | 非核心 | 核心扩展点 |
| journey / incident 目录 | 是 | 否 |
| Playwright reporter / trace | 是 | 否 |
| Comet Playwright impact 和 archive gate | 完整 | 不适用 |

Runtime 初始化也允许选择 `--adapter playwright`，但它仍是 YAML + adapter 模型，不等同于标准 Playwright Test 模式。真实业务 UI 测试建议使用 `--mode playwright`。

## 已知边界

- 文档和示例少于 Playwright 模式；
- 没有 Playwright 模式的 journey、incident、reporter 和证据约定；
- Comet 的深度测试影响分析和归档验证主要针对 Playwright；
- 自定义 adapter 需要自行维护稳定契约；
- `workers` 已进入配置，但当前核心 runner 仍按场景顺序执行，不应视为成熟并行调度。

## 结论

Runtime 不是不可用的遗留代码，而是可运行、可扩展且有测试覆盖的基础执行引擎。

```text
业务 UI / E2E / Bug 回归 → Playwright
非 UI / 自定义协议 / adapter 平台 → Runtime
```
