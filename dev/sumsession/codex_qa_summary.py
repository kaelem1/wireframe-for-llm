#!/usr/bin/env python3
"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
3. 运行时只从 `OPENAI_API_KEY` 读取 key，`base_url` 固定为 SiliconFlow
4. 仅分析带错误/构建/API 等信号的 chunk，降低无效调用
5. 解析模型输出只做本地 JSON 截取与轻量修整，失败后记日志并跳过
6. 默认单 worker，且在每次请求前强制节流，避免持续触发 TPM 限流
7. 文件级结果增量写入隐藏状态文件，支持断点续跑
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import traceback
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
import threading
from typing import Any, Iterable

import tiktoken
from openai import OpenAI


PROJECT_ROOT = Path(__file__).resolve().parent
INPUT_DIRS = [
    Path("/Users/kaelem/.codex/sessions/2026/03"),
    Path("/Users/kaelem/.codex/sessions/2026/04"),
]
OUTPUT_FILE = PROJECT_ROOT / "codex_qa_summary.md"
ERROR_LOG_FILE = PROJECT_ROOT / "errors.log"
STATE_FILE = PROJECT_ROOT / ".codex_qa_state.jsonl"
OPENAI_BASE_URL = "https://api.siliconflow.cn/v1"
MAP_MODEL = "Qwen/Qwen2.5-7B-Instruct"
REDUCE_MODEL = "Qwen/Qwen2.5-7B-Instruct"
MAX_CHUNK_TOKENS = 3000
CHUNK_OVERLAP_TOKENS = 200
REDUCE_BATCH_SIZE = 30
MAP_MAX_TOKENS = 256
REDUCE_MAX_TOKENS = 512
API_CALL_MIN_INTERVAL_SECONDS = 2.0
DEFAULT_WORKERS = 1
MAP_REQUEST_MAX_TOKENS = 2400
STRONG_CHUNK_HINTS = {
    "traceback",
    "stack trace",
    "stacktrace",
    "exception",
    "error",
    "failed",
    "failure",
    "syntaxerror",
    "typeerror",
    "referenceerror",
    "valueerror",
    "keyerror",
    "attributeerror",
    "importerror",
    "modulenotfounderror",
    "cannot import",
    "module not found",
    "permission denied",
    "unauthorized",
    "forbidden",
    "token_mismatch",
    "http 400",
    "http 401",
    "http 403",
    "http 404",
    "http 409",
    "http 422",
    "http 429",
    "http 500",
    "http 502",
    "http 503",
    "报错",
    "异常",
    "失败",
    "未找到",
    "无法导入",
    "权限不足",
    "认证失败",
    "未授权",
    "拒绝访问",
}
COMMAND_HINTS = {
    "pip ",
    "pip3 ",
    "npm ",
    "pnpm ",
    "yarn ",
    "pytest",
    "python ",
    "python3 ",
    "uv ",
    "cargo ",
    "go test",
    "docker ",
    "build",
    "deploy",
    "install",
    "test",
}
FAILURE_HINTS = {
    "fail",
    "failed",
    "error",
    "exception",
    "not found",
    "denied",
    "unauthorized",
    "forbidden",
    "超时",
    "失败",
    "报错",
    "异常",
    "404",
    "401",
    "403",
    "429",
    "500",
}
API_HINTS = {
    "api",
    "auth",
    "token",
    "http",
    "request",
    "response",
    "401",
    "403",
    "404",
    "409",
    "422",
    "429",
    "500",
    "502",
    "503",
}
CODE_FIX_HINTS = {
    "fix",
    "fixed",
    "repair",
    "patch",
    "workaround",
    "resolve",
    "resolved",
    "解决",
    "修复",
    "改成",
    "改为",
    "替换",
    "升级",
    "回退",
    "重试",
}
TAG_ORDER = [
    "环境配置",
    "语法错误",
    "依赖冲突",
    "API 调用",
    "权限与认证",
    "路径与文件",
    "数据处理",
    "逻辑错误",
    "构建与运行",
    "其他",
]
ALLOWED_TAGS = set(TAG_ORDER)
_REQUEST_LOCK = threading.Lock()
_NEXT_REQUEST_AT = 0.0


def require_api_key() -> tuple[str, str]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key, "OPENAI_API_KEY"
    raise SystemExit("缺少 OPENAI_API_KEY。可在运行命令层把 SILICONFLOW_API_KEY 映射给它。")


