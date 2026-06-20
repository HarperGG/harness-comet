# 独立 Skill 安装

Harness-Comet 的可安装 skill 统一存放在：

```text
packages/comet-adapter/assets/shared-skills/
```

该目录同时作为源码目录和 npm 发布资产，不需要额外复制到根目录或执行二次打包同步。

## 查看可安装 Skill

```bash
pnpm exec harness-comet skill list
```

## 安装一个 Skill

```bash
pnpm exec harness-comet skill install playwright-authoring-decision
```

未指定平台时，命令会检测当前项目中的：

```text
.codex/
.claude/
```

并将 skill 安装到检测到的平台：

```text
.codex/skills/<skill-name>/
.claude/skills/<skill-name>/
```

目前独立安装仅支持：

- `codex`
- `claude`

## 显式指定平台

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex
```

同时安装到两个平台：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --platform claude
```

## 安全选项

预览写入：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --dry-run
```

目标内容不同时，默认拒绝覆盖。确认覆盖时使用：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --force
```

内容已经一致时，安装操作为 noop。
