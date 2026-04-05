/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前覆盖待放置创建、fit 缩放、预览交互与画板重名回归
3. 更新后检查所属 `.folder.md`
*/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BoardCanvas } from './BoardCanvas'
import { BoardStrip } from './BoardStrip'
import { ComponentPalette } from './ComponentPalette'
import { PreviewOverlay } from './PreviewOverlay'
import { useAppStore } from '../stores/appStore'
import { createBoard, createComponent, createProject, createId } from '../utils/project'

class ResizeObserverMock {
  static callbacks: Array<() => void> = []

  constructor(callback: () => void) {
    ResizeObserverMock.callbacks.push(callback)
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      if (this.classList.contains('canvas-stage')) {
        return 720
      }
      if (this.classList.contains('preview-overlay__stage')) {
        return 520
      }
      return 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      if (this.classList.contains('canvas-stage')) {
        return 560
      }
      if (this.classList.contains('preview-overlay__stage')) {
        return 520
      }
      return 0
    },
  })
  ResizeObserverMock.callbacks = []
  window.localStorage.clear()
  useAppStore.getState().loadWorkspace(null)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BoardCanvas', () => {
  it('enters placement mode from palette and only creates after drawing an area', () => {
    const project = createProject('测试项目', 'iPhone')
    useAppStore.getState().replaceProject(project)

    const { container } = render(
      <>
        <ComponentPalette />
        <BoardCanvas />
      </>,
    )
    const board = project.boards[0]
    const canvas = container.querySelector('.board-canvas')

    expect(canvas).not.toBeNull()
    expect(board.components).toHaveLength(0)

    const scale = Number(
      (canvas as HTMLDivElement).style.transform.replace('scale(', '').replace(')', ''),
    )

    fireEvent.click(screen.getByRole('button', { name: /按钮$/ }))

    expect(useAppStore.getState().project?.boards[0]?.components).toHaveLength(0)

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 40 * scale,
      clientY: 56 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 224 * scale,
      clientY: 120 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 224 * scale,
      clientY: 120 * scale,
    })

    const placed = useAppStore.getState().project?.boards[0]?.components[0]

    expect(placed?.type).toBe('Button')
    expect(placed?.x).toBe(40)
    expect(placed?.y).toBe(56)
    expect(placed?.width).toBe(184)
    expect(placed?.height).toBeCloseTo(64)
  })

  it('keeps canvas fit-to-screen and removes manual zoom controls', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(screen.queryByLabelText('缩小画板')).toBeNull()
    expect(screen.queryByLabelText('放大画板')).toBeNull()
    expect(canvas?.style.transform).toBe('scale(0.4666666666666667)')
    expect(screen.getByText('47%')).toBeTruthy()
  })

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

  it('runs tap interactions in preview when clicking the component label', () => {
    const project = createProject('测试项目', 'iPhone')
    const sourceBoard = project.boards[0]
    const targetBoard = createBoard('详情页')
    const component = createComponent('Button', sourceBoard, project.boardSize, { x: 48, y: 64 })
    component.interactions.push({
      id: createId('interaction'),
      trigger: 'tap',
      action: 'navigate',
      target: targetBoard.id,
    })
    sourceBoard.components.push(component)
    project.boards.push(targetBoard)

    useAppStore.getState().replaceProject(project)
    useAppStore.getState().openPreview()

    render(<PreviewOverlay />)

    fireEvent.click(screen.getByText(component.name))

    expect(useAppStore.getState().previewBoardStack).toEqual([sourceBoard.id, targetBoard.id])
  })

  it('keeps preview fit-to-screen', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().openPreview()

    const { container } = render(<PreviewOverlay />)
    const previewBoard = container.querySelector('.preview-board') as HTMLDivElement | null

    expect(previewBoard?.style.transform).toBe('scale(0.3277777777777778)')
  })

  it('does not write a duplicate board name', () => {
    const project = createProject('测试项目', 'iPhone')
    const board = createBoard('详情页')
    project.boards.push(board)
    useAppStore.getState().replaceProject(project)

    render(<BoardStrip />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[1], { target: { value: '首页' } })

    expect(useAppStore.getState().project?.boards.map((item) => item.name)).toEqual(['首页', '详情页'])
    expect((inputs[1] as HTMLInputElement).value).toBe('详情页')
  })
})
