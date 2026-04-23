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