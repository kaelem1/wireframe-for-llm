/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前左栏对齐 Agentation 的 wireframe palette 结构与模式控件
3. 当前按 ComponentCatalogItem 渲染分组项
4. 更新后检查所属 `.folder.md`
*/

import { COMPONENT_DEFINITIONS, COMPONENT_REGISTRY } from '../utils/constants'
import { useAppStore } from '../stores/appStore'

export function ComponentPalette() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const pendingComponentType = useAppStore((state) => state.pendingComponentType)
  const wireframe = useAppStore((state) => state.wireframe)
  const setPendingComponentType = useAppStore((state) => state.setPendingComponentType)
  const setWireframeMode = useAppStore((state) => state.setWireframeMode)
  const startWireframePage = useAppStore((state) => state.startWireframePage)
  const clearActiveBoardComponents = useAppStore((state) => state.clearActiveBoardComponents)
  const setWireframePurpose = useAppStore((state) => state.setWireframePurpose)
  const setWireframeOpacity = useAppStore((state) => state.setWireframeOpacity)

  const activeBoard =
    project && activeBoardId ? project.boards.find((board) => board.id === activeBoardId) ?? null : null
  const placedCount = activeBoard?.components.length ?? 0

  return (
    <div className="panel panel--palette">
      <div className="panel__header panel__header--palette">
        <div>
          <div className="panel__eyebrow">Layout mode</div>
          <h2>Wireframe</h2>
        </div>
        <button
          type="button"
          className={wireframe.enabled ? 'palette-toggle is-active' : 'palette-toggle'}
          onClick={() => setWireframeMode(!wireframe.enabled)}
        >
          {wireframe.enabled ? 'On' : 'Off'}
        </button>
      </div>

      <button type="button" className="palette-mode-button" onClick={startWireframePage}>
        Wireframe New Page
      </button>

      <label className="form-field">
        <span>Purpose</span>
        <textarea
          rows={3}
          value={wireframe.purpose}
          placeholder="What is this page for?"
          onChange={(event) => setWireframePurpose(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Canvas Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={wireframe.opacity}
          onChange={(event) => setWireframeOpacity(Number(event.target.value))}
        />
      </label>

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
                    <span className="component-palette__icon">{definition.icon}</span>
                    <span className="component-palette__meta">
                      <strong>{definition.label}</strong>
                      <small>
                        {definition.defaultWidth} × {definition.defaultHeight}
                      </small>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="palette-footer">
        <div className="palette-footer__count">{placedCount} placed</div>
        <button type="button" className="ghost-button" onClick={clearActiveBoardComponents}>
          Clear
        </button>
      </div>
    </div>
  )
}
