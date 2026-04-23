// PicoClaw Chrome Extension - Background Service Worker
// Manages WebSocket connection to PicoClaw server

const PING_INTERVAL = 25000;
const RECONNECT_DELAY = 5000;

let ws = null;
let settings = null;
let pendingMessages = [];
let reconnectTimer = null;
let pingTimer = null;
let isConnected = false;
let messageId = 0;
let currentSessionId = null;

// Message types
const MessageType = {
  MESSAGE_SEND: 'message.send',
  MESSAGE_CREATE: 'message.create',
  MESSAGE_UPDATE: 'message.update',
  TYPING_START: 'typing.start',
  TYPING_STOP: 'typing.stop',
  PING: 'ping',
  PONG: 'pong'
};

// Set up alarms to keep service worker alive
function setupKeepAliveAlarms() {
  chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
  chrome.alarms.create('connectionCheck', { periodInMinutes: 0.5 });
  
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepAlive') {
      loadSettings();
    } else if (alarm.name === 'connectionCheck') {
      checkConnection();
    }
  });
}

function checkConnection() {
  if (!settings || !settings.serverUrl) {
    return;
  }
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    isConnected = false;
    updateBadge('disconnected');
    broadcastStatus(false);
    connect();
  }
}

// Generate unique message ID
function generateId() {
  return `msg_${Date.now()}_${++messageId}`;
}

// Load settings from storage
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['picoclawSettings'], (result) => {
      settings = result.picoclawSettings || {};
      resolve(settings);
    });
  });
}

async function login() {
  if (!settings || !settings.serverUrl || !settings.password) {
    console.error('[PicoClaw] Missing settings for login');
    return false;
  }

  let host = settings.serverUrl;
  if (host.startsWith('http://')) host = host.substring(7);
  else if (host.startsWith('https://')) host = host.substring(8);
  const portIdx = host.indexOf(':');
  if (portIdx > 0) host = host.substring(0, portIdx);

  const tokenPort = settings.tokenProxyPort || '18801';

  try {
    const resp = await fetch(`http://${host}:${tokenPort}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: settings.password }),
    });

    console.log('[PicoClaw] Login via proxy, status:', resp.status);

    if (!resp.ok) {
      console.error('[PicoClaw] Login failed:', resp.status);
      return false;
    }

    const data = await resp.json();
    console.log('[PicoClaw] Login response:', data);

    if (data.auth_cookie) {
      settings.authCookie = data.auth_cookie;
      chrome.storage.local.set({ picoclawSettings: settings });
      console.log('[PicoClaw] Login successful');
      return true;
    }

    console.error('[PicoClaw] No cookie in login response');
    return false;
  } catch (e) {
    console.error('[PicoClaw] Login error:', e);
    return false;
  }
}

// Check if currently authenticated
async function checkAuth() {
  if (!settings || !settings.serverUrl || !settings.authCookie) {
    return false;
  }

  let host = settings.serverUrl;
  if (host.startsWith('http://')) host = host.substring(7);
  else if (host.startsWith('https://')) host = host.substring(8);
  const portIdx = host.indexOf(':');
  if (portIdx > 0) host = host.substring(0, portIdx);

  const tokenPort = settings.tokenProxyPort || '18801';

  try {
    const resp = await fetch(`http://${host}:${tokenPort}/api/auth/status`, {
      headers: { 'X-Auth-Cookie': settings.authCookie }
    });

    if (!resp.ok) return false;
    const data = await resp.json();
    return data.authenticated === true;
  } catch (e) {
    return false;
  }
}

// Ensure authenticated (login if needed)
async function ensureAuthenticated() {
  if (!settings.authCookie) {
    const ok = await login();
    if (!ok) return false;
  }

  const isAuth = await checkAuth();
  if (!isAuth) {
    const ok = await login();
    if (!ok) return false;
  }

  return true;
}

async function connect(forceRefreshToken = false) {
  if (!settings || !settings.serverUrl) {
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  await loadSettings();

  if (forceRefreshToken || !settings.authCookie) {
    const ok = await ensureAuthenticated();
    if (!ok) {
      console.error('[PicoClaw] Authentication failed');
      return;
    }
  }

  let host = settings.serverUrl;
  if (host.startsWith('http://')) {
    host = host.substring(7);
  } else if (host.startsWith('https://')) {
    host = host.substring(8);
  }
  const portIndex = host.indexOf(':');
  if (portIndex > 0) host = host.substring(0, portIndex);

  const tokenPort = settings.tokenProxyPort || '18801';
  const wsPort = settings.wsPort || '18800';
  let serverUrl = `ws://${host}:${tokenPort}/pico/ws?ws_port=${wsPort}&auth_cookie=${encodeURIComponent(settings.authCookie)}`;

  if (currentSessionId) {
    serverUrl += `&session_id=${currentSessionId}`;
  }

  console.log('[PicoClaw] Connecting WS via proxy:', serverUrl);

  try {
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
      isConnected = true;
      console.log('[PicoClaw] WebSocket connected!');
      updateBadge('connected');
      startPing();
      sendPendingMessages();
      broadcastStatus(true);
      broadcastSessionId(currentSessionId);
    };

    ws.onmessage = (event) => {
      console.log('[PicoClaw] WS received:', event.data.slice(0, 300));
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[PicoClaw] Failed to parse message:', e);
      }
    };

    ws.onclose = (event) => {
      isConnected = false;
      updateBadge('disconnected');
      stopPing();
      broadcastStatus(false);
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      isConnected = false;
      updateBadge('error');
    };
  } catch (e) {
    scheduleReconnect();
  }
}

// Schedule reconnection with token refresh
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(true);
  }, RECONNECT_DELAY);
}

