/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { AIConfig, ProjectDocument } from '../types/schema'

interface JsonCompletionOptions {
  config: AIConfig
  systemPrompt: string
  userPrompt: string
  temperature?: number
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

export async function requestJsonCompletion<T>({
  config,
  systemPrompt,
  userPrompt,
  temperature = 0,
}: JsonCompletionOptions): Promise<T> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error('请先在设置中填写 Base URL、API Key 和模型名称')
  }

  const response = await fetch(`${trimBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      temperature,
      stream: false,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM 请求失败：${response.status} ${await response.text()}`)
  }

  const payload = (await response.json()) as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('LLM 未返回内容')
  }

  return JSON.parse(content) as T
}

export function buildAIGenerationSystemPrompt(project: ProjectDocument): string {
  return [
    '你是线框图原型 JSON 生成器。',
    '只输出合法 JSON 对象，不要输出解释、Markdown 或代码块。',
    '输出字段必须严格匹配：project, device, boardSize, boards。',
    'boards[] 中每一项必须有 id, name, components。',
    'components[] 中每一项必须有 id, type, name, x, y, width, height。',
    '本任务不要添加任何 interactions。',
    '不要输出解释、Markdown、代码块或额外字段。',
    `device 必须写为 ${project.device}。`,
    `project 必须写为 ${project.project}。`,
    `固定画板尺寸为 ${project.boardSize.width}x${project.boardSize.height}。`,
    '只使用这些组件类型：Header, TabBar, Card, List, Button, Input, Image, Text, Divider, Spacer, Icon, Modal。',
    '按从上到下的布局流摆放组件，名称必须是语义化中文名称。',
  ].join('\n')
}

export function buildAIRestoreSystemPrompt(project: ProjectDocument): string {
  return [
    '你是 React 原型还原器。',
    '输出 JSON 对象，只有一个字段 code。',
    'code 必须是浏览器可执行的 JSX 代码，定义函数 GeneratedPrototype() 并用 ReactDOM.createRoot 挂载到 id 为 root 的节点。',
    '不要写 import 或 export 语句，不要输出 Markdown 代码块。',
    '界面使用浅灰背景与灰色圆角矩形，标签使用组件 name，位置和尺寸必须精确。',
    '需要实现 navigate/back/showModal 交互。',
    `设备尺寸固定为 ${project.boardSize.width}x${project.boardSize.height}。`,
  ].join('\n')
}
