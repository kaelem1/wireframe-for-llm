/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import CoreGraphics
import Foundation
import XCTest
@testable import FuckDesign

final class ServiceTests: XCTestCase {
    func testLLMClientBuildsOpenAICompatibleRequest() throws {
        let client = LLMClient(configuration: .init(baseURL: "https://example.com/v1", apiKey: "secret", model: "demo-model"))

        let request = try client.makeRequest(prompt: "生成登录页")

        XCTAssertEqual(request.url?.absoluteString, "https://example.com/v1/chat/completions")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer secret")

        let body = try XCTUnwrap(request.httpBody)
        let payload = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(payload?["model"] as? String, "demo-model")
        XCTAssertEqual((payload?["response_format"] as? [String: Any])?["type"] as? String, "json_object")

        let messages = try XCTUnwrap(payload?["messages"] as? [[String: Any]])
        XCTAssertEqual(messages.count, 2)
        XCTAssertTrue((messages[0]["content"] as? String)?.contains("\"pages\"") == true)
    }

    func testLLMClientDecodesStructuredSpecFromChatCompletion() throws {
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

        XCTAssertEqual(spec.pages.count, 1)
        XCTAssertEqual(spec.pages[0].name, "登录页")
        XCTAssertEqual(spec.pages[0].elements[0].semanticName, "登录按钮")
        XCTAssertEqual(spec.interactions[0].action, .navigate)
        XCTAssertEqual(spec.interactions[0].targetScreenName, "首页")
    }

    func testLLMClientExtractsJSONObjectFromMarkdownFence() throws {
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

        XCTAssertEqual((payload?["pages"] as? [Any])?.count, 0)
        XCTAssertEqual((payload?["interactions"] as? [Any])?.count, 0)
    }

    func testProjectExportMarkdownListsPagesElementsAndInteractions() {
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

        XCTAssertTrue(markdown.contains("# 原型项目"))
        XCTAssertTrue(markdown.contains("### 登录页"))
        XCTAssertTrue(markdown.contains("登录按钮 | rectangle"))
        XCTAssertTrue(markdown.contains("\"登录按钮\" -> 点击 -> 跳转到 \"首页\""))
        XCTAssertTrue(markdown.contains("\"登录按钮\" -> 点击 -> 切换到 \"默认态\""))
    }

    func testProjectExportJSONPreservesStructuredPages() throws {
        let exportService = ProjectExportService()
        let project = PrototypeProject.sample

        let data = try exportService.exportJSON(project: project)
        let decoded = try JSONDecoder.projectDecoder.decode(ProjectExportService.ExportDocument.self, from: data)

        XCTAssertEqual(decoded.projectName, project.name)
        XCTAssertEqual(decoded.pages.count, project.screens.count)
        XCTAssertEqual(decoded.pages[0].elements[0].semanticName, "主按钮")
    }

    func testProjectExportBundleWritesMarkdownAndJSONFiles() throws {
        let exportService = ProjectExportService()
        let directoryURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(UUID().uuidString, isDirectory: true)

        let bundle = try exportService.exportBundle(project: .sample, to: directoryURL)
        let markdown = try String(contentsOf: bundle.markdownURL, encoding: .utf8)
        let json = try Data(contentsOf: bundle.jsonURL)

        XCTAssertTrue(FileManager.default.fileExists(atPath: bundle.markdownURL.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: bundle.jsonURL.path))
        XCTAssertTrue(markdown.contains("# 示例项目"))
        XCTAssertFalse(json.isEmpty)
    }

    func testScreenshotArrowHeadPointsReturnTipAndWings() {
        let service = ScreenshotExportService()

        let points = service.arrowHeadPoints(
            from: CGPoint(x: 10, y: 10),
            to: CGPoint(x: 50, y: 10),
            length: 12
        )

        XCTAssertEqual(points.count, 3)
        XCTAssertEqual(points[0].x, 50, accuracy: 0.001)
        XCTAssertEqual(points[0].y, 10, accuracy: 0.001)
        XCTAssertLessThan(points[1].x, 50)
        XCTAssertLessThan(points[2].x, 50)
        XCTAssertNotEqual(points[1].y, points[2].y)
    }
}
