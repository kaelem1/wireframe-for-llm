/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import { create } from 'zustand'
import type {
  AIConfig,
  AIRestoreTestState,
  BoardComponent,
  BoardDocument,
  ComponentInteraction,
  ComponentType,
  Position,
  PreviewState,
  ProjectDocument,
  UIPanelState,
} from '../types/schema'
import { ACTION_OPTIONS, COMPONENT_META, DEFAULT_AI_CONFIG, createEmptyBoard, getDefaultComponentFrame } from '../utils/catalog'
import { clamp, constrainFrame, createId, snapToGrid } from '../utils/geometry'
import { savePersistedState } from '../utils/storage'

enablePatches()

interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
}

interface CreateProjectInput {
  projectName: string
  device: ProjectDocument['device']
  boardSize: ProjectDocument['boardSize']
}

interface EditorState {
  initialized: boolean
  project: ProjectDocument | null
  aiConfig: AIConfig
  selectedBoardId: string | null
  selectedComponentId: string | null
  preview: PreviewState
  panels: UIPanelState
  restoreTest: AIRestoreTestState
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  hydrateState: (payload: { project: ProjectDocument | null; aiConfig: AIConfig } | null) => void
  createProject: (input: CreateProjectInput) => void
  replaceProject: (project: ProjectDocument) => void
  updateProjectName: (name: string) => void
  updateBoardName: (boardId: string, name: string) => void
  selectBoard: (boardId: string) => void
  addBoard: () => void
  deleteBoard: (boardId: string) => void
  moveBoard: (fromIndex: number, toIndex: number) => void
  addComponent: (type: ComponentType, dropPosition?: Position) => void
  updateComponentFrame: (componentId: string, frame: Position & { width: number; height: number }) => void
  renameComponent: (componentId: string, name: string) => void
  deleteSelectedComponent: () => void
  duplicateSelectedComponent: () => void
  selectComponent: (componentId: string | null) => void
  moveComponentLayer: (componentId: string, toIndex: number) => void
  addInteraction: (componentId: string) => void
  updateInteraction: (componentId: string, interactionId: string, patch: Partial<ComponentInteraction>) => void
  removeInteraction: (componentId: string, interactionId: string) => void
  moveSelectedComponentBy: (dx: number, dy: number) => void
  setPreviewActive: (active: boolean) => void
  previewNavigate: (targetBoardId: string) => void
  previewBack: () => void
  previewShowModal: (modalId: string) => void
  previewHideModal: () => void
  setPanelOpen: (panel: keyof UIPanelState, open: boolean) => void
  setAIConfig: (patch: Partial<AIConfig>) => void
  setRestoreTest: (patch: Partial<AIRestoreTestState>) => void
  undo: () => void
  redo: () => void
}

const defaultPreviewState: PreviewState = {
  active: false,
  currentBoardId: null,
  boardStack: [],
  visibleModalId: null,
  animationDirection: null,
}

const defaultPanels: UIPanelState = {
  aiPanelOpen: false,
  settingsOpen: false,
  restoreTestOpen: false,
}

const defaultRestoreTest: AIRestoreTestState = {
  status: 'idle',
  generatedCode: '',
  prompt: '',
  error: null,
}

let persistTimer: number | null = null
let persistenceAttached = false

function getBoard(project: ProjectDocument, boardId: string): BoardDocument {
  const board = project.boards.find((item) => item.id === boardId)
  if (!board) {
    throw new Error(`Board not found: ${boardId}`)
  }
  return board
}

function findSelectedBoard(state: EditorState): BoardDocument {
  if (!state.project || !state.selectedBoardId) {
    throw new Error('No board selected')
  }
  return getBoard(state.project, state.selectedBoardId)
}

function ensureSelectedComponent(board: BoardDocument, componentId: string): BoardComponent {
  const component = board.components.find((item) => item.id === componentId)
  if (!component) {
    throw new Error(`Component not found: ${componentId}`)
  }
  return component
}

