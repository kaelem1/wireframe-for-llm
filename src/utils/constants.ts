/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前包含组件放置约束与画布 fit 常量
3. 更新后检查所属 `.folder.md`
*/

import type { BoardSize, ComponentType, DevicePreset } from '../types/schema'

export interface DeviceOption {
  id: DevicePreset
  label: string
  size: BoardSize
}

export interface ComponentMeta {
  type: ComponentType
  label: string
  jsonType: ComponentType
  icon: string
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  fullWidth?: boolean
  anchor?: 'top' | 'bottom'
  centered?: boolean
}

export const GRID_SIZE = 8
export const STORAGE_KEY = 'wireframe-proto-state'
export const LOCAL_STORAGE_KEY = STORAGE_KEY
export const BOARD_STAGE_PADDING = 48
export const PLACEMENT_DRAG_THRESHOLD = 4
export const DEFAULT_AI_BASE_URL = 'https://api.siliconflow.cn/v1'
export const DEFAULT_AI_MODEL = 'zai-org/GLM-4.6'
export const DEFAULT_PROJECT_NAME = '我的应用'

export const DEVICE_OPTIONS: DeviceOption[] = [
  { id: 'iPhone', label: 'iPhone', size: { width: 390, height: 844 } },
  { id: 'Android', label: 'Android', size: { width: 412, height: 915 } },
  { id: 'iPad', label: 'iPad', size: { width: 1024, height: 1366 } },
  { id: 'Desktop', label: 'Desktop', size: { width: 1440, height: 900 } },
  { id: 'Custom', label: '自定义', size: { width: 390, height: 844 } },
]

export const COMPONENT_METAS: ComponentMeta[] = [
  {
    type: 'Header',
    label: '顶部导航栏',
    jsonType: 'Header',
    icon: '▬',
    defaultWidth: 390,
    defaultHeight: 56,
    minWidth: 240,
    minHeight: 56,
    fullWidth: true,
    anchor: 'top',
  },
  {
    type: 'TabBar',
    label: '底部标签栏',
    jsonType: 'TabBar',
    icon: '···',
    defaultWidth: 390,
    defaultHeight: 56,
    minWidth: 240,
    minHeight: 56,
    fullWidth: true,
    anchor: 'bottom',
  },
  {
    type: 'Card',
    label: '卡片',
    jsonType: 'Card',
    icon: '□',
    defaultWidth: 390,
    defaultHeight: 160,
    minWidth: 160,
    minHeight: 96,
    fullWidth: true,
  },
  {
    type: 'List',
    label: '列表',
    jsonType: 'List',
    icon: '≡',
    defaultWidth: 390,
    defaultHeight: 240,
    minWidth: 180,
    minHeight: 120,
    fullWidth: true,
  },
  {
    type: 'Button',
    label: '按钮',
    jsonType: 'Button',
    icon: '▢',
    defaultWidth: 160,
    defaultHeight: 48,
    minWidth: 88,
    minHeight: 40,
    centered: true,
  },
  {
    type: 'Input',
    label: '输入框',
    jsonType: 'Input',
    icon: '_',
    defaultWidth: 390,
    defaultHeight: 48,
    minWidth: 160,
    minHeight: 40,
    fullWidth: true,
  },
  {
    type: 'Image',
    label: '图片',
    jsonType: 'Image',
    icon: '⛰',
    defaultWidth: 390,
    defaultHeight: 200,
    minWidth: 160,
    minHeight: 96,
    fullWidth: true,
  },
  {
    type: 'Text',
    label: '文本',
    jsonType: 'Text',
    icon: 'T',
    defaultWidth: 390,
    defaultHeight: 24,
    minWidth: 120,
    minHeight: 24,
    fullWidth: true,
  },
  {
    type: 'Divider',
    label: '分割线',
    jsonType: 'Divider',
    icon: '—',
    defaultWidth: 390,
    defaultHeight: 1,
    minWidth: 120,
    minHeight: 1,
    fullWidth: true,
  },
  {
    type: 'Spacer',
    label: '间距',
    jsonType: 'Spacer',
    icon: '↕',
    defaultWidth: 390,
    defaultHeight: 24,
    minWidth: 120,
    minHeight: 8,
    fullWidth: true,
  },
  {
    type: 'Icon',
    label: '图标',
    jsonType: 'Icon',
    icon: '◉',
    defaultWidth: 24,
    defaultHeight: 24,
    minWidth: 24,
    minHeight: 24,
  },
  {
    type: 'Modal',
    label: '弹窗',
    jsonType: 'Modal',
    icon: '⬜',
    defaultWidth: 300,
    defaultHeight: 200,
    minWidth: 220,
    minHeight: 120,
    centered: true,
  },
]

export const COMPONENT_META_MAP = COMPONENT_METAS.reduce(
  (map, item) => {
    map[item.type] = item
    return map
  },
  {} as Record<ComponentType, ComponentMeta>,
)

export const INTERACTION_TRIGGER_OPTIONS = [
  { label: '点击', value: 'tap' },
  { label: '长按', value: 'longPress' },
  { label: '滑动', value: 'swipe' },
] as const

export const INTERACTION_ACTION_OPTIONS = [
  { label: '跳转', value: 'navigate' },
  { label: '返回', value: 'back' },
  { label: '显示弹窗', value: 'showModal' },
] as const

export const DEVICE_PRESETS = DEVICE_OPTIONS.map((item) => ({
  key: item.id,
  label: item.label,
  width: item.size.width,
  height: item.size.height,
}))

export const COMPONENT_ORDER = COMPONENT_METAS.map((item) => item.type)

export const COMPONENT_DEFINITIONS = COMPONENT_META_MAP

export const DEFAULT_AI_SETTINGS = {
  baseUrl: DEFAULT_AI_BASE_URL,
  apiKey: '',
  model: DEFAULT_AI_MODEL,
}
