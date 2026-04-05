/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前左栏仅保留项目名与组件网格，移除 purpose、新建页与底栏操作
3. 当前按 ComponentCatalogItem 渲染等宽网格项，并保持待放置组件持续选中
4. 更新后检查所属 `.folder.md`
*/

import { COMPONENT_DEFINITIONS, COMPONENT_REGISTRY } from '../utils/constants'
import { useAppStore } from '../stores/appStore'

export function ComponentPalette() {
  const project = useAppStore((state) => state.project)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const setProjectName = useAppStore((state) => state.setProjectName)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)

  return (
    <div className="panel panel--palette">
      <div className="panel__header panel__header--palette">
        <div className="panel__eyebrow">
          <input
            className="panel__project-name"
            value={project?.project ?? ''}
            aria-label="项目名称"
            onChange={(event) => setProjectName(event.target.value)}
          />
        </div>
      </div>

      <div className="component-palette">
        {COMPONENT_REGISTRY.map((section) => (
          <section key={section.section} className="component-palette__section">
            <div className="component-palette__section-title">{section.section}</div>
            <div className="component-palette__grid">
              {section.items.map((item) => {
                const definition = COMPONENT_DEFINITIONS[item.type]

                return (
                  <button
                    key={item.type}
                    type="button"
                    className={
                      pendingComponentType === item.type
                        ? 'component-palette__item is-active'
                        : 'component-palette__item'
                    }
                    onClick={() =>
                      setPendingComponentType(pendingComponentType === item.type ? null : item.type)
                    }
                  >
                    <span className="component-palette__label">{definition.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
