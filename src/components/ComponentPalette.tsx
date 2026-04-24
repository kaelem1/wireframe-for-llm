/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前左栏仅保留项目名直排与双语组件网格，移除 purpose、新建页、底栏操作与 eyebrow 容器
3. 当前按 COMPONENT_REGISTRY 直接渲染分组与等宽网格项，不再置顶或特殊处理任一组件
4. 当前保持待放置组件持续选中
5. 更新后检查所属 `.folder.md`
*/

import { COMPONENT_DEFINITIONS, COMPONENT_REGISTRY } from '../utils/constants'
import { useAppStore } from '../stores/appStore'
import { getLocalizedComponentLabel, getLocalizedSectionLabel, t } from '../utils/i18n'

export function ComponentPalette() {
  const locale = useAppStore((state) => state.locale)
  const project = useAppStore((state) => state.project)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const setProjectName = useAppStore((state) => state.setProjectName)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const groupedSections = COMPONENT_REGISTRY.filter((section) => section.items.length > 0)

  return (
    <div className="panel panel--palette">
      <input
        className="panel__project-name"
        value={project?.project ?? ''}
        aria-label={t(locale, 'projectName')}
        onChange={(event) => setProjectName(event.target.value)}
      />

      <div className="component-palette">
        {groupedSections.map((section) => (
          <section key={section.section} className="component-palette__section">
            <div className="component-palette__section-title">
              {getLocalizedSectionLabel(locale, section.section) || section.section}
            </div>
            <div className="component-palette__grid">
              {section.items.map((item) => {
                const definition = COMPONENT_DEFINITIONS[item.type]
                const isActive = pendingComponentType === item.type

                return (
                  <button
                    key={item.type}
                    type="button"
                    className={isActive ? 'component-palette__item is-active' : 'component-palette__item'}
                    onClick={() => setPendingComponentType(isActive ? null : item.type)}
                  >
                    <span className="component-palette__label">
                      {getLocalizedComponentLabel(locale, item.type, definition.label)}
                    </span>
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
