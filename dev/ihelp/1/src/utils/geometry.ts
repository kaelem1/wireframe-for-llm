/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import type { AlignmentGuide, BoardComponent, Position, Size, SnapResult } from '../types/schema'
import { COMPONENT_META, GRID_SIZE } from './catalog'

const SNAP_THRESHOLD = 4

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function constrainFrame(
  component: BoardComponent,
  boardSize: Size,
  frame: Position & Size,
): Position & Size {
  const meta = COMPONENT_META[component.type]
  const width = meta.fullWidth
    ? boardSize.width
    : clamp(snapToGrid(frame.width), meta.minSize.width, boardSize.width)
  const height = clamp(snapToGrid(frame.height), meta.minSize.height, boardSize.height)

  if (meta.dock === 'top') {
    return { x: 0, y: 0, width: boardSize.width, height }
  }
  if (meta.dock === 'bottom') {
    return { x: 0, y: boardSize.height - height, width: boardSize.width, height }
  }

  return {
    x: meta.fullWidth ? 0 : clamp(snapToGrid(frame.x), 0, boardSize.width - width),
    y:
      meta.dock === 'center'
        ? clamp(snapToGrid(frame.y), 0, boardSize.height - height)
        : clamp(snapToGrid(frame.y), 0, boardSize.height - height),
    width,
    height,
  }
}

export function getSnapResult(
  frame: Position & Size,
  movingId: string,
  boardSize: Size,
  components: BoardComponent[],
): SnapResult {
  let nextFrame = {
    x: snapToGrid(frame.x),
    y: snapToGrid(frame.y),
    width: snapToGrid(frame.width),
    height: snapToGrid(frame.height),
  }
  const guides: AlignmentGuide[] = []
  const candidatesX = [0, boardSize.width / 2, boardSize.width]
  const candidatesY = [0, boardSize.height / 2, boardSize.height]

  components
    .filter((component) => component.id !== movingId)
    .forEach((component) => {
      candidatesX.push(component.x, component.x + component.width / 2, component.x + component.width)
      candidatesY.push(component.y, component.y + component.height / 2, component.y + component.height)
    })

  const xTargets = [nextFrame.x, nextFrame.x + nextFrame.width / 2, nextFrame.x + nextFrame.width]
  const yTargets = [nextFrame.y, nextFrame.y + nextFrame.height / 2, nextFrame.y + nextFrame.height]

  candidatesX.forEach((value) => {
    xTargets.forEach((target, index) => {
      if (Math.abs(target - value) <= SNAP_THRESHOLD) {
        nextFrame.x =
          index === 0 ? snapToGrid(value) : index === 1 ? snapToGrid(value - nextFrame.width / 2) : snapToGrid(value - nextFrame.width)
        guides.push({ axis: 'x', value })
      }
    })
  })

  candidatesY.forEach((value) => {
    yTargets.forEach((target, index) => {
      if (Math.abs(target - value) <= SNAP_THRESHOLD) {
        nextFrame.y =
          index === 0 ? snapToGrid(value) : index === 1 ? snapToGrid(value - nextFrame.height / 2) : snapToGrid(value - nextFrame.height)
        guides.push({ axis: 'y', value })
      }
    })
  })

  return { frame: nextFrame, guides }
}
