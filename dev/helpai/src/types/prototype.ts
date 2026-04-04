/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'custom'
export type ElementType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'image_placeholder'
export type ToolType = 'select' | ElementType
export type InteractionAction =
  | 'navigateTo'
  | 'goBack'
  | 'toggleState'
  | 'showHide'

export interface Size {
  width: number
  height: number
}

export interface DevicePreset {
  id: string
  label: string
  deviceType: DeviceType
  description: string
  size: Size
}

export interface ToggleStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface PrototypeInteraction {
  id: string
  trigger: 'onClick'
  action: InteractionAction
  targetBoardId: string | null
  targetElementId: string | null
}

export interface PrototypeElement {
  id: string
  name: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
  opacity: number
  text: string
  fontSize: number
  visible: boolean
  interactions: PrototypeInteraction[]
  stateStyle: ToggleStyle
}

export interface PrototypeBoard {
  id: string
  name: string
  width: number
  height: number
  elements: PrototypeElement[]
}

export interface ProjectSnapshot {
  id: string
  name: string
  deviceType: DeviceType
  artboardSize: Size
  boards: PrototypeBoard[]
  createdAt: string
  updatedAt: string
}

export interface PrototypeProject extends ProjectSnapshot {
  history: {
    past: ProjectSnapshot[]
    future: ProjectSnapshot[]
  }
}

export interface LlmSettings {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export interface PersistedAppState {
  projects: PrototypeProject[]
  currentProjectId: string | null
  currentBoardId: string | null
  showSemanticLabels: boolean
  settings: LlmSettings
}

export interface PrimitiveLayoutElement {
  type: ElementType
  name: string
  x: number
  y: number
  width: number
  height: number
  cornerRadius?: number
  text?: string
  fontSize?: number
}

export interface ExportedElement {
  id: string
  name: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  cornerRadius?: number
  label?: string
  fontSize?: number
  interactions: Array<{
    trigger: 'onClick'
    action: InteractionAction
    target: string | null
  }>
}

export interface ExportedScreen {
  id: string
  name: string
  elements: ExportedElement[]
}

export interface AiExportBundle {
  project: {
    name: string
    deviceType: DeviceType
    artboardSize: Size
  }
  screens: ExportedScreen[]
  navigationFlow: Array<{
    from: string
    element: string
    action: InteractionAction
    to: string | null
  }>
}

export interface AiExportArtifacts {
  json: AiExportBundle
  markdown: string
}

export interface AlignmentRow {
  screenName: string
  elementName: string
  original: Pick<ExportedElement, 'type' | 'x' | 'y' | 'width' | 'height'> & {
    interactions: string[]
  }
  interpreted: Pick<
    ExportedElement,
    'type' | 'x' | 'y' | 'width' | 'height'
  > & {
    interactions: string[]
  } | null
  layoutMatched: boolean
  interactionMatched: boolean
  notes: string[]
}

export interface AlignmentReport {
  layoutScore: number
  interactionScore: number
  overallScore: number
  rows: AlignmentRow[]
}

export interface PreviewSession {
  currentBoardId: string
  history: string[]
  direction: 'idle' | 'forward' | 'backward'
  visibility: Record<string, boolean>
  toggled: Record<string, boolean>
}

export interface AppState extends PersistedAppState {
  activeTool: ToolType
  selectedElementId: string | null
  selectedBoardId: string | null
  saveNow: () => void
  createProject: (input: {
    name: string
    deviceType: DeviceType
    artboardSize: Size
  }) => string
  openProject: (projectId: string) => void
  closeProject: () => void
  deleteProject: (projectId: string) => void
  duplicateProject: (projectId: string) => void
  importProject: (payload: string) => string
  exportProject: (projectId: string) => string
  renameProject: (name: string) => void
  setActiveTool: (tool: ToolType) => void
  setSelectedElement: (boardId: string | null, elementId: string | null) => void
  setShowSemanticLabels: (value: boolean) => void
  updateSettings: (patch: Partial<LlmSettings>) => void
  addBoard: (name?: string) => string | null
  renameBoard: (boardId: string, name: string) => void
  selectBoard: (boardId: string) => void
  addElement: (
    boardId: string,
    type: ElementType,
    point: { x: number; y: number },
    overrides?: Partial<PrototypeElement>,
  ) => string | null
  addGeneratedBoard: (name: string, elements: PrimitiveLayoutElement[]) => string | null
  updateElement: (
    boardId: string,
    elementId: string,
    patch: Partial<PrototypeElement>,
  ) => void
  deleteElement: (boardId: string, elementId: string) => void
  duplicateElement: (boardId: string, elementId: string) => void
  moveElementLayer: (
    boardId: string,
    elementId: string,
    direction: 'forward' | 'backward',
  ) => void
  addInteraction: (boardId: string, elementId: string) => void
  updateInteraction: (
    boardId: string,
    elementId: string,
    interactionId: string,
    patch: Partial<PrototypeInteraction>,
  ) => void
  removeInteraction: (
    boardId: string,
    elementId: string,
    interactionId: string,
  ) => void
  undo: () => void
  redo: () => void
}
