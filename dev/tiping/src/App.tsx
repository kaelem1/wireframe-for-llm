/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { useEffect } from "react";
import { EditorPage } from "./components/EditorPage";
import { HomePage } from "./components/HomePage";
import { useAppStore } from "./store";

export default function App() {
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const loadPersisted = useAppStore((state) => state.loadPersisted);
  const saveNow = useAppStore((state) => state.saveNow);

  useEffect(() => {
    loadPersisted();
  }, [loadPersisted]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      saveNow();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [saveNow]);

  return activeProjectId ? <EditorPage /> : <HomePage />;
}
