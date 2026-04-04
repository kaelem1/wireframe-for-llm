/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef, useState } from 'react'

import { generateWireframeElements, requestAlignmentInterpretation } from '../../lib/ai'
import { compareAlignment } from '../../lib/alignment'
import { buildAiArtifacts } from '../../lib/exporters'
import { applyPreviewElementInteractions, createPreviewSession } from '../../lib/preview'
import { downloadTextFile } from '../../lib/storage'
import { appStore, useAppStoreState } from '../../store/useAppStore'
import type {
  InteractionAction,
  PreviewSession,
  PrototypeBoard,
  PrototypeElement,
  PrototypeInteraction,
  ToolType,
} from '../../types/prototype'
import { BoardCanvas } from './BoardCanvas'
import { PreviewOverlay } from './PreviewOverlay'

const TOOL_ITEMS: Array<{
  id: ToolType
  label: string
  short: string
}> = [
  { id: 'select', label: '选择', short: 'V' },
  { id: 'rect', label: '矩形', short: 'R' },
  { id: 'circle', label: '圆形', short: 'O' },
  { id: 'ellipse', label: '椭圆', short: 'O' },
  { id: 'line', label: '线段', short: 'L' },
  { id: 'text', label: '文字', short: 'T' },
  { id: 'image_placeholder', label: '图片占位', short: 'IMG' },
]

const ACTION_LABELS: Record<InteractionAction, string> = {
  navigateTo: '跳转页面',
  goBack: '返回上一页',
  toggleState: '切换状态',
  showHide: '显示 / 隐藏',
}

function ModalFrame(props: {
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{props.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{props.description}</p>
          </div>
          <button className="secondary-button" type="button" onClick={props.onClose}>
            关闭
          </button>
        </div>

        <div className="mt-6">{props.children}</div>

        {props.footer ? <div className="mt-6 flex justify-end gap-3">{props.footer}</div> : null}
      </div>
    </div>
  )
}

function FieldBlock(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="field-label">{props.label}</span>
      {props.children}
    </label>
  )
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{props.title}</h3>
      {props.children}
    </section>
  )
}

function copyText(content: string) {
  navigator.clipboard.writeText(content).catch(() => {
    window.alert('复制失败，请手动复制。')
  })
}

