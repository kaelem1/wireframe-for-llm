/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import AppKit
import SwiftUI

struct InspectorView: View {
    @ObservedObject var store: ProjectStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                projectSection

                Divider()

                if let element = store.selectedElement {
                    elementSection(element)
                    styleSection(element)
                    stateSection(element)
                    interactionSection(element)
                } else {
                    Text("Select an element to edit semantic name, style, state, and interactions.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(16)
        }
        .frame(minWidth: 320)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var projectSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Project")

            TextField(
                "Project Name",
                text: Binding(
                    get: { store.project.name },
                    set: { value in store.updateProject { $0.name = value } }
                )
            )
            .textFieldStyle(.roundedBorder)

            Toggle(
                "Show Semantic Labels",
                isOn: Binding(
                    get: { store.project.displaySemanticLabels },
                    set: { store.setDisplaySemanticLabels($0) }
                )
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("Grid")
                    .font(.system(size: 12, weight: .semibold))
                HStack {
                    Text("Size")
                    Spacer()
                    TextField(
                        "Grid",
                        value: Binding(
                            get: { store.project.grid.size },
                            set: { value in store.updateGrid { $0.size = max(4, value) } }
                        ),
                        format: .number.precision(.fractionLength(0...0))
                    )
                    .frame(width: 72)
                    .textFieldStyle(.roundedBorder)
                }
                Toggle(
                    "Snap to Grid",
                    isOn: Binding(
                        get: { store.project.grid.snapEnabled },
                        set: { value in store.updateGrid { $0.snapEnabled = value } }
                    )
                )
                Toggle(
                    "Smart Guides",
                    isOn: Binding(
                        get: { store.project.grid.smartGuidesEnabled },
                        set: { value in store.updateGrid { $0.smartGuidesEnabled = value } }
                    )
                )
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("AI")
                    .font(.system(size: 12, weight: .semibold))
                TextField(
                    "Base URL",
                    text: Binding(
                        get: { store.project.ai.baseURL },
                        set: { value in store.updateAIConfiguration { $0.baseURL = value } }
                    )
                )
                .textFieldStyle(.roundedBorder)
                SecureField(
                    "API Key",
                    text: Binding(
                        get: { store.project.ai.apiKey },
                        set: { value in store.updateAIConfiguration { $0.apiKey = value } }
                    )
                )
                .textFieldStyle(.roundedBorder)
                TextField(
                    "Model",
                    text: Binding(
                        get: { store.project.ai.model },
                        set: { value in store.updateAIConfiguration { $0.model = value } }
                    )
                )
                .textFieldStyle(.roundedBorder)
            }
        }
    }

    private func elementSection(_ element: Element) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Element")

            TextField("Semantic Name", text: elementBinding(element.id, \.semanticName, fallback: ""))
                .textFieldStyle(.roundedBorder)

            if element.kind != .line {
                TextField("Text", text: elementBinding(element.id, \.text, fallback: ""))
                    .textFieldStyle(.roundedBorder)
            }

            Toggle("Semantic Label Visible", isOn: elementBinding(element.id, \.semanticLabelVisible, fallback: true))

            Picker("Alignment", selection: elementBinding(element.id, \.textAlignment, fallback: .center)) {
                ForEach(TextAlignmentOption.allCases) { option in
                    Text(option.rawValue.capitalized).tag(option)
                }
            }

            Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                GridRow {
                    numberField("X", value: elementBinding(element.id, path: \.frame.x, fallback: element.frame.x))
                    numberField("Y", value: elementBinding(element.id, path: \.frame.y, fallback: element.frame.y))
                }
                if element.kind != .line {
                    GridRow {
                        numberField("Width", value: elementBinding(element.id, path: \.frame.width, fallback: element.frame.width))
                        numberField("Height", value: elementBinding(element.id, path: \.frame.height, fallback: element.frame.height))
                    }
                }
            }

            HStack(spacing: 8) {
                Button("Forward") { store.bringForward() }
                Button("Backward") { store.sendBackward() }
                Button("Front") { store.bringToFront() }
                Button("Back") { store.sendToBack() }
            }
            .buttonStyle(.bordered)
        }
    }

    private func styleSection(_ element: Element) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Style")

            colorPicker("Fill", binding: styleBinding(element.id, \.fill, fallback: element.style.fill))
            colorPicker("Stroke", binding: styleBinding(element.id, \.stroke, fallback: element.style.stroke))
            colorPicker("Text", binding: styleBinding(element.id, \.textColor, fallback: element.style.textColor))

            slider("Stroke Width", value: styleBinding(element.id, \.strokeWidth, fallback: element.style.strokeWidth), range: 0...12)
            slider("Corner Radius", value: styleBinding(element.id, \.cornerRadius, fallback: element.style.cornerRadius), range: 0...40)
            slider("Opacity", value: styleBinding(element.id, \.opacity, fallback: element.style.opacity), range: 0.1...1)
            slider("Font Size", value: styleBinding(element.id, \.fontSize, fallback: element.style.fontSize), range: 10...42)

            Picker("Font Weight", selection: styleBinding(element.id, \.fontWeight, fallback: element.style.fontWeight)) {
                ForEach(FontWeightOption.allCases) { weight in
                    Text(weight.rawValue.capitalized).tag(weight)
                }
            }

            if element.kind == .line {
                Toggle("Arrow Head", isOn: styleBinding(element.id, \.arrowHead, fallback: element.style.arrowHead))
            }
        }
    }

    private func stateSection(_ element: Element) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionTitle("Visual States")
                Spacer()
                Button("Add State") { store.addVisualState(to: element.id) }
                    .buttonStyle(.bordered)
            }

            ForEach(element.states) { state in
                VStack(alignment: .leading, spacing: 8) {
                    TextField(
                        "State Name",
                        text: Binding(
                            get: { state.name },
                            set: { value in
                                store.updateVisualState(elementID: element.id, stateID: state.id) { $0.name = value }
                            }
                        )
                    )
                    .textFieldStyle(.roundedBorder)

                    HStack(spacing: 8) {
                        Button(state.isDefault ? "Default" : "Make Default") {
                            store.setDefaultVisualState(elementID: element.id, stateID: state.id)
                        }
                        .buttonStyle(.bordered)

                        Button("Delete") {
                            store.removeVisualState(elementID: element.id, stateID: state.id)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding(10)
                .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func interactionSection(_ element: Element) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                sectionTitle("Interactions")
                Spacer()
                Button("Add Interaction") { store.addInteraction(to: element.id) }
                    .buttonStyle(.bordered)
            }

            ForEach(element.interactions) { interaction in
                InteractionEditor(store: store, element: element, interaction: interaction)
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .semibold))
    }

    private func slider(_ title: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                Spacer()
                Text(value.wrappedValue.formatted(.number.precision(.fractionLength(0...1))))
                    .foregroundStyle(.secondary)
            }
            Slider(value: value, in: range)
        }
    }

    private func colorPicker(_ title: String, binding: Binding<ColorValue>) -> some View {
        ColorPicker(
            title,
            selection: Binding(
                get: { binding.wrappedValue.swiftUIColor },
                set: { binding.wrappedValue = ColorValue(nsColor: NSColor($0)) }
            )
        )
    }

    private func numberField(_ title: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            TextField(title, value: value, format: .number.precision(.fractionLength(0...1)))
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: .infinity)
        }
    }

    private func elementBinding<T>(_ elementID: UUID, _ keyPath: WritableKeyPath<Element, T>, fallback: T) -> Binding<T> {
        Binding(
            get: {
                store.selectedElement?[keyPath: keyPath] ?? fallback
            },
            set: { value in
                store.updateElement(elementID) { $0[keyPath: keyPath] = value }
            }
        )
    }

    private func elementBinding(_ elementID: UUID, path: WritableKeyPath<RectData, Double>, fallback: Double) -> Binding<Double> {
        Binding(
            get: {
                store.selectedElement?.frame[keyPath: path] ?? fallback
            },
            set: { value in
                store.updateElement(elementID) { element in
                    element.frame[keyPath: path] = value
                }
            }
        )
    }

    private func styleBinding<T>(_ elementID: UUID, _ keyPath: WritableKeyPath<ElementStyle, T>, fallback: T) -> Binding<T> {
        Binding(
            get: {
                store.selectedElement?.style[keyPath: keyPath] ?? fallback
            },
            set: { value in
                store.updateElement(elementID) { element in
                    element.style[keyPath: keyPath] = value
                }
            }
        )
    }
}

