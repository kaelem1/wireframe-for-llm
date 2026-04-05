/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前顶部只保留设备、导入导出与预览动作，不再承接项目名输入
3. 更新后检查所属 `.folder.md`
*/

interface ToolbarProps {
  deviceLabel: string
  boardSizeLabel: string
  isPreview: boolean
  onExport: () => void
  onImport: () => void
  onTogglePreview: () => void
}

export function Toolbar(props: ToolbarProps) {
  const {
    deviceLabel,
    boardSizeLabel,
    isPreview,
    onExport,
    onImport,
    onTogglePreview,
  } = props

  return (
    <header className="toolbar">
      <div className="toolbar__identity">
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
        <button type="button" className="toolbar__button toolbar__button--primary" onClick={onTogglePreview}>
          {isPreview ? '退出预览' : '预览'}
        </button>
      </div>
    </header>
  )
}
