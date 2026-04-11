# PicoClaw Token 驗證服務

## 概述

本服務用於解決 PicoClaw Chrome 擴充功能與 PicoClaw Docker 容器之間的通信問題。

## 問題說明

PicoClaw v0.2.5+ 版本 WebSocket 認證機制變更：
- 之前：只需 `picoToken`
- 現在：需要 `picoToken` + `pidToken`

插件無法直接讀取 Docker 容器內的 `.picoclaw.pid` 文件。

## 解決方案

本服務提供單一接口（端口 18801）：
1. 接收插件傳來的 `picoToken`
2. 與配置中的 picoToken 比對
3. 從 `.picoclaw.pid` 讀取 `pidToken`
4. 回傳給插件

## 檔案位置（依 picoclaw-0.2.6 原始碼）

| Token 類型 | 檔案位置 | 欄位 |
|-----------|---------|------|
| **picoToken** | `{configDir}/.security.yml` → `channels.pico.token` (優先)<br>或 `{configDir}/config.json` → `channels.pico.token` (備用) | Token |
| **pidToken** | `{home}/.picoclaw.pid` → `Token` | Token |

## 程式碼

### main.go

```go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

var (
	configPath = flag.String("config", "/root/.picoclaw/config.json", "PicoClaw 配置文件路径")
	pidPath    = flag.String("pid", "/root/.picoclaw/.picoclaw.pid", ".picoclaw.pid 文件路径")
	listenPort = flag.String("port", "18801", "监听端口")
)
```

### go.mod

```
module picoclaw-token-proxy

go 1.22

require gopkg.in/yaml.v3 v3.0.1
```

### Dockerfile

```dockerfile
FROM --platform=linux/amd64 golang:1.22-alpine AS builder

WORKDIR /build

RUN apk add --no-cache git

COPY go.mod ./
RUN go get gopkg.in/yaml.v3@v3.0.1

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o picoclaw-token-proxy .

FROM --platform=linux/amd64 alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/picoclaw-token-proxy .

EXPOSE 18801

CMD ["./picoclaw-token-proxy"]
```

## API 接口

### 驗證 Token

**POST /api/verify**

請求：
```json
{
  "pico_token": "插件傳來的picoToken"
}
```

成功回應：
```json
{
  "pid_token": "讀取到的pidToken"
}
```

失敗回應：
```json
{
  "error": "錯誤訊息"
}
```

## 使用方式

### 命令列參數

```bash
./picoclaw-token-proxy \
  -config ~/.picoclaw/.security.yml \
  -pid ~/.picoclaw/.picoclaw.pid \
  -port 18801
```

| 參數 | 說明 | 預設值 |
|-----|------|-------|
| -config | PicoClaw 配置文件路徑 | /root/.picoclaw/config.json |
| -pid | .picoclaw.pid 文件路徑 | /root/.picoclaw/.picoclaw.pid |
| -port | 監聽端口 | 18801 |

### Docker 部署

```bash
# 建置
docker build -t picoclaw-token-proxy .

# 運行
docker run -d -p 18801:18801 \
  -v /home/picoclaw/.picoclaw:/home/picoclaw/.picoclaw \
  picoclaw-token-proxy \
  -config /home/picoclaw/.picoclaw/.security.yml \
  -pid /home/picoclaw/.picoclaw/.picoclaw.pid
```

## 本地測試

```bash
# 啟動服務
./picoclaw-token-proxy -config ~/.picoclaw/.security.yml -pid ~/.picoclaw/.picoclaw.pid

# 測試 API
curl -X POST http://localhost:18801/api/verify \
  -H "Content-Type: application/json" \
  -d '{"pico_token": "你的picoToken值"}'
```

## 取得真實 Token 值

```bash
# 查看 .security.yml 中的 picoToken
cat ~/.picoclaw/.security.yml | grep -A2 'pico:'

# 查看 .picoclaw.pid 中的 pidToken
cat ~/.picoclaw/.picoclaw.pid
```

## 原始碼參考

- picoToken 來源：`picoclaw-0.2.6/pkg/config/security.go`
- pidToken 來源：`picoclaw-0.2.6/pkg/pid/pidfile.go`
- WebSocket 認證：`picoclaw-0.2.6/web/backend/api/gateway.go` (picoComposedToken 函數)