# PicoClaw Chrome Extension

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.1 | 2026-03-29 | Test release script |
| 1.0.0 | 2026-03-29 | Initial release |

## Backup Archives

Backups are stored in `backups/` directory with naming convention:
`picoclaw-extension-v{version}-{YYYYMMDD}.zip`
| 1.0.2 | 2026-03-29 | Updated version |
| 1.0.3 | 2026-03-29 | Updated version |
| 1.0.4 | 2026-03-29 | Updated version |
| 1.0.6 | 2026-03-29 | Updated version |
| 1.0.7 | 2026-03-29 | Updated version |
| 1.0.8 | 2026-03-29 | Updated version |
| 1.0.9 | 2026-03-29 | Updated version |
| 1.0.10 | 2026-03-29 | Updated version |
| 1.0.11 | 2026-03-29 | Updated version |
| 1.0.12 | 2026-03-29 | Updated version |
| 1.0.13 | 2026-03-29 | Updated version |
| 1.0.14 | 2026-03-29 | Updated version |
| 1.0.15 | 2026-03-29 | Updated version |
| 1.0.16 | 2026-03-29 | Updated version |
| 1.0.17 | 2026-03-29 | Updated version |
| 1.0.18 | 2026-03-30 | Updated version |
| 1.0.19 | 2026-03-30 | Updated version |
| 1.0.20 | 2026-04-03 | Support Markdown rendering for bot messages |
| 1.0.21 | 2026-04-03 | Session management - server-side persistence, new/switch/delete conversations |
| 1.0.22 | 2026-04-03 | Remove local history UI, fix session API field mapping, add debug logging |
| 1.0.23 | 2026-04-03 | Fix i18n.js null reference crash, improve session API error handling |
| 1.0.24 | 2026-04-03 | Add try-catch to DOMContentLoaded, display debug URL in session list UI |
| 1.0.25 | 2026-04-03 | Defensive DOM element checks, saveSettings try-catch with alert |
| 1.0.26 | 2026-04-03 | Fix syntax error - orphaned catch block in loadSessionList |
| 1.0.27 | 2026-04-03 | Complete rewrite - local-only session management, no server API dependency |
| 1.0.30 | 2026-04-03 | Separate WS(18790) and HTTP API(18800) ports, dual-port session management |
| 1.0.31 | 2026-04-03 | Fix i18n - settings title, new session label follow language, remove zh-TW, add session keys |
| 1.0.32 | 2026-04-03 | Language button shows target language instead of current |
| 1.0.33 | 2026-04-03 | Remove dead code: unused icon(102KB), getWsBaseUrl, reconnect, update_settings handler, unused constants |
| 1.0.34 | 2026-04-03 | Fix syntax error - missing closing brace for switch statement |
| 1.0.35 | 2026-04-03 | Add model switching - view current model, switch between available models via /api/models |
| 1.0.36 | 2026-04-03 | Filter models: hide unconfigured(configured=false), deduplicate by model_name |
| 1.0.37 | 2026-04-03 | Auto restart gateway after model switch via POST /api/gateway/restart |
| 1.0.50 | 2026-04-03 | Dual-token auth: Dashboard Token for API, auto-fetch picoToken for WS via /api/pico/token, all API calls use Authorization Bearer header |
| 1.0.51 | 2026-04-11 | Support new picoclaw v0.2.5+ server: add token proxy port 18801, fetch pidToken via /api/verify, compose full WS token pico-{pidToken}{picoToken} |
| 1.0.52 | 2026-04-11 | Fix model list: change m.configured to m.enabled (fix model switching), remove picoclaw_new from Dashboard Token placeholder |
| 1.0.53 | 2026-04-11 | Auto token refresh on reconnect: add refreshTokens() in background.js, refresh both picoToken and pidToken after server restart |
| 1.0.54 | 2026-04-11 | Add waiting indicator: show "waiting..." after sending message, auto-remove after 3min or on bot response |
| 1.0.55 | 2026-04-11 | Fix i18n for waiting text, fix waiting state persistence: restore on popup reopen |
| 1.0.56 | 2026-04-11 | Fix i18n consistency: use t() in updateConnectionStatus(), add ensureUIText() call on load |
| 1.0.57 | 2026-04-11 | Fix i18n: language button shows 中文/EN, translate model/session/settings/debug buttons, fix waiting state restore |
| 1.0.58 | 2026-04-11 | Fix i18n: lang button title shows correct language (English/中文), translate settings button, add restoreWaitingState() |
| 1.0.59 | 2026-04-11 | Fix waiting state: add delayed restore (300ms) in restoreWaitingState() to ensure storage is read after loadSettings |
