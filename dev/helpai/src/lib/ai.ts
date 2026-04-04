/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type {
  AiExportBundle,
  LlmSettings,
  PrimitiveLayoutElement,
  Size,
} from '../types/prototype'

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  model: 'zai-org/GLM-4.6',
  temperature: 0.2,
  maxTokens: 4096,
}

function extractJson(text: string): unknown {
  const trimmed = text.trim()

  if (trimmed.startsWith('```')) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)

    if (match?.[1]) {
      return JSON.parse(match[1])
    }
  }

  return JSON.parse(trimmed)
}

async function createChatCompletion(
  settings: LlmSettings,
  payload: Record<string, unknown>,
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置中填写 SiliconFlow API Key。')
  }

  const response = await fetch(
    `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        ...payload,
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM 请求失败：${response.status} ${errorText}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = json.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('LLM 响应中没有可解析内容。')
  }

  return content
}

export async function generateWireframeElements(input: {
  description: string
  size: Size
  settings: LlmSettings
}): Promise<PrimitiveLayoutElement[]> {
  const systemPrompt =
    'You are a wireframe layout generator. Given a screen description, output a JSON array of primitive shapes that form a low-fidelity wireframe. Each element has: { type: "rect"|"circle"|"ellipse"|"line"|"text"|"image_placeholder", name: string (semantic English name like "login_button"), x: number, y: number, width: number, height: number, cornerRadius?: number, text?: string, fontSize?: number }. Use only simple geometric shapes. Coordinates are relative to a ' +
    `${input.size.width}x${input.size.height}` +
    ' artboard. Output valid JSON only, no explanation.'

  const content = await createChatCompletion(input.settings, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.description },
    ],
  })

  const parsed = extractJson(content)
  const rawElements = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { elements?: unknown[] }).elements)
      ? (parsed as { elements: unknown[] }).elements
      : []

  return rawElements.map((item) => {
    const element = item as Partial<PrimitiveLayoutElement>
    return {
      type: element.type ?? 'rect',
      name: element.name?.trim() || 'generated_element',
      x: Number(element.x ?? 24),
      y: Number(element.y ?? 24),
      width: Number(element.width ?? 120),
      height: Number(element.height ?? 80),
      cornerRadius: element.cornerRadius,
      text: element.text ?? '',
      fontSize: element.fontSize,
    }
  })
}

export async function requestAlignmentInterpretation(input: {
  settings: LlmSettings
  bundle: AiExportBundle
  markdown: string
}): Promise<unknown> {
  const prompt = [
    '根据此线框图规范，描述你将为每个页面构建的内容。',
    '列出每个元素的位置、尺寸、类型及所有交互/导航关系。',
    '以与输入格式匹配的结构化 JSON 输出。',
    '',
    JSON.stringify(input.bundle, null, 2),
    '',
    input.markdown,
  ].join('\n')

  const content = await createChatCompletion(input.settings, {
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You convert wireframe specifications into structured JSON. Return valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
  })

  return extractJson(content)
}
