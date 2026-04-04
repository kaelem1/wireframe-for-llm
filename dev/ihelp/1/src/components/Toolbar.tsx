/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { ChangeEvent } from 'react'
import type { DeviceType } from '../types/schema'

interface ToolbarProps {
  projectName: string
  device: DeviceType
  onProjectNameChange: (name: string) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onTogglePreview: () => void
  onOpenAI: () => void
  onOpenSettings: () => void
}

export function Toolbar({
  projectName,
  device,
  onProjectNameChange,
  onExport,
  onImport,
  onTogglePreview,
  onOpenAI,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__group">
        <input
          className="toolbar__project-input"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          aria-label="项目名称"
        />
        <span className="toolbar__device">{device}</span>
      </div>
      <div className="toolbar__group">
        <label className="toolbar__button toolbar__button--ghost">
          导入 JSON
          <input type="file" accept=".json,application/json" hidden onChange={onImport} />
        </label>
        <button type="button" className="toolbar__button" onClick={onExport}>
          导出 JSON
        </button>
        <button type="button" className="toolbar__button" onClick={onOpenAI}>
          AI 生成
        </button>
        <button type="button" className="toolbar__button" onClick={onTogglePreview}>
          预览
        </button>
        <button type="button" className="toolbar__button toolbar__button--ghost" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </header>
  )
}
