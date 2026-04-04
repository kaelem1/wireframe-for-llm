/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useRef } from 'react'
import type {
  AlignmentGuide,
  BoardComponent,
  BoardDocument,
  ComponentInteraction,
  Size,
} from '../types/schema'
import { COMPONENT_META } from '../utils/catalog'

interface BoardSurfaceProps {
  board: BoardDocument
  boardSize: Size
  mode: 'edit' | 'preview' | 'static'
  selectedComponentId?: string | null
  editingComponentId?: string | null
  editingNameValue?: string
  liveFrame?: Partial<Record<string, Pick<BoardComponent, 'x' | 'y' | 'width' | 'height'>>>
  guides?: AlignmentGuide[]
  visibleModalId?: string | null
  onBoardPointerDown?: () => void
  onSelectComponent?: (componentId: string) => void
  onContextMenu?: (componentId: string, event: React.MouseEvent<HTMLDivElement>) => void
  onStartDrag?: (componentId: string, event: React.PointerEvent<HTMLDivElement>) => void
  onStartResize?: (
    componentId: string,
    handle: 's' | 'e' | 'se',
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void
  onStartNameEdit?: (componentId: string, name: string) => void
  onNameChange?: (value: string) => void
  onCommitNameEdit?: () => void
  onCancelNameEdit?: () => void
  onPreviewInteraction?: (interaction: ComponentInteraction) => void
  resolveInteractionTargetLabel?: (targetId: string) => string | null
}

export function BoardSurface({
  board,
  boardSize,
  mode,
  selectedComponentId,
  editingComponentId,
  editingNameValue,
  liveFrame,
  guides = [],
  visibleModalId,
  onBoardPointerDown,
  onSelectComponent,
  onContextMenu,
  onStartDrag,
  onStartResize,
  onStartNameEdit,
  onNameChange,
  onCommitNameEdit,
  onCancelNameEdit,
  onPreviewInteraction,
  resolveInteractionTargetLabel,
}: BoardSurfaceProps) {
  const visibleComponents =
    mode === 'preview'
      ? board.components.filter((component) => component.type !== 'Modal')
      : board.components
  const activeModal =
    mode === 'preview' && visibleModalId
      ? board.components.find((component) => component.id === visibleModalId && component.type === 'Modal') ?? null
      : null

  return (
    <div
      className={`board-surface board-surface--${mode}`}
      style={{ width: boardSize.width, height: boardSize.height }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onBoardPointerDown?.()
        }
      }}
    >
      {visibleComponents.map((component) => (
        <SurfaceBlock
          key={component.id}
          component={{
            ...component,
            ...liveFrame?.[component.id],
          }}
          mode={mode}
          boardSize={boardSize}
          selected={component.id === selectedComponentId}
          editing={component.id === editingComponentId}
          editingNameValue={editingNameValue}
          onSelectComponent={onSelectComponent}
          onContextMenu={onContextMenu}
          onStartDrag={onStartDrag}
          onStartResize={onStartResize}
          onStartNameEdit={onStartNameEdit}
          onNameChange={onNameChange}
          onCommitNameEdit={onCommitNameEdit}
          onCancelNameEdit={onCancelNameEdit}
          onPreviewInteraction={onPreviewInteraction}
          resolveInteractionTargetLabel={resolveInteractionTargetLabel}
        />
      ))}

      {activeModal ? (
        <div className="modal-preview-layer">
          <div className="modal-preview-backdrop" />
          <SurfaceBlock
            component={activeModal}
            mode="preview"
            boardSize={boardSize}
            selected={false}
            editing={false}
            onPreviewInteraction={onPreviewInteraction}
            resolveInteractionTargetLabel={resolveInteractionTargetLabel}
          />
        </div>
      ) : null}

      {guides.map((guide, index) => (
        <div
          key={`${guide.axis}-${guide.value}-${index}`}
          className={`alignment-guide alignment-guide--${guide.axis}`}
          style={
            guide.axis === 'x'
              ? { left: guide.value, height: boardSize.height }
              : { top: guide.value, width: boardSize.width }
          }
        />
      ))}
    </div>
  )
}

