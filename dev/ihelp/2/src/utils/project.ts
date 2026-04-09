/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前包含项目导出扩展、双语命名辅助、fit 缩放与放置/命名辅助
3. 组件归一化仅做最小尺寸约束，不再锁死边界位置或尺寸
4. 组件复制支持可控偏移，供粘贴与 Option 拖拽复用
5. 导出 JSON 会为越界组件补 clipped，并写入 clipped/手绘容差/禁 emoji 三类 _instructions；组件描述会映射为 info
6. 组件命名支持最小防重逻辑
7. 更新后检查所属 `.folder.md`
*/

import {
  BOARD_STAGE_PADDING,
  COMPONENT_META_MAP,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEVICE_OPTIONS,
  GRID_SIZE,
  STORAGE_KEY,
} from './constants'
import {
  DEFAULT_LOCALE,
  getCopyName,
  getDefaultProjectName,
  getIndexedBoardName,
  getInitialBoardName,
  getLocalizedComponentLabel,
  t,
} from './i18n'
import type {
  AISettings,
  Board,
  BoardSize,
  ComponentType,
  DevicePreset,
  ExportBoard,
  ExportComponentLayout,
  ExportProjectData,
  Locale,
  PersistedState,
  ProjectData,
  ProtoComponent,
} from '../types/schema'

const EXPORT_INSTRUCTION = t(DEFAULT_LOCALE, 'exportInstruction')

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

export function getBoardFitScale(boardSize: BoardSize, stageWidth: number, stageHeight: number) {
  const availableWidth = Math.max(stageWidth - BOARD_STAGE_PADDING, 0)
  const availableHeight = Math.max(stageHeight - BOARD_STAGE_PADDING, 0)

  return Math.min(
    1,
    availableWidth / boardSize.width,
    availableHeight / boardSize.height,
  )
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
  locale: Locale = DEFAULT_LOCALE,
): ProjectData {
  const boardSize = getDeviceSize(device, customBoardSize)
  const board = createBoard(getInitialBoardName(locale))

  return {
    project: projectName || getDefaultProjectName(locale),
    device,
    boardSize,
    boards: [board],
  }
}

