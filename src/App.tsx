/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前统一为单一画布工作流，项目名入口固定在左栏，locale 由浏览器自动检测
3. Escape 只清当前已选组件，不清待放置组件
4. 当前复用组件复制链路支持快捷键复制粘贴
5. 顶部 toolbar 与 preview 入口已删除，导出能力移到右栏顶部
6. 待放置时在 workspace 底部居中显示退出放置 toast
7. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef } from 'react'
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
    selectedComponentIds.length,
    selectComponent,
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
          <InteractionPanel />
        </aside>
      </div>

      {pendingComponentType ? (
        <div className="workspace-toast" role="status" aria-live="polite">
          {t(locale, 'placementToast')}
        </div>
      ) : null}

      <BoardStrip />
    </div>
  )
}
