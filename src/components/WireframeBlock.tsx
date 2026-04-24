/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前仅为 layout、content、input、navigation、feedback、media、commerce 七类渲染原创低保真骨架
3. 选中态补入更明显但低饱和的强调样式钩子，并区分待放置锁定高亮
4. 当前支持待放置时切换为纯展示态，屏蔽块内交互
5. 块内名称编辑允许临时空值，空值不提交并保持焦点
6. 更新后检查所属 `.folder.md`
*/

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
} from 'react'
import { COMPONENT_DEFINITIONS } from '../utils/constants'
import type { ActiveComponentType, ComponentData } from '../types/schema'

interface WireframeBlockProps {
  component: ComponentData
  selected?: boolean
  placementLocked?: boolean
  editing?: boolean
  preview?: boolean
  badge?: string | null
  interactive?: boolean
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  onSelect?: () => void
  onStartEdit?: () => void
  onCommitName?: (value: string) => void
  onResizePointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
}

function bar(width: string | number, height = 3, strong = false): ReactElement {
  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height,
        borderRadius: 999,
        background: strong ? '#5b4437' : '#b99678',
        flexShrink: 0,
      }}
    />
  )
}

function block(width: string | number, height: string | number, extra?: CSSProperties): ReactElement {
  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: 6,
        border: '1px dashed #b99678',
        background: 'rgba(255,255,255,0.6)',
        flexShrink: 0,
        ...extra,
      }}
    />
  )
}

function circle(size: number, filled = false): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px dashed #b99678',
        background: filled ? '#5b4437' : 'rgba(255,255,255,0.6)',
        flexShrink: 0,
      }}
    />
  )
}

function rows(count: number, widths: string[] = ['68%', '86%', '74%', '52%']): ReactElement[] {
  return Array.from({ length: count }, (_, index) => (
    <div key={index}>{bar(widths[index % widths.length], index === 0 ? 4 : 2, index === 0)}</div>
  ))
}

