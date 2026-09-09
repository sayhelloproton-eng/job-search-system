# 资深工程师标杆简历模板标准

> 状态：FROZEN_V2 / CONTENT_ONLY / MARKDOWN_ONLY
> 更新：2026-09-06

本标准回答一个问题：**什么样的完整中文 Markdown 才有资格被称为 Senior / Staff / Principal / Architect 简历模板。**

## 1. 模板定义

模板不是章节目录，不是视觉皮肤，也不是每个项目一句占位文字。

标杆模板必须是一份完整、可从头读到尾的示范简历，能够直接展示：
- 约 10 年经历如何分配内容深度；
- 最近 4–5 年如何展开；
- 旗舰项目如何写出上下文、判断、机制和结果；
- 普通项目如何压缩保留；
- 早期职业经历如何不断链；
- Senior / Staff / Architect scope 如何从事实中自然出现。

## 2. 内容预算 Gate

不按页面数预算，只按信息完整性和阅读密度预算。

最近/最相关公司：
- 需要一个完整职责/业务上下文；
- 至少一个可深入追问的旗舰项目；
- 至少一个次重点或普通项目；
- 能同时体现深度与持续交付。

第二家公司：保留核心工作和代表性项目。

早期经历：可以高度压缩，但必须保留职业连续性。

个人/开源项目：只有能增强目标岗位证明时加入，并明确身份。

## 3. 旗舰项目 Gate

旗舰项目不能只回答“做了什么”。整块至少覆盖以下信号中的大多数：

`context/problem + personal ownership + decision/trade-off + mechanism + consequence/verified scope`

允许跨多个自然段或 bullet 展开，不要求强塞成一句 STAR/XYZ。

## 4. Seniority Gate

资深度不得靠职位名或形容词制造。需要从多个真实工作项反复看到：
- 跨模块/跨系统范围；
- 架构、迁移或兼容判断；
- 可靠性、风险与恢复；
- 平台化、复用或开发者杠杆；
- 跨团队协作；
- hands-on implementation。

Technical Owner 型 IC 不得被写成 people manager。

## 5. Completeness Gate

定向只控制重点，不等于删历史。

至少保留：
- 旗舰项目深度；
- 其他代表性交付的广度；
- 第二家公司可证明的核心工作；
- 早期职业经历。

如果一份约 10 年简历看起来像只做过两个项目，直接判 FAIL。

## 6. 中文自然度 Gate

- 不把英文 resume cliché 逐句翻译；
- 不让每条都用“主导 / 通过 / 基于 / 负责”开头；
- 不使用“赋能、打造、沉淀、显著提升”代替真实机制；
- 技术名词用于解释系统，不用于堆关键词；
- 不依赖内部黑话才能理解。

## 7. 当前格式合同

当前模板阶段只接受 Markdown。

以下全部退出模板验收：
- PDF / PNG / 图片；
- RenderCV / LaTeX / XeLaTeX；
- CJK 字体、字号、分页；
- ATS 模板抽取与机器评分；
- 一页 / 两页的视觉适配。

## 8. Benchmark references

默认先读：
- `career-assets/简历/模板/01-中文内容模板标准.md`
- `career-assets/简历/模板/02-真实高级工程师标杆.md`
- `career-assets/简历/模板/03-简历技能调研.md`
- `career-assets/简历/模板/04-社区证据与来源.md`

真实公开 Senior / Staff / Principal 样本在 `skills/resume-engineering/templates/exemplars/`。

排版源码 `skills/resume-engineering/templates/sources/` 是历史研究资产，当前 Gate 不读取。

## 9. Acceptance wording

只有满足以上 Gate、并且从第一行到最后一行都完整可读的中文 Markdown 示例，才可以标：

`BENCHMARK_TEMPLATE = PASS`

章节骨架、视觉 preview、renderer sample 一律不能冒充模板成品。
