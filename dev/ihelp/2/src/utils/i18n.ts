/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前集中管理应用双语词典、浏览器语言检测与少量文案派生
3. 当前补入 genericBlock、组件描述、属性切换、弹窗描述、原位预览与 placement toast 文案
4. 更新后检查所属 `.folder.md`
*/

import type { ComponentSectionName, ComponentType, DevicePresetKey, Locale } from '../types/schema'

export const DEFAULT_LOCALE: Locale = 'en'

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  return candidates.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh' : DEFAULT_LOCALE
}

const messages = {
  en: {
    exportJson: 'Export JSON',
    copyJson: 'Copy JSON',
    importJson: 'Import JSON',
    preview: 'Preview',
    exitPreview: 'Exit Preview',
    projectName: 'Project Name',
    interactions: 'Interactions',
    layers: 'Layers',
    newPage: 'New Page',
    pickComponentHint: 'Select a component, then drag/click to place it.',
    name: 'Name',
    description: 'Description',
    attributes: 'Attributes',
    trigger: 'Trigger',
    action: 'Action',
    target: 'Target',
    modalContent: 'Modal Content',
    tap: 'Tap',
    longPress: 'Long Press',
    swipe: 'Swipe',
    navigate: 'Navigate',
    back: 'Back',
    showModal: 'Show Modal',
    selectBoard: 'Select Board',
    selectModal: 'Select Modal',
    modalContentPlaceholder: 'Describe what this modal should show',
    deleteInteraction: 'Delete Interaction',
    addInteraction: '+ Add Interaction',
    selectedCount: '{count} selected',
    batchActionsHint: 'Batch actions are available for the current selection.',
    deleteSelected: 'Delete Selected',
    clearSelection: 'Clear Selection',
    emptyInspector: 'Select a component to edit its name, description, attributes, interactions, and layer order.',
    clickToPlace: 'Select a component, then drag/click to place it.',
    placementToast: '退出放置',
    duplicate: 'Duplicate',
    delete: 'Delete',
    exitPlacement: '退出放置',
    resizeComponent: 'Resize component {handle}',
    moreForBoard: 'More actions for {name}',
    more: 'More',
    createCopy: 'Create Copy',
    addBoard: '+ New Board',
    newProject: 'New Project',
    width: 'Width',
    height: 'Height',
    createProject: 'Create Project',
    manualSize: 'Enter custom size',
    aiGenerator: 'AI Generate',
    close: 'Close',
    describeFlow: 'Describe the page or flow',
    aiPromptPlaceholder:
      'For example: create a mobile app with a home screen, login screen, and settings screen. The home screen should include a top navigation bar, image, cards, list, and bottom tab bar.',
    cancel: 'Cancel',
    generating: 'Generating...',
    generateBoards: 'Generate Boards',
    generateFailed: 'AI generation failed',
    settings: 'Settings',
    model: 'Model',
    runRestoreTest: 'Run AI Restore Test',
    requestingAi: 'Requesting AI...',
    originalVersion: 'Original Version',
    generatedVersion: 'AI Generated Version',
    restoreTestTitle: 'AI Restore Test',
    restoreTestFailed: 'AI restore test failed',
    modalBadge: '→ Modal',
    backBadge: '→ Back',
    untitledBoard: 'Untitled Board',
    defaultProjectName: 'My App',
    initialBoardName: 'Home',
    boardBaseName: 'Board',
    copySuffix: 'Copy',
    invalidProjectJson: 'JSON does not match the project format',
    projectNotInitialized: 'Project has not been initialized',
    aiRequestFailed: 'AI request failed',
    aiEmptyResponse: 'AI returned no content',
    exportInstruction:
      'First infer the app type, then rebuild this layout. If there is no frontend in the project, output HTML and build an app prototype from this layout.',
  },
  zh: {
    exportJson: '导出 JSON',
    copyJson: '复制 JSON',
    importJson: '导入 JSON',
    preview: '预览',
    exitPreview: '退出预览',
    projectName: '项目名称',
    interactions: '交互',
    layers: '图层',
    newPage: '新画板',
    pickComponentHint: '选中组件，然后拖拽/点击放置组件。',
    name: '名称',
    description: '描述',
    attributes: '属性',
    trigger: '触发方式',
    action: '动作',
    target: '目标',
    modalContent: '弹窗内容',
    tap: '点击',
    longPress: '长按',
    swipe: '滑动',
    navigate: '跳转',
    back: '返回',
    showModal: '显示弹窗',
    selectBoard: '选择画板',
    selectModal: '选择弹窗',
    modalContentPlaceholder: '描述这个弹窗要展示什么内容',
    deleteInteraction: '删除交互',
    addInteraction: '+ 添加交互',
    selectedCount: '已选中 {count} 个',
    batchActionsHint: '当前选区可执行批量操作。',
    deleteSelected: '删除选中项',
    clearSelection: '清除选中',
    emptyInspector: '选中组件后可编辑名称、描述、属性、交互和图层顺序。',
    clickToPlace: '选中组件，然后拖拽/点击放置组件。',
    placementToast: '退出放置',
    duplicate: '复制',
    delete: '删除',
    exitPlacement: '退出放置',
    resizeComponent: '调整组件大小 {handle}',
    moreForBoard: '{name} 更多操作',
    more: '更多',
    createCopy: '创建副本',
    addBoard: '+ 新建画板',
    newProject: '新建项目',
    width: '宽度',
    height: '高度',
    createProject: '创建项目',
    manualSize: '手动输入尺寸',
    aiGenerator: 'AI 生成',
    close: '关闭',
    describeFlow: '描述页面或流程',
    aiPromptPlaceholder:
      '例如：创建一个含首页、登录页和设置页的移动应用，首页包含顶部导航栏、图片、卡片、列表和底部标签栏。',
    cancel: '取消',
    generating: '生成中...',
    generateBoards: '生成画板',
    generateFailed: 'AI 生成失败',
    settings: '设置',
    model: '模型',
    runRestoreTest: '运行 AI 还原测试',
    requestingAi: '正在请求 AI...',
    originalVersion: '原始版本',
    generatedVersion: 'AI 生成版本',
    restoreTestTitle: 'AI 还原测试',
    restoreTestFailed: 'AI 还原测试失败',
    modalBadge: '→ 弹窗',
    backBadge: '→ 返回',
    untitledBoard: '未命名画板',
    defaultProjectName: '我的应用',
    initialBoardName: '首页',
    boardBaseName: '画板',
    copySuffix: '副本',
    invalidProjectJson: 'JSON 结构不符合项目格式',
    projectNotInitialized: '项目尚未初始化',
    aiRequestFailed: 'AI 请求失败',
    aiEmptyResponse: 'AI 未返回内容',
    exportInstruction:
      '请先补充应用类型，再还原这种布局；如项目内无前端内容，请输出 html，并基于这个布局做一个应用原型。',
  },
} as const

