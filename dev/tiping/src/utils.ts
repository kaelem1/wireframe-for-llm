/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { GRID_SIZE } from "./constants";
import type {
  ArtboardSize,
  DeviceType,
  PersistedState,
  PrototypeBoard,
  PrototypeElement,
  PrototypeProject,
  ShapeType
} from "./types";

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number): number {
  return Math.round(value);
}

export function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export function createBoard(name: string): PrototypeBoard {
  return {
    id: createId("screen"),
    name,
    elements: []
  };
}

export function createProject(params: {
  name: string;
  deviceType: DeviceType;
  size: ArtboardSize;
}): PrototypeProject {
  const timestamp = new Date().toISOString();

  return {
    id: createId("project"),
    name: params.name || "未命名项目",
    deviceType: params.deviceType,
    artboardSize: params.size,
    boards: [createBoard("画板 1")],
    counters: {},
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function nextElementName(
  counters: PrototypeProject["counters"],
  type: ShapeType
): { name: string; counters: PrototypeProject["counters"] } {
  const nextCount = (counters[type] ?? 0) + 1;

  return {
    name: `${type}_${nextCount}`,
    counters: {
      ...counters,
      [type]: nextCount
    }
  };
}

export function createElement(params: {
  type: ShapeType;
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  cornerRadius?: number;
  visible?: boolean;
}): PrototypeElement {
  const defaults: Record<
    ShapeType,
    Pick<
      PrototypeElement,
      | "width"
      | "height"
      | "fill"
      | "stroke"
      | "strokeWidth"
      | "opacity"
      | "cornerRadius"
      | "text"
      | "fontSize"
    >
  > = {
    rect: {
      width: 160,
      height: 64,
      fill: "#ffffff",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 8,
      text: "",
      fontSize: 16
    },
    circle: {
      width: 96,
      height: 96,
      fill: "#ffffff",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 48,
      text: "",
      fontSize: 16
    },
    ellipse: {
      width: 140,
      height: 96,
      fill: "#ffffff",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 0,
      text: "",
      fontSize: 16
    },
    line: {
      width: 160,
      height: 2,
      fill: "transparent",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 0,
      text: "",
      fontSize: 16
    },
    text: {
      width: 160,
      height: 24,
      fill: "#111827",
      stroke: "#111827",
      strokeWidth: 0,
      opacity: 1,
      cornerRadius: 0,
      text: "文字标签",
      fontSize: 16
    },
    image_placeholder: {
      width: 120,
      height: 120,
      fill: "#e5e7eb",
      stroke: "#9ca3af",
      strokeWidth: 2,
      opacity: 1,
      cornerRadius: 8,
      text: "",
      fontSize: 16
    }
  };

  const preset = defaults[params.type];

  return {
    id: createId("el"),
    name: params.name,
    type: params.type,
    x: round(params.x ?? 24),
    y: round(params.y ?? 24),
    width: round(params.width ?? preset.width),
    height: round(params.height ?? preset.height),
    fill: preset.fill,
    stroke: preset.stroke,
    strokeWidth: preset.strokeWidth,
    opacity: preset.opacity,
    cornerRadius: round(params.cornerRadius ?? preset.cornerRadius),
    text: params.text ?? preset.text,
    fontSize: round(params.fontSize ?? preset.fontSize),
    visible: params.visible ?? true,
    interactions: []
  };
}

export function duplicateElement(
  element: PrototypeElement,
  name: string
): PrototypeElement {
  return {
    ...deepClone(element),
    id: createId("el"),
    name,
    x: round(element.x + 16),
    y: round(element.y + 16)
  };
}

export function normalizeProject(input: unknown): PrototypeProject {
  const project = deepClone(input) as Partial<PrototypeProject>;
  const size = project.artboardSize ?? { width: 393, height: 852 };
  const timestamp = new Date().toISOString();

  return {
    id: project.id ?? createId("project"),
    name: project.name ?? "导入项目",
    deviceType: project.deviceType ?? "mobile",
    artboardSize: {
      width: round(size.width ?? 393),
      height: round(size.height ?? 852)
    },
    boards: (project.boards ?? [createBoard("画板 1")]).map((board, index) => ({
      id: board.id ?? createId("screen"),
      name: board.name ?? `画板 ${index + 1}`,
      elements: (board.elements ?? []).map((element) => ({
        ...createElement({
          type: element.type ?? "rect",
          name: element.name ?? `rect_${index + 1}`
        }),
        ...element,
        id: element.id ?? createId("el"),
        interactions: (element.interactions ?? []).map((interaction) => ({
          id: interaction.id ?? createId("interaction"),
          trigger: interaction.trigger ?? "onClick",
          action: interaction.action ?? "goBack",
          target: interaction.target
        }))
      }))
    })),
    counters: project.counters ?? {},
    createdAt: project.createdAt ?? timestamp,
    updatedAt: timestamp
  };
}

export function normalizePersistedState(input: unknown): PersistedState {
  const state = deepClone(input) as Partial<PersistedState>;

  return {
    version: 1,
    projects: (state.projects ?? []).map(normalizeProject),
    activeProjectId: state.activeProjectId ?? null,
    llmSettings: {
      baseUrl: state.llmSettings?.baseUrl ?? "https://api.siliconflow.cn/v1",
      apiKey: state.llmSettings?.apiKey ?? "",
      model: state.llmSettings?.model ?? "zai-org/GLM-4.6"
    },
    showElementNames: state.showElementNames ?? true
  };
}

export function inferDeviceType(size: ArtboardSize): DeviceType {
  if (size.width >= 1280) {
    return "desktop";
  }

  if (size.width >= 768) {
    return "tablet";
  }

  return "mobile";
}

export function formatInteractionSummary(action: string, target?: string): string {
  return target ? `${action}:${target}` : action;
}

export function findBoard(project: PrototypeProject, boardId: string): PrototypeBoard {
  const board = project.boards.find((item) => item.id === boardId);
  if (!board) {
    throw new Error(`Board not found: ${boardId}`);
  }

  return board;
}

export function findElement(board: PrototypeBoard, elementId: string): PrototypeElement {
  const element = board.elements.find((item) => item.id === elementId);
  if (!element) {
    throw new Error(`Element not found: ${elementId}`);
  }

  return element;
}

export function addGridSnap(position: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: snapToGrid(position.x),
    y: snapToGrid(position.y)
  };
}
