/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前 COMPONENT_REGISTRY 仅暴露 generic、content、input、navigation、feedback、media、commerce 七类
3. 当前通过非枚举 legacy metadata 保留旧导入组件尺寸、锚点与渲染定义
4. 用户创建路径不再暴露 layout、modal 等旧组件类型，弹窗能力收敛到交互
5. 画布缩放不再使用额外 stage padding 常量
6. 用户创建路径仅暴露固定设备预设，不提供自定义尺寸
7. 更新后检查所属 `.folder.md`
*/

import type {
  ActiveComponentType,
  BoardSize,
  ComponentCatalogSection,
  ComponentSectionName,
  ComponentType,
  DevicePreset,
} from '../types/schema'

export interface DeviceOption {
  id: DevicePreset
  label: string
  size: BoardSize
}

export interface ComponentMeta {
  type: ComponentType
  label: string
  jsonType: ComponentSectionName
  icon: string
  section: ComponentSectionName
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  fullWidth?: boolean
  anchor?: 'top' | 'bottom'
  centered?: boolean
}

interface ComponentSeed {
  type: ComponentType
  label: string
  icon: string
  width: number
  height: number
}

interface CatalogSeed extends ComponentSeed {
  type: ActiveComponentType
}

const MIN_SIZE_RATIO = 0.35

function createSection(section: ComponentSectionName, items: CatalogSeed[]): ComponentCatalogSection {
  return {
    section,
    items: items.map((item) => ({
      type: item.type,
      label: item.label,
      width: item.width,
      height: item.height,
    })),
  }
}

function toMeta(
  section: ComponentSectionName,
  item: ComponentSeed,
  jsonType: ComponentSectionName,
): ComponentMeta {
  return {
    type: item.type,
    label: item.label,
    jsonType,
    icon: item.icon,
    section,
    defaultWidth: item.width,
    defaultHeight: item.height,
    minWidth: item.type === 'divider' ? 120 : Math.max(20, Math.round(item.width * MIN_SIZE_RATIO)),
    minHeight: item.type === 'divider' ? 1 : Math.max(20, Math.round(item.height * MIN_SIZE_RATIO)),
    fullWidth: ['layout', 'navigation', 'header', 'hero', 'section', 'footer', 'banner', 'divider'].includes(item.type),
    anchor:
      item.type === 'navigation' || item.type === 'header' || item.type === 'banner'
        ? 'top'
        : item.type === 'footer'
          ? 'bottom'
          : undefined,
    centered: ['feedback', 'modal', 'popover', 'toast', 'tooltip', 'alert'].includes(item.type),
  }
}

export const GRID_SIZE = 8
export const STORAGE_KEY = 'wireframe-proto-state'
export const LOCAL_STORAGE_KEY = STORAGE_KEY
export const PLACEMENT_DRAG_THRESHOLD = 4
export const DEFAULT_AI_BASE_URL = 'https://api.siliconflow.cn/v1'
export const DEFAULT_AI_MODEL = 'zai-org/GLM-4.6'
export const DEFAULT_PROJECT_NAME = '我的应用'
export const DEVICE_OPTIONS: DeviceOption[] = [
  { id: 'iPhone', label: 'iPhone', size: { width: 390, height: 844 } },
  { id: 'Android', label: 'Android', size: { width: 412, height: 915 } },
  { id: 'iPad', label: 'iPad', size: { width: 1024, height: 1366 } },
  { id: 'Desktop', label: 'Desktop', size: { width: 1440, height: 900 } },
]

const ACTIVE_COMPONENTS: Array<{ section: ComponentSectionName; item: CatalogSeed }> = [
  { section: 'generic', item: { type: 'generic', label: 'Generic', icon: 'Blk', width: 60, height: 80 } },
  { section: 'content', item: { type: 'content', label: 'Content', icon: 'Txt', width: 420, height: 220 } },
  { section: 'input', item: { type: 'input', label: 'Input', icon: 'In', width: 280, height: 56 } },
  { section: 'navigation', item: { type: 'navigation', label: 'Navigation', icon: 'Nav', width: 800, height: 56 } },
  { section: 'feedback', item: { type: 'feedback', label: 'Feedback', icon: 'Msg', width: 360, height: 72 } },
  { section: 'media', item: { type: 'media', label: 'Media', icon: 'Img', width: 480, height: 270 } },
  { section: 'commerce', item: { type: 'commerce', label: 'Commerce', icon: '$', width: 300, height: 360 } },
]

