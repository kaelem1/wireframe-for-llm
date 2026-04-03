/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import AppKit
import Combine
import SwiftUI

struct WorkspaceRootView: View {
    @Binding private var document: PrototypeDocument
    @Environment(\.undoManager) private var undoManager
    @StateObject private var store: ProjectStore
    @State private var aiPrompt = ""
    @State private var aiError = ""
    @State private var isGeneratingAI = false
    @State private var notice: WorkspaceNotice?

    init(document: Binding<PrototypeDocument>) {
        _document = document
        _store = StateObject(wrappedValue: ProjectStore(project: document.wrappedValue.project))
    }

    var body: some View {
        NavigationSplitView {
            ScreenSidebarView(store: store)
        } content: {
            InfiniteCanvasView(store: store)
        } detail: {
            InspectorView(store: store)
        }
        .navigationSplitViewStyle(.balanced)
        .frame(minWidth: 1320, minHeight: 820)
        .focusedObject(store)
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                Button("Select") { store.tool = .select }
                Button("Hand") { store.tool = .hand }
                Divider()
                Button("Rectangle") { store.insertElement(kind: .rectangle) }
                Button("Ellipse") { store.insertElement(kind: .ellipse) }
                Button("Line") { store.insertElement(kind: .line) }
                Button("Text") { store.insertElement(kind: .text) }
                Divider()
                Button("Preview") { store.showingPreview = true }
                Button("AI") { store.showingAI = true }
                Menu("Export") {
                    Button("Markdown") { exportMarkdown() }
                    Button("JSON") { exportJSON() }
                    Button("PNG Screens") { exportScreenshots() }
                }
            }
        }
        .onAppear {
            store.bindUndoManager(undoManager)
        }
        .onChange(of: undoManager) { _, next in
            store.bindUndoManager(next)
        }
        .onReceive(store.$project.dropFirst()) { project in
            document.project = project
        }
        .onChange(of: document.project) { _, next in
            guard store.project != next else { return }
            store.project = next
        }
        .focusable()
        .onKeyPress(.space, phases: [.down, .repeat]) { _ in
            store.isSpacePressed = true
            return .handled
        }
        .onKeyPress(.space, phases: [.up]) { _ in
            store.isSpacePressed = false
            return .handled
        }
        .onReceive(NotificationCenter.default.publisher(for: .workspaceExportMarkdown)) { _ in
            exportMarkdown()
        }
        .onReceive(NotificationCenter.default.publisher(for: .workspaceExportJSON)) { _ in
            exportJSON()
        }
        .onReceive(NotificationCenter.default.publisher(for: .workspaceExportPNG)) { _ in
            exportScreenshots()
        }
        .sheet(isPresented: $store.showingAI) {
            AIPanelShell(
                store: store,
                prompt: $aiPrompt,
                errorMessage: $aiError,
                isGenerating: $isGeneratingAI,
                generate: generateAI
            )
        }
        .fullScreenCover(isPresented: $store.showingPreview) {
            PreviewPlayerView(store: store)
        }
        .alert(item: $notice) { notice in
            Alert(title: Text(notice.title), message: Text(notice.message), dismissButton: .default(Text("OK")))
        }
    }

    @MainActor
    private func generateAI() async {
        let trimmedPrompt = aiPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPrompt.isEmpty else {
            aiError = "请输入原型需求。"
            return
        }

        isGeneratingAI = true
        aiError = ""
        defer { isGeneratingAI = false }

        do {
            let spec = try await LLMClient(configuration: store.project.ai).generatePrototypeSpec(prompt: trimmedPrompt)
            store.applyAI(spec: spec)
            aiPrompt = ""
            store.showingAI = false
            notice = .init(title: "AI Prototype", message: "已生成 \(spec.pages.count) 个页面。")
        } catch {
            aiError = error.localizedDescription
        }
    }

    private func exportMarkdown() {
        let panel = NSSavePanel()
        panel.title = "Export Markdown"
        panel.nameFieldStringValue = sanitizedFilename(store.project.name) + ".md"
        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let markdown = ProjectExportService().exportMarkdown(project: store.project)
            try markdown.write(to: url, atomically: true, encoding: .utf8)
            notice = .init(title: "Export Complete", message: "Markdown 已导出到 \(url.lastPathComponent)。")
        } catch {
            notice = .init(title: "Export Failed", message: error.localizedDescription)
        }
    }

    private func exportJSON() {
        let panel = NSSavePanel()
        panel.title = "Export JSON"
        panel.nameFieldStringValue = sanitizedFilename(store.project.name) + ".json"
        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let data = try ProjectExportService().exportJSON(project: store.project)
            try data.write(to: url)
            notice = .init(title: "Export Complete", message: "JSON 已导出到 \(url.lastPathComponent)。")
        } catch {
            notice = .init(title: "Export Failed", message: error.localizedDescription)
        }
    }

    private func exportScreenshots() {
        let panel = NSOpenPanel()
        panel.title = "Export PNG Screens"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let urls = try ScreenshotExportService().exportPNGs(for: store.project, to: url)
            notice = .init(title: "Export Complete", message: "已导出 \(urls.count) 个 PNG。")
        } catch {
            notice = .init(title: "Export Failed", message: error.localizedDescription)
        }
    }

    private func sanitizedFilename(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Prototype" : trimmed.replacingOccurrences(of: "/", with: "-")
    }
}

private struct AIPanelShell: View {
    @ObservedObject var store: ProjectStore
    @Binding var prompt: String
    @Binding var errorMessage: String
    @Binding var isGenerating: Bool
    let generate: @MainActor () async -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AI Prototype")
                .font(.headline)
            Text("输入需求后直接生成页面、图元、语义名称和交互。")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
            TextEditor(text: $prompt)
                .font(.system(size: 13))
                .frame(minHeight: 220)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
                )
            if !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(.red)
            }
            Group {
                Text("Base URL: \(store.project.ai.baseURL)")
                Text("Model: \(store.project.ai.model)")
                Text("API Key: \(store.project.ai.apiKey.isEmpty ? "未填写" : "已填写")")
            }
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            HStack {
                Button(isGenerating ? "Generating..." : "Generate") {
                    Task { await generate() }
                }
                .disabled(isGenerating)
                Spacer()
                Button("Close") { store.showingAI = false }
            }
        }
        .padding(20)
        .frame(width: 460, height: 380)
    }
}

private struct WorkspaceNotice: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}