def make_client() -> tuple[OpenAI, str]:
    api_key, source = require_api_key()
    return OpenAI(api_key=api_key, base_url=OPENAI_BASE_URL), source


def make_client_from_key(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=OPENAI_BASE_URL)


def get_encoding(model: str) -> tiktoken.Encoding:
    try:
        return tiktoken.encoding_for_model(model)
    except Exception:
        return tiktoken.get_encoding("o200k_base")


def now_text() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")


def log_error(message: str) -> None:
    ERROR_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with ERROR_LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(f"[{now_text()}] {message}\n")


def strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def safe_json_loads(text: str) -> Any:
    cleaned = strip_code_fences(text)
    candidate = cleaned
    start = -1
    stack: list[str] = []
    in_string = False
    escape = False
    opener_to_closer = {"{": "}", "[": "]"}
    closer_to_opener = {"}": "{", "]": "["}
    start = cleaned.find("{")
    alt_start = cleaned.find("[")
    if alt_start != -1 and (start == -1 or alt_start < start):
        start = alt_start
    if start != -1:
        candidate = cleaned[start:]
        stack = []
        in_string = False
        escape = False
        for index in range(start, len(cleaned)):
            char = cleaned[index]
            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
                continue
            if char in opener_to_closer:
                stack.append(char)
                continue
            if char in closer_to_opener and stack and stack[-1] == closer_to_opener[char]:
                stack.pop()
                if not stack:
                    candidate = cleaned[start : index + 1]
                    break
        if stack and not in_string:
            candidate = cleaned[start:] + "".join(opener_to_closer[item] for item in reversed(stack))
    return json.loads(candidate)


def load_json_payload(text: str) -> Any:
    cleaned = text.strip()
    try:
        return safe_json_loads(cleaned)
    except json.JSONDecodeError:
        compact = strip_code_fences(cleaned).replace("\r", "")
        compact = re.sub(r",\s*([}\]])", r"\1", compact)
        compact = compact.replace("\u0000", "")
        return safe_json_loads(compact)


def flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts = [flatten_text(item) for item in value]
        return "\n".join(part for part in parts if part.strip())
    if isinstance(value, dict):
        for key in ("text", "output", "arguments", "content", "message"):
            if key in value:
                text = flatten_text(value[key])
                if text.strip():
                    return text
        if "text_elements" in value:
            return flatten_text(value["text_elements"])
        return ""
    return str(value)


def render_response_item(payload: dict[str, Any]) -> tuple[str, str] | None:
    payload_type = payload.get("type")
    if payload_type == "message" and payload.get("role") in {"user", "assistant"}:
        text = flatten_text(payload.get("content")).strip()
        if text:
            return payload["role"], text
    return None


def parse_turns(path: Path) -> list[str]:
    turns: list[str] = []
    current: list[str] = []

    with path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                record = json.loads(stripped)
            except json.JSONDecodeError as exc:
                log_error(f"{path} line {line_no}: JSON 解析失败: {exc}")
                continue
            if record.get("type") != "response_item":
                continue
            rendered = render_response_item(record.get("payload", {}))
            if rendered is None:
                continue
            role, text = rendered
            text = text.strip()
            if not text:
                continue
            if role == "user":
                if current:
                    turns.append("\n".join(current).strip())
                    current = []
                current.append(f"User:\n{text}")
                continue
            if not current:
                current.append(f"Assistant:\n{text}")
            else:
                current.append(f"{'Assistant' if role == 'assistant' else 'Tool'}:\n{text}")

    if current:
        turns.append("\n".join(current).strip())
    return turns


def token_count(text: str, encoding: tiktoken.Encoding) -> int:
    return len(encoding.encode(text))


def split_by_tokens(text: str, encoding: tiktoken.Encoding, chunk_tokens: int, overlap_tokens: int) -> list[str]:
    tokens = encoding.encode(text)
    if len(tokens) <= chunk_tokens:
        return [text]
    step = max(1, chunk_tokens - overlap_tokens)
    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(len(tokens), start + chunk_tokens)
        chunks.append(encoding.decode(tokens[start:end]))
        if end >= len(tokens):
            break
        start += step
    return chunks


