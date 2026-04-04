/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { BoardDocument } from '../types/schema'

interface BoardStripProps {
  boards: BoardDocument[]
  selectedBoardId: string | null
  onSelect: (boardId: string) => void
  onRename: (boardId: string, name: string) => void
  onAdd: () => void
  onDelete: (boardId: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
}

export function BoardStrip({
  boards,
  selectedBoardId,
  onSelect,
  onRename,
  onAdd,
  onDelete,
  onMove,
}: BoardStripProps) {
  return (
    <div className="board-strip">
      <div className="board-strip__scroll">
        {boards.map((board, index) => (
          <div
            key={board.id}
            className={`board-card ${board.id === selectedBoardId ? 'board-card--active' : ''}`}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/board-index', String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const fromIndex = Number(event.dataTransfer.getData('text/board-index'))
              if (!Number.isNaN(fromIndex)) {
                onMove(fromIndex, index)
              }
            }}
            onClick={() => onSelect(board.id)}
          >
            <div className="board-card__thumbnail">
              <span>{board.components.length} 个组件</span>
            </div>
            <input
              className="board-card__name"
              value={board.name}
              onChange={(event) => onRename(board.id, event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              className="board-card__delete"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(board.id)
              }}
            >
              删除
            </button>
          </div>
        ))}
        <button type="button" className="board-card board-card--add" onClick={onAdd}>
          + 新建画板
        </button>
      </div>
    </div>
  )
}
