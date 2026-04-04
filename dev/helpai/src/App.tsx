/*
[PROTOCOL]:

1. 逻辑变更后更新此 Header

2. 更新后检查所属 `.folder.md`
*/

import { EditorPage } from './features/editor/EditorPage'
import { ProjectListPage } from './features/projects/ProjectListPage'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const currentProjectId = useAppStore((state) => state.currentProjectId)

  if (currentProjectId) {
    return <EditorPage />
  }

  return <ProjectListPage />
}
