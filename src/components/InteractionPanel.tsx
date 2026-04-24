/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前在右栏同时承接导出/复制/GitHub logo 跳转、单选交互编辑、描述与属性编辑、多选批量操作与图层拖拽排序，交互编辑区独立滚动、图层区保持常驻可见
3. 图层拖拽提供目标态反馈与左侧 grip 提示，文案跟随 locale 切换
4. showModal 交互改为直接编辑弹窗描述，不再选择 modal 组件
5. 当前自动滚动到最近选中的图层，重复点击已选图层保持幂等
6. 图层列表只保留主名称，不再显示类型副标题；复制/导出 JSON 成功 toast 由上层壳容器展示
7. 更新后检查所属 `.folder.md`
*/

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { COMPONENT_DEFINITIONS, INTERACTION_ACTION_OPTIONS, INTERACTION_TRIGGER_OPTIONS } from '../utils/constants'
import { getLocalizedComponentLabel, t } from '../utils/i18n'
import { downloadJson, findComponentById, getBoardById } from '../utils/project'
import type { ComponentType } from '../types/schema'

const componentTypeOptions = Object.values(COMPONENT_DEFINITIONS)

type InteractionPanelProps = {
  onCopyJson?: (jsonText: string) => Promise<void>
  onExportJson?: (jsonText: string) => void
}

export function InteractionPanel({ onCopyJson, onExportJson }: InteractionPanelProps) {
  const locale = useAppStore((state) => state.locale)
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const selectedComponentId = useAppStore((state) => state.selectedComponentId)
  const selectedComponentIds = useAppStore((state) => state.selectedComponentIds)
  const selectComponent = useAppStore((state) => state.selectComponent)
  const selectComponents = useAppStore((state) => state.selectComponents)
  const updateComponent = useAppStore((state) => state.updateComponent)
  const exportProject = useAppStore((state) => state.exportProjectJson)
  const deleteSelectedComponents = useAppStore((state) => state.deleteSelectedComponents)
  const addInteraction = useAppStore((state) => state.addInteraction)
  const setInteraction = useAppStore((state) => state.setInteraction)
  const removeInteraction = useAppStore((state) => state.removeInteraction)
  const reorderComponents = useAppStore((state) => state.reorderComponents)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const layerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lastSelectedLayerId = selectedComponentIds.at(-1) ?? selectedComponentId

  useEffect(() => {
    if (!lastSelectedLayerId) {
      return
    }

    layerRefs.current[lastSelectedLayerId]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [lastSelectedLayerId, activeBoardId])

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
      <div className="panel__export-actions">
        <button
          type="button"
          className="ghost-button panel__export-button"
          onClick={() => {
            const jsonText = exportProject()
            downloadJson(
              `${project.project || t(locale, 'defaultProjectName')}.json`,
              JSON.parse(jsonText),
            )
            onExportJson?.(jsonText)
          }}
        >
          {t(locale, 'exportJson')}
        </button>
        <button
          type="button"
          className="ghost-button panel__copy-button"
          onClick={() => {
            const jsonText = exportProject()
            void (onCopyJson?.(jsonText) ?? navigator.clipboard.writeText(jsonText))
          }}
        >
          {t(locale, 'copyJson')}
        </button>
        <button
          type="button"
          className="ghost-button panel__github-button"
          aria-label="GitHub"
          title="GitHub"
          onClick={() => {
            window.open('https://github.com/kaelem1/wireframe-for-llm', '_blank', 'noopener,noreferrer')
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.757-.234.757-.523 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.292-1.127-1.553-.385-.206-.936-.715-.014-.729.866-.014 1.484.797 1.691 1.128.963 1.636 2.447 1.183 3.039.894.096-.701.371-1.183.674-1.457-2.447-.275-5.005-1.223-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.872.124 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.653-.014 3.025 0 .289.206.633.756.523A11.008 11.008 0 0 0 23 12C23 5.923 18.077 1 12 1Z" />
          </svg>
        </button>
      </div>

      <div className="panel__section">
        <div className="panel__header panel__header--section">
          <h2 className="panel__title">{t(locale, 'interactions')}</h2>
        </div>

        <div className="panel__editor">
          {selected ? (
            <>
              <label className="form-field">
                <span>{t(locale, 'name')}</span>
                <input
                  value={selected.name}
                  onChange={(event) => updateComponent(selected.id, { name: event.target.value })}
                />
              </label>

              <label className="form-field">
                <span>{t(locale, 'description')}</span>
                <textarea
                  rows={3}
                  value={selected.description ?? ''}
                  onChange={(event) => updateComponent(selected.id, { description: event.target.value })}
                />
              </label>

              <div className="interaction-list">
                {selected.interactions.map((interaction) => (
                  <div key={interaction.id} className="interaction-card">
                    <label className="form-field">
                      <span>{t(locale, 'trigger')}</span>
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
                            {t(locale, item.value)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>{t(locale, 'action')}</span>
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
                            {t(locale, item.value)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {interaction.action === 'navigate' ? (
                      <label className="form-field">
                        <span>{t(locale, 'target')}</span>
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
                          <option value="">{t(locale, 'selectBoard')}</option>
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
                        <span>{t(locale, 'modalContent')}</span>
                        <textarea
                          rows={3}
                          value={interaction.target ?? ''}
                          onChange={(event) =>
                            setInteraction(selected.id, interaction.id, {
                              trigger: interaction.trigger,
                              action: interaction.action,
                              target: event.target.value,
                            })
                          }
                          placeholder={t(locale, 'modalContentPlaceholder')}
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeInteraction(selected.id, interaction.id)}
                    >
                      {t(locale, 'deleteInteraction')}
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="ghost-button" onClick={() => addInteraction(selected.id)}>
                {t(locale, 'addInteraction')}
              </button>

              <label className="form-field">
                <span>{t(locale, 'attributes')}</span>
                <select
                  value={selected.type}
                  onChange={(event) =>
                    updateComponent(selected.id, {
                      type: event.target.value as ComponentType,
                    })
                  }
                >
                  {componentTypeOptions.map((item) => (
                    <option key={item.type} value={item.type}>
                      {getLocalizedComponentLabel(locale, item.type, item.label)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : isMultiSelect ? (
            <div className="panel__batch-state">
              <strong>{t(locale, 'selectedCount', { count: selectedComponentIds.length })}</strong>
              <span>{t(locale, 'batchActionsHint')}</span>
              <div className="panel__batch-actions">
                <button type="button" className="ghost-button" onClick={deleteSelectedComponents}>
                  {t(locale, 'deleteSelected')}
                </button>
                <button type="button" className="ghost-button" onClick={() => selectComponents([])}>
                  {t(locale, 'clearSelection')}
                </button>
              </div>
            </div>
          ) : (
            <div className="panel__empty">{t(locale, 'emptyInspector')}</div>
          )}
        </div>
      </div>

      <div className="panel__section panel__section--layers">
        <div className="panel__header panel__header--section">
          <h2 className="panel__title">{t(locale, 'layers')}</h2>
        </div>
        <div className="layer-list">
          {layeredComponents.map(({ component, boardIndex }) => (
            <button
              key={component.id}
              ref={(node) => {
                layerRefs.current[component.id] = node
              }}
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
              onClick={() => {
                if (selectedComponentIds.length === 1 && selectedComponentIds[0] === component.id) {
                  return
                }
                selectComponent(component.id)
              }}
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
              <span className="layer-item__grip" aria-hidden="true" />
              <span className="layer-item__name">{component.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
