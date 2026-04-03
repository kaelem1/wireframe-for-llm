/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import Foundation
import SwiftUI

struct WorkspaceCommands: Commands {
    @FocusedObject private var store: ProjectStore?

    var body: some Commands {
        CommandMenu("Tools") {
            Button("Select Tool") { store?.tool = .select }
                .keyboardShortcut("v")
            Button("Rectangle Tool") { store?.insertElement(kind: .rectangle) }
                .keyboardShortcut("r")
            Button("Ellipse Tool") { store?.insertElement(kind: .ellipse) }
                .keyboardShortcut("o")
            Button("Line Tool") { store?.insertElement(kind: .line) }
                .keyboardShortcut("l")
            Button("Text Tool") { store?.insertElement(kind: .text) }
                .keyboardShortcut("t")
        }

        CommandMenu("Prototype") {
            Button("Preview") { store?.showingPreview = true }
                .keyboardShortcut(.return, modifiers: [.command, .shift])
            Button("Open AI Panel") { store?.showingAI = true }
                .keyboardShortcut("i", modifiers: [.command, .shift])
        }

        CommandMenu("Export") {
            Button("Export Markdown") {
                NotificationCenter.default.post(name: .workspaceExportMarkdown, object: nil)
            }
            .keyboardShortcut("m", modifiers: [.command, .shift])
            Button("Export JSON") {
                NotificationCenter.default.post(name: .workspaceExportJSON, object: nil)
            }
            .keyboardShortcut("j", modifiers: [.command, .shift])
            Button("Export PNG Screens") {
                NotificationCenter.default.post(name: .workspaceExportPNG, object: nil)
            }
            .keyboardShortcut("p", modifiers: [.command, .shift])
        }

        CommandMenu("Selection") {
            Button("Duplicate") { store?.duplicateSelection() }
                .keyboardShortcut("d")
                .disabled(store?.selection.isEmpty != false)
            Button("Delete") { store?.deleteSelection() }
                .keyboardShortcut(.delete, modifiers: [])
                .disabled(store?.selection.isEmpty != false)
            Divider()
            Button("Bring Forward") { store?.bringForward() }
                .disabled(store?.selection.isEmpty != false)
            Button("Send Backward") { store?.sendBackward() }
                .disabled(store?.selection.isEmpty != false)
            Button("Bring To Front") { store?.bringToFront() }
                .disabled(store?.selection.isEmpty != false)
            Button("Send To Back") { store?.sendToBack() }
                .disabled(store?.selection.isEmpty != false)
        }
    }
}

extension Notification.Name {
    static let workspaceExportMarkdown = Notification.Name("workspace.export.markdown")
    static let workspaceExportJSON = Notification.Name("workspace.export.json")
    static let workspaceExportPNG = Notification.Name("workspace.export.png")
}