interface SurfaceBlockProps {
  component: BoardComponent
  mode: 'edit' | 'preview' | 'static'
  boardSize: Size
  selected: boolean
  editing: boolean
  editingNameValue?: string
  onSelectComponent?: (componentId: string) => void
  onContextMenu?: (componentId: string, event: React.MouseEvent<HTMLDivElement>) => void
  onStartDrag?: (componentId: string, event: React.PointerEvent<HTMLDivElement>) => void
  onStartResize?: (
    componentId: string,
    handle: 's' | 'e' | 'se',
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void
  onStartNameEdit?: (componentId: string, name: string) => void
  onNameChange?: (value: string) => void
  onCommitNameEdit?: () => void
  onCancelNameEdit?: () => void
  onPreviewInteraction?: (interaction: ComponentInteraction) => void
  resolveInteractionTargetLabel?: (targetId: string) => string | null
}

function SurfaceBlock({
  component,
  mode,
  boardSize,
  selected,
  editing,
  editingNameValue,
  onSelectComponent,
  onContextMenu,
  onStartDrag,
  onStartResize,
  onStartNameEdit,
  onNameChange,
  onCommitNameEdit,
  onCancelNameEdit,
  onPreviewInteraction,
  resolveInteractionTargetLabel,
}: SurfaceBlockProps) {
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const pointerStartRef = useRef<number | null>(null)
  const meta = COMPONENT_META[component.type]
  const badge = getInteractionBadge(component, resolveInteractionTargetLabel)
  const tiny = component.height < 24
  const showHandles = mode === 'edit' && selected

  const handlePreviewDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'preview') {
      return
    }
    pointerStartRef.current = event.clientX
    longPressTriggeredRef.current = false
    const interaction = component.interactions.find((item) => item.trigger === 'longPress')
    if (interaction) {
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true
        onPreviewInteraction?.(interaction)
        longPressTimerRef.current = null
      }, 450)
    }
  }

  const handlePreviewUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'preview') {
      return
    }
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      pointerStartRef.current = null
      return
    }
    const startX = pointerStartRef.current
    pointerStartRef.current = null
    if (startX !== null && Math.abs(event.clientX - startX) > 32) {
      const interaction = component.interactions.find((item) => item.trigger === 'swipe')
      if (interaction) {
        onPreviewInteraction?.(interaction)
        return
      }
    }
    const interaction = component.interactions.find((item) => item.trigger === 'tap')
    if (interaction) {
      onPreviewInteraction?.(interaction)
    }
  }

  return (
    <div
      className={`surface-block surface-block--${mode} ${selected ? 'surface-block--selected' : ''} ${
        component.type === 'Modal' ? 'surface-block--modal' : ''
      }`}
      style={{
        left: component.type === 'Modal' && mode === 'preview' ? (boardSize.width - component.width) / 2 : component.x,
        top: component.type === 'Modal' && mode === 'preview' ? (boardSize.height - component.height) / 2 : component.y,
        width: component.width,
        height: Math.max(component.height, tiny ? 8 : component.height),
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (mode === 'edit' && !editing) {
          onSelectComponent?.(component.id)
          onStartDrag?.(component.id, event)
        }
        handlePreviewDown(event)
      }}
      onPointerUp={handlePreviewUp}
      onContextMenu={(event) => {
        event.stopPropagation()
        onContextMenu?.(component.id, event)
      }}
    >
      <div className="surface-block__content">
        <span className="surface-block__icon">{meta.icon}</span>
        {editing ? (
          <input
            className="surface-block__name-input"
            value={editingNameValue}
            autoFocus
            onChange={(event) => onNameChange?.(event.target.value)}
            onBlur={() => onCommitNameEdit?.()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onCommitNameEdit?.()
              }
              if (event.key === 'Escape') {
                onCancelNameEdit?.()
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="surface-block__name"
            onClick={(event) => {
              event.stopPropagation()
              if (mode === 'edit') {
                onSelectComponent?.(component.id)
                onStartNameEdit?.(component.id, component.name)
              }
            }}
          >
            {component.name}
          </button>
        )}
      </div>

      {badge ? <span className="surface-block__badge">{badge}</span> : null}

      {showHandles ? (
        <>
          <ResizeHandle componentId={component.id} handle="s" onStartResize={onStartResize} />
          <ResizeHandle componentId={component.id} handle="e" onStartResize={onStartResize} />
          <ResizeHandle componentId={component.id} handle="se" onStartResize={onStartResize} />
        </>
      ) : null}
    </div>
  )
}

function ResizeHandle({
  componentId,
  handle,
  onStartResize,
}: {
  componentId: string
  handle: 's' | 'e' | 'se'
  onStartResize?: (
    componentId: string,
    handle: 's' | 'e' | 'se',
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void
}) {
  return (
    <button
      type="button"
      className={`resize-handle resize-handle--${handle}`}
      onPointerDown={(event) => {
        event.stopPropagation()
        onStartResize?.(componentId, handle, event)
      }}
    />
  )
}

function getInteractionBadge(
  component: BoardComponent,
  resolveInteractionTargetLabel?: (targetId: string) => string | null,
): string | null {
  const navigate = component.interactions.find((interaction) => interaction.action === 'navigate' && interaction.target)
  const showModal = component.interactions.find((interaction) => interaction.action === 'showModal' && interaction.target)
  if (navigate?.target) {
    return `→ ${resolveInteractionTargetLabel?.(navigate.target) ?? navigate.target}`
  }
  if (showModal?.target) {
    return `→ ${resolveInteractionTargetLabel?.(showModal.target) ?? '弹窗'}`
  }
  if (component.interactions.some((interaction) => interaction.action === 'back')) {
    return '→ 返回'
  }
  return null
}
