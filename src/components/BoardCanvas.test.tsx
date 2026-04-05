/// <reference types="node" />
/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前覆盖统一画布模式、顶部项目名迁移、左栏精简、组件自由缩放移动、画板更多菜单、右栏文案与批量态、组件放置、多选框选、图层拖拽、fit 缩放、预览交互与画板重名回归
3. 更新后检查所属 `.folder.md`
*/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { BoardCanvas } from './BoardCanvas'
import { BoardStrip } from './BoardStrip'
import { ComponentPalette } from './ComponentPalette'
import { InteractionPanel } from './InteractionPanel'
import { PreviewOverlay } from './PreviewOverlay'
import { useAppStore } from '../stores/appStore'
import { createBoard, createComponent, createProject, createId } from '../utils/project'

const appStyles = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

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
  it('keeps component palette scrollable within the left sidebar', () => {
    const project = createProject('测试项目', 'iPhone')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const palette = container.querySelector('.component-palette')
    const paletteRule = appStyles.match(/\.component-palette\s*\{[^}]*\}/)?.[0] ?? ''
    const gridRule = appStyles.match(/\.component-palette__grid\s*\{[^}]*\}/)?.[0] ?? ''

    expect(palette).not.toBeNull()
    expect(paletteRule).toContain('flex: 1;')
    expect(paletteRule).toContain('min-height: 0;')
    expect(paletteRule).toContain('overflow: auto;')
    expect(gridRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(screen.queryByRole('heading', { name: 'Components' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New Page' })).toBeNull()
    expect(screen.queryByText('Purpose')).toBeNull()
    expect(container.querySelector('.palette-footer')).toBeNull()
    expect(container.querySelector('.toolbar .toolbar__project-name')).toBeNull()
    expect(screen.getAllByLabelText('项目名称')).toHaveLength(1)
    expect(container.querySelector('.panel__eyebrow .panel__project-name')).not.toBeNull()
    expect(screen.getByRole('button', { name: /^Button$/i })).toBeTruthy()
    expect(screen.queryByText('140 × 40')).toBeNull()
  })

  it('uses a unified workspace without wireframe-only controls or canvas header', () => {
    const project = createProject('测试项目', 'iPhone')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)

    expect(screen.getByText('Layers')).toBeTruthy()
    expect(screen.queryByText('Canvas Opacity')).toBeNull()
    expect(screen.queryByRole('button', { name: 'On' })).toBeNull()
    expect(container.querySelector('.canvas-header')).toBeNull()
    expect(container.querySelector('.board-canvas__wash')).toBeNull()
  })

  it('places a component at default size when clicking the canvas', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /^Button$/i }))

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 48 * scale,
      clientY: 72 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 48 * scale,
      clientY: 72 * scale,
    })

    const placed = useAppStore.getState().project?.boards[0]?.components[0]

    expect(placed?.type).toBe('button')
    expect(placed?.x).toBe(48)
    expect(placed?.y).toBe(72)
    expect(placed?.width).toBe(140)
    expect(placed?.height).toBe(40)
  })

  it('draws a custom frame when dragging on the canvas without pixel annotations', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /^Button$/i }))

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

    expect(container.querySelector('.canvas-size-indicator')).toBeNull()
    expect(screen.queryByText('140 × 40')).toBeNull()

    const placed = useAppStore.getState().project?.boards[0]?.components[0]

    expect(placed?.type).toBe('button')
    expect(placed?.x).toBe(40)
    expect(placed?.y).toBe(56)
    expect(placed?.width).toBe(184)
    expect(placed?.height).toBeCloseTo(64)
  })

  it('allows marquee-selecting multiple components', () => {
    const project = createProject('测试项目', 'iPhone')
    const board = project.boards[0]
    board.components.push(
      createComponent('Card', board, project.boardSize, { x: 48, y: 56 }),
      createComponent('Button', board, project.boardSize, { x: 176, y: 64 }),
    )
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas')

    expect(canvas).not.toBeNull()

    const scale = Number(
      (canvas as HTMLDivElement).style.transform.replace('scale(', '').replace(')', ''),
    )

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 32 * scale,
      clientY: 40 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 336 * scale,
      clientY: 344 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 336 * scale,
      clientY: 344 * scale,
    })

    expect(container.querySelectorAll('.wireframe-block.is-selected')).toHaveLength(2)
  })

  it('moves marquee-selected components as a group', () => {
    const project = createProject('测试项目', 'iPhone')
    const board = project.boards[0]
    const first = createComponent('Card', board, project.boardSize, { x: 48, y: 56 })
    first.name = 'First'
    const second = createComponent('Button', board, project.boardSize, { x: 176, y: 64 })
    second.name = 'Second'
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas')

    expect(canvas).not.toBeNull()

    const scale = Number(
      (canvas as HTMLDivElement).style.transform.replace('scale(', '').replace(')', ''),
    )

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 32 * scale,
      clientY: 40 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 336 * scale,
      clientY: 344 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 336 * scale,
      clientY: 344 * scale,
    })

    const blocks = container.querySelectorAll('.wireframe-block')
    fireEvent.pointerDown(blocks[0], {
      button: 0,
      clientX: 64 * scale,
      clientY: 72 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 128 * scale,
      clientY: 104 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 128 * scale,
      clientY: 104 * scale,
    })

    const moved = useAppStore.getState().project?.boards[0]?.components ?? []

    expect(moved.map((component) => ({ name: component.name, x: component.x, y: component.y }))).toEqual([
      { name: 'First', x: 110, y: 88 },
      { name: 'Second', x: 240, y: 96 },
    ])
  })

  it('allows header and navigation components to move and resize freely', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const header = createComponent('header', board, project.boardSize, { x: 48, y: 40 })
    const navigation = createComponent('navigation', board, project.boardSize, { x: 88, y: 152 })
    board.components.push(header, navigation)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null
    const blocks = container.querySelectorAll('.wireframe-block')

    expect(canvas).not.toBeNull()
    expect(blocks).toHaveLength(2)

    const scale = Number(canvas?.style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(blocks[0], {
      button: 0,
      clientX: 32 * scale,
      clientY: 24 * scale,
    })

    const resizeHandle = container.querySelector('.canvas-selection__handle--se')
    expect(resizeHandle).not.toBeNull()

    fireEvent.pointerDown(resizeHandle as Element, {
      button: 0,
      clientX: (header.x + header.width) * scale,
      clientY: (header.y + header.height) * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 320 * scale,
      clientY: 220 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 320 * scale,
      clientY: 220 * scale,
    })

    const resizedHeader = useAppStore.getState().project?.boards[0]?.components[0]
    expect(resizedHeader?.width).not.toBe(project.boardSize.width)
    expect(resizedHeader?.height).toBeGreaterThan(header.height)

    fireEvent.pointerDown(blocks[0], {
      button: 0,
      clientX: 32 * scale,
      clientY: 24 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 136 * scale,
      clientY: 112 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 136 * scale,
      clientY: 112 * scale,
    })

    const movedHeader = useAppStore.getState().project?.boards[0]?.components[0]
    expect(movedHeader?.x).not.toBe(0)
    expect(movedHeader?.y).not.toBe(0)

    fireEvent.pointerDown(blocks[1], {
      button: 0,
      clientX: 48 * scale,
      clientY: 24 * scale,
    })
    const navigationResizeHandle = container.querySelector('.canvas-selection__handle--se')
    expect(navigationResizeHandle).not.toBeNull()
    fireEvent.pointerDown(navigationResizeHandle as Element, {
      button: 0,
      clientX: (navigation.width + navigation.x) * scale,
      clientY: (navigation.height + navigation.y) * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 280 * scale,
      clientY: 120 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 280 * scale,
      clientY: 120 * scale,
    })
    fireEvent.pointerDown(blocks[1], {
      button: 0,
      clientX: 48 * scale,
      clientY: 24 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 184 * scale,
      clientY: 128 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 184 * scale,
      clientY: 128 * scale,
    })

    const movedNavigation = useAppStore.getState().project?.boards[0]?.components[1]
    expect(movedNavigation?.x).not.toBe(0)
    expect(movedNavigation?.y).not.toBe(0)
  })

  it('keeps canvas fit-to-screen and removes manual zoom controls', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(screen.queryByLabelText('缩小画板')).toBeNull()
    expect(screen.queryByLabelText('放大画板')).toBeNull()
    expect(screen.queryByLabelText('当前画板缩放')).toBeNull()
    expect(canvas?.style.transform).toBe('scale(0.4666666666666667)')
    expect(container.querySelector('.canvas-zoom')).toBeNull()
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

  it('keeps the chosen palette component active until toggled off or another component is selected', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    board.components.push(createComponent('Card', board, project.boardSize, { x: 48, y: 48 }))
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const paletteButton = screen.getByRole('button', { name: /^Button$/i })
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(canvas).not.toBeNull()

    fireEvent.click(paletteButton)

    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('button')

    const scale = Number(canvas?.style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 220 * scale,
      clientY: 220 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 220 * scale,
      clientY: 220 * scale,
    })

    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('button')

    const existingBlock = container.querySelector('.wireframe-block')

    expect(existingBlock).not.toBeNull()

    fireEvent.pointerDown(existingBlock as Element, {
      button: 0,
      clientX: 60,
      clientY: 60,
    })
    fireEvent.click(existingBlock as Element)

    expect(paletteButton.className).not.toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBeNull()

    fireEvent.click(paletteButton)
    expect(paletteButton.className).toContain('is-active')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('button')

    fireEvent.click(paletteButton)
    expect(paletteButton.className).not.toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBeNull()
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

  it('shows a more menu on board chips and can duplicate or delete the active board', () => {
    const project = createProject('测试项目', 'iPhone')
    const sourceBoard = project.boards[0]
    const button = createComponent('Button', sourceBoard, project.boardSize, { x: 48, y: 64 })
    button.name = '主按钮'
    sourceBoard.components.push(button)
    useAppStore.getState().replaceProject(project)

    const { rerender } = render(<BoardStrip />)

    expect(screen.queryByRole('button', { name: /删除首页/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '更多首页' }))

    expect(screen.getByRole('button', { name: '创建副本' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '创建副本' }))

    const boardsAfterDuplicate = useAppStore.getState().project?.boards ?? []
    expect(boardsAfterDuplicate).toHaveLength(2)
    expect(boardsAfterDuplicate[1]?.name).toContain('副本')
    expect(boardsAfterDuplicate[1]?.components).toHaveLength(1)
    expect(boardsAfterDuplicate[1]?.components[0]).toMatchObject({
      type: 'Button',
      name: '主按钮',
      x: 48,
      y: 64,
      width: button.width,
      height: button.height,
    })
    expect(boardsAfterDuplicate[1]?.components[0]?.id).not.toBe(button.id)
    expect(boardsAfterDuplicate[1]?.components[0]?.interactions).toEqual([])

    rerender(<BoardStrip />)
    fireEvent.click(screen.getByRole('button', { name: `更多${boardsAfterDuplicate[1]?.name}` }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    expect(useAppStore.getState().project?.boards).toHaveLength(1)
  })

  it('reorders layers by drag and drop in the layer panel', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const first = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    first.name = 'First'
    const second = createComponent('Button', board, project.boardSize, { x: 96, y: 160 })
    second.name = 'Second'
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)

    render(<InteractionPanel />)

    const items = screen.getAllByRole('button')
    const dataTransfer = {
      store: new Map<string, string>(),
      setData(type: string, value: string) {
        this.store.set(type, value)
      },
      getData(type: string) {
        return this.store.get(type) ?? ''
      },
    }

    fireEvent.dragStart(items[0], { dataTransfer })
    fireEvent.dragOver(items[1], { dataTransfer })
    fireEvent.drop(items[1], { dataTransfer })

    expect(useAppStore.getState().project?.boards[0]?.components.map((item) => item.name)).toEqual([
      'Second',
      'First',
    ])
  })

  it('uses a consistent English label system in the side panels', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Button', board, project.boardSize, { x: 48, y: 48 })
    component.interactions.push({
      id: createId('interaction'),
      trigger: 'tap',
      action: 'back',
    })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponent(component.id)

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Interactions' })).toBeTruthy()
    expect(screen.getByText('Layers')).toBeTruthy()
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Trigger')).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(screen.queryByText('交互')).toBeNull()
    expect(screen.queryByText('图层')).toBeNull()
    expect(screen.queryByText('名称')).toBeNull()
  })

  it('shows hover feedback for layer drag targets', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    board.components.push(
      createComponent('Card', board, project.boardSize, { x: 48, y: 48 }),
      createComponent('Button', board, project.boardSize, { x: 96, y: 160 }),
    )
    useAppStore.getState().replaceProject(project)

    render(<InteractionPanel />)

    const items = screen.getAllByRole('button')
    const dataTransfer = {
      store: new Map<string, string>(),
      setData(type: string, value: string) {
        this.store.set(type, value)
      },
      getData(type: string) {
        return this.store.get(type) ?? ''
      },
    }

    fireEvent.dragStart(items[0], { dataTransfer })
    fireEvent.dragOver(items[1], { dataTransfer })

    expect(items[1].className).toContain('is-drop-target')

    fireEvent.drop(items[1], { dataTransfer })
    expect(items[1].className).not.toContain('is-drop-target')
  })

  it('shows explicit batch actions in the right panel for multi-selection', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const first = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    const second = createComponent('Button', board, project.boardSize, { x: 96, y: 160 })
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponents([first.id, second.id])

    render(<InteractionPanel />)

    expect(screen.getByText('2 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Selected' }))

    expect(useAppStore.getState().project?.boards[0]?.components).toHaveLength(0)
  })
})