def chunk_turns(turns: list[str], encoding: tiktoken.Encoding) -> list[str]:
    units: list[tuple[str, int]] = []
    for index, turn in enumerate(turns, 1):
        text = f"[Turn {index}]\n{turn}"
        subchunks = split_by_tokens(text, encoding, MAX_CHUNK_TOKENS, CHUNK_OVERLAP_TOKENS)
        for piece_index, piece in enumerate(subchunks, 1):
            if len(subchunks) == 1:
                labeled = piece
            else:
                labeled = f"[Turn {index} · Part {piece_index}/{len(subchunks)}]\n{piece}"
            units.append((labeled, token_count(labeled, encoding)))

    chunks: list[str] = []
    current: list[tuple[str, int]] = []
    current_tokens = 0

    for text, tokens in units:
        if current and current_tokens + tokens > MAX_CHUNK_TOKENS:
            chunks.append("\n\n".join(item[0] for item in current).strip())
            overlap_units: list[tuple[str, int]] = []
            overlap_tokens = 0
            for unit in reversed(current):
                overlap_units.insert(0, unit)
                overlap_tokens += unit[1]
                if overlap_tokens >= CHUNK_OVERLAP_TOKENS:
                    break
            current = overlap_units
            current_tokens = sum(item[1] for item in current)
        current.append((text, tokens))
        current_tokens += tokens

    if current:
        chunks.append("\n\n".join(item[0] for item in current).strip())
    return [chunk for chunk in chunks if chunk.strip()]


def should_analyze_chunk(chunk_text: str) -> bool:
    lowered = chunk_text.lower()
    if any(hint in lowered for hint in STRONG_CHUNK_HINTS):
        return True
    has_command = any(hint in lowered for hint in COMMAND_HINTS)
    has_failure = any(hint in lowered for hint in FAILURE_HINTS)
    has_api_issue = any(hint in lowered for hint in API_HINTS) and has_failure
    has_code_fix = "```" in chunk_text and any(hint in lowered for hint in CODE_FIX_HINTS)
    return (has_command and has_failure) or has_api_issue or has_code_fix


def should_analyze_file(turns: list[str]) -> bool:
    text = "\n\n".join(turns).strip()
    if not text:
        return False
    return should_analyze_chunk(text)


def line_has_signal(line: str) -> bool:
    lowered = line.lower()
    if any(hint in lowered for hint in STRONG_CHUNK_HINTS):
        return True
    has_command = any(hint in lowered for hint in COMMAND_HINTS)
    has_failure = any(hint in lowered for hint in FAILURE_HINTS)
    has_api_issue = any(hint in lowered for hint in API_HINTS) and has_failure
    has_code_fix = "```" in line and any(hint in lowered for hint in CODE_FIX_HINTS)
    return (has_command and has_failure) or has_api_issue or has_code_fix


def focus_chunk_text(chunk_text: str) -> str:
    lines = chunk_text.splitlines()
    if len(lines) <= 24:
        return chunk_text
    keep_indexes: set[int] = set()
    for index, line in enumerate(lines):
        if not line_has_signal(line):
            continue
        for offset in (-2, -1, 0, 1, 2):
            target = index + offset
            if 0 <= target < len(lines):
                keep_indexes.add(target)
    if not keep_indexes:
        return chunk_text
    focused = "\n".join(lines[index] for index in sorted(keep_indexes)).strip()
    return focused or chunk_text


def truncate_for_prompt(text: str, limit_tokens: int = 1800) -> str:
    encoding = get_encoding(MAP_MODEL)
    tokens = encoding.encode(text)
    if len(tokens) <= limit_tokens:
        return text
    head = tokens[:1500]
    tail = tokens[-300:]
    return encoding.decode(head) + "\n\n[...trimmed...]\n\n" + encoding.decode(tail)


def merge_map_requests(chunk_texts: list[str], encoding: tiktoken.Encoding) -> list[tuple[str, str]]:
    requests: list[tuple[str, str]] = []
    current_labels: list[str] = []
    current_parts: list[str] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current_labels, current_parts, current_tokens
        if not current_parts:
            return
        label = current_labels[0] if len(current_labels) == 1 else f"{current_labels[0]}-{current_labels[-1]}"
        requests.append((label, "\n\n".join(current_parts).strip()))
        current_labels = []
        current_parts = []
        current_tokens = 0

    for chunk_index, chunk_text in enumerate(chunk_texts, 1):
        if not should_analyze_chunk(chunk_text):
            flush()
            continue
        focused_text = focus_chunk_text(chunk_text)
        chunk_tokens = token_count(focused_text, encoding)
        if current_parts and current_tokens + chunk_tokens > MAP_REQUEST_MAX_TOKENS:
            flush()
        current_labels.append(str(chunk_index))
        current_parts.append(focused_text)
        current_tokens += chunk_tokens
    flush()
    return requests


