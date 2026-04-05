/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前包含项目导出扩展与最小布局语义派生
3. 更新后检查所属 `.folder.md`
*/

import {
  COMPONENT_META_MAP,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEVICE_OPTIONS,
  GRID_SIZE,
  STORAGE_KEY,
} from './constants'
import type {
  AISettings,
  Board,
  BoardSize,
  ComponentType,
  DevicePreset,
  ExportBoard,
  ExportComponentLayout,
  ExportProjectData,
  PersistedState,
  ProjectData,
  ProtoComponent,
} from '../types/schema'

const EXPORT_INSTRUCTION =
  '请先补充应用类型，再还原这种布局；如项目内无前端内容，请输出 html，并基于这个布局做一个应用原型。'

export function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`
}

export function snap(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getDeviceSize(device: DevicePreset, custom?: BoardSize) {
  if (device === 'Custom' && custom) {
    return {
      width: Math.max(200, custom.width),
      height: Math.max(200, custom.height),
    }
  }

  return DEVICE_OPTIONS.find((item) => item.id === device)?.size ?? DEVICE_OPTIONS[0].size
}

export function createBoard(name: string): Board {
  return {
    id: createId('board'),
    name,
    components: [],
  }
}

export function createProject(
  projectName: string,
  device: DevicePreset,
  customBoardSize?: BoardSize,
): ProjectData {
  const boardSize = getDeviceSize(device, customBoardSize)
  const board = createBoard('首页')

  return {
    project: projectName,
    device,
    boardSize,
    boards: [board],
  }
}

export function exportProjectJson(project: ProjectData) {
  const exported: ExportProjectData = {
    ...project,
    instruction: EXPORT_INSTRUCTION,
    boards: project.boards.map<ExportBoard>((board) => ({
      ...board,
      layout: { axis: 'vertical' },
      components: board.components.map((component) => ({
        ...component,
        layout: getExportComponentLayout(component),
      })),
    })),
  }

  return JSON.stringify(exported, null, 2)
}

export function createDefaultSettings(): AISettings {
  return {
    baseUrl: DEFAULT_AI_BASE_URL,
    apiKey: '',
    model: DEFAULT_AI_MODEL,
  }
}

function getBoardFlowBottom(board: Board) {
  return board.components.reduce((max, item) => {
    const meta = COMPONENT_META_MAP[item.type]
    if (meta.anchor === 'bottom') {
      return max
    }

    return Math.max(max, item.y + item.height)
  }, 0)
}

function getExportComponentLayout(component: ProtoComponent): ExportComponentLayout {
  const meta = COMPONENT_META_MAP[component.type]

  return {
    placement:
      component.type === 'Modal'
        ? 'overlay'
        : meta.anchor ?? (meta.centered ? 'center' : 'flow'),
    width: meta.fullWidth ? 'full' : 'fixed',
  }
}

export function createComponent(
  type: ComponentType,
  board: Board,
  boardSize: BoardSize,
  dropPosition?: { x: number; y: number },
): ProtoComponent {
  const meta = COMPONENT_META_MAP[type]
  const width = meta.fullWidth ? boardSize.width : Math.min(meta.defaultWidth, boardSize.width)
  const height = meta.defaultHeight
  const nextY = clamp(snap(getBoardFlowBottom(board) + GRID_SIZE), 0, boardSize.height - height)

  let x = meta.fullWidth ? 0 : meta.centered ? snap((boardSize.width - width) / 2) : GRID_SIZE * 2
  let y = meta.anchor === 'top' ? 0 : meta.anchor === 'bottom' ? boardSize.height - height : nextY

  if (type === 'Modal') {
    x = snap((boardSize.width - width) / 2)
    y = snap((boardSize.height - height) / 2)
  }

  if (dropPosition && !meta.anchor && type !== 'Modal') {
    x = meta.fullWidth ? 0 : clamp(snap(dropPosition.x), 0, boardSize.width - width)
    y = clamp(snap(dropPosition.y), 0, boardSize.height - height)
  }

  return {
    id: createId('comp'),
    type,
    name: meta.label,
    x,
    y,
    width,
    height,
    interactions: [],
  }
}

export function normalizeComponent(component: ProtoComponent, boardSize: BoardSize): ProtoComponent {
  const meta = COMPONENT_META_MAP[component.type]
  const width = meta.fullWidth
    ? boardSize.width
    : clamp(component.width, meta.minWidth, boardSize.width)
  const height = clamp(component.height, meta.minHeight, boardSize.height)
  const maxX = Math.max(0, boardSize.width - width)
  const maxY = Math.max(0, boardSize.height - height)

  let x = clamp(snap(component.x), 0, maxX)
  let y = clamp(snap(component.y), 0, maxY)

  if (meta.anchor === 'top') {
    x = 0
    y = 0
  }

  if (meta.anchor === 'bottom') {
    x = 0
    y = boardSize.height - height
  }

  if (component.type === 'Modal') {
    x = clamp(snap(component.x), 0, maxX)
    y = clamp(snap(component.y), 0, maxY)
  }

  return {
    ...component,
    width,
    height,
    x,
    y,
  }
}

export function duplicateComponent(component: ProtoComponent, boardSize: BoardSize): ProtoComponent {
  return normalizeComponent(
    {
      ...component,
      id: createId('comp'),
      name: `${component.name} 副本`,
      x: component.x + GRID_SIZE * 2,
      y: component.y + GRID_SIZE * 2,
      interactions: component.interactions.map((item) => ({
        ...item,
        id: createId('interaction'),
      })),
    },
    boardSize,
  )
}

export function getBoardById(project: ProjectData, boardId: string) {
  return project.boards.find((board) => board.id === boardId)
}

export function findComponentById(project: ProjectData, componentId: string) {
  for (const board of project.boards) {
    const index = board.components.findIndex((component) => component.id === componentId)
    if (index >= 0) {
      return {
        board,
        boardId: board.id,
        component: board.components[index],
        index,
      }
    }
  }

  return null
}

export function getNextBoardName(project: ProjectData) {
  return `画板${project.boards.length + 1}`
}

export function normalizeComponentFrame(
  type: ComponentType,
  frame: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  boardSize: BoardSize,
) {
  const component = normalizeComponent(
    {
      id: 'temp',
      type,
      name: '',
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      interactions: [],
    },
    boardSize,
  )

  return {
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  }
}

export function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)

  if (!moved) {
    return next
  }

  next.splice(toIndex, 0, moved)
  return next
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function parseProjectJson(text: string): ProjectData {
  const raw = JSON.parse(text) as Partial<ProjectData>

  if (!raw.project || !raw.device || !raw.boardSize || !Array.isArray(raw.boards)) {
    throw new Error('JSON 结构不符合项目格式')
  }

  const boardSize: BoardSize = {
    width: raw.boardSize.width,
    height: raw.boardSize.height,
  }

  return {
    project: raw.project,
    device: raw.device,
    boardSize,
    boards: raw.boards.map((board, boardIndex) => ({
      id: board.id ?? createId(`board-${boardIndex}`),
      name: board.name ?? `画板${boardIndex + 1}`,
      components: (board.components ?? []).map((component) =>
        normalizeComponent(
          {
            id: component.id ?? createId('comp'),
            type: component.type,
            name: component.name ?? COMPONENT_META_MAP[component.type].label,
            x: component.x ?? 0,
            y: component.y ?? 0,
            width: component.width ?? COMPONENT_META_MAP[component.type].defaultWidth,
            height: component.height ?? COMPONENT_META_MAP[component.type].defaultHeight,
            interactions: (component.interactions ?? []).map((interaction) => ({
              id: interaction.id ?? createId('interaction'),
              trigger: interaction.trigger,
              action: interaction.action,
              target: interaction.target,
            })),
          },
          boardSize,
        ),
      ),
    })),
  }
}

export function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed.project || !parsed.currentBoardId || !parsed.settings) {
      return null
    }

    return {
      ...parsed,
      project: parseProjectJson(JSON.stringify(parsed.project)),
    }
  } catch {
    return null
  }
}

export function savePersistedState(state: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
