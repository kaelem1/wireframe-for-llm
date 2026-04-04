/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { useMemo, useState } from 'react'
import { DEFAULT_PROJECT_NAME, DEVICE_PRESETS } from '../utils/constants'
import type { DevicePresetKey } from '../types/schema'

interface SetupDialogProps {
  onCreate: (projectName: string, device: DevicePresetKey, width: number, height: number) => void
}

export function SetupDialog({ onCreate }: SetupDialogProps) {
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME)
  const [device, setDevice] = useState<DevicePresetKey>('iPhone')
  const [customWidth, setCustomWidth] = useState('390')
  const [customHeight, setCustomHeight] = useState('844')

  const preset = useMemo(
    () => DEVICE_PRESETS.find((item) => item.key === device) ?? DEVICE_PRESETS[0],
    [device],
  )

  return (
    <div className="setup-screen">
      <div className="dialog dialog--setup">
        <div className="dialog__header">
          <h1>新建项目</h1>
        </div>

        <label className="form-field">
          <span>项目名称</span>
          <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>

        <div className="setup-screen__device-grid">
          {DEVICE_PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === device ? 'device-card is-active' : 'device-card'}
              onClick={() => setDevice(item.key)}
            >
              <span>{item.label}</span>
              <small>
                {item.key === 'Custom' ? '手动输入尺寸' : `${item.width} × ${item.height}`}
              </small>
            </button>
          ))}
        </div>

        {device === 'Custom' ? (
          <div className="setup-screen__custom-size">
            <label className="form-field">
              <span>宽度</span>
              <input value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} />
            </label>
            <label className="form-field">
              <span>高度</span>
              <input value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} />
            </label>
          </div>
        ) : null}

        <button
          type="button"
          className="dialog__primary"
          onClick={() =>
            onCreate(
              projectName.trim() || DEFAULT_PROJECT_NAME,
              device,
              device === 'Custom' ? Number(customWidth) || preset.width : preset.width,
              device === 'Custom' ? Number(customHeight) || preset.height : preset.height,
            )
          }
        >
          创建项目
        </button>
      </div>
    </div>
  )
}
