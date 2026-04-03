/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import Foundation

struct PrototypeProject: Codable, Equatable {
    var version: Int
    var name: String
    var screens: [Screen]
    var currentScreenID: UUID
    var displaySemanticLabels: Bool
    var grid: GridSettings
    var preview: PreviewConfiguration
    var ai: AIConfiguration

    static let sample = PrototypeProject(
        version: 1,
        name: "New Prototype",
        screens: [Screen.sample],
        currentScreenID: Screen.sample.id,
        displaySemanticLabels: true,
        grid: .init(size: 8, snapEnabled: true, smartGuidesEnabled: true),
        preview: .init(initialScreenID: Screen.sample.id),
        ai: .init(baseURL: "https://api.siliconflow.cn/v1", apiKey: "", model: "zai-org/GLM-4.6")
    )
}

struct Screen: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
    var elements: [Element]

    static let sample = Screen(
        id: UUID(),
        name: "Screen 1",
        elements: [
            Element(
                id: UUID(),
                kind: .rectangle,
                semanticName: "主按钮",
                semanticLabelVisible: true,
                frame: .init(x: 120, y: 120, width: 180, height: 56),
                line: nil,
                text: "Button",
                textAlignment: .center,
                style: .button,
                states: [
                    .init(id: UUID(), name: "默认态", frame: .init(x: 120, y: 120, width: 180, height: 56), text: "Button", style: .button, isDefault: true),
                    .init(id: UUID(), name: "选中态", frame: .init(x: 120, y: 120, width: 180, height: 56), text: "Button", style: .buttonSelected, isDefault: false)
                ],
                interactions: []
            )
        ]
    )
}

struct Element: Codable, Equatable, Identifiable {
    var id: UUID
    var kind: ElementKind
    var semanticName: String
    var semanticLabelVisible: Bool
    var frame: RectData
    var line: LineData?
    var text: String
    var textAlignment: TextAlignmentOption
    var style: ElementStyle
    var states: [VisualState]
    var interactions: [Interaction]
}

enum ElementKind: String, Codable, CaseIterable, Identifiable {
    case rectangle
    case ellipse
    case line
    case text

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rectangle: return "Rectangle"
        case .ellipse: return "Ellipse"
        case .line: return "Line"
        case .text: return "Text"
        }
    }
}

struct RectData: Codable, Equatable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
}

struct PointData: Codable, Equatable {
    var x: Double
    var y: Double
}

struct LineData: Codable, Equatable {
    var start: PointData
    var end: PointData
}

struct VisualState: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
    var frame: RectData
    var text: String
    var style: ElementStyle
    var isDefault: Bool
}

struct ElementStyle: Codable, Equatable {
    var fill: ColorValue
    var stroke: ColorValue
    var strokeWidth: Double
    var cornerRadius: Double
    var opacity: Double
    var textColor: ColorValue
    var fontSize: Double
    var fontWeight: FontWeightOption
    var arrowHead: Bool

    static let button = ElementStyle(
        fill: .init(red: 0.15, green: 0.57, blue: 0.96),
        stroke: .init(red: 0.11, green: 0.44, blue: 0.81),
        strokeWidth: 1,
        cornerRadius: 14,
        opacity: 1,
        textColor: .white,
        fontSize: 15,
        fontWeight: .semibold,
        arrowHead: false
    )

    static let buttonSelected = ElementStyle(
        fill: .init(red: 0.07, green: 0.38, blue: 0.76),
        stroke: .init(red: 0.07, green: 0.38, blue: 0.76),
        strokeWidth: 1,
        cornerRadius: 14,
        opacity: 1,
        textColor: .white,
        fontSize: 15,
        fontWeight: .bold,
        arrowHead: false
    )

    static let wireframe = ElementStyle(
        fill: .init(red: 0.96, green: 0.97, blue: 0.99),
        stroke: .init(red: 0.31, green: 0.36, blue: 0.45),
        strokeWidth: 1.5,
        cornerRadius: 12,
        opacity: 1,
        textColor: .init(red: 0.12, green: 0.15, blue: 0.22),
        fontSize: 14,
        fontWeight: .medium,
        arrowHead: false
    )
}

