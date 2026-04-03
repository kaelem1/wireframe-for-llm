/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import AppKit
import SwiftUI

struct InfiniteCanvasView: View {
    @ObservedObject var store: ProjectStore
    @State private var baseScale: CGFloat = 1
    @State private var baseOffset: CGSize = .zero

    private let canvasSize = CGSize(width: 4000, height: 3000)

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                CanvasGridView(
                    scale: store.canvasScale,
                    offset: store.canvasOffset,
                    gridSize: store.project.grid.size
                )

                ZStack(alignment: .topLeading) {
                    ForEach(store.currentScreen.elements) { element in
                        EditableCanvasElementView(store: store, element: element)
                    }

                    ForEach(store.smartGuides) { guide in
                        SmartGuideOverlay(guide: guide, size: canvasSize)
                    }
                }
                .frame(width: canvasSize.width, height: canvasSize.height, alignment: .topLeading)
                .scaleEffect(store.canvasScale, anchor: .topLeading)
                .offset(store.canvasOffset)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipped()
            .contentShape(Rectangle())
            .onTapGesture {
                store.clearSelection()
            }
            .gesture(panGesture)
            .simultaneousGesture(zoomGesture)
            .onAppear {
                baseScale = store.canvasScale
                baseOffset = store.canvasOffset
            }
            .overlay(alignment: .topLeading) {
                CanvasHUD(store: store)
                    .padding(16)
            }
            .overlay(alignment: .bottomTrailing) {
                Text("\(Int(store.canvasScale * 100))%")
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(16)
            }
        }
    }

    private var panGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard store.tool == .hand || store.isSpacePressed else { return }
                store.canvasOffset = CGSize(
                    width: baseOffset.width + value.translation.width,
                    height: baseOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                baseOffset = store.canvasOffset
            }
    }

    private var zoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let next = min(max(baseScale * value, 0.25), 2.5)
                store.canvasScale = next
            }
            .onEnded { _ in
                baseScale = store.canvasScale
            }
    }
}

private struct CanvasHUD: View {
    @ObservedObject var store: ProjectStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(store.currentScreen.name)
                .font(.system(size: 18, weight: .semibold))
            HStack(spacing: 8) {
                ToolPill(title: "Select", active: store.tool == .select) {
                    store.tool = .select
                }
                ToolPill(title: "Hand", active: store.tool == .hand || store.isSpacePressed) {
                    store.tool = .hand
                }
            }
            HStack(spacing: 8) {
                Button("Rectangle") { store.insertElement(kind: .rectangle) }
                Button("Ellipse") { store.insertElement(kind: .ellipse) }
                Button("Line") { store.insertElement(kind: .line) }
                Button("Text") { store.insertElement(kind: .text) }
            }
            .buttonStyle(.bordered)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct ToolPill: View {
    let title: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .buttonStyle(.plain)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(active ? Color.accentColor.opacity(0.18) : Color.primary.opacity(0.06), in: Capsule())
    }
}

private struct CanvasGridView: View {
    let scale: CGFloat
    let offset: CGSize
    let gridSize: Double

    var body: some View {
        Canvas { context, size in
            let spacing = CGFloat(gridSize) * scale
            guard spacing >= 6 else { return }

            let startX = offset.width.truncatingRemainder(dividingBy: spacing)
            let startY = offset.height.truncatingRemainder(dividingBy: spacing)
            let path = Path { path in
                var x = startX
                while x < size.width {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                    x += spacing
                }

                var y = startY
                while y < size.height {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    y += spacing
                }
            }
            context.stroke(path, with: .color(Color.primary.opacity(0.06)), lineWidth: 1)
        }
    }
}

private struct EditableCanvasElementView: View {
    @ObservedObject var store: ProjectStore
    let element: Element
    @State private var dragDelta: CGSize = .zero
    @State private var resizeOrigin: RectData?
    @State private var lineOrigin: LineData?

    private var isSelected: Bool {
        store.selection.contains(element.id)
    }

    var body: some View {
        Group {
            switch element.kind {
            case .line:
                lineBody
            case .rectangle, .ellipse, .text:
                nodeBody
            }
        }
        .allowsHitTesting(store.tool != .hand && !store.isSpacePressed)
        .onTapGesture {
            store.select(element.id, additive: NSEvent.modifierFlags.contains(.command))
        }
        .gesture(moveGesture)
    }

