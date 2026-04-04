/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { PersistedState } from '../types/schema'
import { STORAGE_KEY } from './catalog'

export function loadPersistedState(): PersistedState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  return JSON.parse(raw) as PersistedState
}

export function savePersistedState(state: PersistedState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function readTextFile(file: File): Promise<string> {
  return file.text()
}
