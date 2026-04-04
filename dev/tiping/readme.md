# 低保真原型设计工具

使用 `React + TypeScript + Konva.js + Zustand + TailwindCSS + Vite` 构建的纯前端线框原型工具。

## 安装与启动

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 使用方式

1. 首页创建项目，先选择设备尺寸或输入自定义尺寸。
2. 进入编辑器后，从左侧工具箱拖拽图形到任意画板，或用快捷键切换工具后点击画板放置元素。
3. 在右侧属性面板编辑名称、位置、尺寸、外观和交互。
4. 顶部工具栏可执行 AI 生成、预览、导出供 AI 使用、AI 对齐测试与 API 设置。

## SiliconFlow 设置

- Base URL：`https://api.siliconflow.cn/v1`
- 接口：`POST /chat/completions`
- 默认模型：`zai-org/GLM-4.6`
- 在编辑器右上角“设置”中填写 `API Key / Base URL / 模型`

## 主要功能

- 项目列表、创建/复制/删除/导入/导出
- 固定尺寸多画板编辑器
- 基础图形拖拽放置、属性编辑、交互配置
- 预览模式、AI 生成、AI 对齐测试、AI 导出
- localStorage 持久化与撤销/重做

## 快捷键

- `V` 选择
- `R` 矩形
- `O` 圆形 / 椭圆
- `L` 线段
- `T` 文字
- `P` 预览
- `Delete` / `Backspace` 删除
- `Cmd/Ctrl + D` 复制
- `Cmd/Ctrl + Z` 撤销
- `Cmd/Ctrl + Shift + Z` 重做
- `Cmd/Ctrl + S` 强制保存
- `Cmd/Ctrl + E` 打开 AI 导出
