/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前按参考仓 wireframe mode 渲染分组骨架，而非仅展示图标名称
3. 选中态补入更明显但低饱和的强调样式钩子
4. 当前支持待放置时切换为纯展示态，屏蔽块内交互
5. 更新后检查所属 `.folder.md`
*/

import { useEffect, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactElement } from 'react'
import { COMPONENT_DEFINITIONS } from '../utils/constants'
import type { ComponentData, ComponentType } from '../types/schema'

interface WireframeBlockProps {
  component: ComponentData
  selected?: boolean
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
        background: strong ? '#374151' : '#9ca3af',
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
        border: '1px dashed #9ca3af',
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
        border: '1px dashed #9ca3af',
        background: filled ? '#374151' : 'rgba(255,255,255,0.6)',
        flexShrink: 0,
      }}
    />
  )
}

function resolveVisualType(type: ComponentType): ComponentType {
  if (type === 'TabBar') {
    return 'navigation'
  }

  if (type === 'Spacer') {
    return 'divider'
  }

  if (type === 'Header') {
    return 'header'
  }

  if (type === 'Card') {
    return 'card'
  }

  if (type === 'List') {
    return 'list'
  }

  if (type === 'Button') {
    return 'button'
  }

  if (type === 'Input') {
    return 'input'
  }

  if (type === 'Image') {
    return 'image'
  }

  if (type === 'Text') {
    return 'text'
  }

  if (type === 'Divider') {
    return 'divider'
  }

  if (type === 'Icon') {
    return 'icon'
  }

  if (type === 'Modal') {
    return 'modal'
  }

  return type
}

function renderTextualSkeleton(type: ComponentType, height: number, text?: string) {
  const lines = Math.max(2, Math.floor(height / 24))

  if (type === 'button') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {block('70%', Math.min(36, height * 0.75), { background: '#d1d5db' })}
      </div>
    )
  }

  if (type === 'badge' || type === 'tag' || type === 'chip') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {block('78%', Math.min(30, height * 0.8), { borderRadius: 999 })}
      </div>
    )
  }

  if (type === 'toast' || type === 'notification' || type === 'alert') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
        {circle(Math.min(18, height * 0.35), type === 'alert')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {bar('38%', 4, true)}
          {bar('74%', 2)}
        </div>
        {type === 'toast' ? block(16, 16) : null}
      </div>
    )
  }

  if (type === 'stat') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {bar('28%', 2)}
        {bar('40%', Math.max(8, height * 0.12), true)}
        {bar('20%', 2)}
      </div>
    )
  }

  if (type === 'text' && text) {
    return (
      <div style={{ fontSize: Math.min(14, height * 0.22), lineHeight: 1.45, color: '#374151', wordBreak: 'break-word' }}>
        {text}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', height: '100%' }}>
      {bar(text ? '52%' : '44%', 4, true)}
      {Array.from({ length: lines }, (_, index) => (
        <div key={index}>{bar(`${65 + ((index * 13) % 25)}%`, 2)}</div>
      ))}
    </div>
  )
}

function renderCollectionSkeleton(type: ComponentType, width: number, height: number) {
  if (type === 'grid' || type === 'gallery' || type === 'team') {
    const columns = Math.max(2, Math.min(4, Math.floor(width / 120)))
    const rows = Math.max(1, Math.min(3, Math.floor(height / 110)))

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 6, height: '100%' }}>
        {Array.from({ length: columns * rows }, (_, index) => (
          <div key={index}>{block('100%', '100%')}</div>
        ))}
      </div>
    )
  }

  if (type === 'table' || type === 'calendar' || type === 'datePicker') {
    const columns = type === 'table' ? Math.max(2, Math.min(5, Math.floor(width / 100))) : 7
    const rows = type === 'table' ? Math.max(2, Math.min(5, Math.floor(height / 32))) : 5

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 4, height: '100%' }}>
        {Array.from({ length: columns * rows }, (_, index) => (
          <div key={index} style={{ minHeight: Math.max(16, height / (rows + 1)) }}>
            {block('100%', '100%', { background: index < columns ? '#e5e7eb' : 'rgba(255,255,255,0.4)' })}
          </div>
        ))}
      </div>
    )
  }

  const items = Math.max(3, Math.floor(height / 32))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', justifyContent: 'center' }}>
      {Array.from({ length: items }, (_, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {type === 'timeline' ? circle(8, index === 0) : circle(8)}
          <div style={{ flex: 1 }}>{bar(`${55 + ((index * 17) % 30)}%`, 2, index === 0)}</div>
        </div>
      ))}
    </div>
  )
}

