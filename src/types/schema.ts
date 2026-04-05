/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前包含运行态项目结构与导出 JSON 扩展类型
3. 更新后检查所属 `.folder.md`
*/

export type DevicePreset = 'iPhone' | 'Android' | 'iPad' | 'Desktop' | 'Custom'
export type DevicePresetKey = DevicePreset

export type ComponentType =
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

export interface WorkspaceSnapshot {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
}

export interface PersistedState {
  project: ProjectData
  currentBoardId: string
  selectedComponentId: string | null
  settings: AISettings
  setupCompleted: boolean
}

export type ComponentData = ProtoComponent
export type AiSettings = AISettings

export interface AppState {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
}
