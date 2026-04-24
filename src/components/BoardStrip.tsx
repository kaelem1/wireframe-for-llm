/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前画板按钮将删除收进“更多”菜单，并支持整板创建副本
3. 画板更多菜单提升到 `.board-strip` 直系绝对定位层，避免被横向滚动列表裁切
4. 更新后检查所属 `.folder.md`
*/

import { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'

export function BoardStrip() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const setActiveBoardId = useAppStore((state) => state.setActiveBoardId)
  const addBoard = useAppStore((state) => state.addBoard)
  const duplicateBoard = useAppStore((state) => state.duplicateBoard)
  const deleteBoard = useAppStore((state) => state.deleteBoard)
  const reorderBoards = useAppStore((state) => state.reorderBoards)
  const updateBoardName = useAppStore((state) => state.updateBoardName)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ boardId: string; left: number; bottom: number } | null>(null)

  if (!project) {
    return null
  }

  return (
    <div ref={stripRef} className="board-strip">
      <div className="board-strip__list">
        {project.boards.map((board, index) => (
          <div
            key={board.id}
            className={[
              'board-chip',
              board.id === activeBoardId ? 'is-active' : '',
              menuAnchor?.boardId === board.id ? 'is-menu-open' : '',
            ]
              .filter(Boolean)
              .join(' ')}
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
            <div className="board-chip__menu">
              <button
                type="button"
                className="board-chip__more"
                onClick={(event) => {
                  if (menuAnchor?.boardId === board.id) {
                    setMenuAnchor(null)
                    return
                  }

                  const stripRect = stripRef.current!.getBoundingClientRect()
                  const buttonRect = event.currentTarget.getBoundingClientRect()
                  setMenuAnchor({
                    boardId: board.id,
                    left: buttonRect.right - stripRect.left,
                    bottom: stripRect.bottom - buttonRect.top + 6,
                  })
                }}
                aria-label={`更多${board.name}`}
              >
                更多
              </button>
            </div>
          </div>
        ))}
      </div>
      {menuAnchor ? (
        <div
          className="board-chip__menu-popover"
          style={{ left: menuAnchor.left, bottom: menuAnchor.bottom }}
        >
          <button
            type="button"
            onClick={() => {
              duplicateBoard(menuAnchor.boardId)
              setMenuAnchor(null)
            }}
          >
            创建副本
          </button>
          <button
            type="button"
            onClick={() => {
              deleteBoard(menuAnchor.boardId)
              setMenuAnchor(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}
      <button type="button" className="board-strip__add" onClick={addBoard}>
        + 新建画板
      </button>
    </div>
  )
}