const LEGACY_LAYOUT_ITEMS: ComponentSeed[] = [
  { type: 'layout', label: 'Layout', icon: 'Lay', width: 800, height: 360 },
  { type: 'header', label: 'Header', icon: 'Hdr', width: 800, height: 80 },
  { type: 'hero', label: 'Hero', icon: 'Hero', width: 800, height: 320 },
  { type: 'section', label: 'Section', icon: 'Sec', width: 800, height: 400 },
  { type: 'sidebar', label: 'Sidebar', icon: 'Side', width: 240, height: 400 },
  { type: 'footer', label: 'Footer', icon: 'Ftr', width: 800, height: 160 },
  { type: 'banner', label: 'Banner', icon: 'Ban', width: 800, height: 48 },
  { type: 'drawer', label: 'Drawer', icon: 'Drw', width: 320, height: 400 },
  { type: 'popover', label: 'Popover', icon: 'Pop', width: 240, height: 160 },
  { type: 'divider', label: 'Divider', icon: 'Div', width: 600, height: 1 },
  { type: 'modal', label: 'Modal', icon: 'Dlg', width: 480, height: 300 },
  { type: 'genericBlock', label: 'Layout', icon: 'Lay', width: 60, height: 80 },
]

const LEGACY_CONTENT_ITEMS: ComponentSeed[] = [
  { type: 'card', label: 'Card', icon: 'Card', width: 280, height: 240 },
  { type: 'text', label: 'Text', icon: 'Txt', width: 400, height: 120 },
  { type: 'table', label: 'Table', icon: 'Tbl', width: 560, height: 220 },
  { type: 'grid', label: 'Grid', icon: 'Grid', width: 600, height: 300 },
  { type: 'list', label: 'List', icon: 'List', width: 300, height: 180 },
  { type: 'codeBlock', label: 'Code Block', icon: 'Code', width: 480, height: 200 },
  { type: 'timeline', label: 'Timeline', icon: 'Time', width: 360, height: 320 },
  { type: 'calendar', label: 'Calendar', icon: 'Cal', width: 300, height: 300 },
  { type: 'accordion', label: 'Accordion', icon: 'Acc', width: 400, height: 200 },
  { type: 'carousel', label: 'Carousel', icon: 'Car', width: 600, height: 300 },
  { type: 'logo', label: 'Logo', icon: 'Logo', width: 120, height: 40 },
  { type: 'faq', label: 'FAQ', icon: 'FAQ', width: 560, height: 320 },
  { type: 'avatar', label: 'Avatar', icon: 'Av', width: 48, height: 48 },
  { type: 'badge', label: 'Badge', icon: 'Bd', width: 80, height: 28 },
  { type: 'tag', label: 'Tag', icon: 'Tag', width: 72, height: 28 },
  { type: 'stat', label: 'Stat', icon: '%', width: 200, height: 120 },
  { type: 'chip', label: 'Chip', icon: 'Chip', width: 96, height: 32 },
  { type: 'icon', label: 'Icon', icon: 'Ic', width: 24, height: 24 },
  { type: 'testimonial', label: 'Testimonial', icon: 'Qt', width: 360, height: 200 },
  { type: 'cta', label: 'CTA', icon: 'CTA', width: 600, height: 160 },
  { type: 'profile', label: 'Profile', icon: 'Prof', width: 280, height: 200 },
  { type: 'feature', label: 'Feature', icon: 'Feat', width: 360, height: 200 },
  { type: 'team', label: 'Team', icon: 'Team', width: 560, height: 280 },
]

const LEGACY_INPUT_ITEMS: ComponentSeed[] = [
  { type: 'button', label: 'Button', icon: 'Btn', width: 140, height: 40 },
  { type: 'search', label: 'Search', icon: 'Srch', width: 320, height: 44 },
  { type: 'form', label: 'Form', icon: 'Form', width: 360, height: 320 },
  { type: 'dropdown', label: 'Dropdown', icon: 'Drop', width: 200, height: 200 },
  { type: 'toggle', label: 'Toggle', icon: 'Tgl', width: 44, height: 24 },
  { type: 'rating', label: 'Rating', icon: 'Rate', width: 160, height: 28 },
  { type: 'fileUpload', label: 'File Upload', icon: 'Up', width: 360, height: 180 },
  { type: 'checkbox', label: 'Checkbox', icon: 'Chk', width: 20, height: 20 },
  { type: 'radio', label: 'Radio', icon: 'Rad', width: 20, height: 20 },
  { type: 'slider', label: 'Slider', icon: 'Sld', width: 240, height: 32 },
  { type: 'datePicker', label: 'Date Picker', icon: 'Date', width: 300, height: 320 },
  { type: 'login', label: 'Login', icon: 'Log', width: 360, height: 360 },
  { type: 'contact', label: 'Contact', icon: 'Cnt', width: 400, height: 320 },
]

