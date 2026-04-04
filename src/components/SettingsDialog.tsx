/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { createRestoreIframeHtml, generateRestoreCode } from '../utils/ai'
import { getBoardById } from '../utils/project'
import { useAppStore } from '../stores/appStore'
import { WireframeBlock } from './WireframeBlock'

interface SettingsDialogProps {
  open: boolean
}

export function SettingsDialog({ open }: SettingsDialogProps) {
  const project = useAppStore((state) => state.project)
  const activeBoardId = useAppStore((state) => state.activeBoardId)
  const settings = useAppStore((state) => state.settings)
  const restoreTestResult = useAppStore((state) => state.restoreTestResult)
  const setSettings = useAppStore((state) => state.setSettings)
  const setRestoreTestResult = useAppStore((state) => state.setRestoreTestResult)
  const setShowSettings = useAppStore((state) => state.setShowSettings)

  if (!open || !project) {
    return null
  }

  const board = (activeBoardId ? getBoardById(project, activeBoardId) : null) ?? project.boards[0]

  const runRestoreTest = async () => {
    setRestoreTestResult({
      status: 'loading',
      code: '',
      html: '',
      error: null,
    })

    try {
      const code = await generateRestoreCode(settings, project)
      setRestoreTestResult({
        status: 'done',
        code,
        html: createRestoreIframeHtml(code),
        error: null,
      })
    } catch (error) {
      setRestoreTestResult({
        status: 'error',
        code: '',
        html: '',
        error: error instanceof Error ? error.message : 'AI 还原测试失败',
      })
    }
  }

  return (
    <div className="overlay">
      <div className="dialog dialog--wide dialog--settings">
        <div className="dialog__header">
          <h2>设置</h2>
          <button type="button" className="dialog__close" onClick={() => setShowSettings(false)}>
            关闭
          </button>
        </div>

        <div className="settings-grid">
          <label className="form-field">
            <span>Base URL</span>
            <input
              value={settings.baseUrl}
              onChange={(event) => setSettings({ baseUrl: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>API Key</span>
            <input
              value={settings.apiKey}
              type="password"
              onChange={(event) => setSettings({ apiKey: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>模型</span>
            <input value={settings.model} onChange={(event) => setSettings({ model: event.target.value })} />
          </label>
        </div>

        <div className="dialog__actions">
          <button type="button" className="dialog__primary" onClick={runRestoreTest}>
            运行 AI 还原测试
          </button>
        </div>

        {restoreTestResult.error ? <p className="form-error">{restoreTestResult.error}</p> : null}

        {restoreTestResult.status === 'loading' ? <p className="panel__empty">正在请求 AI...</p> : null}

        {restoreTestResult.status === 'done' && board ? (
          <div className="restore-test">
            <div className="restore-test__pane">
              <div className="restore-test__title">原始版本</div>
              <div className="restore-test__device" style={{ width: project.boardSize.width, height: project.boardSize.height }}>
                {board.components.map((component) => (
                  <WireframeBlock key={component.id} component={component} preview />
                ))}
              </div>
            </div>

            <div className="restore-test__pane">
              <div className="restore-test__title">AI 生成版本</div>
              <iframe title="AI 还原测试" srcDoc={restoreTestResult.html} className="restore-test__iframe" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
