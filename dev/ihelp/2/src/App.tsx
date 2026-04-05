/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前统一为单一画布工作流，并保留左右栏同时编辑组件与图层
3. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { BoardStrip } from './components/BoardStrip'
import { ComponentPalette } from './components/ComponentPalette'
import { InteractionPanel } from './components/InteractionPanel'
import { PreviewOverlay } from './components/PreviewOverlay'
import { SetupDialog } from './components/SetupDialog'
import { Toolbar } from './components/Toolbar'
import { useAppStore } from './stores/appStore'
import { DEVICE_PRESETS } from './utils/constants'
import { downloadJson } from './utils/project'
import { createDebouncedSnapshotSaver } from './utils/storage'

const saveSnapshot = createDebouncedSnapshotSaver(500)

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export default function App() {
  const importRef = useRef<HTMLInputElement>(null)
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const wireframe = useAppStore((state) => state.wireframe)
  const isPreview = useAppStore((state) => state.isPreview)
  const initializeProject = useAppStore((state) => state.initializeProject)
  const importProjectJson = useAppStore((state) => state.importProjectJson)
  const exportProject = useAppStore((state) => state.exportProjectJson)
  const setProjectName = useAppStore((state) => state.setProjectName)
  const addBoard = useAppStore((state) => state.addBoard)
  const deleteSelectedComponents = useAppStore((state) => state.deleteSelectedComponents)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)
  const moveSelectedBy = useAppStore((state) => state.moveSelectedBy)
  const togglePreview = useAppStore((state) => state.togglePreview)
  const getWorkspaceSnapshot = useAppStore((state) => state.getWorkspaceSnapshot)
  const undo = useAppStore((state) => state.undo)
  const redo = useAppStore((state) => state.redo)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const selectComponent = useAppStore((state) => state.selectComponent)

  useEffect(() => {
    if (!project) {
      return
    }

    saveSnapshot(getWorkspaceSnapshot())
  }, [project, settings, activeBoardId, wireframe, getWorkspaceSnapshot])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        if (project) {
          togglePreview()
        }
      }

      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!project) {
          return
        }
        downloadJson(`${project.project || 'wireframe-project'}.json`, JSON.parse(exportProject()))
      }

      if (isTypingTarget(event.target)) {
        return
      }

      if (meta && event.key.toLowerCase() === 'd' && selectedComponentId) {
        event.preventDefault()
        duplicateComponent(selectedComponentId)
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

      if (event.key === 'Escape') {
        if (pendingComponentType) {
          event.preventDefault()
          setPendingComponentType(null)
          return
        }
        if (selectedComponentIds.length > 0) {
          event.preventDefault()
          selectComponent(null)
        }
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
    exportProject,
    moveSelectedBy,
    pendingComponentType,
    project,
    redo,
    selectedComponentId,
    selectedComponentIds.length,
    selectComponent,
    setPendingComponentType,
    togglePreview,
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

  const deviceLabel = DEVICE_PRESETS.find((item) => item.key === project.device)?.label ?? project.device

  return (
    <>
      <div className="app-shell">
        <Toolbar
          projectName={project.project}
          deviceLabel={deviceLabel}
          boardSizeLabel={`${project.boardSize.width} × ${project.boardSize.height}`}
          isPreview={isPreview}
          onProjectNameChange={setProjectName}
          onExport={() => downloadJson(`${project.project || 'wireframe-project'}.json`, JSON.parse(exportProject()))}
          onImport={() => importRef.current?.click()}
          onTogglePreview={togglePreview}
        />

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

        <BoardStrip />
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) {
            return
          }
          importProjectJson(await file.text())
          event.target.value = ''
        }}
      />
      <PreviewOverlay />
    </>
  )
}
