/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { ACTION_OPTIONS, COMPONENT_META, DEVICE_PRESETS, TRIGGER_OPTIONS } from './catalog'
import type { BoardComponent, BoardDocument, ComponentInteraction, ProjectDocument } from '../types/schema'

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }
}

function assertString(value: unknown, message: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message)
  }
}

function assertNumber(value: unknown, message: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message)
  }
}

function parseInteraction(value: unknown): ComponentInteraction {
  assertRecord(value, 'Interaction must be an object')
  assertString(value.id, 'Interaction id is required')
  assertString(value.trigger, 'Interaction trigger is required')
  assertString(value.action, 'Interaction action is required')
  if (!TRIGGER_OPTIONS.some((option) => option.value === value.trigger)) {
    throw new Error(`Unsupported interaction trigger: ${value.trigger}`)
  }
  if (!ACTION_OPTIONS.some((option) => option.value === value.action)) {
    throw new Error(`Unsupported interaction action: ${value.action}`)
  }
  return {
    id: value.id,
    trigger: value.trigger as ComponentInteraction['trigger'],
    action: value.action as ComponentInteraction['action'],
    target: typeof value.target === 'string' ? value.target : undefined,
  }
}

function parseComponent(value: unknown): BoardComponent {
  assertRecord(value, 'Component must be an object')
  assertString(value.id, 'Component id is required')
  assertString(value.type, 'Component type is required')
  if (!(value.type in COMPONENT_META)) {
    throw new Error(`Unsupported component type: ${value.type}`)
  }
  assertString(value.name, 'Component name is required')
  assertNumber(value.x, 'Component x is required')
  assertNumber(value.y, 'Component y is required')
  assertNumber(value.width, 'Component width is required')
  assertNumber(value.height, 'Component height is required')
  const interactions = Array.isArray(value.interactions) ? value.interactions.map(parseInteraction) : []
  return {
    id: value.id,
    type: value.type as BoardComponent['type'],
    name: value.name,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    interactions,
  }
}

function parseBoard(value: unknown): BoardDocument {
  assertRecord(value, 'Board must be an object')
  assertString(value.id, 'Board id is required')
  assertString(value.name, 'Board name is required')
  if (!Array.isArray(value.components)) {
    throw new Error('Board components must be an array')
  }
  return {
    id: value.id,
    name: value.name,
    components: value.components.map(parseComponent),
  }
}

export function assertProjectDocument(value: unknown): ProjectDocument {
  assertRecord(value, 'Project JSON must be an object')
  assertString(value.project, 'Project name is required')
  assertString(value.device, 'Device is required')
  if (!DEVICE_PRESETS.some((preset) => preset.id === value.device)) {
    throw new Error(`Unsupported device preset: ${value.device}`)
  }
  assertRecord(value.boardSize, 'boardSize is required')
  assertNumber(value.boardSize.width, 'boardSize.width is required')
  assertNumber(value.boardSize.height, 'boardSize.height is required')
  if (!Array.isArray(value.boards)) {
    throw new Error('Boards must be an array')
  }
  const project = {
    project: value.project,
    device: value.device as ProjectDocument['device'],
    boardSize: {
      width: value.boardSize.width,
      height: value.boardSize.height,
    },
    boards: value.boards.map(parseBoard),
  }
  if (project.boards.length === 0) {
    throw new Error('Project must contain at least one board')
  }
  return project
}

export function serializeProject(project: ProjectDocument): string {
  return JSON.stringify(project, null, 2)
}

export function parseProjectJson(text: string): ProjectDocument {
  return assertProjectDocument(JSON.parse(text))
}
