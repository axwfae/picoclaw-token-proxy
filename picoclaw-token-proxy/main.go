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

type Config struct {
	Channels struct {
		Pico struct {
			Token string `json:"token"`
		} `json:"pico"`
	} `json:"channels"`
}

type SecurityConfig struct {
	Channels struct {
		Pico struct {
			Token string `yaml:"token"`
		} `yaml:"pico"`
	} `yaml:"channels"`
}

type PidFileData struct {
	PID     int    `json:"pid"`
	Token   string `json:"token"`
	Version string `json:"version"`
	Port    int    `json:"port"`
	Host    string `json:"host"`
}

type TokenVerifyRequest struct {
	PicoToken string `json:"pico_token"`
}

type TokenVerifyResponse struct {
	PidToken string `json:"pid_token"`
	Error    string `json:"error,omitempty"`
}

func main() {
	flag.Parse()

	log.Printf("启动 Token 验证服务")
	log.Printf("监听端口: %s", *listenPort)
	log.Printf("配置文件: %s", *configPath)
	log.Printf("PID 文件: %s", *pidPath)

	http.HandleFunc("/api/verify", handleTokenVerify)

	log.Fatal(http.ListenAndServe(":"+*listenPort, nil))
}

func handleTokenVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	var req TokenVerifyRequest
	body, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, "读取请求体失败")
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(body, &req); err != nil {
		respondError(w, "JSON 解析失败")
		return
	}

	if req.PicoToken == "" {
		respondError(w, "pico_token 不能为空")
		return
	}

	configPicoToken, err := readPicoToken(*configPath)
	if err != nil {
		respondError(w, fmt.Sprintf("读取 picoToken 失败: %v", err))
		return
	}

	if req.PicoToken != configPicoToken {
		respondError(w, "pico_token 验证失败")
		return
	}

	pidToken, err := readPidToken(*pidPath)
	if err != nil {
		respondError(w, fmt.Sprintf("读取 pidToken 失败: %v", err))
		return
	}

	resp := TokenVerifyResponse{
		PidToken: pidToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func readPicoToken(configPath string) (string, error) {
	configDir := filepath.Dir(configPath)
	securityPath := filepath.Join(configDir, ".security.yml")

	var picoToken string

	if securityData, err := os.ReadFile(securityPath); err == nil {
		var secCfg SecurityConfig
		if err := yaml.Unmarshal(securityData, &secCfg); err == nil && secCfg.Channels.Pico.Token != "" {
			picoToken = secCfg.Channels.Pico.Token
		}
	}

	if picoToken == "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return "", fmt.Errorf("读取配置文件失败: %w", err)
		}

		var cfg Config
		if err := json.Unmarshal(data, &cfg); err != nil {
			return "", fmt.Errorf("解析配置文件失败: %w", err)
		}

		picoToken = cfg.Channels.Pico.Token
	}

	if picoToken == "" {
		return "", fmt.Errorf("配置文件中未找到 picoToken")
	}

	return picoToken, nil
}

func readPidToken(pidPath string) (string, error) {
	data, err := os.ReadFile(pidPath)
	if err != nil {
		return "", fmt.Errorf("读取 pid 文件失败: %w", err)
	}

	var pidData PidFileData
	if err := json.Unmarshal(data, &pidData); err != nil {
		return "", fmt.Errorf("解析 pid 文件失败: %w", err)
	}

	if pidData.Token == "" {
		return "", fmt.Errorf("pid 文件中 token 为空")
	}

	return pidData.Token, nil
}

func respondError(w http.ResponseWriter, message string) {
	resp := TokenVerifyResponse{Error: message}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(resp)
}