# Job Search System

一个 **local-first、evidence-driven、Agent-friendly** 的求职与面试成长系统。

它把通常散落在聊天记录、简历文件、招聘网站和面试笔记里的流程，收敛成一条可执行链路：

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
```

> 这不是“自动海投机器人”。搜索、分析、简历和训练可以自动化；真实投递、发消息、修改外部账号等副作用默认不执行，必须由用户明确触发。

## 能做什么

- 本地 SQLite 管理岗位、快照、验证状态与匹配结果。
- Web UI 浏览岗位、匹配、简历和个人信息。
- Bounded Interview Runtime：题库、检索、追问、评分、复盘、成长队列。
- Learning Runtime：术语、课程、学习进度与面试反馈回流。
- 三套 Agent Skills：职位搜索、简历工程、面试训练。
- 私有数据和公开代码分离：Git 只提交通用引擎与 synthetic fixtures。

## Quick Start

要求 Node.js **24+**，项目目前没有第三方 npm runtime dependency。

```bash
git clone <your-repository-url>
cd job-search-system

npm test
npm run demo
```

打开：

```text
http://127.0.0.1:4317
```

`npm run demo` 会加载公开的虚构岗位和虚构候选人数据，不需要任何真实账号。

启动面试 Runtime：

```bash
npm run interview:host
```

健康检查：

```text
GET http://127.0.0.1:4318/health
```

CLI 也可以直接调用：

```bash
npm run interview:runtime -- '{"op":"status"}'
```

## 使用自己的私有数据

公开仓库默认只读取 `examples/candidate/career-facts.md`。

把你的真实 Career Facts 放到任意 **Git 不跟踪** 的位置，然后设置：

```bash
export CAREER_FACTS_PATH=/absolute/path/to/private/career-facts.md
npm start
```

本仓库默认忽略：

```text
career-assets/
.private/
docs/00-公共上下文/
app/db/runtime/
```

因此你可以在同一个本地仓库继续维护真实职业资产，而不会把它们带进公开 Git 历史。

候选人专属 Interview Evidence 可以通过 `CANDIDATE_EVIDENCE_FILE` 指向本地 JSON；未配置时，Runtime 使用 `examples/candidate/evidence/` 的 synthetic demo evidence。

Learning Runtime 在公开仓使用 `app/server/data/learning/` 下的 synthetic / generic fixture；完整内部学习快照继续留在本机 ignored `docs/学习/`，不进入公开 Git。

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

核心原则：

- **Skill** 描述“AI 应该怎样做”；
- **Runtime** 限制“AI 实际能调用什么”；
- **Facts / Evidence** 决定“AI 不能编造什么”；
- **Code / SQLite** 拥有状态、验证和副作用真值。

详见 [Agent 驱动与边界](docs/开放源码/Agent驱动与边界.md)。

## 主要命令

| 命令 | 作用 |
|---|---|
| `npm run demo` | 使用 synthetic fixtures 启动 Web App |
| `npm start` | 使用本地持久化数据启动 Web App |
| `npm run interview:host` | 启动 Interview HTTP Runtime |
| `npm run interview:runtime -- '<json>'` | 单次调用 Interview CLI |
| `npm test` | 运行公开测试 |
| `npm run verify:public` | 隐私/发布边界检查 + 公开测试 |
| `npm run test:local` | 本地完整测试入口；可能包含未公开的私有测试 |

## 项目结构

```text
app/
  server/               Application / Interview / Learning runtime
  server/data/learning/ Public synthetic / generic Learning fixtures
  web/                  Local Web UI
  db/                   SQLite schema + ignored runtime DB
  tests/                Public tests + local ignored tests

skills/
  job-search/
  resume-engineering/
  interview-training/

examples/
  candidate/            Synthetic candidate/evidence fixtures

docs/
  开放源码/              Public runtime / privacy / contribution docs
```

## Privacy by default

公开发布前必须执行：

```bash
npm run verify:public
```

检查会拒绝：

- `career-assets/`、`.private/`、内部 handoff、runtime DB 被 Git 跟踪；
- 本机绝对路径；
- 已知候选人/雇主专属标识；
- 手机号、邮箱形式的个人信息；
- 常见 token / secret 形态。

示例数据全部为 synthetic，不代表真实候选人、公司或招聘信息。

## Contributing

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Security

见 [SECURITY.md](SECURITY.md)。请不要在公开 Issue 中粘贴简历、手机号、招聘者信息、Cookie、Token 或真实 Career Facts。

## License

MIT. See [LICENSE](LICENSE).
