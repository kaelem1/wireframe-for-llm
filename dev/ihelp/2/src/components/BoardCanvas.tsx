/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前恢复 wireframe 画布，并补齐点击放置、拖拽定尺寸、八向缩放与空白提示层
3. 更新后检查所属 `.folder.md`
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '../stores/appStore'
import { PLACEMENT_DRAG_THRESHOLD } from '../utils/constants'
import {
  clamp,
  findComponentById,
  getBoardById,
  getBoardFitScale,
  normalizeComponentFrame,
  snap,
} from '../utils/project'
import type { ComponentType, ProtoComponent } from '../types/schema'
import { WireframeBlock } from './WireframeBlock'

type Guide = {
  orientation: 'vertical' | 'horizontal'
  position: number
}

type SizeIndicator = {
  x: number
  y: number
  text: string
}

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

type PlacementDraft = {
  x: number
  y: number
  width: number
  height: number
}

type PlacementSession = {
  type: ComponentType
  rect: DOMRect
  scale: number
  startX: number
  startY: number
}

type TransformSession = {
  mode: 'move' | 'resize'
  componentId: string
  rect: DOMRect
  scale: number
  startX: number
  startY: number
  origin: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>
  handle?: ResizeHandle
}

type ContextMenuState = {
  x: number
  y: number
  componentId: string
} | null

const SNAP_THRESHOLD = 6

function getBoardPoint(rect: DOMRect, scale: number, clientX: number, clientY: number) {
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  }
}

function getPlacementDraft(startX: number, startY: number, currentX: number, currentY: number): PlacementDraft {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  }
}

function getGuideTargets(boardSize: { width: number; height: number }, others: ProtoComponent[]) {
  const xTargets = [0, boardSize.width / 2, boardSize.width]
  const yTargets = [0, boardSize.height / 2, boardSize.height]

  for (const component of others) {
    xTargets.push(component.x, component.x + component.width / 2, component.x + component.width)
    yTargets.push(component.y, component.y + component.height / 2, component.y + component.height)
  }

  return { xTargets, yTargets }
}

function getBestSnap(
  candidates: Array<{ target: number; apply: () => number }>,
  orientation: Guide['orientation'],
): { snapped: number | null; guide: Guide | null } {
  let bestDelta = Infinity
  let snapped: number | null = null
  let guide: Guide | null = null

  for (const candidate of candidates) {
    const next = candidate.apply()
    const delta = Math.abs(next - candidate.target)

    if (delta <= SNAP_THRESHOLD && delta < bestDelta) {
      bestDelta = delta
      snapped = candidate.target
      guide = { orientation, position: candidate.target }
    }
  }

  return { snapped, guide }
}

function getMoveFrame(
  frame: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  boardSize: { width: number; height: number },
  others: ProtoComponent[],
) {
  const { xTargets, yTargets } = getGuideTargets(boardSize, others)
  const guides: Guide[] = []

  const left = clamp(snap(frame.x), 0, boardSize.width - frame.width)
  const top = clamp(snap(frame.y), 0, boardSize.height - frame.height)
  let nextX = left
  let nextY = top

  const xSnap = getBestSnap(
    xTargets.flatMap((target) => [
      { target, apply: () => left },
      { target, apply: () => left + frame.width / 2 },
      { target, apply: () => left + frame.width },
    ]),
    'vertical',
  )
  const ySnap = getBestSnap(
    yTargets.flatMap((target) => [
      { target, apply: () => top },
      { target, apply: () => top + frame.height / 2 },
      { target, apply: () => top + frame.height },
    ]),
    'horizontal',
  )

  if (xSnap.snapped !== null) {
    const centerDelta = Math.abs(left + frame.width / 2 - xSnap.snapped)
    const leftDelta = Math.abs(left - xSnap.snapped)
    const rightDelta = Math.abs(left + frame.width - xSnap.snapped)

    if (centerDelta <= leftDelta && centerDelta <= rightDelta) {
      nextX = clamp(snap(xSnap.snapped - frame.width / 2), 0, boardSize.width - frame.width)
    } else if (rightDelta < leftDelta) {
      nextX = clamp(snap(xSnap.snapped - frame.width), 0, boardSize.width - frame.width)
    } else {
      nextX = clamp(snap(xSnap.snapped), 0, boardSize.width - frame.width)
    }
    if (xSnap.guide) {
      guides.push(xSnap.guide)
    }
  }

  if (ySnap.snapped !== null) {
    const centerDelta = Math.abs(top + frame.height / 2 - ySnap.snapped)
    const topDelta = Math.abs(top - ySnap.snapped)
    const bottomDelta = Math.abs(top + frame.height - ySnap.snapped)

    if (centerDelta <= topDelta && centerDelta <= bottomDelta) {
      nextY = clamp(snap(ySnap.snapped - frame.height / 2), 0, boardSize.height - frame.height)
    } else if (bottomDelta < topDelta) {
      nextY = clamp(snap(ySnap.snapped - frame.height), 0, boardSize.height - frame.height)
    } else {
      nextY = clamp(snap(ySnap.snapped), 0, boardSize.height - frame.height)
    }
    if (ySnap.guide) {
      guides.push(ySnap.guide)
    }
  }

  return {
    frame: {
      x: nextX,
      y: nextY,
      width: frame.width,
      height: frame.height,
    },
    guides,
  }
}

