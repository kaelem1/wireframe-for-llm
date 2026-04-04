/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { getBoardById } from '../utils/project'
import { WireframeBlock } from './WireframeBlock'

export function PreviewOverlay() {
  const longPressTimer = useRef<number | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const project = useAppStore((state) => state.project)
  const isPreview = useAppStore((state) => state.isPreview)
  const previewBoardStack = useAppStore((state) => state.previewBoardStack)
  const previewModalId = useAppStore((state) => state.previewModalId)
  const previewDirection = useAppStore((state) => state.previewDirection)
  const closePreview = useAppStore((state) => state.closePreview)
  const navigatePreview = useAppStore((state) => state.navigatePreview)
  const backPreview = useAppStore((state) => state.backPreview)
  const showPreviewModal = useAppStore((state) => state.showPreviewModal)

  if (!project || !isPreview) {
    return null
  }

  const boardId = previewBoardStack.at(-1)
  const board = boardId ? getBoardById(project, boardId) : null
  if (!board) {
    return null
  }

  const breadcrumb = previewBoardStack
    .map((item) => getBoardById(project, item)?.name)
    .filter(Boolean)
    .join(' → ')

  const modal = previewModalId ? board.components.find((item) => item.id === previewModalId) : null

  const runInteraction = (componentId: string, trigger: 'tap' | 'longPress' | 'swipe') => {
    const component = board.components.find((item) => item.id === componentId)
    const interaction = component?.interactions.find((item) => item.trigger === trigger)
    if (!interaction) {
      return
    }

    if (interaction.action === 'navigate' && interaction.target) {
      navigatePreview(interaction.target)
    }

    if (interaction.action === 'back') {
      backPreview()
    }

    if (interaction.action === 'showModal' && interaction.target) {
      showPreviewModal(interaction.target)
    }
  }

  return (
    <div className="preview-overlay">
      <div className="preview-overlay__topbar">
        <span>{breadcrumb}</span>
        <button type="button" className="toolbar__button" onClick={closePreview}>
          退出预览
        </button>
      </div>

      <div className="preview-overlay__stage">
        <div
          className={previewDirection === 'back' ? 'preview-board is-back' : 'preview-board is-forward'}
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
            <div className="preview-modal-mask" onClick={() => showPreviewModal(null)}>
              <WireframeBlock component={modal} preview />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