def normalize_tag(tag: str) -> str:
    cleaned = tag.strip()
    if cleaned in ALLOWED_TAGS:
        return cleaned
    for allowed in TAG_ORDER:
        if allowed in cleaned or cleaned in allowed:
            return allowed
    return "其他"


def normalize_problem(problem: str) -> str:
    text = re.sub(r"\s+", "", problem.lower())
    text = re.sub(r"[`~!@#$%^&*()_+=\[\]{}\\|;:'\",.<>/?，。！？；：“”‘’、·-]", "", text)
    return text


def compact_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        tag = normalize_tag(str(row.get("tag", "其他")))
        problem = str(row.get("problem", "")).strip()
        solution = str(row.get("solution", "")).strip()
        error = str(row.get("error", "")).strip()
        if not problem or not solution:
            continue
        key = (tag, normalize_problem(problem))
        existing = grouped.get(key)
        if existing is None:
            grouped[key] = {
                "problem": problem,
                "error": error,
                "solution": solution,
                "tag": tag,
                "count": int(row.get("count", 1) or 1),
            }
            continue
        existing["count"] += int(row.get("count", 1) or 1)
        if not existing["error"] and error:
            existing["error"] = error
        if len(solution) > len(existing["solution"]):
            existing["solution"] = solution
        if len(problem) > len(existing["problem"]):
            existing["problem"] = problem
    return list(grouped.values())


def throttle_request() -> None:
    global _NEXT_REQUEST_AT
    with _REQUEST_LOCK:
        now = time.monotonic()
        wait_seconds = max(0.0, _NEXT_REQUEST_AT - now)
        if wait_seconds > 0:
            time.sleep(wait_seconds)
            now = time.monotonic()
        _NEXT_REQUEST_AT = now + API_CALL_MIN_INTERVAL_SECONDS


def chat_json(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_prompt: str,
    context_label: str,
    max_tokens: int,
) -> dict[str, Any]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": max_tokens,
    }

    def is_rate_limited(error: Exception) -> bool:
        return getattr(error, "status_code", None) == 429 or "429" in str(error)

    rate_limit_attempts = 0
    while True:
        try:
            throttle_request()
            try:
                response = client.chat.completions.create(
                    **kwargs,
                    response_format={"type": "json_object"},
                )
            except Exception as error:
                if is_rate_limited(error):
                    time.sleep(min(180, 30 * (2 ** rate_limit_attempts)))
                    rate_limit_attempts += 1
                    continue
                throttle_request()
                response = client.chat.completions.create(**kwargs)

            content = response.choices[0].message.content or "{}"
            try:
                payload = load_json_payload(content)
            except json.JSONDecodeError as exc:
                preview = strip_code_fences(content)[:400].replace("\n", "\\n")
                log_error(f"{context_label}: JSON 解析失败: {exc}; preview={preview}")
                return {"items": []}
            if isinstance(payload, list):
                return {"items": payload}
            if isinstance(payload, dict):
                return payload
            return {"items": []}
        except Exception as error:
            if is_rate_limited(error):
                time.sleep(min(180, 30 * (2 ** rate_limit_attempts)))
                rate_limit_attempts += 1
                continue
            raise