const LEGACY_NAVIGATION_ITEMS: ComponentSeed[] = [
  { type: 'tabs', label: 'Tabs', icon: 'Tabs', width: 480, height: 240 },
  { type: 'breadcrumb', label: 'Breadcrumb', icon: 'Path', width: 300, height: 24 },
  { type: 'pagination', label: 'Pagination', icon: 'Pg', width: 300, height: 36 },
  { type: 'stepper', label: 'Stepper', icon: 'Step', width: 480, height: 48 },
]

const LEGACY_FEEDBACK_ITEMS: ComponentSeed[] = [
  { type: 'progress', label: 'Progress', icon: 'Prog', width: 240, height: 8 },
  { type: 'alert', label: 'Alert', icon: '!', width: 400, height: 56 },
  { type: 'toast', label: 'Toast', icon: 'Msg', width: 320, height: 64 },
  { type: 'notification', label: 'Notification', icon: 'Bell', width: 360, height: 72 },
  { type: 'tooltip', label: 'Tooltip', icon: 'Tip', width: 180, height: 40 },
  { type: 'skeleton', label: 'Skeleton', icon: 'Sk', width: 320, height: 120 },
  { type: 'spinner', label: 'Spinner', icon: 'Spin', width: 32, height: 32 },
]

const LEGACY_MEDIA_ITEMS: ComponentSeed[] = [
  { type: 'image', label: 'Image', icon: 'Img', width: 320, height: 200 },
  { type: 'video', label: 'Video', icon: 'Vid', width: 480, height: 270 },
  { type: 'chart', label: 'Chart', icon: 'Chart', width: 400, height: 240 },
  { type: 'map', label: 'Map', icon: 'Map', width: 480, height: 300 },
  { type: 'gallery', label: 'Gallery', icon: 'Gal', width: 560, height: 360 },
]

const LEGACY_COMMERCE_ITEMS: ComponentSeed[] = [
  { type: 'pricing', label: 'Pricing', icon: '$', width: 300, height: 360 },
  { type: 'productCard', label: 'Product Card', icon: 'Prod', width: 280, height: 360 },
]

const LEGACY_COMPONENT_SOURCES: Array<{
  section: ComponentSectionName
  jsonType: ComponentSectionName
  items: ComponentSeed[]
}> = [
  { section: 'layout', jsonType: 'layout', items: LEGACY_LAYOUT_ITEMS },
  { section: 'content', jsonType: 'content', items: LEGACY_CONTENT_ITEMS },
  { section: 'input', jsonType: 'input', items: LEGACY_INPUT_ITEMS },
  { section: 'navigation', jsonType: 'navigation', items: LEGACY_NAVIGATION_ITEMS },
  { section: 'feedback', jsonType: 'feedback', items: LEGACY_FEEDBACK_ITEMS },
  { section: 'media', jsonType: 'media', items: LEGACY_MEDIA_ITEMS },
  { section: 'commerce', jsonType: 'commerce', items: LEGACY_COMMERCE_ITEMS },
]

