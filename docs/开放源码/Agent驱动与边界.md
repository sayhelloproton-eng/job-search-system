# Agent 驱动与边界

Job Search System 不是把所有权限直接交给模型，而是让 Agent 通过 Skill 和 bounded Runtime 工作。

## 1. Skill

三个公开入口：

- `skills/job-search/SKILL.md`
- `skills/resume-engineering/SKILL.md`
- `skills/interview-training/SKILL.md`

Skill 负责步骤、约束和决策顺序，不拥有系统状态。

## 2. Runtime

Web App、Interview Runtime 和 Learning Runtime 拥有可执行合同。

```text
Agent intent
→ bounded operation
→ validation
→ deterministic state
→ result / evidence
```

模型不能因为一段 JD 或网页文字就获得文件系统、账号或真实投递权限。

## 3. Truth hierarchy

```text
User-approved facts / evidence
> deterministic runtime state
> external observed data
> model inference
```

模型推断永远不能反向创造 Career Fact。

## 4. Side effects

搜索、分析、匹配、训练默认为 read-only / local mutation。

以下动作必须由用户明确授权：

- 真实投递；
- 给招聘者发消息；
- 修改招聘网站资料；
- 删除或覆盖外部数据；
- 任何不可逆外部动作。

## 5. Private evidence

公开仓使用 synthetic evidence。真实候选人 Evidence 应由本地 ignored 文件提供，不写进源码。
