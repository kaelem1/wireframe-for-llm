# HelpAI

基于 Web 的低保真原型设计工具，技术栈为 React、TypeScript、Konva.js、Zustand、Vite、TailwindCSS。

当前实现为纯客户端 SPA，默认使用浏览器 `localStorage` 持久化项目，并通过 SiliconFlow 的 OpenAI 兼容接口完成 AI 生成与 AI 对齐测试。

## 已实现能力

- 项目列表首页：创建、打开、复制、删除、导入、导出项目
- 设备尺寸选择：移动端 / 平板端 / 桌面端 / 自定义
- 多画板工作区：固定尺寸画板水平排列，标题可编辑
- Konva 编辑：矩形、圆形、椭圆、线段、文字、图片占位符
- 元素操作：拖拽、缩放、复制、删除、层级调整、语义命名、名称标签显隐
- 交互配置：跳转页面、返回上一页、切换状态、显示 / 隐藏
- 预览模式：全屏预览、左右切换动画、Escape 退出
- AI 工具：AI 生成画板、导出供 AI 使用、AI 对齐测试
- 历史记录：撤销 / 重做
- 测试：导出结构、预览交互、对齐评分、store 历史

## 启动

```bash
npm install
npm run dev
```

## 其他命令

```bash
npm test
npm run lint
npm run build
```

## LLM 配置

编辑器右上角“设置”中可配置：

- `Base URL`：默认 `https://api.siliconflow.cn/v1`
- `API Key`：填写 SiliconFlow Key
- `模型`：默认 `zai-org/GLM-4.6`
- `Temperature` / `Max Tokens`

## 快捷键

- `V` 选择工具
- `R` 矩形
- `O` 圆形 / 椭圆
- `L` 线段
- `T` 文字
- `P` 预览
- `Delete` 删除
- `Cmd/Ctrl + D` 复制
- `Cmd/Ctrl + Z` 撤销
- `Cmd/Ctrl + Shift + Z` 重做
- `Cmd/Ctrl + S` 保存
- `Cmd/Ctrl + E` 导出
