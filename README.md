# Job Search System

一个 **local-first、evidence-driven、Agent-friendly** 的求职、学习与面试成长系统。

它把岗位数据、证据、简历工程、面试训练与学习反馈组织成一条可执行链路：

```text
Career Facts / Evidence
        ↓
JD / Market
        ↓
Job Matching
        ↓
Resume Preparation
        ↓
Interview Runtime
        ↓
Feedback / Learning
        ↺
```

> 这不是“自动海投机器人”。搜索、分析、简历和训练可以自动化；真实投递、发消息、修改外部账号等副作用默认不执行，必须由用户明确触发。

## 能做什么

- SQLite 管理岗位、快照、验证状态、面试状态与学习进度。
- Web UI 浏览岗位、匹配、简历和候选人信息。
- Bounded Interview Runtime：题库、检索、追问、评分、复盘、成长队列。
- Learning Runtime：术语图谱、课程、学习进度与面试反馈回流。
- Agent Skills：职位搜索、简历工程、面试训练。
- 公开代码、通用知识资产与个人私有数据分离。

## Quick Start

要求 Node.js **24+**。项目当前没有第三方 npm runtime dependency。

```bash
git clone https://github.com/sayhelloproton-eng/job-search-system.git
cd job-search-system
npm test
npm run demo
```

打开：

```text
http://127.0.0.1:4317
```

`npm run demo` 只加载 synthetic 示例数据，不需要真实账号或本机私有数据。

启动 Interview Runtime：

```bash
npm run interview:host
```

健康检查：

```text
GET http://127.0.0.1:4318/health
```

CLI：

```bash
npm run interview:runtime -- '{"op":"status"}'
```

## 核心模块

### Job / Resume

职位搜索、归一化、匹配和简历工程由 `app/`、`skills/job-search/` 与 `skills/resume-engineering/` 提供。

公开仓包含通用引擎、Skill、规则与 synthetic 示例；真实简历、真实职业事实和候选人专属 Evidence 属于个人资产，不进入公开 Git。

### Learning

学习模块是正式公开能力，不只是一份占位说明。公开内容包括：

- `app/server/learning-*.ts`：Learning Runtime；
- `app/db/migrations/007_*` ～ `009_*`：学习相关数据库结构；
- `app/server/data/learning/`：可运行的 synthetic / generic fixture；
- `docs/学习/` 中通过隐私审计的术语系统、课程系统、学习内容、数据与构建脚本；
- 对应的通用测试。

候选人能力快照、真实 JD 差距、个人学习优先级和个人学习记录继续留在本机。

### Interview

面试模块同样是正式公开能力。公开内容包括：

- `app/server/interview-*.ts`：Interview Runtime / Retrieval / Director / Growth / Adaptive Training；
- `app/db/migrations/003_*` ～ `006_*`：面试数据库结构；
- `skills/interview-training/`：Agent 训练入口与已审计参考；
- `docs/面试/` 中通过隐私审计的系统设计、实现与验收文档；
- 对应的通用测试。

个人定位、自我介绍、Story Bank、真实面试回答、候选人专属 Evidence 与真实语音试点数据继续留在本机。

### Database

数据库模块本身是公开的。`app/db/migrations/` 保留 schema / migrations，使 fresh clone 可以重建结构。

只有真实运行状态被忽略：

```text
app/db/runtime/
*.db
*.sqlite
*.sqlite3
```

因此公开的是“数据库如何设计和运行”，不是作者本机的真实岗位、学习进度或面试记录。

## 开源边界：按敏感性，而不是按“内部/外部”标签

本项目的发布原则只有一个核心判断：**没有个人敏感信息、凭据/Token、私密运行数据或明确的第三方再分发风险，就可以公开。**

以下内容保持私有：

```text
career-assets/              # 真实简历、职业事实、项目 Evidence
.private/                   # 本机私有配置与发布 denylist
docs/00-公共上下文/         # 项目会话上下文与接力材料
app/db/runtime/             # 真实运行数据库
```

