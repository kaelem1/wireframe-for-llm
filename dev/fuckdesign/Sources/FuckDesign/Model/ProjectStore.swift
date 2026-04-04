/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import AppKit
import Combine
import SwiftUI

enum CanvasTool: String, CaseIterable, Identifiable {
    case select
    case hand

    var id: String { rawValue }
}

struct SmartGuide: Equatable, Identifiable {
    let id = UUID()
    var orientation: Orientation
    var position: CGFloat

    enum Orientation {
        case vertical
        case horizontal
    }
}

final class ProjectStore: ObservableObject {
    @Published var project: PrototypeProject
    @Published var tool: CanvasTool = .select
    @Published var selection: Set<UUID> = []
    @Published var canvasScale: CGFloat = 1
    @Published var canvasOffset: CGSize = .zero
    @Published var smartGuides: [SmartGuide] = []
    @Published var showingPreview = false
    @Published var showingAI = false
    @Published var inspectorScreenExpanded = true
    @Published var isSpacePressed = false

    weak var undoManager: UndoManager?

    init(project: PrototypeProject) {
        self.project = project
    }

    var screens: [Screen] { project.screens }

    var currentScreenIndex: Int {
        project.screens.firstIndex(where: { $0.id == project.currentScreenID }) ?? 0
    }

    var currentScreen: Screen {
        get { project.screens[currentScreenIndex] }
        set { project.screens[currentScreenIndex] = newValue }
    }

    var selectedElement: Element? {
        guard selection.count == 1, let id = selection.first else { return nil }
        return currentScreen.elements.first(where: { $0.id == id })
    }

    func bindUndoManager(_ undoManager: UndoManager?) {
        self.undoManager = undoManager
    }

    func updateProject(_ transform: (inout PrototypeProject) -> Void) {
        let previous = project
        transform(&project)
        registerUndo(previous)
    }

    func insertElement(kind: ElementKind) {
        let element = Self.makeElement(kind: kind)
        updateProject {
            $0.screens[currentScreenIndex].elements.append(element)
            $0.currentScreenID = currentScreen.id
        }
        selection = [element.id]
    }

    func select(_ id: UUID, additive: Bool) {
        if additive {
            if selection.contains(id) {
                selection.remove(id)
            } else {
                selection.insert(id)
            }
        } else {
            selection = [id]
        }
    }

    func clearSelection() {
        selection.removeAll()
    }

    func updateElement(_ id: UUID, transform: (inout Element) -> Void) {
        guard let index = currentScreen.elements.firstIndex(where: { $0.id == id }) else { return }
        updateProject {
            transform(&$0.screens[currentScreenIndex].elements[index])
        }
    }

    func updateSelectionFrame(delta: CGSize) {
        smartGuides = []
        updateProject { project in
            var guides: [SmartGuide] = []
            for index in project.screens[currentScreenIndex].elements.indices {
                guard selection.contains(project.screens[currentScreenIndex].elements[index].id) else { continue }
                let element = project.screens[currentScreenIndex].elements[index]
                switch element.kind {
                case .line:
                    guard var line = element.line else { continue }
                    line.start.x += delta.width
                    line.end.x += delta.width
                    line.start.y += delta.height
                    line.end.y += delta.height
                    line.start = snap(line.start)
                    line.end = snap(line.end)
                    project.screens[currentScreenIndex].elements[index].line = line
                case .rectangle, .ellipse, .text:
                    var frame = element.frame
                    frame.x += delta.width
                    frame.y += delta.height
                    let snapped = snap(frame)
                    project.screens[currentScreenIndex].elements[index].frame = snapped.frame
                    guides.append(contentsOf: snapped.guides)
                }
            }
            self.smartGuides = guides
        }
    }

    func finishMove() {
        smartGuides = []
    }

    func resizeElement(_ id: UUID, frame: RectData) {
        updateElement(id) { $0.frame = snap(frame).frame }
    }

    func resizeLine(_ id: UUID, start: PointData? = nil, end: PointData? = nil) {
        updateElement(id) {
            guard var line = $0.line else { return }
            if let start { line.start = snap(start) }
            if let end { line.end = snap(end) }
            $0.line = line
        }
    }

