/// <reference types="node" />
/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 当前覆盖浏览器语言自动检测、无手动语言入口、无旧 toolbar/preview、右栏导出/复制/GitHub logo 入口、去弹窗组件化、弹窗描述交互、左上角浮动项目名、顶部居中悬浮组件工具栏、无左栏 sidebar、七类组件入口、标题结构一致、图层/画板自动聚焦、Option 拖动复制、快捷键复制粘贴、副本命名防重、图层名草稿编辑、图层主名称展示与拖拽 grip 提示、组件选中态强化、组件越界编辑与 clipped/手绘容差/禁 emoji 导出、组件自由缩放移动、画板更多菜单、右栏文案与批量态、组件放置、多选框选、图层拖拽与画板重名、描述字段与属性切换回归
3. 新增待放置期间禁止选中其他图层、placement toast 可点击退出放置、复制 JSON 成功 toast、GitHub logo 跳转、拖动一次性 undo 与放置锁定选中态的回归
4. 覆盖 setup 弹层居中、导出操作区 60px 高度、GitHub 60px 方形入口与画板菜单提层
5. 覆盖 canvas stage 完整显示画板且无外壳视觉
6. 更新后检查所属 `.folder.md`
*/

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { BoardCanvas } from './BoardCanvas'
import { BoardStrip } from './BoardStrip'
import { ComponentPalette } from './ComponentPalette'
import { InteractionPanel } from './InteractionPanel'
import { SetupDialog } from './SetupDialog'
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
  const navigatorValue = { languages, language } as Navigator

  Object.defineProperty(window, 'navigator', {
    configurable: true,
    value: navigatorValue,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: navigatorValue,
  })
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  setBrowserLanguage(['en-US'], 'en-US')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      if (this.classList.contains('canvas-shell')) {
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
      if (this.classList.contains('canvas-shell')) {
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

  it('centers the setup dialog in the full viewport', () => {
    const { container } = render(<SetupDialog onCreate={vi.fn()} />)
    const setupScreen = container.querySelector('.setup-screen')
    const dialog = setupScreen?.querySelector('.dialog')
    const setupRule = appStyles.match(/\.setup-screen\s*\{[^}]*\}/)?.[0] ?? ''

    expect(setupScreen).not.toBeNull()
    expect(dialog).not.toBeNull()
    expect(setupRule).toContain('min-height: 100vh;')
    expect(setupRule).toContain('width: 100vw;')
    expect(setupRule).toContain('display: flex;')
    expect(setupRule).toContain('align-items: center;')
    expect(setupRule).toContain('justify-content: center;')
  })

  it('uses a top-centered floating component toolbar without a left sidebar', () => {
    const project = createProject('测试项目', 'iPhone')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<App />)
    const workspaceRule = appStyles.match(/\.workspace\s*\{[^}]*\}/)?.[0] ?? ''
    const toolbarRule = appStyles.match(/\.component-toolbar\s*\{[^}]*\}/)?.[0] ?? ''
    const projectRule = appStyles.match(/\.project-float\s*\{[^}]*\}/)?.[0] ?? ''
    const workspaceCenter = container.querySelector('.workspace__center')

    expect(container.querySelector('.workspace__sidebar--left')).toBeNull()
    expect(container.querySelector('.component-toolbar')).not.toBeNull()
    expect(workspaceCenter?.querySelector('.component-toolbar')).not.toBeNull()
    expect(workspaceCenter?.querySelector('.project-float__input')).not.toBeNull()
    expect(container.querySelector('.workspace > .workspace__center')).not.toBeNull()
    expect(container.querySelector('.workspace > .workspace__sidebar--right')).not.toBeNull()
    expect(workspaceRule).toContain('grid-template-columns: minmax(0, 1fr) 276px;')
    expect(toolbarRule).toContain('position: absolute;')
    expect(toolbarRule).toContain('top: 14px;')
    expect(toolbarRule).toContain('left: 50%;')
    expect(toolbarRule).toContain('transform: translateX(-50%);')
    expect(projectRule).toContain('position: absolute;')
    expect(projectRule).toContain('left: 14px;')
    expect(screen.queryByRole('heading', { name: 'Components' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New Page' })).toBeNull()
    expect(screen.queryByText('Purpose')).toBeNull()
    expect(container.querySelector('.palette-footer')).toBeNull()
    expect(container.querySelector('.toolbar .toolbar__project-name')).toBeNull()
    expect(container.querySelector('.panel__header--palette')).toBeNull()
    expect(screen.getAllByLabelText('Project Name')).toHaveLength(1)
    expect(screen.getByRole('toolbar', { name: 'Component toolbar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Input$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Commerce$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Button$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Modal$/i })).toBeNull()
    expect(screen.queryByText('140 × 40')).toBeNull()
  })

  it('shows the seven low-semantic component categories in the palette', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<ComponentPalette />)
    const toolbar = screen.getByRole('toolbar', { name: 'Component toolbar' })

    expect(container.querySelectorAll('.component-toolbar__button')).toHaveLength(8)
    expect(toolbar).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Layout' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Content' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Input' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Navigation' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Feedback' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Media' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Commerce' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Generic Block|通用块/ })).toBeNull()
  })

  it('keeps the project name editable when cleared', () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    render(<ComponentPalette />)
    const input = screen.getByLabelText('Project Name') as HTMLInputElement

    expect(input.closest('.project-float')).not.toBeNull()

    fireEvent.change(input, { target: { value: 'T' } })
    expect(input.value).toBe('T')
    expect(useAppStore.getState().project?.project).toBe('T')

    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
    expect(useAppStore.getState().project?.project).toBe('')
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

    const { container } = render(<BoardCanvas />)
    const emptyState = container.querySelector('.canvas-empty-state') as HTMLDivElement | null
    const emptyStateRule = appStyles.match(/\.canvas-empty-state\s*\{[^}]*\}/)?.[0] ?? ''

    expect(screen.getByText('Select a component, then drag/click to place it.')).toBeTruthy()
    expect(screen.queryByText('New Page')).toBeNull()
    expect(screen.queryByText('Pick a component and click or drag on canvas.')).toBeNull()
    expect(emptyState?.style.transform).toBe('translate(-50%, -50%) scale(2)')
    expect(emptyStateRule).toContain('padding: 14px;')
    expect(emptyStateRule).toContain('border-radius: 10px;')
    expect(emptyStateRule).toContain('font-size: 14px;')
    expect(emptyStateRule).toContain('line-height: 1.45;')
  })

  it('renders export, copy, and GitHub buttons in the action row and keeps actions working', async () => {
    const project = createProject('Test Project', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const createObjectURLMock = vi.fn(() => 'blob:test')
    const revokeObjectURLMock = vi.fn()
    const anchorClickMock = vi.fn()
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    const openMock = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: openMock,
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

    const { container } = render(<InteractionPanel />)
    const exportButton = screen.getByRole('button', { name: 'Export JSON' })
    const copyButton = screen.getByRole('button', { name: 'Copy JSON' })
    const githubButton = screen.getByRole('button', { name: 'GitHub' })
    const buttonGroup = container.querySelector('.panel__export-actions')
    const actionsRule = appStyles.match(/\.panel__export-actions\s*\{[^}]*\}/)?.[0] ?? ''
    const exportRule = appStyles.match(/\.panel__export-button\s*\{[^}]*\}/)?.[0] ?? ''
    const copyRule = appStyles.match(/\.panel__copy-button\s*\{[^}]*\}/)?.[0] ?? ''
    const githubRule = appStyles.match(/\.panel__github-button\s*\{[^}]*\}/)?.[0] ?? ''

    expect(buttonGroup).not.toBeNull()
    expect(buttonGroup?.children).toHaveLength(3)
    expect(buttonGroup?.children[0]).toBe(exportButton)
    expect(buttonGroup?.children[1]).toBe(copyButton)
    expect(buttonGroup?.children[2]).toBe(githubButton)
    expect(exportButton.className).not.toContain('panel__export-button--primary')
    expect(actionsRule).toContain('height: 60px;')
    expect(exportRule).toContain('flex: 2;')
    expect(copyRule).toContain('flex: 1;')
    expect(githubRule).toContain('flex: 0 0 60px;')
    expect(githubRule).toContain('width: 60px;')
    expect(githubRule).toContain('height: 60px;')
    expect(githubButton.querySelector('svg')).not.toBeNull()
    expect(appStyles).not.toContain('.panel__export-button--primary')

    fireEvent.click(copyButton)

    expect(writeTextMock).toHaveBeenCalledWith(useAppStore.getState().exportProjectJson())

    fireEvent.click(exportButton)

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(anchorClickMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalled()

    fireEvent.click(githubButton)

    expect(openMock).toHaveBeenCalledWith(
      'https://github.com/kaelem1/wireframe-for-llm',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('shows a restore hint toast after copy and export json succeed', async () => {
    vi.useFakeTimers()

    try {
      setBrowserLanguage(['zh-CN', 'en-US'], 'zh-CN')
      useAppStore.getState().loadWorkspace(null)

      const project = createProject('测试项目', 'Desktop')
      useAppStore.getState().replaceProject(project)

      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      const createObjectURLMock = vi.fn(() => 'blob:test')
      const revokeObjectURLMock = vi.fn()
      const anchorClickMock = vi.fn()
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

      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: '复制 JSON' }))

      expect(writeTextMock).toHaveBeenCalledWith(useAppStore.getState().exportProjectJson())

      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('复制成功，发给AI还原吧～')).toBeTruthy()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })

      expect(screen.queryByText('复制成功，发给AI还原吧～')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: '导出 JSON' }))

      expect(createObjectURLMock).toHaveBeenCalled()
      expect(anchorClickMock).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalled()
      expect(screen.getByText('导出成功，发给AI还原吧～')).toBeTruthy()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })

      expect(screen.queryByText('导出成功，发给AI还原吧～')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not expose a custom device size option on setup', () => {
    const { container } = render(<SetupDialog onCreate={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /自定义/ })).toBeNull()
    expect(screen.queryByText('手动输入尺寸')).toBeNull()
    expect(container.querySelector('.setup-screen__custom-size')).toBeNull()
  })

  it('keeps the layers section reachable when the interaction editor is long and the board has many layers', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const selected = createComponent('Button', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(selected)

    for (let index = 0; index < 11; index += 1) {
      board.components.push(
        createComponent(index % 2 === 0 ? 'Card' : 'Text', board, project.boardSize, {
          x: 96 + index * 8,
          y: 120 + index * 8,
        }),
      )
    }

    for (let index = 0; index < 12; index += 1) {
      selected.interactions.push({
        id: createId('interaction'),
        trigger: 'tap',
        action: 'navigate',
        target: board.id,
      })
    }

    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponent(selected.id)

    const { container } = render(<App />)
    const panelRule = appStyles.match(/\.panel\s*\{[^}]*\}/)?.[0] ?? ''
    const editorRule = appStyles.match(/\.panel__editor\s*\{[^}]*\}/)?.[0] ?? ''
    const inspectorRule =
      appStyles.match(/\.panel__section:not\(\.panel__section--layers\)\s*\{[^}]*\}/)?.[0] ?? ''
    const layersRule = appStyles.match(/\.panel__section--layers\s*\{[^}]*\}/)?.[0] ?? ''
    const layerListRule = appStyles.match(/\.layer-list\s*\{[^}]*\}/)?.[0] ?? ''

    expect(container.querySelectorAll('.interaction-card')).toHaveLength(12)
    expect(container.querySelectorAll('.layer-item')).toHaveLength(12)
    expect(panelRule).toContain('overflow: hidden;')
    expect(editorRule).toContain('overflow: auto;')
    expect(inspectorRule).toContain('flex: 1;')
    expect(inspectorRule).toContain('grid-template-rows: auto minmax(0, 1fr);')
    expect(layersRule).toContain('overflow: hidden;')
    expect(layerListRule).toContain('overflow: auto;')
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

    fireEvent.click(screen.getByRole('button', { name: /^Input$/i }))

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

    expect(placed?.type).toBe('input')
    expect(placed?.x).toBe(48)
    expect(placed?.y).toBe(72)
    expect(placed?.width).toBe(280)
    expect(placed?.height).toBe(56)
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

    fireEvent.click(screen.getByRole('button', { name: /^Input$/i }))

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

    expect(placed?.type).toBe('input')
    expect(placed?.x).toBe(40)
    expect(placed?.y).toBe(56)
    expect(placed?.width).toBe(184)
    expect(placed?.height).toBeCloseTo(64)
  })

  it('creates a media component at its new category default size', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /^Media$/i }))

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
    expect(placed?.type).toBe('media')
    expect(placed?.width).toBe(480)
    expect(placed?.height).toBe(270)
  })

  it('keeps a newly placed component in a placement-locked highlight without resize handles', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /^Input$/i }))

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

    const block = container.querySelector('.wireframe-block')

    expect(useAppStore.getState().pendingComponentType).toBe('input')
    expect(block?.className).toContain('is-placement-locked')
    expect(block?.className).not.toContain('is-selected')
    expect(container.querySelector('.canvas-selection')).toBeNull()
    expect(container.querySelector('.canvas-selection__handle')).toBeNull()
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

  it('allows layout and navigation components to move and resize freely', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const layout = createComponent('layout', board, project.boardSize, { x: 48, y: 40 })
    const navigation = createComponent('navigation', board, project.boardSize, { x: 88, y: 152 })
    board.components.push(layout, navigation)
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
      clientX: (layout.x + layout.width) * scale,
      clientY: (layout.y + layout.height) * scale,
    })
    fireEvent.pointerMove(window, {
      clientX: 320 * scale,
      clientY: 220 * scale,
    })
    fireEvent.pointerUp(window, {
      clientX: 320 * scale,
      clientY: 220 * scale,
    })

    const resizedLayout = useAppStore.getState().project?.boards[0]?.components[0]
    expect(resizedLayout?.width).not.toBe(project.boardSize.width)
    expect(resizedLayout?.height).not.toBe(layout.height)

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

    const movedLayout = useAppStore.getState().project?.boards[0]?.components[0]
    expect(movedLayout?.x).not.toBe(0)
    expect(movedLayout?.y).not.toBe(0)

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

  it('fits the full board without canvas stage outer chrome and removes manual zoom controls', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardCanvas />)
    const stage = container.querySelector('.canvas-stage') as HTMLDivElement | null
    const viewport = container.querySelector('.canvas-stage__viewport') as HTMLDivElement | null
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null
    const stageRule = appStyles.match(/\.canvas-stage\s*\{[^}]*\}/)?.[0] ?? ''
    const viewportRule = appStyles.match(/\.canvas-stage__viewport\s*\{[^}]*\}/)?.[0] ?? ''

    expect(screen.queryByLabelText('缩小画板')).toBeNull()
    expect(screen.queryByLabelText('放大画板')).toBeNull()
    expect(screen.queryByLabelText('当前画板缩放')).toBeNull()
    expect(stageRule).toContain('padding: 0;')
    expect(stageRule).toContain('flex: 0 0 auto;')
    expect(stageRule).toContain('align-items: center;')
    expect(stageRule).toContain('justify-content: center;')
    expect(stageRule).toContain('overflow: hidden;')
    expect(stageRule).toContain('border: 0;')
    expect(stageRule).toContain('border-radius: 0;')
    expect(stageRule).toContain('background: transparent;')
    expect(stageRule).toContain('box-shadow: none;')
    expect(viewportRule).toContain('flex: 0 0 auto;')
    expect(stage?.style.width).toBe('720px')
    expect(stage?.style.height).toBe('450px')
    expect(viewport?.style.width).toBe('720px')
    expect(viewport?.style.height).toBe('450px')
    expect(viewport?.style.minWidth).toBe('')
    expect(viewport?.style.minHeight).toBe('')
    expect(canvas?.style.left).toBe('0px')
    expect(canvas?.style.top).toBe('0px')
    expect(canvas?.style.transform).toBe('scale(0.5)')
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
    const paletteButton = screen.getByRole('button', { name: /^Input$/i })
    const selectButton = screen.getByRole('button', { name: 'Select' })
    const canvas = container.querySelector('.board-canvas') as HTMLDivElement | null

    expect(canvas).not.toBeNull()
    useAppStore.getState().selectComponent(null)
    expect(selectButton.className).toContain('is-active')

    fireEvent.click(paletteButton)

    expect(paletteButton.className).toContain('is-active')
    expect(selectButton.className).not.toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('input')
    expect(screen.getByRole('button', { name: '退出放置' })).toBeTruthy()
    fireEvent.click(selectButton)
    expect(useAppStore.getState().pendingComponentType).toBeNull()
    expect(selectButton.className).toContain('is-active')

    fireEvent.click(paletteButton)
    expect(useAppStore.getState().pendingComponentType).toBe('input')
    fireEvent.click(paletteButton)
    expect(useAppStore.getState().pendingComponentType).toBeNull()

    fireEvent.click(paletteButton)
    expect(useAppStore.getState().pendingComponentType).toBe('input')
    fireEvent.click(screen.getByRole('button', { name: '退出放置' }))
    expect(useAppStore.getState().pendingComponentType).toBeNull()

    fireEvent.click(paletteButton)
    expect(useAppStore.getState().pendingComponentType).toBe('input')
    const selectedBefore = useAppStore.getState().selectedComponentId

    const existingBlock = container.querySelector('.wireframe-block')
    const layerItem = container.querySelector('.layer-list .layer-item') as HTMLButtonElement | null

    expect(existingBlock).not.toBeNull()
    expect(layerItem).not.toBeNull()

    fireEvent.click(layerItem as HTMLButtonElement)

    expect(paletteButton.className).toContain('is-active')
    expect(useAppStore.getState().pendingComponentType).toBe('input')
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

  it('marks clipped components in exported JSON and adds export notes', () => {
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
      _instructions?: { clipped?: string; layoutTolerance?: string; noEmoji?: string }
      instruction?: string
      boards: Array<{ components: Array<{ name: string; clipped?: boolean }> }>
    }
    const exportedComponents = exported.boards[0]?.components ?? []

    expect(exported._instructions?.clipped).toBe(
      '如果一个组件的 clipped 为 true，说明它被画板边界截断了，其真实高度未知。还原时请参考同类型、同名称的其他组件高度，保持一致。',
    )
    expect(exported._instructions?.layoutTolerance).toBe(
      '手绘线框重在结构与交互，位置尺寸仅供参考，不必严格对齐。',
    )
    expect(exported._instructions?.noEmoji).toBe('输出界面不得包含任何 emoji 符号。')
    expect(exported.instruction).toContain('prioritize structure and interaction')
    expect(exported.instruction).toContain('do not use emoji')
    expect(exportedComponents.find((component) => component.name === 'Inside')).not.toHaveProperty('clipped')
    expect(exportedComponents.find((component) => component.name === 'Clipped')?.clipped).toBe(true)
  })

  it('opens the board more menu upward', () => {
    const project = createProject('测试项目', 'Desktop')
    useAppStore.getState().replaceProject(project)

    const { container } = render(<BoardStrip />)
    const moreButton = container.querySelector('.board-chip__more')

    expect(moreButton).not.toBeNull()
    fireEvent.click(moreButton as Element)

    const stripRule = appStyles.match(/\.board-strip\s*\{[^}]*\}/)?.[0] ?? ''
    const stripListRule = appStyles.match(/\.board-strip__list\s*\{[^}]*\}/)?.[0] ?? ''
    const popoverRule = appStyles.match(/\.board-chip__menu-popover\s*\{[^}]*\}/)?.[0] ?? ''
    const directPopover = container.querySelector('.board-strip > .board-chip__menu-popover')
    const openChip = container.querySelector('.board-chip.is-active.is-menu-open')

    expect(screen.getByRole('button', { name: /Create Copy|创建副本/ })).toBeTruthy()
    expect(directPopover).not.toBeNull()
    expect(openChip).not.toBeNull()
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

  it('keeps layer name typing as a draft until committing', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const first = createComponent('Button', board, project.boardSize, { x: 48, y: 48 })
    const second = createComponent('Card', board, project.boardSize, { x: 96, y: 96 })
    first.name = 'Name'
    second.name = 'Layer'
    board.components.push(first, second)
    useAppStore.getState().replaceProject(project)
    useAppStore.getState().selectComponent(second.id)

    render(<InteractionPanel />)
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: '' } })

    expect(nameInput.value).toBe('')
    expect(useAppStore.getState().project?.boards[0]?.components[1]?.name).toBe('Layer')

    fireEvent.blur(nameInput)

    expect(document.activeElement).toBe(nameInput)
    expect(useAppStore.getState().project?.boards[0]?.components[1]?.name).toBe('Layer')

    fireEvent.change(nameInput, { target: { value: 'Name' } })

    expect(nameInput.value).toBe('Name')
    expect(useAppStore.getState().project?.boards[0]?.components[1]?.name).toBe('Layer')

    fireEvent.blur(nameInput)

    expect(useAppStore.getState().project?.boards[0]?.components[1]?.name).toBe('Name1')
    expect(nameInput.value).toBe('Name1')
  })

  it('uses a consistent English label system in the side panels', () => {
    const project = createProject('测试项目', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('input', board, project.boardSize, { x: 48, y: 48 })
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
    fireEvent.change(screen.getByLabelText('Attributes'), { target: { value: 'content' } })

    const selected = useAppStore.getState().project?.boards[0]?.components[0]
    const exported = JSON.parse(useAppStore.getState().exportProjectJson()) as {
      boards: Array<{ components: Array<{ type: string; info?: string; description?: string }> }>
    }
    const exportedComponent = exported.boards[0]?.components[0]

    expect(selected?.description).toBe('Primary action')
    expect(selected?.type).toBe('content')
    expect(exportedComponent?.type).toBe('content')
    expect(exportedComponent?.info).toBe('Primary action')
    expect(exportedComponent).not.toHaveProperty('description')
  })

  it('shows a modal description field when the interaction action is set to show modal', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('input', board, project.boardSize, { x: 48, y: 48 })
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

  it('shows a drag grip beside each layer name', () => {
    const project = createProject('Test Project', 'Desktop')
    const board = project.boards[0]
    const component = createComponent('Card', board, project.boardSize, { x: 48, y: 48 })
    board.components.push(component)
    useAppStore.getState().replaceProject(project)

    const { container } = render(<InteractionPanel />)
    const layerItem = container.querySelector('.layer-list .layer-item')
    const grip = layerItem?.querySelector('.layer-item__grip')

    expect(layerItem).not.toBeNull()
    expect(grip).not.toBeNull()
    expect(grip?.getAttribute('aria-hidden')).toBe('true')
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
