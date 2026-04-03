/*
[PROTOCOL]:
1. 逻辑变更后更新此 Header
2. 更新后检查所属 `.folder.md`
*/

import SwiftUI

struct ScreenSidebarView: View {
    @ObservedObject var store: ProjectStore
    @State private var renameTarget: UUID?

    var body: some View {
        VStack(spacing: 0) {
            header
            List {
                ForEach(store.screens) { screen in
                    ScreenRow(
                        store: store,
                        screen: screen,
                        isCurrent: screen.id == store.project.currentScreenID,
                        isEditing: renameTarget == screen.id,
                        beginEditing: { renameTarget = screen.id },
                        endEditing: { renameTarget = nil }
                    )
                    .listRowInsets(.init(top: 6, leading: 8, bottom: 6, trailing: 8))
                    .tag(screen.id)
                }
                .onMove(perform: store.moveScreen)
            }
            .listStyle(.sidebar)

            footer
        }
        .frame(minWidth: 260)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Screens")
                .font(.system(size: 20, weight: .semibold))
            Text("Manage pages, order, and current focus.")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
    }

    private var footer: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Button("Add") { store.addScreen() }
                Button("Duplicate") { store.duplicateCurrentScreen() }
                Button("Delete") { store.deleteCurrentScreen() }
            }
            .buttonStyle(.bordered)
        }
        .padding(16)
    }
}

private struct ScreenRow: View {
    @ObservedObject var store: ProjectStore
    let screen: Screen
    let isCurrent: Bool
    let isEditing: Bool
    let beginEditing: () -> Void
    let endEditing: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                thumbnail
                VStack(alignment: .leading, spacing: 6) {
                    if isEditing {
                        TextField(
                            "Screen Name",
                            text: Binding(
                                get: { screen.name },
                                set: { store.updateScreenName(screen.id, name: $0) }
                            ),
                            onCommit: endEditing
                        )
                        .textFieldStyle(.roundedBorder)
                    } else {
                        Text(screen.name)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                    }
                    Text("\(screen.elements.count) elements")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }

            HStack(spacing: 8) {
                Button("Open") { store.setCurrentScreen(screen.id) }
                Button("Rename", action: beginEditing)
            }
            .buttonStyle(.borderless)
            .font(.system(size: 11, weight: .medium))
        }
        .padding(10)
        .background(isCurrent ? Color.accentColor.opacity(0.16) : Color.primary.opacity(0.03), in: RoundedRectangle(cornerRadius: 14))
        .contentShape(RoundedRectangle(cornerRadius: 14))
        .onTapGesture {
            store.setCurrentScreen(screen.id)
        }
        .contextMenu {
            Button("Open") { store.setCurrentScreen(screen.id) }
            Button("Rename", action: beginEditing)
            Button("Duplicate") {
                store.setCurrentScreen(screen.id)
                store.duplicateCurrentScreen()
            }
            Button("Delete") {
                store.setCurrentScreen(screen.id)
                store.deleteCurrentScreen()
            }
        }
    }

    private var thumbnail: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color(nsColor: .textBackgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            .overlay(alignment: .topLeading) {
                ZStack(alignment: .topLeading) {
                    ForEach(Array(screen.elements.prefix(4).enumerated()), id: \.offset) { index, element in
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.primary.opacity(0.28), lineWidth: 1)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.primary.opacity(0.04))
                            )
                            .frame(width: 22 + CGFloat(index * 4), height: 10 + CGFloat(index * 4))
                            .offset(x: 8 + CGFloat(index * 6), y: 8 + CGFloat(index * 8))
                    }
                }
            }
            .frame(width: 84, height: 58)
    }
}
