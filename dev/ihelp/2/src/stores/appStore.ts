/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import { create } from 'zustand'
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_PROJECT_NAME,
} from '../utils/constants'
import {
  clamp,
  createBoard,
  createComponent,
  createId,
  createProject,
  duplicateComponent,
  exportProjectJson,
  findComponentById,
  getBoardById,
  getNextBoardName,
  loadPersistedState,
  normalizeComponent,
  normalizeComponentFrame,
  parseProjectJson,
  reorderList,
  snap,
} from '../utils/project'
import type {
  AISettings,
  BoardSize,
  ComponentType,
  DevicePresetKey,
  GenerationState,
  Interaction,
  ProjectData,
  ProtoComponent,
  RestoreTestResult,
  WorkspaceSnapshot,
} from '../types/schema'

enablePatches()

type PreviewDirection = 'forward' | 'back' | null

type HistoryState = {
  project: ProjectData | null
  activeBoardId: string | null
  selectedComponentId: string | null
}

type HistoryEntry = {
  patches: Patch[]
  inversePatches: Patch[]
}

type StoreState = {
  project: ProjectData | null
  settings: AISettings
  activeBoardId: string | null
  selectedComponentId: string | null
  editingComponentId: string | null
  isPreview: boolean
  previewBoardStack: string[]
  previewModalId: string | null
  previewDirection: PreviewDirection
  restoreTestResult: RestoreTestResult
  aiPrompt: string
  isAiPanelOpen: boolean
  isSettingsOpen: boolean
  generation: GenerationState
  history: {
    past: HistoryEntry[]
    future: HistoryEntry[]
  }
  loadWorkspace: (snapshot: WorkspaceSnapshot | null) => void
  getWorkspaceSnapshot: () => WorkspaceSnapshot
  initializeProject: (
    projectName: string,
    device: DevicePresetKey,
    boardSize?: BoardSize,
  ) => void
  replaceProject: (project: ProjectData) => void
  importProjectJson: (jsonText: string) => void
  setSettings: (settings: Partial<AISettings>) => void
  setShowAI: (open: boolean) => void
  setShowSettings: (open: boolean) => void
  setAiPrompt: (prompt: string) => void
  setGenerationState: (generation: GenerationState) => void
  setRestoreTestResult: (result: RestoreTestResult) => void
  setProjectName: (name: string) => void
  setActiveBoardId: (boardId: string) => void
  selectComponent: (componentId: string | null) => void
  setEditingComponentId: (componentId: string | null) => void
  addBoard: () => void
  deleteBoard: (boardId: string) => void
  reorderBoards: (fromIndex: number, toIndex: number) => void
  updateBoardName: (boardId: string, name: string) => void
  addComponent: (type: ComponentType, position?: { x: number; y: number }) => void
  updateComponent: (
    componentId: string,
    updates: Partial<Pick<ProtoComponent, 'name' | 'x' | 'y' | 'width' | 'height'>>,
  ) => void
  reorderComponents: (boardId: string, fromIndex: number, toIndex: number) => void
  deleteComponent: (componentId: string) => void
  duplicateComponent: (componentId: string) => void
  addInteraction: (componentId: string) => void
  setInteraction: (
    componentId: string,
    interactionId: string,
    updates: Pick<Interaction, 'trigger' | 'action'> & { target?: string },
  ) => void
  removeInteraction: (componentId: string, interactionId: string) => void
  moveSelectedBy: (deltaX: number, deltaY: number) => void
  togglePreview: () => void
  openPreview: () => void
  closePreview: () => void
  navigatePreview: (boardId: string) => void
  backPreview: () => void
  showPreviewModal: (componentId: string | null) => void
  replaceBoardsFromAI: (project: ProjectData) => void
  exportProjectJson: () => string
  undo: () => void
  redo: () => void
}

const persisted = loadPersistedState()
const previewReset = {
  isPreview: false,
  previewBoardStack: [] as string[],
  previewModalId: null,
  previewDirection: null as PreviewDirection,
}

function getHistoryState(state: StoreState): HistoryState {
  return {
    project: state.project,
    activeBoardId: state.activeBoardId,
    selectedComponentId: state.selectedComponentId,
  }
}

function getActiveBoard(project: ProjectData, activeBoardId: string | null) {
  return (activeBoardId ? getBoardById(project, activeBoardId) : null) ?? project.boards[0] ?? null
}

function defaultInteraction(project: ProjectData, componentId: string): Interaction {
  const source = findComponentById(project, componentId)
  const currentBoardId = source?.board.id
  const nextBoard = project.boards.find((board) => board.id !== currentBoardId)

  return {
    id: createId('interaction'),
    trigger: 'tap',
    action: nextBoard ? 'navigate' : 'back',
    target: nextBoard?.id,
  }
}