private struct InteractionEditor: View {
    @ObservedObject var store: ProjectStore
    let element: Element
    let interaction: Interaction

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Trigger", selection: binding(\.trigger, fallback: interaction.trigger)) {
                ForEach(InteractionTrigger.allCases) { trigger in
                    Text(trigger.rawValue.capitalized).tag(trigger)
                }
            }

            Picker("Action", selection: actionKindBinding) {
                ForEach(InteractionActionKind.allCases) { kind in
                    Text(kind.title).tag(kind)
                }
            }

            if actionKindBinding.wrappedValue == .navigate {
                Picker("Target Screen", selection: navigateTargetBinding) {
                    ForEach(store.screens) { screen in
                        Text(screen.name).tag(screen.id)
                    }
                }
            }

            if actionKindBinding.wrappedValue == .toggleState {
                Picker("Target State", selection: toggleStateBinding) {
                    Text("Default").tag(UUID?.none)
                    ForEach(element.states) { state in
                        Text(state.name).tag(Optional(state.id))
                    }
                }
            }

            Picker("Transition", selection: binding(\.transition, fallback: interaction.transition)) {
                ForEach(TransitionStyle.allCases) { style in
                    Text(style.rawValue).tag(style)
                }
            }

            HStack {
                Spacer()
                Button("Remove") {
                    store.removeInteraction(elementID: element.id, interactionID: interaction.id)
                }
            }
        }
        .padding(10)
        .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
    }

    private var actionKindBinding: Binding<InteractionActionKind> {
        Binding(
            get: { InteractionActionKind(interaction.action) },
            set: { kind in
                store.updateInteraction(elementID: element.id, interactionID: interaction.id) { current in
                    switch kind {
                    case .navigate:
                        current.action = .navigate(screenID: store.screens.first?.id ?? store.project.currentScreenID)
                    case .goBack:
                        current.action = .goBack
                    case .toggleState:
                        current.action = .toggleState(stateID: element.states.first?.id)
                    }
                }
            }
        )
    }

    private var navigateTargetBinding: Binding<UUID> {
        Binding(
            get: {
                if case .navigate(let screenID) = interaction.action {
                    return screenID
                }
                return store.project.currentScreenID
            },
            set: { target in
                store.updateInteraction(elementID: element.id, interactionID: interaction.id) { $0.action = .navigate(screenID: target) }
            }
        )
    }

    private var toggleStateBinding: Binding<UUID?> {
        Binding(
            get: {
                if case .toggleState(let stateID) = interaction.action {
                    return stateID
                }
                return nil
            },
            set: { target in
                store.updateInteraction(elementID: element.id, interactionID: interaction.id) { $0.action = .toggleState(stateID: target) }
            }
        )
    }

    private func binding<T>(_ keyPath: WritableKeyPath<Interaction, T>, fallback: T) -> Binding<T> {
        Binding(
            get: { interaction[keyPath: keyPath] },
            set: { value in
                store.updateInteraction(elementID: element.id, interactionID: interaction.id) { $0[keyPath: keyPath] = value }
            }
        )
    }
}

private enum InteractionActionKind: String, CaseIterable, Identifiable {
    case navigate
    case goBack
    case toggleState

    var id: String { rawValue }

    var title: String {
        switch self {
        case .navigate: return "Navigate to Screen"
        case .goBack: return "Go Back"
        case .toggleState: return "Toggle State"
        }
    }

    init(_ action: InteractionAction) {
        switch action {
        case .navigate: self = .navigate
        case .goBack: self = .goBack
        case .toggleState: self = .toggleState
        }
    }
}

private extension ColorValue {
    init(nsColor: NSColor) {
        let rgb = nsColor.usingColorSpace(.deviceRGB) ?? .black
        self.init(
            red: rgb.redComponent,
            green: rgb.greenComponent,
            blue: rgb.blueComponent,
            alpha: rgb.alphaComponent
        )
    }

    var swiftUIColor: Color {
        Color(red: red, green: green, blue: blue, opacity: alpha)
    }
}