function renderLayoutSkeleton(type: ComponentType, width: number, height: number) {
  if (type === 'navigation' || type === 'header' || type === 'banner') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
        {type === 'navigation' ? block(26, 18) : null}
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          {bar('22%', 3, true)}
          {bar('18%', 3)}
          {bar('16%', 3)}
        </div>
        {block(56, Math.min(24, height * 0.55))}
      </div>
    )
  }

  if (type === 'footer') {
    return (
      <div style={{ display: 'flex', gap: 14, height: '100%' }}>
        {Array.from({ length: Math.max(2, Math.min(4, Math.floor(width / 170))) }, (_, index) => (
          <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {bar('44%', 3, true)}
            {bar('72%', 2)}
            {bar('66%', 2)}
            {bar('54%', 2)}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'section' || type === 'hero' || type === 'cta') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, alignItems: type === 'hero' || type === 'cta' ? 'center' : 'flex-start' }}>
        {bar(type === 'section' ? '34%' : '52%', 4, true)}
        {bar(type === 'section' ? '72%' : '64%', 2)}
        {bar(type === 'section' ? '58%' : '46%', 2)}
        <div style={{ marginTop: 6 }}>{block(Math.min(120, width * 0.25), Math.min(32, height * 0.12), { background: '#d1d5db' })}</div>
      </div>
    )
  }

  if (type === 'sidebar' || type === 'drawer' || type === 'accordion' || type === 'faq') {
    return renderCollectionSkeleton('list', width, height)
  }

  if (type === 'modal' || type === 'popover') {
    return (
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #d1d5db' }}>
          {bar('34%', 4, true)}
          {block(14, 14)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10 }}>
          {bar('84%', 2)}
          {bar('68%', 2)}
          {bar('76%', 2)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          {block(70, 26)}
          {block(70, 26, { background: '#d1d5db' })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100%', height: 1, background: '#9ca3af' }} />
    </div>
  )
}

function renderControlSkeleton(type: ComponentType, width: number, height: number) {
  if (type === 'input' || type === 'search' || type === 'dropdown' || type === 'datePicker') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center', height: '100%' }}>
        {bar('24%', 2)}
        {block('100%', Math.min(34, height * 0.65), { display: 'flex', alignItems: 'center', padding: '0 8px' })}
      </div>
    )
  }

  if (type === 'form' || type === 'login' || type === 'contact') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', justifyContent: 'center' }}>
        {Array.from({ length: Math.max(2, Math.min(4, Math.floor(height / 68))) }, (_, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {bar('26%', 2)}
            {block('100%', 28)}
          </div>
        ))}
        {block(Math.min(120, width * 0.35), 30, { background: '#d1d5db', alignSelf: 'flex-end' })}
      </div>
    )
  }

  if (type === 'tabs' || type === 'stepper' || type === 'pagination' || type === 'breadcrumb') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
        {Array.from({ length: Math.max(3, Math.min(5, Math.floor(width / 90))) }, (_, index) => (
          <div key={index} style={{ flex: 1 }}>
            {type === 'stepper' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {circle(12, index === 0)}
                {index < 4 ? <div style={{ flex: 1, height: 1, background: '#9ca3af' }} /> : null}
              </div>
            ) : (
              block('100%', Math.min(28, height * 0.7), { background: index === 0 ? '#d1d5db' : 'rgba(255,255,255,0.6)' })
            )}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'toggle' || type === 'checkbox' || type === 'radio' || type === 'slider' || type === 'rating') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {type === 'toggle' ? block(Math.min(width, 48), Math.min(height, 24), { borderRadius: 999 }) : null}
        {type === 'checkbox' ? block(Math.min(width, 20), Math.min(height, 20)) : null}
        {type === 'radio' ? circle(Math.min(width, height)) : null}
        {type === 'slider' ? block('100%', Math.max(6, height * 0.2), { borderRadius: 999 }) : null}
        {type === 'rating'
          ? Array.from({ length: 5 }, (_, index) => <div key={index}>{circle(Math.min(14, height * 0.6), index < 3)}</div>)
          : null}
      </div>
    )
  }

  if (type === 'fileUpload') {
    return (
      <div style={{ height: '100%', border: '2px dashed #9ca3af', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {block(24, 24)}
        {bar('34%', 2)}
        {bar('20%', 2)}
      </div>
    )
  }

  return renderTextualSkeleton(type, height)
}

function renderMediaSkeleton(type: ComponentType, width: number, height: number) {
  if (type === 'image' || type === 'gallery' || type === 'video' || type === 'map') {
    return (
      <div style={{ position: 'relative', height: '100%', borderRadius: 6, border: '1px dashed #9ca3af', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" fill="none">
          <line x1="0" y1="0" x2={width} y2={height} stroke="#9ca3af" strokeWidth="1" />
          <line x1={width} y1="0" x2="0" y2={height} stroke="#9ca3af" strokeWidth="1" />
          {type === 'video' ? <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.12} fill="rgba(255,255,255,0.8)" stroke="#6b7280" /> : null}
        </svg>
      </div>
    )
  }

  if (type === 'chart') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 4, borderBottom: '1px solid #9ca3af' }}>
        {Array.from({ length: Math.max(3, Math.min(7, Math.floor(width / 50))) }, (_, index) => (
          <div key={index}>{block(Math.max(12, width / 18), `${35 + ((index * 17) % 40)}%`)}</div>
        ))}
      </div>
    )
  }

  if (type === 'codeBlock') {
    return (
      <div style={{ height: '100%', borderRadius: 6, border: '1px solid #9ca3af', background: 'rgba(255,255,255,0.75)', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', gap: 4 }}>{circle(6)}{circle(6)}{circle(6)}</div>
        {Array.from({ length: Math.max(3, Math.min(7, Math.floor(height / 22))) }, (_, index) => (
          <div key={index}>{bar(`${35 + ((index * 19) % 45)}%`, 2, index === 0)}</div>
        ))}
      </div>
    )
  }

  return renderCollectionSkeleton(type, width, height)
}

function renderBlockSkeleton(type: ComponentType, width: number, height: number) {
  if (type === 'card' || type === 'productCard' || type === 'pricing') {
    return (
      <div style={{ height: '100%', display: 'grid', gridTemplateRows: '44% 1fr', gap: 8 }}>
        {block('100%', '100%')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {bar('54%', 4, true)}
          {bar('36%', 2)}
          {bar('68%', 2)}
          <div style={{ flex: 1 }} />
          {block(Math.min(90, width * 0.35), 26, { background: '#d1d5db' })}
        </div>
      </div>
    )
  }

  if (type === 'profile' || type === 'avatar') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {circle(Math.min(42, height * 0.32))}
        {bar('38%', 4, true)}
        {bar('26%', 2)}
      </div>
    )
  }

  return renderTextualSkeleton(type, height)
}

