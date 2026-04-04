/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import CoreGraphics
import Foundation
import Testing
@testable import FuckDesign

struct ServiceTests {
    @Test
    func llmClientBuildsOpenAICompatibleRequest() throws {
        let client = LLMClient(configuration: .init(baseURL: "https://example.com/v1", apiKey: "secret", model: "demo-model"))

        let request = try client.makeRequest(prompt: "生成登录页")

        #expect(request.url?.absoluteString == "https://example.com/v1/chat/completions")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")

        let body = try #require(request.httpBody)
        let payload = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        #expect(payload?["model"] as? String == "demo-model")
        #expect((payload?["response_format"] as? [String: Any])?["type"] as? String == "json_object")

        let messages = try #require(payload?["messages"] as? [[String: Any]])
        #expect(messages.count == 2)
        #expect((messages[0]["content"] as? String)?.contains("\"pages\"") == true)
    }

    @Test
    func llmClientDecodesStructuredSpecFromChatCompletion() throws {
        let client = LLMClient(configuration: .init(baseURL: "https://example.com/v1", apiKey: "", model: "demo-model"))
        let response = """
        {
          "choices": [
            {
              "message": {
                "content": "{\\"pages\\":[{\\"name\\":\\"登录页\\",\\"elements\\":[{\\"id\\":\\"login-button\\",\\"type\\":\\"rectangle\\",\\"semanticName\\":\\"登录按钮\\",\\"x\\":120,\\"y\\":240,\\"width\\":180,\\"height\\":52,\\"text\\":\\"登录\\",\\"states\\":[{\\"name\\":\\"默认态\\",\\"text\\":\\"登录\\",\\"width\\":180,\\"height\\":52}]}]}],\\"interactions\\":[{\\"sourceElementID\\":\\"login-button\\",\\"sourcePageName\\":\\"登录页\\",\\"trigger\\":\\"tap\\",\\"action\\":\\"navigate\\",\\"targetScreenName\\":\\"首页\\",\\"transition\\":\\"slideFromRight\\"}]}"
              }
            }
          ]
        }
        """

        let spec = try client.decodeSpec(from: Data(response.utf8))

        #expect(spec.pages.count == 1)
        #expect(spec.pages[0].name == "登录页")
        #expect(spec.pages[0].elements[0].semanticName == "登录按钮")
        #expect(spec.interactions[0].action == AIInteractionAction.navigate)
        #expect(spec.interactions[0].targetScreenName == "首页")
    }

    @Test
    func llmClientExtractsJSONObjectFromMarkdownFence() throws {
        let client = LLMClient(configuration: .init(baseURL: "https://example.com/v1", apiKey: "", model: "demo-model"))
        let fenced = """
        ```json
        {
          "pages": [],
          "interactions": []
        }
        ```
        """

        let extracted = try client.extractJSONObject(from: Data(fenced.utf8))
        let payload = try JSONSerialization.jsonObject(with: extracted) as? [String: Any]

        #expect((payload?["pages"] as? [Any])?.count == 0)
        #expect((payload?["interactions"] as? [Any])?.count == 0)
    }

    @Test
    func projectExportMarkdownListsPagesElementsAndInteractions() {
        let exportService = ProjectExportService()
        let targetScreen = Screen(id: UUID(), name: "首页", elements: [])
        let stateID = UUID()
        let screen = Screen(
            id: UUID(),
            name: "登录页",
            elements: [
                Element(
                    id: UUID(),
                    kind: .rectangle,
                    semanticName: "登录按钮",
                    semanticLabelVisible: true,
                    frame: .init(x: 120, y: 240, width: 180, height: 52),
                    line: nil,
                    text: "登录",
                    textAlignment: .center,
                    style: .button,
                    states: [
                        .init(id: stateID, name: "默认态", frame: .init(x: 120, y: 240, width: 180, height: 52), text: "登录", style: .button, isDefault: true)
                    ],
                    interactions: [
                        .init(id: UUID(), trigger: .tap, action: .navigate(screenID: targetScreen.id), transition: .slideFromRight),
                        .init(id: UUID(), trigger: .tap, action: .toggleState(stateID: stateID), transition: .crossFade)
                    ]
                )
            ]
        )
        let project = PrototypeProject(
            version: 1,
            name: "原型项目",
            screens: [screen, targetScreen],
            currentScreenID: screen.id,
            displaySemanticLabels: true,
            grid: .init(size: 8, snapEnabled: true, smartGuidesEnabled: true),
            preview: .init(initialScreenID: screen.id),
            ai: .init(baseURL: "https://example.com/v1", apiKey: "", model: "demo-model")
        )

        let markdown = exportService.exportMarkdown(project: project)

        #expect(markdown.contains("# 原型项目"))
        #expect(markdown.contains("### 登录页"))
        #expect(markdown.contains("登录按钮 | rectangle"))
        #expect(markdown.contains("\"登录按钮\" -> 点击 -> 跳转到 \"首页\""))
        #expect(markdown.contains("\"登录按钮\" -> 点击 -> 切换到 \"默认态\""))
    }

    @Test
    func projectExportJSONPreservesStructuredPages() throws {
        let exportService = ProjectExportService()
        let project = PrototypeProject.sample

        let data = try exportService.exportJSON(project: project)
        let decoded = try JSONDecoder.projectDecoder.decode(ProjectExportService.ExportDocument.self, from: data)

        #expect(decoded.projectName == project.name)
        #expect(decoded.pages.count == project.screens.count)
        #expect(decoded.pages[0].elements[0].semanticName == "主按钮")
    }

    @Test
    func projectExportBundleWritesMarkdownAndJSONFiles() throws {
        let exportService = ProjectExportService()
        let directoryURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString, isDirectory: true)

        let bundle = try exportService.exportBundle(project: .sample, to: directoryURL)
        let markdown = try String(contentsOf: bundle.markdownURL, encoding: .utf8)
        let json = try Data(contentsOf: bundle.jsonURL)

        #expect(FileManager.default.fileExists(atPath: bundle.markdownURL.path))
        #expect(FileManager.default.fileExists(atPath: bundle.jsonURL.path))
        #expect(markdown.contains("# New Prototype"))
        #expect(!json.isEmpty)
    }

    @Test
    func screenshotArrowHeadPointsReturnTipAndWings() {
        let service = ScreenshotExportService()

        let points = service.arrowHeadPoints(
            from: CGPoint(x: 10, y: 10),
            to: CGPoint(x: 50, y: 10),
            length: 12
        )

        #expect(points.count == 3)
        #expect(abs(points[0].x - 50) < 0.001)
        #expect(abs(points[0].y - 10) < 0.001)
        #expect(points[1].x < 50)
        #expect(points[2].x < 50)
        #expect(points[1].y != points[2].y)
    }
}
