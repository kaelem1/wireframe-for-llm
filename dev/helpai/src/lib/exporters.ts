/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type {
  AiExportArtifacts,
  AiExportBundle,
  ExportedElement,
  PrototypeBoard,
  PrototypeElement,
  PrototypeProject,
} from '../types/prototype'

function mapInteractionTarget(
  interaction: PrototypeElement['interactions'][number],
): string | null {
  if (interaction.action === 'navigateTo') {
    return interaction.targetBoardId
  }

  if (interaction.action === 'showHide') {
    return interaction.targetElementId
  }

  return null
}

function exportElement(element: PrototypeElement): ExportedElement {
  return {
    id: element.id,
    name: element.name,
    type: element.type,
    x: Math.round(element.x),
    y: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
    cornerRadius: element.cornerRadius || undefined,
    label: element.text || undefined,
    fontSize: element.fontSize || undefined,
    interactions: element.interactions.map((interaction) => ({
      trigger: 'onClick',
      action: interaction.action,
      target: mapInteractionTarget(interaction),
    })),
  }
}

function describeElement(board: PrototypeBoard, element: PrototypeElement): string {
  const content = element.text ? `，文本“${element.text}”` : ''
  const centered = Math.abs(element.x + element.width / 2 - board.width / 2) <= board.width * 0.08
  const position = centered
    ? `接近水平居中，y=${Math.round(element.y)}`
    : `x=${Math.round(element.x)}, y=${Math.round(element.y)}`

  return `- "${element.name}"（${element.type}${content}，${Math.round(element.width)}×${Math.round(element.height)}，${position}）`
}

function describeInteraction(
  boards: PrototypeProject['boards'],
  element: PrototypeElement,
): string[] {
  return element.interactions.map((interaction) => {
    if (interaction.action === 'navigateTo' && interaction.targetBoardId) {
      const target = boards.find((board) => board.id === interaction.targetBoardId)
      return `- 点击 "${element.name}" → 跳转到 "${target?.name ?? interaction.targetBoardId}"`
    }

    if (interaction.action === 'goBack') {
      return `- 点击 "${element.name}" → 返回上一页`
    }

    if (interaction.action === 'toggleState') {
      return `- 点击 "${element.name}" → 切换自身状态`
    }

    if (interaction.action === 'showHide' && interaction.targetElementId) {
      const target = boards
        .flatMap((board) => board.elements)
        .find((candidate) => candidate.id === interaction.targetElementId)
      return `- 点击 "${element.name}" → 显示/隐藏 "${target?.name ?? interaction.targetElementId}"`
    }

    return `- 点击 "${element.name}" → ${interaction.action}`
  })
}

export function buildAiExport(project: PrototypeProject): AiExportBundle {
  const screens = project.boards.map((board) => ({
    id: board.id,
    name: board.name,
    elements: board.elements.map((element) => exportElement(element)),
  }))

  const navigationFlow = project.boards.flatMap((board) =>
    board.elements.flatMap((element) =>
      element.interactions.map((interaction) => ({
        from: board.id,
        element: element.name,
        action: interaction.action,
        to: mapInteractionTarget(interaction),
      })),
    ),
  )

  return {
    project: {
      name: project.name,
      deviceType: project.deviceType,
      artboardSize: project.artboardSize,
    },
    screens,
    navigationFlow,
  }
}

export function buildAiPromptMarkdown(project: PrototypeProject): string {
  return project.boards
    .map((board) => {
      const layoutLines =
        board.elements.length > 0
          ? board.elements.map((element) => describeElement(board, element))
          : ['- 当前画板为空']
      const interactionLines = board.elements.flatMap((element) =>
        describeInteraction(project.boards, element),
      )

      return [
        `## Screen: ${board.name} (${board.width}×${board.height})`,
        'Layout:',
        ...layoutLines,
        '',
        'Interactions:',
        ...(interactionLines.length > 0 ? interactionLines : ['- 无已配置交互']),
      ].join('\n')
    })
    .join('\n\n')
}

export function buildAiArtifacts(project: PrototypeProject): AiExportArtifacts {
  return {
    json: buildAiExport(project),
    markdown: buildAiPromptMarkdown(project),
  }
}
