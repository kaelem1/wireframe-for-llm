/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type {
  AiExportBundle,
  AlignmentReport,
  AlignmentRow,
  ExportedElement,
} from '../types/prototype'

type ComparableElement = {
  screenId: string
  screenName: string
  element: ExportedElement
}

function normalizeBundle(input: unknown): AiExportBundle {
  if (!input || typeof input !== 'object') {
    throw new Error('AI 返回内容不是有效对象。')
  }

  const bundle = input as Partial<AiExportBundle>

  if (!Array.isArray(bundle.screens)) {
    throw new Error('AI 返回内容缺少 screens。')
  }

  return {
    project: {
      name: bundle.project?.name ?? 'Unknown',
      deviceType: bundle.project?.deviceType ?? 'custom',
      artboardSize: bundle.project?.artboardSize ?? { width: 0, height: 0 },
    },
    screens: bundle.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      elements: (screen.elements ?? []).map((element) => ({
        id: element.id,
        name: element.name,
        type: element.type,
        x: Number(element.x),
        y: Number(element.y),
        width: Number(element.width),
        height: Number(element.height),
        cornerRadius: element.cornerRadius,
        label: element.label,
        fontSize: element.fontSize,
        interactions: (element.interactions ?? []).map((interaction) => ({
          trigger: 'onClick',
          action: interaction.action,
          target: interaction.target ?? null,
        })),
      })),
    })),
    navigationFlow: bundle.navigationFlow ?? [],
  }
}

function flatten(bundle: AiExportBundle): ComparableElement[] {
  return bundle.screens.flatMap((screen) =>
    screen.elements.map((element) => ({
      screenId: screen.id,
      screenName: screen.name,
      element,
    })),
  )
}

function toInteractionSet(element: ExportedElement): string[] {
  return element.interactions
    .map((interaction) => `${interaction.action}:${interaction.target ?? 'null'}`)
    .sort()
}

function isClose(original: number, interpreted: number): boolean {
  const tolerance = Math.max(10, Math.abs(original) * 0.1)
  return Math.abs(original - interpreted) <= tolerance
}

export function compareAlignment(
  sourceBundle: AiExportBundle,
  interpretedBundleInput: unknown,
): AlignmentReport {
  const interpretedBundle = normalizeBundle(interpretedBundleInput)
  const original = flatten(sourceBundle)
  const interpreted = flatten(interpretedBundle)
  const interpretedByKey = new Map(
    interpreted.map((entry) => [
      `${entry.screenName.toLowerCase()}::${entry.element.name.toLowerCase()}`,
      entry,
    ]),
  )

  const rows: AlignmentRow[] = original.map((entry) => {
    const interpretedEntry =
      interpretedByKey.get(
        `${entry.screenName.toLowerCase()}::${entry.element.name.toLowerCase()}`,
      ) ??
      interpreted.find(
        (candidate) => candidate.element.name.toLowerCase() === entry.element.name.toLowerCase(),
      ) ??
      null

    const notes: string[] = []

    if (!interpretedEntry) {
      notes.push('AI 响应中缺少该元素。')
    }

    if (interpretedEntry && interpretedEntry.element.type !== entry.element.type) {
      notes.push('类型不一致。')
    }

    const layoutMatched =
      interpretedEntry !== null &&
      interpretedEntry.element.type === entry.element.type &&
      isClose(entry.element.x, interpretedEntry.element.x) &&
      isClose(entry.element.y, interpretedEntry.element.y) &&
      isClose(entry.element.width, interpretedEntry.element.width) &&
      isClose(entry.element.height, interpretedEntry.element.height)

    if (interpretedEntry && !layoutMatched) {
      notes.push('位置或尺寸超出 10% 误差范围。')
    }

    const originalInteractions = toInteractionSet(entry.element)
    const interpretedInteractions = interpretedEntry
      ? toInteractionSet(interpretedEntry.element)
      : []
    const interactionMatched =
      originalInteractions.join('|') === interpretedInteractions.join('|')

    if (!interactionMatched) {
      notes.push('交互关系不一致。')
    }

    return {
      screenName: entry.screenName,
      elementName: entry.element.name,
      original: {
        type: entry.element.type,
        x: entry.element.x,
        y: entry.element.y,
        width: entry.element.width,
        height: entry.element.height,
        interactions: originalInteractions,
      },
      interpreted: interpretedEntry
        ? {
            type: interpretedEntry.element.type,
            x: interpretedEntry.element.x,
            y: interpretedEntry.element.y,
            width: interpretedEntry.element.width,
            height: interpretedEntry.element.height,
            interactions: interpretedInteractions,
          }
        : null,
      layoutMatched,
      interactionMatched,
      notes,
    }
  })

  const layoutMatches = rows.filter((row) => row.layoutMatched).length
  const interactionTotals = rows.reduce(
    (sum, row) => sum + row.original.interactions.length,
    0,
  )
  const interactionMatches = rows.reduce((sum, row) => {
    if (row.original.interactions.length === 0) {
      return sum
    }

    return sum + (row.interactionMatched ? row.original.interactions.length : 0)
  }, 0)

  const layoutScore = rows.length === 0 ? 100 : (layoutMatches / rows.length) * 100
  const interactionScore =
    interactionTotals === 0 ? 100 : (interactionMatches / interactionTotals) * 100

  return {
    layoutScore,
    interactionScore,
    overallScore: layoutScore * 0.6 + interactionScore * 0.4,
    rows,
  }
}
