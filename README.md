# PicoClaw Token Proxy

## 版本

- Token Proxy: v0.2.8.0
- Chrome Extension: v1.0.95

## 架構

```
Chrome Extension
       |
       v (18801)     Token Proxy
       |
       v (18800)     PicoClaw Server
       |
       v (18790)     WebSocket
```

## Token Proxy

### 運行

```bash
./picoclaw-token-proxy -host 192.168.123.200 -target 18800 -port 18801
```

### 參數

| 參數 | 默認值 | 說明 |
|-------|--------|------|
| -host | 127.0.0.1 | 目標服務器地址 |
| -target | 18800 | 目標端口 |
| -port | 18801 | 監聽端口 |
| -debug | false | 調試日誌 |

### 日誌

- 默認只輸出啟動信息
- 使用 `-debug` 開啟詳細日誌

### API 代理

- `/api/login` - 登入認證
- `/api/auth/status` - 認證狀態
- `/api/models` - 模型列表
- `/api/sessions` - 對話列表
- `/pico/ws` - WebSocket

## Chrome Extension

### 安裝

1. Chrome → 擴展程序 → 載入已解壓
2. 選擇 `picoclaw-chrome-extension`

### 配置

- Server: `<你的服務器IP>`
- Port: `18800`
- Password: `<你的密碼>`

## 文件

- Token Proxy: `picoclaw-token-proxy/picoclaw-token-proxy`
- Chrome Extension: `picoclaw-token-proxy/picoclaw-chrome-extension`

## 更新

### v0.2.8.0
- 移除未使用代碼
- 簡化日誌輸出，預設靜默
- 移除冗餘 API
- 使用 http.DefaultClient