此外，任何包含真实个人信息、真实候选人材料、账号凭据、Token、私钥或本机身份路径的单个文件都会被发布 Gate 拒绝。

`docs/`、`app/tests/` 和 Skill references 在本地采用 **deny-by-default authoring**：新文件先不自动进入 Git，经过敏感审计后再显式纳入。已经审计并进入 Git 的文件即为正常公开资产，不因为位于这些目录而被视为“内部文件”。

第三方简历模板镜像和社交媒体原始素材即使不含个人信息，也可能存在再分发权利问题，因此不作为默认公开资产。

## 使用自己的私有数据

公开仓默认只读取 `examples/candidate/` 下的 synthetic 示例。

真实 Career Facts 可以放在任意 Git 不跟踪的位置，再设置：

```bash
export CAREER_FACTS_PATH=/absolute/path/to/private/career-facts.md
npm start
```

候选人专属 Interview Evidence 可以通过 `CANDIDATE_EVIDENCE_FILE` 指向本地 JSON；未配置时 Runtime 使用公开 synthetic evidence。

## Human / Agent 两种驱动方式

### Human-driven

```text
Browser
→ Web UI
→ HTTP Application
→ Domain / SQLite
→ Provider / Runtime
```

### Agent-driven

```text
AI Session
→ Skill
→ bounded Runtime / API
→ deterministic state
→ Evidence / JD / Learning
```

三个公开 Skill 入口：

```text
skills/job-search/SKILL.md
skills/resume-engineering/SKILL.md
skills/interview-training/SKILL.md
```

核心边界：

- **Skill** 描述 AI 应该怎样做，不拥有系统状态。
- **Runtime** 限制 AI 实际能调用什么，并负责 validation 与 deterministic state。
- **Facts / Evidence** 决定 AI 不能编造什么。
- **Code / SQLite** 拥有状态、验证和副作用真值。
- 模型推断不能反向创造 Career Fact。
- 搜索、分析、匹配、训练默认是 read-only 或 local mutation。
- 真实投递、发消息、修改招聘网站资料等外部动作必须由用户明确授权。

Truth hierarchy：

```text
User-approved facts / evidence
> deterministic runtime state
> external observed data
> model inference
```

## 主要命令

| 命令 | 作用 |
|---|---|
| `npm run demo` | 使用 synthetic fixtures 启动 Web App |
| `npm start` | 使用本地持久化数据启动 Web App |
| `npm run interview:host` | 启动 Interview HTTP Runtime |
| `npm run interview:runtime -- '<json>'` | 单次调用 Interview CLI |
| `npm test` | 运行公开测试 |
| `npm run verify:public` | 敏感信息/发布边界检查 + 公开测试 |
| `npm run test:local` | 本地扩展测试入口 |

## 项目结构

```text
app/
  server/               Application / Interview / Learning runtime
  server/data/learning/ Public synthetic / generic Learning fixtures
  web/                  Local Web UI
  db/migrations/        Public SQLite schema / migrations
  db/runtime/           Private local runtime DB
  tests/                Public tests + local-only sensitive tests

skills/
  job-search/
  resume-engineering/
  interview-training/

docs/
  产品/                  Audited product docs
  系统规范/              Audited contracts and architecture
  学习/                  Audited learning system/content assets
  面试/                  Audited interview system/implementation assets
```

根 `README.md` 是项目级总说明入口；模块文档保留各自的设计、实现、测试和知识内容，不重复维护第二份项目总览。

## Privacy / Secret Gate

公开发布前执行：

```bash
npm run verify:public
```

Gate 会拒绝：

- `career-assets/`、`.private/`、项目会话上下文、runtime DB 被 Git 跟踪；
- 本机用户目录路径；
- 手机号、邮箱形式的个人信息；
- GitHub / OpenAI / AWS / Slack 等常见凭据形态；
- Bearer Token 与私钥内容；
- 本机私有 denylist 命中。

示例数据全部为 synthetic，不代表真实候选人、公司或招聘信息。

## Open Source Governance

- 贡献说明：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全说明：[SECURITY.md](SECURITY.md)
- 社区行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- License：[LICENSE](LICENSE)
