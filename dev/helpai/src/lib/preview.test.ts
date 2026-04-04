/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import {
  applyPreviewElementInteractions,
  createPreviewSession,
  resolvePreviewElement,
} from './preview'
import { createProject } from './project'
import type { PrototypeBoard } from '../types/prototype'

describe('preview interactions', () => {
  it('navigates, goes back, toggles state, and hides targets', () => {
    const project = createProject({
      name: 'Demo',
      deviceType: 'mobile',
      artboardSize: { width: 393, height: 852 },
    })

    const firstBoard = project.boards[0]
    firstBoard.id = 'screen_1'
    const secondBoard: PrototypeBoard = {
      ...firstBoard,
      id: 'screen_2',
      name: '详情页',
      elements: [],
    }

    const targetElement = {
      id: 'avatar',
      name: 'avatar_image',
      type: 'image_placeholder' as const,
      x: 32,
      y: 32,
      width: 96,
      height: 96,
      fill: '#e5e7eb',
      stroke: '#94a3b8',
      strokeWidth: 1,
      cornerRadius: 8,
      opacity: 1,
      text: '',
      fontSize: 14,
      visible: true,
      stateStyle: {},
      interactions: [],
    }

    const toggleElement = {
      ...targetElement,
      id: 'toggle_button',
      name: 'toggle_button',
      type: 'rect' as const,
      stateStyle: { fill: '#111827' },
      interactions: [
        {
          id: 'toggle_interaction',
          trigger: 'onClick' as const,
          action: 'toggleState' as const,
          targetBoardId: null,
          targetElementId: null,
        },
        {
          id: 'hide_interaction',
          trigger: 'onClick' as const,
          action: 'showHide' as const,
          targetBoardId: null,
          targetElementId: 'avatar',
        },
        {
          id: 'nav_interaction',
          trigger: 'onClick' as const,
          action: 'navigateTo' as const,
          targetBoardId: 'screen_2',
          targetElementId: null,
        },
      ],
    }

    secondBoard.elements = [
      {
        ...targetElement,
        id: 'back_arrow',
        name: 'back_arrow',
        interactions: [
          {
            id: 'back_interaction',
            trigger: 'onClick',
            action: 'goBack',
            targetBoardId: null,
            targetElementId: null,
          },
        ],
      },
    ]

    firstBoard.elements = [targetElement, toggleElement]
    project.boards = [firstBoard, secondBoard]

    const start = createPreviewSession(project, 'screen_1')
    const afterToggle = applyPreviewElementInteractions(project, start, toggleElement)

    expect(afterToggle.currentBoardId).toBe('screen_2')
    expect(afterToggle.history).toEqual(['screen_1'])
    expect(afterToggle.visibility.avatar).toBe(false)
    expect(resolvePreviewElement(afterToggle, toggleElement).fill).toBe('#111827')

    const afterBack = applyPreviewElementInteractions(
      project,
      afterToggle,
      secondBoard.elements[0]!,
    )

    expect(afterBack.currentBoardId).toBe('screen_1')
    expect(afterBack.history).toEqual([])
  })
})
