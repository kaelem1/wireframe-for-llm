/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

export const APP_STORAGE_KEY = 'helpai-app-state-v1'

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return globalThis.localStorage as Storage
  }

  return null
}

export function readStorage<T>(key: string): T | null {
  const storage = getStorage()

  if (!storage) {
    return null
  }

  const raw = storage.getItem(key)

  if (!raw) {
    return null
  }

  return JSON.parse(raw) as T
}

export function writeStorage(key: string, value: unknown): void {
  const storage = getStorage()

  if (!storage) {
    return
  }

  storage.setItem(key, JSON.stringify(value))
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  if (typeof document === 'undefined') {
    return
  }

  const blob = new Blob([content], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(href)
}
