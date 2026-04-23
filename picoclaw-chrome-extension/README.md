# PicoClaw Chrome Extension

PicoClaw Chrome 扩充功能 - 用于在浏览器中与本地网络上的 PicoClaw AI 助手通信。

## 功能特點

- 通过 WebSocket 与 PicoClaw 服务器实时聊天
- 自动获取和刷新认证 Token
- 支持多语言界面（中文/English）
- 模型切换功能
- 对话历史管理
- Markdown 消息渲染
- 等待指示器（服务器响应超时 3 分钟）
- 自动重连（服务器重启后）

## 系统要求

- Chrome 浏览器或其他 Chromium 内核浏览器
- 已安装并运行 PicoClaw 服务器
- 需要运行 `picoclaw-token-proxy` 服务（用于获取 pidToken）

## 安装方法

### 方法 1：从备份安装

1. 解压 `backups/latest.zip`
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择解压后的文件夹

### 方法 2：直接从源码安装

```bash
cd picoclaw-chrome-extension
zip -r picoclaw-extension.zip background.js popup.js popup.html manifest.json styles.css i18n.js marked.min.js VERSION.md
```

## 端口配置说明

插件需要配置 3 个端口：

| 端口 | 默认值 | 说明 |
|------|-------|------|
| WS 端口 | 18790 | WebSocket 聊天端口 |
| API 端口 | 18800 | HTTP API 端口 |
| Token 端口 | 18801 | Token 代理端口 |

## 使用说明

### 首次配置

1. 点击浏览器工具列的插件图标
2. 填写服务器地址（如 192.168.1.100）
3. 填写 Dashboard Token
4. 点击「保存设置」

### 基本使用

- 发送消息：在输入框输入文字，按 Enter 或点击「发送」
- 切换语言：点击「EN」/「中文」按钮
- 切换模型：点击🤖按钮
- 管理对话：点击💬按钮

## 故障排除

### 连接失败
1. 检查服务器是否运行：`ping <服务器IP>`
2. 检查端口是否开放
3. 确认 Dashboard Token 正确

### Token 获取失败
1. 确认 token proxy 服务运行在 18801 端口
2. 检查服务日志

## 版本历史

详见 VERSION.md

## 许可协议

MIT License
