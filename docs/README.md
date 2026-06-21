# Harness-Comet 文档

## 使用者文档

- [接入手册](./getting-started.md)：首次接入、已有项目、CI、Agent 平台和项目知识文件。
- [CLI 命令手册](./cli-reference.md)：命令、参数和常见操作。
- [Runtime 模式](./runtime-mode.md)：状态、适用场景、初始化和边界。
- [独立 Skill 安装](./skill-installation.md)：单独安装共享 skill。

## 项目内生成的文档

Playwright 模式初始化后，业务项目中还会生成：

```text
docs/testing/
  README.md
  authoring-guide.md
  incident-guide.md
  acceptance-criteria.md
```

这些文档面向具体业务项目，说明测试资产组织、编写约定、incident 回归和验收标准。

## 设计和实施记录

`docs/superpowers/` 保存 Harness-Comet 自身的设计、计划和历史实施记录，不是业务项目接入时的必读材料。
