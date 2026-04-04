/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { compareAlignment } from './alignment'
import type { AiExportBundle } from '../types/prototype'

describe('compareAlignment', () => {
  it('scores matching layouts and interactions', () => {
    const source: AiExportBundle = {
      project: {
        name: 'Demo',
        deviceType: 'mobile',
        artboardSize: { width: 393, height: 852 },
      },
      screens: [
        {
          id: 'screen_1',
          name: '登录页',
          elements: [
            {
              id: 'el_1',
              name: 'login_button',
              type: 'rect',
              x: 40,
              y: 520,
              width: 313,
              height: 48,
              interactions: [
                {
                  trigger: 'onClick',
                  action: 'navigateTo',
                  target: 'screen_2',
                },
              ],
            },
          ],
        },
      ],
      navigationFlow: [],
    }

    const interpreted = {
      project: source.project,
      screens: [
        {
          id: 'screen_1',
          name: '登录页',
          elements: [
            {
              id: 'el_1',
              name: 'login_button',
              type: 'rect',
              x: 45,
              y: 515,
              width: 320,
              height: 48,
              interactions: [
                {
                  trigger: 'onClick',
                  action: 'navigateTo',
                  target: 'screen_2',
                },
              ],
            },
          ],
        },
      ],
      navigationFlow: [],
    }

    const report = compareAlignment(source, interpreted)

    expect(report.layoutScore).toBe(100)
    expect(report.interactionScore).toBe(100)
    expect(report.overallScore).toBe(100)
    expect(report.rows[0]?.notes).toEqual([])
  })

  it('highlights mismatched interactions', () => {
    const source: AiExportBundle = {
      project: {
        name: 'Demo',
        deviceType: 'mobile',
        artboardSize: { width: 393, height: 852 },
      },
      screens: [
        {
          id: 'screen_1',
          name: '登录页',
          elements: [
            {
              id: 'el_1',
              name: 'login_button',
              type: 'rect',
              x: 40,
              y: 520,
              width: 313,
              height: 48,
              interactions: [
                {
                  trigger: 'onClick',
                  action: 'navigateTo',
                  target: 'screen_2',
                },
              ],
            },
          ],
        },
      ],
      navigationFlow: [],
    }

    const interpreted = {
      ...source,
      screens: [
        {
          id: 'screen_1',
          name: '登录页',
          elements: [
            {
              id: 'el_1',
              name: 'login_button',
              type: 'rect',
              x: 40,
              y: 520,
              width: 313,
              height: 48,
              interactions: [],
            },
          ],
        },
      ],
    }

    const report = compareAlignment(source, interpreted)

    expect(report.layoutScore).toBe(100)
    expect(report.interactionScore).toBe(0)
    expect(report.rows[0]?.notes).toContain('交互关系不一致。')
  })
})
