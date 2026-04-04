/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { create } from "zustand";
import { DEFAULT_LLM_SETTINGS, MAX_HISTORY, STORAGE_KEY } from "./constants";
import type {
  AiPrimitiveShape,
  LlmSettings,
  PersistedState,
  PrototypeElement,
  PrototypeInteraction,
  PrototypeProject,
  ShapeType,
  ToolType
} from "./types";
import {
  addGridSnap,
  createBoard,
  createElement,
  createId,
  createProject,
  deepClone,
  duplicateElement,
  findBoard,
  findElement,
  normalizePersistedState,
  normalizeProject,
  nextElementName,
  round
} from "./utils";

interface AppState {
  projects: PrototypeProject[];
  activeProjectId: string | null;
  selectedBoardId: string | null;
  selectedElementId: string | null;
  activeTool: ToolType;
  isToolboxCollapsed: boolean;
  showElementNames: boolean;
  llmSettings: LlmSettings;
  historyPast: PrototypeProject[];
  historyFuture: PrototypeProject[];
  loadPersisted: () => void;
  saveNow: () => void;
  openProject: (projectId: string) => void;
  closeProject: () => void;
  createProject: (params: { name: string; deviceType: PrototypeProject["deviceType"]; size: PrototypeProject["artboardSize"] }) => void;
  duplicateProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  importProject: (project: unknown) => void;
  updateProjectName: (name: string) => void;
  setLlmSettings: (patch: Partial<LlmSettings>) => void;
  setActiveTool: (tool: ToolType) => void;
  setToolboxCollapsed: (collapsed: boolean) => void;
  toggleElementNames: () => void;
  selectBoard: (boardId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  addBoard: () => void;
  selectElement: (boardId: string, elementId: string | null) => void;
  addElement: (boardId: string, type: ShapeType, position?: { x: number; y: number }) => void;
  addBoardFromAi: (name: string, shapes: AiPrimitiveShape[]) => void;
  updateElement: (
    boardId: string,
    elementId: string,
    patch: Partial<PrototypeElement>,
    trackHistory?: boolean
  ) => void;
  deleteSelectedElement: () => void;
  duplicateSelectedElement: () => void;
  moveElementLayer: (boardId: string, elementId: string, offset: -1 | 1) => void;
  addInteraction: (boardId: string, elementId: string) => void;
  updateInteraction: (
    boardId: string,
    elementId: string,
    interactionId: string,
    patch: Partial<PrototypeInteraction>
  ) => void;
  removeInteraction: (boardId: string, elementId: string, interactionId: string) => void;
  undo: () => void;
  redo: () => void;
}

function persistState(state: AppState): void {
  const payload: PersistedState = {
    version: 1,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    llmSettings: state.llmSettings,
    showElementNames: state.showElementNames
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getActiveProject(state: AppState): PrototypeProject {
  const project = state.projects.find((item) => item.id === state.activeProjectId);
  if (!project) {
    throw new Error("Active project not found.");
  }
  return project;
}

function withProjectHistory(state: AppState, project: PrototypeProject): Pick<AppState, "historyPast" | "historyFuture"> {
  return {
    historyPast: [...state.historyPast, deepClone(project)].slice(-MAX_HISTORY),
    historyFuture: []
  };
}

function touchProject(project: PrototypeProject): void {
  project.updatedAt = new Date().toISOString();
}

function createDefaultInteraction(): PrototypeInteraction {
  return {
    id: createId("interaction"),
    trigger: "onClick",
    action: "navigateTo"
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  selectedBoardId: null,
  selectedElementId: null,
  activeTool: "select",
  isToolboxCollapsed: false,
  showElementNames: true,
  llmSettings: DEFAULT_LLM_SETTINGS,
  historyPast: [],
  historyFuture: [],
  loadPersisted: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const normalized = normalizePersistedState(JSON.parse(raw));
      set({
        projects: normalized.projects,
        activeProjectId: normalized.activeProjectId,
        selectedBoardId:
          normalized.projects.find((project) => project.id === normalized.activeProjectId)?.boards[0]
            ?.id ?? null,
        selectedElementId: null,
        llmSettings: normalized.llmSettings,
        showElementNames: normalized.showElementNames,
        historyPast: [],
        historyFuture: []
      });
    } catch (error) {
      console.error(error);
    }
  },
  saveNow: () => {
    persistState(get());
  },
  openProject: (projectId) => {
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      return {
        activeProjectId: projectId,
        selectedBoardId: project?.boards[0]?.id ?? null,
        selectedElementId: null,
        historyPast: [],
        historyFuture: [],
        activeTool: "select"
      };
    });
    persistState(get());
  },
  closeProject: () => {
    set({
      activeProjectId: null,
      selectedBoardId: null,
      selectedElementId: null,
      historyPast: [],
      historyFuture: [],
      activeTool: "select"
    });
    persistState(get());
  },
  createProject: (params) => {
    const project = createProject(params);
    set((state) => ({
      projects: [project, ...state.projects],
      activeProjectId: project.id,
      selectedBoardId: project.boards[0]?.id ?? null,
      selectedElementId: null,
      historyPast: [],
      historyFuture: [],
      activeTool: "select"
    }));
    persistState(get());
  },
  duplicateProject: (projectId) => {
    set((state) => {
      const target = state.projects.find((item) => item.id === projectId);
      if (!target) {
        return state;
      }

      const copy = deepClone(target);
      const timestamp = new Date().toISOString();
      copy.id = createId("project");
      copy.name = `${target.name} 副本`;
      copy.createdAt = timestamp;
      copy.updatedAt = timestamp;
      copy.boards = copy.boards.map((board) => ({
        ...board,
        id: createId("screen"),
        elements: board.elements.map((element) => ({
          ...element,
          id: createId("el"),
          interactions: element.interactions.map((interaction) => ({
            ...interaction,
            id: createId("interaction")
          }))
        }))
      }));

      return { projects: [copy, ...state.projects] };
    });
    persistState(get());
  },
  deleteProject: (projectId) => {
    set((state) => {
      const projects = state.projects.filter((item) => item.id !== projectId);
      const activeProjectId = state.activeProjectId === projectId ? null : state.activeProjectId;
      return {
        projects,
        activeProjectId,
        selectedBoardId: activeProjectId ? state.selectedBoardId : null,
        selectedElementId: activeProjectId ? state.selectedElementId : null,
        historyPast: activeProjectId ? state.historyPast : [],
        historyFuture: activeProjectId ? state.historyFuture : []
      };
    });
    persistState(get());
  },
  importProject: (project) => {
    const normalized = normalizeProject(project);
    set((state) => ({
      projects: [normalized, ...state.projects]
    }));
    persistState(get());
  },
  updateProjectName: (name) => {
    set((state) => {
      if (!state.activeProjectId) {
        return state;
      }
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      project.name = name || "未命名项目";
      touchProject(project);
      return {
        projects,
        ...withProjectHistory(state, getActiveProject(state))
      };
    });
    persistState(get());
  },
  setLlmSettings: (patch) => {
    set((state) => ({
      llmSettings: {
        ...state.llmSettings,
        ...patch
      }
    }));
    persistState(get());
  },
  setActiveTool: (tool) => {
    set({ activeTool: tool });
  },
  setToolboxCollapsed: (collapsed) => {
    set({ isToolboxCollapsed: collapsed });
  },
  toggleElementNames: () => {
    set((state) => ({
      showElementNames: !state.showElementNames
    }));
    persistState(get());
  },
  selectBoard: (boardId) => {
    set({
      selectedBoardId: boardId,
      selectedElementId: null
    });
  },
  renameBoard: (boardId, name) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      board.name = name || "未命名画板";
      touchProject(project);
      return {
        projects,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  addBoard: () => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = createBoard(`画板 ${project.boards.length + 1}`);
      project.boards.push(board);
      touchProject(project);
      return {
        projects,
        selectedBoardId: board.id,
        selectedElementId: null,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  selectElement: (boardId, elementId) => {
    set({
      selectedBoardId: boardId,
      selectedElementId: elementId
    });
  },
  addElement: (boardId, type, position) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      const next = nextElementName(project.counters, type);
      project.counters = next.counters;
      const snapped = addGridSnap(position ?? { x: 24, y: 24 });
      const element = createElement({
        type,
        name: next.name,
        x: snapped.x,
        y: snapped.y
      });
      board.elements.push(element);
      touchProject(project);
      return {
        projects,
        selectedBoardId: boardId,
        selectedElementId: element.id,
        activeTool: "select",
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  addBoardFromAi: (name, shapes) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }

      const previous = deepClone(getActiveProject(state));
      const board = createBoard(name || `AI 画板 ${project.boards.length + 1}`);
      for (const shape of shapes) {
        const next = nextElementName(project.counters, shape.type);
        project.counters = next.counters;
        const element = createElement({
          type: shape.type,
          name: shape.name?.trim() || next.name,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          cornerRadius: shape.cornerRadius,
          text: shape.text,
          fontSize: shape.fontSize
        });
        board.elements.push(element);
      }
      project.boards.push(board);
      touchProject(project);

      return {
        projects,
        selectedBoardId: board.id,
        selectedElementId: null,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  updateElement: (boardId, elementId, patch, trackHistory = true) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = trackHistory ? deepClone(getActiveProject(state)) : null;
      const board = findBoard(project, boardId);
      const element = findElement(board, elementId);
      Object.assign(element, patch);
      element.x = round(element.x);
      element.y = round(element.y);
      element.width = Math.max(8, round(element.width));
      element.height = Math.max(2, round(element.height));
      element.cornerRadius = Math.max(0, Math.min(20, round(element.cornerRadius)));
      element.fontSize = Math.max(12, Math.min(32, round(element.fontSize)));
      element.opacity = Math.max(0, Math.min(1, Number(element.opacity)));
      if (element.type === "circle") {
        const size = Math.max(element.width, element.height);
        element.width = size;
        element.height = size;
        element.cornerRadius = size / 2;
      }
      touchProject(project);
      return {
        projects,
        historyPast: previous ? [...state.historyPast, previous].slice(-MAX_HISTORY) : state.historyPast,
        historyFuture: previous ? [] : state.historyFuture
      };
    });
    persistState(get());
  },
  deleteSelectedElement: () => {
    set((state) => {
      if (!state.activeProjectId || !state.selectedBoardId || !state.selectedElementId) {
        return state;
      }
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, state.selectedBoardId);
      board.elements = board.elements.filter((item) => item.id !== state.selectedElementId);
      touchProject(project);
      return {
        projects,
        selectedElementId: null,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  duplicateSelectedElement: () => {
    set((state) => {
      if (!state.activeProjectId || !state.selectedBoardId || !state.selectedElementId) {
        return state;
      }
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, state.selectedBoardId);
      const element = findElement(board, state.selectedElementId);
      const next = nextElementName(project.counters, element.type);
      project.counters = next.counters;
      const copy = duplicateElement(element, next.name);
      board.elements.push(copy);
      touchProject(project);
      return {
        projects,
        selectedElementId: copy.id,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  moveElementLayer: (boardId, elementId, offset) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      const index = board.elements.findIndex((item) => item.id === elementId);
      const target = index + offset;
      if (index === -1 || target < 0 || target >= board.elements.length) {
        return state;
      }
      const [element] = board.elements.splice(index, 1);
      board.elements.splice(target, 0, element);
      touchProject(project);
      return {
        projects,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  addInteraction: (boardId, elementId) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      const element = findElement(board, elementId);
      element.interactions.push(createDefaultInteraction());
      touchProject(project);
      return {
        projects,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  updateInteraction: (boardId, elementId, interactionId, patch) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      const element = findElement(board, elementId);
      const interaction = element.interactions.find((item) => item.id === interactionId);
      if (!interaction) {
        return state;
      }
      Object.assign(interaction, patch);
      if (interaction.action === "goBack" || interaction.action === "toggleState") {
        delete interaction.target;
      }
      touchProject(project);
      return {
        projects,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  removeInteraction: (boardId, elementId, interactionId) => {
    set((state) => {
      const projects = deepClone(state.projects);
      const project = projects.find((item) => item.id === state.activeProjectId);
      if (!project) {
        return state;
      }
      const previous = deepClone(getActiveProject(state));
      const board = findBoard(project, boardId);
      const element = findElement(board, elementId);
      element.interactions = element.interactions.filter((item) => item.id !== interactionId);
      touchProject(project);
      return {
        projects,
        historyPast: [...state.historyPast, previous].slice(-MAX_HISTORY),
        historyFuture: []
      };
    });
    persistState(get());
  },
  undo: () => {
    set((state) => {
      if (!state.activeProjectId || state.historyPast.length === 0) {
        return state;
      }
      const previous = state.historyPast[state.historyPast.length - 1];
      const current = deepClone(getActiveProject(state));
      const projects = deepClone(state.projects);
      const index = projects.findIndex((item) => item.id === state.activeProjectId);
      if (index === -1) {
        return state;
      }
      projects[index] = deepClone(previous);
      return {
        projects,
        selectedBoardId: previous.boards[0]?.id ?? null,
        selectedElementId: null,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [current, ...state.historyFuture].slice(0, MAX_HISTORY)
      };
    });
    persistState(get());
  },
  redo: () => {
    set((state) => {
      if (!state.activeProjectId || state.historyFuture.length === 0) {
        return state;
      }
      const next = state.historyFuture[0];
      const current = deepClone(getActiveProject(state));
      const projects = deepClone(state.projects);
      const index = projects.findIndex((item) => item.id === state.activeProjectId);
      if (index === -1) {
        return state;
      }
      projects[index] = deepClone(next);
      return {
        projects,
        selectedBoardId: next.boards[0]?.id ?? null,
        selectedElementId: null,
        historyPast: [...state.historyPast, current].slice(-MAX_HISTORY),
        historyFuture: state.historyFuture.slice(1)
      };
    });
    persistState(get());
  }
}));
