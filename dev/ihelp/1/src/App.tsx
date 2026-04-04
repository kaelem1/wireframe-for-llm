/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { BoardStrip } from './components/BoardStrip'
import { BoardSurface } from './components/BoardSurface'
import { ComponentLibrary } from './components/ComponentLibrary'
import { CreateProjectDialog } from './components/CreateProjectDialog'
import { Toolbar } from './components/Toolbar'
import { attachEditorStorePersistence, useEditorStore } from './stores/editorStore'
import type { AlignmentGuide, BoardComponent, ProjectDocument, Size } from './types/schema'
import { ACTION_OPTIONS, COMPONENT_META, TRIGGER_OPTIONS } from './utils/catalog'
import { clamp, getSnapResult } from './utils/geometry'
import { buildAIGenerationSystemPrompt, buildAIRestoreSystemPrompt, requestJsonCompletion } from './utils/llm'
import { assertProjectDocument, serializeProject } from './utils/project'
import { downloadTextFile, loadPersistedState, readTextFile } from './utils/storage'

type Frame = Pick<BoardComponent, 'x' | 'y' | 'width' | 'height'>

type PointerSession = {
  componentId: string
  boardId: string
  boardSize: Size
  startX: number
  startY: number
  startFrame: Frame
  lastFrame: Frame
  kind: 'move' | 'resize'
  handle?: 's' | 'e' | 'se'
}

type ContextMenuState = {
  x: number
  y: number
  componentId: string
}

