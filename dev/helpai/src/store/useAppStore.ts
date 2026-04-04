/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

import { DEFAULT_LLM_SETTINGS } from '../lib/ai'
import { APP_STORAGE_KEY, readStorage, writeStorage } from '../lib/storage'
import {
  constrainElement,
  createBoard,
  createElement,
  createInteraction,
  createProject,
  duplicateProjectSnapshot,
  normalizeImportedProject,
  pushHistory,
  restoreProject,
  snapshotProject,
  updateProjectTimestamp,
} from '../lib/project'
import type {
  AppState,
  PersistedAppState,
  PrototypeProject,
} from '../types/prototype'

const DEFAULT_STATE: PersistedAppState = {
  projects: [],
  currentProjectId: null,
  currentBoardId: null,
  showSemanticLabels: true,
  settings: DEFAULT_LLM_SETTINGS,
}

const HISTORY_LIMIT = 50

function persistState(state: AppState): PersistedAppState {
  return {
    projects: state.projects,
    currentProjectId: state.currentProjectId,
    currentBoardId: state.currentBoardId,
    showSemanticLabels: state.showSemanticLabels,
    settings: state.settings,
  }
}

function getCurrentProject(state: AppState): PrototypeProject | null {
  return state.projects.find((project) => project.id === state.currentProjectId) ?? null
}

function getCurrentBoard(project: PrototypeProject | null, boardId: string | null) {
  if (!project) {
    return null
  }

  return project.boards.find((board) => board.id === boardId) ?? project.boards[0] ?? null
}

function updateCurrentProjectWithHistory(
  state: AppState,
  recipe: (project: PrototypeProject) => void,
): Pick<AppState, 'projects'> {
  if (!state.currentProjectId) {
    return { projects: state.projects }
  }

  return {
    projects: state.projects.map((project) => {
      if (project.id !== state.currentProjectId) {
        return project
      }

      const snapshot = snapshotProject(project)
      const working = pushHistory(structuredClone(project), snapshot)
      recipe(working)
      return updateProjectTimestamp(working)
    }),
  }
}

function createInitialState(): PersistedAppState {
  return {
    ...DEFAULT_STATE,
    ...readStorage<PersistedAppState>(APP_STORAGE_KEY),
  }
}

