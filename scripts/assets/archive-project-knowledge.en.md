<!-- HARNESS-COMET:BEGIN archive-project-knowledge -->
### 1. Project Knowledge Update

Before Harness/Playwright archive preflight and final archive confirmation, review whether the completed change should update long-lived project knowledge.

The project knowledge files are:

```text
.agents/rules.md
.agents/structure.md
```

If either file does not exist, create a minimal file before proposing updates. Preserve all content unrelated to this change.

#### 1a. Read the available evidence

Read the change proposal, design, tasks, specs, Design Doc, implementation Plan, verification report, current project knowledge files, repository changes, and explicit user statements still available in the current context. A complete chat transcript is not required; archived artifacts and repository changes are the primary evidence.

#### 1b. Extract project rules

Only propose a rule when it comes from an explicit user statement, applies to future work, and represents a project-level constraint, engineering guideline, testing requirement, collaboration convention, or agent-behavior instruction. Do not infer generic best practices or promote feature requirements, implementation details, temporary decisions, or one-off constraints into project rules.

Compare candidates with `.agents/rules.md` semantically. Classify each as no change, add, merge/refine, or conflict. Do not edit yet; show the proposed diff and evidence first.

#### 1c. Update project structure knowledge

Only propose updates for long-lived structural changes such as major modules or directories, module responsibilities, capability moves, shared project capabilities, important entry points, dependency direction, or test-asset organization. Do not document ordinary file additions, internal implementation changes, or temporary structures. Describe logical responsibilities rather than copying the full file tree.

#### 1d. Disclose and confirm

Show explicit diffs and evidence for both files. Offer: apply all updates, adjust item by item, skip knowledge update, or do not archive yet. Only write approved content. After writing, re-read the files and verify they match the disclosed diff.
<!-- HARNESS-COMET:END archive-project-knowledge -->
