/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import type { DevicePreset, LlmSettings, ShapeType } from "./types";

export const DEVICE_PRESETS: DevicePreset[] = [
  { label: "iPhone 15", deviceType: "mobile", width: 393, height: 852 },
  { label: "iPhone SE", deviceType: "mobile", width: 375, height: 667 },
  { label: "Android", deviceType: "mobile", width: 360, height: 800 },
  { label: "iPad", deviceType: "tablet", width: 820, height: 1180 },
  { label: "iPad Pro", deviceType: "tablet", width: 1024, height: 1366 },
  { label: "桌面 1440", deviceType: "desktop", width: 1440, height: 900 },
  { label: "桌面 1920", deviceType: "desktop", width: 1920, height: 1080 }
];

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  baseUrl: "https://api.siliconflow.cn/v1",
  apiKey: "",
  model: "zai-org/GLM-4.6"
};

export const STORAGE_KEY = "tiping.persist.v1";
export const GRID_SIZE = 8;
export const MAX_HISTORY = 50;
export const ARTBOARD_GAP = 80;

export const SHAPE_LABELS: Record<ShapeType, string> = {
  rect: "矩形",
  circle: "圆形",
  ellipse: "椭圆",
  line: "线段",
  text: "文字",
  image_placeholder: "图片占位"
};
