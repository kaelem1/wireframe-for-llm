/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

interface ToolbarProps {
  projectName: string
  deviceLabel: string
  boardSizeLabel: string
  isPreview: boolean
  onProjectNameChange: (value: string) => void
  onExport: () => void
  onImport: () => void
  onOpenAI: () => void
  onTogglePreview: () => void
  onOpenSettings: () => void
}

export function Toolbar(props: ToolbarProps) {
  const {
    projectName,
    deviceLabel,
    boardSizeLabel,
    isPreview,
    onProjectNameChange,
    onExport,
    onImport,
    onOpenAI,
    onTogglePreview,
    onOpenSettings,
  } = props

  return (
    <header className="toolbar">
      <div className="toolbar__identity">
        <input
          className="toolbar__project-name"
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          aria-label="项目名称"
        />
        <div className="toolbar__device">
          <span>{deviceLabel}</span>
          <span>{boardSizeLabel}</span>
        </div>
      </div>

      <div className="toolbar__actions">
        <button type="button" className="toolbar__button" onClick={onExport}>
          导出 JSON
        </button>
        <button type="button" className="toolbar__button" onClick={onImport}>
          导入 JSON
        </button>
        <button type="button" className="toolbar__button" onClick={onOpenAI}>
          AI 生成
        </button>
        <button type="button" className="toolbar__button toolbar__button--primary" onClick={onTogglePreview}>
          {isPreview ? '退出预览' : '预览'}
        </button>
        <button type="button" className="toolbar__button" onClick={onOpenSettings}>
          设置
        </button>
      </div>
    </header>
  )
}
