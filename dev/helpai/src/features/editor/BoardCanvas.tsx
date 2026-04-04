/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import {
  Circle,
  Ellipse,
  Group,
  Label,
  Layer,
  Line,
  Rect,
  Stage,
  Tag,
  Text,
  Transformer,
} from 'react-konva'

import { constrainElement, snapToGrid } from '../../lib/project'
import { resolvePreviewElement } from '../../lib/preview'
import type {
  PreviewSession,
  PrototypeBoard,
  PrototypeElement,
  PrototypeProject,
  ToolType,
} from '../../types/prototype'

type EditablePatch = Partial<PrototypeElement>

interface BoardCanvasProps {
  board: PrototypeBoard
  project: PrototypeProject
  mode: 'editor' | 'preview'
  activeTool?: ToolType
  selectedElementId?: string | null
  showSemanticLabels?: boolean
  previewSession?: PreviewSession
  onSelectBoard?: () => void
  onSelectElement?: (elementId: string | null) => void
  onCreateElement?: (type: Exclude<ToolType, 'select'>, point: { x: number; y: number }) => void
  onUpdateElement?: (elementId: string, patch: EditablePatch) => void
  onContextMenu?: (input: { elementId: string; x: number; y: number }) => void
  onPreviewTrigger?: (element: PrototypeElement) => void
}

function renderShape(element: PrototypeElement) {
  if (element.type === 'rect') {
    return (
      <Rect
        width={element.width}
        height={element.height}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        cornerRadius={element.cornerRadius}
        opacity={element.opacity}
      />
    )
  }

  if (element.type === 'circle') {
    return (
      <Circle
        x={element.width / 2}
        y={element.height / 2}
        radius={Math.min(element.width, element.height) / 2}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        opacity={element.opacity}
      />
    )
  }

  if (element.type === 'ellipse') {
    return (
      <Ellipse
        x={element.width / 2}
        y={element.height / 2}
        radiusX={element.width / 2}
        radiusY={element.height / 2}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        opacity={element.opacity}
      />
    )
  }

  if (element.type === 'line') {
    return (
      <Line
        points={[0, 0, element.width, element.height]}
        stroke={element.stroke}
        strokeWidth={Math.max(2, element.strokeWidth)}
        opacity={element.opacity}
      />
    )
  }

  if (element.type === 'image_placeholder') {
    return (
      <>
        <Rect
          width={element.width}
          height={element.height}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          cornerRadius={element.cornerRadius}
          opacity={element.opacity}
        />
        <Line
          points={[16, 16, element.width - 16, element.height - 16]}
          stroke={element.stroke}
          strokeWidth={1.5}
        />
        <Line
          points={[element.width - 16, 16, 16, element.height - 16]}
          stroke={element.stroke}
          strokeWidth={1.5}
        />
      </>
    )
  }

  return (
    <Text
      width={element.width}
      height={element.height}
      text={element.text || '文本'}
      fontSize={element.fontSize}
      fill="#111827"
      fontFamily="Manrope"
      verticalAlign="middle"
    />
  )
}

