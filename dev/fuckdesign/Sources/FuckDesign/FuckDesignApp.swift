/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import SwiftUI

@main
struct FuckDesignApp: App {
    var body: some Scene {
        DocumentGroup(newDocument: PrototypeDocument()) { file in
            WorkspaceRootView(document: file.$document)
        }
        .commands {
            WorkspaceCommands()
        }
    }
}
