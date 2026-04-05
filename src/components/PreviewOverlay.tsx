/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前预览态共用块根节点交互并始终 fit 可视区域
3. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getBoardById, getBoardFitScale } from '../utils/project'
import { WireframeBlock } from './WireframeBlock'

export function PreviewOverlay() {
  const longPressTimer = useRef<number | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const project = useAppStore((state) => state.project)
  const isPreview = useAppStore((state) => state.isPreview)
  const previewBoardStack = useAppStore((state) => state.previewBoardStack)
  const previewModalId = useAppStore((state) => state.previewModalId)
  const previewDirection = useAppStore((state) => state.previewDirection)
  const closePreview = useAppStore((state) => state.closePreview)
  const navigatePreview = useAppStore((state) => state.navigatePreview)
  const backPreview = useAppStore((state) => state.backPreview)
  const showPreviewModal = useAppStore((state) => state.showPreviewModal)

  useEffect(() => {
    if (!project || !isPreview) {
      return
    }
    const boardSize = project.boardSize

    function updateScale() {
      const stage = stageRef.current
      if (!stage) {
        return
      }

      setScale(getBoardFitScale(boardSize, stage.clientWidth, stage.clientHeight))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (stageRef.current) {
      observer.observe(stageRef.current)
    }

    return () => observer.disconnect()
  }, [isPreview, project])

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

      <div className="preview-overlay__stage" ref={stageRef}>
        <div
          style={{
            width: project.boardSize.width * scale,
            height: project.boardSize.height * scale,
          }}
        >
          <div
            className={previewDirection === 'back' ? 'preview-board is-back' : 'preview-board is-forward'}
            style={{
              width: project.boardSize.width,
              height: project.boardSize.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
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
                <WireframeBlock
                  key={component.id}
                  component={component}
                  preview
                  badge={badge}
                  onSelect={() => runInteraction(component.id, 'tap')}
                  onPointerDown={(event) => {
                    pointerStart.current = { x: event.clientX, y: event.clientY }
                    if (longPressTimer.current !== null) {
                      window.clearTimeout(longPressTimer.current)
                    }
                    longPressTimer.current = window.setTimeout(
                      () => runInteraction(component.id, 'longPress'),
                      350,
                    )
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
                />
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
    </div>
  )
}
