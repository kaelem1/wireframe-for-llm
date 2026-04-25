/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前统一画布交互，补齐点击放置、框选多选、八向缩放与空白提示层
3. 空白提示层收敛为单句提示，组件按钮进入连续放置
4. 当前支持 Option/Alt 拖拽复制所选组件与越界移动缩放
5. 拖动与缩放改为本地预览，松手一次性提交历史，避免 undo 按轨迹回放
6. 待放置期间屏蔽其他图层的选中与拖拽入口，并将新建图层切到无圆点的锁定高亮
7. 画板按 contain 比例完整显示，stage 收缩到缩放后画板尺寸
8. 空画布提示用反向缩放保持屏幕尺寸固定
9. 左下角手动缩放控件以 100% 为默认倍率，叠加 contain 比例缩放整块画布
10. 更新后检查所属 `.folder.md`
*/

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '../stores/appStore'
import { t } from '../utils/i18n'
import { PLACEMENT_DRAG_THRESHOLD } from '../utils/constants'
import {
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

type SelectionSession = {
  rect: DOMRect
  scale: number
  startX: number
  startY: number
}

type TransformSession = {
  mode: 'move' | 'resize'
  componentId: string
  componentIds: string[]
  rect: DOMRect
  scale: number
  startX: number
  startY: number
  origin: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>
  origins: Array<Pick<ProtoComponent, 'id' | 'x' | 'y' | 'width' | 'height'>>
  handle?: ResizeHandle
}

type TransformPreview = {
  frames: Array<Pick<ProtoComponent, 'id' | 'x' | 'y' | 'width' | 'height'>>
  guides: Guide[]
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

function intersectsSelection(
  selection: PlacementDraft,
  component: Pick<ProtoComponent, 'x' | 'y' | 'width' | 'height'>,
) {
  return !(
    component.x + component.width < selection.x ||
    selection.x + selection.width < component.x ||
    component.y + component.height < selection.y ||
    selection.y + selection.height < component.y
  )
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

  const left = snap(frame.x)
  const top = snap(frame.y)
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
      nextX = snap(xSnap.snapped - frame.width / 2)
    } else if (rightDelta < leftDelta) {
      nextX = snap(xSnap.snapped - frame.width)
    } else {
      nextX = snap(xSnap.snapped)
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
      nextY = snap(ySnap.snapped - frame.height / 2)
    } else if (bottomDelta < topDelta) {
      nextY = snap(ySnap.snapped - frame.height)
    } else {
      nextY = snap(ySnap.snapped)
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
  const next = { ...normalized }

  if (session.handle?.includes('w')) {
    const snapResult = getBestSnap(
      xTargets.map((target) => ({ target, apply: () => normalized.x })),
      'vertical',
    )
    if (snapResult.snapped !== null) {
      const right = normalized.x + normalized.width
      next.x = snap(snapResult.snapped)
      next.width = Math.max(0, snap(right - next.x))
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
      next.width = Math.max(0, snap(snapResult.snapped - normalized.x))
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
      next.y = snap(snapResult.snapped)
      next.height = Math.max(0, snap(bottom - next.y))
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
      next.height = Math.max(0, snap(snapResult.snapped - normalized.y))
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

function makeBadge(
  targetId: string | undefined,
  componentId: string,
  projectBoards: { id: string; name: string }[],
  modalLabel: string,
) {
  if (!targetId) {
    return null
  }

  if (targetId === componentId) {
    return modalLabel
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
  const locale = useAppStore((state) => state.locale)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const editingComponentId = useAppStore((state) => state.editingComponentId)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const selectComponents = useAppStore((state) => state.selectComponents)
  const setEditingComponentId = useAppStore((state) => state.setEditingComponentId)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const addComponent = useAppStore((state) => state.addComponent)
  const placeComponent = useAppStore((state) => state.placeComponent)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const updateComponentFrames = useAppStore((state) => state.updateComponentFrames)
  const deleteComponent = useAppStore((state) => state.deleteComponent)
  const duplicateComponent = useAppStore((state) => state.duplicateComponent)
  const duplicateComponents = useAppStore((state) => state.duplicateComponents)

  const [fitScale, setFitScale] = useState(1)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [guides, setGuides] = useState<Guide[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null)
  const [selectionDraft, setSelectionDraft] = useState<PlacementDraft | null>(null)
  const [transformSession, setTransformSession] = useState<TransformSession | null>(null)
  const [transformPreview, setTransformPreview] = useState<TransformPreview | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const placementSessionRef = useRef<PlacementSession | null>(null)
  const placementDraftRef = useRef<PlacementDraft | null>(null)
  const selectionSessionRef = useRef<SelectionSession | null>(null)
  const selectionDraftRef = useRef<PlacementDraft | null>(null)
  const transformPreviewRef = useRef<TransformPreview | null>(null)

  const board = project && activeBoardId ? getBoardById(project, activeBoardId) ?? null : null
  const selectedComponent = useMemo(
    () => board?.components.find((component) => component.id === selectedComponentId) ?? null,
    [board, selectedComponentId],
  )
  const isPlacingComponent = Boolean(pendingComponentType)
  const transformPreviewMap = useMemo(
    () => new Map(transformPreview?.frames.map((frame) => [frame.id, frame]) ?? []),
    [transformPreview],
  )
  const visibleSelectedComponent = selectedComponent
    ? (() => {
        const preview = transformPreviewMap.get(selectedComponent.id)
        return preview ? { ...selectedComponent, ...preview } : selectedComponent
      })()
    : null
  const otherComponents = useMemo(
    () => board?.components.filter((component) => !selectedComponentIds.includes(component.id)) ?? [],
    [board, selectedComponentIds],
  )

  useEffect(() => {
    placementDraftRef.current = placementDraft
  }, [placementDraft])

  useEffect(() => {
    selectionDraftRef.current = selectionDraft
  }, [selectionDraft])

  useEffect(() => {
    if (!project) {
      return
    }

    const updateFitScale = () => {
      const shell = shellRef.current
      if (!shell) {
        return
      }
      setFitScale(getBoardFitScale(project.boardSize, shell.clientWidth, shell.clientHeight))
    }

    updateFitScale()
    const observer = new ResizeObserver(updateFitScale)
    if (shellRef.current) {
      observer.observe(shellRef.current)
    }

    return () => observer.disconnect()
  }, [project])

  useEffect(() => {
    if (!pendingComponentType) {
      placementSessionRef.current = null
    }
  }, [pendingComponentType])

  useEffect(() => {
    transformPreviewRef.current = transformPreview
  }, [transformPreview])

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
      setPlacementDraft(getPlacementDraft(session.startX, session.startY, point.x, point.y))
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = placementSessionRef.current
      const draft = placementDraftRef.current
      if (!session) {
        return
      }

      const hasDragged =
        draft &&
        (draft.width >= PLACEMENT_DRAG_THRESHOLD || draft.height >= PLACEMENT_DRAG_THRESHOLD)

      if (hasDragged && draft) {
        placeComponent(session.type, draft)
      } else {
        const point = getBoardPoint(session.rect, session.scale, event.clientX, event.clientY)
        addComponent(session.type, { x: point.x, y: point.y })
      }

      placementSessionRef.current = null
      setPlacementDraft(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [addComponent, pendingComponentType, placeComponent, project])

  useEffect(() => {
    if (transformSession) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const session = selectionSessionRef.current
      if (!session) {
        return
      }

      const point = getBoardPoint(session.rect, session.scale, event.clientX, event.clientY)
      setSelectionDraft(getPlacementDraft(session.startX, session.startY, point.x, point.y))
    }

    const handlePointerUp = () => {
      const session = selectionSessionRef.current
      const draft = selectionDraftRef.current
      if (!session) {
        return
      }

      if (
        draft &&
        (draft.width >= PLACEMENT_DRAG_THRESHOLD || draft.height >= PLACEMENT_DRAG_THRESHOLD)
      ) {
        selectComponents(
          board?.components
            .filter((component) => intersectsSelection(draft, component))
            .map((component) => component.id) ?? [],
        )
      }

      selectionSessionRef.current = null
      setSelectionDraft(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [board?.components, selectComponents, transformSession])

  useEffect(() => {
    if (!transformSession || !project) {
      return
    }

    const setPreview = (preview: TransformPreview | null) => {
      transformPreviewRef.current = preview
      setTransformPreview(preview)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const found = findComponentById(project, transformSession.componentId)
      if (!found) {
        return
      }

      const deltaX = (event.clientX - transformSession.startX) / transformSession.scale
      const deltaY = (event.clientY - transformSession.startY) / transformSession.scale

      if (transformSession.mode === 'move') {
        if (transformSession.componentIds.length > 1) {
          const frames = transformSession.origins.map((item) => ({
            id: item.id,
            x: item.x + deltaX,
            y: item.y + deltaY,
            width: item.width,
            height: item.height,
          }))
          setGuides([])
          setPreview({ frames, guides: [] })
          return
        }

        const moved = {
          x: transformSession.origin.x + deltaX,
          y: transformSession.origin.y + deltaY,
          width: transformSession.origin.width,
          height: transformSession.origin.height,
        }
        const normalized = normalizeComponentFrame(found.component.type, moved, project.boardSize)
        const snapped = getMoveFrame(normalized, project.boardSize, otherComponents)
        setGuides(snapped.guides)
        setPreview({
          frames: [{ id: found.component.id, ...snapped.frame }],
          guides: snapped.guides,
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
      setGuides(resized.guides)
      setPreview({
        frames: [{ id: found.component.id, ...resized.frame }],
        guides: resized.guides,
      })
    }

    const handlePointerUp = () => {
      const session = transformSession
      const preview = transformPreviewRef.current
      const frames = preview?.frames ?? []

      if (session.mode === 'move') {
        if (session.componentIds.length > 1) {
          const nextFrames = frames.length > 0 ? frames : session.origins
          updateComponentFrames(nextFrames)
        } else {
          const frame = frames[0] ?? session.origin
          updateComponent(session.componentId, frame)
        }
      } else {
        const frame = frames[0] ?? session.origin
        updateComponent(session.componentId, frame)
      }

      setTransformSession(null)
      setTransformPreview(null)
      transformPreviewRef.current = null
      setGuides([])
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [otherComponents, project, transformSession, updateComponent, updateComponentFrames])

  if (!project || !board) {
    return null
  }

  const scale = fitScale * (zoomPercent / 100)
  const emptyStateScale = scale === 0 ? 1 : 1 / scale
  const scaledBoardWidth = Math.round(project.boardSize.width * scale * 1000) / 1000
  const scaledBoardHeight = Math.round(project.boardSize.height * scale * 1000) / 1000

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

  const startSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const point = getBoardPoint(rect, scale, event.clientX, event.clientY)
    selectionSessionRef.current = {
      rect,
      scale,
      startX: point.x,
      startY: point.y,
    }
    selectComponents([])
    setEditingComponentId(null)
    setContextMenu(null)
  }

  const startTransform = (
    componentId: string,
    event: ReactPointerEvent<HTMLElement>,
    mode: TransformSession['mode'],
    handle?: ResizeHandle,
  ) => {
    if (useAppStore.getState().pendingComponentType || event.button !== 0 || !boardRef.current) {
      return
    }

    let nextProject = project
    let nextComponentId = componentId
    let componentIds =
      mode === 'move' && selectedComponentIds.includes(componentId) && selectedComponentIds.length > 1
        ? selectedComponentIds
        : [componentId]

    if (mode === 'move' && event.altKey) {
      const duplicatedIds = duplicateComponents(componentIds, { x: 0, y: 0 })
      const duplicatedProject = useAppStore.getState().project

      if (duplicatedIds.length > 0 && duplicatedProject) {
        nextProject = duplicatedProject
        nextComponentId = duplicatedIds.at(-1) ?? duplicatedIds[0]
        componentIds = duplicatedIds
      }
    }

    const found = findComponentById(nextProject, nextComponentId)
    if (!found) {
      return
    }

    const origins = componentIds
      .map((id) => findComponentById(nextProject, id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(({ component }) => ({
        id: component.id,
        x: component.x,
        y: component.y,
        width: component.width,
        height: component.height,
      }))

    event.preventDefault()
    event.stopPropagation()
    if (!event.altKey && componentIds.length > 1) {
      selectComponents(componentIds)
    } else if (!event.altKey) {
      selectComponent(nextComponentId)
    }
    setEditingComponentId(null)
    setContextMenu(null)

    setTransformSession({
      mode,
      componentId: nextComponentId,
      componentIds,
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
      origins,
      handle,
    })
    const previewFrames = origins.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    }))
    const preview: TransformPreview = { frames: previewFrames, guides: [] }
    transformPreviewRef.current = preview
    setTransformPreview(preview)
  }

  return (
    <div className="canvas-shell" ref={shellRef}>
      <div
        className="canvas-stage"
        style={{
          width: scaledBoardWidth,
          height: scaledBoardHeight,
        }}
      >
        <div
          className="canvas-stage__viewport"
          style={{
            width: scaledBoardWidth,
            height: scaledBoardHeight,
          }}
        >
          <div
            ref={boardRef}
            className="board-canvas board-canvas--wireframe"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
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

              startSelection(event)
            }}
          >
            {board.components.length === 0 ? (
              <div
                className="canvas-empty-state"
                style={{
                  transform: `translate(-50%, -50%) scale(${emptyStateScale})`,
                }}
              >
                <span>{t(locale, 'clickToPlace')}</span>
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

            {selectionDraft && !pendingComponentType ? (
              <div
                className="canvas-marquee"
                style={{
                  left: selectionDraft.x,
                  top: selectionDraft.y,
                  width: selectionDraft.width,
                  height: selectionDraft.height,
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
              const preview = transformPreviewMap.get(component.id)
              const displayedComponent = preview ? { ...component, ...preview } : component
              const isSelected = selectedComponentIds.includes(component.id)
              const isPlacementLocked = isPlacingComponent && isSelected
              const firstInteraction = component.interactions[0]
              const badge =
                firstInteraction?.action === 'showModal'
                  ? makeBadge(firstInteraction.target, component.id, [], t(locale, 'modalBadge'))
                  : makeBadge(firstInteraction?.target, component.id, project.boards, t(locale, 'modalBadge'))

              return (
                <WireframeBlock
                  key={`${component.id}-${isPlacingComponent ? 'placing' : 'free'}`}
                  component={displayedComponent}
                  selected={isSelected && !isPlacementLocked}
                  placementLocked={isPlacementLocked}
                  editing={editingComponentId === component.id}
                  badge={badge}
                  interactive={!isPlacingComponent}
                  onPointerDown={
                    isPlacingComponent ? undefined : (event) => startTransform(component.id, event, 'move')
                  }
                  onContextMenu={(event) => {
                    event.preventDefault()
                    selectComponent(component.id)
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      componentId: component.id,
                    })
                  }}
                  onSelect={
                    isPlacingComponent
                      ? undefined
                      : () => {
                          selectComponent(component.id)
                          setContextMenu(null)
                        }
                  }
                  onStartEdit={isPlacingComponent ? undefined : () => setEditingComponentId(component.id)}
                  onCommitName={(value) => {
                    updateComponent(component.id, { name: value })
                    setEditingComponentId(null)
                  }}
                />
              )
            })}

            {visibleSelectedComponent && selectedComponentIds.length === 1 && !isPlacingComponent ? (
              <div
                className="canvas-selection"
                style={{
                  left: visibleSelectedComponent.x,
                  top: visibleSelectedComponent.y,
                  width: visibleSelectedComponent.width,
                  height: visibleSelectedComponent.height,
                }}
              >
                {(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as ResizeHandle[]).map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`canvas-selection__handle canvas-selection__handle--${handle}`}
                    aria-label={t(locale, 'resizeComponent', { handle })}
                    onPointerDown={(event) => startTransform(visibleSelectedComponent.id, event, 'resize', handle)}
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
            {t(locale, 'duplicate')}
          </button>
          <button
            type="button"
          onClick={() => {
              deleteComponent(contextMenu.componentId)
              setContextMenu(null)
            }}
          >
            {t(locale, 'delete')}
          </button>
          {pendingComponentType ? (
            <button
              type="button"
              onClick={() => {
                setPendingComponentType(null)
                setContextMenu(null)
              }}
            >
              {t(locale, 'exitPlacement')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="canvas-zoom" aria-label={t(locale, 'currentCanvasZoom')}>
        <button
          type="button"
          className="canvas-zoom__button"
          aria-label={t(locale, 'zoomOutCanvas')}
          disabled={zoomPercent <= 10}
          onClick={() => setZoomPercent((current) => Math.max(10, current - 10))}
        >
          -
        </button>
        <span className="canvas-zoom__value" aria-live="polite">
          {zoomPercent}%
        </span>
        <button
          type="button"
          className="canvas-zoom__button"
          aria-label={t(locale, 'zoomInCanvas')}
          disabled={zoomPercent >= 200}
          onClick={() => setZoomPercent((current) => Math.min(200, current + 10))}
        >
          +
        </button>
      </div>
    </div>
  )
}
