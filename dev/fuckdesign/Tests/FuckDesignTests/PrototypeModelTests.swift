/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import Foundation
import Testing
@testable import FuckDesign

struct PrototypeModelTests {
    @Test
    func projectRoundTripPreservesScreensElementsAndAIConfig() throws {
        let project = PrototypeProject.sample
        let data = try JSONEncoder.projectEncoder.encode(project)
        let decoded = try JSONDecoder.projectDecoder.decode(PrototypeProject.self, from: data)

        #expect(decoded.name == project.name)
        #expect(decoded.screens.count == 1)
        #expect(decoded.screens.first?.elements.count == 1)
        #expect(decoded.ai.baseURL == "https://api.siliconflow.cn/v1")
        #expect(decoded.displaySemanticLabels)
    }

    @Test
    func interactionActionEncodingDistinguishesNavigateAndToggleState() throws {
        let target = UUID()
        let state = UUID()
        let actions: [InteractionAction] = [
            .navigate(screenID: target),
            .toggleState(stateID: state),
            .goBack
        ]

        let data = try JSONEncoder.projectEncoder.encode(actions)
        let decoded = try JSONDecoder.projectDecoder.decode([InteractionAction].self, from: data)

        #expect(decoded[0] == InteractionAction.navigate(screenID: target))
        #expect(decoded[1] == InteractionAction.toggleState(stateID: state))
        #expect(decoded[2] == InteractionAction.goBack)
    }

    @Test
    func visualStateListKeepsDefaultFlagAndText() throws {
        let element = Screen.sample.elements[0]
        let data = try JSONEncoder.projectEncoder.encode(element)
        let decoded = try JSONDecoder.projectDecoder.decode(Element.self, from: data)

        #expect(decoded.states.count == 2)
        #expect(decoded.states.first?.isDefault == true)
        #expect(decoded.states.last?.name == "选中态")
        #expect(decoded.states.last?.text == "Button")
    }
}
