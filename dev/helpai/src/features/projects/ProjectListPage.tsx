/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { useMemo, useRef, useState } from 'react'

import { DEVICE_GROUPS, DEVICE_PRESETS } from '../../data/devices'
import { downloadTextFile } from '../../lib/storage'
import { useAppStore } from '../../store/useAppStore'
import type { DevicePreset, DeviceType } from '../../types/prototype'

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function DeviceGrid(props: {
  title: string
  type: DeviceType
  selectedPresetId: string
  onSelect: (preset: DevicePreset) => void
}) {
  const presets = DEVICE_PRESETS.filter((preset) => preset.deviceType === props.type)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{props.title}</h3>
        <span className="text-xs text-slate-400">{presets.length} 个预设</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {presets.map((preset) => {
          const isSelected = preset.id === props.selectedPresetId

          return (
            <button
              key={preset.id}
              type="button"
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                isSelected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-panel'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
              }`}
              onClick={() => props.onSelect(preset)}
            >
              <div className="text-sm font-semibold">{preset.label}</div>
              <div
                className={`mt-2 text-xs ${
                  isSelected ? 'text-slate-200' : 'text-slate-500'
                }`}
              >
                {preset.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CreateProjectDialog(props: { onClose: () => void }) {
  const createProject = useAppStore((state) => state.createProject)
  const [name, setName] = useState('MyApp')
  const [selectedPresetId, setSelectedPresetId] = useState('iphone-15')
  const [isCustom, setIsCustom] = useState(false)
  const [customWidth, setCustomWidth] = useState(393)
  const [customHeight, setCustomHeight] = useState(852)

  const selectedPreset =
    DEVICE_PRESETS.find((preset) => preset.id === selectedPresetId) ?? DEVICE_PRESETS[0]!

  const handleCreate = () => {
    const artboardSize = isCustom
      ? {
          width: Math.max(240, customWidth),
          height: Math.max(320, customHeight),
        }
      : selectedPreset.size

    createProject({
      name,
      deviceType: isCustom ? 'custom' : selectedPreset.deviceType,
      artboardSize,
    })

    props.onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">创建新项目</h2>
            <p className="mt-1 text-sm text-slate-500">
              先确定设备尺寸，后续所有新画板都会继承这个尺寸。
            </p>
          </div>
          <button className="secondary-button" type="button" onClick={props.onClose}>
            关闭
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="panel space-y-4">
            <label className="space-y-2">
              <span className="field-label">项目名称</span>
              <input
                className="text-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：MyApp"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                checked={!isCustom}
                type="radio"
                name="device-mode"
                onChange={() => setIsCustom(false)}
              />
              使用预设设备
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                checked={isCustom}
                type="radio"
                name="device-mode"
                onChange={() => setIsCustom(true)}
              />
              使用自定义尺寸
            </label>

            {isCustom ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="field-label">宽度</span>
                  <input
                    className="text-input"
                    min={240}
                    type="number"
                    value={customWidth}
                    onChange={(event) => setCustomWidth(Number(event.target.value || 0))}
                  />
                </label>
                <label className="space-y-2">
                  <span className="field-label">高度</span>
                  <input
                    className="text-input"
                    min={320}
                    type="number"
                    value={customHeight}
                    onChange={(event) => setCustomHeight(Number(event.target.value || 0))}
                  />
                </label>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                当前尺寸：{selectedPreset.label} · {selectedPreset.size.width} ×{' '}
                {selectedPreset.size.height}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {DEVICE_GROUPS.map((group) => (
              <DeviceGrid
                key={group.type}
                title={group.label}
                type={group.type}
                selectedPresetId={selectedPresetId}
                onSelect={(preset) => {
                  setSelectedPresetId(preset.id)
                  setIsCustom(false)
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="secondary-button" type="button" onClick={props.onClose}>
            取消
          </button>
          <button className="primary-button" type="button" onClick={handleCreate}>
            创建项目
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProjectListPage() {
  const projects = useAppStore((state) => state.projects)
  const openProject = useAppStore((state) => state.openProject)
  const duplicateProject = useAppStore((state) => state.duplicateProject)
  const deleteProject = useAppStore((state) => state.deleteProject)
  const exportProject = useAppStore((state) => state.exportProject)
  const importProject = useAppStore((state) => state.importProject)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const importRef = useRef<HTMLInputElement | null>(null)

  const orderedProjects = useMemo(
    () =>
      [...projects].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [projects],
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f5_65%)] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="panel flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              HelpAI
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950">
                低保真原型设计工具
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                以固定画板为中心，支持多屏原型、交互导航、SiliconFlow AI
                生成、AI 导出和对齐验证。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
              创建新项目
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => importRef.current?.click()}
            >
              导入项目 JSON
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedProjects.length === 0 ? (
            <div className="panel col-span-full flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-400">
                Empty Workspace
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">还没有任何项目</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                从一个设备尺寸开始，创建第一块画板，然后逐步搭建页面与交互。
              </p>
              <button
                className="primary-button mt-6"
                type="button"
                onClick={() => setIsCreateOpen(true)}
              >
                创建第一个项目
              </button>
            </div>
          ) : (
            orderedProjects.map((project) => (
              <article key={project.id} className="panel space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {project.artboardSize.width} × {project.artboardSize.height} ·{' '}
                      {project.boards.length} 个画板
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {project.deviceType}
                  </span>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  最新更新时间：{formatDate(project.updatedAt)}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => openProject(project.id)}
                  >
                    打开
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => duplicateProject(project.id)}
                  >
                    复制
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      downloadTextFile(`${project.name}.json`, exportProject(project.id), 'application/json')
                    }
                  >
                    导出
                  </button>
                  <button
                    className="secondary-button text-red-600 hover:border-red-300 hover:text-red-700"
                    type="button"
                    onClick={() => deleteProject(project.id)}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <input
        ref={importRef}
        accept=".json,application/json"
        className="hidden"
        type="file"
        onChange={async (event) => {
          const file = event.target.files?.[0]

          if (!file) {
            return
          }

          try {
            const content = await file.text()
            importProject(content)
          } catch (error) {
            window.alert(error instanceof Error ? error.message : '导入失败。')
          } finally {
            event.target.value = ''
          }
        }}
      />

      {isCreateOpen ? <CreateProjectDialog onClose={() => setIsCreateOpen(false)} /> : null}
    </div>
  )
}
