# App

这里是 **Job Search System 的程序本体**，不保存真实个人职业资料。

| 目录 | 作用 |
|---|---|
| `server/` | Job Provider、领域逻辑、HTTP 服务与 Interview Runtime。 |
| `db/` | SQLite migration 与本地 runtime 数据库。 |
| `web/` | 岗位、简历与候选人信息的本地 Web UI。 |
| `tests/` | Domain / DB / HTTP / Provider 测试；公开发布只运行 `*.public.test.ts`。 |

演示：`npm run demo`
测试：`npm test`
公开发布检查：`npm run verify:public`

开源运行与数据边界见 `../docs/开放源码/运行与数据边界.md`；公开示例数据见 `../examples/candidate/`。真实职业资料应只保存在本机私有工作区，不进入 Git。
