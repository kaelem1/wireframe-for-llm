/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前活跃组件类型收敛为 layout、content、input、navigation、feedback、media、commerce
3. 当前保留旧导入组件类型，并为导出结构补充 clipped 及 clipped/手绘容差/禁 emoji 三类 _instructions；组件内部可存 description，导出时映射为 info
4. 更新后检查所属 `.folder.md`
*/

export type DevicePreset = 'iPhone' | 'Android' | 'iPad' | 'Desktop' | 'Custom'
export type DevicePresetKey = DevicePreset
export type Locale = 'en' | 'zh'

export type ActiveComponentType =
  | 'layout'
  | 'content'
  | 'input'
  | 'navigation'
  | 'feedback'
  | 'media'
  | 'commerce'

export type LegacyComponentType =
  | 'hero'
  | 'card'
  | 'button'
  | 'sidebar'
  | 'table'
  | 'form'
  | 'modal'
  | 'footer'
  | 'avatar'
  | 'badge'
  | 'text'
  | 'image'
  | 'list'
  | 'tabs'
  | 'header'
  | 'section'
  | 'grid'
  | 'dropdown'
  | 'toggle'
  | 'breadcrumb'
  | 'pagination'
  | 'progress'
  | 'divider'
  | 'accordion'
  | 'carousel'
  | 'chart'
  | 'video'
  | 'search'
  | 'toast'
  | 'tooltip'
  | 'pricing'
  | 'testimonial'
  | 'cta'
  | 'alert'
  | 'banner'
  | 'stat'
  | 'stepper'
  | 'tag'
  | 'rating'
  | 'map'
  | 'timeline'
  | 'fileUpload'
  | 'codeBlock'
  | 'calendar'
  | 'notification'
  | 'productCard'
  | 'profile'
  | 'drawer'
  | 'popover'
  | 'logo'
  | 'faq'
  | 'gallery'
  | 'genericBlock'
  | 'checkbox'
  | 'radio'
  | 'slider'
  | 'datePicker'
  | 'skeleton'
  | 'chip'
  | 'icon'
  | 'spinner'
  | 'feature'
  | 'team'
  | 'login'
  | 'contact'
  | 'Header'
  | 'TabBar'
  | 'Card'
  | 'List'
  | 'Button'
  | 'Input'
  | 'Image'
  | 'Text'
  | 'Divider'
  | 'Spacer'
  | 'Icon'
  | 'Modal'

export type ComponentType = ActiveComponentType | LegacyComponentType

export type ComponentSectionName = ActiveComponentType

export interface ComponentCatalogItem {
  type: ActiveComponentType
  label: string
  width: number
  height: number
}

export interface ComponentCatalogSection {
  section: ComponentSectionName
  items: ComponentCatalogItem[]
}

export type ComponentSection = ComponentCatalogSection

export type InteractionTrigger = 'tap' | 'longPress' | 'swipe'
export type InteractionAction = 'navigate' | 'back' | 'showModal'
export type TriggerType = InteractionTrigger
export type ActionType = InteractionAction

export interface BoardSize {
  width: number
  height: number
}

export interface Interaction {
  id: string
  trigger: InteractionTrigger
  action: InteractionAction
  target?: string
}

export interface ProtoComponent {
  id: string
  type: ComponentType
  name: string
  description?: string
  x: number
  y: number
  width: number
  height: number
  interactions: Interaction[]
}

export interface Board {
  id: string
  name: string
  components: ProtoComponent[]
}

export interface ProjectData {
  project: string
  device: DevicePreset
  boardSize: BoardSize
  boards: Board[]
}

export interface ExportBoardLayout {
  axis: 'vertical'
}

export interface ExportComponentLayout {
  placement: 'top' | 'bottom' | 'flow' | 'center' | 'overlay'
  width: 'full' | 'fixed'
}

export interface ExportComponent extends Omit<ProtoComponent, 'description'> {
  clipped?: true
  info?: string
  layout: ExportComponentLayout
}

export interface ExportBoard extends Omit<Board, 'components'> {
  layout: ExportBoardLayout
  components: ExportComponent[]
}

export interface ExportProjectData extends Omit<ProjectData, 'boards'> {
  _instructions: {
    clipped: string
    layoutTolerance: string
    noEmoji: string
  }
  instruction: string
  boards: ExportBoard[]
}

export interface AISettings {
  baseUrl: string
  apiKey: string
  model: string
}

export interface GenerationState {
  status: 'idle' | 'loading' | 'error'
  error: string | null
}

export interface RestoreTestResult {
  status: 'idle' | 'loading' | 'done' | 'error'
  code: string
  html: string
  error: string | null
}

export interface WireframeState {
  purpose: string
}

export interface WorkspaceSnapshot {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
  wireframe: WireframeState
  locale: Locale
}

export interface PersistedState {
  project: ProjectData
  currentBoardId: string
  selectedComponentId: string | null
  settings: AISettings
  setupCompleted: boolean
  wireframe: WireframeState
  locale?: Locale
}

export type ComponentData = ProtoComponent
export type AiSettings = AISettings

export interface AppState {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
  wireframe: WireframeState
  locale: Locale
}