    private var nodeBody: some View {
        ZStack(alignment: .topLeading) {
            shapeBody
            if store.project.displaySemanticLabels && element.semanticLabelVisible {
                Text(element.semanticName)
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.78), in: Capsule())
                    .foregroundStyle(.white)
                    .offset(x: 8, y: -22)
            }
            if isSelected {
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2, dash: [5, 3]))
                resizeHandle
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
                .overlay(textOverlay)
        case .ellipse:
            Ellipse()
                .fill(element.style.fill.swiftUIColor.opacity(element.style.opacity))
                .overlay(
                    Ellipse()
                        .stroke(element.style.stroke.swiftUIColor, lineWidth: element.style.strokeWidth)
                )
                .overlay(textOverlay.padding(8))
        case .text:
            Rectangle()
                .fill(Color.clear)
                .overlay(textOverlay.frame(maxWidth: .infinity, maxHeight: .infinity))
        case .line:
            EmptyView()
        }
    }

    private var textOverlay: some View {
        Text(element.text)
            .font(.system(size: element.style.fontSize, weight: element.style.fontWeight.swiftUIFontWeight))
            .foregroundStyle(element.style.textColor.swiftUIColor)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: element.textAlignment.swiftUIAlignment)
            .multilineTextAlignment(element.textAlignment.swiftUITextAlignment)
            .padding(10)
    }

    private var lineBody: some View {
        let geometry = lineGeometry

        return ZStack(alignment: .topLeading) {
            Path { path in
                path.move(to: geometry.localStart)
                path.addLine(to: geometry.localEnd)
            }
            .stroke(element.style.stroke.swiftUIColor, lineWidth: max(2, element.style.strokeWidth))

            if element.style.arrowHead {
                ArrowHeadShape(start: geometry.localStart, end: geometry.localEnd)
                    .fill(element.style.stroke.swiftUIColor)
            }

            if isSelected {
                Rectangle()
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 2, dash: [5, 3]))
                lineHandle(point: .start, position: geometry.localStart)
                lineHandle(point: .end, position: geometry.localEnd)
            }
        }
        .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
        .position(x: geometry.origin.x + geometry.size.width / 2, y: geometry.origin.y + geometry.size.height / 2)
    }

    private var resizeHandle: some View {
        Circle()
            .fill(Color.accentColor)
            .frame(width: 12, height: 12)
            .overlay(Circle().stroke(.white, lineWidth: 1))
            .position(x: element.frame.width, y: element.frame.height)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if resizeOrigin == nil {
                            resizeOrigin = element.frame
                        }
                        guard let origin = resizeOrigin else { return }
                        let width = max(40, origin.width + value.translation.width / store.canvasScale)
                        let height = max(24, origin.height + value.translation.height / store.canvasScale)
                        store.resizeElement(
                            element.id,
                            frame: RectData(x: origin.x, y: origin.y, width: width, height: height)
                        )
                    }
                    .onEnded { _ in
                        resizeOrigin = nil
                    }
            )
    }

    private enum LineHandlePoint {
        case start
        case end
    }

    private func lineHandle(point: LineHandlePoint, position: CGPoint) -> some View {
        Circle()
            .fill(Color.accentColor)
            .frame(width: 12, height: 12)
            .overlay(Circle().stroke(.white, lineWidth: 1))
            .position(position)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if lineOrigin == nil {
                            lineOrigin = element.line
                        }
                        guard let origin = lineOrigin else { return }
                        let translated = PointData(
                            x: (point == .start ? origin.start.x : origin.end.x) + value.translation.width / store.canvasScale,
                            y: (point == .start ? origin.start.y : origin.end.y) + value.translation.height / store.canvasScale
                        )
                        if point == .start {
                            store.resizeLine(element.id, start: translated)
                        } else {
                            store.resizeLine(element.id, end: translated)
                        }
                    }
                    .onEnded { _ in
                        lineOrigin = nil
                    }
            )
    }

    private var moveGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard !store.isSpacePressed, store.tool != .hand else { return }
                let next = CGSize(
                    width: (value.translation.width / store.canvasScale) - dragDelta.width,
                    height: (value.translation.height / store.canvasScale) - dragDelta.height
                )
                if !isSelected {
                    store.select(element.id, additive: NSEvent.modifierFlags.contains(.command))
                }
                store.updateSelectionFrame(delta: next)
                dragDelta.width += next.width
                dragDelta.height += next.height
            }
            .onEnded { _ in
                guard !store.isSpacePressed, store.tool != .hand else { return }
                dragDelta = .zero
                store.finishMove()
            }
    }

    private var lineGeometry: (origin: CGPoint, size: CGSize, localStart: CGPoint, localEnd: CGPoint) {
        let line = element.line ?? .init(start: .init(x: element.frame.x, y: element.frame.y), end: .init(x: element.frame.x + 120, y: element.frame.y + 60))
        let minX = min(line.start.x, line.end.x) - 12
        let minY = min(line.start.y, line.end.y) - 12
        let maxX = max(line.start.x, line.end.x) + 12
        let maxY = max(line.start.y, line.end.y) + 12
        return (
            origin: CGPoint(x: minX, y: minY),
            size: CGSize(width: maxX - minX, height: maxY - minY),
            localStart: CGPoint(x: line.start.x - minX, y: line.start.y - minY),
            localEnd: CGPoint(x: line.end.x - minX, y: line.end.y - minY)
        )
    }
}

private struct SmartGuideOverlay: View {
    let guide: SmartGuide
    let size: CGSize

    var body: some View {
        Path { path in
            switch guide.orientation {
            case .vertical:
                path.move(to: CGPoint(x: guide.position, y: 0))
                path.addLine(to: CGPoint(x: guide.position, y: size.height))
            case .horizontal:
                path.move(to: CGPoint(x: 0, y: guide.position))
                path.addLine(to: CGPoint(x: size.width, y: guide.position))
            }
        }
        .stroke(Color.accentColor.opacity(0.5), lineWidth: 1)
    }
}

private struct ArrowHeadShape: Shape {
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
