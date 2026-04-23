# PicoClaw Chrome Extension

Chrome 擴展程序 - 與本地網路上的 PicoClaw AI 助手通信。

## 功能

- 實時聊天（WebSocket）
- 認證（Cookie 機制）
- 多語言界面（中文/English）
- 模型切換
- 對話管理
- Markdown 渲染
- 自動重連
- 圖片上傳（最大 20MB）

## 安裝

1. 解壓 `backups/latest.zip`
2. Chrome → `chrome://extensions`
3. 開啟「開發者模式」
4. 「載入已解壓的擴展程序」
5. 選擇資料夾

## 架構（v0.2.7）

```
Chrome Extension → 18801 (Token Proxy) → 18800 (PicoClaw)
                    ↓                         ↓
               WebSocket   ←              18790
```

v0.2.7 使用 HTTPOnly Cookie 認證，無需 Token。

## 配置

- Server: `<你的服務器IP>`
- WS Port: `18800` (WebSocket)
- Token Proxy Port: `18801` (認證代理)
- Password: `<你的密碼>`

## 運行 Token Proxy

```bash
./picoclaw-token-proxy -host <你的服務器IP> -target 18800 -port 18801
```

## 版本

詳見 VERSION.md

當前版本: v1.0.95