struct ColorValue: Codable, Equatable {
    var red: Double
    var green: Double
    var blue: Double
    var alpha: Double

    init(red: Double, green: Double, blue: Double, alpha: Double = 1) {
        self.red = red
        self.green = green
        self.blue = blue
        self.alpha = alpha
    }

    static let white = ColorValue(red: 1, green: 1, blue: 1)
}

enum FontWeightOption: String, Codable, CaseIterable, Identifiable {
    case regular
    case medium
    case semibold
    case bold

    var id: String { rawValue }
}

enum TextAlignmentOption: String, Codable, CaseIterable, Identifiable {
    case leading
    case center
    case trailing

    var id: String { rawValue }
}

struct Interaction: Codable, Equatable, Identifiable {
    var id: UUID
    var trigger: InteractionTrigger
    var action: InteractionAction
    var transition: TransitionStyle
}

enum InteractionTrigger: String, Codable, CaseIterable, Identifiable {
    case tap
    case longPress
    case hover

    var id: String { rawValue }
}

enum TransitionStyle: String, Codable, CaseIterable, Identifiable {
    case none
    case slideFromRight
    case slideFromBottom
    case crossFade

    var id: String { rawValue }
}

enum InteractionAction: Codable, Equatable {
    case navigate(screenID: UUID)
    case goBack
    case toggleState(stateID: UUID?)

    enum CodingKeys: String, CodingKey {
        case type
        case screenID
        case stateID
    }

    enum ActionType: String, Codable {
        case navigate
        case goBack
        case toggleState
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(ActionType.self, forKey: .type)
        switch type {
        case .navigate:
            self = .navigate(screenID: try container.decode(UUID.self, forKey: .screenID))
        case .goBack:
            self = .goBack
        case .toggleState:
            self = .toggleState(stateID: try container.decodeIfPresent(UUID.self, forKey: .stateID))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .navigate(let screenID):
            try container.encode(ActionType.navigate, forKey: .type)
            try container.encode(screenID, forKey: .screenID)
        case .goBack:
            try container.encode(ActionType.goBack, forKey: .type)
        case .toggleState(let stateID):
            try container.encode(ActionType.toggleState, forKey: .type)
            try container.encodeIfPresent(stateID, forKey: .stateID)
        }
    }
}

struct GridSettings: Codable, Equatable {
    var size: Double
    var snapEnabled: Bool
    var smartGuidesEnabled: Bool
}

struct PreviewConfiguration: Codable, Equatable {
    var initialScreenID: UUID
}

struct AIConfiguration: Codable, Equatable {
    var baseURL: String
    var apiKey: String
    var model: String
}

struct AIPrototypeSpec: Codable, Equatable {
    var pages: [AIPageSpec]
    var interactions: [AIInteractionSpec]
}

struct AIPageSpec: Codable, Equatable {
    var name: String
    var elements: [AIElementSpec]
}

struct AIElementSpec: Codable, Equatable {
    var id: String
    var type: ElementKind
    var semanticName: String
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var text: String?
    var style: ElementStyle?
    var semanticLabelVisible: Bool?
    var states: [AIVisualStateSpec]?
}

struct AIVisualStateSpec: Codable, Equatable {
    var name: String
    var text: String?
    var style: ElementStyle?
    var width: Double?
    var height: Double?
}

struct AIInteractionSpec: Codable, Equatable {
    var sourceElementID: String
    var sourcePageName: String
    var trigger: InteractionTrigger
    var action: AIInteractionAction
    var targetScreenName: String?
    var targetStateName: String?
    var transition: TransitionStyle
}

enum AIInteractionAction: String, Codable {
    case navigate
    case goBack
    case toggleState
}

extension JSONEncoder {
    static let projectEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()
}

extension JSONDecoder {
    static let projectDecoder = JSONDecoder()
}