    func duplicateSelection() {
        let elements = currentScreen.elements.filter { selection.contains($0.id) }
        guard !elements.isEmpty else { return }
        let copies = elements.map { element -> Element in
            var copy = element
            copy.id = UUID()
            copy.semanticName += " Copy"
            copy.frame.x += 24
            copy.frame.y += 24
            if var line = copy.line {
                line.start.x += 24
                line.end.x += 24
                line.start.y += 24
                line.end.y += 24
                copy.line = line
            }
            copy.states = copy.states.map { state in
                var next = state
                next.id = UUID()
                return next
            }
            copy.interactions = copy.interactions.map { interaction in
                var next = interaction
                next.id = UUID()
                return next
            }
            return copy
        }
        updateProject {
            $0.screens[currentScreenIndex].elements.append(contentsOf: copies)
        }
        selection = Set(copies.map(\.id))
    }

    func deleteSelection() {
        guard !selection.isEmpty else { return }
        updateProject {
            $0.screens[currentScreenIndex].elements.removeAll { selection.contains($0.id) }
        }
        clearSelection()
    }

    func bringForward() {
        reorderSelection(offset: 1)
    }

    func sendBackward() {
        reorderSelection(offset: -1)
    }

    func bringToFront() {
        guard !selection.isEmpty else { return }
        updateProject {
            let picked = $0.screens[currentScreenIndex].elements.filter { selection.contains($0.id) }
            $0.screens[currentScreenIndex].elements.removeAll { selection.contains($0.id) }
            $0.screens[currentScreenIndex].elements.append(contentsOf: picked)
        }
    }

    func sendToBack() {
        guard !selection.isEmpty else { return }
        updateProject {
            let picked = $0.screens[currentScreenIndex].elements.filter { selection.contains($0.id) }
            $0.screens[currentScreenIndex].elements.removeAll { selection.contains($0.id) }
            $0.screens[currentScreenIndex].elements.insert(contentsOf: picked, at: 0)
        }
    }

    func addScreen() {
        let screen = Screen(id: UUID(), name: "Screen \(project.screens.count + 1)", elements: [])
        updateProject {
            $0.screens.append(screen)
            $0.currentScreenID = screen.id
            $0.preview.initialScreenID = screen.id
        }
    }

    func duplicateCurrentScreen() {
        let source = currentScreen
        var duplicate = source
        duplicate.id = UUID()
        duplicate.name += " Copy"
        duplicate.elements = duplicate.elements.map { element in
            var copy = element
            copy.id = UUID()
            copy.states = copy.states.map {
                var state = $0
                state.id = UUID()
                return state
            }
            copy.interactions = copy.interactions.map {
                var interaction = $0
                interaction.id = UUID()
                return interaction
            }
            return copy
        }
        updateProject {
            $0.screens.insert(duplicate, at: currentScreenIndex + 1)
            $0.currentScreenID = duplicate.id
        }
    }

    func deleteCurrentScreen() {
        guard project.screens.count > 1 else { return }
        let fallback = project.screens[max(0, currentScreenIndex - 1)].id
        updateProject { project in
            project.screens.removeAll { $0.id == project.currentScreenID }
            project.currentScreenID = fallback
            if !project.screens.contains(where: { screen in screen.id == project.preview.initialScreenID }) {
                project.preview.initialScreenID = fallback
            }
        }
        clearSelection()
    }

    func moveScreen(from offsets: IndexSet, to destination: Int) {
        updateProject {
            $0.screens.move(fromOffsets: offsets, toOffset: destination)
        }
    }

    func setCurrentScreen(_ id: UUID) {
        updateProject {
            $0.currentScreenID = id
        }
        clearSelection()
    }

    func updateScreenName(_ id: UUID, name: String) {
        guard let index = project.screens.firstIndex(where: { $0.id == id }) else { return }
        updateProject {
            $0.screens[index].name = name
        }
    }

    func setDisplaySemanticLabels(_ enabled: Bool) {
        updateProject {
            $0.displaySemanticLabels = enabled
        }
    }

    func updateAIConfiguration(_ transform: (inout AIConfiguration) -> Void) {
        updateProject {
            transform(&$0.ai)
        }
    }