function renderSkeleton(type: ComponentType, width: number, height: number, text?: string) {
  const visualType = resolveVisualType(type)

  if (['navigation', 'header', 'hero', 'section', 'sidebar', 'footer', 'modal', 'banner', 'drawer', 'popover', 'divider', 'cta'].includes(visualType)) {
    return renderLayoutSkeleton(visualType, width, height)
  }

  if (['button', 'input', 'search', 'form', 'tabs', 'dropdown', 'toggle', 'stepper', 'rating', 'fileUpload', 'checkbox', 'radio', 'slider', 'datePicker', 'pagination', 'breadcrumb'].includes(visualType)) {
    return renderControlSkeleton(visualType, width, height)
  }

  if (['image', 'video', 'table', 'grid', 'list', 'chart', 'codeBlock', 'map', 'timeline', 'calendar', 'accordion', 'carousel', 'logo', 'faq', 'gallery'].includes(visualType)) {
    return renderMediaSkeleton(visualType, width, height)
  }

  if (['card', 'pricing', 'testimonial', 'productCard', 'profile', 'feature', 'team', 'login', 'contact', 'avatar'].includes(visualType)) {
    return renderBlockSkeleton(visualType, width, height)
  }

  return renderTextualSkeleton(visualType, height, text)
}

export function WireframeBlock(props: WireframeBlockProps) {
  const {
    component,
    selected,
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
  const definition = COMPONENT_DEFINITIONS[component.type]

  useEffect(() => {
    setDraftName(component.name)
  }, [component.name, editing])

  const commit = (value: string) => {
    onCommitName?.(value.trim() || component.name)
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
        preview ? 'is-preview' : '',
        component.type === 'Modal' || component.type === 'modal' ? 'is-modal' : '',
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
          {renderSkeleton(component.type, component.width, component.height, component.name)}
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