export function exportProjectJson(project: ProjectData) {
  const exported: ExportProjectData = {
    ...project,
    _instructions: {
      clipped:
        '如果一个组件的 clipped 为 true，说明它被画板边界截断了，其真实高度未知。还原时请参考同类型、同名称的其他组件高度，保持一致。',
      layoutTolerance:
        '手绘线框重在结构与交互，位置尺寸仅供参考，不必严格对齐。',
      noEmoji: '输出界面不得包含任何 emoji 符号。',
    },
    instruction: EXPORT_INSTRUCTION,
    boards: project.boards.map<ExportBoard>((board) => ({
      ...board,
      layout: { axis: 'vertical' },
      components: board.components.map((component) => {
        const { description, ...rest } = component

        return {
          ...rest,
          ...(description ? { info: description } : {}),
          ...(isComponentClipped(component, project.boardSize) ? { clipped: true as const } : {}),
          layout: getExportComponentLayout(component),
        }
      }),
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
  locale: Locale = DEFAULT_LOCALE,
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
    name: getNextComponentName(board, getLocalizedComponentLabel(locale, type, meta.label)),
    x,
    y,
    width,
    height,
    interactions: [],
  }
}

export function normalizeComponent(component: ProtoComponent, _boardSize: BoardSize): ProtoComponent {
  const meta = COMPONENT_META_MAP[component.type]
  const width = Math.max(meta.minWidth, snap(component.width))
  const height = Math.max(meta.minHeight, snap(component.height))

  const x = snap(component.x)
  const y = snap(component.y)

  return {
    ...component,
    width,
    height,
    x,
    y,
  }
}

function isComponentClipped(component: ProtoComponent, boardSize: BoardSize) {
  return (
    component.x < 0 ||
    component.y < 0 ||
    component.x + component.width > boardSize.width ||
    component.y + component.height > boardSize.height
  )
}

export function duplicateComponent(
  component: ProtoComponent,
  boardSize: BoardSize,
  locale: Locale = DEFAULT_LOCALE,
  offset: { x: number; y: number } = { x: GRID_SIZE * 2, y: GRID_SIZE * 2 },
): ProtoComponent {
  return normalizeComponent(
    {
      ...component,
      id: createId('comp'),
      name: getCopyName(locale, component.name),
      x: component.x + offset.x,
      y: component.y + offset.y,
      interactions: component.interactions.map((item) => ({
        ...item,
        id: createId('interaction'),
      })),
    },
    boardSize,
  )
}

export function duplicateBoard(
  project: ProjectData,
  boardId: string,
  locale: Locale = DEFAULT_LOCALE,
): Board | null {
  const source = getBoardById(project, boardId)

  if (!source) {
    return null
  }

  return {
    id: createId('board'),
    name: getNextBoardCopyName(project, source.name, locale),
    components: source.components.map((component) => ({
      ...component,
      id: createId('comp'),
      interactions: component.interactions.map((interaction) => ({
        ...interaction,
        id: createId('interaction'),
      })),
    })),
  }
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

export function getNextBoardName(project: ProjectData, locale: Locale = DEFAULT_LOCALE) {
  let index = 1

  while (project.boards.some((board) => board.name === getIndexedBoardName(locale, index))) {
    index += 1
  }

  return getIndexedBoardName(locale, index)
}

function getNextBoardCopyName(project: ProjectData, name: string, locale: Locale) {
  const baseName = getCopyName(locale, name)

  if (!project.boards.some((board) => board.name === baseName)) {
    return baseName
  }

  let index = 2

  while (project.boards.some((board) => board.name === `${baseName} ${index}`)) {
    index += 1
  }

  return `${baseName} ${index}`
}

export function getNextComponentName(board: Board, name: string, excludeId?: string) {
  const baseName = name.trim() || 'Component'

  if (!board.components.some((component) => component.id !== excludeId && component.name === baseName)) {
    return baseName
  }

  let index = 1

  while (board.components.some((component) => component.id !== excludeId && component.name === `${baseName}${index}`)) {
    index += 1
  }

  return `${baseName}${index}`
}

export function getPlacedComponentFrame(
  type: ComponentType,
  frame: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  boardSize: BoardSize,
) {
  const normalized = normalizeComponentFrame(type, frame, boardSize)

  if (type !== 'Modal') {
    return normalized
  }

  return {
    ...normalized,
    x: clamp(snap((boardSize.width - normalized.width) / 2), 0, boardSize.width - normalized.width),
    y: clamp(
      snap((boardSize.height - normalized.height) / 2),
      0,
      boardSize.height - normalized.height,
    ),
  }
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
    throw new Error(t(DEFAULT_LOCALE, 'invalidProjectJson'))
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
      name: board.name ?? getIndexedBoardName(DEFAULT_LOCALE, boardIndex + 1),
      components: (board.components ?? []).map((component) =>
        (() => {
          const source = component as ProtoComponent & { info?: string }

          return normalizeComponent(
            {
              id: source.id ?? createId('comp'),
              type: component.type,
              name: source.name ?? COMPONENT_META_MAP[component.type].label,
              description: source.description ?? source.info,
              x: source.x ?? 0,
              y: source.y ?? 0,
              width: source.width ?? COMPONENT_META_MAP[component.type].defaultWidth,
              height: source.height ?? COMPONENT_META_MAP[component.type].defaultHeight,
              interactions: (source.interactions ?? []).map((interaction) => ({
                id: interaction.id ?? createId('interaction'),
                trigger: interaction.trigger,
                action: interaction.action,
                target: interaction.target,
              })),
            },
            boardSize,
          )
        })(),
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
      locale: parsed.locale === 'zh' ? 'zh' : DEFAULT_LOCALE,
      project: parseProjectJson(JSON.stringify(parsed.project)),
    }
  } catch {
    return null
  }
}

export function savePersistedState(state: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
