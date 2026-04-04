/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { ComponentType } from '../types/schema'
import { COMPONENT_META } from '../utils/catalog'

interface ComponentLibraryProps {
  onAdd: (type: ComponentType) => void
}

export function ComponentLibrary({ onAdd }: ComponentLibraryProps) {
  const components = Object.values(COMPONENT_META)

  return (
    <aside className="sidebar sidebar--left">
      <div className="panel-title">组件</div>
      <div className="component-library">
        {components.map((item) => (
          <button
            key={item.type}
            type="button"
            className="component-library__item"
            draggable
            onClick={() => onAdd(item.type)}
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-component-type', item.type)
              event.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span className="component-library__icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}
