/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type {
  DeviceType,
  ElementType,
  PrimitiveLayoutElement,
  ProjectSnapshot,
  PrototypeBoard,
  PrototypeElement,
  PrototypeInteraction,
  PrototypeProject,
  Size,
} from '../types/prototype'

const GRID_SIZE = 8
const HISTORY_LIMIT = 50
let idCounter = 0

export function createId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

export function createInteraction(): PrototypeInteraction {
  return {
    id: createId('interaction'),
    trigger: 'onClick',
    action: 'navigateTo',
    targetBoardId: null,
    targetElementId: null,
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function snapToGrid(value: number, enabled = true): number {
  if (!enabled) {
    return Math.round(value)
  }

  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

function getTypeSize(type: ElementType): Size {
  switch (type) {
    case 'rect':
      return { width: 160, height: 72 }
    case 'circle':
      return { width: 96, height: 96 }
    case 'ellipse':
      return { width: 144, height: 96 }
    case 'line':
      return { width: 160, height: 0 }
    case 'text':
      return { width: 180, height: 40 }
    case 'image_placeholder':
      return { width: 120, height: 120 }
    default:
      return { width: 120, height: 80 }
  }
}

function getDefaultText(type: ElementType): string {
  if (type === 'text') {
    return '文本'
  }

  return ''
}

function getDefaultFontSize(type: ElementType): number {
  if (type === 'text') {
    return 16
  }

  return 14
}

function getDefaultStateStyle(fill: string): PrototypeElement['stateStyle'] {
  return {
    fill: fill === '#111827' ? '#475569' : '#111827',
    stroke: '#0f172a',
    opacity: 1,
  }
}

export function getDefaultElementName(
  board: PrototypeBoard,
  type: ElementType,
): string {
  const index = board.elements.filter((element) => element.type === type).length + 1
  return `${type}_${index}`
}

export function constrainElement(
  element: PrototypeElement,
  board: PrototypeBoard,
): PrototypeElement {
  const width = Math.max(24, Math.round(element.width))
  const height =
    element.type === 'line'
      ? Math.round(element.height)
      : Math.max(24, Math.round(element.height))

  const maxX = Math.max(0, board.width - width)
  const maxY = Math.max(0, board.height - Math.max(24, Math.abs(height)))

  return {
    ...element,
    width,
    height,
    x: clamp(Math.round(element.x), 0, maxX),
    y: clamp(Math.round(element.y), 0, maxY),
    cornerRadius: clamp(Math.round(element.cornerRadius), 0, 20),
    opacity: clamp(Number(element.opacity), 0, 1),
    fontSize: clamp(Math.round(element.fontSize), 12, 32),
  }
}

export function createElement(
  board: PrototypeBoard,
  type: ElementType,
  point: { x: number; y: number },
  overrides: Partial<PrototypeElement> = {},
): PrototypeElement {
  const size = getTypeSize(type)
  const fill =
    overrides.fill ??
    (type === 'text' ? 'transparent' : type === 'image_placeholder' ? '#e5e7eb' : '#ffffff')
  const stroke =
    overrides.stroke ??
    (type === 'text' ? 'transparent' : type === 'line' ? '#64748b' : '#94a3b8')
  const strokeWidth = overrides.strokeWidth ?? (type === 'line' ? 2 : 1)

  const draft: PrototypeElement = {
    id: createId('element'),
    name: overrides.name ?? getDefaultElementName(board, type),
    type,
    x: point.x,
    y: point.y,
    width: overrides.width ?? size.width,
    height: overrides.height ?? size.height,
    fill,
    stroke,
    strokeWidth,
    cornerRadius: overrides.cornerRadius ?? (type === 'rect' ? 8 : 0),
    opacity: overrides.opacity ?? 1,
    text: overrides.text ?? getDefaultText(type),
    fontSize: overrides.fontSize ?? getDefaultFontSize(type),
    visible: overrides.visible ?? true,
    interactions: overrides.interactions ?? [],
    stateStyle: overrides.stateStyle ?? getDefaultStateStyle(fill),
  }

  return constrainElement(draft, board)
}

export function cloneElement(
  board: PrototypeBoard,
  element: PrototypeElement,
): PrototypeElement {
  return createElement(
    board,
    element.type,
    { x: element.x + 16, y: element.y + 16 },
    {
      ...structuredClone(element),
      id: createId('element'),
      name: `${element.name}_copy`,
      interactions: structuredClone(element.interactions).map((interaction) => ({
        ...interaction,
        id: createId('interaction'),
      })),
    },
  )
}

export function createBoard(
  size: Size,
  name = '首页',
  elements: PrimitiveLayoutElement[] = [],
): PrototypeBoard {
  const board: PrototypeBoard = {
    id: createId('screen'),
    name,
    width: size.width,
    height: size.height,
    elements: [],
  }

  board.elements = elements.map((element) =>
    createElement(board, element.type, { x: element.x, y: element.y }, element),
  )

  return board
}

export function createProject(input: {
  name: string
  deviceType: DeviceType
  artboardSize: Size
}): PrototypeProject {
  const now = new Date().toISOString()
  const project: PrototypeProject = {
    id: createId('project'),
    name: input.name.trim() || '未命名项目',
    deviceType: input.deviceType,
    artboardSize: input.artboardSize,
    boards: [createBoard(input.artboardSize, '首页')],
    createdAt: now,
    updatedAt: now,
    history: {
      past: [],
      future: [],
    },
  }

  return project
}

export function snapshotProject(project: PrototypeProject): ProjectSnapshot {
  const snapshot = structuredClone(project) as PrototypeProject
  delete (snapshot as Partial<PrototypeProject>).history
  return snapshot
}

export function duplicateProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  const boardIdMap = new Map<string, string>()
  const elementIdMap = new Map<string, string>()

  snapshot.boards.forEach((board) => {
    boardIdMap.set(board.id, createId('screen'))
    board.elements.forEach((element) => {
      elementIdMap.set(element.id, createId('element'))
    })
  })

  const nextBoards = snapshot.boards.map((board) => ({
    ...structuredClone(board),
    id: boardIdMap.get(board.id) ?? createId('screen'),
    elements: board.elements.map((element) => ({
      ...structuredClone(element),
      id: elementIdMap.get(element.id) ?? createId('element'),
      interactions: element.interactions.map((interaction) => ({
        ...interaction,
        id: createId('interaction'),
        targetBoardId: interaction.targetBoardId
          ? (boardIdMap.get(interaction.targetBoardId) ?? null)
          : null,
        targetElementId: interaction.targetElementId
          ? (elementIdMap.get(interaction.targetElementId) ?? null)
          : null,
      })),
    })),
  }))

  const now = new Date().toISOString()

  return {
    ...structuredClone(snapshot),
    id: createId('project'),
    name: `${snapshot.name} 副本`,
    boards: nextBoards,
    createdAt: now,
    updatedAt: now,
  }
}

export function restoreProject(
  snapshot: ProjectSnapshot,
  past: ProjectSnapshot[],
  future: ProjectSnapshot[],
): PrototypeProject {
  return {
    ...structuredClone(snapshot),
    history: {
      past: past.slice(-HISTORY_LIMIT),
      future: future.slice(0, HISTORY_LIMIT),
    },
  }
}

export function normalizeImportedProject(payload: unknown): PrototypeProject {
  if (!payload || typeof payload !== 'object') {
    throw new Error('导入文件格式无效。')
  }

  const raw = payload as Partial<ProjectSnapshot> & {
    history?: PrototypeProject['history']
  }

  if (!raw.artboardSize || !raw.boards?.length) {
    throw new Error('项目缺少画板信息。')
  }

  const snapshot: ProjectSnapshot = {
    id: raw.id ?? createId('project'),
    name: raw.name?.trim() || '导入项目',
    deviceType: raw.deviceType ?? 'custom',
    artboardSize: raw.artboardSize,
    boards: raw.boards.map((board, boardIndex) => {
      const draft: PrototypeBoard = {
        id: board.id ?? createId('screen'),
        name: board.name?.trim() || `画板 ${boardIndex + 1}`,
        width: board.width ?? raw.artboardSize!.width,
        height: board.height ?? raw.artboardSize!.height,
        elements: [],
      }

      draft.elements = (board.elements ?? []).map((element, elementIndex) =>
        createElement(
          draft,
          element.type ?? 'rect',
          { x: element.x ?? 24, y: element.y ?? 24 },
          {
            ...element,
            id: element.id ?? createId('element'),
            name:
              element.name?.trim() ||
              `${element.type ?? 'rect'}_${elementIndex + 1}`,
            interactions: (element.interactions ?? []).map((interaction) => ({
              id: interaction.id ?? createId('interaction'),
              trigger: 'onClick',
              action: interaction.action ?? 'navigateTo',
              targetBoardId: interaction.targetBoardId ?? null,
              targetElementId: interaction.targetElementId ?? null,
            })),
          },
        ),
      )

      return draft
    }),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  }

  return {
    ...snapshot,
    history: {
      past: raw.history?.past ?? [],
      future: raw.history?.future ?? [],
    },
  }
}

export function pushHistory(
  project: PrototypeProject,
  snapshot: ProjectSnapshot,
): PrototypeProject {
  return {
    ...project,
    history: {
      past: [...project.history.past.slice(-(HISTORY_LIMIT - 1)), snapshot],
      future: [],
    },
  }
}

export function updateProjectTimestamp(project: PrototypeProject): PrototypeProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
  }
}
