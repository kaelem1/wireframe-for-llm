/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef, useState } from 'react'
import { createRestoreIframeHtml, generateRestoreCode } from '../utils/ai'
import { getBoardById } from '../utils/project'
import { useAppStore } from '../stores/appStore'
import type { ProjectData } from '../types/schema'
import { WireframeBlock } from './WireframeBlock'

interface SettingsDialogProps {
  open: boolean
}

function RestorePreview({
  project,
  initialBoardId,
}: {
  project: ProjectData
  initialBoardId: string
}) {
  const longPressTimer = useRef<number | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const [boardStack, setBoardStack] = useState<string[]>([initialBoardId])
  const [modalId, setModalId] = useState<string | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null)

  useEffect(() => {
    setBoardStack([initialBoardId])
    setModalId(null)
    setDirection(null)
  }, [initialBoardId, project])

  const boardId = boardStack.at(-1)
  const board = boardId ? getBoardById(project, boardId) : null
  const modal = modalId ? board?.components.find((item) => item.id === modalId) : null
  const breadcrumb = boardStack
    .map((item) => getBoardById(project, item)?.name)
    .filter(Boolean)
    .join(' → ')

  if (!board) {
    return null
  }

  const runInteraction = (componentId: string, trigger: 'tap' | 'longPress' | 'swipe') => {
    const component = board.components.find((item) => item.id === componentId)
    const interaction = component?.interactions.find((item) => item.trigger === trigger)
    if (!interaction) {
      return
    }

    if (interaction.action === 'navigate' && interaction.target && getBoardById(project, interaction.target)) {
      setBoardStack((current) => [...current, interaction.target!])
      setModalId(null)
      setDirection('forward')
    }

    if (interaction.action === 'back') {
      setBoardStack((current) => {
        if (current.length <= 1) {
          return current
        }
        setModalId(null)
        setDirection('back')
        return current.slice(0, -1)
      })
    }

    if (interaction.action === 'showModal' && interaction.target) {
      setModalId(interaction.target)
    }
  }

  return (
    <>
      <div className="canvas-header">
        <span>{breadcrumb}</span>
      </div>
      <div
        className={direction === 'back' ? 'restore-test__device preview-board is-back' : 'restore-test__device preview-board is-forward'}
        style={{ width: project.boardSize.width, height: project.boardSize.height }}
      >
        {board.components.map((component) => {
          const firstInteraction = component.interactions[0]
          const badge =
            firstInteraction?.action === 'navigate'
              ? `→ ${getBoardById(project, firstInteraction.target ?? '')?.name ?? ''}`
              : firstInteraction?.action === 'showModal'
                ? '→ 弹窗'
                : firstInteraction?.action === 'back'
                  ? '→ 返回'
                  : null

          return (
            <div
              key={component.id}
              onClick={() => runInteraction(component.id, 'tap')}
              onPointerDown={(event) => {
                pointerStart.current = { x: event.clientX, y: event.clientY }
                if (longPressTimer.current !== null) {
                  window.clearTimeout(longPressTimer.current)
                }
                longPressTimer.current = window.setTimeout(() => runInteraction(component.id, 'longPress'), 350)
              }}
              onPointerUp={(event) => {
                if (longPressTimer.current !== null) {
                  window.clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
                if (!pointerStart.current) {
                  return
                }
                const distance = event.clientX - pointerStart.current.x
                if (Math.abs(distance) > 30) {
                  runInteraction(component.id, 'swipe')
                }
                pointerStart.current = null
              }}
            >
              <WireframeBlock component={component} preview badge={badge} />
            </div>
          )
        })}

        {modal ? (
          <div className="preview-modal-mask" onClick={() => setModalId(null)}>
            <WireframeBlock component={modal} preview />
          </div>
        ) : null}
      </div>
    </>
  )
}

export function SettingsDialog({ open }: SettingsDialogProps) {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const settings = useAppStore((state) => state.settings)
  const restoreTestResult = useAppStore((state) => state.restoreTestResult)
  const setSettings = useAppStore((state) => state.setSettings)
  const setRestoreTestResult = useAppStore((state) => state.setRestoreTestResult)
  const setShowSettings = useAppStore((state) => state.setShowSettings)

  if (!open || !project) {
    return null
  }

  const board = (activeBoardId ? getBoardById(project, activeBoardId) : null) ?? project.boards[0]

  const runRestoreTest = async () => {
    setRestoreTestResult({
      status: 'loading',
      code: '',
      html: '',
      error: null,
    })

    try {
      const code = await generateRestoreCode(settings, project)
      setRestoreTestResult({
        status: 'done',
        code,
        html: createRestoreIframeHtml(code),
        error: null,
      })
    } catch (error) {
      setRestoreTestResult({
        status: 'error',
        code: '',
        html: '',
        error: error instanceof Error ? error.message : 'AI 还原测试失败',
      })
    }
  }

  return (
    <div className="overlay">
      <div className="dialog dialog--wide dialog--settings">
        <div className="dialog__header">
          <h2>设置</h2>
          <button type="button" className="dialog__close" onClick={() => setShowSettings(false)}>
            关闭
          </button>
        </div>

        <div className="settings-grid">
          <label className="form-field">
            <span>Base URL</span>
            <input
              value={settings.baseUrl}
              onChange={(event) => setSettings({ baseUrl: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>API Key</span>
            <input
              value={settings.apiKey}
              type="password"
              onChange={(event) => setSettings({ apiKey: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>模型</span>
            <input value={settings.model} onChange={(event) => setSettings({ model: event.target.value })} />
          </label>
        </div>

        <div className="dialog__actions">
          <button type="button" className="dialog__primary" onClick={runRestoreTest}>
            运行 AI 还原测试
          </button>
        </div>

        {restoreTestResult.error ? <p className="form-error">{restoreTestResult.error}</p> : null}

        {restoreTestResult.status === 'loading' ? <p className="panel__empty">正在请求 AI...</p> : null}

        {restoreTestResult.status === 'done' && board ? (
          <div className="restore-test">
            <div className="restore-test__pane">
              <div className="restore-test__title">原始版本</div>
              <RestorePreview project={project} initialBoardId={board.id} />
            </div>

            <div className="restore-test__pane">
              <div className="restore-test__title">AI 生成版本</div>
              <iframe title="AI 还原测试" srcDoc={restoreTestResult.html} className="restore-test__iframe" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
