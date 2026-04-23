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

// Refresh both picoToken and pidToken (needed after server restart)
async function refreshTokens() {
  if (!settings || !settings.serverUrl || !settings.dashToken) {
    console.error('[PicoClaw] Missing settings for token refresh');
    return false;
  }
  
  let host = settings.serverUrl;
  if (host.startsWith('http://')) host = host.substring(7);
  else if (host.startsWith('https://')) host = host.substring(8);
  const portIdx = host.indexOf(':');
  if (portIdx > 0) host = host.substring(0, portIdx);
  
  const apiPort = settings.apiPort || '18800';
  const tokenPort = settings.tokenPort || '18801';
  
  try {
    // Step 1: Get picoToken from /api/pico/token
    const picoResp = await fetch(`http://${host}:${apiPort}/api/pico/token`, {
      headers: { 'Authorization': `Bearer ${settings.dashToken}` }
    });
    if (!picoResp.ok) {
      console.error('[PicoClaw] Failed to fetch picoToken:', picoResp.status);
      return false;
    }
    const picoData = await picoResp.json();
    if (!picoData.token) {
      console.error('[PicoClaw] No picoToken in response');
      return false;
    }
    settings.picoToken = picoData.token;
    console.log('[PicoClaw] Refreshing picoToken:', picoData.token.substring(0, 6) + '...');
    
    // Step 2: Get pidToken from token proxy service
    const pidResp = await fetch(`http://${host}:${tokenPort}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pico_token: settings.picoToken })
    });
    if (!pidResp.ok) {
      console.error('[PicoClaw] Failed to fetch pidToken:', pidResp.status);
      // Still save picoToken, will use without pidToken
    } else {
      const pidData = await pidResp.json();
      if (pidData.pid_token) {
        settings.pidToken = pidData.pid_token;
        console.log('[PicoClaw] Refreshing pidToken:', pidData.pid_token.substring(0, 6) + '...');
      }
    }
    
    // Save updated settings
    chrome.storage.local.set({ picoclawSettings: settings });
    return true;
  } catch (e) {
    console.error('[PicoClaw] Token refresh failed:', e);
    return false;
  }
}

// Connect to PicoClaw WebSocket server
async function connect(forceRefreshToken = false) {
  if (!settings || !settings.serverUrl) {
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  await loadSettings();
  
  if (forceRefreshToken || !settings.picoToken || !settings.pidToken) {
    await refreshTokens();
  }
  
  let webSocketToken = settings.picoToken || '';
  
  if (settings.pidToken && webSocketToken) {
    webSocketToken = `pico-${settings.pidToken}${webSocketToken}`;
    console.log('[PicoClaw] Using full composite token: pico-{pidToken}{picoToken}');
  }
  
  if (!webSocketToken) {
    console.error('[PicoClaw] No picoToken available, skipping WS connect');
    return;
  }

  let host = settings.serverUrl;
  if (host.startsWith('http://')) {
    host = host.substring(7);
  } else if (host.startsWith('https://')) {
    host = host.substring(8);
  }
  const portIndex = host.indexOf(':');
  if (portIndex > 0) host = host.substring(0, portIndex);
  
  // WS through port 18790
  const wsPort = settings.wsPort || '18790';
  let serverUrl = `ws://${host}:${wsPort}/pico/ws`;
  
  if (currentSessionId) {
    serverUrl += `?session_id=${currentSessionId}`;
  }

  console.log('[PicoClaw] Connecting WS:', serverUrl, 'token:', webSocketToken.substring(0, 6) + '...');

  try {
    ws = new WebSocket(serverUrl, `token.${webSocketToken}`);

    ws.onopen = () => {
      isConnected = true;
      updateBadge('connected');
      startPing();
      sendPendingMessages();
      broadcastStatus(true);
      broadcastSessionId(currentSessionId);
    };

    ws.onmessage = (event) => {
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
function sendChatMessage(content) {
  const msg = {
    type: MessageType.MESSAGE_SEND,
    id: generateId(),
    timestamp: Date.now(),
    payload: {
      content: content
    }
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendRaw(msg);
  } else {
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
      const msgId = sendChatMessage(message.content);
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