const sectionLabels: Record<Locale, Record<ComponentSectionName, string>> = {
  en: {
    Layout: 'Layout',
    Content: 'Content',
    Controls: 'Controls',
    Elements: 'Elements',
    Blocks: 'Blocks',
  },
  zh: {
    Layout: '布局',
    Content: '内容',
    Controls: '控件',
    Elements: '元素',
    Blocks: '模块',
  },
}

const deviceLabels: Record<Locale, Record<DevicePresetKey, string>> = {
  en: {
    iPhone: 'iPhone',
    Android: 'Android',
    iPad: 'iPad',
    Desktop: 'Desktop',
    Custom: 'Custom',
  },
  zh: {
    iPhone: 'iPhone',
    Android: 'Android',
    iPad: 'iPad',
    Desktop: 'Desktop',
    Custom: '自定义',
  },
}

const componentLabels: Record<Locale, Record<ComponentType, string>> = {
  en: {} as Record<ComponentType, string>,
  zh: {
    navigation: '导航栏',
    hero: '主视觉',
    card: '卡片',
    button: '按钮',
    sidebar: '侧边栏',
    table: '表格',
    form: '表单',
    input: '输入框',
    modal: '弹窗',
    footer: '页脚',
    avatar: '头像',
    badge: '徽标',
    text: '文本',
    image: '图片',
    list: '列表',
    tabs: '标签页',
    header: '页头',
    section: '分区',
    grid: '网格',
    dropdown: '下拉框',
    toggle: '开关',
    breadcrumb: '面包屑',
    pagination: '分页',
    progress: '进度条',
    divider: '分隔线',
    accordion: '手风琴',
    carousel: '轮播',
    chart: '图表',
    video: '视频',
    search: '搜索',
    toast: '提示',
    tooltip: '提示浮层',
    pricing: '定价卡',
    testimonial: '评价',
    cta: '行动号召',
    alert: '警示',
    banner: '横幅',
    stat: '统计卡',
    stepper: '步骤条',
    tag: '标签',
    rating: '评分',
    map: '地图',
    timeline: '时间线',
    fileUpload: '文件上传',
    codeBlock: '代码块',
    calendar: '日历',
    notification: '通知',
    productCard: '商品卡',
    profile: '资料卡',
    drawer: '抽屉',
    popover: '气泡卡',
    logo: '标识',
    faq: '常见问题',
    gallery: '图库',
    genericBlock: '通用块',
    checkbox: '复选框',
    radio: '单选框',
    slider: '滑块',
    datePicker: '日期选择',
    skeleton: '骨架屏',
    chip: '胶囊标签',
    icon: '图标',
    spinner: '加载器',
    feature: '特性卡',
    team: '团队',
    login: '登录',
    contact: '联系表单',
    Header: '页头',
    TabBar: '标签栏',
    Card: '卡片',
    List: '列表',
    Button: '按钮',
    Input: '输入框',
    Image: '图片',
    Text: '文本',
    Divider: '分隔线',
    Spacer: '留白',
    Icon: '图标',
    Modal: '弹窗',
  },
}

export type MessageKey = keyof typeof messages.en

export function t(locale: Locale, key: MessageKey, params?: Record<string, string | number>) {
  const template = messages[locale][key] as string
  if (!params) {
    return template
  }

  return Object.entries(params).reduce<string>(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

export function getLocalizedSectionLabel(locale: Locale, section: ComponentSectionName) {
  return sectionLabels[locale][section]
}

export function getLocalizedDeviceLabel(locale: Locale, device: DevicePresetKey) {
  return deviceLabels[locale][device]
}

export function getLocalizedComponentLabel(locale: Locale, type: ComponentType, fallback: string) {
  return locale === 'en' ? fallback : componentLabels.zh[type] ?? fallback
}

export function getDefaultProjectName(locale: Locale) {
  return t(locale, 'defaultProjectName')
}

export function getInitialBoardName(locale: Locale) {
  return t(locale, 'initialBoardName')
}

export function getUntitledBoardName(locale: Locale) {
  return t(locale, 'untitledBoard')
}

export function getIndexedBoardName(locale: Locale, index: number) {
  return `${t(locale, 'boardBaseName')}${index}`
}

export function getCopyName(locale: Locale, name: string, index?: number) {
  const base = `${name} ${t(locale, 'copySuffix')}`
  return index ? `${base} ${index}` : base
}
