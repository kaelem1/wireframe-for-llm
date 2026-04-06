/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前把单一 wireframe 工作态、浏览器语言派生的 locale、编辑命令与多选状态并入同一 store
3. 画布始终运行在线框编辑态，不再维护 on/off 双快照切换
4. 待放置组件持续保留，直到显式切换、取消或选中画布组件
5. 当前支持画板整板复制
6. 当前支持多选复制与粘贴复用
7. preview 特性已删除，不再维护 preview 状态
8. 待放置期间禁用其他图层选中入口
9. 更新后检查所属 `.folder.md`
*/

import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import { create } from 'zustand'
import { DEFAULT_AI_SETTINGS, DEFAULT_PROJECT_NAME } from '../utils/constants'
import { detectBrowserLocale, getUntitledBoardName, t } from '../utils/i18n'
import {
  clamp,
  createBoard,
  createComponent,
  createId,
  createProject,
  duplicateBoard,
  duplicateComponent,
  exportProjectJson,
  findComponentById,
  getBoardById,
  getNextBoardName,
  getNextComponentName,
  getPlacedComponentFrame,
  normalizeComponent,
  normalizeComponentFrame,
  parseProjectJson,
  reorderList,
  snap,
} from '../utils/project'
import { loadWorkspaceSnapshot } from '../utils/storage'
import type {
  AISettings,
  BoardSize,
  ComponentType,
  DevicePresetKey,
  GenerationState,
  Interaction,
  Locale,
  ProjectData,
  ProtoComponent,
  RestoreTestResult,
  WireframeState,
  WorkspaceSnapshot,
} from '../types/schema'

enablePatches()

type HistoryState = {
  project: ProjectData | null
  activeBoardId: string | null
  selectedComponentId: string | null
  selectedComponentIds: string[]
  pendingComponentType: ComponentType | null
}

type HistoryEntry = {
  patches: Patch[]
  inversePatches: Patch[]
}

type StoreState = {
  project: ProjectData | null
  settings: AISettings
  locale: Locale
  activeBoardId: string | null
  selectedComponentId: string | null
  selectedComponentIds: string[]
  editingComponentId: string | null
  pendingComponentType: ComponentType | null
  wireframe: WireframeState
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
  selectComponents: (componentIds: string[]) => void
  setEditingComponentId: (componentId: string | null) => void
  setPendingComponentType: (type: ComponentType | null) => void
  addBoard: () => void
  duplicateBoard: (boardId: string) => void
  deleteBoard: (boardId: string) => void
  reorderBoards: (fromIndex: number, toIndex: number) => void
  updateBoardName: (boardId: string, name: string) => void
  addComponent: (type: ComponentType, position?: { x: number; y: number }) => void
  placeComponent: (
    type: ComponentType,
    frame: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  ) => void
  updateComponent: (
    componentId: string,
    updates: Partial<Pick<ProtoComponent, 'name' | 'x' | 'y' | 'width' | 'height'>>,
  ) => void
  updateComponentFrames: (
    updates: Array<Pick<ProtoComponent, 'id' | 'x' | 'y' | 'width' | 'height'>>,
  ) => void
  reorderComponents: (boardId: string, fromIndex: number, toIndex: number) => void
  deleteComponent: (componentId: string) => void
  deleteSelectedComponents: () => void
  duplicateComponent: (componentId: string) => void
  duplicateComponents: (componentIds: string[], offset?: { x: number; y: number }) => string[]
  pasteComponents: (components: ProtoComponent[], offset?: { x: number; y: number }) => string[]
  addInteraction: (componentId: string) => void
  setInteraction: (
    componentId: string,
    interactionId: string,
    updates: Pick<Interaction, 'trigger' | 'action'> & { target?: string },
  ) => void
  removeInteraction: (componentId: string, interactionId: string) => void
  moveSelectedBy: (deltaX: number, deltaY: number) => void
  replaceBoardsFromAI: (project: ProjectData) => void
  exportProjectJson: () => string
  undo: () => void
  redo: () => void
}

const detectedLocale = detectBrowserLocale()
const persisted = loadWorkspaceSnapshot()

function createDefaultWireframeState(): WireframeState {
  return {
    purpose: '',
  }
}

function resetEditingState() {
  return {
    selectedComponentId: null,
    selectedComponentIds: [] as string[],
    editingComponentId: null,
    pendingComponentType: null as ComponentType | null,
  }
}

function getHistoryState(state: StoreState): HistoryState {
  return {
    project: state.project,
    activeBoardId: state.activeBoardId,
    selectedComponentId: state.selectedComponentId,
    selectedComponentIds: state.selectedComponentIds,
    pendingComponentType: state.pendingComponentType,
  }
}

function getActiveBoard(project: ProjectData, activeBoardId: string | null) {
  return (activeBoardId ? getBoardById(project, activeBoardId) : null) ?? project.boards[0] ?? null
}

