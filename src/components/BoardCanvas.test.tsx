/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardCanvas } from './BoardCanvas'
import { useAppStore } from '../stores/appStore'
import { createComponent, createProject } from '../utils/project'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BoardCanvas', () => {
  it('keeps a component selected after clicking it', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)

    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const block = container.querySelector('.wireframe-block')

    expect(block).not.toBeNull()

    fireEvent.pointerDown(block as Element, {
      button: 0,
      clientX: 60,
      clientY: 60,
    })
    fireEvent.click(block as Element)

    expect(useAppStore.getState().selectedComponentId).toBe(component.id)
  })
})
