/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()]
});

