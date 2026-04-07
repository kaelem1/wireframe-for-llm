#!/usr/bin/env python3
"""
[PROTOCOL]:

1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
3. 运行时只从 `OPENAI_API_KEY` 读取 key，`base_url` 固定为 SiliconFlow
4. Map 阶段走 OpenAI 兼容 batch，避免逐请求触发 TPM 限流
5. 只分析带错误/构建/API 强信号的片段，并在同文件内合并请求
6. 模型输出只做本地 JSON 截取与轻量修整，失败后记日志并跳过
7. 文件级结果增量写入隐藏状态文件，支持断点续跑
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import traceback
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import tiktoken
except ImportError:
    tiktoken = None


PROJECT_ROOT = Path(__file__).resolve().parent
INPUT_DIRS = [
    Path("/Users/kaelem/.codex/sessions/2026/03"),
    Path("/Users/kaelem/.codex/sessions/2026/04"),
]
OUTPUT_FILE = PROJECT_ROOT / "codex_qa_summary.md"
ERROR_LOG_FILE = PROJECT_ROOT / "errors.log"
STATE_FILE = PROJECT_ROOT / ".codex_qa_state.jsonl"
BATCH_META_FILE = PROJECT_ROOT / ".codex_qa_batch_meta.json"
BATCH_INPUT_FILE = PROJECT_ROOT / ".codex_qa_batch_input.jsonl"
BATCH_OUTPUT_FILE = PROJECT_ROOT / ".codex_qa_batch_output.jsonl"
BATCH_ERROR_FILE = PROJECT_ROOT / ".codex_qa_batch_error.jsonl"
OPENAI_BASE_URL = "https://api.siliconflow.cn/v1"
MAP_MODEL = "deepseek-ai/DeepSeek-V3"
REDUCE_MODEL = "Qwen/Qwen2.5-7B-Instruct"
MAX_CHUNK_TOKENS = 3000
CHUNK_OVERLAP_TOKENS = 200
MAP_REQUEST_MAX_TOKENS = 2200
MAP_MAX_TOKENS = 192
REDUCE_MAX_TOKENS = 448
REDUCE_BATCH_SIZE = 30
BATCH_POLL_INTERVAL_SECONDS = 30
REDUCE_REQUEST_INTERVAL_SECONDS = 2.0
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
SIGNAL_RE = re.compile(
    r"traceback|exception|syntaxerror|typeerror|referenceerror|valueerror|keyerror|"
    r"attributeerror|importerror|modulenotfounderror|module not found|cannot import|"
    r"permission denied|unauthorized|forbidden|http 4\d\d|http 5\d\d|error|failed|"
    r"报错|异常|失败|未找到|无法导入|权限不足|认证失败|拒绝访问",
    re.I,
)
COMMAND_RE = re.compile(r"\b(pip3?|npm|pnpm|yarn|pytest|python3?|uv|cargo|docker)\b", re.I)
API_RE = re.compile(r"\b(api|auth|token|request|response|http|401|403|404|409|422|429|500|502|503)\b", re.I)
FIX_RE = re.compile(r"fix|fixed|repair|patch|workaround|resolve|resolved|解决|修复|改成|改为|替换|升级|回退|重试", re.I)
_NEXT_REDUCE_AT = 0.0


def require_api_key() -> tuple[str, str]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key, "OPENAI_API_KEY"
    raise SystemExit("缺少 OPENAI_API_KEY。可在运行命令层把 SILICONFLOW_API_KEY 映射给它。")


def now_text() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")


def log_error(message: str) -> None:
    with ERROR_LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(f"[{now_text()}] {message}\n")


def get_encoding() -> Any:
    if tiktoken is None:
        return None
    try:
        return tiktoken.encoding_for_model(MAP_MODEL)
    except Exception:
        return tiktoken.get_encoding("o200k_base")


def token_count(text: str, encoding: Any) -> int:
    if encoding is None:
        return max(1, len(text) // 4)
    return len(encoding.encode(text))


def strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def safe_json_loads(text: str) -> Any:
    text = strip_code_fences(text)
    starts = [index for index in (text.find("{"), text.find("[")) if index != -1]
    start = min(starts) if starts else -1
    candidate = text if start == -1 else text[start:]
    opener = {"{": "}", "[": "]"}
    closer = {"}": "{", "]": "["}
    stack: list[str] = []
    in_string = False
    escaped = False
    if start != -1:
        for index, char in enumerate(candidate):
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
            elif char in opener:
                stack.append(char)
            elif char in closer and stack and stack[-1] == closer[char]:
                stack.pop()
                if not stack:
                    candidate = candidate[: index + 1]
                    break
    if stack and not in_string:
        candidate += "".join(opener[item] for item in reversed(stack))
    return json.loads(candidate)


def load_json_payload(text: str) -> Any:
    try:
        return safe_json_loads(text)
    except json.JSONDecodeError:
        compact = strip_code_fences(text).replace("\r", "")
        compact = re.sub(r",\s*([}\]])", r"\1", compact).replace("\u0000", "").replace("\ufeff", "")
        return safe_json_loads(compact)


def flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return "\n".join(part for part in (flatten_text(item) for item in value) if part.strip())
    if isinstance(value, dict):
        for key in ("text", "content", "output", "message", "arguments"):
            if key in value:
                text = flatten_text(value[key])
                if text.strip():
                    return text
        return ""
    return str(value)


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
            payload = record.get("payload", {})
            if not isinstance(payload, dict) or payload.get("type") != "message":
                continue
            role = payload.get("role")
            if role not in {"user", "assistant"}:
                continue
            text = flatten_text(payload.get("content")).strip()
            if not text:
                continue
            if role == "user":
                if current:
                    turns.append("\n".join(current).strip())
                    current = []
                current.append(f"User:\n{text}")
            else:
                if not current:
                    current.append(f"Assistant:\n{text}")
                else:
                    current.append(f"Assistant:\n{text}")
    if current:
        turns.append("\n".join(current).strip())
    return turns


def split_by_tokens(text: str, encoding: Any, chunk_tokens: int, overlap_tokens: int) -> list[str]:
    if encoding is None:
        chunk_chars = chunk_tokens * 4
        if len(text) <= chunk_chars:
            return [text]
        step = max(1, (chunk_tokens - overlap_tokens) * 4)
        return [text[index : index + chunk_chars] for index in range(0, len(text), step)]
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


def chunk_turns(turns: list[str], encoding: Any) -> list[str]:
    units: list[tuple[str, int]] = []
    for index, turn in enumerate(turns, 1):
        parts = split_by_tokens(f"[Turn {index}]\n{turn}", encoding, MAX_CHUNK_TOKENS, CHUNK_OVERLAP_TOKENS)
        for part_index, part in enumerate(parts, 1):
            label = part if len(parts) == 1 else f"[Turn {index} · Part {part_index}/{len(parts)}]\n{part}"
            units.append((label, token_count(label, encoding)))
    chunks: list[str] = []
    current: list[tuple[str, int]] = []
    current_tokens = 0
    for text, tokens in units:
        if current and current_tokens + tokens > MAX_CHUNK_TOKENS:
            chunks.append("\n\n".join(item[0] for item in current).strip())
            current = current[-1:]
            current_tokens = sum(item[1] for item in current)
        current.append((text, tokens))
        current_tokens += tokens
    if current:
        chunks.append("\n\n".join(item[0] for item in current).strip())
    return [chunk for chunk in chunks if chunk.strip()]


def has_signal(text: str) -> bool:
    lowered = text.lower()
    if SIGNAL_RE.search(lowered):
        return True
    has_command = bool(COMMAND_RE.search(lowered))
    has_failure = any(token in lowered for token in ("fail", "failed", "error", "exception", "失败", "报错", "异常", "404", "401", "403", "429", "500"))
    has_api = bool(API_RE.search(lowered)) and has_failure
    has_fix = "```" in text and bool(FIX_RE.search(lowered))
    return (has_command and has_failure) or has_api or has_fix


def focus_chunk(chunk_text: str) -> str:
    lines = chunk_text.splitlines()
    if len(lines) <= 24:
        return chunk_text
    keep: set[int] = set()
    for index, line in enumerate(lines):
        if not has_signal(line):
            continue
        for offset in (-2, -1, 0, 1, 2):
            target = index + offset
            if 0 <= target < len(lines):
                keep.add(target)
    return "\n".join(lines[index] for index in sorted(keep)).strip() if keep else chunk_text


def truncate_for_prompt(text: str, encoding: Any, limit: int = 1600) -> str:
    if encoding is None:
        chars = limit * 4
        return text if len(text) <= chars else text[: chars - 120] + "\n\n[...trimmed...]\n\n" + text[-400:]
    tokens = encoding.encode(text)
    if len(tokens) <= limit:
        return text
    return encoding.decode(tokens[:1300]) + "\n\n[...trimmed...]\n\n" + encoding.decode(tokens[-300:])


def merge_requests(chunk_texts: list[str], encoding: Any) -> list[tuple[str, str]]:
    merged: list[tuple[str, str]] = []
    labels: list[str] = []
    parts: list[str] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal labels, parts, current_tokens
        if not parts:
            return
        label = labels[0] if len(labels) == 1 else f"{labels[0]}-{labels[-1]}"
        merged.append((label, "\n\n".join(parts).strip()))
        labels = []
        parts = []
        current_tokens = 0

    for index, chunk in enumerate(chunk_texts, 1):
        if not has_signal(chunk):
            flush()
            continue
        focused = focus_chunk(chunk)
        size = token_count(focused, encoding)
        if parts and current_tokens + size > MAP_REQUEST_MAX_TOKENS:
            flush()
        labels.append(str(index))
        parts.append(focused)
        current_tokens += size
    flush()
    return merged


def normalize_tag(tag: str) -> str:
    tag = tag.strip()
    if tag in ALLOWED_TAGS:
        return tag
    for allowed in TAG_ORDER:
        if tag in allowed or allowed in tag:
            return allowed
    return "其他"


def normalize_problem(problem: str) -> str:
    text = re.sub(r"\s+", "", problem.lower())
    return re.sub(r"[`~!@#$%^&*()_+=\[\]{}\\|;:'\",.<>/?，。！？；：“”‘’、·-]", "", text)


def compact_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        problem = str(row.get("problem", "")).strip()
        solution = str(row.get("solution", "")).strip()
        error = str(row.get("error", "")).strip()
        if not problem or not solution:
            continue
        tag = normalize_tag(str(row.get("tag", "其他")))
        key = (tag, normalize_problem(problem))
        current = grouped.get(key)
        if current is None:
            grouped[key] = {"problem": problem, "error": error, "solution": solution, "tag": tag, "count": int(row.get("count", 1) or 1)}
            continue
        current["count"] += int(row.get("count", 1) or 1)
        if not current["error"] and error:
            current["error"] = error
        if len(problem) > len(current["problem"]):
            current["problem"] = problem
        if len(solution) > len(current["solution"]):
            current["solution"] = solution
    return list(grouped.values())


def api_json(api_key: str, method: str, path: str, payload: dict[str, Any] | None = None, timeout: int = 600) -> dict[str, Any]:
    data = None
    headers = {"Authorization": f"Bearer {api_key}"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(OPENAI_BASE_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        text = response.read().decode("utf-8")
    return json.loads(text) if text else {}


def api_text(api_key: str, path: str, timeout: int = 600) -> str:
    request = urllib.request.Request(OPENAI_BASE_URL + path, headers={"Authorization": f"Bearer {api_key}"}, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def read_remote_text(api_key: str, value: str, timeout: int = 600) -> str:
    if value.startswith("http://") or value.startswith("https://"):
        request = urllib.request.Request(value, method="GET")
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8")
    return api_text(api_key, f"/files/{value}/content", timeout=timeout)


def upload_batch_file(api_key: str, path: Path) -> dict[str, Any]:
    boundary = f"----codex{int(time.time() * 1000)}"
    body = b"".join(
        [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\nbatch\r\n".encode(),
            (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
                "Content-Type: application/jsonl\r\n\r\n"
            ).encode()
            + path.read_bytes()
            + b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    request = urllib.request.Request(
        OPENAI_BASE_URL + "/files",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode("utf-8"))


def unwrap_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def parse_chat_content(body: dict[str, Any]) -> str:
    choices = body.get("choices", [])
    if not isinstance(choices, list) or not choices:
        return ""
    message = choices[0].get("message", {})
    return flatten_text(message.get("content")) if isinstance(message, dict) else ""


def rows_from_payload(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        payload = payload.get("items", [])
    if not isinstance(payload, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in payload:
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


def throttle_reduce() -> None:
    global _NEXT_REDUCE_AT
    now = time.monotonic()
    wait_seconds = max(0.0, _NEXT_REDUCE_AT - now)
    if wait_seconds > 0:
        time.sleep(wait_seconds)
        now = time.monotonic()
    _NEXT_REDUCE_AT = now + REDUCE_REQUEST_INTERVAL_SECONDS


def chat_json(api_key: str, model: str, system_prompt: str, user_prompt: str, context: str, max_tokens: int) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        "temperature": 0,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    attempts = 0
    while True:
        try:
            throttle_reduce()
            response = api_json(api_key, "POST", "/chat/completions", payload)
            return load_json_payload(parse_chat_content(response) or "{}")
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code == 429:
                wait_seconds = min(180, 30 * (2**attempts))
                attempts += 1
                log_error(f"{context}: reduce 429 wait={wait_seconds} body={body[:300]}")
                time.sleep(wait_seconds)
                continue
            log_error(f"{context}: HTTP {error.code}: {body[:300]}")
            raise
        except json.JSONDecodeError as exc:
            log_error(f"{context}: JSON 解析失败: {exc}")
            return {"items": []}


def reduce_group(api_key: str, tag: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payload = chat_json(
        api_key,
        REDUCE_MODEL,
        "你是编程知识库整理助手。只合并明显同义的重复问题，保留不同问题，只输出 JSON。",
        json.dumps(
            {
                "tag": tag,
                "task": "只合并明显重复的问题，不要过度归并。",
                "schema": {"items": [{"problem": "string", "error": "string", "solution": "string", "tag": "string"}]},
                "rules": ["至少保留 8 条或输入条数的一半，取较小值", "problem 和 solution 保持简短可执行"],
                "rows": rows,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        f"reduce:{tag}",
        REDUCE_MAX_TOKENS,
    )
    return rows_from_payload(payload)


def reduce_rows(api_key: str, tag: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    current = compact_rows(rows)
    if len(current) <= REDUCE_BATCH_SIZE:
        return reduce_group(api_key, tag, current)
    merged: list[dict[str, Any]] = []
    for index in range(0, len(current), REDUCE_BATCH_SIZE):
        merged.extend(reduce_group(api_key, tag, current[index : index + REDUCE_BATCH_SIZE]))
    return compact_rows(merged)


def render_markdown(rows_by_tag: dict[str, list[dict[str, Any]]]) -> str:
    lines: list[str] = []
    for tag in TAG_ORDER:
        rows = rows_by_tag.get(tag, [])
        if not rows:
            continue
        lines.extend([f"## {tag}", "| 问题 | 解法 |", "|---|---|"])
        for row in rows:
            problem = row["problem"].replace("|", "\\|").replace("\n", "<br>")
            solution = row["solution"].replace("|", "\\|").replace("\n", "<br>")
            lines.append(f"| {problem} | {solution} |")
        lines.append("")
    return ("\n".join(lines).strip() + "\n") if lines else ""


def collect_jsonl_files() -> list[Path]:
    files: list[Path] = []
    for directory in INPUT_DIRS:
        if directory.exists():
            files.extend(sorted(directory.rglob("*.jsonl")))
    return files


def fingerprint(path: Path) -> dict[str, Any]:
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
            if isinstance(entry, dict) and entry.get("file"):
                state[str(entry["file"])] = entry
    return state


def append_state(entry: dict[str, Any]) -> None:
    with STATE_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")


def cached_rows(files: list[Path]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    state = load_state()
    rows: list[dict[str, Any]] = []
    for path in files:
        entry = state.get(str(path))
        if entry and entry.get("fingerprint") == fingerprint(path):
            rows.extend(row for row in entry.get("rows", []) if isinstance(row, dict))
    return state, rows


def request_id(path: Path, file_fingerprint: dict[str, Any], chunk_label: str) -> str:
    raw = f"{path}|{file_fingerprint['size']}|{file_fingerprint['mtime_ns']}|{chunk_label}"
    return "map-" + hashlib.sha1(raw.encode()).hexdigest()


def write_batch_meta(meta: dict[str, Any]) -> None:
    BATCH_META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def load_batch_meta() -> dict[str, Any] | None:
    if not BATCH_META_FILE.exists():
        return None
    return json.loads(BATCH_META_FILE.read_text(encoding="utf-8"))


def clear_batch_files() -> None:
    for path in (BATCH_META_FILE, BATCH_INPUT_FILE, BATCH_OUTPUT_FILE, BATCH_ERROR_FILE):
        if path.exists():
            path.unlink()


def map_request_body(file_path: Path, chunk_label: str, chunk_total: int, chunk_text: str, encoding: Any) -> dict[str, Any]:
    prompt = truncate_for_prompt(chunk_text, encoding)
    return {
        "model": MAP_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "你是资深编程问题整理助手。只提取真实的编程、调试、构建、依赖、API 或环境问题。没有问题就返回空 items。只输出 JSON。",
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "task": "提取对话里的编程问题和解法，没有就返回空 items。",
                        "file": str(file_path),
                        "chunk": f"{chunk_label}/{chunk_total}",
                        "tags": TAG_ORDER,
                        "schema": {"items": [{"problem": "string", "error": "string", "solution": "string", "tag": "string"}]},
                        "rules": ["problem 不超过26字", "solution 不超过34字", "error 为空或不超过40字", "tag 只能从 tags 中选一个"],
                        "text": prompt,
                    },
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
            },
        ],
        "temperature": 0,
        "max_tokens": MAP_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }


def prepare_batch_requests(files: list[Path], state: dict[str, dict[str, Any]], encoding: Any) -> tuple[list[str], dict[str, Any]]:
    requests: list[str] = []
    meta_files: dict[str, Any] = {}
    total = len(files)
    for index, path in enumerate(files, 1):
        file_fingerprint = fingerprint(path)
        cached = state.get(str(path))
        if cached and cached.get("fingerprint") == file_fingerprint:
            print(f"[{index}/{total}] {path} cached extracted={len(cached.get('rows', []))}", flush=True)
            continue
        try:
            turns = parse_turns(path)
            if not turns or not has_signal("\n\n".join(turns)):
                entry = {"file": str(path), "fingerprint": file_fingerprint, "turn_count": len(turns), "chunk_count": 0, "analyzable_chunks": 0, "rows": [], "processed_at": now_text()}
                append_state(entry)
                state[str(path)] = entry
                print(f"[{index}/{total}] {path} extracted=0", flush=True)
                continue
            chunks = chunk_turns(turns, encoding)
            merged = merge_requests(chunks, encoding)
            if not merged:
                entry = {"file": str(path), "fingerprint": file_fingerprint, "turn_count": len(turns), "chunk_count": len(chunks), "analyzable_chunks": 0, "rows": [], "processed_at": now_text()}
                append_state(entry)
                state[str(path)] = entry
                print(f"[{index}/{total}] {path} chunks={len(chunks)} analyzable=0 extracted=0", flush=True)
                continue
            request_ids: list[str] = []
            for chunk_label, chunk_text in merged:
                custom_id = request_id(path, file_fingerprint, chunk_label)
                requests.append(
                    json.dumps(
                        {
                            "custom_id": custom_id,
                            "method": "POST",
                            "url": "/v1/chat/completions",
                            "body": map_request_body(path, chunk_label, len(merged), chunk_text, encoding),
                        },
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                )
                request_ids.append(custom_id)
            meta_files[str(path)] = {
                "fingerprint": file_fingerprint,
                "turn_count": len(turns),
                "chunk_count": len(chunks),
                "analyzable_chunks": len(merged),
                "request_ids": request_ids,
            }
            print(f"[{index}/{total}] {path} prepared analyzable={len(merged)}", flush=True)
        except Exception as exc:
            log_error(f"{path}: {exc}\n{traceback.format_exc()}")
            print(f"[{index}/{total}] {path} skipped: {exc}", flush=True)
    return requests, {"files": meta_files}


def submit_batch(api_key: str, requests: list[str], meta: dict[str, Any]) -> dict[str, Any]:
    if not requests:
        return meta
    BATCH_INPUT_FILE.write_text("\n".join(requests) + "\n", encoding="utf-8")
    uploaded = unwrap_data(upload_batch_file(api_key, BATCH_INPUT_FILE))
    input_file_id = str(uploaded.get("id", "")).strip()
    if not input_file_id:
        raise RuntimeError(f"upload batch input failed: {uploaded}")
    batch = api_json(api_key, "POST", "/batches", {"input_file_id": input_file_id, "endpoint": "/v1/chat/completions", "completion_window": "24h"})
    batch_id = str(batch.get("id", "")).strip()
    if not batch_id:
        raise RuntimeError(f"create batch failed: {batch}")
    meta.update({"batch_id": batch_id, "input_file_id": input_file_id, "request_count": len(requests), "submitted_at": now_text()})
    write_batch_meta(meta)
    print(f"batch_submitted id={batch_id} requests={len(requests)}", flush=True)
    return meta


def wait_batch(api_key: str, batch_id: str) -> dict[str, Any]:
    last_status = ""
    while True:
        batch = api_json(api_key, "GET", f"/batches/{batch_id}")
        status = str(batch.get("status", "")).strip()
        if status != last_status:
            print(f"batch_status id={batch_id} status={status}", flush=True)
            last_status = status
        if status == "completed":
            return batch
        if status in {"failed", "expired", "cancelled"}:
            raise RuntimeError(f"batch {batch_id} ended status={status}: {json.dumps(batch, ensure_ascii=False)}")
        time.sleep(BATCH_POLL_INTERVAL_SECONDS)


def load_batch_results(api_key: str, file_id: str | None, target: Path) -> dict[str, list[dict[str, Any]]]:
    if not file_id:
        return {}
    content = read_remote_text(api_key, str(file_id))
    target.write_text(content, encoding="utf-8")
    results: dict[str, list[dict[str, Any]]] = {}
    for line_no, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            entry = json.loads(stripped)
        except json.JSONDecodeError as exc:
            log_error(f"{target} line {line_no}: JSON 解析失败: {exc}")
            continue
        custom_id = str(entry.get("custom_id", "")).strip()
        if not custom_id:
            continue
        response = entry.get("response")
        if not isinstance(response, dict):
            if entry.get("error"):
                log_error(f"{custom_id}: batch error={json.dumps(entry.get('error'), ensure_ascii=False)}")
            continue
        status_code = int(response.get("status_code") or 200)
        body = response.get("body", {})
        if status_code >= 400:
            log_error(f"{custom_id}: batch status={status_code} body={json.dumps(body, ensure_ascii=False)[:300]}")
            results[custom_id] = []
            continue
        try:
            payload = load_json_payload(parse_chat_content(body if isinstance(body, dict) else {}) or "{}")
        except json.JSONDecodeError as exc:
            log_error(f"{custom_id}: JSON 解析失败: {exc}")
            results[custom_id] = []
            continue
        results[custom_id] = rows_from_payload(payload)
    return results


def apply_batch(files: list[Path], state: dict[str, dict[str, Any]], api_key: str, meta: dict[str, Any], batch: dict[str, Any]) -> list[dict[str, Any]]:
    outputs = load_batch_results(api_key, batch.get("output_file_id"), BATCH_OUTPUT_FILE)
    _ = load_batch_results(api_key, batch.get("error_file_id"), BATCH_ERROR_FILE)
    file_indexes = {str(path): index for index, path in enumerate(files, 1)}
    total = len(files)
    for file_path, file_meta in meta.get("files", {}).items():
        rows: list[dict[str, Any]] = []
        for custom_id in file_meta.get("request_ids", []):
            rows.extend(outputs.get(custom_id, []))
            if custom_id not in outputs:
                log_error(f"{custom_id}: batch missing output row")
        entry = {
            "file": file_path,
            "fingerprint": file_meta["fingerprint"],
            "turn_count": int(file_meta.get("turn_count", 0) or 0),
            "chunk_count": int(file_meta.get("chunk_count", 0) or 0),
            "analyzable_chunks": int(file_meta.get("analyzable_chunks", 0) or 0),
            "rows": compact_rows(rows),
            "processed_at": now_text(),
        }
        append_state(entry)
        state[file_path] = entry
        print(f"[{file_indexes.get(file_path, '?')}/{total}] {file_path} extracted={len(entry['rows'])}", flush=True)
    clear_batch_files()
    return cached_rows(files)[1]


def process_files(api_key: str, files: list[Path], encoding: Any) -> list[dict[str, Any]]:
    state, rows = cached_rows(files)
    while True:
        meta = load_batch_meta()
        if meta:
            batch = wait_batch(api_key, str(meta["batch_id"]))
            rows = apply_batch(files, state, api_key, meta, batch)
            state, rows = cached_rows(files)
            continue
        requests, meta = prepare_batch_requests(files, state, encoding)
        if not requests:
            return rows
        meta = submit_batch(api_key, requests, meta)
        batch = wait_batch(api_key, str(meta["batch_id"]))
        rows = apply_batch(files, state, api_key, meta, batch)
        return rows


def build_summary(api_key: str, rows: list[dict[str, Any]]) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in compact_rows(rows):
        grouped[normalize_tag(str(row.get("tag", "其他")))].append(row)
    reduced: dict[str, list[dict[str, Any]]] = {}
    for tag in TAG_ORDER:
        if tag not in grouped:
            continue
        reduced[tag] = sorted(reduce_rows(api_key, tag, grouped[tag]), key=lambda row: (-int(row.get("count", 1) or 1), row["problem"]))
    return render_markdown(reduced)


def main() -> int:
    parser = argparse.ArgumentParser(description="批量提取 Codex 对话中的编程问题与解法。")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    api_key, source = require_api_key()
    files = collect_jsonl_files()
    encoding = get_encoding()
    if args.workers != 1:
        print(f"workers_forced=1 requested={args.workers}", flush=True)
    print(f"input_files={len(files)} api_key_source={source} model={MAP_MODEL} workers=1 state_file={STATE_FILE.name}", flush=True)
    if not files:
        OUTPUT_FILE.write_text("", encoding="utf-8")
        print(f"written={OUTPUT_FILE} (no input files found)", flush=True)
        return 0
    rows = process_files(api_key, files, encoding)
    OUTPUT_FILE.write_text(build_summary(api_key, rows), encoding="utf-8")
    print(f"written={OUTPUT_FILE} rows={len(rows)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