// Start ping loop
function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendRaw({
        type: MessageType.PING,
        timestamp: Date.now()
      });
    }
  }, PING_INTERVAL);
}

// Stop ping loop
function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// Send raw message via WebSocket
function sendRaw(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Send pending messages from queue
function sendPendingMessages() {
  while (pendingMessages.length > 0) {
    const msg = pendingMessages.shift();
    sendRaw(msg);
  }
}

// Handle incoming message
function handleMessage(msg) {
  const content = msg.payload?.content || '';

  switch (msg.type) {
    case MessageType.PONG:
      break;

    case MessageType.MESSAGE_CREATE:
      broadcastMessage('message', msg);
      break;

    case MessageType.MESSAGE_UPDATE:
      broadcastMessage('update', msg);
      break;

    case MessageType.TYPING_START:
      broadcastMessage('typing_start', msg);
      break;

    case MessageType.TYPING_STOP:
      broadcastMessage('typing_stop', msg);
      break;

  }
}

// Broadcast message to popup
function broadcastMessage(eventType, msg) {
  chrome.runtime.sendMessage({
    type: eventType,
    data: msg
  }).catch(() => {
    // Popup might not be open
  });
}

// Broadcast connection status
function broadcastStatus(connected) {
  chrome.runtime.sendMessage({
    type: 'status',
    connected: connected
  }).catch(() => {
    // Popup might not be open
  });
}

function broadcastSessionId(sessionId) {
  chrome.runtime.sendMessage({
    type: 'session_id',
    sessionId: sessionId
  }).catch(() => {});
}

// Update badge
function updateBadge(status) {
  let text = '';
  let color = '#4a4a4a';

  switch (status) {
    case 'connected':
      text = '●';
      color = '#22c55e';
      break;
    case 'disconnected':
      text = '●';
      color = '#ef4444';
      break;
    case 'error':
      text = '●';
      color = '#ef4444';
      break;
  }

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Send message via WebSocket
function sendChatMessage(content, images = null) {
  let finalContent = content;
  if ((!finalContent || finalContent.trim() === '') && images && images.length > 0) {
    finalContent = '📷';
  }

  const payload = { content: finalContent };

  if (images && images.length > 0) {
    payload.media = images.map(img => img.data);
    console.log('[PicoClaw] Sending images:', images.length, 'first image type:', images[0]?.type);
  }

  const msg = {
    type: MessageType.MESSAGE_SEND,
    id: generateId(),
    timestamp: Date.now(),
    payload: payload
  };

  console.log('[PicoClaw] Sending message:', JSON.stringify(msg).slice(0, 200));

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendRaw(msg);
  } else {
    console.log('[PicoClaw] WS not connected, queuing message');
    pendingMessages.push(msg);
  }

  return msg.id;
}

// Send typing indicator
function sendTypingStart() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendRaw({
      type: MessageType.TYPING_START,
      timestamp: Date.now()
    });
  }
}

function sendTypingStop() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendRaw({
      type: MessageType.TYPING_STOP,
      timestamp: Date.now()
    });
  }
}

// Disconnect
function disconnect() {
  stopPing();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close(1000, 'User disconnected');
    ws = null;
  }
  isConnected = false;
  updateBadge('disconnected');
}

// Message handler from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'connect':
      loadSettings().then(() => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          sendResponse({ success: true, alreadyConnected: true });
          return;
        }
        connect();
        sendResponse({ success: true });
      });
      return true;

    case 'disconnect':
      disconnect();
      sendResponse({ success: true });
      break;

    case 'send':
      const msgId = sendChatMessage(message.content, message.images);
      sendResponse({ success: true, id: msgId });
      break;

    case 'typing_start':
      sendTypingStart();
      break;

    case 'typing_stop':
      sendTypingStop();
      break;

    case 'get_status':
      const actualConnected = ws && ws.readyState === WebSocket.OPEN;
      if (actualConnected !== isConnected) {
        isConnected = actualConnected;
        if (isConnected) {
          updateBadge('connected');
          broadcastStatus(true);
        } else {
          updateBadge('disconnected');
          broadcastStatus(false);
        }
      }
      sendResponse({ connected: actualConnected, sessionId: currentSessionId });
      break;

    case 'set_session':
      currentSessionId = message.sessionId || null;
      if (currentSessionId) {
        chrome.storage.local.set({ picoclawSessionId: currentSessionId });
      }
      sendResponse({ success: true, sessionId: currentSessionId });
      break;

    case 'get_session':
      sendResponse({ sessionId: currentSessionId });
      break;

    case 'reconnect_with_session':
      currentSessionId = message.sessionId || null;
      if (currentSessionId) {
        chrome.storage.local.set({ picoclawSessionId: currentSessionId });
      }
      if (ws) {
        ws.close(1000, 'Session change');
        ws = null;
      }
      isConnected = false;
      updateBadge('disconnected');
      stopPing();
      broadcastStatus(false);
      setTimeout(() => connect(), 500);
      sendResponse({ success: true });
      break;
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  setupKeepAliveAlarms();
  loadSettings().then(() => {
    chrome.storage.local.get(['picoclawSessionId'], (result) => {
      currentSessionId = result.picoclawSessionId || null;
      if (settings && settings.serverUrl) {
        connect();
      }
    });
  });
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  setupKeepAliveAlarms();
  loadSettings().then(() => {
    chrome.storage.local.get(['picoclawSessionId'], (result) => {
      currentSessionId = result.picoclawSessionId || null;
      if (settings && settings.serverUrl) {
        connect();
      }
    });
  });
});

// Idle detection - reconnect when user becomes active
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') {
    checkConnection();
  }
});
