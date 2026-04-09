/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前按 locale 输出 AI 面板错误与提示词文案，并让还原结果优先遵循手绘语义而非机械对齐坐标
3. 更新后检查所属 `.folder.md`
*/

import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from './constants'
import { DEFAULT_LOCALE, t } from './i18n'
import type { AISettings, Locale, ProjectData } from '../types/schema'

function getJsonSystemPrompt(locale: Locale) {
  if (locale === 'zh') {
    return `你是线框图原型生成器。只输出符合要求的合法 JSON。
- 输出必须是单个 JSON 对象，不要 markdown，不要解释。
- JSON 结构必须包含 project、device、boardSize、boards。
- boards 内每个组件必须包含 id、type、name、x、y、width、height，可选 interactions。
- 组件类型只能使用 Header、TabBar、Card、List、Button、Input、Image、Text、Divider、Spacer、Icon、Modal。
- 使用当前设备尺寸进行定位，按从上到下的逻辑布局放置组件。
- 为每个组件提供语义化名称。
- 不要生成任何 interactions。`
  }

  return `You are a wireframe prototype generator. Output valid JSON only.
- Return a single JSON object with no markdown or explanation.
- The JSON must contain project, device, boardSize, and boards.
- Every component inside boards must include id, type, name, x, y, width, and height, with optional interactions.
- Allowed component types are Header, TabBar, Card, List, Button, Input, Image, Text, Divider, Spacer, Icon, and Modal.
- Position components using the current device size and lay them out from top to bottom.
- Give each component a semantic name.
- Do not generate any interactions.`
}

function getRestoreSystemPrompt(locale: Locale) {
  if (locale === 'zh') {
    return `你是 React 还原器。请只输出纯 JavaScript 代码，不要 markdown。
要求：
- 定义 window.Wireframe = function Wireframe(){ ... }。
- 使用 React.createElement 渲染，不要 import。
- 视觉使用灰色圆角矩形和名称标签，优先还原信息架构与交互语义，位置尺寸只作近似参考。
- 不要输出 emoji 符号。
- 需要实现点击跳转、返回、显示弹窗的基础交互。`
  }

  return `You are a React recreator. Output plain JavaScript only, with no markdown.
Requirements:
- Define window.Wireframe = function Wireframe(){ ... }.
- Use React.createElement for rendering and do not import anything.
- Use gray rounded rectangles and labels, prioritizing information architecture and interaction semantics over exact positions and sizes.
- Do not output emoji symbols.
- Implement basic navigate, back, and show-modal interactions.`
}

async function requestChat(
  settings: AISettings,
  body: Record<string, unknown>,
  locale: Locale,
) {
  const baseUrl = (settings.baseUrl || DEFAULT_AI_BASE_URL).replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const traceId = response.headers.get('x-siliconcloud-trace-id')
    const message = await response.text()
    throw new Error(
      `${t(locale, 'aiRequestFailed')}: ${response.status} ${message}${traceId ? ` | trace: ${traceId}` : ''}`,
    )
  }

  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = result.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error(t(locale, 'aiEmptyResponse'))
  }

  return content
}

export async function generateProjectFromPrompt(
  settings: AISettings,
  prompt: string,
  project: ProjectData,
  locale: Locale = DEFAULT_LOCALE,
) {
  return requestChat(settings, {
    model: settings.model || DEFAULT_AI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: getJsonSystemPrompt(locale) },
      {
        role: 'user',
        content:
          locale === 'zh'
            ? [
                `项目名：${project.project}`,
                `设备：${project.device}`,
                `尺寸：${project.boardSize.width}x${project.boardSize.height}`,
                `需求：${prompt}`,
              ].join('\n')
            : [
                `Project: ${project.project}`,
                `Device: ${project.device}`,
                `Size: ${project.boardSize.width}x${project.boardSize.height}`,
                `Request: ${prompt}`,
              ].join('\n'),
      },
    ],
  }, locale)
}

export async function generateRestoreCode(
  settings: AISettings,
  project: ProjectData,
  locale: Locale = DEFAULT_LOCALE,
) {
  return requestChat(settings, {
    model: settings.model || DEFAULT_AI_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: getRestoreSystemPrompt(locale) },
      {
        role: 'user',
        content:
          locale === 'zh'
            ? [
                '请根据以下 JSON 生成一个渲染此线框图原型的 React 组件。',
                '使用灰色矩形并标注与组件名称匹配的标签。',
                '优先还原信息架构与交互，位置和尺寸仅作近似参考；实现所有导航交互，且不要输出 emoji。',
                JSON.stringify(project, null, 2),
              ].join('\n')
            : [
                'Generate a React component that renders the following wireframe JSON.',
                'Use gray rectangles with labels that match each component name.',
                'Prioritize information architecture and interactions, treat position and size as loose references, and do not output emoji.',
                JSON.stringify(project, null, 2),
              ].join('\n'),
      },
    ],
  }, locale)
}

export function createRestoreIframeHtml(source: string) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #root { margin: 0; width: 100%; height: 100%; background: #111827; color: white; font-family: sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script>
      try {
        ${source}
        const root = ReactDOM.createRoot(document.getElementById('root'))
        root.render(React.createElement(window.Wireframe))
      } catch (error) {
        document.getElementById('root').innerHTML = '<pre style="padding:16px;white-space:pre-wrap;">' + String(error) + '</pre>'
      }
    </script>
  </body>
</html>`
}
