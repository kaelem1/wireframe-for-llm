/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前在右栏同时承接单选交互编辑、多选批量操作与图层拖拽排序
3. 图层拖拽提供目标态反馈，文案统一为英文
4. 更新后检查所属 `.folder.md`
*/

import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { INTERACTION_ACTION_OPTIONS, INTERACTION_TRIGGER_OPTIONS } from '../utils/constants'
import { findComponentById, getBoardById } from '../utils/project'

export function InteractionPanel() {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const selectComponents = useAppStore((state) => state.selectComponents)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const deleteSelectedComponents = useAppStore((state) => state.deleteSelectedComponents)
  const addInteraction = useAppStore((state) => state.addInteraction)
  const setInteraction = useAppStore((state) => state.setInteraction)
  const removeInteraction = useAppStore((state) => state.removeInteraction)
  const reorderComponents = useAppStore((state) => state.reorderComponents)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

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
        <h2>Interactions</h2>
      </div>

      <div className="panel__editor">
        {selected ? (
          <>
            <label className="form-field">
              <span>Name</span>
              <input
                value={selected.name}
                onChange={(event) => updateComponent(selected.id, { name: event.target.value })}
              />
            </label>

            <div className="interaction-list">
              {selected.interactions.map((interaction) => (
                <div key={interaction.id} className="interaction-card">
                  <label className="form-field">
                    <span>Trigger</span>
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
                    <span>Action</span>
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
                      <span>Target</span>
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
                        <option value="">Select Board</option>
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
                      <span>Target</span>
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
                        <option value="">Select Modal</option>
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
                    Delete Interaction
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="ghost-button" onClick={() => addInteraction(selected.id)}>
              + Add Interaction
            </button>
          </>
        ) : isMultiSelect ? (
          <div className="panel__batch-state">
            <strong>{selectedComponentIds.length} selected</strong>
            <span>Batch actions are available for the current selection.</span>
            <div className="panel__batch-actions">
              <button type="button" className="ghost-button" onClick={deleteSelectedComponents}>
                Delete Selected
              </button>
              <button type="button" className="ghost-button" onClick={() => selectComponents([])}>
                Clear Selection
              </button>
            </div>
          </div>
        ) : (
          <div className="panel__empty">Select a component to edit its name, interactions, and layer order.</div>
        )}
      </div>

      <div className="panel__section panel__section--layers">
        <div className="panel__section-title">Layers</div>
        <div className="layer-list">
          {layeredComponents.map(({ component, boardIndex }) => (
            <button
              key={component.id}
              type="button"
              className={[
                'layer-item',
                selectedComponentIds.includes(component.id) ? 'is-active' : '',
                draggingId === component.id ? 'is-dragging' : '',
                dropTargetId === component.id ? 'is-drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onClick={() => selectComponent(component.id)}
              onDragStart={(event) => {
                setDraggingId(component.id)
                event.dataTransfer.setData('application/x-layer-id', component.id)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setDropTargetId(null)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDropTargetId(component.id)
              }}
              onDragLeave={() => {
                if (dropTargetId === component.id) {
                  setDropTargetId(null)
                }
              }}
              onDrop={(event) => {
                const fromId = event.dataTransfer.getData('application/x-layer-id')
                const fromIndex = board.components.findIndex((item) => item.id === fromId)
                setDraggingId(null)
                setDropTargetId(null)
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
