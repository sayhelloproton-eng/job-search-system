"""Conservative lint for public Markdown resumes generated from this repository."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

REQUIRED_SECTIONS = ("职业概述", "工作经历", "教育经历")
INTERNAL_ID = re.compile(r"\b(?:CF|EV|BF|FACT|SRC|JD)-[A-Z0-9-]+\b", re.I)
INTERNAL_PATH = re.compile("(?:/" + "Users/|career-assets/|skills/resume-engineering/|app/tests/)")
DANGEROUS_AGGREGATES = ("4,476", "4476", "760+", "553", "84.8")
INTERNAL_EVIDENCE_METRICS = (
    re.compile(r"\b221\s*(?:个\s*)?(?:unique\s*)?commits?\b", re.I),
    re.compile(r"42\s*个?\s*(?:仓库|repos?)\b", re.I),
)
AI_SLOP = (
    "全面赋能", "构建完整闭环", "显著提升", "大幅提升", "深度参与", "深度负责",
)
AUDIT_META = (
    "实验稿", "当前投递版", "不包装", "不把", "仅作工作范围核验", "均有源码依据",
    "真实 Chrome/ChatGPT", "后续 Real 阶段", "仍在后续真实", "内部 benchmark",
)


def headings(text: str) -> set[str]:
    return {m.group(1).strip() for m in re.finditer(r"^#{2,3}\s+(.+?)\s*$", text, re.M)}


def bullets(text: str) -> list[tuple[int, str]]:
    items: list[tuple[int, str]] = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if re.match(r"^\s*[-*]\s+", line):
            items.append((lineno, re.sub(r"^\s*[-*]\s+", "", line).strip()))
    return items


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("resume", type=Path)
    parser.add_argument(
        "--experiment",
        action="store_true",
        help="content-scoring draft: unresolved education/contact fields may be omitted",
    )
    args = parser.parse_args()
    text = args.resume.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    found = headings(text)
    required_sections = REQUIRED_SECTIONS if not args.experiment else ("职业概述", "工作经历")
    for section in required_sections:
        if not any(section in h for h in found):
            errors.append(f"缺少必要章节：{section}")

    if INTERNAL_ID.search(text):
        errors.append("公开简历包含内部 FACT/EV/BF/JD 编号")
    if INTERNAL_PATH.search(text):
        errors.append("公开简历包含内部仓库或本机路径")

    for token in DANGEROUS_AGGREGATES:
        if token in text:
            errors.append(f"出现高风险宽口径/非最终指标：{token}")
    for pattern in INTERNAL_EVIDENCE_METRICS:
        if pattern.search(text):
            errors.append("公开简历包含仅允许内部核验使用的 Git/仓库计数")
    for phrase in AUDIT_META:
        if phrase in text:
            errors.append(f"公开简历泄漏内部审计/事实治理语言：{phrase}")

    if re.search(r"^\s*\|.+\|\s*$", text, re.M):
        warnings.append("Markdown 表格可能影响 ATS/plain-text 阅读顺序")

    resume_bullets = bullets(text)
    starts: list[str] = []
    for lineno, bullet in resume_bullets:
        if len(bullet) > 180:
            warnings.append(f"第{lineno}行要点过长（{len(bullet)}字符）")
        token = re.split(r"[，、：:；;\s]", bullet, maxsplit=1)[0]
        starts.append(token)

    for i in range(len(starts) - 2):
        if starts[i] and starts[i] == starts[i + 1] == starts[i + 2]:
            warnings.append(f"连续3条要点以“{starts[i]}”开头，检查模板感")
            break

    for phrase in AI_SLOP:
        if phrase in text:
            warnings.append(f"出现泛化/AI模板表达“{phrase}”，确认是否有具体机制支撑")

    if re.search(r"(?:带领|管理)\s*\d+\s*人", text):
        warnings.append("出现正式人员管理口径，请与 Career Facts 的管理边界交叉验证")

    print(f"resume: {args.resume}")
    for item in errors:
        print(f"ERROR: {item}")
    for item in warnings:
        print(f"WARN: {item}")
    print(f"summary: {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
