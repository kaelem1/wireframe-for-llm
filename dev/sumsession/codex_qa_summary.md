## 依赖冲突
| 问题 | 解法 |
|---|---|
| pip 安装失败 | 使用 pip install --upgrade pip 后重试 |
| price和financials数据缺失 | 先用主源，不足时回退到Eastmoney |
| src/lib/project-export.ts 当前导出与 src/store/project-store.ts 的导入尚未对齐 | 对齐导入导出 |
| src/lib/project-export.ts 未使用参数 project | 修正未使用的参数并重新构建 |
| src/lib/project-files.ts 缺少 parseProjectBackup、serializeProjectBackup 导出 | 添加缺失的导出并重新构建 |
| src/store/project-store.ts 引用未提供的函数 | 提供引用的函数并重新构建 |
| store 还未进入可通过编译的稳定状态 | 修复 store 代码 |
| tiktoken 没装 | 补上依赖后再重跑同一个真实文件 |
| 主工作区只出现了默认模板，连 `package.json` 和业务依赖都不完整。 | 交付可启动、可构建、可测试的最小业务骨架。 |
| 代理配置未生效 | 确认代理配置正确并重启网关 |
| 依赖未导出成员 | 处理store/lib收口问题 |
| 单次 map 调用 token 数过高 | 缩短 prompt 和输出上限 |
| 并发与节流策略不当 | 调整并发数和节流策略 |
| 本地插件未注册 | 在 /Users/kaelem/.openclaw/workspace/.openclaw/extensions 添加插件并注册 |
| 构建失败 | 删除未引用且破坏构建的文件 |
| 缺少 `parseProjectBackup`、`serializeProjectBackup` 导出 | 添加缺少的导出 |
| 缺少filing-level insight | 将filing-level insight正式纳入ResearchPacket，确保后续章节能利用SBC |
| 网络/TLS/DNS失败 | 降级成source_quality_notes |
| 财务/价格/SEC数据缺失 | 回退到大陆信源 |
| 配置文件热更新未生效 | 检查配置文件加载逻辑 |
| 配置文件需要重启后生效 | 打开诊断开关并重启网关 |
| 重复跑批进程 | 清理残留进程，收敛为单 worker |
| 页面层当前与 store 的类型也存在不一致 | 统一页面层与 store 类型 |

## API 调用
| 问题 | 解法 |
|---|---|
| API 调用失败时重试一次 | 重试一次 API 调用 |
| API 调用的超时设置 | 设置合理的超时时间 |
| API 调用的错误日志记录 | 记录详细的错误日志 |
| API 返回错误码如何处理 | 根据错误码进行相应的错误处理 |
| JSON 解析失败时额外发一次 LLM 修复请求 | 本地 JSON 提取和一次本地修整，解析不了就记错并跳过 |
| 如何优化 API 调用的性能 | 优化请求参数和网络配置 |
| 如何处理 API 调用的并发问题 | 使用线程池或异步处理 |
| 请求超时时如何处理 | 设置超时重试机制 |

## 权限与认证
| 问题 | 解法 |
|---|---|
| 429 限流 | 收敛为单worker、按限流预算重跑全量 |
| API key 保留了兼容回退 | 把 key 来源收紧到用户要求的 OPENAI_API_KEY |
| git push失败，原因是当前仓库没有配置远端仓库。 | 配置远端仓库。 |
| 仓库创建命令返回repo URL但推送到失败 | 确认仓库创建是否成功 |
| 仓库创建失败 | 检查仓库是否创建成功 |
| 单worker固定速率 | 按保守速率发送 |
| 并发导致的 TPM 限流 | 加一次自动退避重试，然后把实际全量执行降到单 worker |
| 当前环境只有 SILICONFLOW_API_KEY | 命令层把 `SILICONFLOW_API_KEY` 映射为 `OPENAI_API_KEY` |

