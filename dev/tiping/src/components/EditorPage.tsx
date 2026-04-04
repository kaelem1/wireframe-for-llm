/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { generateWireframe, interpretWireframeForAlignment } from "../ai";
import { SHAPE_LABELS } from "../constants";
import { buildAiExport, compareAlignment } from "../exporters";
import { useAppStore } from "../store";
import type {
  AlignmentResult,
  InteractionAction,
  PrototypeElement,
  PrototypeInteraction,
  ShapeType,
  ToolType
} from "../types";
import { downloadTextFile, isEditingTarget } from "../utils";
import { BoardCanvas } from "./BoardCanvas";

interface ContextMenuState {
  boardId: string;
  elementId: string;
  x: number;
  y: number;
}

function PanelField(props: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

function NumberInput(props: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
      value={Number.isFinite(props.value) ? props.value : 0}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(event) => props.onChange(Number(event.target.value))}
    />
  );
}

function ModalShell(props: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-5xl rounded-[32px] bg-white p-8 shadow-panel">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold">{props.title}</h2>
            {props.subtitle ? <p className="mt-2 text-sm text-zinc-500">{props.subtitle}</p> : null}
          </div>
          <button className="text-sm text-zinc-500" onClick={props.onClose}>
            关闭
          </button>
        </div>
        <div className="mt-6">{props.children}</div>
      </div>
    </div>
  );
}