    func updateGrid(_ transform: (inout GridSettings) -> Void) {
        updateProject {
            transform(&$0.grid)
        }
    }

    func addVisualState(to elementID: UUID) {
        updateElement(elementID) { element in
            let state = VisualState(
                id: UUID(),
                name: "状态 \(element.states.count + 1)",
                frame: element.frame,
                text: element.text,
                style: element.style,
                isDefault: element.states.isEmpty
            )
            element.states.append(state)
        }
    }

    func updateVisualState(elementID: UUID, stateID: UUID, transform: (inout VisualState) -> Void) {
        updateElement(elementID) { element in
            guard let index = element.states.firstIndex(where: { $0.id == stateID }) else { return }
            transform(&element.states[index])
        }
    }

    func setDefaultVisualState(elementID: UUID, stateID: UUID) {
        updateElement(elementID) { element in
            for index in element.states.indices {
                element.states[index].isDefault = element.states[index].id == stateID
            }
        }
    }

    func removeVisualState(elementID: UUID, stateID: UUID) {
        updateElement(elementID) { element in
            guard element.states.count > 1 else { return }
            element.states.removeAll { $0.id == stateID }
            if !element.states.contains(where: \.isDefault) {
                element.states[0].isDefault = true
            }
        }
    }

    func addInteraction(to elementID: UUID) {
        updateElement(elementID) { element in
            let target = project.screens.first?.id ?? project.currentScreenID
            let interaction = Interaction(
                id: UUID(),
                trigger: .tap,
                action: .navigate(screenID: target),
                transition: .none
            )
            element.interactions.append(interaction)
        }
    }

    func updateInteraction(elementID: UUID, interactionID: UUID, transform: (inout Interaction) -> Void) {
        updateElement(elementID) { element in
            guard let index = element.interactions.firstIndex(where: { $0.id == interactionID }) else { return }
            transform(&element.interactions[index])
        }
    }

    func removeInteraction(elementID: UUID, interactionID: UUID) {
        updateElement(elementID) { element in
            element.interactions.removeAll { $0.id == interactionID }
        }
    }

    func applyAI(spec: AIPrototypeSpec) {
        var createdScreens: [Screen] = []
        var elementLookup: [String: (screen: UUID, element: UUID, states: [String: UUID])] = [:]

        for page in spec.pages {
            var screen = Screen(id: UUID(), name: page.name, elements: [])
            for item in page.elements {
                let defaultStyle = item.style ?? (item.type == .text ? .wireframe : .button)
                let baseFrame = RectData(x: item.x, y: item.y, width: item.width, height: item.height)
                let states = (item.states ?? []).enumerated().map { index, state in
                    VisualState(
                        id: UUID(),
                        name: state.name,
                        frame: .init(
                            x: item.x,
                            y: item.y,
                            width: state.width ?? item.width,
                            height: state.height ?? item.height
                        ),
                        text: state.text ?? item.text ?? item.semanticName,
                        style: state.style ?? defaultStyle,
                        isDefault: index == 0
                    )
                }
                let element = Element(
                    id: UUID(),
                    kind: item.type,
                    semanticName: item.semanticName,
                    semanticLabelVisible: item.semanticLabelVisible ?? true,
                    frame: baseFrame,
                    line: item.type == .line ? .init(start: .init(x: item.x, y: item.y), end: .init(x: item.x + item.width, y: item.y + item.height)) : nil,
                    text: item.text ?? item.semanticName,
                    textAlignment: .center,
                    style: defaultStyle,
                    states: states,
                    interactions: []
                )
                let stateLookup = Dictionary(uniqueKeysWithValues: states.map { ($0.name, $0.id) })
                elementLookup[item.id] = (screen.id, element.id, stateLookup)
                screen.elements.append(element)
            }
            createdScreens.append(screen)
        }

        for link in spec.interactions {
            guard let source = elementLookup[link.sourceElementID],
                  let screenIndex = createdScreens.firstIndex(where: { $0.id == source.screen }),
                  let elementIndex = createdScreens[screenIndex].elements.firstIndex(where: { $0.id == source.element }) else { continue }

            let action: InteractionAction
            switch link.action {
            case .navigate:
                guard let name = link.targetScreenName,
                      let target = createdScreens.first(where: { $0.name == name }) else { continue }
                action = .navigate(screenID: target.id)
            case .goBack:
                action = .goBack
            case .toggleState:
                let stateID = link.targetStateName.flatMap { elementLookup[link.sourceElementID]?.states[$0] }
                action = .toggleState(stateID: stateID)
            }

            createdScreens[screenIndex].elements[elementIndex].interactions.append(
                .init(id: UUID(), trigger: link.trigger, action: action, transition: link.transition)
            )
        }

        updateProject {
            $0.screens = createdScreens
            if let first = createdScreens.first?.id {
                $0.currentScreenID = first
                $0.preview.initialScreenID = first
            }
        }
        clearSelection()
    }

