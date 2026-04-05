/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前同时承接 source 小写组件目录与现有旧组件类型，并收敛为单一 wireframe 工作态
3. 更新后检查所属 `.folder.md`
*/

export type DevicePreset = 'iPhone' | 'Android' | 'iPad' | 'Desktop' | 'Custom'
export type DevicePresetKey = DevicePreset

export type ComponentType =
  | 'navigation'
  | 'hero'
  | 'card'
  | 'button'
  | 'sidebar'
  | 'table'
  | 'form'
  | 'input'
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

export type ComponentSectionName = 'Layout' | 'Content' | 'Controls' | 'Elements' | 'Blocks'

export interface ComponentCatalogItem {
  type: ComponentType
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

export interface ExportComponent extends ProtoComponent {
  layout: ExportComponentLayout
}

export interface ExportBoard extends Omit<Board, 'components'> {
  layout: ExportBoardLayout
  components: ExportComponent[]
}

export interface ExportProjectData extends Omit<ProjectData, 'boards'> {
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
}

export interface PersistedState {
  project: ProjectData
  currentBoardId: string
  selectedComponentId: string | null
  settings: AISettings
  setupCompleted: boolean
  wireframe: WireframeState
}

export type ComponentData = ProtoComponent
export type AiSettings = AISettings

export interface AppState {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
  wireframe: WireframeState
}
