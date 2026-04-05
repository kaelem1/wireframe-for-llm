/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前支持待放置拖拽创建与只读 fit 缩放
3. 更新后检查所属 `.folder.md`
*/

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useAppStore } from '../stores/appStore'
import { COMPONENT_DEFINITIONS, PLACEMENT_DRAG_THRESHOLD } from '../utils/constants'
import { findComponentById, getBoardById, getBoardFitScale } from '../utils/project'
import { WireframeBlock } from './WireframeBlock'

type Guide = {
  orientation: 'vertical' | 'horizontal'
  position: number
}

type ActiveTransform = {
  mode: 'move' | 'resize'
  componentId: string
  scale: number
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

type PlacementDraft = {
  x: number
  y: number
  width: number
  height: number
}

type ActivePlacement = {
  type: keyof typeof COMPONENT_DEFINITIONS
  scale: number
  rect: DOMRect
  startX: number
  startY: number
}

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
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const setEditingComponentId = useAppStore((state) => state.setEditingComponentId)
  const placeComponent = useAppStore((state) => state.placeComponent)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const deleteComponent = useAppStore((state) => state.deleteComponent)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)

  const [guides, setGuides] = useState<Guide[]>([])
  const [transform, setTransform] = useState<ActiveTransform | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [fitScale, setFitScale] = useState(1)
  const [placement, setPlacement] = useState<PlacementDraft | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const activePlacementRef = useRef<ActivePlacement | null>(null)
  const placementRef = useRef<PlacementDraft | null>(null)

  const board = project && activeBoardId ? getBoardById(project, activeBoardId) ?? null : null
  const scale = fitScale

  const otherComponents = useMemo(() => {
    if (!board || !selectedComponentId) {
      return []
    }
    return board.components.filter((item) => item.id !== selectedComponentId)
  }, [board, selectedComponentId])

  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  useEffect(() => {
    if (!project) {
      return
    }

    const boardSize = project.boardSize

    function updateFitScale() {
      const stage = stageRef.current
      if (!stage) {
        return
      }

      setFitScale(getBoardFitScale(boardSize, stage.clientWidth, stage.clientHeight))
    }

    updateFitScale()
    const observer = new ResizeObserver(updateFitScale)
    if (stageRef.current) {
      observer.observe(stageRef.current)
    }

    return () => observer.disconnect()
  }, [project])

  useEffect(() => {
    if (!pendingComponentType) {
      setPlacement(null)
      activePlacementRef.current = null
      return
    }

    function handlePointerMove(event: PointerEvent) {
      const activePlacement = activePlacementRef.current
      if (!activePlacement) {
        return
      }

      const currentX = (event.clientX - activePlacement.rect.left) / activePlacement.scale
      const currentY = (event.clientY - activePlacement.rect.top) / activePlacement.scale
      const x = Math.min(activePlacement.startX, currentX)
      const y = Math.min(activePlacement.startY, currentY)
      const width = Math.abs(currentX - activePlacement.startX)
      const height = Math.abs(currentY - activePlacement.startY)

      setPlacement({ x, y, width, height })
    }

    function handlePointerUp() {
      const activePlacement = activePlacementRef.current
      const draft = placementRef.current
      if (!activePlacement || !draft) {
        activePlacementRef.current = null
        setPlacement(null)
        return
      }

      if (draft.width >= PLACEMENT_DRAG_THRESHOLD && draft.height >= PLACEMENT_DRAG_THRESHOLD) {
        placeComponent(activePlacement.type, draft)
      }

      activePlacementRef.current = null
      setPlacement(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [pendingComponentType, placeComponent])

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
      const deltaX = (event.clientX - activeTransform.startX) / activeTransform.scale
      const deltaY = (event.clientY - activeTransform.startY) / activeTransform.scale

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

  const handlePlacementStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !pendingComponentType) {
      return
    }

    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const startX = (event.clientX - rect.left) / scale
    const startY = (event.clientY - rect.top) / scale

    activePlacementRef.current = {
      type: pendingComponentType,
      scale,
      rect,
      startX,
      startY,
    }
    setPlacement({
      x: startX,
      y: startY,
      width: 0,
      height: 0,
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
      scale,
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
        <div className="canvas-header__meta">
          <span>{board.name}</span>
          <span>{project.boardSize.width} × {project.boardSize.height}</span>
        </div>

        <div className="canvas-zoom">
          <button
            type="button"
            className="canvas-zoom__button canvas-zoom__button--fit"
            aria-label="当前画板缩放"
          >
            {Math.round(scale * 100)}%
          </button>
        </div>
      </div>

      <div className="canvas-stage" ref={stageRef}>
        <div
          className="canvas-stage__viewport"
          style={{
            width: project.boardSize.width * scale,
            height: project.boardSize.height * scale,
          }}
        >
          <div
            className="board-canvas"
            style={{
              width: project.boardSize.width,
              height: project.boardSize.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onClick={() => {
              selectComponent(null)
              setEditingComponentId(null)
              setContextMenu(null)
            }}
            onPointerDown={handlePlacementStart}
          >
            {placement && pendingComponentType ? (
              <div
                style={{
                  position: 'absolute',
                  left: placement.x,
                  top: placement.y,
                  width: placement.width,
                  height: placement.height,
                  border: '1px dashed #2563eb',
                  background: 'rgba(37, 99, 235, 0.08)',
                  pointerEvents: 'none',
                }}
              />
            ) : null}
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
