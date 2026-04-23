# PicoClaw Token Proxy

## 版本

v0.2.8.0

## 概述

代理服務，用於 PicoClaw v0.2.7+ 的認證。

v0.2.7 使用 HTTPOnly Cookie 認證，本服務代理認證請求。

## 參數

| 參數 | 默認值 | 說明 |
|-------|--------|------|
| -host | 127.0.0.1 | 目標服務器地址 |
| -target | 18800 | 目標端口 |
| -port | 18801 | 監聽端口 |
| -debug | false | 調試日誌 |

## 運行

```bash
./picoclaw-token-proxy -host 192.168.1.100 -target 18800
```

## API 代理

- `/api/login` - 登入，回傳 auth_cookie
- `/api/auth/status` - 認證狀態
- `/api/models` - 模型列表
- `/api/sessions` - 對話列表
- `/pico/ws` - WebSocket 代理

## 日誌

- 默認只輸出啟動信息
- 使用 `-debug` 開啟詳細日誌