export function EditorPage() {
  const state = useAppStoreState()
  const project = state.projects.find((candidate) => candidate.id === state.currentProjectId) ?? null
  const [toolboxCollapsed, setToolboxCollapsed] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isAlignmentOpen, setIsAlignmentOpen] = useState(false)
  const [previewSession, setPreviewSession] = useState<PreviewSession | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    boardId: string
    elementId: string
  } | null>(null)
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const timer = window.setInterval(() => {
      appStore.getState().saveNow()
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleDocumentClick = () => {
      setContextMenu(null)
    }

    window.addEventListener('click', handleDocumentClick)
    return () => window.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (previewSession) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setPreviewSession(null)
        }

        return
      }

      if (!project) {
        return
      }

      const selectedContext = project.boards
        .map((board) => ({
          board,
          element:
            board.elements.find((element) => element.id === state.selectedElementId) ?? null,
        }))
        .find((entry) => entry.element)
      const selectedBoard = selectedContext?.board ?? null
      const selectedElement = selectedContext?.element ?? null
      const shortcut = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && shortcut === 's') {
        event.preventDefault()
        state.saveNow()
      }

      if ((event.metaKey || event.ctrlKey) && shortcut === 'e') {
        event.preventDefault()
        setIsExportOpen(true)
      }

      if ((event.metaKey || event.ctrlKey) && shortcut === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          state.redo()
        } else {
          state.undo()
        }
        return
      }

      if (isTyping) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && shortcut === 'd' && selectedBoard && selectedElement) {
        event.preventDefault()
        state.duplicateElement(selectedBoard.id, selectedElement.id)
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBoard && selectedElement) {
        event.preventDefault()
        state.deleteElement(selectedBoard.id, selectedElement.id)
        return
      }

      if (shortcut === 'p') {
        event.preventDefault()
        setPreviewSession(createPreviewSession(project, state.currentBoardId))
        return
      }

      if (shortcut === 'v') {
        state.setActiveTool('select')
      }

      if (shortcut === 'r') {
        state.setActiveTool('rect')
      }

      if (shortcut === 'o') {
        state.setActiveTool('ellipse')
      }

      if (shortcut === 'l') {
        state.setActiveTool('line')
      }

      if (shortcut === 't') {
        state.setActiveTool('text')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewSession, project, state])

  if (!project) {
    return null
  }

  const currentBoard =
    project.boards.find((board) => board.id === state.currentBoardId) ?? project.boards[0] ?? null
  const selectedContext =
    project.boards
      .map((board) => ({
        board,
        element: board.elements.find((element) => element.id === state.selectedElementId) ?? null,
      }))
      .find((entry) => entry.element) ?? null
  const selectedBoard = selectedContext?.board ?? currentBoard
  const selectedElement = selectedContext?.element ?? null
  const aiArtifacts = buildAiArtifacts(project)

  return (
    <div className="flex h-screen flex-col bg-[#f5f5f5]">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="secondary-button" type="button" onClick={() => state.closeProject()}>
            返回项目
          </button>

          <input
            className="min-w-[220px] rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
            value={project.name}
            onChange={(event) => state.renameProject(event.target.value)}
          />

          <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            {project.name} / {currentBoard?.name ?? '无画板'}
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => state.addBoard()}>
              新增画板
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => state.setShowSemanticLabels(!state.showSemanticLabels)}
            >
              {state.showSemanticLabels ? '隐藏名称标签' : '显示名称标签'}
            </button>
            <button className="secondary-button" type="button" onClick={() => setIsSettingsOpen(true)}>
              设置
            </button>
            <button className="secondary-button" type="button" onClick={() => setIsGenerateOpen(true)}>
              AI 生成
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPreviewSession(createPreviewSession(project, currentBoard?.id))}
            >
              预览
            </button>
            <button className="secondary-button" type="button" onClick={() => setIsExportOpen(true)}>
              导出供 AI 使用
            </button>
            <button className="primary-button" type="button" onClick={() => setIsAlignmentOpen(true)}>
              AI 对齐测试
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`border-r border-slate-200 bg-white transition-all ${
            toolboxCollapsed ? 'w-[60px]' : 'w-[200px]'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              {!toolboxCollapsed ? (
                <span className="text-sm font-semibold text-slate-900">基础图形</span>
              ) : null}
              <button
                className="text-xs font-medium text-slate-500"
                type="button"
                onClick={() => setToolboxCollapsed(!toolboxCollapsed)}
              >
                {toolboxCollapsed ? '展开' : '收起'}
              </button>
            </div>

            <div className="flex-1 space-y-2 p-3">
              {TOOL_ITEMS.map((item) => {
                const isActive = state.activeTool === item.id

                return (
                  <button
                    key={item.id}
                    className={`flex w-full items-center ${
                      toolboxCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    } rounded-2xl border py-3 text-sm transition ${
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                    draggable={item.id !== 'select'}
                    onDragStart={(event) => {
                      if (item.id === 'select') {
                        return
                      }

                      event.dataTransfer.setData('application/helpai-tool', item.id)
                    }}
                    onClick={() => state.setActiveTool(item.id)}
                    type="button"
                  >
                    {toolboxCollapsed ? (
                      <span className="text-xs font-semibold">{item.short}</span>
                    ) : (
                      <>
                        <span>{item.label}</span>
                        <span className={isActive ? 'text-slate-300' : 'text-slate-400'}>
                          {item.short}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-8 py-8">
            <div className="flex min-w-max items-start gap-20 pb-8">
              {project.boards.map((board) => (
                <div
                  key={board.id}
                  ref={(node) => {
                    boardRefs.current[board.id] = node
                  }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <input
                      className={`rounded-full border px-4 py-2 text-sm font-semibold outline-none transition ${
                        currentBoard?.id === board.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-800'
                      }`}
                      value={board.name}
                      onFocus={() => state.selectBoard(board.id)}
                      onChange={(event) => state.renameBoard(board.id, event.target.value)}
                    />
                    <span className="text-xs text-slate-400">
                      {board.width} × {board.height}
                    </span>
                  </div>

                  <BoardCanvas
                    board={board}
                    project={project}
                    mode="editor"
                    activeTool={state.activeTool}
                    selectedElementId={
                      selectedBoard?.id === board.id ? state.selectedElementId : null
                    }
                    showSemanticLabels={state.showSemanticLabels}
                    onSelectBoard={() => state.selectBoard(board.id)}
                    onSelectElement={(elementId) => state.setSelectedElement(board.id, elementId)}
                    onCreateElement={(type, point) => state.addElement(board.id, type, point)}
                    onUpdateElement={(elementId, patch) => state.updateElement(board.id, elementId, patch)}
                    onContextMenu={(input) =>
                      setContextMenu({
                        ...input,
                        boardId: board.id,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {project.boards.map((board) => (
                <button
                  key={board.id}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    currentBoard?.id === board.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  type="button"
                  onClick={() => {
                    state.selectBoard(board.id)
                    boardRefs.current[board.id]?.scrollIntoView({
                      behavior: 'smooth',
                      inline: 'center',
                    })
                  }}
                >
                  {board.name}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="w-[280px] overflow-auto border-l border-slate-200 bg-white p-4">
          {selectedElement && selectedBoard ? (
            <div className="space-y-4">
              <Section title="元素">
                <FieldBlock label="名称">
                  <input
                    className="text-input"
                    value={selectedElement.name}
                    onChange={(event) =>
                      state.updateElement(selectedBoard.id, selectedElement.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </FieldBlock>
              </Section>

              <Section title="位置与尺寸">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['x', selectedElement.x],
                    ['y', selectedElement.y],
                    ['w', selectedElement.width],
                    ['h', selectedElement.height],
                  ] as Array<[string, number]>).map(([label, value]) => (
                    <FieldBlock key={label} label={label.toUpperCase()}>
                      <input
                        className="text-input"
                        type="number"
                        value={value}
                        onChange={(event) =>
                          state.updateElement(selectedBoard.id, selectedElement.id, {
                            [label === 'w'
                              ? 'width'
                              : label === 'h'
                                ? 'height'
                                : label]: Number(event.target.value || 0),
                          } as Partial<PrototypeElement>)
                        }
                      />
                    </FieldBlock>
                  ))}
                </div>
              </Section>

              <Section title="外观">
                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="填充">
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2"
                      type="color"
                      value={selectedElement.fill}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          fill: event.target.value,
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="描边">
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2"
                      type="color"
                      value={selectedElement.stroke}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          stroke: event.target.value,
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="描边宽度">
                    <input
                      className="text-input"
                      min={0}
                      type="number"
                      value={selectedElement.strokeWidth}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          strokeWidth: Number(event.target.value || 0),
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="圆角半径">
                    <input
                      className="text-input"
                      min={0}
                      max={20}
                      type="number"
                      value={selectedElement.cornerRadius}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          cornerRadius: Number(event.target.value || 0),
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="不透明度">
                    <input
                      className="text-input"
                      max={1}
                      min={0}
                      step={0.1}
                      type="number"
                      value={selectedElement.opacity}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          opacity: Number(event.target.value || 0),
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="字体大小">
                    <input
                      className="text-input"
                      max={32}
                      min={12}
                      type="number"
                      value={selectedElement.fontSize}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          fontSize: Number(event.target.value || 0),
                        })
                      }
                    />
                  </FieldBlock>
                </div>

                {selectedElement.type !== 'line' ? (
                  <FieldBlock label="文本">
                    <input
                      className="text-input"
                      value={selectedElement.text}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          text: event.target.value,
                        })
                      }
                    />
                  </FieldBlock>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="状态填充">
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2"
                      type="color"
                      value={selectedElement.stateStyle.fill ?? selectedElement.fill}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          stateStyle: {
                            ...selectedElement.stateStyle,
                            fill: event.target.value,
                          },
                        })
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="状态描边">
                    <input
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-2"
                      type="color"
                      value={selectedElement.stateStyle.stroke ?? selectedElement.stroke}
                      onChange={(event) =>
                        state.updateElement(selectedBoard.id, selectedElement.id, {
                          stateStyle: {
                            ...selectedElement.stateStyle,
                            stroke: event.target.value,
                          },
                        })
                      }
                    />
                  </FieldBlock>
                </div>
              </Section>

              <Section title="交互区域">
                <div className="space-y-3">
                  {selectedElement.interactions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      当前元素还没有交互。
                    </div>
                  ) : null}

                  {selectedElement.interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="grid gap-3">
                        <FieldBlock label="触发方式">
                          <select
                            className="text-input"
                            value={interaction.trigger}
                            onChange={(event) =>
                              state.updateInteraction(
                                selectedBoard.id,
                                selectedElement.id,
                                interaction.id,
                                {
                                  trigger: event.target.value as PrototypeInteraction['trigger'],
                                },
                              )
                            }
                          >
                            <option value="onClick">点击时</option>
                          </select>
                        </FieldBlock>

                        <FieldBlock label="动作">
                          <select
                            className="text-input"
                            value={interaction.action}
                            onChange={(event) => {
                              const action = event.target.value as InteractionAction
                              state.updateInteraction(
                                selectedBoard.id,
                                selectedElement.id,
                                interaction.id,
                                {
                                  action,
                                  targetBoardId:
                                    action === 'navigateTo'
                                      ? project.boards.find((board) => board.id !== selectedBoard.id)?.id ??
                                        null
                                      : null,
                                  targetElementId:
                                    action === 'showHide'
                                      ? selectedBoard.elements.find(
                                          (element) => element.id !== selectedElement.id,
                                        )?.id ?? null
                                      : null,
                                },
                              )
                            }}
                          >
                            {Object.entries(ACTION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </FieldBlock>

                        {interaction.action === 'navigateTo' ? (
                          <FieldBlock label="目标画板">
                            <select
                              className="text-input"
                              value={interaction.targetBoardId ?? ''}
                              onChange={(event) =>
                                state.updateInteraction(
                                  selectedBoard.id,
                                  selectedElement.id,
                                  interaction.id,
                                  {
                                    targetBoardId: event.target.value || null,
                                  },
                                )
                              }
                            >
                              <option value="">请选择画板</option>
                              {project.boards
                                .filter((board) => board.id !== selectedBoard.id)
                                .map((board) => (
                                  <option key={board.id} value={board.id}>
                                    {board.name}
                                  </option>
                                ))}
                            </select>
                          </FieldBlock>
                        ) : null}

                        {interaction.action === 'showHide' ? (
                          <FieldBlock label="目标元素">
                            <select
                              className="text-input"
                              value={interaction.targetElementId ?? ''}
                              onChange={(event) =>
                                state.updateInteraction(
                                  selectedBoard.id,
                                  selectedElement.id,
                                  interaction.id,
                                  {
                                    targetElementId: event.target.value || null,
                                  },
                                )
                              }
                            >
                              <option value="">请选择元素</option>
                              {selectedBoard.elements
                                .filter((element) => element.id !== selectedElement.id)
                                .map((element) => (
                                  <option key={element.id} value={element.id}>
                                    {element.name}
                                  </option>
                                ))}
                            </select>
                          </FieldBlock>
                        ) : null}
                      </div>

                      <button
                        className="secondary-button w-full justify-center text-red-600 hover:border-red-300 hover:text-red-700"
                        type="button"
                        onClick={() =>
                          state.removeInteraction(
                            selectedBoard.id,
                            selectedElement.id,
                            interaction.id,
                          )
                        }
                      >
                        删除交互
                      </button>
                    </div>
                  ))}

                  <button
                    className="primary-button w-full justify-center"
                    type="button"
                    onClick={() => state.addInteraction(selectedBoard.id, selectedElement.id)}
                  >
                    + 添加交互
                  </button>
                </div>
              </Section>
            </div>
          ) : (
            <div className="space-y-4">
              <Section title="当前项目">
                <div className="space-y-3 text-sm text-slate-600">
                  <div>项目名：{project.name}</div>
                  <div>
                    画板尺寸：{project.artboardSize.width} × {project.artboardSize.height}
                  </div>
                  <div>画板数量：{project.boards.length}</div>
                  <div>当前工具：{TOOL_ITEMS.find((item) => item.id === state.activeTool)?.label}</div>
                </div>
              </Section>

              <Section title="快捷键">
                <div className="space-y-2 text-sm text-slate-600">
                  <div>V 选择，R 矩形，O 椭圆，L 线段，T 文字</div>
                  <div>P 预览，Delete 删除，Cmd/Ctrl+D 复制</div>
                  <div>Cmd/Ctrl+Z 撤销，Cmd/Ctrl+Shift+Z 重做</div>
                  <div>Cmd/Ctrl+S 保存，Cmd/Ctrl+E 导出</div>
                </div>
              </Section>
            </div>
          )}
        </aside>
      </div>

      {contextMenu && selectedBoard ? (
        <div
          className="fixed z-[55] w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="context-menu-item"
            type="button"
            onClick={() => {
              state.moveElementLayer(contextMenu.boardId, contextMenu.elementId, 'forward')
              setContextMenu(null)
            }}
          >
            上移一层
          </button>
          <button
            className="context-menu-item"
            type="button"
            onClick={() => {
              state.moveElementLayer(contextMenu.boardId, contextMenu.elementId, 'backward')
              setContextMenu(null)
            }}
          >
            下移一层
          </button>
          <button
            className="context-menu-item text-red-600"
            type="button"
            onClick={() => {
              state.deleteElement(contextMenu.boardId, contextMenu.elementId)
              setContextMenu(null)
            }}
          >
            删除元素
          </button>
        </div>
      ) : null}

      {previewSession ? (
        <PreviewOverlay
          project={project}
          session={previewSession}
          onChange={setPreviewSession}
          onClose={() => setPreviewSession(null)}
          onTrigger={(boardId, elementId) => {
            const board = project.boards.find((candidate) => candidate.id === boardId)
            const element = board?.elements.find((candidate) => candidate.id === elementId)

            if (!element) {
              return
            }

            setPreviewSession((current) =>
              current ? applyPreviewElementInteractions(project, current, element) : current,
            )
          }}
        />
      ) : null}

      {isSettingsOpen ? (
        <ModalFrame
          title="LLM 设置"
          description="SiliconFlow 默认使用 OpenAI 兼容接口，可在此修改 Base URL、API Key 和模型。"
          onClose={() => setIsSettingsOpen(false)}
          footer={
            <button className="primary-button" type="button" onClick={() => setIsSettingsOpen(false)}>
              完成
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Base URL">
              <input
                className="text-input"
                value={state.settings.baseUrl}
                onChange={(event) => state.updateSettings({ baseUrl: event.target.value })}
              />
            </FieldBlock>
            <FieldBlock label="模型">
              <input
                className="text-input"
                value={state.settings.model}
                onChange={(event) => state.updateSettings({ model: event.target.value })}
              />
            </FieldBlock>
            <div className="md:col-span-2">
              <FieldBlock label="API Key">
                <input
                  className="text-input"
                  type="password"
                  value={state.settings.apiKey}
                  onChange={(event) => state.updateSettings({ apiKey: event.target.value })}
                />
              </FieldBlock>
            </div>
            <FieldBlock label="Temperature">
              <input
                className="text-input"
                max={2}
                min={0}
                step={0.1}
                type="number"
                value={state.settings.temperature}
                onChange={(event) =>
                  state.updateSettings({ temperature: Number(event.target.value || 0) })
                }
              />
            </FieldBlock>
            <FieldBlock label="Max Tokens">
              <input
                className="text-input"
                min={256}
                step={256}
                type="number"
                value={state.settings.maxTokens}
                onChange={(event) =>
                  state.updateSettings({ maxTokens: Number(event.target.value || 0) })
                }
              />
            </FieldBlock>
          </div>
        </ModalFrame>
      ) : null}

      {isGenerateOpen ? (
        <GenerateDialog
          project={project}
          onClose={() => setIsGenerateOpen(false)}
          onGenerate={async (description, boardName) => {
            const elements = await generateWireframeElements({
              description,
              size: project.artboardSize,
              settings: state.settings,
            })
            state.addGeneratedBoard(boardName, elements)
          }}
        />
      ) : null}

      {isExportOpen ? (
        <ModalFrame
          title="导出供 AI 使用"
          description="导出结构化 JSON 与 Markdown，便于 Codex、Claude Code、Cursor 直接消费。"
          onClose={() => setIsExportOpen(false)}
          footer={
            <>
              <button
                className="secondary-button"
                type="button"
                onClick={() => copyText(JSON.stringify(aiArtifacts.json, null, 2))}
              >
                复制 JSON
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => copyText(aiArtifacts.markdown)}
              >
                复制 Markdown
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  downloadTextFile(
                    `${project.name}.wireframe.json`,
                    JSON.stringify(aiArtifacts.json, null, 2),
                    'application/json',
                  )
                  downloadTextFile(`${project.name}.wireframe.md`, aiArtifacts.markdown)
                }}
              >
                下载文件
              </button>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="field-label">JSON</div>
              <textarea
                className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700"
                readOnly
                value={JSON.stringify(aiArtifacts.json, null, 2)}
              />
            </div>
            <div className="space-y-2">
              <div className="field-label">Markdown 提示词</div>
              <textarea
                className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                readOnly
                value={aiArtifacts.markdown}
              />
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {isAlignmentOpen ? (
        <AlignmentDialog
          artifacts={aiArtifacts}
          settings={state.settings}
          onClose={() => setIsAlignmentOpen(false)}
        />
      ) : null}
    </div>
  )
}

function GenerateDialog(props: {
  project: { artboardSize: { width: number; height: number }; boards: PrototypeBoard[] }
  onClose: () => void
  onGenerate: (description: string, boardName: string) => Promise<void>
}) {
  const [description, setDescription] = useState('')
  const [boardName, setBoardName] = useState(`AI 画板 ${props.project.boards.length + 1}`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  return (
    <ModalFrame
      title="AI 生成画板"
      description={`根据自然语言描述生成 ${props.project.artboardSize.width}×${props.project.artboardSize.height} 画板。`}
      onClose={props.onClose}
      footer={
        <>
          {error ? <div className="mr-auto text-sm text-red-600">{error}</div> : null}
          <button className="secondary-button" type="button" onClick={props.onClose}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={loading}
            type="button"
            onClick={async () => {
              try {
                setLoading(true)
                setError('')
                await props.onGenerate(description, boardName)
                props.onClose()
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : '生成失败。')
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? '生成中…' : '开始生成'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldBlock label="新画板名称">
          <input
            className="text-input"
            value={boardName}
            onChange={(event) => setBoardName(event.target.value)}
          />
        </FieldBlock>
        <FieldBlock label="页面描述">
          <textarea
            className="min-h-[220px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-400"
            placeholder="例如：一个登录页面，顶部有 logo，中间有用户名和密码输入框，底部有登录按钮和注册链接。"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FieldBlock>
      </div>
    </ModalFrame>
  )
}

function AlignmentDialog(props: {
  artifacts: ReturnType<typeof buildAiArtifacts>
  settings: ReturnType<typeof useAppStoreState>['settings']
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [responseJson, setResponseJson] = useState('')
  const [report, setReport] = useState<ReturnType<typeof compareAlignment> | null>(null)

  return (
    <ModalFrame
      title="AI 对齐测试"
      description="将当前导出内容发给已配置 LLM，再和原始线框图规范做逐元素比对。"
      onClose={props.onClose}
      footer={
        <>
          {error ? <div className="mr-auto text-sm text-red-600">{error}</div> : null}
          <button className="secondary-button" type="button" onClick={props.onClose}>
            关闭
          </button>
          <button
            className="primary-button"
            disabled={loading}
            type="button"
            onClick={async () => {
              try {
                setLoading(true)
                setError('')
                const interpreted = await requestAlignmentInterpretation({
                  settings: props.settings,
                  bundle: props.artifacts.json,
                  markdown: props.artifacts.markdown,
                })
                setResponseJson(JSON.stringify(interpreted, null, 2))
                setReport(compareAlignment(props.artifacts.json, interpreted))
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'AI 对齐测试失败。')
              } finally {
                setLoading(false)
              }
            }}
          >
            {loading ? '测试中…' : '运行 AI 对齐测试'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {report ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">布局匹配分</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {report.layoutScore.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  交互匹配分
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">
                  {report.interactionScore.toFixed(1)}%
                </div>
              </div>
              <div
                className={`rounded-3xl p-4 ${
                  report.overallScore >= 95
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                <div className="text-xs uppercase tracking-[0.24em]">综合对齐分</div>
                <div className="mt-2 text-3xl font-semibold">{report.overallScore.toFixed(1)}%</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3">元素</th>
                      <th className="px-4 py-3">原始值</th>
                      <th className="px-4 py-3">AI 解读值</th>
                      <th className="px-4 py-3">结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                    {report.rows.map((row) => (
                      <tr
                        key={`${row.screenName}-${row.elementName}`}
                        className={
                          row.layoutMatched && row.interactionMatched ? '' : 'bg-red-50/80'
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{row.elementName}</div>
                          <div className="text-xs text-slate-500">{row.screenName}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.original.type} · {row.original.x},{row.original.y} ·{' '}
                          {row.original.width}×{row.original.height}
                          <div className="mt-1 text-slate-500">
                            {row.original.interactions.join(', ') || '无交互'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.interpreted ? (
                            <>
                              {row.interpreted.type} · {row.interpreted.x},{row.interpreted.y} ·{' '}
                              {row.interpreted.width}×{row.interpreted.height}
                              <div className="mt-1 text-slate-500">
                                {row.interpreted.interactions.join(', ') || '无交互'}
                              </div>
                            </>
                          ) : (
                            '缺失'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {row.notes.length > 0 ? row.notes.join(' ') : '通过'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            点击“运行 AI 对齐测试”后，这里会显示综合得分和逐元素比对表。
          </div>
        )}

        <div className="space-y-2">
          <div className="field-label">AI 返回 JSON</div>
          <textarea
            className="min-h-[180px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700"
            readOnly
            value={responseJson}
          />
        </div>
      </div>
    </ModalFrame>
  )
}
