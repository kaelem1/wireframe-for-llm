/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前预览态由块根节点承接交互，避免内部按钮吞点击
3. 更新后检查所属 `.folder.md`
*/

import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { COMPONENT_DEFINITIONS } from '../utils/constants'
import type { ComponentData } from '../types/schema'

interface WireframeBlockProps {
  component: ComponentData
  selected?: boolean
  editing?: boolean
  preview?: boolean
  badge?: string | null
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  onSelect?: () => void
  onStartEdit?: () => void
  onCommitName?: (value: string) => void
  onResizePointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
}

export function WireframeBlock(props: WireframeBlockProps) {
  const {
    component,
    selected,
    editing,
    preview,
    badge,
    onPointerDown,
    onPointerUp,
    onContextMenu,
    onSelect,
    onStartEdit,
    onCommitName,
    onResizePointerDown,
  } = props
  const [draftName, setDraftName] = useState(component.name)
  const definition = COMPONENT_DEFINITIONS[component.type]

  useEffect(() => {
    setDraftName(component.name)
  }, [component.name, editing])

  const commit = (value: string) => {
    onCommitName?.(value.trim() || component.name)
  }

  return (
    <div
      className={[
        'wireframe-block',
        selected ? 'is-selected' : '',
        preview ? 'is-preview' : '',
        component.type === 'Modal' ? 'is-modal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: component.x,
        top: component.y,
        width: component.width,
        height: component.height,
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.()
      }}
    >
      {badge ? <span className="wireframe-block__badge">{badge}</span> : null}

      <div className="wireframe-block__body">
        <span className="wireframe-block__icon">{definition.icon}</span>
        {editing ? (
          <input
            className="wireframe-block__name-input"
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => commit(draftName)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(draftName)
              }
              if (event.key === 'Escape') {
                commit(component.name)
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          preview ? (
            <span className="wireframe-block__name-button">{component.name}</span>
          ) : (
            <button
              type="button"
              className="wireframe-block__name-button"
              onClick={(event) => {
                event.stopPropagation()
                onStartEdit?.()
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {component.name}
            </button>
          )
        )}
      </div>

      {selected && onResizePointerDown ? (
        <button
          type="button"
          className="wireframe-block__resize-handle"
          aria-label="调整组件大小"
          onPointerDown={(event) => {
            event.stopPropagation()
            onResizePointerDown(event)
          }}
        />
      ) : null}
    </div>
  )
}
