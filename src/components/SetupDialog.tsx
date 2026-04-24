/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前仅展示固定设备预设，不提供自定义尺寸入口
3. 当前标题、项目名、创建按钮与默认项目名跟随 locale
4. 更新后检查所属 `.folder.md`
*/

import { useMemo, useState } from 'react'
import { DEVICE_PRESETS } from '../utils/constants'
import { useAppStore } from '../stores/appStore'
import { getDefaultProjectName, getLocalizedDeviceLabel, t } from '../utils/i18n'
import type { DevicePresetKey } from '../types/schema'

interface SetupDialogProps {
  onCreate: (projectName: string, device: DevicePresetKey, width: number, height: number) => void
}

export function SetupDialog({ onCreate }: SetupDialogProps) {
  const locale = useAppStore((state) => state.locale)
  const defaultProjectName = getDefaultProjectName(locale)
  const [projectName, setProjectName] = useState(defaultProjectName)
  const [device, setDevice] = useState<DevicePresetKey>('iPhone')

  const preset = useMemo(
    () => DEVICE_PRESETS.find((item) => item.key === device) ?? DEVICE_PRESETS[0],
    [device],
  )

  return (
    <div className="setup-screen">
      <div className="dialog dialog--setup">
        <div className="dialog__header">
          <h1>{t(locale, 'newProject')}</h1>
        </div>

        <label className="form-field">
          <span>{t(locale, 'projectName')}</span>
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
              <span>{getLocalizedDeviceLabel(locale, item.key)}</span>
              <small>{item.width} × {item.height}</small>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="dialog__primary"
          onClick={() =>
            onCreate(
              projectName.trim() || defaultProjectName,
              device,
              preset.width,
              preset.height,
            )
          }
        >
          {t(locale, 'createProject')}
        </button>
      </div>
    </div>
  )
}
