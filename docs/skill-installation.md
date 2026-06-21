# 独立 Skill 安装

Harness-Comet 的可安装 skill 统一存放在：

```text
packages/comet-adapter/assets/shared-skills/
```

该目录同时作为源码目录和 npm 发布资产。

独立 `skill install` 与统一 setup / Comet 接入现在支持相同的四个平台：

- `codex`
- `claude`
- `cursor`
- `github-copilot`

## 查看可安装 Skill

```bash
pnpm exec harness-comet skill list
```

## 自动检测并安装

```bash
pnpm exec harness-comet skill install playwright-authoring-decision
```

未指定平台时会检测：

```text
.codex/
.claude/
.cursor/
.github/
```

目标目录分别为：

```text
.codex/skills/<skill-name>/
.claude/skills/<skill-name>/
.cursor/skills/<skill-name>/
.github/skills/<skill-name>/
```

## 显式指定平台

Cursor：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform cursor
```

GitHub Copilot：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform github-copilot
```

多个平台：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --platform claude \
  --platform cursor \
  --platform github-copilot
```

## 安全选项

预览：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform cursor \
  --dry-run
```

覆盖不同内容：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform cursor \
  --force
```

内容一致时操作为 noop。

完整项目接入请参考 [Harness-Comet 接入手册](./getting-started.md)。
