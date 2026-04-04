/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    static let aiPrototype = UTType(exportedAs: "dev.kaelem.aipro")
}

struct PrototypeDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.aiPrototype]

    var project: PrototypeProject

    init(project: PrototypeProject = .sample) {
        self.project = project
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        project = try JSONDecoder.projectDecoder.decode(PrototypeProject.self, from: data)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let data = try JSONEncoder.projectEncoder.encode(project)
        return .init(regularFileWithContents: data)
    }
}
