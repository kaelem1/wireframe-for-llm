/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Ellipse,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer
} from "react-konva";
import type {
  ArtboardSize,
  PrototypeBoard,
  PrototypeElement,
  ShapeType,
  ToolType
} from "../types";
import { addGridSnap, clamp, round } from "../utils";

interface PreviewConfig {
  enabled: boolean;
  toggled: Record<string, boolean>;
  hidden: Record<string, boolean>;
  onActivate: (element: PrototypeElement) => void;
}

interface BoardCanvasProps {
  board: PrototypeBoard;
  artboardSize: ArtboardSize;
  activeTool: ToolType;
  selectedElementId: string | null;
  showElementNames: boolean;
  isSelectedBoard: boolean;
  preview?: PreviewConfig;
  onSelectBoard: () => void;
  onSelectElement: (elementId: string | null) => void;
  onAddElement: (type: ShapeType, position: { x: number; y: number }) => void;
  onUpdateElement: (
    elementId: string,
    patch: Partial<PrototypeElement>,
    trackHistory?: boolean
  ) => void;
  onContextMenu: (position: { x: number; y: number }, elementId: string) => void;
}

function renderShape(element: PrototypeElement, preview?: PreviewConfig) {
  const isToggled = preview?.enabled && preview.toggled[element.id];
  const fill = isToggled ? "#dbeafe" : element.fill;
  const stroke = isToggled ? "#2563eb" : element.stroke;

  if (element.type === "rect" || element.type === "image_placeholder") {
    return (
      <>
        <Rect
          width={element.width}
          height={element.height}
          fill={fill}
          stroke={stroke}
          strokeWidth={element.strokeWidth}
          cornerRadius={element.cornerRadius}
          opacity={element.opacity}
        />
        {element.type === "image_placeholder" ? (
          <>
            <Line
              points={[12, 12, element.width - 12, element.height - 12]}
              stroke={stroke}
              strokeWidth={2}
              opacity={element.opacity}
            />
            <Line
              points={[element.width - 12, 12, 12, element.height - 12]}
              stroke={stroke}
              strokeWidth={2}
              opacity={element.opacity}
            />
          </>
        ) : null}
      </>
    );
  }

  if (element.type === "circle" || element.type === "ellipse") {
    return (
      <Ellipse
        x={element.width / 2}
        y={element.height / 2}
        radiusX={element.type === "circle" ? Math.min(element.width, element.height) / 2 : element.width / 2}
        radiusY={element.type === "circle" ? Math.min(element.width, element.height) / 2 : element.height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={element.strokeWidth}
        opacity={element.opacity}
      />
    );
  }

  if (element.type === "line") {
    return (
      <>
        <Rect
          width={Math.max(8, element.width)}
          height={Math.max(8, element.height + element.strokeWidth)}
          fill="transparent"
        />
        <Line
          points={[0, 0, element.width, element.height]}
          stroke={stroke}
          strokeWidth={element.strokeWidth}
          opacity={element.opacity}
        />
      </>
    );
  }

  return (
    <Text
      width={element.width}
      height={element.height}
      text={element.text}
      fontSize={element.fontSize}
      fill={fill}
      opacity={element.opacity}
      padding={2}
    />
  );
}

export function BoardCanvas({
  board,
  artboardSize,
  activeTool,
  selectedElementId,
  showElementNames,
  isSelectedBoard,
  preview,
  onSelectBoard,
  onSelectElement,
  onAddElement,
  onUpdateElement,
  onContextMenu
}: BoardCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Group | null>>({});
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const editingElement = useMemo(
    () => board.elements.find((element) => element.id === editingTextId) ?? null,
    [board.elements, editingTextId]
  );

  useEffect(() => {
    if (preview?.enabled) {
      return;
    }

    const transformer = transformerRef.current;
    const node = selectedElementId ? shapeRefs.current[selectedElementId] : null;
    if (!transformer) {
      return;
    }

    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedElementId, board.elements, preview?.enabled]);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData("shape-type") as ShapeType;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!type || !rect) {
      return;
    }

    onSelectBoard();
    onSelectElement(null);
    onAddElement(type, addGridSnap({ x: event.clientX - rect.left, y: event.clientY - rect.top }));
  }

  function handleStagePointer(event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    if (!stage) {
      return;
    }

    const clickedOnEmpty =
      event.target === stage || event.target.name() === "board-background";

    if (!clickedOnEmpty) {
      return;
    }

    onSelectBoard();
    onSelectElement(null);

    if (preview?.enabled || activeTool === "select") {
      return;
    }

    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }

    onAddElement(activeTool as ShapeType, addGridSnap(pointer));
  }

  function commitTransform(element: PrototypeElement) {
    const node = shapeRefs.current[element.id];
    if (!node) {
      return;
    }

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const nextWidth = Math.max(8, round(element.width * scaleX));
    const nextHeight = Math.max(2, round(element.height * scaleY));

    onUpdateElement(element.id, {
      x: node.x(),
      y: node.y(),
      width: element.type === "circle" ? Math.max(nextWidth, nextHeight) : nextWidth,
      height: element.type === "circle" ? Math.max(nextWidth, nextHeight) : nextHeight
    });
  }

  return (
    <div
      className={`relative rounded-[28px] border bg-white shadow-panel ${
        isSelectedBoard ? "border-accent/60" : "border-zinc-200"
      }`}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <div
        ref={wrapperRef}
        className="relative"
        onClick={onSelectBoard}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {editingElement ? (
          <textarea
            autoFocus
            className="absolute z-20 resize-none rounded border border-accent bg-white px-2 py-1 text-sm text-ink shadow-sm outline-none"
            style={{
              left: editingElement.x,
              top: editingElement.y,
              width: editingElement.width,
              height: Math.max(32, editingElement.height + 8),
              fontSize: editingElement.fontSize
            }}
            value={editingElement.text}
            onChange={(event) =>
              onUpdateElement(
                editingElement.id,
                { text: event.target.value, height: Math.max(24, event.target.scrollHeight) },
                false
              )
            }
            onBlur={() => setEditingTextId(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditingTextId(null);
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                setEditingTextId(null);
              }
            }}
          />
        ) : null}
        <Stage
          width={artboardSize.width}
          height={artboardSize.height}
          onMouseDown={handleStagePointer}
          className="rounded-[28px]"
        >
          <Layer>
            <Rect
              name="board-background"
              width={artboardSize.width}
              height={artboardSize.height}
              fill="#ffffff"
            />
            {board.elements.map((element) => {
              const hidden = preview?.enabled && preview.hidden[element.id];
              if (!element.visible || hidden) {
                return null;
              }

              return (
                <Group
                  key={element.id}
                  ref={(node) => {
                    shapeRefs.current[element.id] = node;
                  }}
                  id={element.id}
                  x={element.x}
                  y={element.y}
                  draggable={!preview?.enabled}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    onSelectBoard();
                    if (preview?.enabled) {
                      preview.onActivate(element);
                      return;
                    }
                    onSelectElement(element.id);
                  }}
                  onTap={() => {
                    if (preview?.enabled) {
                      preview.onActivate(element);
                    }
                  }}
                  onDblClick={() => {
                    if (!preview?.enabled && element.type === "text") {
                      setEditingTextId(element.id);
                    }
                  }}
                  onContextMenu={(event) => {
                    if (preview?.enabled) {
                      return;
                    }
                    event.evt.preventDefault();
                    onSelectElement(element.id);
                    onContextMenu(
                      {
                        x: event.evt.clientX,
                        y: event.evt.clientY
                      },
                      element.id
                    );
                  }}
                  onDragEnd={(event) => {
                    const nextPosition = event.evt.shiftKey
                      ? { x: event.target.x(), y: event.target.y() }
                      : addGridSnap({ x: event.target.x(), y: event.target.y() });
                    onUpdateElement(element.id, nextPosition);
                  }}
                  onTransformEnd={() => commitTransform(element)}
                >
                  {renderShape(element, preview)}
                  {showElementNames ? (
                    <Text
                      x={0}
                      y={Math.max(-18, -18)}
                      text={element.name}
                      fontSize={12}
                      fill="#6b7280"
                      listening={false}
                    />
                  ) : null}
                  {element.interactions.length > 0 ? (
                    <Text
                      x={Math.max(0, element.width - 14)}
                      y={-18}
                      text="⚡"
                      fontSize={12}
                      fill="#f59e0b"
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            })}
            {!preview?.enabled ? (
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                boundBoxFunc={(_, box) => ({
                  ...box,
                  width: clamp(box.width, 8, artboardSize.width),
                  height: clamp(box.height, 2, artboardSize.height)
                })}
              />
            ) : null}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
