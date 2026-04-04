/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { generateProjectFromPrompt } from '../utils/ai'
import { parseProjectJson } from '../utils/project'

interface AIGeneratorDialogProps {
  open: boolean
}

export function AIGeneratorDialog({ open }: AIGeneratorDialogProps) {
  const [prompt, setPrompt] = useState('')
  const project = useAppStore((state) => state.project)
  const settings = useAppStore((state) => state.settings)
  const generation = useAppStore((state) => state.generation)
  const setGenerationState = useAppStore((state) => state.setGenerationState)
  const replaceBoardsFromAI = useAppStore((state) => state.replaceBoardsFromAI)
  const setShowAI = useAppStore((state) => state.setShowAI)

  if (!open || !project) {
    return null
  }

  const handleGenerate = async () => {
    setGenerationState({ status: 'loading', error: null })

    try {
      const generated = await generateProjectFromPrompt(settings, prompt, project)
      replaceBoardsFromAI(parseProjectJson(generated))
      setGenerationState({ status: 'idle', error: null })
      setShowAI(false)
      setPrompt('')
    } catch (error) {
      setGenerationState({
        status: 'error',
        error: error instanceof Error ? error.message : 'AI 生成失败',
      })
    }
  }

  return (
    <div className="overlay">
      <div className="dialog dialog--wide">
        <div className="dialog__header">
          <h2>AI 生成</h2>
          <button type="button" className="dialog__close" onClick={() => setShowAI(false)}>
            关闭
          </button>
        </div>

        <label className="form-field">
          <span>描述页面或流程</span>
          <textarea
            rows={10}
            value={prompt}
            placeholder="例如：创建一个含首页、登录页和设置页的移动应用，首页包含顶部导航栏、图片、卡片、列表和底部标签栏。"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>

        {generation.error ? <p className="form-error">{generation.error}</p> : null}

        <div className="dialog__actions">
          <button type="button" className="toolbar__button" onClick={() => setShowAI(false)}>
            取消
          </button>
          <button
            type="button"
            className="dialog__primary"
            disabled={!prompt.trim() || generation.status === 'loading'}
            onClick={handleGenerate}
          >
            {generation.status === 'loading' ? '生成中...' : '生成画板'}
          </button>
        </div>
      </div>
    </div>
  )
}
