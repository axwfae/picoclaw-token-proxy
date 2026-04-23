package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

var (
	listenPort = flag.String("port", "18801", "監聽端口")
	targetHost = flag.String("host", "127.0.0.1", "目標服務器地址")
	targetPort = flag.String("target", "18800", "目標服務器端口")
	debugMode = flag.Bool("debug", false, "調試模式(輸出詳細日誌)")
	version   = "v0.2.8.0"
)

func main() {
	flag.Parse()

	log.SetFlags(0)
	log.Printf("PicoClaw Token Proxy %s", version)
	log.Printf("Listen: :%s -> %s:%s", *listenPort, *targetHost, *targetPort)

	registerRoutes()
	log.Fatal(http.ListenAndServe(":"+*listenPort, nil))
}

func registerRoutes() {
	http.HandleFunc("/api/login", handleLogin)
	http.HandleFunc("/api/auth/status", handleProxy)
	http.HandleFunc("/api/pico/info", handleProxy)
	http.HandleFunc("/api/models", handleProxy)
	http.HandleFunc("/api/models/default", handleProxy)
	http.HandleFunc("/api/sessions", handleProxy)
	http.HandleFunc("/api/sessions/", handleProxy)
	http.HandleFunc("/api/gateway/", handleProxy)
	http.Handle("/pico/ws", http.HandlerFunc(handleWebSocketProxy))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	setCorsHeaders(w, "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "方法不允許", 405)
		return
	}

	body, _ := io.ReadAll(r.Body)
	defer r.Body.Close()

	var req struct{ Password string }
	if err := json.Unmarshal(body, &req); err != nil {
		respondError(w, "JSON解析失敗")
		return
	}
	if req.Password == "" {
		respondError(w, "password不能為空")
		return
	}

	targetURL := fmt.Sprintf("http://%s:%s/api/auth/login", *targetHost, *targetPort)
	loginReq, err := http.NewRequest("POST", targetURL, strings.NewReader(string(body)))
	if err != nil {
		respondError(w, "創建請求失敗")
		return
	}
	loginReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(loginReq)
	if err != nil {
		respondError(w, fmt.Sprintf("登錄請求失敗: %v", err))
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if *debugMode {
		log.Printf("Login -> %d", resp.StatusCode)
	}

	if resp.StatusCode != 200 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		w.Write(respBody)
		return
	}

	for _, cookie := range resp.Cookies() {
		if cookie.Name == "picoclaw_launcher_auth" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":     true,
				"auth_cookie": cookie.Value,
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"success":true}`))
}

func handleProxy(w http.ResponseWriter, r *http.Request) {
	setCorsHeaders(w, "GET, POST, PUT, DELETE, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	cookieValue := r.Header.Get("X-Auth-Cookie")
	if cookieValue == "" {
		for _, c := range r.Cookies() {
			if c.Name == "picoclaw_launcher_auth" {
				cookieValue = c.Value
				break
			}
		}
	}

	proxyHost := fmt.Sprintf("%s:%s", *targetHost, *targetPort)
	targetURL := fmt.Sprintf("http://%s%s", proxyHost, r.URL.Path)
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	if *debugMode {
		log.Printf("API: %s %s -> %s", r.Method, r.URL.Path, targetURL)
	}

	proxyReq, _ := http.NewRequest(r.Method, targetURL, r.Body)
	proxyReq.Header = r.Header.Clone()
	if cookieValue != "" {
		proxyReq.Header.Set("Cookie", "picoclaw_launcher_auth="+cookieValue)
	}
	proxyReq.Header.Del("X-Auth-Cookie")

	resp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		respondError(w, fmt.Sprintf("請求失敗: %v", err))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	for k, v := range resp.Header {
		for _, vv := range v {
			w.Header().Add(k, vv)
		}
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

func handleWebSocketProxy(w http.ResponseWriter, r *http.Request) {
	cookieValue := r.Header.Get("X-Auth-Cookie")
	if cookieValue == "" {
		cookieValue = r.URL.Query().Get("auth_cookie")
	}

	wsPort := r.URL.Query().Get("ws_port")
	if wsPort == "" {
		wsPort = *targetPort
	}

	target := fmt.Sprintf("%s:%s", *targetHost, wsPort)

	if *debugMode {
		log.Printf("WS: proxy to %s", target)
	}

	proxy := httputil.NewSingleHostReverseProxy(&url.URL{
		Scheme: "http",
		Host:   target,
	})

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target
		req.URL.Host = target
		req.URL.Scheme = "http"
	}

	r.Header.Set("Cookie", "picoclaw_launcher_auth="+cookieValue)
	r.Header.Del("X-Auth-Cookie")

	proxy.ServeHTTP(w, r)
}

func setCorsHeaders(w http.ResponseWriter, methods string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", methods)
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Cookie, X-Auth-Cookie")
}

func respondError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(400)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}