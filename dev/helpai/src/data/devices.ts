/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import type { DevicePreset } from '../types/prototype'

export const DEVICE_PRESETS: DevicePreset[] = [
  {
    id: 'iphone-15',
    label: 'iPhone 15',
    deviceType: 'mobile',
    description: '移动端 · 393×852',
    size: { width: 393, height: 852 },
  },
  {
    id: 'iphone-se',
    label: 'iPhone SE',
    deviceType: 'mobile',
    description: '移动端 · 375×667',
    size: { width: 375, height: 667 },
  },
  {
    id: 'android',
    label: 'Android',
    deviceType: 'mobile',
    description: '移动端 · 360×800',
    size: { width: 360, height: 800 },
  },
  {
    id: 'ipad',
    label: 'iPad',
    deviceType: 'tablet',
    description: '平板端 · 820×1180',
    size: { width: 820, height: 1180 },
  },
  {
    id: 'ipad-pro',
    label: 'iPad Pro',
    deviceType: 'tablet',
    description: '平板端 · 1024×1366',
    size: { width: 1024, height: 1366 },
  },
  {
    id: 'desktop-1440',
    label: '桌面 1440',
    deviceType: 'desktop',
    description: '桌面端 · 1440×900',
    size: { width: 1440, height: 900 },
  },
  {
    id: 'desktop-1920',
    label: '桌面 1920',
    deviceType: 'desktop',
    description: '桌面端 · 1920×1080',
    size: { width: 1920, height: 1080 },
  },
]

export const DEVICE_GROUPS = [
  { label: '移动端', type: 'mobile' },
  { label: '平板端', type: 'tablet' },
  { label: '桌面端', type: 'desktop' },
] as const