function getResizeFrame(
  session: TransformSession,
  rawFrame: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  type: ComponentType,
  boardSize: { width: number; height: number },
  others: ProtoComponent[],
) {
  const normalized = normalizeComponentFrame(type, rawFrame, boardSize)
  const { xTargets, yTargets } = getGuideTargets(boardSize, others)
  const guides: Guide[] = []
  let next = { ...normalized }

  if (session.handle?.includes('w')) {
    const snapResult = getBestSnap(
      xTargets.map((target) => ({ target, apply: () => normalized.x })),
      'vertical',
    )
    if (snapResult.snapped !== null) {
      const right = normalized.x + normalized.width
      next.x = clamp(snap(snapResult.snapped), 0, right)
      next.width = clamp(snap(right - next.x), 0, boardSize.width)
      if (snapResult.guide) {
        guides.push(snapResult.guide)
      }
    }
  }

  if (session.handle?.includes('e')) {
    const snapResult = getBestSnap(
      xTargets.map((target) => ({ target, apply: () => normalized.x + normalized.width })),
      'vertical',
    )
    if (snapResult.snapped !== null) {
      next.width = clamp(snap(snapResult.snapped - normalized.x), 0, boardSize.width - normalized.x)
      if (snapResult.guide) {
        guides.push(snapResult.guide)
      }
    }
  }

  if (session.handle?.includes('n')) {
    const snapResult = getBestSnap(
      yTargets.map((target) => ({ target, apply: () => normalized.y })),
      'horizontal',
    )
    if (snapResult.snapped !== null) {
      const bottom = normalized.y + normalized.height
      next.y = clamp(snap(snapResult.snapped), 0, bottom)
      next.height = clamp(snap(bottom - next.y), 0, boardSize.height)
      if (snapResult.guide) {
        guides.push(snapResult.guide)
      }
    }
  }

  if (session.handle?.includes('s')) {
    const snapResult = getBestSnap(
      yTargets.map((target) => ({ target, apply: () => normalized.y + normalized.height })),
      'horizontal',
    )
    if (snapResult.snapped !== null) {
      next.height = clamp(snap(snapResult.snapped - normalized.y), 0, boardSize.height - normalized.y)
      if (snapResult.guide) {
        guides.push(snapResult.guide)
      }
    }
  }

  return {
    frame: normalizeComponentFrame(type, next, boardSize),
    guides,
  }
}

function makeBadge(targetId: string | undefined, componentId: string, projectBoards: { id: string; name: string }[]) {
  if (!targetId) {
    return null
  }

  if (targetId === componentId) {
    return '→ 弹窗'
  }

  const board = projectBoards.find((item) => item.id === targetId)
  return board ? `→ ${board.name}` : null
}

function getResizeDraft(
  origin: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
) {
  let x = origin.x
  let y = origin.y
  let width = origin.width
  let height = origin.height

  if (handle.includes('e')) {
    width = origin.width + deltaX
  }
  if (handle.includes('s')) {
    height = origin.height + deltaY
  }
  if (handle.includes('w')) {
    x = origin.x + deltaX
    width = origin.width - deltaX
  }
  if (handle.includes('n')) {
    y = origin.y + deltaY
    height = origin.height - deltaY
  }

  return { x, y, width, height }
}

