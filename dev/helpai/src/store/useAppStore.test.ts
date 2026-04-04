/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { DEFAULT_LLM_SETTINGS } from '../lib/ai'
import { createAppStore } from './useAppStore'

describe('createAppStore', () => {
  it('tracks history with undo and redo', () => {
    const store = createAppStore({
      projects: [],
      currentProjectId: null,
      currentBoardId: null,
      showSemanticLabels: true,
      settings: DEFAULT_LLM_SETTINGS,
    })

    store.getState().createProject({
      name: 'Demo',
      deviceType: 'mobile',
      artboardSize: { width: 393, height: 852 },
    })

    const boardId = store.getState().currentBoardId!
    const elementId = store.getState().addElement(boardId, 'rect', {
      x: 40,
      y: 120,
    })!

    store.getState().updateElement(boardId, elementId, { x: 80 })
    expect(
      store
        .getState()
        .projects[0]?.boards[0]?.elements.find((element) => element.id === elementId)?.x,
    ).toBe(80)

    store.getState().undo()
    expect(
      store
        .getState()
        .projects[0]?.boards[0]?.elements.find((element) => element.id === elementId)?.x,
    ).toBe(40)

    store.getState().redo()
    expect(
      store
        .getState()
        .projects[0]?.boards[0]?.elements.find((element) => element.id === elementId)?.x,
    ).toBe(80)
  })
})