function renderLayoutSkeleton(width: number, height: number): ReactElement {
  const hasSideRail = width >= 260
  const panelCount = height >= 180 ? 2 : 1

  return (
    <div style={{ display: 'grid', gridTemplateRows: '18% 1fr 14%', gap: 6, height: '100%' }}>
      {block('100%', '100%', { background: '#ead8c7' })}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: hasSideRail ? '28% 1fr' : '1fr',
          gap: 6,
          minHeight: 0,
        }}
      >
        {hasSideRail ? block('100%', '100%') : null}
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${panelCount}, 1fr)`, gap: 6 }}>
          {Array.from({ length: panelCount }, (_, index) => (
            <div key={index}>{block('100%', '100%', { background: index === 0 ? 'rgba(255,255,255,0.7)' : undefined })}</div>
          ))}
        </div>
      </div>
      {block('100%', '100%')}
    </div>
  )
}

function renderContentSkeleton(height: number): ReactElement {
  const lineCount = Math.max(2, Math.min(5, Math.floor(height / 30)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, height: '100%' }}>
      {rows(lineCount, ['42%', '78%', '88%', '64%', '54%'])}
    </div>
  )
}

function renderInputSkeleton(width: number, height: number): ReactElement {
  const fieldCount = Math.max(1, Math.min(3, Math.floor(height / 62)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, height: '100%' }}>
      {Array.from({ length: fieldCount }, (_, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bar(index === 0 ? '30%' : '22%', 2)}
          {block('100%', Math.min(34, Math.max(20, height / (fieldCount + 2))))}
        </div>
      ))}
      {height >= 120 ? block(Math.min(120, width * 0.42), 28, { background: '#e6d1c0', alignSelf: 'flex-end' }) : null}
    </div>
  )
}

function renderNavigationSkeleton(width: number, height: number): ReactElement {
  const itemCount = Math.max(2, Math.min(4, Math.floor(width / 140)))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
      {block(Math.min(42, width * 0.18), Math.min(26, height * 0.55), { background: '#ead8c7' })}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {Array.from({ length: itemCount }, (_, index) => (
          <div key={index} style={{ flex: 1 }}>{bar(index === 0 ? '82%' : '66%', index === 0 ? 4 : 3, index === 0)}</div>
        ))}
      </div>
      {width >= 260 ? block(54, Math.min(26, height * 0.55)) : null}
    </div>
  )
}

function renderFeedbackSkeleton(width: number, height: number): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
      {circle(Math.min(24, Math.max(14, height * 0.28)), true)}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {bar('42%', 4, true)}
        {bar('84%', 2)}
        {height >= 80 ? bar('62%', 2) : null}
      </div>
      {width >= 300 ? block(64, Math.min(28, height * 0.35), { background: '#e6d1c0' }) : null}
    </div>
  )
}

function renderMediaSkeleton(width: number, height: number): ReactElement {
  const viewWidth = Math.max(1, width)
  const viewHeight = Math.max(1, height)

  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 6, height: '100%' }}>
      <div style={{ borderRadius: 6, border: '1px dashed #b99678', overflow: 'hidden', minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" fill="none">
          <line x1="0" y1="0" x2={viewWidth} y2={viewHeight} stroke="#b99678" strokeWidth="1" />
          <line x1={viewWidth} y1="0" x2="0" y2={viewHeight} stroke="#b99678" strokeWidth="1" />
          <circle
            cx={viewWidth / 2}
            cy={viewHeight / 2}
            r={Math.min(viewWidth, viewHeight) * 0.1}
            fill="rgba(255,255,255,0.72)"
            stroke="#8b6e5a"
          />
        </svg>
      </div>
      {height >= 120 ? <div>{bar('46%', 2)}</div> : null}
    </div>
  )
}

function renderCommerceSkeleton(width: number): ReactElement {
  const isWide = width >= 320

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isWide ? '42% 1fr' : '1fr',
        gridTemplateRows: isWide ? '1fr' : '45% 1fr',
        gap: 8,
        height: '100%',
      }}
    >
      {block('100%', '100%')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {bar('62%', 4, true)}
        {bar('46%', 2)}
        {bar('34%', 5, true)}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {block(54, 26, { background: '#e6d1c0' })}
          {block(54, 26)}
        </div>
      </div>
    </div>
  )
}

function renderSkeleton(type: ActiveComponentType, width: number, height: number): ReactElement {
  switch (type) {
    case 'layout':
      return renderLayoutSkeleton(width, height)
    case 'content':
      return renderContentSkeleton(height)
    case 'input':
      return renderInputSkeleton(width, height)
    case 'navigation':
      return renderNavigationSkeleton(width, height)
    case 'feedback':
      return renderFeedbackSkeleton(width, height)
    case 'media':
      return renderMediaSkeleton(width, height)
    case 'commerce':
      return renderCommerceSkeleton(width)
  }
}

export function WireframeBlock(props: WireframeBlockProps) {
  const {
    component,
    selected,
    placementLocked,
    editing,
    preview,
    badge,
    interactive = true,
    onPointerDown,
    onPointerUp,
    onContextMenu,
    onSelect,
    onStartEdit,
    onCommitName,
    onResizePointerDown,
  } = props
  const [draftName, setDraftName] = useState(component.name)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const definition = COMPONENT_DEFINITIONS[component.type]

  useEffect(() => {
    setDraftName(component.name)
  }, [component.name, editing])

  const commit = (value: string) => {
    const nextName = value.trim()
    if (!nextName) {
      nameInputRef.current?.focus()
      return false
    }

    onCommitName?.(nextName)
    return true
  }

  const interactiveHandlers = interactive
    ? {
        onPointerDown,
        onPointerUp,
        onContextMenu,
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          event.stopPropagation()
          onSelect?.()
        },
      }
    : {}

  return (
    <div
      className={[
        'wireframe-block',
        selected ? 'is-selected' : '',
        selected ? 'is-selected-emphasis' : '',
        placementLocked ? 'is-placement-locked' : '',
        preview ? 'is-preview' : '',
        String(component.type) === 'Modal' || String(component.type) === 'modal' ? 'is-modal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: component.x,
        top: component.y,
        width: component.width,
        height: component.height,
        justifyContent: 'stretch',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      {...interactiveHandlers}
    >
      {badge ? <span className="wireframe-block__badge">{badge}</span> : null}

      <div
        className="wireframe-block__body"
        style={{
          width: '100%',
          height: '100%',
          padding: 8,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          alignItems: 'stretch',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="wireframe-block__icon">{definition.icon}</span>
          {editing ? (
            <input
              ref={nameInputRef}
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
          ) : !interactive ? (
            <span className="wireframe-block__name-button">{component.name}</span>
          ) : preview ? (
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
          )}
        </div>

        <div style={{ minHeight: 0, pointerEvents: 'none' }}>
          {renderSkeleton(definition.jsonType, component.width, component.height)}
        </div>
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
