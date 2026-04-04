/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import type {
  AiExportElement,
  AiExportPayload,
  AiExportScreen,
  AlignmentResult,
  AlignmentRow,
  PrototypeElement,
  PrototypeProject
} from "./types";
import { formatInteractionSummary } from "./utils";

function describeElement(element: AiExportElement): string {
  const parts = [
    `"${element.name}"`,
    `(${element.type}`,
    `${element.width}×${element.height} at x=${element.x}, y=${element.y}`
  ];

  if (element.label) {
    parts.push(`label "${element.label}"`);
  }

  if (typeof element.cornerRadius === "number" && element.cornerRadius > 0) {
    parts.push(`corner radius ${element.cornerRadius}`);
  }

  return `${parts.join(", ")})`;
}

function exportElement(element: PrototypeElement): AiExportElement {
  return {
    id: element.id,
    name: element.name,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    cornerRadius:
      element.type === "rect" || element.type === "image_placeholder"
        ? element.cornerRadius
        : undefined,
    label: element.type === "text" ? element.text : element.text || undefined,
    interactions: element.interactions.map((interaction) => ({
      trigger: interaction.trigger,
      action: interaction.action,
      target: interaction.target
    }))
  };
}

export function buildAiExport(project: PrototypeProject): {
  payload: AiExportPayload;
  markdown: string;
} {
  const screens: AiExportScreen[] = project.boards.map((board) => ({
    id: board.id,
    name: board.name,
    elements: board.elements.map(exportElement)
  }));

  const navigationFlow = project.boards.flatMap((board) =>
    board.elements.flatMap((element) =>
      element.interactions.map((interaction) => ({
        from: board.id,
        element: element.name,
        action: interaction.action,
        to: interaction.target
      }))
    )
  );

  const payload: AiExportPayload = {
    project: {
      name: project.name,
      deviceType: project.deviceType,
      artboardSize: project.artboardSize
    },
    screens,
    navigationFlow
  };

  const markdown = screens
    .map((screen) => {
      const layoutLines = screen.elements.map((element) => `- ${describeElement(element)}`);
      const interactionLines =
        screen.elements.flatMap((element) =>
          element.interactions.map((interaction) => {
            const targetScreen = project.boards.find((board) => board.id === interaction.target)?.name;
            const targetElement =
              project.boards
                .flatMap((board) => board.elements)
                .find((item) => item.id === interaction.target)?.name ?? interaction.target;

            if (interaction.action === "navigateTo") {
              return `- 点击 "${element.name}" → 跳转到 "${targetScreen ?? interaction.target ?? ""}"`;
            }

            if (interaction.action === "showHide") {
              return `- 点击 "${element.name}" → 显示/隐藏 "${targetElement ?? ""}"`;
            }

            if (interaction.action === "toggleState") {
              return `- 点击 "${element.name}" → 切换自身状态`;
            }

            return `- 点击 "${element.name}" → 返回上一页`;
          })
        ) || ["- 无"];

      return [
        `## Screen: ${screen.name} (${project.artboardSize.width}×${project.artboardSize.height})`,
        "Layout:",
        ...layoutLines,
        "",
        "Interactions:",
        ...interactionLines
      ].join("\n");
    })
    .join("\n\n");

  return { payload, markdown };
}

function flattenInteractions(elements: AiExportScreen["elements"]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const element of elements) {
    map.set(
      element.name,
      element.interactions.map((interaction) =>
        formatInteractionSummary(interaction.action, interaction.target)
      )
    );
  }

  return map;
}

function asExportPayload(raw: unknown): AiExportPayload {
  return raw as AiExportPayload;
}

export function compareAlignment(
  original: AiExportPayload,
  interpretedRaw: unknown
): AlignmentResult {
  const interpreted = asExportPayload(interpretedRaw);
  const rows: AlignmentRow[] = [];
  let matchedLayouts = 0;
  let totalLayouts = 0;

  const originalInteractionSet = new Set(
    original.screens.flatMap((screen) =>
      screen.elements.flatMap((element) =>
        element.interactions.map((interaction) =>
          `${screen.name}:${element.name}:${formatInteractionSummary(
            interaction.action,
            interaction.target
          )}`
        )
      )
    )
  );

  const interpretedInteractionSet = new Set(
    (interpreted.screens ?? []).flatMap((screen) =>
      (screen.elements ?? []).flatMap((element) =>
        (element.interactions ?? []).map((interaction) =>
          `${screen.name}:${element.name}:${formatInteractionSummary(
            interaction.action,
            interaction.target
          )}`
        )
      )
    )
  );

  for (const screen of original.screens) {
    const interpretedScreen =
      interpreted.screens?.find((item) => item.id === screen.id) ??
      interpreted.screens?.find((item) => item.name === screen.name);
    const interpretedMap = new Map(
      (interpretedScreen?.elements ?? []).map((element) => [element.name, element])
    );
    const interpretedInteractions = flattenInteractions(interpretedScreen?.elements ?? []);

    for (const element of screen.elements) {
      totalLayouts += 1;
      const interpretedElement = interpretedMap.get(element.name);
      const match =
        interpretedElement !== undefined &&
        Math.abs(interpretedElement.x - element.x) <= Math.max(1, Math.abs(element.x) * 0.1) &&
        Math.abs(interpretedElement.y - element.y) <= Math.max(1, Math.abs(element.y) * 0.1) &&
        Math.abs(interpretedElement.width - element.width) <=
          Math.max(1, Math.abs(element.width) * 0.1) &&
        Math.abs(interpretedElement.height - element.height) <=
          Math.max(1, Math.abs(element.height) * 0.1) &&
        interpretedElement.type === element.type;

      if (match) {
        matchedLayouts += 1;
      }

      rows.push({
        screenName: screen.name,
        elementName: element.name,
        matched: match,
        original: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          type: element.type,
          interactions: flattenInteractions(screen.elements).get(element.name) ?? []
        },
        interpreted: interpretedElement
          ? {
              x: interpretedElement.x,
              y: interpretedElement.y,
              width: interpretedElement.width,
              height: interpretedElement.height,
              type: interpretedElement.type,
              interactions: interpretedInteractions.get(element.name) ?? []
            }
          : undefined
      });
    }
  }

  const layoutScore = totalLayouts === 0 ? 100 : (matchedLayouts / totalLayouts) * 100;
  const matchedInteractions =
    originalInteractionSet.size === 0
      ? interpretedInteractionSet.size === 0
        ? 1
        : 0
      : [...originalInteractionSet].filter((item) => interpretedInteractionSet.has(item)).length /
        originalInteractionSet.size;
  const interactionScore = matchedInteractions * 100;
  const overallScore = layoutScore * 0.6 + interactionScore * 0.4;

  return {
    layoutScore,
    interactionScore,
    overallScore,
    rows,
    rawResponse: interpretedRaw
  };
}
