/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useMemo, useState } from 'react'
import type { DeviceType } from '../types/schema'
import { DEVICE_PRESETS } from '../utils/catalog'

interface CreateProjectDialogProps {
  onCreate: (payload: {
    projectName: string
    device: DeviceType
    boardSize: { width: number; height: number }
  }) => void
}

export function CreateProjectDialog({ onCreate }: CreateProjectDialogProps) {
  const [projectName, setProjectName] = useState('我的应用')
  const [device, setDevice] = useState<DeviceType>('iPhone')
  const [customWidth, setCustomWidth] = useState('390')
  const [customHeight, setCustomHeight] = useState('844')

  const boardSize = useMemo(() => {
    if (device === 'Custom') {
      return {
        width: Number(customWidth) || 390,
        height: Number(customHeight) || 844,
      }
    }
    const preset = DEVICE_PRESETS.find((item) => item.id === device)
    if (!preset) {
      throw new Error(`Unknown device preset: ${device}`)
    }
    return { width: preset.width, height: preset.height }
  }, [customHeight, customWidth, device])

  return (
    <div className="modal-shell">
      <div className="dialog">
        <div className="dialog__title">新建项目</div>
        <label className="field">
          <span>项目名称</span>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <div className="field">
          <span>设备预设</span>
          <div className="device-grid">
            {DEVICE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`device-pill ${device === preset.id ? 'device-pill--active' : ''}`}
                onClick={() => setDevice(preset.id)}
              >
                {preset.label}
                <small>
                  {preset.width}×{preset.height}
                </small>
              </button>
            ))}
          </div>
        </div>
        {device === 'Custom' ? (
          <div className="field field--row">
            <label>
              <span>宽</span>
              <input value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} />
            </label>
            <label>
              <span>高</span>
              <input value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} />
            </label>
          </div>
        ) : null}
        <button
          type="button"
          className="primary-button"
          onClick={() => onCreate({ projectName, device, boardSize })}
        >
          创建项目
        </button>
      </div>
    </div>
  )
}
