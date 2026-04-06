/// <reference types="node" />
/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前覆盖浏览器语言自动检测、无手动语言入口、无 toolbar/preview、右栏导出、去弹窗组件化、弹窗描述交互、顶部项目名迁移、左栏单滚动、eyebrow 容器删除、通用块置顶独立、标题结构一致、图层/画板自动聚焦、Option 拖动复制、快捷键复制粘贴、副本命名防重、图层主名称展示、通用块创建、组件选中态强化、组件越界编辑与 clipped 导出、组件自由缩放移动、画板更多菜单、右栏文案与批量态、组件放置、多选框选、图层拖拽与画板重名、描述字段与属性切换回归
3. 新增待放置期间禁止选中其他图层、placement toast 可点击退出放置与拖动一次性 undo 的回归
4. 更新后检查所属 `.folder.md`
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

const scrollIntoViewMock = vi.fn()

function setBrowserLanguage(languages: string[], language = languages[0] ?? 'en-US') {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  })
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  })
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  setBrowserLanguage(['en-US'], 'en-US')
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
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  })
  ResizeObserverMock.callbacks = []
  scrollIntoViewMock.mockReset()
  window.localStorage.clear()
  useAppStore.getState().loadWorkspace(null)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BoardCanvas', () => {
  it('does not show a manual language switch and defaults to English in an English browser', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)

    expect(screen.queryByRole('group', { name: 'Language switch' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'English' })).toBeNull()
    expect(screen.queryByRole('button', { name: '中文' })).toBeNull()
    expect(container.querySelector('.toolbar')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeTruthy()
  })

  it('defaults to Chinese in a Chinese browser environment', () => {
    setBrowserLanguage(['zh-CN', 'en-US'], 'zh-CN')
    useAppStore.getState().loadWorkspace(null)
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)

    expect(screen.queryByRole('button', { name: '导入 JSON' })).toBeNull()
    expect(container.querySelector('.toolbar')).toBeNull()
    expect(screen.queryByRole('button', { name: '预览' })).toBeNull()
    expect(screen.getByRole('button', { name: '导出 JSON' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '图层' })).toBeTruthy()
    expect(screen.getByLabelText('项目名称')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Import JSON' })).toBeNull()
  })

  it('uses the current browser language again on re-initialization instead of restoring a stored locale', () => {
    setBrowserLanguage(['zh-CN', 'en-US'], 'zh-CN')
    useAppStore.getState().loadWorkspace(null)
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)
    window.localStorage.setItem('wireframe-proto-state:locale', 'zh')

    setBrowserLanguage(['en-US'], 'en-US')
    useAppStore.getState().loadWorkspace(null)
    render(<App />)

    expect(screen.getByRole('heading', { name: 'New Project' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '新建项目' })).toBeNull()
  })

  it('keeps component palette scrollable within the left sidebar', () => {
    const project = createProject('测试项目', 'iPhone')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const palette = container.querySelector('.component-palette')
    const palettePanelRule = appStyles.match(/\.panel--palette\s*\{[^}]*\}/)?.[0] ?? ''
    const paletteRule = appStyles.match(/\.component-palette\s*\{[^}]*\}/)?.[0] ?? ''
    const gridRule = appStyles.match(/\.component-palette__grid\s*\{[^}]*\}/)?.[0] ?? ''
    const mobileSection = appStyles.match(/@media \(max-width: 960px\) \{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(palette).not.toBeNull()
    expect(palettePanelRule).toContain('overflow: hidden;')
    expect(paletteRule).toContain('flex: 1;')
    expect(paletteRule).toContain('min-height: 0;')
    expect(paletteRule).toContain('overflow: auto;')
    expect(mobileSection).toContain('.panel--palette')
    expect(mobileSection).toContain('overflow: visible;')
    expect(mobileSection).toContain('.component-palette')
    expect(gridRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(screen.queryByRole('heading', { name: 'Components' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New Page' })).toBeNull()
    expect(screen.queryByText('Purpose')).toBeNull()
    expect(container.querySelector('.palette-footer')).toBeNull()
    expect(container.querySelector('.toolbar .toolbar__project-name')).toBeNull()
    expect(container.querySelector('.panel__header--palette')).toBeNull()
    expect(screen.getAllByLabelText('Project Name')).toHaveLength(1)
    expect(container.querySelector('.panel--palette > .panel__project-name')).not.toBeNull()
    expect(screen.getByRole('button', { name: /^Button$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Modal$/i })).toBeNull()
    expect(screen.queryByText('140 × 40')).toBeNull()
  })

  it('shows generic block as the first standalone entry in the component palette', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<ComponentPalette />)
    const sections = container.querySelectorAll('.component-palette__section')
    const firstSectionButtons = sections[0]?.querySelectorAll('.component-palette__item')
    const laterSectionText = Array.from(sections)
      .slice(1)
      .some((section) => section.textContent?.includes('Generic Block'))

    expect(firstSectionButtons).toHaveLength(1)
    expect(firstSectionButtons?.[0]?.textContent).toBe('Generic Block')
    expect(laterSectionText).toBe(false)
  })

  it('uses the same title structure for interactions and layers', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<InteractionPanel />)
    const sectionHeaders = container.querySelectorAll('.panel__section > .panel__header > .panel__title')

    expect(sectionHeaders).toHaveLength(2)
    expect(sectionHeaders[0]?.textContent).toBe('Interactions')
    expect(sectionHeaders[1]?.textContent).toBe('Layers')
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

  it('keeps only the simplified empty-state copy on the canvas', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    render(<BoardCanvas />)

    expect(screen.getByText('Select a component, then drag/click to place it.')).toBeTruthy()
    expect(screen.queryByText('New Page')).toBeNull()
    expect(screen.queryByText('Pick a component and click or drag on canvas.')).toBeNull()
  })

  it('renders export and copy buttons at the top of the right sidebar and keeps export working', async () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const createObjectURLMock = vi.fn(() => 'blob:test')
    const revokeObjectURLMock = vi.fn()
    const anchorClickMock = vi.fn()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName)
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: anchorClickMock,
        })
      }
      return element
    }) as typeof document.createElement)

    const { container } = render(<App />)
    const exportButton = screen.getByRole('button', { name: 'Export JSON' })
    const copyButton = screen.getByRole('button', { name: 'Copy JSON' })
    const rightSidebar = container.querySelector('.workspace__sidebar--right')
    const buttonGroup = container.querySelector('.panel__export-actions')
    const exportRule = appStyles.match(/\.panel__export-button\s*\{[^}]*\}/)?.[0] ?? ''
    const copyRule = appStyles.match(/\.panel__copy-button\s*\{[^}]*\}/)?.[0] ?? ''
    const exportPrimaryRule = appStyles.match(/\.panel__export-button--primary\s*\{[^}]*\}/)?.[0] ?? ''

    expect(rightSidebar?.firstElementChild?.contains(exportButton)).toBe(true)
    expect(rightSidebar?.firstElementChild?.contains(copyButton)).toBe(true)
    expect(buttonGroup).not.toBeNull()
    expect(exportButton.className).toContain('panel__export-button--primary')
    expect(exportRule).toContain('flex: 2;')
    expect(copyRule).toContain('flex: 1;')
    expect(exportPrimaryRule).toContain('background: #111827;')
    expect(exportPrimaryRule).toContain('color: #fff;')
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull()
    expect(container.querySelector('.preview-overlay')).toBeNull()

    fireEvent.click(copyButton)

    expect(writeTextMock).toHaveBeenCalledWith(useAppStore.getState().exportProjectJson())

    fireEvent.click(exportButton)

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(anchorClickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalled()
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

  it('creates a generic block component at 60 by 80', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(
      <>
        <ComponentPalette />
        <BoardCanvas />
      </>,
    )
    const canvas = container.querySelector('.board-canvas')

    expect(canvas).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Generic Block|通用块/ }))

    const scale = Number((canvas as HTMLDivElement).style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(canvas as Element, {
      button: 0,
      clientX: 64 * scale,
      clientY: 80 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 64 * scale,
      clientY: 80 * scale,
    })

    const placed = useAppStore.getState().project?.boards[0]?.components[0]
    expect(placed?.type).toBe('genericBlock')
    expect(placed?.width).toBe(60)
    expect(placed?.height).toBe(80)
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
      { name: 'First', x: 112, y: 88 },
      { name: 'Second', x: 240, y: 96 },
    ])
  })

  it('allows components to move and resize beyond the board bounds', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null
    const block = container.querySelector('.wireframe-block')

    expect(canvas).not.toBeNull()
    expect(block).not.toBeNull()
    expect(appStyles.match(/\.board-canvas,\s*\.preview-board,\s*\.restore-test__device\s*\{[^}]*overflow: hidden;/s)?.[0]).toBeTruthy()

    const scale = Number(canvas?.style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(block as Element, {
      button: 0,
      clientX: 64 * scale,
      clientY: 64 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: -120 * scale,
      clientY: -96 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: -120 * scale,
      clientY: -96 * scale,
    })

    const moved = useAppStore.getState().project?.boards[0]?.components[0]
    expect(moved?.x).toBeLessThan(0)
    expect(moved?.y).toBeLessThan(0)

    const resizeHandle = container.querySelector('.canvas-selection__handle--se')
    expect(resizeHandle).not.toBeNull()

    fireEvent.pointerDown(resizeHandle as Element, {
      button: 0,
      clientX: ((moved?.x ?? 0) + (moved?.width ?? 0)) * scale,
      clientY: ((moved?.y ?? 0) + (moved?.height ?? 0)) * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 1800 * scale,
      clientY: 1200 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 1800 * scale,
      clientY: 1200 * scale,
    })

    const resized = useAppStore.getState().project?.boards[0]?.components[0]
    expect((resized?.x ?? 0) + (resized?.width ?? 0)).toBeGreaterThan(project.boardSize.width)
    expect((resized?.y ?? 0) + (resized?.height ?? 0)).toBeGreaterThan(project.boardSize.height)
  })

  it('duplicates the selected component when dragging with Option or Alt', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 56 })
    component.name = 'Source'
    board.components.push(component)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null
    const block = container.querySelector('.wireframe-block')

    expect(canvas).not.toBeNull()
    expect(block).not.toBeNull()

    const scale = Number(canvas?.style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(block as Element, {
      button: 0,
      altKey: true,
      clientX: 64 * scale,
      clientY: 80 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 176 * scale,
      clientY: 176 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 176 * scale,
      clientY: 176 * scale,
    })

    const components = useAppStore.getState().project?.boards[0]?.components ?? []

    expect(components).toHaveLength(2)
    expect(components[0]).toMatchObject({ name: 'Source', x: 48, y: 56 })
    expect(components[1]?.id).not.toBe(component.id)
    expect(components[1]?.x).not.toBe(component.x)
    expect(components[1]?.y).not.toBe(component.y)
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
    expect(block?.className).toContain('is-selected-emphasis')
    expect(appStyles.match(/\.wireframe-block\.is-selected-emphasis\s*\{[^}]*\}/)?.[0] ?? '').toContain(
      'box-shadow:',
    )
  })

  it('keeps the chosen palette component active while clicking other layers during placement', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    board.components.push(createComponent('Card', board, project.boardSize, { x: 48, y: 48 }))
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const paletteButton = screen.getByRole('button', { name: /^Button$/i })
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(canvas).not.toBeNull()
    useAppStore.getState().selectComponent(null)

    fireEvent.click(paletteButton)

    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('button')
    expect(screen.getByRole('button', { name: '退出放置' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '退出放置' }))
    expect(useAppStore.getState().pendingComponentType).toBeNull()

    fireEvent.click(paletteButton)
    expect(useAppStore.getState().pendingComponentType).toBe('button')
    const selectedBefore = useAppStore.getState().selectedComponentId

    const existingBlock = container.querySelector('.wireframe-block')
    const layerItem = container.querySelector('.layer-list .layer-item') as HTMLButtonElement | null

    expect(existingBlock).not.toBeNull()
    expect(layerItem).not.toBeNull()

    fireEvent.click(layerItem as HTMLButtonElement)

    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('button')
    expect(useAppStore.getState().selectedComponentId).toBe(selectedBefore)
  })

  it('commits a drag as one undo step instead of replaying intermediate positions', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const block = container.querySelector('.wireframe-block')
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(block).not.toBeNull()
    expect(canvas).not.toBeNull()

    const scale = Number(canvas?.style.transform.replace('scale(', '').replace(')', ''))

    fireEvent.pointerDown(block as Element, {
      button: 0,
      clientX: 60 * scale,
      clientY: 60 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 132 * scale,
      clientY: 96 * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 180 * scale,
      clientY: 140 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 180 * scale,
      clientY: 140 * scale,
    })

    const moved = useAppStore.getState().project?.boards[0]?.components[0]

    expect(useAppStore.getState().history.past).toHaveLength(1)
    expect(moved?.x).not.toBe(48)
    expect(moved?.y).not.toBe(48)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    const undone = useAppStore.getState().project?.boards[0]?.components[0]

    expect(undone?.x).toBe(48)
    expect(undone?.y).toBe(48)
  })


  it('does not write a duplicate board name', () => {
    const project = createProject('测试项目', 'iPhone')
    const board = createBoard('详情页')
    project.boards.push(board)
    useAppStore.getState().replaceProject(project)

    render(<BoardStrip />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[1], { target: { value: '首页' } })

    expect(useAppStore.getState().project?.boards.map((item) => item.name)).toEqual(['Home', '首页'])
    expect((inputs[1] as HTMLInputElement).value).toBe('首页')
  })

  it('shows a more menu on board chips and can duplicate or delete the active board', () => {
    const project = createProject('测试项目', 'iPhone')
    const sourceBoard = project.boards[0]
    const button = createComponent('Button', sourceBoard, project.boardSize, { x: 48, y: 64 })
    button.name = '主按钮'
    sourceBoard.components.push(button)
    useAppStore.getState().replaceProject(project)

    const { rerender } = render(<BoardStrip />)

    expect(screen.queryByRole('button', { name: /Delete Home/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Home' }))

    expect(screen.getByRole('button', { name: 'Create Copy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Create Copy' }))

    const boardsAfterDuplicate = useAppStore.getState().project?.boards ?? []
    expect(boardsAfterDuplicate).toHaveLength(2)
    expect(boardsAfterDuplicate[1]?.name).toContain('Copy')
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
    fireEvent.click(screen.getByRole('button', { name: `More actions for ${boardsAfterDuplicate[1]?.name}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(useAppStore.getState().project?.boards).toHaveLength(1)
  })

  it('names duplicated boards with copy semantics and avoids collisions', () => {
    const project = createProject('测试项目', 'Desktop')
    project.boards[0].name = 'Home'
    project.boards.push(createBoard('Home Copy'))
    project.boards.push(createBoard('Home Copy 2'))
    useAppStore.getState().replaceProject(project)

    render(<BoardStrip />)

    fireEvent.click(screen.getByRole('button', { name: /^More actions for Home$|^更多首页$/ }))
    fireEvent.click(screen.getByRole('button', { name: /Create Copy|创建副本/ }))

    const names = useAppStore.getState().project?.boards.map((board) => board.name) ?? []

    expect(names).toContain('Home Copy 3')
    expect(new Set(names).size).toBe(names.length)
  })

  it('marks clipped components in exported JSON and adds top-level instructions', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const inside = createComponent('Button', board, project.boardSize, { x: 48, y: 64 })
    inside.name = 'Inside'
    const clipped = createComponent('Card', board, project.boardSize, { x: 48, y: 64 })
    clipped.name = 'Clipped'
    clipped.x = -40
    clipped.y = 860
    clipped.width = 280
    clipped.height = 120
    board.components.push(inside, clipped)
    useAppStore.getState().replaceProject(project)

    const exported = JSON.parse(useAppStore.getState().exportProjectJson()) as {
      _instructions?: { clipped?: string }
      boards: Array<{ components: Array<{ name: string; clipped?: boolean }> }>
    }
    const exportedComponents = exported.boards[0]?.components ?? []

    expect(exported._instructions?.clipped).toBe(
      '如果一个组件的 clipped 为 true，说明它被画板边界截断了，其真实高度未知。还原时请参考同类型、同名称的其他组件高度，保持一致。',
    )
    expect(exportedComponents.find((component) => component.name === 'Inside')).not.toHaveProperty('clipped')
    expect(exportedComponents.find((component) => component.name === 'Clipped')?.clipped).toBe(true)
  })

  it('opens the board more menu upward', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardStrip />)

    fireEvent.click(screen.getByRole('button', { name: /More actions for Home|更多首页/ }))

    const stripRule = appStyles.match(/\.board-strip\s*\{[^}]*\}/)?.[0] ?? ''
    const stripListRule = appStyles.match(/\.board-strip__list\s*\{[^}]*\}/)?.[0] ?? ''
    const popoverRule = appStyles.match(/\.board-chip__menu-popover\s*\{[^}]*\}/)?.[0] ?? ''
    const directPopover = container.querySelector('.board-strip > .board-chip__menu-popover')

    expect(screen.getByRole('button', { name: /Create Copy|创建副本/ })).toBeTruthy()
    expect(directPopover).not.toBeNull()
    expect(stripRule).toContain('overflow: visible;')
    expect(stripRule).toContain('position: relative;')
    expect(stripListRule).toContain('overflow-x: auto;')
    expect(stripListRule).toContain('overflow-y: visible;')
    expect(popoverRule).toContain('position: absolute;')
    expect(popoverRule).toContain('z-index: 4;')
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

    const { container } = render(<InteractionPanel />)

    const items = container.querySelectorAll('.layer-list .layer-item')
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

  it('copies and pastes selected components with Cmd or Ctrl shortcuts', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const first = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    const second = createComponent('Button', board, project.boardSize, { x: 160, y: 160 })
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponents([first.id, second.id])

    render(<App />)

    fireEvent.keyDown(window, { key: 'c', metaKey: true })
    fireEvent.keyDown(window, { key: 'v', metaKey: true })

    const components = useAppStore.getState().project?.boards[0]?.components ?? []

    expect(components).toHaveLength(4)
    expect(components[2]?.id).not.toBe(first.id)
    expect(components[3]?.id).not.toBe(second.id)
    expect(components[2]?.x).toBe(first.x + 16)
    expect(components[2]?.y).toBe(first.y + 16)
    expect(components[3]?.x).toBe(second.x + 16)
    expect(components[3]?.y).toBe(second.y + 16)
  })

  it('auto-suffixes layer names to avoid duplicates', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    useAppStore.getState().addComponent('gallery', { x: 48, y: 48 })
    useAppStore.getState().addComponent('gallery', { x: 96, y: 96 })

    const names = useAppStore.getState().project?.boards[0]?.components.map((component) => component.name) ?? []

    expect(names).toEqual(['Gallery', 'Gallery1'])
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
    expect(screen.getByText('Description')).toBeTruthy()
    expect(screen.getByText('Attributes')).toBeTruthy()
    expect(screen.getByText('Trigger')).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(screen.queryByText('交互')).toBeNull()
    expect(screen.queryByText('图层')).toBeNull()
    expect(screen.queryByText('名称')).toBeNull()
  })

  it('edits the selected component description and type in place and exports description as info', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Button', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponent(component.id)

    render(<App />)

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Primary action' } })
    fireEvent.change(screen.getByLabelText('Attributes'), { target: { value: 'card' } })

    const selected = useAppStore.getState().project?.boards[0]?.components[0]
    const exported = JSON.parse(useAppStore.getState().exportProjectJson()) as {
      boards: Array<{ components: Array<{ type: string; info?: string; description?: string }> }>
    }
    const exportedComponent = exported.boards[0]?.components[0]

    expect(selected?.description).toBe('Primary action')
    expect(selected?.type).toBe('card')
    expect(exportedComponent?.type).toBe('card')
    expect(exportedComponent?.info).toBe('Primary action')
    expect(exportedComponent).not.toHaveProperty('description')
  })

  it('shows a modal description field when the interaction action is set to show modal', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Button', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponent(component.id)
    useAppStore.getState().addInteraction(component.id)

    render(<InteractionPanel />)

    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'showModal' } })

    expect(screen.queryByText('Select Modal')).toBeNull()
    expect(screen.getByLabelText('Modal Content')).toBeTruthy()
  })

  it('shows hover feedback for layer drag targets', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    board.components.push(
      createComponent('Card', board, project.boardSize, { x: 48, y: 48 }),
      createComponent('Button', board, project.boardSize, { x: 96, y: 160 }),
    )
    useAppStore.getState().replaceProject(project)

    const { container } = render(<InteractionPanel />)

    const items = container.querySelectorAll('.layer-list .layer-item')
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

  it('shows only the layer primary name without a secondary type line', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const footer = createComponent('footer', board, project.boardSize, { x: 48, y: 48 })
    footer.name = 'Footer Area'
    board.components.push(footer)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<InteractionPanel />)
    const layerItem = container.querySelector('.layer-item')

    expect(layerItem?.textContent).toContain('Footer Area')
    expect(layerItem?.querySelector('small')).toBeNull()
    expect(layerItem?.textContent).not.toContain('footer')
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


  it('auto-focuses the most recently selected layer item', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const first = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    const second = createComponent('Button', board, project.boardSize, { x: 96, y: 160 })
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<InteractionPanel />)
    const target = Array.from(container.querySelectorAll('.layer-item')).find((item) =>
      item.textContent?.includes(second.name),
    ) as HTMLButtonElement | undefined

    expect(target).toBeTruthy()

    scrollIntoViewMock.mockReset()
    fireEvent.click(target as HTMLButtonElement)

    expect(scrollIntoViewMock).toHaveBeenCalled()
    expect(scrollIntoViewMock.mock.contexts.at(-1)).toBe(target)
  })

  it('keeps the component selected when clicking its already-selected layer row', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const block = container.querySelector('.wireframe-block')

    expect(block).not.toBeNull()

    fireEvent.pointerDown(block as Element, {
      button: 0,
      clientX: 60,
      clientY: 60,
    })
    fireEvent.click(block as Element)

    const layerItem = container.querySelector('.layer-list .layer-item') as HTMLButtonElement | null

    expect(layerItem).not.toBeNull()

    fireEvent.click(layerItem as HTMLButtonElement)

    expect(useAppStore.getState().selectedComponentId).toBe(component.id)
    expect(useAppStore.getState().selectedComponentIds).toEqual([component.id])
    expect(container.querySelector('.wireframe-block')?.className).toContain('is-selected')
  })

  it('auto-focuses the newest board chip after adding a board', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardStrip />)
    scrollIntoViewMock.mockReset()

    fireEvent.click(screen.getByRole('button', { name: '+ New Board' }))

    const latestBoard = container.querySelectorAll('.board-chip')
    expect(useAppStore.getState().project?.boards).toHaveLength(2)
    expect(scrollIntoViewMock).toHaveBeenCalled()
    expect(scrollIntoViewMock.mock.contexts.at(-1)).toBe(latestBoard[latestBoard.length - 1])
  })
})