function App() {
  const initialized = useEditorStore((state) => state.initialized)
  const project = useEditorStore((state) => state.project)
  const aiConfig = useEditorStore((state) => state.aiConfig)
  const selectedBoardId = useEditorStore((state) => state.selectedBoardId)
  const selectedComponentId = useEditorStore((state) => state.selectedComponentId)
  const preview = useEditorStore((state) => state.preview)
  const panels = useEditorStore((state) => state.panels)
  const restoreTest = useEditorStore((state) => state.restoreTest)

  const [bootError, setBootError] = useState('')
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [liveFrame, setLiveFrame] = useState<Record<string, Frame>>({})
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const boardStageRef = useRef<HTMLDivElement | null>(null)
  const pointerSessionRef = useRef<PointerSession | null>(null)
  const moveHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)
  const upHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null)

  const currentBoard = useMemo(() => {
    if (!project) {
      return null
    }
    const boardId = preview.active ? preview.currentBoardId : selectedBoardId
    return project.boards.find((board) => board.id === boardId) ?? project.boards[0] ?? null
  }, [preview.active, preview.currentBoardId, project, selectedBoardId])

  const selectedComponent = useMemo(() => {
    if (!currentBoard || !selectedComponentId) {
      return null
    }
    return currentBoard.components.find((component) => component.id === selectedComponentId) ?? null
  }, [currentBoard, selectedComponentId])

  const boardNameById = useMemo(() => {
    const map = new Map<string, string>()
    project?.boards.forEach((board) => map.set(board.id, board.name))
    return map
  }, [project])

  const modalNameById = useMemo(() => {
    const map = new Map<string, string>()
    project?.boards.forEach((board) => {
      board.components.forEach((component) => {
        if (component.type === 'Modal') {
          map.set(component.id, component.name)
        }
      })
    })
    return map
  }, [project])

  useEffect(() => {
    attachEditorStorePersistence()
    try {
      const persisted = loadPersistedState()
      if (persisted?.project) {
        assertProjectDocument(persisted.project)
      }
      useEditorStore.getState().hydrateState(persisted ?? null)
    } catch (error) {
      setBootError(error instanceof Error ? error.message : String(error))
      useEditorStore.getState().hydrateState(null)
    }
  }, [])

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null)
    window.addEventListener('mousedown', closeContextMenu)
    return () => window.removeEventListener('mousedown', closeContextMenu)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName
        if (event.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        useEditorStore.getState().setPreviewActive(!preview.active)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleExport()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        useEditorStore.getState().duplicateSelectedComponent()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          useEditorStore.getState().redo()
        } else {
          useEditorStore.getState().undo()
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        useEditorStore.getState().addBoard()
        return
      }
      if (event.key === 'Backspace' && selectedComponentId) {
        event.preventDefault()
        useEditorStore.getState().deleteSelectedComponent()
        return
      }
      if (!selectedComponentId) {
        return
      }

      const step = event.shiftKey ? 8 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        useEditorStore.getState().moveSelectedComponentBy(0, -step)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        useEditorStore.getState().moveSelectedComponentBy(0, step)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        useEditorStore.getState().moveSelectedComponentBy(-step, 0)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        useEditorStore.getState().moveSelectedComponentBy(step, 0)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [preview.active, selectedComponentId])

  useEffect(() => {
    const onPointerCancel = () => endPointerSession()
    window.addEventListener('pointercancel', onPointerCancel)
    return () => window.removeEventListener('pointercancel', onPointerCancel)
  }, [])

  function endPointerSession() {
    if (moveHandlerRef.current) {
      window.removeEventListener('pointermove', moveHandlerRef.current)
      moveHandlerRef.current = null
    }
    if (upHandlerRef.current) {
      window.removeEventListener('pointerup', upHandlerRef.current)
      upHandlerRef.current = null
    }
    pointerSessionRef.current = null
    setLiveFrame({})
    setGuides([])
  }

  function startPointerSession(session: PointerSession) {
    endPointerSession()
    pointerSessionRef.current = session

    const handleMove = (event: globalThis.PointerEvent) => {
      const active = pointerSessionRef.current
      if (!active || !project) {
        return
      }
      const board = project.boards.find((item) => item.id === active.boardId)
      if (!board) {
        return
      }
      const dx = event.clientX - active.startX
      const dy = event.clientY - active.startY
      const candidate: Frame = {
        x: active.startFrame.x + (active.kind === 'move' ? dx : 0),
        y: active.startFrame.y + (active.kind === 'move' ? dy : 0),
        width:
          active.kind === 'resize' && (active.handle === 'e' || active.handle === 'se')
            ? active.startFrame.width + dx
            : active.startFrame.width,
        height:
          active.kind === 'resize' && (active.handle === 's' || active.handle === 'se')
            ? active.startFrame.height + dy
            : active.startFrame.height,
      }
      const result = getSnapResult(candidate, active.componentId, active.boardSize, board.components)
      active.lastFrame = result.frame
      setLiveFrame({ [active.componentId]: result.frame })
      setGuides(result.guides)
    }

    const handleUp = () => {
      const active = pointerSessionRef.current
      if (active) {
        useEditorStore.getState().updateComponentFrame(active.componentId, active.lastFrame)
      }
      endPointerSession()
    }

    moveHandlerRef.current = handleMove
    upHandlerRef.current = handleUp
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
  }

  function clearSelection() {
    setContextMenu(null)
    setEditingComponentId(null)
    setEditingNameValue('')
    useEditorStore.getState().selectComponent(null)
  }

  function startNameEdit(componentId: string, name: string) {
    setEditingComponentId(componentId)
    setEditingNameValue(name)
  }

  function commitNameEdit() {
    if (editingComponentId) {
      useEditorStore.getState().renameComponent(editingComponentId, editingNameValue)
    }
    setEditingComponentId(null)
    setEditingNameValue('')
  }

  function cancelNameEdit() {
    setEditingComponentId(null)
    setEditingNameValue('')
  }

  function resolveTargetLabel(targetId: string): string | null {
    return boardNameById.get(targetId) ?? modalNameById.get(targetId) ?? null
  }

  function handleProjectCreate(payload: { projectName: string; device: ProjectDocument['device']; boardSize: ProjectDocument['boardSize'] }) {
    useEditorStore.getState().createProject(payload)
    setContextMenu(null)
  }

  function handleExport() {
    if (!project) {
      return
    }
    downloadTextFile(`${project.project || '未命名项目'}.json`, serializeProject(project))
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    try {
      const text = await readTextFile(file)
      const imported = assertProjectDocument(JSON.parse(text))
      useEditorStore.getState().replaceProject(imported)
      setBootError('')
    } catch (error) {
      setBootError(error instanceof Error ? error.message : '导入失败')
    }
  }

  async function handleGenerateProjectFromAI() {
    if (!project) {
      return
    }
    setAiBusy(true)
    setAiError('')
    try {
      const generated = await requestJsonCompletion<ProjectDocument>({
        config: aiConfig,
        systemPrompt: buildAIGenerationSystemPrompt(project),
        userPrompt: aiPrompt.trim() || '请根据当前描述生成线框图原型 JSON。',
      })
      assertProjectDocument(generated)
      useEditorStore.getState().replaceProject(generated)
      useEditorStore.getState().setPanelOpen('aiPanelOpen', false)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : String(error))
    } finally {
      setAiBusy(false)
    }
  }

  async function runRestoreTest() {
    if (!project) {
      return
    }
    const prompt = '请生成一个渲染此线框图原型的 React 组件。使用灰色矩形并标注与组件名称匹配的标签。保持精确的位置和尺寸。实现所有导航交互。'
    useEditorStore.getState().setRestoreTest({ status: 'running', generatedCode: '', prompt, error: null })
    try {
      const result = await requestJsonCompletion<{ code: string }>({
        config: aiConfig,
        systemPrompt: buildAIRestoreSystemPrompt(project),
        userPrompt: `${prompt}\n\n${serializeProject(project)}`,
      })
      if (typeof result.code !== 'string') {
        throw new Error('AI 还原结果缺少 code 字段')
      }
      useEditorStore.getState().setRestoreTest({ status: 'success', generatedCode: result.code, prompt, error: null })
      useEditorStore.getState().setPanelOpen('restoreTestOpen', true)
      useEditorStore.getState().setPanelOpen('settingsOpen', false)
    } catch (error) {
      useEditorStore.getState().setRestoreTest({
        status: 'error',
        generatedCode: '',
        prompt,
        error: error instanceof Error ? error.message : 'AI 还原测试失败',
      })
      useEditorStore.getState().setPanelOpen('restoreTestOpen', true)
    }
  }

  function handlePreviewInteraction(interaction: BoardComponent['interactions'][number]) {
    if (interaction.action === 'navigate') {
      if (!interaction.target) {
        throw new Error('Navigate interaction requires a target')
      }
      useEditorStore.getState().previewNavigate(interaction.target)
      return
    }
    if (interaction.action === 'back') {
      useEditorStore.getState().previewBack()
      return
    }
    if (interaction.action === 'showModal') {
      if (!interaction.target) {
        throw new Error('Show modal interaction requires a target')
      }
      useEditorStore.getState().previewShowModal(interaction.target)
    }
  }

  function handleBoardDrop(event: DragEvent<HTMLDivElement>) {
    if (!project || !currentBoard || preview.active) {
      return
    }
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-component-type') || event.dataTransfer.getData('text/plain')
    if (!(type in COMPONENT_META)) {
      return
    }
    const rect = boardStageRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const x = clamp(event.clientX - rect.left, 0, project.boardSize.width)
    const y = clamp(event.clientY - rect.top, 0, project.boardSize.height)
    useEditorStore.getState().addComponent(type as keyof typeof COMPONENT_META, { x, y })
  }

  function handleContextMenu(componentId: string, event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ x: event.clientX, y: event.clientY, componentId })
    useEditorStore.getState().selectComponent(componentId)
  }

  function beginMove(componentId: string, event: PointerEvent<HTMLDivElement>) {
    if (!project || !currentBoard) {
      return
    }
    event.preventDefault()
    const component = currentBoard.components.find((item) => item.id === componentId)
    if (!component) {
      throw new Error(`Component not found: ${componentId}`)
    }
    startPointerSession({
      componentId,
      boardId: currentBoard.id,
      boardSize: project.boardSize,
      startX: event.clientX,
      startY: event.clientY,
      startFrame: { x: component.x, y: component.y, width: component.width, height: component.height },
      lastFrame: { x: component.x, y: component.y, width: component.width, height: component.height },
      kind: 'move',
    })
  }

  function beginResize(componentId: string, handle: 's' | 'e' | 'se', event: PointerEvent<HTMLButtonElement>) {
    if (!project || !currentBoard) {
      return
    }
    event.preventDefault()
    const component = currentBoard.components.find((item) => item.id === componentId)
    if (!component) {
      throw new Error(`Component not found: ${componentId}`)
    }
    startPointerSession({
      componentId,
      boardId: currentBoard.id,
      boardSize: project.boardSize,
      startX: event.clientX,
      startY: event.clientY,
      startFrame: { x: component.x, y: component.y, width: component.width, height: component.height },
      lastFrame: { x: component.x, y: component.y, width: component.width, height: component.height },
      kind: 'resize',
      handle,
    })
  }

  function buildRestoreIframe(code: string) {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #root { width: 100%; height: 100%; margin: 0; background: #fafafa; overflow: hidden; }
      * { box-sizing: border-box; }
    </style>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel">
      const source = ${JSON.stringify(code)};
      try {
        const compiled = Babel.transform(source, { presets: ['react'] }).code;
        new Function('React', 'ReactDOM', compiled)(window.React, window.ReactDOM);
      } catch (error) {
        document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b91c1c;">' + String(error?.message || error) + '</pre>';
      }
    </script>
  </body>
</html>`
  }

  if (!initialized) {
    return (
      <>
        <GlobalStyles />
        <div className="boot-screen">正在载入…</div>
      </>
    )
  }

  if (!project) {
    return (
      <>
        <GlobalStyles />
        <CreateProjectDialog onCreate={handleProjectCreate} />
      </>
    )
  }

  const previewPath = preview.boardStack.map((boardId) => boardNameById.get(boardId) ?? boardId).join(' → ')
  const restoreIframe = buildRestoreIframe(restoreTest.generatedCode)

  return (
    <>
      <GlobalStyles />
      <div className="app-shell">
        <Toolbar
          projectName={project.project}
          device={project.device}
          onProjectNameChange={(name) => useEditorStore.getState().updateProjectName(name)}
          onExport={handleExport}
          onImport={handleImport}
          onTogglePreview={() => useEditorStore.getState().setPreviewActive(!preview.active)}
          onOpenAI={() => useEditorStore.getState().setPanelOpen('aiPanelOpen', true)}
          onOpenSettings={() => useEditorStore.getState().setPanelOpen('settingsOpen', true)}
        />

        {bootError ? <div className="boot-error">{bootError}</div> : null}

        <div className="workspace">
          {!preview.active ? <ComponentLibrary onAdd={(type) => useEditorStore.getState().addComponent(type)} /> : <div className="sidebar sidebar--ghost" />}

          <main className="canvas">
            <div className="canvas__scroll" onDragOver={(event) => event.preventDefault()} onDrop={handleBoardDrop}>
              <div className="canvas__stage">
                {currentBoard ? (
                  <div ref={boardStageRef} className="canvas__board-shell">
                    <BoardSurface
                      board={currentBoard}
                      boardSize={project.boardSize}
                      mode={preview.active ? 'preview' : 'edit'}
                      selectedComponentId={preview.active ? null : selectedComponentId}
                      editingComponentId={editingComponentId}
                      editingNameValue={editingNameValue}
                      liveFrame={preview.active ? undefined : liveFrame}
                      guides={preview.active ? [] : guides}
                      visibleModalId={preview.visibleModalId}
                      onBoardPointerDown={preview.active ? undefined : clearSelection}
                      onSelectComponent={(componentId) => useEditorStore.getState().selectComponent(componentId)}
                      onContextMenu={preview.active ? undefined : handleContextMenu}
                      onStartDrag={preview.active ? undefined : beginMove}
                      onStartResize={preview.active ? undefined : beginResize}
                      onStartNameEdit={preview.active ? startNameEdit : undefined}
                      onNameChange={preview.active ? undefined : setEditingNameValue}
                      onCommitNameEdit={preview.active ? undefined : commitNameEdit}
                      onCancelNameEdit={preview.active ? undefined : cancelNameEdit}
                      onPreviewInteraction={handlePreviewInteraction}
                      resolveInteractionTargetLabel={resolveTargetLabel}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </main>

          {!preview.active && selectedComponent && currentBoard ? (
            <aside className="sidebar sidebar--right">
              <InteractionPanel
                component={selectedComponent}
                board={currentBoard}
                boards={project.boards}
                onAddInteraction={() => useEditorStore.getState().addInteraction(selectedComponent.id)}
                onChangeInteraction={(interactionId, patch) =>
                  useEditorStore.getState().updateInteraction(selectedComponent.id, interactionId, patch)
                }
                onRemoveInteraction={(interactionId) =>
                  useEditorStore.getState().removeInteraction(selectedComponent.id, interactionId)
                }
                onDuplicate={() => useEditorStore.getState().duplicateSelectedComponent()}
                onDelete={() => useEditorStore.getState().deleteSelectedComponent()}
              />
              <LayerPanel
                board={currentBoard}
                onMove={(componentId, toIndex) => useEditorStore.getState().moveComponentLayer(componentId, toIndex)}
              />
            </aside>
          ) : null}
        </div>

        <BoardStrip
          boards={project.boards}
          selectedBoardId={selectedBoardId}
          onSelect={(boardId) => useEditorStore.getState().selectBoard(boardId)}
          onRename={(boardId, name) => useEditorStore.getState().updateBoardName(boardId, name)}
          onAdd={() => useEditorStore.getState().addBoard()}
          onDelete={(boardId) => useEditorStore.getState().deleteBoard(boardId)}
          onMove={(fromIndex, toIndex) => useEditorStore.getState().moveBoard(fromIndex, toIndex)}
        />
      </div>

      {panels.aiPanelOpen ? (
        <ModalFrame title="AI 生成" onClose={() => useEditorStore.getState().setPanelOpen('aiPanelOpen', false)} wide>
          <div className="modal-stack">
            <label className="field">
              <span>自然语言描述</span>
              <textarea
                className="field__textarea field__textarea--large"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="描述页面结构、内容和页面间关系"
              />
            </label>
            <div className="modal-note">当前模型：{aiConfig.model || '未配置'}</div>
            {aiError ? <div className="modal-error">{aiError}</div> : null}
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={handleGenerateProjectFromAI} disabled={aiBusy}>
                {aiBusy ? '生成中…' : '生成画板'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {panels.settingsOpen ? (
        <ModalFrame title="设置" onClose={() => useEditorStore.getState().setPanelOpen('settingsOpen', false)}>
          <SettingsPanel aiConfig={aiConfig} onChange={(patch) => useEditorStore.getState().setAIConfig(patch)} onRunRestoreTest={runRestoreTest} restoreStatus={restoreTest.status} restoreError={restoreTest.error} />
        </ModalFrame>
      ) : null}

      {panels.restoreTestOpen ? (
        <ModalFrame title="AI 还原测试" onClose={() => useEditorStore.getState().setPanelOpen('restoreTestOpen', false)} wide>
          <RestoreTestPanel project={project} board={currentBoard} path={previewPath} restoreTest={restoreTest} iframeSrcDoc={restoreIframe} />
        </ModalFrame>
      ) : null}

      {contextMenu ? (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            className="context-menu__item"
            onClick={() => {
              useEditorStore.getState().duplicateSelectedComponent()
              setContextMenu(null)
            }}
          >
            复制
          </button>
          <button
            type="button"
            className="context-menu__item context-menu__item--danger"
            onClick={() => {
              useEditorStore.getState().deleteSelectedComponent()
              setContextMenu(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}

      {preview.active && currentBoard ? (
        <PreviewOverlay
          board={currentBoard}
          boardSize={project.boardSize}
          path={previewPath}
          preview={preview}
          onExit={() => useEditorStore.getState().setPreviewActive(false)}
          onInteraction={handlePreviewInteraction}
          resolveInteractionTargetLabel={resolveTargetLabel}
        />
      ) : null}
    </>
  )
}

function ModalFrame({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-shell modal-shell--overlay" onMouseDown={onClose}>
      <div className={`dialog ${wide ? 'dialog--wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog__title">
          <span>{title}</span>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InteractionPanel({
  component,
  board,
  boards,
  onAddInteraction,
  onChangeInteraction,
  onRemoveInteraction,
  onDuplicate,
  onDelete,
}: {
  component: BoardComponent
  board: ProjectDocument['boards'][number]
  boards: ProjectDocument['boards']
  onAddInteraction: () => void
  onChangeInteraction: (interactionId: string, patch: Partial<BoardComponent['interactions'][number]>) => void
  onRemoveInteraction: (interactionId: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const modalBoards = board.components.filter((item) => item.type === 'Modal')

  return (
    <section className="panel">
      <div className="panel-title">
        <span>{component.name}</span>
        <div className="panel-title__actions">
          <button type="button" className="ghost-button" onClick={onDuplicate}>
            复制
          </button>
          <button type="button" className="ghost-button ghost-button--danger" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>
      <div className="panel-note">交互只支持点击、长按、滑动三种触发方式。</div>

      <div className="interaction-list">
        {component.interactions.map((interaction) => {
          const targets = interaction.action === 'showModal' ? modalBoards : boards
          return (
            <div key={interaction.id} className="interaction-card">
              <div className="interaction-card__grid">
                <label className="field">
                  <span>触发方式</span>
                  <select className="field__select" value={interaction.trigger} onChange={(event) => onChangeInteraction(interaction.id, { trigger: event.target.value as BoardComponent['interactions'][number]['trigger'] })}>
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>动作</span>
                  <select
                    className="field__select"
                    value={interaction.action}
                    onChange={(event) => {
                      const action = event.target.value as BoardComponent['interactions'][number]['action']
                      onChangeInteraction(interaction.id, {
                        action,
                        target: action === 'back' ? undefined : action === 'navigate' ? boards[0]?.id : modalBoards[0]?.id,
                      })
                    }}
                  >
                    {ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {interaction.action !== 'back' ? (
                  <label className="field field--full">
                    <span>目标</span>
                    <select className="field__select" value={interaction.target ?? ''} onChange={(event) => onChangeInteraction(interaction.id, { target: event.target.value || undefined })} disabled={targets.length === 0}>
                      <option value="">{targets.length === 0 ? '无可选目标' : '请选择目标'}</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <button type="button" className="ghost-button ghost-button--danger interaction-card__remove" onClick={() => onRemoveInteraction(interaction.id)}>
                删除交互
              </button>
            </div>
          )
        })}
      </div>

      <button type="button" className="secondary-button" onClick={onAddInteraction}>
        + 添加交互
      </button>
    </section>
  )
}

function LayerPanel({
  board,
  onMove,
}: {
  board: ProjectDocument['boards'][number]
  onMove: (componentId: string, toIndex: number) => void
}) {
  return (
    <section className="panel">
      <div className="panel-title">图层</div>
      <div className="layer-list">
        {board.components.map((component, index) => (
          <div
            key={component.id}
            className="layer-item"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', component.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const sourceId = event.dataTransfer.getData('text/plain')
              if (sourceId) {
                onMove(sourceId, index)
              }
            }}
          >
            <span className="layer-item__drag">⋮⋮</span>
            <span className="layer-item__name">{component.name}</span>
            <span className="layer-item__meta">{COMPONENT_META[component.type].label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function SettingsPanel({
  aiConfig,
  onChange,
  onRunRestoreTest,
  restoreStatus,
  restoreError,
}: {
  aiConfig: { baseUrl: string; apiKey: string; model: string }
  onChange: (patch: Partial<{ baseUrl: string; apiKey: string; model: string }>) => void
  onRunRestoreTest: () => void
  restoreStatus: string
  restoreError: string | null
}) {
  return (
    <div className="modal-stack">
      <label className="field">
        <span>Base URL</span>
        <input className="field__input" value={aiConfig.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} />
      </label>
      <label className="field">
        <span>API Key</span>
        <input className="field__input" value={aiConfig.apiKey} onChange={(event) => onChange({ apiKey: event.target.value })} />
      </label>
      <label className="field">
        <span>模型名称</span>
        <input className="field__input" value={aiConfig.model} onChange={(event) => onChange({ model: event.target.value })} />
      </label>

      <div className="modal-note">设置仅保存在本地，不会进入导出的 JSON。</div>
      <div className="modal-note">还原测试状态：{restoreStatus}</div>
      {restoreError ? <div className="modal-error">{restoreError}</div> : null}

      <div className="modal-actions">
        <button type="button" className="primary-button" onClick={onRunRestoreTest}>
          运行 AI 还原测试
        </button>
      </div>
    </div>
  )
}

function RestoreTestPanel({
  project,
  board,
  path,
  restoreTest,
  iframeSrcDoc,
}: {
  project: ProjectDocument
  board: ProjectDocument['boards'][number] | null
  path: string
  restoreTest: { status: string; generatedCode: string; error: string | null }
  iframeSrcDoc: string
}) {
  return (
    <div className="restore-grid">
      <div className="restore-card">
        <div className="restore-card__title">原始版本</div>
        {board ? (
          <div className="restore-card__surface">
            <BoardSurface board={board} boardSize={project.boardSize} mode="preview" selectedComponentId={null} visibleModalId={null} onPreviewInteraction={() => undefined} />
          </div>
        ) : (
          <div className="panel-empty">没有可比较的画板</div>
        )}
        <div className="restore-card__caption">{path}</div>
      </div>

      <div className="restore-card">
        <div className="restore-card__title">AI 生成版本</div>
        <iframe className="restore-card__iframe" title="AI 生成版本" srcDoc={iframeSrcDoc} />
        <div className="restore-card__caption">状态：{restoreTest.status}</div>
      </div>

      <div className="restore-card restore-card--code">
        <div className="restore-card__title">生成代码</div>
        <pre className="code-view">{restoreTest.generatedCode || '尚未生成代码'}</pre>
      </div>
    </div>
  )
}

function PreviewOverlay({
  board,
  boardSize,
  path,
  preview,
  onExit,
  onInteraction,
  resolveInteractionTargetLabel,
}: {
  board: ProjectDocument['boards'][number]
  boardSize: Size
  path: string
  preview: { visibleModalId: string | null; animationDirection: 'forward' | 'back' | null }
  onExit: () => void
  onInteraction: (interaction: BoardComponent['interactions'][number]) => void
  resolveInteractionTargetLabel: (targetId: string) => string | null
}) {
  return (
    <div className="preview-overlay">
      <div className="preview-overlay__top">
        <div className="preview-overlay__path">{path}</div>
        <button type="button" className="preview-overlay__exit" onClick={onExit}>
          退出预览
        </button>
      </div>
      <div className={`preview-overlay__stage preview-overlay__stage--${preview.animationDirection ?? 'none'}`}>
        <div className="preview-overlay__frame" style={{ width: boardSize.width, height: boardSize.height }}>
          <BoardSurface
            board={board}
            boardSize={boardSize}
            mode="preview"
            visibleModalId={preview.visibleModalId}
            onPreviewInteraction={onInteraction}
            resolveInteractionTargetLabel={resolveInteractionTargetLabel}
          />
        </div>
      </div>
    </div>
  )
}

function GlobalStyles() {
  return <style>{styles}</style>
}

const styles = `
:root {
  --bg: #fafafa;
  --panel: rgba(255, 255, 255, 0.92);
  --panel-border: #e4e4e7;
  --panel-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
  --text: #1f2937;
  --muted: #6b7280;
  --soft: #f3f4f6;
  --accent: #2563eb;
  --accent-soft: rgba(37, 99, 235, 0.12);
  --danger: #dc2626;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--bg);
}

* { box-sizing: border-box; }
html, body, #root { width: 100%; min-height: 100%; }
body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 30%),
    radial-gradient(circle at right top, rgba(15, 118, 110, 0.08), transparent 26%),
    #fafafa;
}
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }

.boot-screen { min-height: 100vh; display: grid; place-items: center; color: var(--muted); }
.boot-error {
  position: fixed; left: 16px; right: 16px; top: 16px; z-index: 50;
  padding: 10px 14px; border-radius: 14px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b;
}
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; border-bottom: 1px solid var(--panel-border);
  background: rgba(250, 250, 250, 0.92); backdrop-filter: blur(18px);
}
.toolbar__group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.toolbar__project-input, .toolbar__device, .toolbar__button, .toolbar__button--ghost {
  height: 38px; border-radius: 12px; border: 1px solid var(--panel-border); background: #fff; color: var(--text);
}
.toolbar__project-input { width: 220px; padding: 0 12px; font-weight: 600; }
.toolbar__device { display: inline-flex; align-items: center; padding: 0 12px; color: var(--muted); background: var(--soft); }
.toolbar__button, .toolbar__button--ghost, .primary-button, .secondary-button, .ghost-button {
  padding: 0 14px; transition: transform 140ms ease, box-shadow 140ms ease;
}
.toolbar__button, .primary-button { background: var(--accent); color: #fff; border-color: var(--accent); }
.toolbar__button--ghost, .secondary-button, .ghost-button { background: #fff; }
.toolbar__button:hover, .toolbar__button--ghost:hover, .primary-button:hover, .secondary-button:hover, .ghost-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}
.workspace {
  flex: 1; min-height: 0; display: grid; grid-template-columns: 276px minmax(0, 1fr) 320px;
}
.sidebar { min-width: 0; display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.sidebar--left { border-right: 1px solid var(--panel-border); background: rgba(255, 255, 255, 0.68); }
.sidebar--right { border-left: 1px solid var(--panel-border); background: rgba(255, 255, 255, 0.68); overflow-y: auto; }
.sidebar--ghost { border-right: 1px solid var(--panel-border); }
.panel, .dialog, .board-card, .interaction-card, .layer-item, .restore-card, .context-menu, .board-surface {
  background: var(--panel); border: 1px solid var(--panel-border); box-shadow: var(--panel-shadow);
}
.panel { padding: 16px; border-radius: 20px; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-weight: 700; }
.panel-title__actions { display: flex; gap: 8px; }
.panel-note { margin-bottom: 12px; color: var(--muted); font-size: 13px; line-height: 1.5; }
.panel-empty { min-height: 160px; display: grid; place-items: center; border: 1px dashed var(--panel-border); border-radius: 16px; color: var(--muted); }
.component-library { display: grid; gap: 10px; }
.component-library__item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 12px 14px; border-radius: 16px; border: 1px solid var(--panel-border); background: #fff; text-align: left;
}
.component-library__icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; background: var(--soft); color: #4b5563; font-weight: 700; }
.canvas { min-width: 0; min-height: 0; overflow: hidden; }
.canvas__scroll { width: 100%; height: 100%; overflow: auto; padding: 36px; }
.canvas__stage { min-width: 100%; min-height: 100%; display: grid; place-items: center; }
.canvas__board-shell { position: relative; }
.board-surface {
  position: relative; overflow: hidden; border-radius: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88)), #fff;
}
.surface-block {
  position: absolute; border-radius: 8px; background: #f0f0f0; border: 1px solid #d0d0d0;
  color: #3f3f46; overflow: hidden; user-select: none;
}
.surface-block--selected { outline: 2px solid rgba(37, 99, 235, 0.45); outline-offset: 1px; }
.surface-block--modal { z-index: 10; }
.surface-block__content { position: absolute; inset: 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.surface-block__icon { color: #6b7280; font-size: 14px; }
.surface-block__name { appearance: none; border: 0; background: transparent; padding: 0; color: inherit; text-align: left; font-weight: 600; }
.surface-block__name-input { width: min(100%, 180px); border: 1px solid var(--panel-border); border-radius: 8px; padding: 4px 8px; background: #fff; }
.surface-block__badge {
  position: absolute; right: 8px; top: 8px; padding: 3px 7px; border-radius: 999px;
  background: rgba(37, 99, 235, 0.14); color: var(--accent); font-size: 12px; font-weight: 700;
}
.resize-handle { position: absolute; border: 0; background: transparent; }
.resize-handle--s { left: 50%; bottom: -4px; width: 18px; height: 10px; transform: translateX(-50%); cursor: ns-resize; }
.resize-handle--e { right: -4px; top: 50%; width: 10px; height: 18px; transform: translateY(-50%); cursor: ew-resize; }
.resize-handle--se { right: -5px; bottom: -5px; width: 16px; height: 16px; cursor: nwse-resize; }
.alignment-guide { position: absolute; pointer-events: none; z-index: 4; background: rgba(37, 99, 235, 0.35); }
.alignment-guide--x { width: 1px; }
.alignment-guide--y { height: 1px; }
.board-strip { border-top: 1px solid var(--panel-border); background: rgba(255, 255, 255, 0.92); padding: 12px 16px 14px; }
.board-strip__scroll { display: flex; gap: 12px; overflow-x: auto; align-items: stretch; }
.board-card { min-width: 200px; border-radius: 18px; padding: 12px; }
.board-card--active { border-color: rgba(37, 99, 235, 0.5); box-shadow: 0 16px 40px rgba(37, 99, 235, 0.12); }
.board-card--add { min-width: 150px; display: grid; place-items: center; color: var(--muted); background: #fff; }
.board-card__thumbnail { height: 74px; border-radius: 14px; background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(15, 118, 110, 0.08)); display: flex; align-items: flex-end; padding: 10px; color: var(--muted); font-size: 12px; }
.board-card__name { width: 100%; margin-top: 10px; border-radius: 10px; border: 1px solid var(--panel-border); padding: 8px 10px; background: #fff; }
.board-card__delete { margin-top: 10px; border: 0; background: transparent; color: var(--danger); padding: 0; }
.modal-shell, .preview-overlay { position: fixed; inset: 0; z-index: 40; }
.modal-shell--overlay { display: grid; place-items: center; background: rgba(15, 23, 42, 0.48); padding: 24px; }
.dialog { width: min(540px, calc(100vw - 32px)); max-height: min(86vh, 920px); overflow: auto; border-radius: 24px; padding: 18px; }
.dialog--wide { width: min(980px, calc(100vw - 32px)); }
.dialog__title { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; font-weight: 700; }
.modal-stack { display: grid; gap: 14px; }
.modal-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.modal-note { color: var(--muted); font-size: 13px; line-height: 1.6; }
.modal-error { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 14px; padding: 10px 12px; }
.field { display: grid; gap: 8px; min-width: 0; }
.field > span { font-size: 13px; color: var(--muted); }
.field--full { grid-column: 1 / -1; }
.field__input, .field__select, .field__textarea {
  width: 100%; border-radius: 12px; border: 1px solid var(--panel-border); background: #fff; color: var(--text); padding: 10px 12px;
}
.field__textarea { resize: vertical; min-height: 120px; }
.field__textarea--large { min-height: 180px; }
.field--row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.interaction-list, .layer-list { display: grid; gap: 10px; margin-bottom: 14px; }
.interaction-card { border-radius: 18px; padding: 14px; }
.interaction-card__grid { display: grid; gap: 12px; }
.interaction-card__remove { margin-top: 12px; }
.layer-item { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 10px; border-radius: 14px; padding: 10px 12px; }
.layer-item__drag { color: var(--muted); }
.layer-item__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.layer-item__meta { color: var(--muted); font-size: 12px; }
.context-menu { position: fixed; min-width: 150px; border-radius: 14px; padding: 6px; }
.context-menu__item { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 10px 12px; border-radius: 10px; }
.context-menu__item:hover { background: var(--soft); }
.context-menu__item--danger { color: var(--danger); }
.secondary-button, .ghost-button, .primary-button { padding: 0 14px; border-radius: 12px; border: 1px solid var(--panel-border); height: 38px; }
.ghost-button--danger { color: var(--danger); }
.restore-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.restore-card { border-radius: 18px; padding: 14px; }
.restore-card--code { grid-column: 1 / -1; }
.restore-card__title { margin-bottom: 12px; font-weight: 700; }
.restore-card__surface { display: grid; place-items: center; overflow: auto; max-height: 60vh; padding: 12px; border: 1px solid var(--panel-border); border-radius: 14px; background: #fff; }
.restore-card__iframe { width: 100%; min-height: 540px; border: 1px solid var(--panel-border); border-radius: 14px; background: #fff; }
.restore-card__caption { margin-top: 10px; color: var(--muted); font-size: 13px; }
.code-view { margin: 0; padding: 14px; min-height: 280px; border-radius: 14px; border: 1px solid var(--panel-border); background: #0f172a; color: #e5e7eb; overflow: auto; }
.preview-overlay { background: rgba(15, 23, 42, 0.96); display: flex; flex-direction: column; }
.preview-overlay__top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 18px; color: #fff; }
.preview-overlay__path { color: rgba(255, 255, 255, 0.72); font-size: 13px; }
.preview-overlay__exit { border: 1px solid rgba(255, 255, 255, 0.16); background: rgba(255, 255, 255, 0.08); color: #fff; border-radius: 12px; padding: 10px 14px; }
.preview-overlay__stage { flex: 1; min-height: 0; display: grid; place-items: center; padding: 24px; }
.preview-overlay__stage--forward { animation: slide-in-left 200ms ease; }
.preview-overlay__stage--back { animation: slide-in-right 200ms ease; }
.preview-overlay__frame { display: grid; place-items: center; }
@keyframes slide-in-left { from { transform: translateX(24px); opacity: 0.7; } to { transform: translateX(0); opacity: 1; } }
@keyframes slide-in-right { from { transform: translateX(-24px); opacity: 0.7; } to { transform: translateX(0); opacity: 1; } }
@media (max-width: 1200px) { .workspace { grid-template-columns: 248px minmax(0, 1fr); } .sidebar--right { position: fixed; right: 0; top: 70px; bottom: 73px; width: 320px; z-index: 12; box-shadow: -20px 0 60px rgba(15, 23, 42, 0.12); } }
@media (max-width: 860px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .workspace { grid-template-columns: 1fr; }
  .sidebar--left { border-right: 0; border-bottom: 1px solid var(--panel-border); }
  .sidebar--right { position: static; width: auto; border-left: 0; border-top: 1px solid var(--panel-border); }
  .restore-grid { grid-template-columns: 1fr; }
  .field--row { grid-template-columns: 1fr; }
}
`

export default App
