/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
export type DeviceType = "mobile" | "tablet" | "desktop" | "custom";
export type ShapeType =
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "text"
  | "image_placeholder";
export type ToolType = "select" | ShapeType;
export type InteractionTrigger = "onClick";
export type InteractionAction =
  | "navigateTo"
  | "goBack"
  | "toggleState"
  | "showHide";

export interface ArtboardSize {
  width: number;
  height: number;
}

export interface DevicePreset {
  label: string;
  deviceType: DeviceType;
  width: number;
  height: number;
}

export interface PrototypeInteraction {
  id: string;
  trigger: InteractionTrigger;
  action: InteractionAction;
  target?: string;
}

export interface PrototypeElement {
  id: string;
  name: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  text: string;
  fontSize: number;
  visible: boolean;
  interactions: PrototypeInteraction[];
}

export interface PrototypeBoard {
  id: string;
  name: string;
  elements: PrototypeElement[];
}

export interface PrototypeProject {
  id: string;
  name: string;
  deviceType: DeviceType;
  artboardSize: ArtboardSize;
  boards: PrototypeBoard[];
  counters: Partial<Record<ShapeType, number>>;
  createdAt: string;
  updatedAt: string;
}

export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiPrimitiveShape {
  type: ShapeType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  text?: string;
  fontSize?: number;
}

export interface AiExportElement {
  id: string;
  name: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  label?: string;
  interactions: Array<{
    trigger: InteractionTrigger;
    action: InteractionAction;
    target?: string;
  }>;
}

export interface AiExportScreen {
  id: string;
  name: string;
  elements: AiExportElement[];
}

export interface AiExportPayload {
  project: {
    name: string;
    deviceType: DeviceType;
    artboardSize: ArtboardSize;
  };
  screens: AiExportScreen[];
  navigationFlow: Array<{
    from: string;
    element: string;
    action: InteractionAction;
    to?: string;
  }>;
}

export interface AlignmentRow {
  screenName: string;
  elementName: string;
  matched: boolean;
  original: {
    x: number;
    y: number;
    width: number;
    height: number;
    type: ShapeType;
    interactions: string[];
  };
  interpreted?: {
    x: number;
    y: number;
    width: number;
    height: number;
    type: ShapeType;
    interactions: string[];
  };
}

export interface AlignmentResult {
  layoutScore: number;
  interactionScore: number;
  overallScore: number;
  rows: AlignmentRow[];
  rawResponse: unknown;
}

export interface PersistedState {
  version: number;
  projects: PrototypeProject[];
  activeProjectId: string | null;
  llmSettings: LlmSettings;
  showElementNames: boolean;
}