export function EditorPage() {
  const projects = useAppStore((state) => state.projects);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const selectedBoardId = useAppStore((state) => state.selectedBoardId);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const activeTool = useAppStore((state) => state.activeTool);
  const isToolboxCollapsed = useAppStore((state) => state.isToolboxCollapsed);
  const showElementNames = useAppStore((state) => state.showElementNames);
  const llmSettings = useAppStore((state) => state.llmSettings);
  const historyPast = useAppStore((state) => state.historyPast);
  const historyFuture = useAppStore((state) => state.historyFuture);
  const closeProject = useAppStore((state) => state.closeProject);
  const updateProjectName = useAppStore((state) => state.updateProjectName);
  const setLlmSettings = useAppStore((state) => state.setLlmSettings);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setToolboxCollapsed = useAppStore((state) => state.setToolboxCollapsed);
  const toggleElementNames = useAppStore((state) => state.toggleElementNames);
  const selectBoard = useAppStore((state) => state.selectBoard);
  const renameBoard = useAppStore((state) => state.renameBoard);
  const addBoard = useAppStore((state) => state.addBoard);
  const selectElement = useAppStore((state) => state.selectElement);
  const addElement = useAppStore((state) => state.addElement);
  const addBoardFromAi = useAppStore((state) => state.addBoardFromAi);
  const updateElement = useAppStore((state) => state.updateElement);
  const deleteSelectedElement = useAppStore((state) => state.deleteSelectedElement);
  const duplicateSelectedElement = useAppStore((state) => state.duplicateSelectedElement);
  const moveElementLayer = useAppStore((state) => state.moveElementLayer);
  const addInteraction = useAppStore((state) => state.addInteraction);
  const updateInteraction = useAppStore((state) => state.updateInteraction);
  const removeInteraction = useAppStore((state) => state.removeInteraction);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const saveNow = useAppStore((state) => state.saveNow);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const selectedBoard = activeProject?.boards.find((board) => board.id === selectedBoardId) ?? null;
  const selectedElement =
    selectedBoard?.elements.find((element) => element.id === selectedElementId) ?? null;
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAlignmentOpen, setIsAlignmentOpen] = useState(false);
  const [exportTab, setExportTab] = useState<"json" | "markdown">("json");
  const [aiDescription, setAiDescription] = useState("");
  const [aiBoardName, setAiBoardName] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBoardId, setPreviewBoardId] = useState<string | null>(selectedBoardId);
  const [previewDirection, setPreviewDirection] = useState<"forward" | "back">("forward");
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [previewToggled, setPreviewToggled] = useState<Record<string, boolean>>({});
  const [previewHidden, setPreviewHidden] = useState<Record<string, boolean>>({});
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  useEffect(() => {
    setPreviewBoardId(selectedBoardId);
  }, [selectedBoardId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditingTarget(event.target)) {
        return;
      }

      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (command && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (command && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedElement();
        return;
      }

      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
        return;
      }

      if (command && event.key.toLowerCase() === "e") {
        event.preventDefault();
        setIsExportOpen(true);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedElement();
        return;
      }

      if (event.key === "Escape") {
        setContextMenu(null);
        setPreviewOpen(false);
        return;
      }

      const key = event.key.toLowerCase();
      const toolMap: Partial<Record<string, ToolType>> = {
        v: "select",
        r: "rect",
        o: "ellipse",
        l: "line",
        t: "text"
      };

      if (key === "p") {
        event.preventDefault();
        setPreviewOpen((current) => !current);
        setPreviewBoardId(selectedBoardId);
        return;
      }

      const nextTool = toolMap[key];
      if (nextTool) {
        event.preventDefault();
        setActiveTool(nextTool);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    deleteSelectedElement,
    duplicateSelectedElement,
    redo,
    saveNow,
    selectedBoardId,
    setActiveTool,
    undo
  ]);

  useEffect(() => {
    function handleGlobalClick() {
      setContextMenu(null);
    }
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  if (!activeProject) {
    return null;
  }

  const exported = buildAiExport(activeProject);
  const previewBoard =
    activeProject.boards.find((board) => board.id === previewBoardId) ?? activeProject.boards[0];

  const project = activeProject;

  async function handleGenerateBoard() {
    setAiLoading(true);
    try {
      const shapes = await generateWireframe(llmSettings, aiDescription, project.artboardSize);
      addBoardFromAi(aiBoardName || `AI 画板 ${project.boards.length + 1}`, shapes);
      setAiDescription("");
      setAiBoardName("");
      setIsAiOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "AI 生成失败");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAlignment() {
    setAlignmentLoading(true);
    setAlignmentError(null);
    try {
      const response = await interpretWireframeForAlignment(
        llmSettings,
        exported.payload,
        exported.markdown
      );
      setAlignmentResult(compareAlignment(exported.payload, response));
    } catch (error) {
      setAlignmentError(error instanceof Error ? error.message : "AI 对齐测试失败");
      setAlignmentResult(null);
    } finally {
      setAlignmentLoading(false);
    }
  }

  function applyPreviewInteraction(element: PrototypeElement) {
    for (const interaction of element.interactions) {
      if (interaction.action === "navigateTo" && interaction.target) {
        setPreviewDirection("forward");
        setPreviewHistory((current) => [...current, previewBoard.id]);
        setPreviewBoardId(interaction.target);
      }

      if (interaction.action === "goBack") {
        setPreviewHistory((current) => {
          const previous = current[current.length - 1];
          if (previous) {
            setPreviewDirection("back");
            setPreviewBoardId(previous);
          }
          return current.slice(0, -1);
        });
      }

      if (interaction.action === "toggleState") {
        setPreviewToggled((current) => ({
          ...current,
          [element.id]: !current[element.id]
        }));
      }

      if (interaction.action === "showHide" && interaction.target) {
        setPreviewHidden((current) => ({
          ...current,
          [interaction.target!]: !current[interaction.target!]
        }));
      }
    }
  }

  const toolboxItems: Array<{ tool: ToolType; label: string; dragType?: ShapeType }> = [
    { tool: "select", label: "选择" },
    { tool: "rect", label: "矩形", dragType: "rect" },
    { tool: "ellipse", label: "圆形/椭圆", dragType: "ellipse" },
    { tool: "line", label: "线段", dragType: "line" },
    { tool: "text", label: "文字", dragType: "text" },
    { tool: "image_placeholder", label: "图片占位", dragType: "image_placeholder" }
  ];

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <button className="rounded-full border border-zinc-200 px-4 py-2 text-sm" onClick={closeProject}>
            项目列表
          </button>
          <div className="min-w-0">
            <input
              className="w-full rounded-full border border-transparent px-4 py-2 text-lg font-semibold outline-none focus:border-zinc-200"
              value={activeProject.name}
              onChange={(event) => updateProjectName(event.target.value)}
            />
            <p className="px-4 text-xs text-zinc-500">
              {activeProject.name} / {selectedBoard?.name ?? "未选中画板"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-full border border-zinc-200 px-4 py-2 text-sm" onClick={toggleElementNames}>
            {showElementNames ? "隐藏名称" : "显示名称"}
          </button>
          <button
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
            onClick={() => setIsAiOpen(true)}
          >
            AI 生成
          </button>
          <button
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
            onClick={() => {
              setPreviewHistory([]);
              setPreviewHidden({});
              setPreviewToggled({});
              setPreviewBoardId(selectedBoard?.id ?? activeProject.boards[0]?.id ?? null);
              setPreviewOpen(true);
            }}
          >
            预览
          </button>
          <button
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
            onClick={() => setIsExportOpen(true)}
          >
            导出供 AI 使用
          </button>
          <button
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
            onClick={() => {
              setIsAlignmentOpen(true);
              setAlignmentResult(null);
              setAlignmentError(null);
            }}
          >
            AI 对齐测试
          </button>
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
            onClick={() => setIsSettingsOpen(true)}
          >
            设置
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`border-r border-zinc-200 bg-white transition-all ${
            isToolboxCollapsed ? "w-[60px]" : "w-[200px]"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4">
            {!isToolboxCollapsed ? <p className="text-sm font-semibold">工具箱</p> : null}
            <button
              className="rounded-full border border-zinc-200 px-2 py-1 text-xs"
              onClick={() => setToolboxCollapsed(!isToolboxCollapsed)}
            >
              {isToolboxCollapsed ? ">" : "<"}
            </button>
          </div>
          <div className="space-y-2 px-3">
            {toolboxItems.map((item) => (
              <button
                key={item.tool}
                draggable={Boolean(item.dragType)}
                onDragStart={(event) => {
                  if (item.dragType) {
                    event.dataTransfer.setData("shape-type", item.dragType);
                  }
                }}
                onClick={() => setActiveTool(item.tool)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${
                  activeTool === item.tool ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                <span>{isToolboxCollapsed ? item.label.slice(0, 1) : item.label}</span>
                {!isToolboxCollapsed && item.dragType ? (
                  <span className="text-xs opacity-70">拖拽</span>
                ) : null}
              </button>
            ))}
          </div>
          {!isToolboxCollapsed ? (
            <div className="px-4 py-5 text-xs text-zinc-400">
              快捷键：V / R / O / L / T / P / Cmd+D / Cmd+Z / Cmd+Shift+Z
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="h-full overflow-x-auto overflow-y-auto px-8 py-8">
            <div className="flex min-h-full items-start gap-20 pb-10">
              {activeProject.boards.map((board) => (
                <div
                  key={board.id}
                  ref={(node) => {
                    boardRefs.current[board.id] = node;
                  }}
                  className="shrink-0"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <input
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-accent"
                      value={board.name}
                      onFocus={() => selectBoard(board.id)}
                      onChange={(event) => renameBoard(board.id, event.target.value)}
                    />
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      {activeProject.artboardSize.width}×{activeProject.artboardSize.height}
                    </span>
                  </div>
                  <BoardCanvas
                    board={board}
                    artboardSize={activeProject.artboardSize}
                    activeTool={activeTool}
                    selectedElementId={selectedBoardId === board.id ? selectedElementId : null}
                    showElementNames={showElementNames}
                    isSelectedBoard={selectedBoardId === board.id}
                    onSelectBoard={() => selectBoard(board.id)}
                    onSelectElement={(elementId) => selectElement(board.id, elementId)}
                    onAddElement={(type, position) => addElement(board.id, type, position)}
                    onUpdateElement={(elementId, patch, trackHistory) =>
                      updateElement(board.id, elementId, patch, trackHistory)
                    }
                    onContextMenu={(position, elementId) =>
                      setContextMenu({
                        boardId: board.id,
                        elementId,
                        x: position.x,
                        y: position.y
                      })
                    }
                  />
                </div>
              ))}
              <button
                className="mt-16 shrink-0 rounded-[28px] border border-dashed border-zinc-300 bg-white px-8 py-10 text-left shadow-panel"
                onClick={addBoard}
              >
                <p className="text-sm font-medium text-zinc-500">新增画板</p>
                <p className="mt-2 text-2xl font-semibold">+</p>
              </button>
            </div>
          </div>
        </main>

        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-5">
          {selectedElement && selectedBoard ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">属性检查器</h2>
                <p className="mt-1 text-sm text-zinc-500">{SHAPE_LABELS[selectedElement.type]}</p>
              </div>

              <PanelField label="元素名称">
                <input
                  className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  value={selectedElement.name}
                  onChange={(event) =>
                    updateElement(selectedBoard.id, selectedElement.id, { name: event.target.value })
                  }
                />
              </PanelField>

              <div className="grid grid-cols-2 gap-3">
                <PanelField label="X">
                  <NumberInput
                    value={selectedElement.x}
                    onChange={(value) =>
                      updateElement(selectedBoard.id, selectedElement.id, { x: value })
                    }
                  />
                </PanelField>
                <PanelField label="Y">
                  <NumberInput
                    value={selectedElement.y}
                    onChange={(value) =>
                      updateElement(selectedBoard.id, selectedElement.id, { y: value })
                    }
                  />
                </PanelField>
                <PanelField label="W">
                  <NumberInput
                    value={selectedElement.width}
                    min={8}
                    onChange={(value) =>
                      updateElement(selectedBoard.id, selectedElement.id, { width: value })
                    }
                  />
                </PanelField>
                <PanelField label="H">
                  <NumberInput
                    value={selectedElement.height}
                    min={2}
                    onChange={(value) =>
                      updateElement(selectedBoard.id, selectedElement.id, { height: value })
                    }
                  />
                </PanelField>
              </div>

              <div className="space-y-3">
                <PanelField label="填充颜色">
                  <input
                    type="color"
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white p-2"
                    value={selectedElement.fill || "#111827"}
                    onChange={(event) =>
                      updateElement(selectedBoard.id, selectedElement.id, { fill: event.target.value })
                    }
                  />
                </PanelField>
                <PanelField label="描边颜色">
                  <input
                    type="color"
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white p-2"
                    value={selectedElement.stroke || "#111827"}
                    onChange={(event) =>
                      updateElement(selectedBoard.id, selectedElement.id, {
                        stroke: event.target.value
                      })
                    }
                  />
                </PanelField>
                <div className="grid grid-cols-2 gap-3">
                  <PanelField label="描边宽度">
                    <NumberInput
                      value={selectedElement.strokeWidth}
                      min={0}
                      onChange={(value) =>
                        updateElement(selectedBoard.id, selectedElement.id, { strokeWidth: value })
                      }
                    />
                  </PanelField>
                  <PanelField label="不透明度">
                    <NumberInput
                      value={selectedElement.opacity}
                      min={0}
                      max={1}
                      step={0.1}
                      onChange={(value) =>
                        updateElement(selectedBoard.id, selectedElement.id, { opacity: value })
                      }
                    />
                  </PanelField>
                </div>
                {selectedElement.type === "rect" || selectedElement.type === "image_placeholder" ? (
                  <PanelField label="圆角半径">
                    <NumberInput
                      value={selectedElement.cornerRadius}
                      min={0}
                      max={20}
                      onChange={(value) =>
                        updateElement(selectedBoard.id, selectedElement.id, {
                          cornerRadius: value
                        })
                      }
                    />
                  </PanelField>
                ) : null}
                {selectedElement.type === "text" ? (
                  <>
                    <PanelField label="文字内容">
                      <textarea
                        className="min-h-[88px] w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                        value={selectedElement.text}
                        onChange={(event) =>
                          updateElement(selectedBoard.id, selectedElement.id, {
                            text: event.target.value
                          })
                        }
                      />
                    </PanelField>
                    <PanelField label="字号">
                      <NumberInput
                        value={selectedElement.fontSize}
                        min={12}
                        max={32}
                        onChange={(value) =>
                          updateElement(selectedBoard.id, selectedElement.id, { fontSize: value })
                        }
                      />
                    </PanelField>
                  </>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-zinc-200 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">交互</p>
                    <p className="text-xs text-zinc-500">
                      已配置 {selectedElement.interactions.length} 条
                    </p>
                  </div>
                  <button
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs"
                    onClick={() => addInteraction(selectedBoard.id, selectedElement.id)}
                  >
                    + 添加交互
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedElement.interactions.length === 0 ? (
                    <div className="rounded-2xl bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                      当前元素还没有交互。
                    </div>
                  ) : null}
                  {selectedElement.interactions.map((interaction) => (
                    <div key={interaction.id} className="space-y-2 rounded-2xl border border-zinc-200 p-3">
                      <select
                        className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                        value={interaction.trigger}
                        onChange={(event) =>
                          updateInteraction(selectedBoard.id, selectedElement.id, interaction.id, {
                            trigger: event.target.value as PrototypeInteraction["trigger"]
                          })
                        }
                      >
                        <option value="onClick">点击时</option>
                      </select>
                      <select
                        className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                        value={interaction.action}
                        onChange={(event) =>
                          updateInteraction(selectedBoard.id, selectedElement.id, interaction.id, {
                            action: event.target.value as InteractionAction,
                            target: undefined
                          })
                        }
                      >
                        <option value="navigateTo">跳转页面</option>
                        <option value="goBack">返回上一页</option>
                        <option value="toggleState">切换状态</option>
                        <option value="showHide">显示/隐藏</option>
                      </select>
                      {interaction.action === "navigateTo" ? (
                        <select
                          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                          value={interaction.target ?? ""}
                          onChange={(event) =>
                            updateInteraction(selectedBoard.id, selectedElement.id, interaction.id, {
                              target: event.target.value
                            })
                          }
                        >
                          <option value="">选择目标画板</option>
                          {activeProject.boards.map((board) => (
                            <option key={board.id} value={board.id}>
                              {board.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {interaction.action === "showHide" ? (
                        <select
                          className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-accent"
                          value={interaction.target ?? ""}
                          onChange={(event) =>
                            updateInteraction(selectedBoard.id, selectedElement.id, interaction.id, {
                              target: event.target.value
                            })
                          }
                        >
                          <option value="">选择目标元素</option>
                          {selectedBoard.elements
                            .filter((element) => element.id !== selectedElement.id)
                            .map((element) => (
                              <option key={element.id} value={element.id}>
                                {element.name}
                              </option>
                            ))}
                        </select>
                      ) : null}
                      <button
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                        onClick={() =>
                          removeInteraction(selectedBoard.id, selectedElement.id, interaction.id)
                        }
                      >
                        删除交互
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">属性检查器</h2>
              <div className="rounded-[24px] border border-zinc-200 p-4 text-sm text-zinc-500">
                选中元素后可编辑名称、位置、外观与交互。
              </div>
              <div className="rounded-[24px] border border-zinc-200 p-4">
                <p className="text-sm font-semibold">项目状态</p>
                <div className="mt-3 space-y-2 text-sm text-zinc-500">
                  <p>画板数：{activeProject.boards.length}</p>
                  <p>撤销：{historyPast.length} 步</p>
                  <p>重做：{historyFuture.length} 步</p>
                  <p>
                    尺寸：{activeProject.artboardSize.width}×{activeProject.artboardSize.height}
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex items-center gap-2 overflow-x-auto border-t border-zinc-200 bg-white px-4 py-3">
        {activeProject.boards.map((board) => (
          <button
            key={board.id}
            className={`rounded-full px-4 py-2 text-sm ${
              selectedBoardId === board.id ? "bg-ink text-white" : "bg-zinc-100 text-zinc-700"
            }`}
            onClick={() => {
              selectBoard(board.id);
              boardRefs.current[board.id]?.scrollIntoView({
                behavior: "smooth",
                inline: "center",
                block: "nearest"
              });
            }}
          >
            {board.name}
          </button>
        ))}
        <button className="rounded-full border border-zinc-200 px-4 py-2 text-sm" onClick={addBoard}>
          + 画板
        </button>
      </footer>

      {contextMenu ? (
        <div
          className="fixed z-40 rounded-2xl border border-zinc-200 bg-white p-2 shadow-panel"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-100"
            onClick={() => {
              moveElementLayer(contextMenu.boardId, contextMenu.elementId, 1);
              setContextMenu(null);
            }}
          >
            上移一层
          </button>
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-100"
            onClick={() => {
              moveElementLayer(contextMenu.boardId, contextMenu.elementId, -1);
              setContextMenu(null);
            }}
          >
            下移一层
          </button>
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            onClick={() => {
              selectElement(contextMenu.boardId, contextMenu.elementId);
              deleteSelectedElement();
              setContextMenu(null);
            }}
          >
            删除
          </button>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <ModalShell title="LLM API 设置" subtitle="本工具默认按 SiliconFlow 的 OpenAI 兼容接口发送请求。" onClose={() => setIsSettingsOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <PanelField label="Base URL">
              <input
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-accent"
                value={llmSettings.baseUrl}
                onChange={(event) => setLlmSettings({ baseUrl: event.target.value })}
              />
            </PanelField>
            <PanelField label="模型">
              <input
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-accent"
                value={llmSettings.model}
                onChange={(event) => setLlmSettings({ model: event.target.value })}
              />
            </PanelField>
            <div className="md:col-span-2">
              <PanelField label="API Key">
                <input
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-accent"
                  value={llmSettings.apiKey}
                  onChange={(event) => setLlmSettings({ apiKey: event.target.value })}
                  placeholder="sk-..."
                />
              </PanelField>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {isAiOpen ? (
        <ModalShell title="AI 生成" subtitle="输入页面描述，AI 将生成一张新画板并写入基础图形。" onClose={() => setIsAiOpen(false)}>
          <div className="space-y-4">
            <PanelField label="新画板名称">
              <input
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-accent"
                value={aiBoardName}
                onChange={(event) => setAiBoardName(event.target.value)}
                placeholder={`AI 画板 ${activeProject.boards.length + 1}`}
              />
            </PanelField>
            <PanelField label="页面描述">
              <textarea
                className="min-h-[180px] w-full rounded-3xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-accent"
                value={aiDescription}
                onChange={(event) => setAiDescription(event.target.value)}
                placeholder="例如：一个登录页面，顶部有 logo，中间有用户名和密码输入框，底部有登录按钮和注册链接。"
              />
            </PanelField>
            <div className="flex justify-end gap-3">
              <button className="rounded-full border border-zinc-200 px-4 py-2 text-sm" onClick={() => setIsAiOpen(false)}>
                取消
              </button>
              <button
                className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white"
                disabled={aiLoading || !aiDescription.trim()}
                onClick={handleGenerateBoard}
              >
                {aiLoading ? "生成中..." : "开始生成"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {isExportOpen ? (
        <ModalShell title="导出供 AI 使用" subtitle="导出 JSON 与同步 Markdown，可直接喂给 Codex / Claude Code / Cursor。" onClose={() => setIsExportOpen(false)}>
          <div className="mb-4 flex gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm ${exportTab === "json" ? "bg-ink text-white" : "bg-zinc-100"}`}
              onClick={() => setExportTab("json")}
            >
              JSON
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm ${exportTab === "markdown" ? "bg-ink text-white" : "bg-zinc-100"}`}
              onClick={() => setExportTab("markdown")}
            >
              Markdown
            </button>
            <button
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
              onClick={() =>
                downloadTextFile(`${activeProject.name.replace(/\s+/g, "_") || "project"}.json`, JSON.stringify(exported.payload, null, 2))
              }
            >
              下载 JSON
            </button>
            <button
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
              onClick={() =>
                downloadTextFile(
                  `${activeProject.name.replace(/\s+/g, "_") || "project"}.md`,
                  exported.markdown
                )
              }
            >
              下载 Markdown
            </button>
          </div>
          <pre className="max-h-[520px] overflow-auto rounded-[28px] bg-zinc-950 p-5 text-sm text-zinc-100">
            {exportTab === "json"
              ? JSON.stringify(exported.payload, null, 2)
              : exported.markdown}
          </pre>
        </ModalShell>
      ) : null}

      {isAlignmentOpen ? (
        <ModalShell title="AI 对齐测试" subtitle="将当前项目导出给 LLM，再比对它复述的结构化结果。" onClose={() => setIsAlignmentOpen(false)}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-500">
              目标：综合对齐分 ≥ 95。当前使用模型：{llmSettings.model}
            </div>
            <button
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white"
              onClick={handleAlignment}
              disabled={alignmentLoading}
            >
              {alignmentLoading ? "测试中..." : "运行 AI 对齐测试"}
            </button>
          </div>
          {alignmentError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {alignmentError}
            </div>
          ) : null}
          {alignmentResult ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-zinc-200 p-4">
                  <p className="text-sm text-zinc-500">布局匹配分</p>
                  <p className="mt-2 text-3xl font-semibold">{alignmentResult.layoutScore.toFixed(1)}</p>
                </div>
                <div className="rounded-[24px] border border-zinc-200 p-4">
                  <p className="text-sm text-zinc-500">交互匹配分</p>
                  <p className="mt-2 text-3xl font-semibold">{alignmentResult.interactionScore.toFixed(1)}</p>
                </div>
                <div className="rounded-[24px] border border-zinc-200 p-4">
                  <p className="text-sm text-zinc-500">综合对齐分</p>
                  <p className="mt-2 text-3xl font-semibold">{alignmentResult.overallScore.toFixed(1)}</p>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-[28px] border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">画板</th>
                      <th className="px-4 py-3">元素</th>
                      <th className="px-4 py-3">原始</th>
                      <th className="px-4 py-3">AI 解读</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alignmentResult.rows.map((row) => (
                      <tr key={`${row.screenName}-${row.elementName}`} className={row.matched ? "" : "bg-rose-50"}>
                        <td className="px-4 py-3 align-top">{row.screenName}</td>
                        <td className="px-4 py-3 align-top">{row.elementName}</td>
                        <td className="px-4 py-3 align-top">
                          <div>x:{row.original.x} y:{row.original.y}</div>
                          <div>w:{row.original.width} h:{row.original.height}</div>
                          <div>type:{row.original.type}</div>
                          <div>interactions:{row.original.interactions.join(", ") || "无"}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {row.interpreted ? (
                            <>
                              <div>x:{row.interpreted.x} y:{row.interpreted.y}</div>
                              <div>w:{row.interpreted.width} h:{row.interpreted.height}</div>
                              <div>type:{row.interpreted.type}</div>
                              <div>interactions:{row.interpreted.interactions.join(", ") || "无"}</div>
                            </>
                          ) : (
                            "未识别"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </ModalShell>
      ) : null}

      {previewOpen && previewBoard ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
          <div className="flex items-center justify-end px-6 py-5">
            <button
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink"
              onClick={() => setPreviewOpen(false)}
            >
              退出预览
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-8">
            <div className={`preview-shell ${previewDirection === "forward" ? "preview-in-left" : "preview-in-right"}`}>
              <BoardCanvas
                board={previewBoard}
                artboardSize={activeProject.artboardSize}
                activeTool="select"
                selectedElementId={null}
                showElementNames={false}
                isSelectedBoard
                preview={{
                  enabled: true,
                  toggled: previewToggled,
                  hidden: previewHidden,
                  onActivate: applyPreviewInteraction
                }}
                onSelectBoard={() => undefined}
                onSelectElement={() => undefined}
                onAddElement={() => undefined}
                onUpdateElement={() => undefined}
                onContextMenu={() => undefined}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