    private func reorderSelection(offset: Int) {
        guard !selection.isEmpty else { return }
        updateProject {
            let elements = $0.screens[currentScreenIndex].elements
            var reordered = elements
            let indexes = elements.indices.filter { selection.contains(elements[$0].id) }.sorted(by: offset > 0 ? (>) : (<))
            for index in indexes {
                let target = index + offset
                guard reordered.indices.contains(target) else { continue }
                reordered.swapAt(index, target)
            }
            $0.screens[currentScreenIndex].elements = reordered
        }
    }

    private func registerUndo(_ previous: PrototypeProject) {
        guard let undoManager else { return }
        undoManager.registerUndo(withTarget: self) { target in
            let current = target.project
            target.project = previous
            target.registerRedo(current)
        }
        undoManager.setActionName("Edit Prototype")
    }

    private func registerRedo(_ project: PrototypeProject) {
        guard let undoManager else { return }
        undoManager.registerUndo(withTarget: self) { target in
            let current = target.project
            target.project = project
            target.registerRedo(current)
        }
    }

    private func snap(_ frame: RectData) -> (frame: RectData, guides: [SmartGuide]) {
        guard project.grid.snapEnabled else { return (frame, []) }
        let size = project.grid.size
        var next = frame
        next.x = round(next.x / size) * size
        next.y = round(next.y / size) * size
        if !project.grid.smartGuidesEnabled {
            return (next, [])
        }

        let movingCenterX = next.x + next.width / 2
        let movingCenterY = next.y + next.height / 2
        for other in currentScreen.elements where !selection.contains(other.id) && other.kind != .line {
            let centerX = other.frame.x + other.frame.width / 2
            let centerY = other.frame.y + other.frame.height / 2
            if abs(centerX - movingCenterX) < 4 {
                next.x += centerX - movingCenterX
                return (next, [SmartGuide(orientation: .vertical, position: centerX)])
            }
            if abs(centerY - movingCenterY) < 4 {
                next.y += centerY - movingCenterY
                return (next, [SmartGuide(orientation: .horizontal, position: centerY)])
            }
        }
        return (next, [])
    }

    private func snap(_ point: PointData) -> PointData {
        guard project.grid.snapEnabled else { return point }
        let size = project.grid.size
        return .init(
            x: round(point.x / size) * size,
            y: round(point.y / size) * size
        )
    }

    static func makeElement(kind: ElementKind) -> Element {
        let id = UUID()
        let baseStyle = kind == .text ? ElementStyle.wireframe : ElementStyle.button
        let frame = RectData(x: 100, y: 100, width: kind == .text ? 200 : 160, height: kind == .line ? 0 : 80)
        let state = VisualState(id: UUID(), name: "默认态", frame: frame, text: kind == .text ? "Text Label" : kind.title, style: baseStyle, isDefault: true)
        return Element(
            id: id,
            kind: kind,
            semanticName: "\(kind.title) \(Int.random(in: 1...99))",
            semanticLabelVisible: true,
            frame: frame,
            line: kind == .line ? .init(start: .init(x: 100, y: 100), end: .init(x: 280, y: 180)) : nil,
            text: kind == .text ? "Text Label" : kind.title,
            textAlignment: .center,
            style: baseStyle,
            states: [state],
            interactions: []
        )
    }
}
