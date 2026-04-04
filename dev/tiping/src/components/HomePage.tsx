/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { useRef, useState } from "react";
import { DEVICE_PRESETS } from "../constants";
import { useAppStore } from "../store";
import { downloadTextFile, readTextFile } from "../utils";

interface CreateProjectDraft {
  name: string;
  deviceType: "mobile" | "tablet" | "desktop" | "custom";
  width: number;
  height: number;
}

const defaultDraft: CreateProjectDraft = {
  name: "",
  deviceType: "mobile",
  width: 393,
  height: 852
};

export function HomePage() {
  const projects = useAppStore((state) => state.projects);
  const createProject = useAppStore((state) => state.createProject);
  const duplicateProject = useAppStore((state) => state.duplicateProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const importProject = useAppStore((state) => state.importProject);
  const openProject = useAppStore((state) => state.openProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<CreateProjectDraft>(defaultDraft);

  function applyPreset(width: number, height: number, deviceType: CreateProjectDraft["deviceType"]) {
    setDraft((current) => ({
      ...current,
      deviceType,
      width,
      height
    }));
  }

  return (
    <div className="min-h-screen bg-canvas px-6 py-8 text-ink">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between rounded-[28px] bg-white/90 px-8 py-6 shadow-panel">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-400">Tiping</p>
            <h1 className="mt-2 text-3xl font-semibold">低保真原型设计工具</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              在浏览器中创建多画板原型，配置交互，导出给 AI 编码工具，并直接用 SiliconFlow 做生成与对齐验证。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium hover:border-zinc-300"
              onClick={() => fileInputRef.current?.click()}
            >
              导入项目
            </button>
            <button
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white"
              onClick={() => setIsCreateOpen(true)}
            >
              创建新项目
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-panel"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{project.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    {project.artboardSize.width}×{project.artboardSize.height} · {project.boards.length} 个画板
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500">
                  {project.deviceType}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
                  onClick={() => openProject(project.id)}
                >
                  打开
                </button>
                <button
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium"
                  onClick={() => duplicateProject(project.id)}
                >
                  复制
                </button>
                <button
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium"
                  onClick={() =>
                    downloadTextFile(
                      `${project.name.replace(/\s+/g, "_") || "project"}.json`,
                      JSON.stringify(project, null, 2)
                    )
                  }
                >
                  导出 JSON
                </button>
                <button
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600"
                  onClick={() => deleteProject(project.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}

          {projects.length === 0 ? (
            <div className="col-span-full rounded-[28px] border border-dashed border-zinc-300 bg-white/80 px-8 py-14 text-center shadow-panel">
              <p className="text-lg font-medium">还没有项目</p>
              <p className="mt-2 text-sm text-zinc-500">从设备尺寸开始创建第一个原型项目。</p>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          try {
            const text = await readTextFile(file);
            importProject(JSON.parse(text));
          } catch (error) {
            alert(error instanceof Error ? error.message : "导入失败");
          }
          event.currentTarget.value = "";
        }}
      />

      {isCreateOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-3xl rounded-[32px] bg-white p-8 shadow-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">创建项目</h2>
                <p className="mt-2 text-sm text-zinc-500">先选择目标设备尺寸，后续新增画板将继承该尺寸。</p>
              </div>
              <button className="text-sm text-zinc-500" onClick={() => setIsCreateOpen(false)}>
                关闭
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">项目名称</span>
                <input
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-accent"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="例如：MyApp"
                />
              </label>
              <div className="rounded-3xl border border-zinc-200 p-4">
                <p className="text-sm font-medium">当前尺寸</p>
                <p className="mt-2 text-2xl font-semibold">
                  {draft.width}×{draft.height}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{draft.deviceType}</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-3 text-sm font-medium">移动端</p>
                <div className="flex flex-wrap gap-3">
                  {DEVICE_PRESETS.filter((preset) => preset.deviceType === "mobile").map((preset) => (
                    <button
                      key={preset.label}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
                      onClick={() => applyPreset(preset.width, preset.height, preset.deviceType)}
                    >
                      {preset.label} · {preset.width}×{preset.height}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">平板端</p>
                <div className="flex flex-wrap gap-3">
                  {DEVICE_PRESETS.filter((preset) => preset.deviceType === "tablet").map((preset) => (
                    <button
                      key={preset.label}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
                      onClick={() => applyPreset(preset.width, preset.height, preset.deviceType)}
                    >
                      {preset.label} · {preset.width}×{preset.height}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">桌面端</p>
                <div className="flex flex-wrap gap-3">
                  {DEVICE_PRESETS.filter((preset) => preset.deviceType === "desktop").map((preset) => (
                    <button
                      key={preset.label}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
                      onClick={() => applyPreset(preset.width, preset.height, preset.deviceType)}
                    >
                      {preset.label} · {preset.width}×{preset.height}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-200 p-4">
                <p className="text-sm font-medium">自定义</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    min={200}
                    className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-accent"
                    value={draft.width}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        deviceType: "custom",
                        width: Number(event.target.value)
                      }))
                    }
                    placeholder="宽度"
                  />
                  <input
                    type="number"
                    min={200}
                    className="rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-accent"
                    value={draft.height}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        deviceType: "custom",
                        height: Number(event.target.value)
                      }))
                    }
                    placeholder="高度"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
                onClick={() => setIsCreateOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white"
                onClick={() => {
                  createProject({
                    name: draft.name || "未命名项目",
                    deviceType: draft.deviceType,
                    size: {
                      width: draft.width,
                      height: draft.height
                    }
                  });
                  setDraft(defaultDraft);
                  setIsCreateOpen(false);
                }}
              >
                创建并进入编辑器
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
