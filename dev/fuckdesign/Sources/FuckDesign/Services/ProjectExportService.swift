/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import Foundation

struct ProjectExportService {
    struct ExportBundle: Equatable {
        var markdownURL: URL
        var jsonURL: URL
    }

    struct ExportDocument: Codable, Equatable {
        struct Page: Codable, Equatable {
            struct ExportElement: Codable, Equatable {
                var semanticName: String
                var type: String
                var frame: RectData
                var text: String
                var states: [String]
            }

            var name: String
            var elements: [ExportElement]
        }

        var projectName: String
        var pages: [Page]
        var interactions: [String]
    }

    func exportMarkdown(project: PrototypeProject) -> String {
        let document = makeDocument(project: project)
        var lines = ["# \(document.projectName)", "", "## 页面"]

        for page in document.pages {
            lines.append("")
            lines.append("### \(page.name)")
            for element in page.elements {
                let text = element.text.isEmpty ? "无文本" : element.text
                let states = element.states.isEmpty ? "无状态" : element.states.joined(separator: " / ")
                lines.append("- \(element.semanticName) | \(element.type) | 文本: \(text) | 状态: \(states)")
            }
        }

        lines.append("")
        lines.append("## 交互")
        if document.interactions.isEmpty {
            lines.append("- 无")
        } else {
            lines.append(contentsOf: document.interactions.map { "- \($0)" })
        }
        return lines.joined(separator: "\n")
    }

    func exportJSON(project: PrototypeProject) throws -> Data {
        try JSONEncoder.projectEncoder.encode(makeDocument(project: project))
    }

    func writeMarkdown(project: PrototypeProject, to fileURL: URL) throws -> URL {
        try exportMarkdown(project: project).write(to: fileURL, atomically: true, encoding: .utf8)
        return fileURL
    }

    func writeJSON(project: PrototypeProject, to fileURL: URL) throws -> URL {
        try exportJSON(project: project).write(to: fileURL)
        return fileURL
    }

    func exportBundle(project: PrototypeProject, to directoryURL: URL) throws -> ExportBundle {
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true, attributes: nil)
        let baseName = sanitizedFilename(for: project.name)
        let markdownURL = directoryURL.appending(path: baseName).appendingPathExtension("md")
        let jsonURL = directoryURL.appending(path: baseName).appendingPathExtension("json")
        _ = try writeMarkdown(project: project, to: markdownURL)
        _ = try writeJSON(project: project, to: jsonURL)
        return .init(markdownURL: markdownURL, jsonURL: jsonURL)
    }

    func makeDocument(project: PrototypeProject) -> ExportDocument {
        let pages = project.screens.map { screen in
            ExportDocument.Page(
                name: screen.name,
                elements: screen.elements.map { element in
                    .init(
                        semanticName: element.semanticName,
                        type: element.kind.rawValue,
                        frame: element.frame,
                        text: element.text,
                        states: element.states.map(\.name)
                    )
                }
            )
        }

        return ExportDocument(
            projectName: project.name,
            pages: pages,
            interactions: describeInteractions(project: project)
        )
    }

    private func describeInteractions(project: PrototypeProject) -> [String] {
        let screensByID = Dictionary(uniqueKeysWithValues: project.screens.map { ($0.id, $0) })
        let stateNamesByElementID = Dictionary(uniqueKeysWithValues: project.screens.flatMap { screen in
            screen.elements.map { ($0.id, Dictionary(uniqueKeysWithValues: $0.states.map { ($0.id, $0.name) })) }
        })

        return project.screens.flatMap { screen in
            screen.elements.flatMap { element in
                element.interactions.map { interaction in
                    let source = element.semanticName
                    let trigger = interaction.trigger.title
                    let transition = interaction.transition.title
                    let action = switch interaction.action {
                    case .navigate(let screenID):
                        "跳转到 \"\(screensByID[screenID]?.name ?? "未知页面")\""
                    case .goBack:
                        "返回上一页"
                    case .toggleState(let stateID):
                        let name = stateID.flatMap { stateNamesByElementID[element.id]?[$0] } ?? "下一个状态"
                        "切换到 \"\(name)\""
                    }
                    return "\"\(source)\" -> \(trigger) -> \(action)（\(transition)）"
                }
            }
        }
    }

    private func sanitizedFilename(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Prototype" : trimmed.replacingOccurrences(of: "/", with: "-")
    }
}

private extension InteractionTrigger {
    var title: String {
        switch self {
        case .tap:
            return "点击"
        case .longPress:
            return "长按"
        case .hover:
            return "悬停"
        }
    }
}

private extension TransitionStyle {
    var title: String {
        switch self {
        case .none:
            return "无动画"
        case .slideFromRight:
            return "从右滑入"
        case .slideFromBottom:
            return "从底弹出"
        case .crossFade:
            return "淡入淡出"
        }
    }
}
