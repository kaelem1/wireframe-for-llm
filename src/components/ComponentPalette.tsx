/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前点击组件进入待放置状态，不再直接落板
3. 更新后检查所属 `.folder.md`
*/

import { COMPONENT_ORDER, COMPONENT_DEFINITIONS } from '../utils/constants'
import { useAppStore } from '../stores/appStore'

export function ComponentPalette() {
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)

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
              className={
                pendingComponentType === type
                  ? 'component-palette__item is-active'
                  : 'component-palette__item'
              }
              onClick={() =>
                setPendingComponentType(pendingComponentType === type ? null : type)
              }
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
