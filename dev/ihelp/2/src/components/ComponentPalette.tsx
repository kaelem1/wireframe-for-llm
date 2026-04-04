/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { COMPONENT_ORDER, COMPONENT_DEFINITIONS } from '../utils/constants'
import { useAppStore } from '../stores/appStore'

export function ComponentPalette() {
  const addComponent = useAppStore((state) => state.addComponent)

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>组件</h2>
      </div>
      <div className="component-palette">
        {COMPONENT_ORDER.map((type) => {
          const definition = COMPONENT_DEFINITIONS[type]

          return (
            <button
              key={type}
              type="button"
              className="component-palette__item"
              draggable
              onClick={() => addComponent(type)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData('application/x-wireframe-component', type)
              }}
            >
              <span className="component-palette__icon">{definition.icon}</span>
              <span>{definition.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