function getSelectedComponents(project: ProjectData, componentIds: string[]) {
  return componentIds
    .map((componentId) => findComponentById(project, componentId))
    .filter((found): found is NonNullable<typeof found> => Boolean(found))
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
      selectedComponentIds: next.selectedComponentIds,
      pendingComponentType: next.pendingComponentType,
      editingComponentId: null,
      history: {
        past: [...state.history.past, { patches, inversePatches }],
        future: [],
      },
    }))
  }

  return {
    project: persisted?.project ?? null,
    settings: persisted?.settings ?? DEFAULT_AI_SETTINGS,
    locale: detectedLocale,
    activeBoardId: persisted?.activeBoardId ?? null,
    selectedComponentId: null,
    selectedComponentIds: [],
    editingComponentId: null,
    pendingComponentType: null,
    wireframe: persisted?.wireframe ?? createDefaultWireframeState(),
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
        locale: detectBrowserLocale(),
        activeBoardId: snapshot?.activeBoardId ?? snapshot?.project?.boards[0]?.id ?? null,
        wireframe: snapshot?.wireframe ?? createDefaultWireframeState(),
        ...resetEditingState(),
        history: { past: [], future: [] },
      }),
    getWorkspaceSnapshot: () => {
      const state = get()
      return {
        project: state.project,
        settings: state.settings,
        activeBoardId: state.activeBoardId,
        wireframe: state.wireframe,
        locale: state.locale,
      }
    },
    initializeProject: (projectName, device, boardSize) => {
      const locale = get().locale
      const project = createProject(projectName || DEFAULT_PROJECT_NAME, device, boardSize, locale)
      set({
        project,
        activeBoardId: project.boards[0]?.id ?? null,
        wireframe: createDefaultWireframeState(),
        ...resetEditingState(),
        history: { past: [], future: [] },
        generation: { status: 'idle', error: null },
        restoreTestResult: { status: 'idle', code: '', html: '', error: null },
      })
    },
    replaceProject: (project) =>
      set({
        project,
        activeBoardId: project.boards[0]?.id ?? null,
        wireframe: createDefaultWireframeState(),
        ...resetEditingState(),
        history: { past: [], future: [] },
        generation: { status: 'idle', error: null },
        restoreTestResult: { status: 'idle', code: '', html: '', error: null },
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
      set({
        activeBoardId: boardId,
        ...resetEditingState(),
      }),
    selectComponent: (selectedComponentId) =>
      {
        if (get().pendingComponentType) {
          return
        }

        set({
          selectedComponentId,
          selectedComponentIds: selectedComponentId ? [selectedComponentId] : [],
          pendingComponentType: null,
        })
      },
    selectComponents: (selectedComponentIds) =>
      {
        if (get().pendingComponentType) {
          return
        }

        set({
          selectedComponentId: selectedComponentIds.at(-1) ?? null,
          selectedComponentIds,
          editingComponentId: null,
          pendingComponentType: null,
        })
      },
    setEditingComponentId: (editingComponentId) => set({ editingComponentId }),
    setPendingComponentType: (pendingComponentType) =>
      set({
        pendingComponentType,
        selectedComponentId: null,
        selectedComponentIds: [],
        editingComponentId: null,
      }),
    addBoard: () =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = createBoard(getNextBoardName(draft.project, get().locale))
        draft.project.boards.push(board)
        draft.activeBoardId = board.id
        draft.selectedComponentId = null
        draft.selectedComponentIds = []
      }),
    duplicateBoard: (boardId) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = duplicateBoard(draft.project, boardId, get().locale)
        if (!board) {
          return
        }
        draft.project.boards.push(board)
        draft.activeBoardId = board.id
        draft.selectedComponentId = null
        draft.selectedComponentIds = []
      }),
    deleteBoard: (boardId) =>
      commit((draft) => {
        if (!draft.project || draft.project.boards.length === 1) {
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
        draft.selectedComponentIds = []
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
        const nextName = name || getUntitledBoardName(get().locale)
        if (board && !draft.project.boards.some((item) => item.id !== boardId && item.name === nextName)) {
          board.name = nextName
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
        const component = createComponent(type, board, draft.project.boardSize, position, get().locale)
        board.components.push(component)
        draft.activeBoardId = board.id
        draft.selectedComponentId = component.id
        draft.selectedComponentIds = [component.id]
      }),
    placeComponent: (type, frame) =>
      commit((draft) => {
        if (!draft.project) {
          return
        }
        const board = getActiveBoard(draft.project, draft.activeBoardId)
        if (!board) {
          return
        }
        const placedFrame = getPlacedComponentFrame(type, frame, draft.project.boardSize)
        const component = createComponent(type, board, draft.project.boardSize, undefined, get().locale)
        Object.assign(component, placedFrame)
        board.components.push(component)
        draft.activeBoardId = board.id
        draft.selectedComponentId = component.id
        draft.selectedComponentIds = [component.id]
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
          found.component.name = getNextComponentName(
            found.board,
            updates.name || found.component.name,
            found.component.id,
          )
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
    updateComponentFrames: (updates) =>
      commit((draft) => {
        if (!draft.project || updates.length === 0) {
          return
        }

        for (const item of updates) {
          const found = findComponentById(draft.project, item.id)
          if (!found) {
            continue
          }

          Object.assign(
            found.component,
            normalizeComponentFrame(
              found.component.type,
              {
                x: item.x,
                y: item.y,
                width: item.width,
                height: item.height,
              },
              draft.project.boardSize,
            ),
          )
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
        if (
          draft.selectedComponentId === componentId ||
          draft.selectedComponentIds.includes(componentId)
        ) {
          draft.selectedComponentId = null
          draft.selectedComponentIds = []
        }
      }),
    deleteSelectedComponents: () =>
      commit((draft) => {
        if (!draft.project || draft.selectedComponentIds.length === 0) {
          return
        }

        for (const board of draft.project.boards) {
          board.components = board.components.filter(
            (component) => !draft.selectedComponentIds.includes(component.id),
          )
        }

        draft.selectedComponentId = null
        draft.selectedComponentIds = []
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
        const copy = duplicateComponent(found.component, draft.project.boardSize, get().locale)
        copy.name = getNextComponentName(found.board, copy.name)
        found.board.components.push(copy)
        draft.selectedComponentId = copy.id
        draft.selectedComponentIds = [copy.id]
      }),
    duplicateComponents: (componentIds, offset = { x: 0, y: 0 }) => {
      let nextIds: string[] = []

      commit((draft) => {
        if (!draft.project || componentIds.length === 0) {
          return
        }

        for (const componentId of componentIds) {
          const found = findComponentById(draft.project, componentId)
          if (!found) {
            continue
          }

          const copy = duplicateComponent(found.component, draft.project.boardSize, get().locale, offset)
          copy.name = getNextComponentName(found.board, copy.name)
          found.board.components.push(copy)
          nextIds.push(copy.id)
        }

        draft.selectedComponentId = nextIds.at(-1) ?? null
        draft.selectedComponentIds = nextIds
      })

      return nextIds
    },
    pasteComponents: (components, offset = { x: 16, y: 16 }) => {
      let nextIds: string[] = []

      commit((draft) => {
        if (!draft.project || components.length === 0) {
          return
        }

        const board = getActiveBoard(draft.project, draft.activeBoardId)
        if (!board) {
          return
        }

        const copies = components.map((component) => {
          const copy = duplicateComponent(component, draft.project!.boardSize, get().locale, offset)
          copy.name = getNextComponentName(board, copy.name)
          return copy
        })

        board.components.push(...copies)
        nextIds = copies.map((component) => component.id)
        draft.activeBoardId = board.id
        draft.selectedComponentId = nextIds.at(-1) ?? null
        draft.selectedComponentIds = nextIds
      })

      return nextIds
    },
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
        if (!draft.project || draft.selectedComponentIds.length === 0) {
          return
        }

        const selected = getSelectedComponents(draft.project, draft.selectedComponentIds)
        if (selected.length === 0) {
          return
        }

        const minX = Math.min(...selected.map(({ component }) => component.x))
        const minY = Math.min(...selected.map(({ component }) => component.y))
        const maxX = Math.max(...selected.map(({ component }) => component.x + component.width))
        const maxY = Math.max(...selected.map(({ component }) => component.y + component.height))
        const boundedDeltaX = clamp(deltaX, -minX, draft.project.boardSize.width - maxX)
        const boundedDeltaY = clamp(deltaY, -minY, draft.project.boardSize.height - maxY)

        for (const { component } of selected) {
          component.x = clamp(
            snap(component.x + boundedDeltaX),
            0,
            draft.project.boardSize.width - component.width,
          )
          component.y = clamp(
            snap(component.y + boundedDeltaY),
            0,
            draft.project.boardSize.height - component.height,
          )
          Object.assign(component, normalizeComponent(component, draft.project.boardSize))
        }
      }),
    replaceBoardsFromAI: (project) =>
      commit((draft) => {
        if (!draft.project) {
          draft.project = project
          draft.activeBoardId = project.boards[0]?.id ?? null
          draft.selectedComponentId = null
          draft.selectedComponentIds = []
          return
        }
        draft.project.project = project.project
        draft.project.device = project.device
        draft.project.boardSize = project.boardSize
        draft.project.boards = project.boards
        draft.activeBoardId = project.boards[0]?.id ?? null
        draft.selectedComponentId = null
        draft.selectedComponentIds = []
      }),
    exportProjectJson: () => {
      const project = get().project
      if (!project) {
        throw new Error(t(get().locale, 'projectNotInitialized'))
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
          pendingComponentType: null,
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
          pendingComponentType: null,
          history: {
            past: [...state.history.past, entry],
            future: state.history.future.slice(1),
          },
        }
      }),
  }
})
