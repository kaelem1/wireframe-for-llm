/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前统一为单一画布工作流，项目名入口固定在左栏，locale 由浏览器自动检测
3. Escape 只清当前已选组件，不清待放置组件
4. 当前复用组件复制链路支持快捷键复制粘贴
5. 顶部 toolbar 与 preview 入口已删除，导出能力移到右栏顶部，复制/导出 JSON 成功后在底部显示短时 toast
6. 待放置时在 workspace 底部居中显示可点击的退出放置 toast
7. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef, useState } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { BoardStrip } from './components/BoardStrip'
import { ComponentPalette } from './components/ComponentPalette'
import { InteractionPanel } from './components/InteractionPanel'
import { SetupDialog } from './components/SetupDialog'
import { useAppStore } from './stores/appStore'
import { t } from './utils/i18n'
import { findComponentById } from './utils/project'
import type { ProtoComponent } from './types/schema'
import { createDebouncedSnapshotSaver } from './utils/storage'

const saveSnapshot = createDebouncedSnapshotSaver(500)

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export default function App() {
  const clipboardRef = useRef<ProtoComponent[]>([])
  const actionToastTimerRef = useRef<number | null>(null)
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const locale = useAppStore((state) => state.locale)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const wireframe = useAppStore((state) => state.wireframe)
  const initializeProject = useAppStore((state) => state.initializeProject)
  const addBoard = useAppStore((state) => state.addBoard)
  const deleteSelectedComponents = useAppStore((state) => state.deleteSelectedComponents)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)
  const moveSelectedBy = useAppStore((state) => state.moveSelectedBy)
  const pasteComponents = useAppStore((state) => state.pasteComponents)
  const getWorkspaceSnapshot = useAppStore((state) => state.getWorkspaceSnapshot)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const [actionToastMessage, setActionToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!project) {
      return
    }

    saveSnapshot(getWorkspaceSnapshot())
  }, [project, settings, locale, activeBoardId, wireframe, getWorkspaceSnapshot])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
    document.title = locale === 'zh' ? '线框原型工具' : 'Wireframe Prototype Tool'
  }, [locale])

  useEffect(
    () => () => {
      if (actionToastTimerRef.current !== null) {
        window.clearTimeout(actionToastTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey

      if (isTypingTarget(event.target)) {
        return
      }

      if (meta && event.key.toLowerCase() === 'd' && selectedComponentId) {
        event.preventDefault()
        duplicateComponent(selectedComponentId)
      }

      if (meta && event.key.toLowerCase() === 'c' && project && selectedComponentIds.length > 0) {
        event.preventDefault()
        clipboardRef.current = selectedComponentIds
          .map((componentId) => findComponentById(project, componentId)?.component)
          .filter((component): component is ProtoComponent => Boolean(component))
          .map((component) => ({
            ...component,
            interactions: component.interactions.map((interaction) => ({ ...interaction })),
          }))
      }

      if (meta && event.key.toLowerCase() === 'v' && clipboardRef.current.length > 0) {
        event.preventDefault()
        pasteComponents(clipboardRef.current)
      }

      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        addBoard()
      }

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      if (event.key === 'Escape' && selectedComponentIds.length > 0) {
        event.preventDefault()
        selectComponent(null)
      }

      if (event.key === 'Backspace' && selectedComponentIds.length > 0) {
        event.preventDefault()
        deleteSelectedComponents()
      }

      if (selectedComponentIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        const step = event.shiftKey ? 8 : 1
        if (event.key === 'ArrowUp') moveSelectedBy(0, -step)
        if (event.key === 'ArrowDown') moveSelectedBy(0, step)
        if (event.key === 'ArrowLeft') moveSelectedBy(-step, 0)
        if (event.key === 'ArrowRight') moveSelectedBy(step, 0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    addBoard,
    deleteSelectedComponents,
    duplicateComponent,
    moveSelectedBy,
    pasteComponents,
    project,
    redo,
    selectedComponentId,
    selectedComponentIds,
    selectComponent,
    setPendingComponentType,
    undo,
  ])

  if (!project) {
    return (
      <SetupDialog
        onCreate={(projectName, device, width, height) =>
          initializeProject(projectName, device, { width, height })
        }
      />
    )
  }

  function showActionToast(message: string) {
    setActionToastMessage(message)
    if (actionToastTimerRef.current !== null) {
      window.clearTimeout(actionToastTimerRef.current)
    }
    actionToastTimerRef.current = window.setTimeout(() => {
      setActionToastMessage(null)
      actionToastTimerRef.current = null
    }, 1500)
  }

  async function handleCopyJson(jsonText: string) {
    await navigator.clipboard.writeText(jsonText)
    showActionToast(t(locale, 'copySuccess'))
  }

  function handleExportJson() {
    showActionToast(t(locale, 'exportSuccess'))
  }

  return (
    <div className="app-shell">
      <div className="workspace">
        <aside className="workspace__sidebar workspace__sidebar--left">
          <ComponentPalette />
        </aside>

        <main className="workspace__center">
          <BoardCanvas />
        </main>

        <aside className="workspace__sidebar workspace__sidebar--right">
          <InteractionPanel onCopyJson={handleCopyJson} onExportJson={handleExportJson} />
        </aside>
      </div>

      {actionToastMessage ? (
        <div className="workspace-toast workspace-toast--status" role="status" aria-live="polite">
          {actionToastMessage}
        </div>
      ) : null}

      {pendingComponentType ? (
        <button
          type="button"
          className="workspace-toast"
          onClick={() => setPendingComponentType(null)}
        >
          {t(locale, 'placementToast')}
        </button>
      ) : null}

      <BoardStrip />
    </div>
  )
}
