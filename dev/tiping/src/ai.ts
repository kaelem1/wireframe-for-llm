/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import type {
  AiExportPayload,
  AiPrimitiveShape,
  ArtboardSize,
  LlmSettings
} from "./types";

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function stripJsonFence(raw: string): string {
  return raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

async function requestJson(
  settings: LlmSettings,
  system: string,
  user: string
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("请先在设置中填写 API Key。");
  }

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`LLM 请求失败：${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 未返回内容。");
  }

  return stripJsonFence(content);
}

export async function generateWireframe(
  settings: LlmSettings,
  description: string,
  size: ArtboardSize
): Promise<AiPrimitiveShape[]> {
  const system =
    "You are a wireframe layout generator. Given a screen description, output a JSON array of primitive shapes that form a low-fidelity wireframe. Each element has: { type: \"rect\"|\"circle\"|\"ellipse\"|\"line\"|\"text\"|\"image_placeholder\", name: string (semantic English name like \"login_button\"), x: number, y: number, width: number, height: number, cornerRadius?: number, text?: string, fontSize?: number }. Use only simple geometric shapes. Coordinates are relative to a {width}x{height} artboard. Output valid JSON only, no explanation.";

  const user = `Artboard size: ${size.width}x${size.height}\nDescription: ${description}`;
  const raw = await requestJson(settings, system, user);
  const data = JSON.parse(raw) as AiPrimitiveShape[] | { items?: AiPrimitiveShape[] };

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  throw new Error("AI 生成结果不是有效数组。");
}

export async function interpretWireframeForAlignment(
  settings: LlmSettings,
  payload: AiExportPayload,
  markdown: string
): Promise<unknown> {
  const system =
    "You receive a wireframe JSON export and a synchronized markdown description. Describe the wireframe back as structured JSON matching the input format. Output JSON only.";
  const user = [
    "根据此线框图规范，描述你将为每个页面构建的内容。",
    "列出每个元素的位置、尺寸、类型及所有交互/导航关系。",
    "以与输入格式匹配的结构化 JSON 输出。",
    "",
    "JSON:",
    JSON.stringify(payload, null, 2),
    "",
    "Markdown:",
    markdown
  ].join("\n");

  const raw = await requestJson(settings, system, user);
  return JSON.parse(raw);
}
