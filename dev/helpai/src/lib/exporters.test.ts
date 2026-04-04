/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { buildAiArtifacts } from './exporters'
import { createProject } from './project'

describe('buildAiArtifacts', () => {
  it('exports screens and markdown with semantic interactions', () => {
    const project = createProject({
      name: 'MyApp',
      deviceType: 'mobile',
      artboardSize: { width: 393, height: 852 },
    })

    const firstBoard = project.boards[0]
    const secondBoard = {
      ...firstBoard,
      id: 'screen_2',
      name: '主页',
      elements: [],
    }

    firstBoard.id = 'screen_1'
    firstBoard.elements = [
      {
        id: 'el_1',
        name: 'login_button',
        type: 'rect',
        x: 40,
        y: 520,
        width: 313,
        height: 48,
        fill: '#ffffff',
        stroke: '#94a3b8',
        strokeWidth: 1,
        cornerRadius: 8,
        opacity: 1,
        text: '登录',
        fontSize: 14,
        visible: true,
        stateStyle: {},
        interactions: [
          {
            id: 'interaction_1',
            trigger: 'onClick',
            action: 'navigateTo',
            targetBoardId: 'screen_2',
            targetElementId: null,
          },
        ],
      },
    ]

    project.boards = [firstBoard, secondBoard]

    const artifacts = buildAiArtifacts(project)

    expect(artifacts.json.project.name).toBe('MyApp')
    expect(artifacts.json.screens).toHaveLength(2)
    expect(artifacts.json.navigationFlow).toEqual([
      {
        from: 'screen_1',
        element: 'login_button',
        action: 'navigateTo',
        to: 'screen_2',
      },
    ])
    expect(artifacts.markdown).toContain('## Screen: 首页 (393×852)')
    expect(artifacts.markdown).toContain('点击 "login_button" → 跳转到 "主页"')
  })
})
