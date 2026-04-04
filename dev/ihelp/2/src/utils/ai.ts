/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from './constants'
import type { AISettings, ProjectData } from '../types/schema'

const JSON_SYSTEM_PROMPT = `你是线框图原型生成器。只输出符合要求的合法 JSON。
- 输出必须是单个 JSON 对象，不要 markdown，不要解释。
- JSON 结构必须包含 project、device、boardSize、boards。
- boards 内每个组件必须包含 id、type、name、x、y、width、height，可选 interactions。
- 组件类型只能使用 Header、TabBar、Card、List、Button、Input、Image、Text、Divider、Spacer、Icon、Modal。
- 使用当前设备尺寸进行定位，按从上到下的逻辑布局放置组件。
- 为每个组件提供语义化名称。
- 不要生成任何 interactions。`

const RESTORE_SYSTEM_PROMPT = `你是 React 还原器。请只输出纯 JavaScript 代码，不要 markdown。
要求：
- 定义 window.Wireframe = function Wireframe(){ ... }。
- 使用 React.createElement 渲染，不要 import。
- 视觉使用灰色圆角矩形和名称标签，保持 JSON 中的位置、尺寸和交互映射。
- 需要实现点击跳转、返回、显示弹窗的基础交互。`

async function requestChat(
  settings: AISettings,
  body: Record<string, unknown>,
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
    throw new Error(`AI 请求失败：${response.status} ${message}${traceId ? ` | trace: ${traceId}` : ''}`)
  }

  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = result.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('AI 未返回内容')
  }

  return content
}

export async function generateProjectFromPrompt(
  settings: AISettings,
  prompt: string,
  project: ProjectData,
) {
  return requestChat(settings, {
    model: settings.model || DEFAULT_AI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: JSON_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `项目名：${project.project}`,
          `设备：${project.device}`,
          `尺寸：${project.boardSize.width}x${project.boardSize.height}`,
          `需求：${prompt}`,
        ].join('\n'),
      },
    ],
  })
}

export async function generateRestoreCode(
  settings: AISettings,
  project: ProjectData,
) {
  return requestChat(settings, {
    model: settings.model || DEFAULT_AI_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: RESTORE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          '请根据以下 JSON 生成一个渲染此线框图原型的 React 组件。',
          '使用灰色矩形并标注与组件名称匹配的标签。',
          '保持精确的位置和尺寸。实现所有导航交互。',
          JSON.stringify(project, null, 2),
        ].join('\n'),
      },
    ],
  })
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
