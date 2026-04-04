/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '../stores/appStore'
import { COMPONENT_DEFINITIONS } from '../utils/constants'
import { findComponentById, getBoardById } from '../utils/project'
import { WireframeBlock } from './WireframeBlock'

type Guide = {
  orientation: 'vertical' | 'horizontal'
  position: number
}

type ActiveTransform = {
  mode: 'move' | 'resize'
  componentId: string
  startX: number
  startY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
}

type ContextMenuState = {
  x: number
  y: number
  componentId: string
} | null

function makeBadges(targetId: string | undefined, componentId: string, projectBoards: { id: string; name: string }[]) {
  if (!targetId) {
    return null
  }

  if (targetId === componentId) {
    return '→ 弹窗'
  }

  const board = projectBoards.find((item) => item.id === targetId)
  return board ? `→ ${board.name}` : null
}

export function BoardCanvas() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const editingComponentId = useAppStore((state) => state.editingComponentId)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const setEditingComponentId = useAppStore((state) => state.setEditingComponentId)
  const addComponent = useAppStore((state) => state.addComponent)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const deleteComponent = useAppStore((state) => state.deleteComponent)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)

  const [guides, setGuides] = useState<Guide[]>([])
  const [transform, setTransform] = useState<ActiveTransform | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  const board = project && activeBoardId ? getBoardById(project, activeBoardId) ?? null : null

  const otherComponents = useMemo(() => {
    if (!board || !selectedComponentId) {
      return []
    }
    return board.components.filter((item) => item.id !== selectedComponentId)
  }, [board, selectedComponentId])

  useEffect(() => {
    if (!transform || !project) {
      return
    }

    const activeTransform = transform

    function setGuideFrame(x: number, y: number, width: number, height: number) {
      const nextGuides: Guide[] = []
      const values = [
        { orientation: 'vertical' as const, current: x, fields: ['x', 'centerX', 'right'] as const },
        { orientation: 'vertical' as const, current: x + width / 2, fields: ['x', 'centerX', 'right'] as const },
        { orientation: 'vertical' as const, current: x + width, fields: ['x', 'centerX', 'right'] as const },
        { orientation: 'horizontal' as const, current: y, fields: ['y', 'centerY', 'bottom'] as const },
        { orientation: 'horizontal' as const, current: y + height / 2, fields: ['y', 'centerY', 'bottom'] as const },
        { orientation: 'horizontal' as const, current: y + height, fields: ['y', 'centerY', 'bottom'] as const },
      ]

      for (const component of otherComponents) {
        const positions = {
          x: component.x,
          centerX: component.x + component.width / 2,
          right: component.x + component.width,
          y: component.y,
          centerY: component.y + component.height / 2,
          bottom: component.y + component.height,
        }

        for (const entry of values) {
          for (const field of entry.fields) {
            const position = positions[field]
            if (Math.abs(entry.current - position) <= 4) {
              nextGuides.push({ orientation: entry.orientation, position })
            }
          }
        }
      }

      setGuides(nextGuides)
    }

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - activeTransform.startX
      const deltaY = event.clientY - activeTransform.startY

      if (activeTransform.mode === 'move') {
        const nextX = activeTransform.originX + deltaX
        const nextY = activeTransform.originY + deltaY
        updateComponent(activeTransform.componentId, { x: nextX, y: nextY })
        setGuideFrame(nextX, nextY, activeTransform.originWidth, activeTransform.originHeight)
        return
      }

      const nextWidth = activeTransform.originWidth + deltaX
      const nextHeight = activeTransform.originHeight + deltaY
      updateComponent(activeTransform.componentId, { width: nextWidth, height: nextHeight })
      setGuideFrame(activeTransform.originX, activeTransform.originY, nextWidth, nextHeight)
    }

    function handlePointerUp() {
      setTransform(null)
      setGuides([])
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [otherComponents, project, transform, updateComponent])

  if (!project || !board) {
    return null
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/x-wireframe-component')
    if (!type || !(type in COMPONENT_DEFINITIONS)) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    addComponent(type as keyof typeof COMPONENT_DEFINITIONS, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const startTransform = (
    componentId: string,
    mode: 'move' | 'resize',
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    const found = findComponentById(project, componentId)
    if (!found) {
      return
    }

    const component = found.component
    setContextMenu(null)
    selectComponent(componentId)
    setTransform({
      mode,
      componentId,
      startX: event.clientX,
      startY: event.clientY,
      originX: component.x,
      originY: component.y,
      originWidth: component.width,
      originHeight: component.height,
    })
  }

  return (
    <div className="canvas-shell">
      <div className="canvas-header">
        <span>{board.name}</span>
        <span>{project.boardSize.width} × {project.boardSize.height}</span>
      </div>

      <div className="canvas-stage">
        <div
          className="board-canvas"
          style={{ width: project.boardSize.width, height: project.boardSize.height }}
          onClick={() => {
            selectComponent(null)
            setEditingComponentId(null)
            setContextMenu(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={handleDrop}
        >
          {guides.map((guide, index) => (
            <div
              key={`${guide.orientation}-${guide.position}-${index}`}
              className={
                guide.orientation === 'vertical'
                  ? 'canvas-guide canvas-guide--vertical'
                  : 'canvas-guide canvas-guide--horizontal'
              }
              style={guide.orientation === 'vertical' ? { left: guide.position } : { top: guide.position }}
            />
          ))}

          {board.components.map((component) => {
            const firstInteraction = component.interactions[0]
            const badge =
              firstInteraction?.action === 'showModal'
                ? makeBadges(firstInteraction.target, component.id, [])
                : makeBadges(firstInteraction?.target, component.id, project.boards)

            return (
              <WireframeBlock
                key={component.id}
                component={component}
                selected={selectedComponentId === component.id}
                editing={editingComponentId === component.id}
                badge={badge}
                onPointerDown={(event) => startTransform(component.id, 'move', event)}
                onResizePointerDown={(event) => startTransform(component.id, 'resize', event)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  selectComponent(component.id)
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    componentId: component.id,
                  })
                }}
                onSelect={() => selectComponent(component.id)}
                onStartEdit={() => setEditingComponentId(component.id)}
                onCommitName={(value) => {
                  updateComponent(component.id, { name: value })
                  setEditingComponentId(null)
                }}
              />
            )
          })}
        </div>
      </div>

      {contextMenu ? (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button
            type="button"
            onClick={() => {
              duplicateComponent(contextMenu.componentId)
              setContextMenu(null)
            }}
          >
            复制
          </button>
          <button
            type="button"
            onClick={() => {
              deleteComponent(contextMenu.componentId)
              setContextMenu(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </div>
  )
}