## 路径与文件
| 问题 | 解法 |
|---|---|
| README.md 功能清单未更新 | 更新 README.md 的功能清单 |
| Sources/FuckDesign/FuckDesignApp.swift 引用了不存在的 WorkspaceRootView | 补 Sources/FuckDesign/WorkspaceRootView.swift 并复核 Package.swift |
| Sources/FuckDesign/FuckDesignApp.swift 直接引用了 WorkspaceRootView，但当前 Sources/FuckDesign 下没有这个文件 | 补 WorkspaceRootView 缺口 |
| eval.log 无 SIC_SCORE/MEAN 行 | 补齐 evaluate.py 并确保文件存在 |
| modal 组件未隐藏 | 隐藏弹窗组件 |
| raw.txt 文件为空或仅有占位文本 | 补齐7家公司的真实raw.txt原始资料文本 |
| skills路径超出配置根目录 | 检查skills目录配置 |
| 仓库当前为空目录 | 补齐 AGENTS 规则要求的最小文档骨架 |
| 入口层与实际文件布局不一致 | 收敛到现有扁平结构 |
| 导入按钮未删除 | 删除 `Toolbar` 的导入按钮 |
| 文本标签没有实现内联编辑 | 在 wireframe-node.tsx 和 editor-page.tsx 中实现内联编辑 |
| 未完成项：未同步 .folder.md 和 .ai/current.md | 同步 .folder.md 和 .ai/current.md |
| 未实现 Canvas / Inspector / Preview / Services | 实现相关文件 |
| 现有modal链路定位不清 | 查组件注册、交互配置和预览展示链路 |
| 画布边界约束未定位 | 定位边界约束、导出链路、empty state文案位置、preview lock样式位置 |
| 脚本被命令包装层污染 | 换成更短的 Node one-liner，避免 here-doc |
| 预览模式被裁切 | 确认并修复 `board-strip__menu-popover` 的绝对定位问题 |

## 数据处理
| 问题 | 解法 |
|---|---|
| BoardCanvas.tsx:113-127 transform is possibly null | 显式处理 transform 可能为 null 的情况 |
| JSON 解析存在 JSONDecodeError / unterminated string | 只做严格 JSON + 最外层截取 + 失败后二次修复重试 |
| JSONDecodeError | 改为严格JSON+修复重试 |
| SKILL.md未补全 | 补全SKILL.md内容 |
| adversarial.py 未返回完整信息 | 增加身份分离、回合状态等信息 |
| draft 缺少元数据 | 新增 DraftArtifact 数据结构 |
| source_quality_notes未记录provider选择 | 更新notes记录最终采用的provider及失败链路 |
| summary synthesis prompt结构松散 | 收紧prompt结构 |
| summary 结果未写入报告 | 新增 collect_drafts 和 render_report 函数 |
| 代码未完成真实数据处理 | 直接进入真实数据处理 |
| 图层副标题去掉 | 删除图层副标题 |
| 少数响应不是合法 JSON | 加一层自动重试和 JSON fence 清理 |
| 待放置组件时无提示。 | 补底部居中toast提示。 |
| 文字编辑是双击后用 prompt 修改，不是真正的画布内嵌 textarea | 将文字编辑嵌入画布 |
| 未完成真实数据处理 | 实现数据处理闭环 |
| 模型返回 JSON 解析失败 | 优化 JSON 解析策略 |
| 模型返回的 JSON 不是纯净单对象 | 修改 JSON 解析以处理模型返回的包裹文本 |
| 测试通过，但未完成真实多来源高强度研究 | 进入真实数据处理闭环 |
| 缺乏成功率监控 | 增加成功率/失败原因日志 |

## 其他
| 问题 | 解法 |
|---|---|
| git push失败，原因是当前仓库没有配置远端仓库。 | 配置远端仓库并推送代码。 |
| 存在重复的 codex_qa_summary.py 进程 | 逐个 PID 处理，避免旧 worker 继续往 errors.log 追加内容 |
| 待放置时组件交互未短路 | 改代码短路待放置时的组件交互 |
| 模型返回的 JSON 不是纯净单对象 | 修改解析逻辑以处理模型返回的包裹文本 |
| 缩短prompt和输出上限 | 无 |