function sanitizeSelection(
  project: ProjectDocument | null,
  selectedBoardId: string | null,
  selectedComponentId: string | null,
): Pick<EditorState, 'selectedBoardId' | 'selectedComponentId'> {
  if (!project) {
    return { selectedBoardId: null, selectedComponentId: null }
  }
  const board = project.boards.find((item) => item.id === selectedBoardId) ?? project.boards[0]
  const component = board?.components.find((item) => item.id === selectedComponentId) ?? null
  return {
    selectedBoardId: board?.id ?? null,
    selectedComponentId: component?.id ?? null,
  }
}

function mutateProject(
  set: (updater: (state: EditorState) => Partial<EditorState>) => void,
  recipe: (draft: ProjectDocument) => void,
): void {
  set((state) => {
    if (!state.project) {
      throw new Error('Project not initialized')
    }
    const [project, patches, inversePatches] = produceWithPatches(state.project, recipe)
    return {
      project,
      undoStack: [...state.undoStack, { patches, inversePatches }],
      redoStack: [],
      ...sanitizeSelection(project, state.selectedBoardId, state.selectedComponentId),
    }
  })
}

export const useEditorStore = create<EditorState>((set, get) => ({
  initialized: false,
  project: null,
  aiConfig: DEFAULT_AI_CONFIG,
  selectedBoardId: null,
  selectedComponentId: null,
  preview: defaultPreviewState,
  panels: defaultPanels,
  restoreTest: defaultRestoreTest,
  undoStack: [],
  redoStack: [],
  hydrateState: (payload) => {
    set(() => ({
      initialized: true,
      project: payload?.project ?? null,
      aiConfig: payload?.aiConfig ?? DEFAULT_AI_CONFIG,
      selectedBoardId: payload?.project?.boards[0]?.id ?? null,
      selectedComponentId: null,
      preview: defaultPreviewState,
      panels: defaultPanels,
      restoreTest: defaultRestoreTest,
      undoStack: [],
      redoStack: [],
    }))
  },
  createProject: ({ projectName, device, boardSize }) => {
    const board = createEmptyBoard(0)
    set(() => ({
      initialized: true,
      project: {
        project: projectName.trim() || '未命名项目',
        device,
        boardSize,
        boards: [board],
      },
      selectedBoardId: board.id,
      selectedComponentId: null,
      preview: { ...defaultPreviewState, currentBoardId: board.id, boardStack: [board.id] },
      panels: defaultPanels,
      restoreTest: defaultRestoreTest,
      undoStack: [],
      redoStack: [],
    }))
  },
  replaceProject: (project) => {
    set(() => ({
      initialized: true,
      project,
      selectedBoardId: project.boards[0]?.id ?? null,
      selectedComponentId: null,
      preview: {
        ...defaultPreviewState,
        currentBoardId: project.boards[0]?.id ?? null,
        boardStack: project.boards[0] ? [project.boards[0].id] : [],
      },
      undoStack: [],
      redoStack: [],
    }))
  },
  updateProjectName: (name) => {
    mutateProject(set, (draft) => {
      draft.project = name || '未命名项目'
    })
  },
  updateBoardName: (boardId, name) => {
    mutateProject(set, (draft) => {
      getBoard(draft, boardId).name = name || '未命名画板'
    })
  },
  selectBoard: (boardId) => {
    set(() => ({ selectedBoardId: boardId, selectedComponentId: null }))
  },
  addBoard: () => {
    mutateProject(set, (draft) => {
      draft.boards.push(createEmptyBoard(draft.boards.length))
    })
    const project = get().project
    if (project) {
      const board = project.boards[project.boards.length - 1]
      set(() => ({ selectedBoardId: board.id, selectedComponentId: null }))
    }
  },
  deleteBoard: (boardId) => {
    const project = get().project
    if (!project || project.boards.length === 1) {
      return
    }
    mutateProject(set, (draft) => {
      draft.boards = draft.boards.filter((board) => board.id !== boardId)
    })
  },
  moveBoard: (fromIndex, toIndex) => {
    mutateProject(set, (draft) => {
      const [board] = draft.boards.splice(fromIndex, 1)
      draft.boards.splice(toIndex, 0, board)
    })
  },
  addComponent: (type, dropPosition) => {
    const state = get()
    if (!state.project) {
      throw new Error('Project not initialized')
    }
    const board = findSelectedBoard(state)
    const component = getDefaultComponentFrame(type, board, state.project.boardSize, dropPosition, createId, snapToGrid)
    mutateProject(set, (draft) => {
      getBoard(draft, state.selectedBoardId!).components.push(component)
    })
    set(() => ({ selectedComponentId: component.id }))
  },
  updateComponentFrame: (componentId, frame) => {
    const state = get()
    if (!state.project || !state.selectedBoardId) {
      return
    }
    const board = findSelectedBoard(state)
    const component = ensureSelectedComponent(board, componentId)
    const nextFrame = constrainFrame(component, state.project.boardSize, frame)
    mutateProject(set, (draft) => {
      Object.assign(ensureSelectedComponent(getBoard(draft, state.selectedBoardId!), componentId), nextFrame)
    })
  },
  renameComponent: (componentId, name) => {
    const selectedBoardId = get().selectedBoardId
    if (!selectedBoardId) {
      return
    }
    mutateProject(set, (draft) => {
      ensureSelectedComponent(getBoard(draft, selectedBoardId), componentId).name = name || '未命名组件'
    })
  },
  deleteSelectedComponent: () => {
    const state = get()
    if (!state.selectedBoardId || !state.selectedComponentId) {
      return
    }
    mutateProject(set, (draft) => {
      const board = getBoard(draft, state.selectedBoardId!)
      board.components = board.components.filter((component) => component.id !== state.selectedComponentId)
    })
  },
  duplicateSelectedComponent: () => {
    const state = get()
    if (!state.project || !state.selectedBoardId || !state.selectedComponentId) {
      return
    }
    const board = findSelectedBoard(state)
    const component = ensureSelectedComponent(board, state.selectedComponentId)
    const duplicate: BoardComponent = {
      ...component,
      id: createId('comp'),
      name: `${component.name} 副本`,
      x: COMPONENT_META[component.type].fullWidth ? 0 : clamp(component.x + 16, 0, state.project.boardSize.width - component.width),
      y: clamp(component.y + 16, 0, state.project.boardSize.height - component.height),
      interactions: component.interactions.map((interaction) => ({
        ...interaction,
        id: createId('ia'),
      })),
    }
    mutateProject(set, (draft) => {
      getBoard(draft, state.selectedBoardId!).components.push(duplicate)
    })
    set(() => ({ selectedComponentId: duplicate.id }))
  },
  selectComponent: (componentId) => {
    set(() => ({ selectedComponentId: componentId }))
  },
  moveComponentLayer: (componentId, toIndex) => {
    const state = get()
    if (!state.selectedBoardId) {
      return
    }
    mutateProject(set, (draft) => {
      const board = getBoard(draft, state.selectedBoardId!)
      const fromIndex = board.components.findIndex((component) => component.id === componentId)
      if (fromIndex === -1) {
        return
      }
      const [component] = board.components.splice(fromIndex, 1)
      board.components.splice(toIndex, 0, component)
    })
  },
  addInteraction: (componentId) => {
    const state = get()
    if (!state.selectedBoardId) {
      return
    }
    mutateProject(set, (draft) => {
      const board = getBoard(draft, state.selectedBoardId!)
      const component = ensureSelectedComponent(board, componentId)
      component.interactions.push({
        id: createId('ia'),
        trigger: 'tap',
        action: 'navigate',
        target: draft.boards[0]?.id,
      })
    })
  },
  updateInteraction: (componentId, interactionId, patch) => {
    const state = get()
    if (!state.selectedBoardId) {
      return
    }
    mutateProject(set, (draft) => {
      const board = getBoard(draft, state.selectedBoardId!)
      const interaction = ensureSelectedComponent(board, componentId).interactions.find((item) => item.id === interactionId)
      if (!interaction) {
        throw new Error(`Interaction not found: ${interactionId}`)
      }
      Object.assign(interaction, patch)
      if (interaction.action === ACTION_OPTIONS[1].value) {
        delete interaction.target
      }
    })
  },
  removeInteraction: (componentId, interactionId) => {
    const state = get()
    if (!state.selectedBoardId) {
      return
    }
    mutateProject(set, (draft) => {
      const board = getBoard(draft, state.selectedBoardId!)
      const component = ensureSelectedComponent(board, componentId)
      component.interactions = component.interactions.filter((interaction) => interaction.id !== interactionId)
    })
  },
  moveSelectedComponentBy: (dx, dy) => {
    const state = get()
    if (!state.project || !state.selectedBoardId || !state.selectedComponentId) {
      return
    }
    const board = findSelectedBoard(state)
    const component = ensureSelectedComponent(board, state.selectedComponentId)
    const meta = COMPONENT_META[component.type]
    const nextX = meta.fullWidth || meta.dock === 'top' || meta.dock === 'bottom'
      ? component.x
      : clamp(component.x + dx, 0, state.project.boardSize.width - component.width)
    const nextY = meta.dock === 'top'
      ? 0
      : meta.dock === 'bottom'
        ? state.project.boardSize.height - component.height
        : clamp(component.y + dy, 0, state.project.boardSize.height - component.height)
    mutateProject(set, (draft) => {
      const draftComponent = ensureSelectedComponent(getBoard(draft, state.selectedBoardId!), state.selectedComponentId!)
      draftComponent.x = nextX
      draftComponent.y = nextY
    })
  },
  setPreviewActive: (active) => {
    const boardId = get().selectedBoardId
    set((state) => ({
      preview: active && boardId
        ? { active: true, currentBoardId: boardId, boardStack: [boardId], visibleModalId: null, animationDirection: null }
        : defaultPreviewState,
      panels: active
        ? { ...state.panels, aiPanelOpen: false, settingsOpen: false }
        : state.panels,
    }))
  },
  previewNavigate: (targetBoardId) => {
    set((state) => ({
      preview: {
        ...state.preview,
        currentBoardId: targetBoardId,
        boardStack: [...state.preview.boardStack, targetBoardId],
        visibleModalId: null,
        animationDirection: 'forward',
      },
    }))
  },
  previewBack: () => {
    const preview = get().preview
    if (preview.boardStack.length <= 1) {
      return
    }
    const boardStack = preview.boardStack.slice(0, -1)
    set(() => ({
      preview: {
        ...preview,
        boardStack,
        currentBoardId: boardStack[boardStack.length - 1] ?? null,
        visibleModalId: null,
        animationDirection: 'back',
      },
    }))
  },
  previewShowModal: (modalId) => {
    set((state) => ({
      preview: { ...state.preview, visibleModalId: modalId },
    }))
  },
  previewHideModal: () => {
    set((state) => ({
      preview: { ...state.preview, visibleModalId: null },
    }))
  },
  setPanelOpen: (panel, open) => {
    set((state) => ({
      panels: {
        ...state.panels,
        [panel]: open,
      },
    }))
  },
  setAIConfig: (patch) => {
    set((state) => ({
      aiConfig: {
        ...state.aiConfig,
        ...patch,
      },
    }))
  },
  setRestoreTest: (patch) => {
    set((state) => ({
      restoreTest: {
        ...state.restoreTest,
        ...patch,
      },
    }))
  },
  undo: () => {
    set((state) => {
      if (!state.project || state.undoStack.length === 0) {
        return {}
      }
      const entry = state.undoStack[state.undoStack.length - 1]
      const project = applyPatches(state.project, entry.inversePatches)
      return {
        project,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
        ...sanitizeSelection(project, state.selectedBoardId, state.selectedComponentId),
      }
    })
  },
  redo: () => {
    set((state) => {
      if (!state.project || state.redoStack.length === 0) {
        return {}
      }
      const entry = state.redoStack[state.redoStack.length - 1]
      const project = applyPatches(state.project, entry.patches)
      return {
        project,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, entry],
        ...sanitizeSelection(project, state.selectedBoardId, state.selectedComponentId),
      }
    })
  },
}))

export function attachEditorStorePersistence(): void {
  if (persistenceAttached) {
    return
  }
  persistenceAttached = true
  useEditorStore.subscribe((state) => {
    if (!state.initialized) {
      return
    }
    if (persistTimer !== null) {
      window.clearTimeout(persistTimer)
    }
    persistTimer = window.setTimeout(() => {
      savePersistedState({
        project: state.project,
        aiConfig: state.aiConfig,
      })
    }, 500)
  })
}