export function BoardCanvas() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const editingComponentId = useAppStore((state) => state.editingComponentId)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const wireframe = useAppStore((state) => state.wireframe)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const setEditingComponentId = useAppStore((state) => state.setEditingComponentId)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const addComponent = useAppStore((state) => state.addComponent)
  const placeComponent = useAppStore((state) => state.placeComponent)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const deleteComponent = useAppStore((state) => state.deleteComponent)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)

  const [fitScale, setFitScale] = useState(1)
  const [guides, setGuides] = useState<Guide[]>([])
  const [sizeIndicator, setSizeIndicator] = useState<SizeIndicator | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null)
  const [transformSession, setTransformSession] = useState<TransformSession | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const placementSessionRef = useRef<PlacementSession | null>(null)
  const placementDraftRef = useRef<PlacementDraft | null>(null)

  const board = project && activeBoardId ? getBoardById(project, activeBoardId) ?? null : null
  const selectedComponent = useMemo(
    () => board?.components.find((component) => component.id === selectedComponentId) ?? null,
    [board, selectedComponentId],
  )
  const otherComponents = useMemo(
    () =>
      board?.components.filter((component) => component.id !== selectedComponentId) ?? [],
    [board, selectedComponentId],
  )

  useEffect(() => {
    placementDraftRef.current = placementDraft
  }, [placementDraft])

  useEffect(() => {
    if (!project) {
      return
    }

    const updateFitScale = () => {
      const stage = stageRef.current
      if (!stage) {
        return
      }
      setFitScale(getBoardFitScale(project.boardSize, stage.clientWidth, stage.clientHeight))
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
      placementSessionRef.current = null
      setPlacementDraft(null)
    }
  }, [pendingComponentType])

  useEffect(() => {
    if (!pendingComponentType || !project) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const session = placementSessionRef.current
      if (!session) {
        return
      }

      const point = getBoardPoint(session.rect, session.scale, event.clientX, event.clientY)
      const nextDraft = getPlacementDraft(session.startX, session.startY, point.x, point.y)
      setPlacementDraft(nextDraft)
      setSizeIndicator({
        x: nextDraft.x + nextDraft.width / 2,
        y: Math.max(nextDraft.y - 12, 12),
        text: `${Math.round(nextDraft.width)} × ${Math.round(nextDraft.height)}`,
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = placementSessionRef.current
      const draft = placementDraftRef.current
      if (!session) {
        return
      }

      const point = getBoardPoint(session.rect, session.scale, event.clientX, event.clientY)
      const hasDragged =
        draft &&
        (draft.width >= PLACEMENT_DRAG_THRESHOLD || draft.height >= PLACEMENT_DRAG_THRESHOLD)

      if (hasDragged && draft) {
        placeComponent(session.type, draft)
      } else {
        addComponent(session.type, { x: point.x, y: point.y })
      }

      placementSessionRef.current = null
      setPlacementDraft(null)
      setSizeIndicator(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [addComponent, pendingComponentType, placeComponent, project])

  useEffect(() => {
    if (!transformSession || !project) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const found = findComponentById(project, transformSession.componentId)
      if (!found) {
        return
      }

      const deltaX = (event.clientX - transformSession.startX) / transformSession.scale
      const deltaY = (event.clientY - transformSession.startY) / transformSession.scale

      if (transformSession.mode === 'move') {
        const moved = {
          x: transformSession.origin.x + deltaX,
          y: transformSession.origin.y + deltaY,
          width: transformSession.origin.width,
          height: transformSession.origin.height,
        }
        const normalized = normalizeComponentFrame(found.component.type, moved, project.boardSize)
        const snapped = getMoveFrame(normalized, project.boardSize, otherComponents)
        updateComponent(found.component.id, snapped.frame)
        setGuides(snapped.guides)
        setSizeIndicator({
          x: snapped.frame.x + snapped.frame.width / 2,
          y: Math.max(snapped.frame.y - 12, 12),
          text: `${Math.round(snapped.frame.width)} × ${Math.round(snapped.frame.height)}`,
        })
        return
      }

      const raw = getResizeDraft(transformSession.origin, transformSession.handle ?? 'se', deltaX, deltaY)
      const resized = getResizeFrame(
        transformSession,
        raw,
        found.component.type,
        project.boardSize,
        otherComponents,
      )
      updateComponent(found.component.id, resized.frame)
      setGuides(resized.guides)
      setSizeIndicator({
        x: resized.frame.x + resized.frame.width / 2,
        y: Math.max(resized.frame.y - 12, 12),
        text: `${Math.round(resized.frame.width)} × ${Math.round(resized.frame.height)}`,
      })
    }

    const handlePointerUp = () => {
      setTransformSession(null)
      setGuides([])
      setSizeIndicator(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [otherComponents, project, transformSession, updateComponent])

  if (!project || !board) {
    return null
  }

  const scale = fitScale

  const startPlacement = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !pendingComponentType) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const point = getBoardPoint(rect, scale, event.clientX, event.clientY)
    placementSessionRef.current = {
      type: pendingComponentType,
      rect,
      scale,
      startX: point.x,
      startY: point.y,
    }
    setContextMenu(null)
  }

  const startTransform = (
    componentId: string,
    event: ReactPointerEvent<HTMLElement>,
    mode: TransformSession['mode'],
    handle?: ResizeHandle,
  ) => {
    if (event.button !== 0 || !boardRef.current) {
      return
    }

    const found = findComponentById(project, componentId)
    if (!found) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    selectComponent(componentId)
    setEditingComponentId(null)
    setContextMenu(null)

    setTransformSession({
      mode,
      componentId,
      rect: boardRef.current.getBoundingClientRect(),
      scale,
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: found.component.x,
        y: found.component.y,
        width: found.component.width,
        height: found.component.height,
      },
      handle,
    })
  }

  return (
    <div className="canvas-shell">
      <div className="canvas-header">
        <div className="canvas-header__meta">
          <span>{wireframe.enabled ? 'Wireframe canvas' : board.name}</span>
          <span>{project.boardSize.width} × {project.boardSize.height}</span>
          {wireframe.enabled ? <span>{board.components.length} placed</span> : null}
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
            ref={boardRef}
            className={wireframe.enabled ? 'board-canvas board-canvas--wireframe' : 'board-canvas'}
            style={{
              width: project.boardSize.width,
              height: project.boardSize.height,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) {
                return
              }

              if (pendingComponentType) {
                startPlacement(event)
                return
              }

              selectComponent(null)
              setEditingComponentId(null)
              setContextMenu(null)
            }}
          >
            {wireframe.enabled ? (
              <div className="board-canvas__wash" style={{ opacity: wireframe.opacity }} />
            ) : null}

            {wireframe.enabled && board.components.length === 0 ? (
              <div className="canvas-empty-state">
                <div className="canvas-empty-state__eyebrow">Wireframe New Page</div>
                <strong>{wireframe.purpose || 'Pick a component and click or drag on canvas.'}</strong>
                <span>单击使用默认尺寸落组件，拖拽按框选尺寸落组件。</span>
              </div>
            ) : null}

            {placementDraft && pendingComponentType ? (
              <div
                className="canvas-placement-draft"
                style={{
                  left: placementDraft.x,
                  top: placementDraft.y,
                  width: placementDraft.width,
                  height: placementDraft.height,
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

            {sizeIndicator ? (
              <div
                className="canvas-size-indicator"
                style={{ left: sizeIndicator.x, top: sizeIndicator.y }}
              >
                {sizeIndicator.text}
              </div>
            ) : null}

            {board.components.map((component) => {
              const firstInteraction = component.interactions[0]
              const badge =
                firstInteraction?.action === 'showModal'
                  ? makeBadge(firstInteraction.target, component.id, [])
                  : makeBadge(firstInteraction?.target, component.id, project.boards)

              return (
                <WireframeBlock
                  key={component.id}
                  component={component}
                  selected={selectedComponentId === component.id}
                  editing={editingComponentId === component.id}
                  badge={badge}
                  onPointerDown={(event) => startTransform(component.id, event, 'move')}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    selectComponent(component.id)
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      componentId: component.id,
                    })
                  }}
                  onSelect={() => {
                    selectComponent(component.id)
                    setContextMenu(null)
                  }}
                  onStartEdit={() => setEditingComponentId(component.id)}
                  onCommitName={(value) => {
                    updateComponent(component.id, { name: value })
                    setEditingComponentId(null)
                  }}
                />
              )
            })}

            {selectedComponent ? (
              <div
                className="canvas-selection"
                style={{
                  left: selectedComponent.x,
                  top: selectedComponent.y,
                  width: selectedComponent.width,
                  height: selectedComponent.height,
                }}
              >
                {(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as ResizeHandle[]).map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`canvas-selection__handle canvas-selection__handle--${handle}`}
                    aria-label={`调整组件大小 ${handle}`}
                    onPointerDown={(event) => startTransform(selectedComponent.id, event, 'resize', handle)}
                  />
                ))}
              </div>
            ) : null}
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
          {pendingComponentType ? (
            <button
              type="button"
              onClick={() => {
                setPendingComponentType(null)
                setContextMenu(null)
              }}
            >
              退出放置
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
