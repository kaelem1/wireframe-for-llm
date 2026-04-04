/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type {
  BoardComponent,
  BoardDocument,
  ComponentMeta,
  ComponentType,
  DevicePreset,
  Position,
  Size,
} from '../types/schema'

export const GRID_SIZE = 8
export const STORAGE_KEY = 'wireframe-prototype-tool:v1'

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'iPhone', label: 'iPhone', width: 390, height: 844 },
  { id: 'Android', label: 'Android', width: 412, height: 915 },
  { id: 'iPad', label: 'iPad', width: 1024, height: 1366 },
  { id: 'Desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'Custom', label: '自定义', width: 390, height: 844 },
]

export const COMPONENT_META: Record<ComponentType, ComponentMeta> = {
  Header: {
    type: 'Header',
    label: '顶部导航栏',
    icon: '▬',
    defaultSize: { width: 0, height: 56 },
    minSize: { width: 240, height: 56 },
    fullWidth: true,
    dock: 'top',
  },
  TabBar: {
    type: 'TabBar',
    label: '底部标签栏',
    icon: '···',
    defaultSize: { width: 0, height: 56 },
    minSize: { width: 240, height: 56 },
    fullWidth: true,
    dock: 'bottom',
  },
  Card: {
    type: 'Card',
    label: '卡片',
    icon: '□',
    defaultSize: { width: 0, height: 160 },
    minSize: { width: 240, height: 96 },
    fullWidth: true,
    dock: null,
  },
  List: {
    type: 'List',
    label: '列表',
    icon: '≡',
    defaultSize: { width: 0, height: 240 },
    minSize: { width: 240, height: 120 },
    fullWidth: true,
    dock: null,
  },
  Button: {
    type: 'Button',
    label: '按钮',
    icon: '▢',
    defaultSize: { width: 160, height: 48 },
    minSize: { width: 96, height: 40 },
    fullWidth: false,
    dock: null,
  },
  Input: {
    type: 'Input',
    label: '输入框',
    icon: '_',
    defaultSize: { width: 0, height: 48 },
    minSize: { width: 240, height: 48 },
    fullWidth: true,
    dock: null,
  },
  Image: {
    type: 'Image',
    label: '图片',
    icon: '⛰',
    defaultSize: { width: 0, height: 200 },
    minSize: { width: 240, height: 96 },
    fullWidth: true,
    dock: null,
  },
  Text: {
    type: 'Text',
    label: '文本',
    icon: 'T',
    defaultSize: { width: 0, height: 24 },
    minSize: { width: 240, height: 24 },
    fullWidth: true,
    dock: null,
  },
  Divider: {
    type: 'Divider',
    label: '分割线',
    icon: '—',
    defaultSize: { width: 0, height: 1 },
    minSize: { width: 240, height: 1 },
    fullWidth: true,
    dock: null,
  },
  Spacer: {
    type: 'Spacer',
    label: '间距',
    icon: '↕',
    defaultSize: { width: 0, height: 24 },
    minSize: { width: 240, height: 8 },
    fullWidth: true,
    dock: null,
  },
  Icon: {
    type: 'Icon',
    label: '图标',
    icon: '◉',
    defaultSize: { width: 24, height: 24 },
    minSize: { width: 24, height: 24 },
    fullWidth: false,
    dock: null,
  },
  Modal: {
    type: 'Modal',
    label: '弹窗',
    icon: '⬜',
    defaultSize: { width: 300, height: 200 },
    minSize: { width: 200, height: 120 },
    fullWidth: false,
    dock: 'center',
  },
}

export const TRIGGER_OPTIONS = [
  { value: 'tap', label: '点击' },
  { value: 'longPress', label: '长按' },
  { value: 'swipe', label: '滑动' },
] as const

export const ACTION_OPTIONS = [
  { value: 'navigate', label: '跳转' },
  { value: 'back', label: '返回' },
  { value: 'showModal', label: '显示弹窗' },
] as const

export const DEFAULT_AI_CONFIG = {
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: '',
  model: 'zai-org/GLM-4.6',
}

export function createEmptyBoard(index: number): BoardDocument {
  return {
    id: `board-${Math.random().toString(36).slice(2, 10)}`,
    name: `画板 ${index + 1}`,
    components: [],
  }
}

export function getComponentSize(type: ComponentType, boardSize: Size): Size {
  const meta = COMPONENT_META[type]
  return {
    width: meta.fullWidth ? boardSize.width : meta.defaultSize.width,
    height: meta.defaultSize.height,
  }
}

export function getNextVerticalPosition(board: BoardDocument, boardSize: Size): number {
  const bottomInset = board.components.some((component) => component.type === 'TabBar') ? 64 : 8
  const topStart = board.components.some((component) => component.type === 'Header') ? 64 : 8
  const maxBottom = board.components
    .filter((component) => component.type !== 'TabBar' && component.type !== 'Modal')
    .reduce((max, component) => Math.max(max, component.y + component.height + 8), topStart)
  return Math.min(maxBottom, Math.max(8, boardSize.height - bottomInset))
}

export function getDefaultComponentFrame(
  type: ComponentType,
  board: BoardDocument,
  boardSize: Size,
  dropPosition: Position | undefined,
  createId: (prefix: string) => string,
  snapToGrid: (value: number) => number,
): BoardComponent {
  const meta = COMPONENT_META[type]
  const size = getComponentSize(type, boardSize)
  const duplicateCount = board.components.filter((item) => item.type === type).length
  let x = 0
  let y = 0

  if (meta.dock === 'top') {
    x = 0
    y = 0
  } else if (meta.dock === 'bottom') {
    x = 0
    y = boardSize.height - size.height
  } else if (meta.dock === 'center') {
    x = snapToGrid((boardSize.width - size.width) / 2)
    y = snapToGrid((boardSize.height - size.height) / 2)
  } else if (dropPosition) {
    x = meta.fullWidth ? 0 : snapToGrid(dropPosition.x)
    y = snapToGrid(dropPosition.y)
  } else {
    x = meta.fullWidth ? 0 : snapToGrid((boardSize.width - size.width) / 2)
    y = getNextVerticalPosition(board, boardSize)
  }

  return {
    id: createId('comp'),
    type,
    name: duplicateCount === 0 ? meta.label : `${meta.label}${duplicateCount + 1}`,
    x,
    y,
    width: meta.fullWidth ? boardSize.width : size.width,
    height: size.height,
    interactions: [],
  }
}
