/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前按主 workspace + wireframe 双快照结构写入 localStorage
3. 更新后检查所属 `.folder.md`
*/

import { LOCAL_STORAGE_KEY } from './constants'
import { parseProjectJson } from './project'
import type {
  PersistedState,
  WireframeState,
  WorkspaceProjectSnapshot,
  WorkspaceSnapshot,
} from '../types/schema'

function normalizeProjectSnapshot(value: unknown): WorkspaceProjectSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const project = record.project ? parseProjectJson(JSON.stringify(record.project)) : null

  return {
    project,
    activeBoardId: typeof record.activeBoardId === 'string' ? record.activeBoardId : null,
  }
}

function normalizeWireframeState(value: unknown): WireframeState {
  if (!value || typeof value !== 'object') {
    return {
      enabled: false,
      purpose: '',
      opacity: 0.72,
      exploreSnapshot: null,
      designSnapshot: null,
    }
  }

  const record = value as Record<string, unknown>
  return {
    enabled: Boolean(record.enabled),
    purpose: typeof record.purpose === 'string' ? record.purpose : '',
    opacity:
      typeof record.opacity === 'number' && Number.isFinite(record.opacity)
        ? Math.min(Math.max(record.opacity, 0), 1)
        : 0.72,
    exploreSnapshot: normalizeProjectSnapshot(record.exploreSnapshot),
    designSnapshot: normalizeProjectSnapshot(record.designSnapshot),
  }
}

const normalizeSnapshot = (value: unknown): WorkspaceSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const project = record.project ? parseProjectJson(JSON.stringify(record.project)) : null
  const settings =
    record.settings && typeof record.settings === 'object'
      ? {
          baseUrl: String((record.settings as Record<string, unknown>).baseUrl ?? ''),
          apiKey: String((record.settings as Record<string, unknown>).apiKey ?? ''),
          model: String((record.settings as Record<string, unknown>).model ?? ''),
        }
      : { baseUrl: '', apiKey: '', model: '' }

  const currentBoardId =
    typeof record.currentBoardId === 'string'
      ? record.currentBoardId
      : typeof record.activeBoardId === 'string'
        ? record.activeBoardId
        : null

  return {
    project,
    settings,
    activeBoardId: currentBoardId,
    wireframe: normalizeWireframeState(record.wireframe),
  }
}

export const loadWorkspaceSnapshot = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return normalizeSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export const saveWorkspaceSnapshot = (snapshot: WorkspaceSnapshot) => {
  if (typeof window === 'undefined') {
    return
  }

  if (!snapshot.project) {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    return
  }

  const persisted: PersistedState = {
    project: snapshot.project,
    currentBoardId: snapshot.activeBoardId ?? snapshot.project.boards[0]?.id ?? '',
    selectedComponentId: null,
    settings: snapshot.settings,
    setupCompleted: true,
    wireframe: snapshot.wireframe,
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(persisted))
}

export const createDebouncedSnapshotSaver = (delay = 500) => {
  let timer: number | null = null

  return (snapshot: WorkspaceSnapshot) => {
    if (typeof window === 'undefined') {
      return
    }

    if (timer !== null) {
      window.clearTimeout(timer)
    }

    timer = window.setTimeout(() => {
      saveWorkspaceSnapshot(snapshot)
      timer = null
    }, delay)
  }
}
