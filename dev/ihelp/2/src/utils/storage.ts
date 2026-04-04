/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { LOCAL_STORAGE_KEY } from './constants'
import { parseProjectJson } from './project'
import type { WorkspaceSnapshot } from '../types/schema'

const normalizeSnapshot = (value: unknown): WorkspaceSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const project = record.project
    ? parseProjectJson(JSON.stringify(record.project))
    : null
  const settings =
    record.settings && typeof record.settings === 'object'
      ? {
          baseUrl: String((record.settings as Record<string, unknown>).baseUrl ?? ''),
          apiKey: String((record.settings as Record<string, unknown>).apiKey ?? ''),
          model: String((record.settings as Record<string, unknown>).model ?? ''),
        }
      : { baseUrl: '', apiKey: '', model: '' }

  return {
    project,
    settings,
    activeBoardId: typeof record.activeBoardId === 'string' ? record.activeBoardId : null,
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

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot))
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