export const useAppStore = create<StoreState>((set, get) => {
  function commit(recipe: (draft: HistoryState) => void) {
    const base = getHistoryState(get())
    const [next, patches, inversePatches] = produceWithPatches(base, recipe)

    if (!patches.length) {
      return
    }

    set((state) => ({
      project: next.project,
      activeBoardId: next.activeBoardId,
      selectedComponentId: next.selectedComponentId,
      editingComponentId: null,
      ...previewReset,
      history: {
        past: [...state.history.past, { patches, inversePatches }],
        future: [],
      },
    }))
  }

  return {
    project: persisted?.project ?? null,
    settings: persisted?.settings ?? DEFAULT_AI_SETTINGS,
    activeBoardId: persisted?.currentBoardId ?? null,
    selectedComponentId: persisted?.selectedComponentId ?? null,
    editingComponentId: null,
    ...previewReset,
    restoreTestResult: {
      status: 'idle',
      code: '',
      html: '',
      error: null,
    },
    aiPrompt: '',
    isAiPanelOpen: false,
    isSettingsOpen: false,
    generation: {
      status: 'idle',
      error: null,
    },
    history: {
      past: [],
      future: [],
    },
    loadWorkspace: (snapshot) =>
      set({
        project: snapshot?.project ?? null,
        settings: snapshot?.settings ?? DEFAULT_AI_SETTINGS,
        activeBoardId: snapshot?.activeBoardId ?? snapshot?.project?.boards[0]?.id ?? null,
        selectedComponentId: null,
        editingComponentId: null,
        history: { past: [], future: [] },
        ...previewReset,
      }),
    getWorkspaceSnapshot: () => {
      const state = get()
      return {
        project: state.project,
        settings: state.settings,
        activeBoardId: state.activeBoardId,
      }
    },
    initializeProject: (projectName, device, boardSize) => {
      const project = createProject(projectName || DEFAULT_PROJECT_NAME, device, boardSize)
      set({
        project,
        activeBoardId: project.boards[0]?.id ?? null,
        selectedComponentId: null,
        editingComponentId: null,
        history: { past: [], future: [] },
        generation: { status: 'idle', error: null },
        restoreTestResult: { status: 'idle', code: '', html: '', error: null },
        ...previewReset,
      })
    },
    replaceProject: (project) =>
      set({
        project,
        activeBoardId: project.boards[0]?.id ?? null,
        selectedComponentId: null,
        editingComponentId: null,
        history: { past: [], future: [] },
        generation: { status: 'idle', error: null },
        restoreTestResult: { status: 'idle', code: '', html: '', error: null },
        ...previewReset,
      }),
    importProjectJson: (jsonText) => get().replaceProject(parseProjectJson(jsonText)),
    setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
    setShowAI: (isAiPanelOpen) => set({ isAiPanelOpen }),
    setShowSettings: (isSettingsOpen) => set({ isSettingsOpen }),
    setAiPrompt: (aiPrompt) => set({ aiPrompt }),
    setGenerationState: (generation) => set({ generation }),
    setRestoreTestResult: (restoreTestResult) => set({ restoreTestResult }),
    setProjectName: (name) =>
      commit((draft) => {
        if (draft.project) {
          draft.project.project = name || DEFAULT_PROJECT_NAME
        }
      }),
    setActiveBoardId: (boardId) =>
      set((state) => ({
        activeBoardId: boardId,
        selectedComponentId: null,
        editingComponentId: null,
        ...(state.isPreview ? previewReset : {}),
      })),
    selectComponent: (selectedComponentId) => set({ selectedComponentId }),
    setEditingComponentId: (editingComponentId) => set({ editingComponentId }),
    addBoard: () =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = createBoard(getNextBoardName(draft.project))
        draft.project.boards.push(board)
        draft.activeBoardId = board.id
        draft.selectedComponentId = null
      }),
    deleteBoard: (boardId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        if (draft.project.boards.length === 1) {
          return
        }
        const index = draft.project.boards.findIndex((board) => board.id === boardId)
        if (index < 0) {
          return
        }
        draft.project.boards.splice(index, 1)
        draft.activeBoardId =
          draft.project.boards[Math.max(0, index - 1)]?.id ?? draft.project.boards[0]?.id ?? null
        draft.selectedComponentId = null
      }),
    reorderBoards: (fromIndex, toIndex) =>
      commit((draft) => {
        if (!draft.project || fromIndex === toIndex) {
          return
        }
        draft.project.boards = reorderList(draft.project.boards, fromIndex, toIndex)
      }),
    updateBoardName: (boardId, name) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = getBoardById(draft.project, boardId)
        if (board) {
          board.name = name || '未命名画板'
        }
      }),
    addComponent: (type, position) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = getActiveBoard(draft.project, draft.activeBoardId)
        if (!board) {
          return
        }
        const component = createComponent(type, board, draft.project.boardSize, position)
        board.components.push(component)
        draft.activeBoardId = board.id
        draft.selectedComponentId = component.id
      }),
    updateComponent: (componentId, updates) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        if (!found) {
          return
        }
        if (typeof updates.name === 'string') {
          found.component.name = updates.name || found.component.name
        }
        if (
          typeof updates.x === 'number' ||
          typeof updates.y === 'number' ||
          typeof updates.width === 'number' ||
          typeof updates.height === 'number'
        ) {
          const frame = normalizeComponentFrame(
            found.component.type,
            {
              x: updates.x ?? found.component.x,
              y: updates.y ?? found.component.y,
              width: updates.width ?? found.component.width,
              height: updates.height ?? found.component.height,
            },
            draft.project.boardSize,
          )
          Object.assign(found.component, frame)
        }
      }),
    reorderComponents: (boardId, fromIndex, toIndex) =>
      commit((draft) => {
        if (!draft.project || fromIndex === toIndex) {
          return
        }
        const board = getBoardById(draft.project, boardId)
        if (!board) {
          return
        }
        board.components = reorderList(board.components, fromIndex, toIndex)
      }),
    deleteComponent: (componentId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        if (!found) {
          return
        }
        found.board.components.splice(found.index, 1)
        if (draft.selectedComponentId === componentId) {
          draft.selectedComponentId = null
        }
      }),
    duplicateComponent: (componentId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        if (!found) {
          return
        }
        const copy = duplicateComponent(found.component, draft.project.boardSize)
        found.board.components.push(copy)
        draft.selectedComponentId = copy.id
      }),
    addInteraction: (componentId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        if (!found) {
          return
        }
        found.component.interactions.push(defaultInteraction(draft.project, componentId))
      }),
    setInteraction: (componentId, interactionId, updates) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        const interaction = found?.component.interactions.find((item) => item.id === interactionId)
        if (!interaction) {
          return
        }
        interaction.trigger = updates.trigger
        interaction.action = updates.action
        interaction.target = updates.target
      }),
    removeInteraction: (componentId, interactionId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const found = findComponentById(draft.project, componentId)
        if (!found) {
          return
        }
        found.component.interactions = found.component.interactions.filter(
          (interaction) => interaction.id !== interactionId,
        )
      }),
    moveSelectedBy: (deltaX, deltaY) =>
      commit((draft) => {
        if (!draft.project || !draft.selectedComponentId) {
          return
        }
        const found = findComponentById(draft.project, draft.selectedComponentId)
        if (!found) {
          return
        }
        found.component.x = clamp(
          snap(found.component.x + deltaX),
          0,
          draft.project.boardSize.width - found.component.width,
        )
        found.component.y = clamp(
          snap(found.component.y + deltaY),
          0,
          draft.project.boardSize.height - found.component.height,
        )
        Object.assign(found.component, normalizeComponent(found.component, draft.project.boardSize))
      }),
    togglePreview: () => {
      const state = get()
      if (state.isPreview) {
        state.closePreview()
      } else {
        state.openPreview()
      }
    },
    openPreview: () =>
      set((state) => {
        if (!state.project) {
          return state
        }
        const activeBoard = getActiveBoard(state.project, state.activeBoardId)
        if (!activeBoard) {
          return state
        }
        return {
          isPreview: true,
          previewBoardStack: [activeBoard.id],
          previewModalId: null,
          previewDirection: null,
        }
      }),
    closePreview: () => set(previewReset),
    navigatePreview: (boardId) =>
      set((state) => {
        if (!state.isPreview || !state.project || !getBoardById(state.project, boardId)) {
          return state
        }
        return {
          previewBoardStack: [...state.previewBoardStack, boardId],
          previewModalId: null,
          previewDirection: 'forward',
        }
      }),
    backPreview: () =>
      set((state) => {
        if (!state.isPreview || state.previewBoardStack.length <= 1) {
          return state
        }
        return {
          previewBoardStack: state.previewBoardStack.slice(0, -1),
          previewModalId: null,
          previewDirection: 'back',
        }
      }),
    showPreviewModal: (previewModalId) => set({ previewModalId }),
    replaceBoardsFromAI: (project) =>
      commit((draft) => {
        if (!draft.project) {
          draft.project = project
          draft.activeBoardId = project.boards[0]?.id ?? null
          draft.selectedComponentId = null
          return
        }
        draft.project.project = project.project
        draft.project.device = project.device
        draft.project.boardSize = project.boardSize
        draft.project.boards = project.boards
        draft.activeBoardId = project.boards[0]?.id ?? null
        draft.selectedComponentId = null
      }),
    exportProjectJson: () => {
      const project = get().project
      if (!project) {
        throw new Error('项目尚未初始化')
      }
      return exportProjectJson(project)
    },
    undo: () =>
      set((state) => {
        const entry = state.history.past.at(-1)
        if (!entry) {
          return state
        }
        const reverted = applyPatches(getHistoryState(state), entry.inversePatches) as HistoryState
        return {
          ...state,
          ...reverted,
          editingComponentId: null,
          ...previewReset,
          history: {
            past: state.history.past.slice(0, -1),
            future: [entry, ...state.history.future],
          },
        }
      }),
    redo: () =>
      set((state) => {
        const entry = state.history.future[0]
        if (!entry) {
          return state
        }
        const next = applyPatches(getHistoryState(state), entry.patches) as HistoryState
        return {
          ...state,
          ...next,
          editingComponentId: null,
          ...previewReset,
          history: {
            past: [...state.history.past, entry],
            future: state.history.future.slice(1),
          },
        }
      }),
  }
})
