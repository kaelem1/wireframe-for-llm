/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type {
  PreviewSession,
  PrototypeElement,
  PrototypeProject,
} from '../types/prototype'

function findElement(project: PrototypeProject, elementId: string): PrototypeElement | null {
  return (
    project.boards
      .flatMap((board) => board.elements)
      .find((element) => element.id === elementId) ?? null
  )
}

export function createPreviewSession(
  project: PrototypeProject,
  boardId?: string | null,
): PreviewSession {
  return {
    currentBoardId: boardId ?? project.boards[0]?.id ?? '',
    history: [],
    direction: 'idle',
    visibility: {},
    toggled: {},
  }
}

export function resolvePreviewElement(
  session: PreviewSession,
  element: PrototypeElement,
): PrototypeElement {
  const visible = session.visibility[element.id] ?? element.visible
  const toggled = session.toggled[element.id] ?? false

  if (!toggled) {
    return {
      ...element,
      visible,
    }
  }

  return {
    ...element,
    visible,
    fill: element.stateStyle.fill ?? element.fill,
    stroke: element.stateStyle.stroke ?? element.stroke,
    strokeWidth: element.stateStyle.strokeWidth ?? element.strokeWidth,
    opacity: element.stateStyle.opacity ?? element.opacity,
  }
}

export function applyPreviewElementInteractions(
  project: PrototypeProject,
  session: PreviewSession,
  element: PrototypeElement,
): PreviewSession {
  return element.interactions.reduce<PreviewSession>((current, interaction) => {
    if (interaction.action === 'navigateTo' && interaction.targetBoardId) {
      if (interaction.targetBoardId === current.currentBoardId) {
        return current
      }

      return {
        ...current,
        history: [...current.history, current.currentBoardId],
        currentBoardId: interaction.targetBoardId,
        direction: 'forward',
      }
    }

    if (interaction.action === 'goBack') {
      const previousBoardId = current.history[current.history.length - 1]

      if (!previousBoardId) {
        return current
      }

      return {
        ...current,
        history: current.history.slice(0, -1),
        currentBoardId: previousBoardId,
        direction: 'backward',
      }
    }

    if (interaction.action === 'toggleState') {
      return {
        ...current,
        toggled: {
          ...current.toggled,
          [element.id]: !(current.toggled[element.id] ?? false),
        },
      }
    }

    if (interaction.action === 'showHide' && interaction.targetElementId) {
      const target = findElement(project, interaction.targetElementId)
      const currentValue =
        current.visibility[interaction.targetElementId] ?? target?.visible ?? true

      return {
        ...current,
        visibility: {
          ...current.visibility,
          [interaction.targetElementId]: !currentValue,
        },
      }
    }

    return current
  }, session)
}

export function clearPreviewDirection(session: PreviewSession): PreviewSession {
  return {
    ...session,
    direction: 'idle',
  }
}