export function createAppStore(initialState = createInitialState()) {
  const store = createStore<AppState>()((set, get) => ({
    ...initialState,
    activeTool: 'select',
    selectedElementId: null,
    selectedBoardId: initialState.currentBoardId,
    saveNow: () => {
      writeStorage(APP_STORAGE_KEY, persistState(get()))
    },
    createProject: (input) => {
      const project = createProject(input)
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
        currentBoardId: project.boards[0]?.id ?? null,
        selectedBoardId: project.boards[0]?.id ?? null,
        selectedElementId: null,
      }))
      get().saveNow()
      return project.id
    },
    openProject: (projectId) => {
      const project = get().projects.find((candidate) => candidate.id === projectId)
      set({
        currentProjectId: projectId,
        currentBoardId: project?.boards[0]?.id ?? null,
        selectedBoardId: project?.boards[0]?.id ?? null,
        selectedElementId: null,
      })
      get().saveNow()
    },
    closeProject: () => {
      set({
        currentProjectId: null,
        currentBoardId: null,
        selectedBoardId: null,
        selectedElementId: null,
      })
      get().saveNow()
    },
    deleteProject: (projectId) => {
      set((state) => {
        const projects = state.projects.filter((project) => project.id !== projectId)
        const shouldReset = state.currentProjectId === projectId

        return {
          projects,
          currentProjectId: shouldReset ? null : state.currentProjectId,
          currentBoardId: shouldReset ? null : state.currentBoardId,
          selectedBoardId: shouldReset ? null : state.selectedBoardId,
          selectedElementId: shouldReset ? null : state.selectedElementId,
        }
      })
      get().saveNow()
    },
    duplicateProject: (projectId) => {
      const project = get().projects.find((candidate) => candidate.id === projectId)

      if (!project) {
        return
      }

      const duplicate = restoreProject(
        duplicateProjectSnapshot(snapshotProject(project)),
        [],
        [],
      )

      set((state) => ({
        projects: [...state.projects, duplicate],
      }))
      get().saveNow()
    },
    importProject: (payload) => {
      const project = normalizeImportedProject(JSON.parse(payload))

      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
        currentBoardId: project.boards[0]?.id ?? null,
        selectedBoardId: project.boards[0]?.id ?? null,
        selectedElementId: null,
      }))

      get().saveNow()
      return project.id
    },
    exportProject: (projectId) => {
      const project = get().projects.find((candidate) => candidate.id === projectId)

      if (!project) {
        throw new Error('项目不存在。')
      }

      return JSON.stringify(snapshotProject(project), null, 2)
    },
    renameProject: (name) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        project.name = name.trim() || '未命名项目'
      }))
      get().saveNow()
    },
    setActiveTool: (tool) => {
      set({ activeTool: tool })
    },
    setSelectedElement: (boardId, elementId) => {
      set({
        selectedBoardId: boardId,
        currentBoardId: boardId,
        selectedElementId: elementId,
      })
    },
    setShowSemanticLabels: (value) => {
      set({ showSemanticLabels: value })
      get().saveNow()
    },
    updateSettings: (patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          ...patch,
        },
      }))
      get().saveNow()
    },
    addBoard: (name) => {
      const state = get()
      const project = getCurrentProject(state)

      if (!project) {
        return null
      }

      const nextBoard = createBoard(
        project.artboardSize,
        name?.trim() || `画板 ${project.boards.length + 1}`,
      )

      set((current) => updateCurrentProjectWithHistory(current, (working) => {
        working.boards.push(nextBoard)
      }))

      set({
        currentBoardId: nextBoard.id,
        selectedBoardId: nextBoard.id,
        selectedElementId: null,
      })
      get().saveNow()
      return nextBoard.id
    },
    renameBoard: (boardId, name) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)

        if (!board) {
          return
        }

        board.name = name.trim() || board.name
      }))
      get().saveNow()
    },
    selectBoard: (boardId) => {
      set({
        currentBoardId: boardId,
        selectedBoardId: boardId,
        selectedElementId: null,
      })
      get().saveNow()
    },
    addElement: (boardId, type, point, overrides = {}) => {
      let createdId: string | null = null

      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)

        if (!board) {
          return
        }

        const element = createElement(board, type, point, overrides)
        board.elements.push(element)
        createdId = element.id
      }))

      set({
        currentBoardId: boardId,
        selectedBoardId: boardId,
        selectedElementId: createdId,
      })
      get().saveNow()
      return createdId
    },
    addGeneratedBoard: (name, elements) => {
      const state = get()
      const project = getCurrentProject(state)

      if (!project) {
        return null
      }

      const board = createBoard(
        project.artboardSize,
        name.trim() || `AI 画板 ${project.boards.length + 1}`,
        elements,
      )

      set((current) => updateCurrentProjectWithHistory(current, (working) => {
        working.boards.push(board)
      }))
      set({
        currentBoardId: board.id,
        selectedBoardId: board.id,
        selectedElementId: null,
      })
      get().saveNow()
      return board.id
    },
    updateElement: (boardId, elementId, patch) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)
        const element = board?.elements.find((candidate) => candidate.id === elementId)

        if (!board || !element) {
          return
        }

        Object.assign(element, constrainElement({ ...element, ...patch }, board))
      }))
      get().saveNow()
    },
    deleteElement: (boardId, elementId) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)

        if (!board) {
          return
        }

        board.elements = board.elements.filter((element) => element.id !== elementId)
      }))

      if (get().selectedElementId === elementId) {
        set({ selectedElementId: null })
      }

      get().saveNow()
    },
    duplicateElement: (boardId, elementId) => {
      let nextId: string | null = null

      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)
        const element = board?.elements.find((candidate) => candidate.id === elementId)

        if (!board || !element) {
          return
        }

        const nextElement = createElement(
          board,
          element.type,
          { x: element.x + 16, y: element.y + 16 },
          {
            ...structuredClone(element),
            name: `${element.name}_copy`,
            interactions: structuredClone(element.interactions).map((interaction) => ({
              ...interaction,
              id: createInteraction().id,
            })),
          },
        )

        board.elements.push(nextElement)
        nextId = nextElement.id
      }))

      set({
        selectedBoardId: boardId,
        currentBoardId: boardId,
        selectedElementId: nextId,
      })
      get().saveNow()
    },
    moveElementLayer: (boardId, elementId, direction) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)

        if (!board) {
          return
        }

        const index = board.elements.findIndex((element) => element.id === elementId)

        if (index === -1) {
          return
        }

        const targetIndex = direction === 'forward' ? index + 1 : index - 1

        if (targetIndex < 0 || targetIndex >= board.elements.length) {
          return
        }

        const [element] = board.elements.splice(index, 1)
        board.elements.splice(targetIndex, 0, element)
      }))
      get().saveNow()
    },
    addInteraction: (boardId, elementId) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)
        const element = board?.elements.find((candidate) => candidate.id === elementId)

        if (!element) {
          return
        }

        element.interactions.push(createInteraction())
      }))
      get().saveNow()
    },
    updateInteraction: (boardId, elementId, interactionId, patch) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)
        const element = board?.elements.find((candidate) => candidate.id === elementId)
        const interaction = element?.interactions.find(
          (candidate) => candidate.id === interactionId,
        )

        if (!interaction) {
          return
        }

        Object.assign(interaction, patch)
      }))
      get().saveNow()
    },
    removeInteraction: (boardId, elementId, interactionId) => {
      set((state) => updateCurrentProjectWithHistory(state, (project) => {
        const board = project.boards.find((candidate) => candidate.id === boardId)
        const element = board?.elements.find((candidate) => candidate.id === elementId)

        if (!element) {
          return
        }

        element.interactions = element.interactions.filter(
          (interaction) => interaction.id !== interactionId,
        )
      }))
      get().saveNow()
    },
    undo: () => {
      const state = get()
      const project = getCurrentProject(state)

      if (!project || project.history.past.length === 0) {
        return
      }

      const previous = project.history.past[project.history.past.length - 1]
      const currentSnapshot = snapshotProject(project)
      const restored = restoreProject(
        previous,
        project.history.past.slice(0, -1),
        [currentSnapshot, ...project.history.future].slice(0, HISTORY_LIMIT),
      )
      const board = getCurrentBoard(restored, state.currentBoardId)

      set({
        projects: state.projects.map((candidate) =>
          candidate.id === project.id ? restored : candidate,
        ),
        currentBoardId: board?.id ?? restored.boards[0]?.id ?? null,
        selectedBoardId: board?.id ?? restored.boards[0]?.id ?? null,
        selectedElementId: null,
      })

      get().saveNow()
    },
    redo: () => {
      const state = get()
      const project = getCurrentProject(state)

      if (!project || project.history.future.length === 0) {
        return
      }

      const [next, ...futureRest] = project.history.future
      const currentSnapshot = snapshotProject(project)
      const restored = restoreProject(
        next,
        [...project.history.past, currentSnapshot].slice(-HISTORY_LIMIT),
        futureRest,
      )
      const board = getCurrentBoard(restored, state.currentBoardId)

      set({
        projects: state.projects.map((candidate) =>
          candidate.id === project.id ? restored : candidate,
        ),
        currentBoardId: board?.id ?? restored.boards[0]?.id ?? null,
        selectedBoardId: board?.id ?? restored.boards[0]?.id ?? null,
        selectedElementId: null,
      })
      get().saveNow()
    },
  }))

  return store
}

export const appStore = createAppStore()

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}

export function useAppStoreState(): AppState {
  return useStore(appStore)
}
