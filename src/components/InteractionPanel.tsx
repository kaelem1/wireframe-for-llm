/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前在右栏同时承接单选交互编辑与图层拖拽排序
3. 更新后检查所属 `.folder.md`
*/

import { useAppStore } from '../stores/appStore'
import { INTERACTION_ACTION_OPTIONS, INTERACTION_TRIGGER_OPTIONS } from '../utils/constants'
import { findComponentById, getBoardById } from '../utils/project'

export function InteractionPanel() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const addInteraction = useAppStore((state) => state.addInteraction)
  const setInteraction = useAppStore((state) => state.setInteraction)
  const removeInteraction = useAppStore((state) => state.removeInteraction)
  const reorderComponents = useAppStore((state) => state.reorderComponents)

  if (!project || !activeBoardId) {
    return null
  }

  const board = getBoardById(project, activeBoardId)
  const isMultiSelect = selectedComponentIds.length > 1
  const selected =
    !isMultiSelect && selectedComponentId ? findComponentById(project, selectedComponentId)?.component : null

  if (!board) {
    return null
  }

  const layeredComponents = board.components
    .map((component, boardIndex) => ({ component, boardIndex }))
    .reverse()

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>交互</h2>
      </div>

      <div className="panel__editor">
        {selected ? (
          <>
            <label className="form-field">
              <span>名称</span>
              <input
                value={selected.name}
                onChange={(event) => updateComponent(selected.id, { name: event.target.value })}
              />
            </label>

            <div className="interaction-list">
              {selected.interactions.map((interaction) => (
                <div key={interaction.id} className="interaction-card">
                  <label className="form-field">
                    <span>触发方式</span>
                    <select
                      value={interaction.trigger}
                      onChange={(event) =>
                        setInteraction(selected.id, interaction.id, {
                          trigger: event.target.value as typeof interaction.trigger,
                          action: interaction.action,
                          target: interaction.target,
                        })
                      }
                    >
                      {INTERACTION_TRIGGER_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>动作</span>
                    <select
                      value={interaction.action}
                      onChange={(event) =>
                        setInteraction(selected.id, interaction.id, {
                          trigger: interaction.trigger,
                          action: event.target.value as typeof interaction.action,
                          target: interaction.target,
                        })
                      }
                    >
                      {INTERACTION_ACTION_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {interaction.action === 'navigate' ? (
                    <label className="form-field">
                      <span>目标</span>
                      <select
                        value={interaction.target ?? ''}
                        onChange={(event) =>
                          setInteraction(selected.id, interaction.id, {
                            trigger: interaction.trigger,
                            action: interaction.action,
                            target: event.target.value,
                          })
                        }
                      >
                        <option value="">请选择画板</option>
                        {project.boards.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {interaction.action === 'showModal' ? (
                    <label className="form-field">
                      <span>目标</span>
                      <select
                        value={interaction.target ?? ''}
                        onChange={(event) =>
                          setInteraction(selected.id, interaction.id, {
                            trigger: interaction.trigger,
                            action: interaction.action,
                            target: event.target.value,
                          })
                        }
                      >
                        <option value="">请选择弹窗</option>
                        {board.components
                          .filter((item) => item.type === 'Modal')
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeInteraction(selected.id, interaction.id)}
                  >
                    删除交互
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="ghost-button" onClick={() => addInteraction(selected.id)}>
              + 添加交互
            </button>
          </>
        ) : (
          <div className="panel__empty">
            {isMultiSelect ? `已框选 ${selectedComponentIds.length} 个组件，交互编辑仅支持单选。` : '选中组件后可编辑名称、交互和图层顺序。'}
          </div>
        )}
      </div>

      <div className="panel__section panel__section--layers">
        <div className="panel__section-title">图层</div>
        <div className="layer-list">
          {layeredComponents.map(({ component, boardIndex }) => (
            <button
              key={component.id}
              type="button"
              className={selectedComponentIds.includes(component.id) ? 'layer-item is-active' : 'layer-item'}
              draggable
              onClick={() => selectComponent(component.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-layer-id', component.id)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const fromId = event.dataTransfer.getData('application/x-layer-id')
                const fromIndex = board.components.findIndex((item) => item.id === fromId)
                if (fromIndex >= 0) {
                  reorderComponents(board.id, fromIndex, boardIndex)
                }
              }}
            >
              <span>{component.name}</span>
              <small>{component.type}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
