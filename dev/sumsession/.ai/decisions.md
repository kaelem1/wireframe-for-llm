## 决策
API key 只读 `OPENAI_API_KEY`，运行层可映射 `SILICONFLOW_API_KEY`；`base_url` 固定为 SiliconFlow；模型用 `Qwen/Qwen2.5-7B-Instruct`；Map 只放强故障信号片段并做同文件合并；本地 JSON 修整，不再走 LLM repair-json；Reduce 用小批次保留多样性；单 worker，2 秒节流。
