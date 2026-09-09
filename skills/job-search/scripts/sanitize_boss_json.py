#!/usr/bin/env python3
"""Remove sensitive BOSS authentication and routing fields from JSON."""

from __future__ import annotations

import json
import sys
from typing import Any


SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "cookies",
    "headers",
    "security_id",
    "stoken",
    "token",
    "wt2",
    "__zp_stoken__",
}


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: sanitize(item)
            for key, item in value.items()
            if key.lower() not in SENSITIVE_KEYS
        }
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}", file=sys.stderr)
        return 2

    json.dump(sanitize(payload), sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
