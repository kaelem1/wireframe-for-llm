/*
[PROTOCOL]:
1. Update this header after logic changes.
2. Check sibling .folder.md after updates.
*/
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        canvas: "#f5f5f5",
        ink: "#111827",
        line: "#d4d4d8",
        accent: "#2563eb"
      },
      boxShadow: {
        panel: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