def map_chunk(
    client: OpenAI,
    file_path: Path,
    chunk_index: str,
    chunk_total: int,
    chunk_text: str,
) -> list[dict[str, Any]]:
    prompt_text = truncate_for_prompt(chunk_text)
    system_prompt = (
        "你是资深编程问题整理助手。"
        "只提取真实的编程、调试、构建、依赖、API 或环境问题。"
        "问题和解法都要短。不要编造，不要输出解释文字，只输出 JSON。"
    )
    user_prompt = json.dumps(
        {
            "task": "提取对话里的编程问题和解法，没有就返回空 items。",
            "file": str(file_path),
            "chunk": f"{chunk_index}/{chunk_total}",
            "tags": TAG_ORDER,
            "schema": {"items": [{"problem": "string", "error": "string", "solution": "string", "tag": "string"}]},
            "rules": [
                "problem 不超过30字",
                "solution 不超过40字",
                "tag 只能从 tags 中选一个",
            ],
            "text": prompt_text,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    payload = chat_json(
        client,
        MAP_MODEL,
        system_prompt,
        user_prompt,
        context_label=f"{file_path} chunk {chunk_index}/{chunk_total}",
        max_tokens=MAP_MAX_TOKENS,
    )
    items = payload.get("items", [])
    if not isinstance(items, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "problem": str(item.get("problem", "")).strip(),
                "error": str(item.get("error", "")).strip(),
                "solution": str(item.get("solution", "")).strip(),
                "tag": normalize_tag(str(item.get("tag", "其他"))),
                "count": 1,
            }
        )
    return compact_rows(rows)


def reduce_group(
    client: OpenAI,
    tag: str,
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not rows:
        return []
    system_prompt = (
        "你是编程知识库整理助手。"
        "你的任务是只合并明显同义的重复问题，保留不同问题的多样性。"
        "只输出 JSON。"
    )
    user_prompt = json.dumps(
        {
            "tag": tag,
            "task": "只合并明显重复的问题，不要把不同问题合并掉。",
            "schema": {"items": [{"problem": "string", "error": "string", "solution": "string", "tag": "string"}]},
            "rules": [
                "保留不同问题，不要过度归并",
                "至少保留 8 条或输入条数的一半，取较小值",
                "problem 和 solution 保持简短可执行",
            ],
            "rows": rows,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    payload = chat_json(
        client,
        REDUCE_MODEL,
        system_prompt,
        user_prompt,
        context_label=f"reduce:{tag}",
        max_tokens=REDUCE_MAX_TOKENS,
    )
    items = payload.get("items", [])
    if not isinstance(items, list):
        return []
    merged: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        merged.append(
            {
                "problem": str(item.get("problem", "")).strip(),
                "error": str(item.get("error", "")).strip(),
                "solution": str(item.get("solution", "")).strip(),
                "tag": normalize_tag(str(item.get("tag", tag))),
                "count": 1,
            }
        )
    return compact_rows(merged)


def batch_rows(rows: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [rows[index : index + size] for index in range(0, len(rows), size)]


def reduce_with_batches(client: OpenAI, tag: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    current = compact_rows(rows)
    if len(current) <= REDUCE_BATCH_SIZE:
        return reduce_group(client, tag, current)

    next_round: list[dict[str, Any]] = []
    for batch in batch_rows(current, REDUCE_BATCH_SIZE):
        next_round.extend(reduce_group(client, tag, batch))
    return compact_rows(next_round)


def render_markdown(rows_by_tag: dict[str, list[dict[str, Any]]]) -> str:
    lines: list[str] = []
    for tag in TAG_ORDER:
        rows = rows_by_tag.get(tag, [])
        if not rows:
            continue
        lines.append(f"## {tag}")
        lines.append("| 问题 | 解法 |")
        lines.append("|---|---|")
        for row in rows:
            problem = row["problem"].replace("|", "\\|").replace("\n", "<br>")
            solution = row["solution"].replace("|", "\\|").replace("\n", "<br>")
            lines.append(f"| {problem} | {solution} |")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def collect_jsonl_files() -> list[Path]:
    files: list[Path] = []
    for directory in INPUT_DIRS:
        if directory.exists():
            files.extend(sorted(directory.rglob("*.jsonl")))
    return files


def fingerprint_file(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def load_state() -> dict[str, dict[str, Any]]:
    state: dict[str, dict[str, Any]] = {}
    if not STATE_FILE.exists():
        return state
    with STATE_FILE.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                entry = json.loads(stripped)
            except json.JSONDecodeError as exc:
                log_error(f"{STATE_FILE} line {line_no}: JSON 解析失败: {exc}")
                continue
            if not isinstance(entry, dict):
                continue
            file_path = str(entry.get("file", "")).strip()
            if file_path:
                state[file_path] = entry
    return state


def append_state(entry: dict[str, Any]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with STATE_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")


def load_cached_rows(files: list[Path]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    state = load_state()
    extracted: list[dict[str, Any]] = []
    for path in files:
        cached = state.get(str(path))
        if not cached:
            continue
        if cached.get("fingerprint") != fingerprint_file(path):
            continue
        rows = cached.get("rows", [])
        if isinstance(rows, list):
            extracted.extend(row for row in rows if isinstance(row, dict))
    return state, extracted


def process_one_file(api_key: str, encoding: tiktoken.Encoding, path: Path) -> tuple[Path, int, int, list[dict[str, Any]], int]:
    client = make_client_from_key(api_key)
    turns = parse_turns(path)
    if not should_analyze_file(turns):
        return path, 0, 0, [], len(turns)
    chunk_texts = chunk_turns(turns, encoding)
    analyzable = merge_map_requests(chunk_texts, encoding)
    file_rows: list[dict[str, Any]] = []
    request_total = len(analyzable)
    for chunk_index, chunk_text in analyzable:
        file_rows.extend(map_chunk(client, path, chunk_index, request_total, chunk_text))
    return path, len(chunk_texts), len(analyzable), compact_rows(file_rows), len(turns)


def process_files(api_key: str, encoding: tiktoken.Encoding, files: list[Path], workers: int) -> list[dict[str, Any]]:
    _ = workers
    state, extracted = load_cached_rows(files)
    total = len(files)
    for index, path in enumerate(files, 1):
        cached = state.get(str(path))
        try:
            fingerprint = fingerprint_file(path)
            if cached and cached.get("fingerprint") == fingerprint:
                cached_rows = cached.get("rows", [])
                cached_turns = int(cached.get("turn_count", 0) or 0)
                cached_chunks = int(cached.get("chunk_count", 0) or 0)
                cached_analyzable = int(cached.get("analyzable_chunks", 0) or 0)
                print(
                    f"[{index}/{total}] {path} cached turns={cached_turns} chunks={cached_chunks} analyzable={cached_analyzable} extracted={len(cached_rows)}",
                    flush=True,
                )
                continue

            file_path, chunk_count, analyzable_count, file_rows, turn_count = process_one_file(api_key, encoding, path)
            extracted.extend(file_rows)
            entry = {
                "file": str(file_path),
                "fingerprint": fingerprint,
                "turn_count": turn_count,
                "chunk_count": chunk_count,
                "analyzable_chunks": analyzable_count,
                "rows": file_rows,
                "processed_at": now_text(),
            }
            append_state(entry)
            state[str(file_path)] = entry
            print(
                f"[{index}/{total}] {file_path} turns={turn_count} chunks={chunk_count} analyzable={analyzable_count} extracted={len(file_rows)}",
                flush=True,
            )
        except Exception as exc:
            log_error(f"{path}: {exc}\n{traceback.format_exc()}")
            print(f"[{index}/{total}] {path} skipped: {exc}", flush=True)
    return extracted


def build_summary(client: OpenAI, rows: list[dict[str, Any]]) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in compact_rows(rows):
        grouped[normalize_tag(str(row.get("tag", "其他")))].append(row)

    reduced_by_tag: dict[str, list[dict[str, Any]]] = {}
    for tag in TAG_ORDER:
        if tag not in grouped:
            continue
        reduced_rows = reduce_with_batches(client, tag, grouped[tag])
        reduced_by_tag[tag] = sorted(
            compact_rows(reduced_rows),
            key=lambda item: (-int(item.get("count", 1) or 1), item["problem"]),
        )
    return render_markdown(reduced_by_tag)


def main() -> int:
    parser = argparse.ArgumentParser(description="批量提取 Codex 对话中的编程问题与解法。")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    args = parser.parse_args()

    api_key, api_source = require_api_key()
    client = make_client_from_key(api_key)
    encoding = get_encoding(MAP_MODEL)
    files = collect_jsonl_files()
    workers = 1
    if args.workers != 1:
        print(f"workers_forced=1 requested={args.workers}", flush=True)
    print(
        f"input_files={len(files)} api_key_source={api_source} model={MAP_MODEL} workers={workers} state_file={STATE_FILE.name}",
        flush=True,
    )

    if not files:
        OUTPUT_FILE.write_text("", encoding="utf-8")
        print(f"written={OUTPUT_FILE} (no input files found)", flush=True)
        return 0

    extracted = process_files(api_key, encoding, files, workers)
    summary = build_summary(client, extracted)
    OUTPUT_FILE.write_text(summary, encoding="utf-8")
    print(f"written={OUTPUT_FILE} rows={len(extracted)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
