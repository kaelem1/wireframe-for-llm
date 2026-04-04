/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

export type DeviceType = 'iPhone' | 'Android' | 'iPad' | 'Desktop' | 'Custom'

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

export type PreviewAnimationDirection = 'forward' | 'back' | null

export interface Size {
  width: number
  height: number
}

export interface Position {
  x: number
  y: number
}

export interface ComponentInteraction {
  id: string
  trigger: InteractionTrigger
  action: InteractionAction
  target?: string
}

export interface BoardComponent extends Position, Size {
  id: string
  type: ComponentType
  name: string
  interactions: ComponentInteraction[]
}

export interface BoardDocument {
  id: string
  name: string
  components: BoardComponent[]
}

export interface ProjectDocument {
  project: string
  device: DeviceType
  boardSize: Size
  boards: BoardDocument[]
}

export interface DevicePreset extends Size {
  id: DeviceType
  label: string
}

export interface ComponentMeta {
  type: ComponentType
  label: string
  icon: string
  defaultSize: Size
  minSize: Size
  fullWidth: boolean
  dock: 'top' | 'bottom' | 'center' | null
}

export interface AlignmentGuide {
  axis: 'x' | 'y'
  value: number
}

export interface SnapResult {
  frame: Position & Size
  guides: AlignmentGuide[]
}

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AIRestoreTestState {
  status: 'idle' | 'running' | 'success' | 'error'
  generatedCode: string
  prompt: string
  error: string | null
}

export interface PreviewState {
  active: boolean
  currentBoardId: string | null
  boardStack: string[]
  visibleModalId: string | null
  animationDirection: PreviewAnimationDirection
}

export interface UIPanelState {
  aiPanelOpen: boolean
  settingsOpen: boolean
  restoreTestOpen: boolean
}

export interface PersistedState {
  project: ProjectDocument | null
  aiConfig: AIConfig
}
