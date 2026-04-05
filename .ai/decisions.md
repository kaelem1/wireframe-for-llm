项目以导出 JSON 为唯一原型真源；编辑态与预览态共用同一组件渲染语义，AI 生成只补布局，不自动补交互。
导出 JSON 在兼容既有顶层字段前提下追加 instruction 与最小 layout 语义；运行态与导入仍以原始 project 结构为准。
wireframe mode 独立持久化 purpose、opacity 与模式快照；与主 workspace 分仓恢复，切换时优先恢复各自编辑上下文。