const LEGACY_COMPONENT_METAS: ComponentMeta[] = [
  ...LEGACY_COMPONENT_SOURCES.flatMap(({ section, jsonType, items }) =>
    items.map((item) => toMeta(section, item, jsonType)),
  ),
  {
    type: 'Header',
    label: 'Header',
    jsonType: 'layout',
    icon: 'Hdr',
    section: 'layout',
    defaultWidth: 800,
    defaultHeight: 80,
    minWidth: 280,
    minHeight: 28,
    fullWidth: true,
    anchor: 'top',
  },
  {
    type: 'TabBar',
    label: 'TabBar',
    jsonType: 'navigation',
    icon: 'Tab',
    section: 'navigation',
    defaultWidth: 800,
    defaultHeight: 56,
    minWidth: 240,
    minHeight: 56,
    fullWidth: true,
    anchor: 'bottom',
  },
  {
    type: 'Card',
    label: 'Card',
    jsonType: 'content',
    icon: 'Card',
    section: 'content',
    defaultWidth: 280,
    defaultHeight: 240,
    minWidth: 98,
    minHeight: 84,
  },
  {
    type: 'List',
    label: 'List',
    jsonType: 'content',
    icon: 'List',
    section: 'content',
    defaultWidth: 300,
    defaultHeight: 180,
    minWidth: 105,
    minHeight: 63,
  },
  {
    type: 'Button',
    label: 'Button',
    jsonType: 'input',
    icon: 'Btn',
    section: 'input',
    defaultWidth: 140,
    defaultHeight: 40,
    minWidth: 49,
    minHeight: 20,
  },
  {
    type: 'Input',
    label: 'Input',
    jsonType: 'input',
    icon: 'In',
    section: 'input',
    defaultWidth: 280,
    defaultHeight: 56,
    minWidth: 98,
    minHeight: 20,
  },
  {
    type: 'Image',
    label: 'Image',
    jsonType: 'media',
    icon: 'Img',
    section: 'media',
    defaultWidth: 320,
    defaultHeight: 200,
    minWidth: 112,
    minHeight: 70,
  },
  {
    type: 'Text',
    label: 'Text',
    jsonType: 'content',
    icon: 'Txt',
    section: 'content',
    defaultWidth: 400,
    defaultHeight: 120,
    minWidth: 140,
    minHeight: 42,
  },
  {
    type: 'Divider',
    label: 'Divider',
    jsonType: 'layout',
    icon: 'Div',
    section: 'layout',
    defaultWidth: 600,
    defaultHeight: 1,
    minWidth: 120,
    minHeight: 1,
    fullWidth: true,
  },
  {
    type: 'Spacer',
    label: 'Spacer',
    jsonType: 'layout',
    icon: 'Gap',
    section: 'layout',
    defaultWidth: 320,
    defaultHeight: 24,
    minWidth: 120,
    minHeight: 8,
    fullWidth: true,
  },
  {
    type: 'Icon',
    label: 'Icon',
    jsonType: 'content',
    icon: 'Ic',
    section: 'content',
    defaultWidth: 24,
    defaultHeight: 24,
    minWidth: 20,
    minHeight: 20,
  },
  {
    type: 'Modal',
    label: 'Modal',
    jsonType: 'feedback',
    icon: 'Dlg',
    section: 'feedback',
    defaultWidth: 480,
    defaultHeight: 300,
    minWidth: 168,
    minHeight: 105,
    centered: true,
  },
]

export const COMPONENT_REGISTRY: ComponentCatalogSection[] = [
  ...ACTIVE_COMPONENTS.map(({ section, item }) => createSection(section, [item])),
]

export const COMPONENT_METAS: ComponentMeta[] = ACTIVE_COMPONENTS.map(({ section, item }) =>
  toMeta(section, item, item.type),
)

export const COMPONENT_META_MAP = COMPONENT_METAS.reduce(
  (map, item) => {
    map[item.type] = item
    return map
  },
  {} as Record<ComponentType, ComponentMeta>,
)

for (const item of LEGACY_COMPONENT_METAS) {
  Object.defineProperty(COMPONENT_META_MAP, item.type, {
    value: item,
    enumerable: false,
    configurable: true,
  })
}

export const INTERACTION_TRIGGER_OPTIONS = [
  { label: 'Tap', value: 'tap' },
  { label: 'Long Press', value: 'longPress' },
  { label: 'Swipe', value: 'swipe' },
] as const

export const INTERACTION_ACTION_OPTIONS = [
  { label: 'Navigate', value: 'navigate' },
  { label: 'Back', value: 'back' },
  { label: 'Show Modal', value: 'showModal' },
] as const

export const DEVICE_PRESETS = DEVICE_OPTIONS.map((item) => ({
  key: item.id,
  label: item.label,
  width: item.size.width,
  height: item.size.height,
}))

export const COMPONENT_ORDER = COMPONENT_REGISTRY.flatMap((section) =>
  section.items.map((item) => item.type),
)

export const COMPONENT_DEFINITIONS = COMPONENT_META_MAP

export const DEFAULT_AI_SETTINGS = {
  baseUrl: DEFAULT_AI_BASE_URL,
  apiKey: '',
  model: DEFAULT_AI_MODEL,
}
