/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import SwiftUI

struct PreviewPlayerView: View {
    @ObservedObject var store: ProjectStore
    @State private var stack: [UUID] = []
    @State private var stateOverrides: [UUID: UUID] = [:]

    var body: some View {
        ZStack {
            Color.black.opacity(0.92).ignoresSafeArea()

            VStack(spacing: 18) {
                header
                previewStage
                footer
            }
            .padding(28)
        }
        .onAppear {
            if stack.isEmpty {
                stack = [store.project.preview.initialScreenID]
            }
        }
    }

    private var header: some View {
        HStack {
            Button("Close Preview") { store.showingPreview = false }
            Button("Back") { goBack() }
                .disabled(stack.count <= 1)
            Spacer()
            Text(currentScreen?.name ?? "Preview")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    private var previewStage: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 28)
                .fill(Color.white)
                .overlay(
                    RoundedRectangle(cornerRadius: 28)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )

            if let screen = currentScreen {
                ForEach(screen.elements) { element in
                    PreviewElementView(
                        element: runtimeElement(for: element),
                        showSemanticLabels: store.project.displaySemanticLabels
                    ) { trigger in
                        performInteraction(for: element, trigger: trigger)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 80)
        .padding(.vertical, 20)
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Breadcrumb")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.7))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(stack.enumerated()), id: \.offset) { index, screenID in
                        Text(screenName(for: screenID))
                            .font(.system(size: 12, weight: .medium))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(index == stack.count - 1 ? Color.white.opacity(0.18) : Color.white.opacity(0.08), in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
            }
        }
    }

    private var currentScreen: Screen? {
        let currentID = stack.last ?? store.project.preview.initialScreenID
        return store.project.screens.first(where: { $0.id == currentID })
    }

    private func screenName(for id: UUID) -> String {
        store.project.screens.first(where: { $0.id == id })?.name ?? "Unknown"
    }

    private func runtimeElement(for element: Element) -> Element {
        guard let stateID = stateOverrides[element.id],
              let state = element.states.first(where: { $0.id == stateID }) else {
            return element
        }

        var result = element
        result.frame = state.frame
        result.text = state.text
        result.style = state.style
        return result
    }

    private func performInteraction(for element: Element, trigger: InteractionTrigger) {
        guard let interaction = element.interactions.first(where: { $0.trigger == trigger }) else { return }
        withAnimation(animation(for: interaction.transition)) {
            switch interaction.action {
            case .navigate(let screenID):
                stack.append(screenID)
            case .goBack:
                goBack()
            case .toggleState(let stateID):
                let current = stateOverrides[element.id]
                if current == stateID || stateID == nil {
                    stateOverrides[element.id] = element.states.first(where: \.isDefault)?.id
                } else {
                    stateOverrides[element.id] = stateID
                }
            }
        }
    }

    private func goBack() {
        guard stack.count > 1 else { return }
        stack.removeLast()
    }

    private func animation(for style: TransitionStyle) -> Animation {
        switch style {
        case .none: return .linear(duration: 0.01)
        case .slideFromRight: return .easeInOut(duration: 0.25)
        case .slideFromBottom: return .spring(response: 0.32, dampingFraction: 0.9)
        case .crossFade: return .easeInOut(duration: 0.22)
        }
    }
}

private struct PreviewElementView: View {
    let element: Element
    let showSemanticLabels: Bool
    let trigger: (InteractionTrigger) -> Void

    var body: some View {
        Group {
            switch element.kind {
            case .line:
                lineBody
            case .rectangle, .ellipse, .text:
                nodeBody
            }
        }
        .onTapGesture { trigger(.tap) }
        .onLongPressGesture { trigger(.longPress) }
        .onHover { hovering in
            if hovering {
                trigger(.hover)
            }
        }
    }

    private var nodeBody: some View {
        ZStack(alignment: .topLeading) {
            shapeBody
            if showSemanticLabels && element.semanticLabelVisible {
                Text(element.semanticName)
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.8), in: Capsule())
                    .foregroundStyle(.white)
                    .offset(x: 8, y: -22)
            }
        }
        .frame(width: element.frame.width, height: element.frame.height, alignment: .topLeading)
        .position(
            x: element.frame.x + element.frame.width / 2,
            y: element.frame.y + element.frame.height / 2
        )
    }

    @ViewBuilder
    private var shapeBody: some View {
        switch element.kind {
        case .rectangle:
            RoundedRectangle(cornerRadius: element.style.cornerRadius)
                .fill(element.style.fill.swiftUIColor.opacity(element.style.opacity))
                .overlay(
                    RoundedRectangle(cornerRadius: element.style.cornerRadius)
                        .stroke(element.style.stroke.swiftUIColor, lineWidth: element.style.strokeWidth)
                )
                .overlay(textBody)
        case .ellipse:
            Ellipse()
                .fill(element.style.fill.swiftUIColor.opacity(element.style.opacity))
                .overlay(
                    Ellipse()
                        .stroke(element.style.stroke.swiftUIColor, lineWidth: element.style.strokeWidth)
                )
                .overlay(textBody)
        case .text:
            textBody
        case .line:
            EmptyView()
        }
    }

    private var textBody: some View {
        Text(element.text)
            .font(.system(size: element.style.fontSize, weight: element.style.fontWeight.swiftUIFontWeight))
            .foregroundStyle(element.style.textColor.swiftUIColor)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: element.textAlignment.swiftUIAlignment)
            .multilineTextAlignment(element.textAlignment.swiftUITextAlignment)
            .padding(10)
    }

    private var lineBody: some View {
        let line = element.line ?? .init(start: .init(x: element.frame.x, y: element.frame.y), end: .init(x: element.frame.x + 120, y: element.frame.y + 60))
        return ZStack {
            Path { path in
                path.move(to: CGPoint(x: line.start.x, y: line.start.y))
                path.addLine(to: CGPoint(x: line.end.x, y: line.end.y))
            }
            .stroke(element.style.stroke.swiftUIColor, lineWidth: max(2, element.style.strokeWidth))

            if element.style.arrowHead {
                PreviewArrowHeadShape(
                    start: CGPoint(x: line.start.x, y: line.start.y),
                    end: CGPoint(x: line.end.x, y: line.end.y)
                )
                .fill(element.style.stroke.swiftUIColor)
            }
        }
    }
}

private struct PreviewArrowHeadShape: Shape {
    let start: CGPoint
    let end: CGPoint

    func path(in rect: CGRect) -> Path {
        let angle = atan2(end.y - start.y, end.x - start.x)
        let length: CGFloat = 14
        let left = CGPoint(
            x: end.x - length * cos(angle - .pi / 6),
            y: end.y - length * sin(angle - .pi / 6)
        )
        let right = CGPoint(
            x: end.x - length * cos(angle + .pi / 6),
            y: end.y - length * sin(angle + .pi / 6)
        )

        var path = Path()
        path.move(to: end)
        path.addLine(to: left)
        path.addLine(to: right)
        path.closeSubpath()
        return path
    }
}

private extension ColorValue {
    var swiftUIColor: Color {
        Color(red: red, green: green, blue: blue, opacity: alpha)
    }
}

private extension FontWeightOption {
    var swiftUIFontWeight: Font.Weight {
        switch self {
        case .regular: return .regular
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        }
    }
}

private extension TextAlignmentOption {
    var swiftUIAlignment: Alignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }

    var swiftUITextAlignment: TextAlignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }
}
