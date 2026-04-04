/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { useEffect, useState } from 'react'

import { BoardCanvas } from './BoardCanvas'
import { clearPreviewDirection } from '../../lib/preview'
import type { PreviewSession, PrototypeProject } from '../../types/prototype'

interface PreviewOverlayProps {
  project: PrototypeProject
  session: PreviewSession
  onChange: (session: PreviewSession) => void
  onClose: () => void
  onTrigger: (boardId: string, elementId: string) => void
}

function getScale(width: number, height: number): number {
  if (typeof window === 'undefined') {
    return 1
  }

  return Math.min(1, (window.innerWidth - 96) / width, (window.innerHeight - 160) / height)
}

export function PreviewOverlay(props: PreviewOverlayProps) {
  const board =
    props.project.boards.find((candidate) => candidate.id === props.session.currentBoardId) ??
    props.project.boards[0] ??
    null
  const [scale, setScale] = useState(() => (board ? getScale(board.width, board.height) : 1))

  useEffect(() => {
    const handleResize = () => {
      if (!board) {
        return
      }

      setScale(getScale(board.width, board.height))
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [board])

  useEffect(() => {
    if (props.session.direction === 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      props.onChange(clearPreviewDirection(props.session))
    }, 220)

    return () => window.clearTimeout(timer)
  }, [props, props.session])

  if (!board) {
    return null
  }

  const animationClass =
    props.session.direction === 'forward'
      ? 'animate-preview-left'
      : props.session.direction === 'backward'
        ? 'animate-preview-right'
        : ''

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 px-6 py-10">
      <button
        className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur"
        type="button"
        onClick={props.onClose}
      >
        退出预览
      </button>

      <div className="space-y-5 text-center">
        <div className="text-xs uppercase tracking-[0.32em] text-slate-400">Preview</div>
        <div
          className={`mx-auto origin-top-left ${animationClass}`}
          style={{
            width: board.width * scale,
            height: board.height * scale,
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: board.width,
            }}
          >
            <BoardCanvas
              board={board}
              mode="preview"
              project={props.project}
              previewSession={props.session}
              onPreviewTrigger={(element) => props.onTrigger(board.id, element.id)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