export function BoardCanvas(props: BoardCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null)
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const nodeRefs = useRef<Record<string, Konva.Group | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const elements = useMemo(
    () =>
      props.board.elements
        .map((element) =>
          props.mode === 'preview' && props.previewSession
            ? resolvePreviewElement(props.previewSession, element)
            : element,
        )
        .filter((element) => element.visible),
    [props.board.elements, props.mode, props.previewSession],
  )

  const editingElement = elements.find((element) => element.id === editingElementId) ?? null
  const updateElement = props.onUpdateElement

  useEffect(() => {
    if (props.mode !== 'editor') {
      return
    }

    const transformer = transformerRef.current

    if (!transformer) {
      return
    }

    const selectedNode = props.selectedElementId
      ? nodeRefs.current[props.selectedElementId] ?? null
      : null

    if (selectedNode) {
      transformer.nodes([selectedNode])
    } else {
      transformer.nodes([])
    }

    transformer.getLayer()?.batchDraw()
  }, [props.mode, props.selectedElementId])

  const handleCanvasPointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    props.onSelectBoard?.()

    if (props.mode !== 'editor') {
      return
    }

    const stage = stageRef.current

    if (!stage) {
      return
    }

    const clickedOnEmpty =
      event.target === stage || event.target.getParent() === stage.findOne('Layer')

    if (!clickedOnEmpty) {
      return
    }

    props.onSelectElement?.(null)

    if (!props.activeTool || props.activeTool === 'select' || !props.onCreateElement) {
      return
    }

    const pointer = stage.getPointerPosition()

    if (!pointer) {
      return
    }

    props.onCreateElement(props.activeTool, {
      x: snapToGrid(pointer.x),
      y: snapToGrid(pointer.y),
    })
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (props.mode !== 'editor' || !props.onCreateElement) {
      return
    }

    const tool = event.dataTransfer.getData('application/helpai-tool') as ToolType

    if (!tool || tool === 'select') {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    props.onCreateElement(tool, {
      x: snapToGrid(event.clientX - bounds.left),
      y: snapToGrid(event.clientY - bounds.top),
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-[28px] border border-slate-200 bg-white shadow-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={props.board.width}
        height={props.board.height}
        onMouseDown={handleCanvasPointerDown}
        onTouchStart={handleCanvasPointerDown}
        style={{ display: 'block' }}
      >
        <Layer>
          <Rect width={props.board.width} height={props.board.height} fill="#ffffff" />

          {elements.map((element) => {
            const labelY = element.y > 24 ? -24 : element.height + 6

            return (
              <Group
                key={element.id}
                ref={(node) => {
                  nodeRefs.current[element.id] = node
                }}
                x={element.x}
                y={element.y}
                draggable={props.mode === 'editor'}
                onClick={() => {
                  if (props.mode === 'preview') {
                    props.onPreviewTrigger?.(element)
                    return
                  }

                  props.onSelectBoard?.()
                  props.onSelectElement?.(element.id)
                }}
                onTap={() => {
                  if (props.mode === 'preview') {
                    props.onPreviewTrigger?.(element)
                  }
                }}
                onDblClick={() => {
                  if (props.mode === 'editor' && (element.type === 'text' || element.text)) {
                    props.onSelectElement?.(element.id)
                    setEditingValue(element.text)
                    setEditingElementId(element.id)
                  }
                }}
                onContextMenu={(event) => {
                  if (props.mode !== 'editor') {
                    return
                  }

                  event.evt.preventDefault()
                  props.onSelectElement?.(element.id)
                  props.onContextMenu?.({
                    elementId: element.id,
                    x: event.evt.clientX,
                    y: event.evt.clientY,
                  })
                }}
                onDragStart={() => {
                  if (props.mode !== 'editor') {
                    return
                  }

                  props.onSelectBoard?.()
                  props.onSelectElement?.(element.id)
                }}
                onDragEnd={(event) => {
                  if (props.mode !== 'editor' || !props.onUpdateElement) {
                    return
                  }

                  const next = constrainElement(
                    {
                      ...element,
                      x: snapToGrid(event.target.x(), !event.evt.shiftKey),
                      y: snapToGrid(event.target.y(), !event.evt.shiftKey),
                    },
                    props.board,
                  )
                  props.onUpdateElement(element.id, {
                    x: next.x,
                    y: next.y,
                  })
                }}
                onTransformEnd={(event) => {
                  if (props.mode !== 'editor' || !props.onUpdateElement) {
                    return
                  }

                  const node = event.target
                  const scaleX = node.scaleX()
                  const scaleY = node.scaleY()
                  node.scaleX(1)
                  node.scaleY(1)

                  const next = constrainElement(
                    {
                      ...element,
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(24, element.width * scaleX),
                      height:
                        element.type === 'line'
                          ? element.height * scaleY
                          : Math.max(24, element.height * scaleY),
                    },
                    props.board,
                  )

                  props.onUpdateElement(element.id, {
                    x: next.x,
                    y: next.y,
                    width: next.width,
                    height: next.height,
                  })
                }}
              >
                {renderShape(element)}

                {element.type !== 'text' && element.text ? (
                  <Text
                    width={element.width}
                    height={element.height}
                    text={element.text}
                    align="center"
                    verticalAlign="middle"
                    fill="#111827"
                    fontSize={element.fontSize}
                    fontFamily="Manrope"
                  />
                ) : null}

                {props.mode === 'editor' && props.showSemanticLabels ? (
                  <Label x={0} y={labelY}>
                    <Tag fill="#0f172a" opacity={0.92} cornerRadius={999} />
                    <Text
                      text={element.name}
                      fontSize={10}
                      padding={6}
                      fill="#f8fafc"
                      fontFamily="JetBrains Mono"
                    />
                  </Label>
                ) : null}

                {element.interactions.length > 0 ? (
                  <Label x={element.width - 20} y={-18}>
                    <Tag fill="#f59e0b" cornerRadius={999} />
                    <Text text="⚡" padding={4} fontSize={10} fill="#111827" />
                  </Label>
                ) : null}
              </Group>
            )
          })}

          {props.mode === 'editor' ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              anchorCornerRadius={999}
              anchorFill="#ffffff"
              anchorStroke="#111827"
              anchorStrokeWidth={1}
              borderDash={[6, 4]}
            />
          ) : null}
        </Layer>
      </Stage>

      {props.mode === 'editor' && editingElement && updateElement ? (
        <textarea
          autoFocus
          className="absolute resize-none rounded-xl border border-slate-300 bg-white/95 px-2 py-1 text-sm text-slate-900 shadow-lg outline-none"
          style={{
            left: editingElement.x,
            top: editingElement.y,
            width: editingElement.width,
            minHeight: Math.max(36, editingElement.height),
            fontSize: editingElement.fontSize,
          }}
          value={editingValue}
          onChange={(event) => setEditingValue(event.target.value)}
          onBlur={() => {
            updateElement(editingElement.id, { text: editingValue })
            setEditingElementId(null)
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              updateElement(editingElement.id, { text: editingValue })
              setEditingElementId(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
