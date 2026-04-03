/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import AppKit
import Foundation

struct ScreenshotExportService {
    func exportPNGs(for project: PrototypeProject, to directoryURL: URL) throws -> [URL] {
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true, attributes: nil)
        return try project.screens.map { screen in
            let image = renderImage(for: screen, displaySemanticLabels: project.displaySemanticLabels)
            let fileURL = directoryURL.appending(path: sanitizedFilename(for: screen.name)).appendingPathExtension("png")
            guard
                let tiffData = image.tiffRepresentation,
                let bitmap = NSBitmapImageRep(data: tiffData),
                let pngData = bitmap.representation(using: .png, properties: [:])
            else {
                throw CocoaError(.fileWriteUnknown)
            }
            try pngData.write(to: fileURL)
            return fileURL
        }
    }

    func renderImage(for screen: Screen, displaySemanticLabels: Bool) -> NSImage {
        let canvas = canvasRect(for: screen)
        let image = NSImage(size: canvas.size)
        image.lockFocus()

        NSColor.white.setFill()
        NSBezierPath(rect: canvas).fill()

        for element in screen.elements.sorted(by: { $0.frame.y < $1.frame.y }) {
            draw(element: element, offsetX: -canvas.minX + 32, offsetY: -canvas.minY + 32, displaySemanticLabels: displaySemanticLabels)
        }

        image.unlockFocus()
        return image
    }

    private func canvasRect(for screen: Screen) -> NSRect {
        let bounds = screen.elements.reduce(into: CGRect(x: 0, y: 0, width: 800, height: 600)) { partial, element in
            if element.kind == .line, let line = element.line {
                partial = partial.union(
                    CGRect(
                        x: min(line.start.x, line.end.x),
                        y: min(line.start.y, line.end.y),
                        width: abs(line.end.x - line.start.x),
                        height: abs(line.end.y - line.start.y)
                    )
                )
            } else {
                partial = partial.union(
                    CGRect(
                        x: element.frame.x,
                        y: element.frame.y,
                        width: element.frame.width,
                        height: element.frame.height
                    )
                )
            }
        }

        return NSRect(
            x: bounds.minX - 32,
            y: bounds.minY - 32,
            width: max(bounds.width + 64, 800),
            height: max(bounds.height + 64, 600)
        )
    }

    private func draw(element: Element, offsetX: CGFloat, offsetY: CGFloat, displaySemanticLabels: Bool) {
        switch element.kind {
        case .rectangle:
            let rect = element.frame.nsRect(offsetX: offsetX, offsetY: offsetY)
            let path = NSBezierPath(roundedRect: rect, xRadius: element.style.cornerRadius, yRadius: element.style.cornerRadius)
            draw(path: path, style: element.style)
            drawCenteredText(element.text, in: rect, style: element.style)
            if displaySemanticLabels && element.semanticLabelVisible {
                drawLabel(element.semanticName, at: NSPoint(x: rect.minX, y: rect.maxY + 6))
            }
        case .ellipse:
            let rect = element.frame.nsRect(offsetX: offsetX, offsetY: offsetY)
            let path = NSBezierPath(ovalIn: rect)
            draw(path: path, style: element.style)
            drawCenteredText(element.text, in: rect, style: element.style)
            if displaySemanticLabels && element.semanticLabelVisible {
                drawLabel(element.semanticName, at: NSPoint(x: rect.minX, y: rect.maxY + 6))
            }
        case .line:
            guard let line = element.line else { return }
            let start = line.start.nsPoint(offsetX: offsetX, offsetY: offsetY)
            let end = line.end.nsPoint(offsetX: offsetX, offsetY: offsetY)
            let path = NSBezierPath()
            path.move(to: start)
            path.line(to: end)
            path.lineWidth = element.style.strokeWidth
            element.style.stroke.nsColor.setStroke()
            path.stroke()
            if element.style.arrowHead {
                drawArrowHead(from: start, to: end, color: element.style.stroke.nsColor)
            }
        case .text:
            let rect = element.frame.nsRect(offsetX: offsetX, offsetY: offsetY)
            let attributes: [NSAttributedString.Key: Any] = [
                .foregroundColor: element.style.textColor.nsColor,
                .font: NSFont.systemFont(ofSize: element.style.fontSize, weight: element.style.fontWeight.nsFontWeight)
            ]
            NSString(string: element.text).draw(in: rect, withAttributes: attributes)
            if displaySemanticLabels && element.semanticLabelVisible {
                drawLabel(element.semanticName, at: NSPoint(x: rect.minX, y: rect.maxY + 6))
            }
        }
    }

    private func draw(path: NSBezierPath, style: ElementStyle) {
        style.fill.nsColor.withAlphaComponent(style.opacity).setFill()
        path.fill()
        style.stroke.nsColor.setStroke()
        path.lineWidth = style.strokeWidth
        path.stroke()
    }

    private func drawCenteredText(_ text: String, in rect: NSRect, style: ElementStyle) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: style.textColor.nsColor,
            .font: NSFont.systemFont(ofSize: style.fontSize, weight: style.fontWeight.nsFontWeight),
            .paragraphStyle: paragraph
        ]
        NSString(string: text).draw(
            in: rect.insetBy(dx: 8, dy: max((rect.height - style.fontSize - 6) / 2, 4)),
            withAttributes: attributes
        )
    }

    private func drawLabel(_ text: String, at point: NSPoint) {
        let font = NSFont.systemFont(ofSize: 11, weight: .medium)
        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.white,
            .font: font
        ]
        let size = NSString(string: text).size(withAttributes: attributes)
        let badgeRect = NSRect(x: point.x, y: point.y, width: size.width + 12, height: size.height + 6)
        let badge = NSBezierPath(roundedRect: badgeRect, xRadius: 8, yRadius: 8)
        NSColor(calibratedRed: 0.16, green: 0.24, blue: 0.36, alpha: 0.92).setFill()
        badge.fill()
        NSString(string: text).draw(at: NSPoint(x: badgeRect.minX + 6, y: badgeRect.minY + 3), withAttributes: attributes)
    }

    private func sanitizedFilename(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Screen" : trimmed.replacingOccurrences(of: "/", with: "-")
    }

    func arrowHeadPoints(from start: CGPoint, to end: CGPoint, length: CGFloat = 14) -> [CGPoint] {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let distance = max(sqrt(dx * dx + dy * dy), 0.001)
        let ux = dx / distance
        let uy = dy / distance
        let base = CGPoint(x: end.x - ux * length, y: end.y - uy * length)
        let wing = length * 0.55
        let left = CGPoint(x: base.x - uy * wing, y: base.y + ux * wing)
        let right = CGPoint(x: base.x + uy * wing, y: base.y - ux * wing)
        return [end, left, right]
    }

    private func drawArrowHead(from start: CGPoint, to end: CGPoint, color: NSColor) {
        let points = arrowHeadPoints(from: start, to: end)
        guard points.count == 3 else { return }
        let path = NSBezierPath()
        path.move(to: points[0])
        path.line(to: points[1])
        path.line(to: points[2])
        path.close()
        color.setFill()
        path.fill()
    }
}

private extension RectData {
    func nsRect(offsetX: CGFloat, offsetY: CGFloat) -> NSRect {
        NSRect(x: x + offsetX, y: y + offsetY, width: width, height: height)
    }
}

private extension PointData {
    func nsPoint(offsetX: CGFloat, offsetY: CGFloat) -> NSPoint {
        NSPoint(x: x + offsetX, y: y + offsetY)
    }
}

private extension ColorValue {
    var nsColor: NSColor {
        NSColor(
            calibratedRed: red,
            green: green,
            blue: blue,
            alpha: alpha
        )
    }
}

private extension FontWeightOption {
    var nsFontWeight: NSFont.Weight {
        switch self {
        case .regular:
            return .regular
        case .medium:
            return .medium
        case .semibold:
            return .semibold
        case .bold:
            return .bold
        }
    }
}
