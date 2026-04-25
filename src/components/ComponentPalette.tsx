/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前渲染画布顶部居中的悬浮组件工具栏，以及左上角紧凑项目名输入
3. 当前按 COMPONENT_REGISTRY 直接渲染七类活跃入口，并提供 Select 入口清空待放置组件
4. 当前 pending 入口高亮，同类再次点击或 Select 都会清空 pending
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
  const toolbarItems = COMPONENT_REGISTRY.flatMap((section) => section.items)
  const selectLabel = locale === 'zh' ? '选择' : 'Select'
  const toolbarLabel = locale === 'zh' ? '组件工具栏' : 'Component toolbar'

  return (
    <>
      <div className="project-float">
        <input
          className="project-float__input"
          value={project?.project ?? ''}
          aria-label={t(locale, 'projectName')}
          onChange={(event) => setProjectName(event.target.value)}
        />
      </div>

      <div className="component-toolbar" role="toolbar" aria-label={toolbarLabel}>
        <button
          type="button"
          className={
            pendingComponentType === null
              ? 'component-toolbar__button component-toolbar__button--select is-active'
              : 'component-toolbar__button component-toolbar__button--select'
          }
          aria-label={selectLabel}
          aria-pressed={pendingComponentType === null}
          title={selectLabel}
          onClick={() => setPendingComponentType(null)}
        >
          {selectLabel}
        </button>

        {toolbarItems.map((item) => {
          const definition = COMPONENT_DEFINITIONS[item.type]
          const label = getLocalizedComponentLabel(
            locale,
            item.type,
            getLocalizedSectionLabel(locale, item.type) || definition.label,
          )
          const isActive = pendingComponentType === item.type

          return (
            <button
              key={item.type}
              type="button"
              className={isActive ? 'component-toolbar__button is-active' : 'component-toolbar__button'}
              aria-label={label}
              aria-pressed={isActive}
              title={label}
              onClick={() => setPendingComponentType(isActive ? null : item.type)}
            >
              {definition.icon}
            </button>
          )
        })}
      </div>
    </>
  )
}
