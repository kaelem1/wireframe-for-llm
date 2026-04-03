/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import XCTest
@testable import FuckDesign

final class PrototypeModelTests: XCTestCase {
    func testProjectRoundTripPreservesScreensElementsAndAIConfig() throws {
        let project = PrototypeProject.sample
        let data = try JSONEncoder.projectEncoder.encode(project)
        let decoded = try JSONDecoder.projectDecoder.decode(PrototypeProject.self, from: data)

        XCTAssertEqual(decoded.name, project.name)
        XCTAssertEqual(decoded.screens.count, 1)
        XCTAssertEqual(decoded.screens.first?.elements.count, 1)
        XCTAssertEqual(decoded.ai.baseURL, "https://api.siliconflow.cn/v1")
        XCTAssertTrue(decoded.displaySemanticLabels)
    }

    func testInteractionActionEncodingDistinguishesNavigateAndToggleState() throws {
        let target = UUID()
        let state = UUID()
        let actions: [InteractionAction] = [
            .navigate(screenID: target),
            .toggleState(stateID: state),
            .goBack
        ]

        let data = try JSONEncoder.projectEncoder.encode(actions)
        let decoded = try JSONDecoder.projectDecoder.decode([InteractionAction].self, from: data)

        XCTAssertEqual(decoded[0], .navigate(screenID: target))
        XCTAssertEqual(decoded[1], .toggleState(stateID: state))
        XCTAssertEqual(decoded[2], .goBack)
    }

    func testVisualStateListKeepsDefaultFlagAndText() throws {
        let element = Screen.sample.elements[0]
        let data = try JSONEncoder.projectEncoder.encode(element)
        let decoded = try JSONDecoder.projectDecoder.decode(Element.self, from: data)

        XCTAssertEqual(decoded.states.count, 2)
        XCTAssertEqual(decoded.states.first?.isDefault, true)
        XCTAssertEqual(decoded.states.last?.name, "选中态")
        XCTAssertEqual(decoded.states.last?.text, "Button")
    }
}
