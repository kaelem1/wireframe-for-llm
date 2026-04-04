/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useAppStore } from '../stores/appStore'

export function BoardStrip() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const setActiveBoardId = useAppStore((state) => state.setActiveBoardId)
  const addBoard = useAppStore((state) => state.addBoard)
  const deleteBoard = useAppStore((state) => state.deleteBoard)
  const reorderBoards = useAppStore((state) => state.reorderBoards)
  const updateBoardName = useAppStore((state) => state.updateBoardName)

  if (!project) {
    return null
  }

  return (
    <div className="board-strip">
      <div className="board-strip__list">
        {project.boards.map((board, index) => (
          <div
            key={board.id}
            className={board.id === activeBoardId ? 'board-chip is-active' : 'board-chip'}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-board-index', String(index))
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const fromIndex = Number(event.dataTransfer.getData('application/x-board-index'))
              if (Number.isFinite(fromIndex)) {
                reorderBoards(fromIndex, index)
              }
            }}
          >
            <button type="button" className="board-chip__preview" onClick={() => setActiveBoardId(board.id)}>
              {index + 1}
            </button>
            <input
              value={board.name}
              onChange={(event) => updateBoardName(board.id, event.target.value)}
              onFocus={() => setActiveBoardId(board.id)}
            />
            <button
              type="button"
              className="board-chip__delete"
              onClick={() => deleteBoard(board.id)}
              aria-label={`删除${board.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="board-strip__add" onClick={addBoard}>
        + 新建画板
      </button>
    </div>
  )
}
