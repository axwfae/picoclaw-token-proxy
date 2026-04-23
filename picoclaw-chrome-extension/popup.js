let settings = {
  serverUrl: '',
  wsPort: '18800',
  tokenProxyPort: '18801',
  password: '',
  authCookie: '',
};

let currentSessionId = null;
let isConnected = false;
let typingTimeout = null;
let sessionMenuOpen = false;
let modelMenuOpen = false;
let attachedImages = []; // 儲存圖片的 dataURL

document.addEventListener('DOMContentLoaded', () => {
  try { initLanguage(); } catch (e) { console.error('[PicoClaw] initLanguage:', e); }
  try { loadSettings(); } catch (e) { console.error('[PicoClaw] loadSettings:', e); }
  try { ensureUIText(); } catch (e) { console.error('[PicoClaw] ensureUIText:', e); }
  try { restoreWaitingState(); } catch (e) { console.error('[PicoClaw] restoreWaitingState:', e); }
  try { setupEventListeners(); } catch (e) { console.error('[PicoClaw] setupEventListeners:', e); }
  try { setupBackgroundListener(); } catch (e) { console.error('[PicoClaw] setupBackgroundListener:', e); }
  try { closeMenusOnOutsideClick(); } catch (e) { console.error('[PicoClaw] closeMenus:', e); }
  try { setupLinkHandler(); } catch (e) { console.error('[PicoClaw] setupLinkHandler:', e); }
});

function initLanguage() {
  chrome.storage.local.get(['picoclawLang'], (result) => {
    if (result.picoclawLang) {
      currentLang = result.picoclawLang;
    } else {
      currentLang = detectSystemLanguage();
      chrome.storage.local.set({ picoclawLang: currentLang });
    }
  });
}

function ensureUIText() {
  if (typeof updateUIText === 'function') {
    updateUIText();
  }
}

function setupEventListeners() {
  const saveBtn = document.getElementById('saveSettings');
  const testBtn = document.getElementById('testConnection');
  const sendBtn = document.getElementById('sendMessage');
  const toggleBtn = document.getElementById('toggleSettings');
  const connBtn = document.getElementById('connectionBtn');
  const langBtn = document.getElementById('langBtn');
  const sessBtn = document.getElementById('sessionBtn');
  const newSessBtn = document.getElementById('newSessionBtn');
  const modelBtn = document.getElementById('modelBtn');
  const debugBtn = document.getElementById('debugInfo');
  const msgInput = document.getElementById('messageInput');
  const imageInput = document.getElementById('imageInput');
  const attachBtn = document.getElementById('attachImage');

  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (testBtn) testBtn.addEventListener('click', testConnection);
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSettings);
  if (connBtn) connBtn.addEventListener('click', toggleConnection);
  if (langBtn) langBtn.addEventListener('click', cycleLanguage);
  if (sessBtn) sessBtn.addEventListener('click', toggleSessionMenu);
  if (newSessBtn) newSessBtn.addEventListener('click', createNewSession);
  if (modelBtn) modelBtn.addEventListener('click', toggleModelMenu);
  if (debugBtn) debugBtn.addEventListener('click', showDebugInfo);
  if (attachBtn) attachBtn.addEventListener('click', () => imageInput.click());
  if (imageInput) imageInput.addEventListener('change', handleImageSelect);

  if (msgInput) {
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    msgInput.addEventListener('input', (e) => {
      chrome.storage.local.set({ inputText: e.target.value });
      handleTyping(e.target.value);
    });
  }
}

function closeMenusOnOutsideClick() {
  document.addEventListener('click', (e) => {
    const sessDropdown = document.getElementById('sessionDropdown');
    if (sessDropdown && !sessDropdown.contains(e.target) && sessionMenuOpen) {
      closeSessionMenu();
    }
    const modelDropdown = document.getElementById('modelDropdown');
    if (modelDropdown && !modelDropdown.contains(e.target) && modelMenuOpen) {
      closeModelMenu();
    }
  });
}

function handleTyping(text) {
  if (!isConnected) return;
  chrome.runtime.sendMessage({ type: 'typing_start' });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'typing_stop' });
  }, 1000);
}

function setupBackgroundListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'status':
        isConnected = message.connected;
        updateConnectionStatus(isConnected);
        break;
      case 'message':
        handleBotMessage(message.data);
        break;
      case 'update':
        handleMessageUpdate(message.data);
        break;
      case 'typing_start':
        showTypingIndicator();
        break;
      case 'typing_stop':
        removeTypingIndicator();
        break;
      case 'session_id':
        if (message.sessionId && message.sessionId !== currentSessionId) {
          currentSessionId = message.sessionId;
          updateSessionButtonLabel();
        }
        break;
    }
  });
}

function loadSettings() {
  chrome.storage.local.get(['picoclawSettings', 'picoclawSessionId', 'inputText', 'picoclawWaiting', 'picoclawAttachedImages'], (result) => {
    if (result.picoclawSettings) {
      settings = result.picoclawSettings;
      const fullUrl = settings.serverUrl || '';
      let host = fullUrl;
      if (host.startsWith('http://')) host = host.replace('http://', '');
      else if (host.startsWith('https://')) host = host.replace('https://', '');
      const portIndex = host.indexOf(':');
      if (portIndex > 0) host = host.substring(0, portIndex);

      document.getElementById('serverUrl').value = host;
      document.getElementById('wsPort').value = settings.wsPort || '18800';
      document.getElementById('tokenProxyPort').value = settings.tokenProxyPort || '18801';
      document.getElementById('dashToken').value = settings.password || '';

      if (settings.serverUrl && settings.password) {
        showChatPanel();
      } else {
        showSettingsPanel();
      }
    } else {
      showSettingsPanel();
    }

    currentSessionId = result.picoclawSessionId || null;
    updateSessionButtonLabel();
    loadCurrentModel();

    if (result.inputText !== undefined) {
      document.getElementById('messageInput').value = result.inputText;
    }

    attachedImages = result.picoclawAttachedImages || [];
    renderImagePreview();

    if (settings.serverUrl && settings.password) {
      showChatPanel();
      ensureAuthenticated().then((ok) => {
        if (ok) {
          chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
            if (response && response.connected) {
              isConnected = true;
              if (response.sessionId) {
                currentSessionId = response.sessionId;
                updateSessionButtonLabel();
              }
              updateConnectionStatus(true);
              loadSessionHistory(currentSessionId);
            } else {
              connect();
            }
            if (result.picoclawWaiting) {
              showWaitingIndicator();
            }
            updateUIText();
          });
        }
      });
    } else {
      if (result.picoclawWaiting) {
        showWaitingIndicator();
      }
      updateUIText();
    }
  });
}

function restoreWaitingState() {
  setTimeout(() => {
    chrome.storage.local.get(['picoclawWaiting'], (wResult) => {
      if (wResult.picoclawWaiting && !document.getElementById('waitingIndicator')) {
        showWaitingIndicator();
      }
    });
  }, 300);
}

async function login() {
  try {
    const host = settings.serverUrl;
    if (!host || !settings.password) return false;

    let actualHost = host;
    if (actualHost.startsWith('http://')) actualHost = actualHost.substring(7);
    else if (actualHost.startsWith('https://')) actualHost = actualHost.substring(8);
    const portIdx = actualHost.indexOf(':');
    if (portIdx > 0) actualHost = actualHost.substring(0, portIdx);

    const tokenPort = settings.tokenProxyPort || '18801';

    const resp = await fetch(`http://${actualHost}:${tokenPort}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: settings.password }),
    });

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

async function checkAuth() {
  try {
    const host = settings.serverUrl;
    if (!host) return false;

    let actualHost = host;
    if (actualHost.startsWith('http://')) actualHost = actualHost.substring(7);
    else if (actualHost.startsWith('https://')) actualHost = actualHost.substring(8);
    const portIdx = actualHost.indexOf(':');
    if (portIdx > 0) actualHost = actualHost.substring(0, portIdx);

    const tokenPort = settings.tokenProxyPort || '18801';
    const resp = await fetch(`http://${actualHost}:${tokenPort}/api/auth/status`, {
      headers: { 'X-Auth-Cookie': settings.authCookie || '' }
    });

    if (!resp.ok) return false;
    const data = await resp.json();
    return data.authenticated === true;
  } catch (e) {
    return false;
  }
}

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

function saveSettings() {
  try {
    const host = document.getElementById('serverUrl').value.trim();
    const wsPort = document.getElementById('wsPort').value.trim() || '18800';
    const tokenProxyPort = document.getElementById('tokenProxyPort').value.trim() || '18801';
    const password = document.getElementById('dashToken').value.trim();

    if (!host) { showToast(t('pleaseEnterServer')); return; }
    if (!password) { showToast('请输入密码'); return; }

    settings = { serverUrl: host, wsPort, tokenProxyPort, password, authCookie: '' };

    chrome.storage.local.set({ picoclawSettings: settings }, () => {
      showToast(t('saving'));
      showChatPanel();
      ensureAuthenticated().then(() => connect());
    });
  } catch (e) {
    alert('saveSettings error: ' + e.message);
  }
}

function showSettingsPanel() {
  const inputText = document.getElementById('messageInput').value;
  chrome.storage.local.set({ inputText: inputText });
  document.getElementById('settingsPanel').style.display = 'block';
  document.getElementById('chatPanel').style.display = 'none';
}

function showChatPanel() {
  const inputText = document.getElementById('messageInput').value;
  chrome.storage.local.set({ inputText: inputText });
  document.getElementById('settingsPanel').style.display = 'none';
  document.getElementById('chatPanel').style.display = 'flex';
}

function toggleSettings() {
  const sp = document.getElementById('settingsPanel');
  const cp = document.getElementById('chatPanel');
  if (sp.style.display === 'none') showSettingsPanel(); else showChatPanel();
}

function connect() {
  chrome.runtime.sendMessage({ type: 'connect' }, (response) => {
    if (response && response.success) updateConnectionStatus(true);
  });
}

function toggleConnection() {
  const btn = document.getElementById('connectionBtn');
  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    const actuallyConnected = response && response.connected;
    if (actuallyConnected) {
      chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
        isConnected = false;
        updateConnectionStatus(false);
        btn.title = t('connect');
        btn.textContent = '🔗';
        showToast(t('disconnectedMsg'));
      });
    } else {
      btn.title = t('disconnect');
      btn.textContent = '🔌';
      showToast('Connecting...');
      chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
        setTimeout(() => {
          ensureAuthenticated().then((ok) => {
            if (ok) {
              chrome.runtime.sendMessage({ type: 'connect' }, () => {
                let attempts = 0;
                const checkConnect = setInterval(() => {
                  attempts++;
                  chrome.runtime.sendMessage({ type: 'get_status' }, (sr) => {
                    if (sr && sr.connected) {
                      clearInterval(checkConnect);
                      isConnected = true;
                      updateConnectionStatus(true);
                      btn.title = t('disconnect');
                      btn.textContent = '🔌';
                      showToast(t('connectionSuccess'));
                      if (currentSessionId) loadSessionHistory(currentSessionId);
                    } else if (attempts >= 20) {
                      clearInterval(checkConnect);
                      showToast(t('connectionFailed'));
                    }
                  });
                }, 500);
              });
            } else {
              showToast('登录失败');
            }
          });
        }, 1000);
      });
    }
  });
}

function testConnection() {
  const host = document.getElementById('serverUrl').value.trim();
  const wsPort = document.getElementById('wsPort').value.trim() || '18800';
  const tokenProxyPort = document.getElementById('tokenProxyPort').value.trim() || '18801';
  const password = document.getElementById('dashToken').value.trim();
  if (!host || !password) { showToast('请填写服务器地址和密码'); return; }
  showToast(t('testing'));
  const testSettings = { serverUrl: host, wsPort, tokenProxyPort, password, authCookie: '' };
  chrome.storage.local.set({ picoclawSettings: testSettings }, () => {
    settings = testSettings;
    chrome.runtime.sendMessage({ type: 'disconnect' }, () => {
      setTimeout(() => {
        ensureAuthenticated().then((ok) => {
          if (!ok) { showToast('登录失败'); return; }
          chrome.runtime.sendMessage({ type: 'connect' }, () => {
            let attempts = 0;
            const checkConnection = setInterval(() => {
              attempts++;
              chrome.runtime.sendMessage({ type: 'get_status' }, (sr) => {
                if (sr && sr.connected) {
                  clearInterval(checkConnection);
                  isConnected = true;
                  updateConnectionStatus(true);
                  showToast(t('connectionSuccess'));
                } else if (attempts >= 20) {
                  clearInterval(checkConnection);
                  showToast(t('connectionFailed'));
                }
              });
            }, 500);
          });
        });
      }, 1000);
    });
  });
}

function updateConnectionStatus(connected) {
  const header = document.getElementById('chatHeader');
  const btn = document.getElementById('connectionBtn');
  header.classList.remove('connected', 'disconnected');
  header.classList.add(connected ? 'connected' : 'disconnected');
  const title = document.getElementById('headerTitle');
  title.textContent = connected ? t('connected') : t('disconnected');
  btn.title = connected ? t('disconnect') : t('connect');
  btn.textContent = connected ? '🔌' : '🔗';
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content && attachedImages.length === 0) return;

  chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
    if (!response || !response.connected) {
      isConnected = false;
      updateConnectionStatus(false);
      showToast(t('notConnected'));
      return;
    }
    isConnected = true;
    updateConnectionStatus(true);

    const imagesToSend = attachedImages.slice();
    input.value = '';
    attachedImages = [];
    renderImagePreview();
    chrome.storage.local.set({ 
      inputText: '',
      picoclawAttachedImages: []
    });

    addImageMessagesToUI(imagesToSend, 'user');
    addMessageToUI(content, 'user');
    showWaitingIndicator();

    chrome.runtime.sendMessage({ type: 'send', content, images: imagesToSend }, (response) => {
      if (!response || !response.success) {
        removeWaitingIndicator();
        addMessageToUI(t('sendingFailed'), 'error');
      }
    });
  });
}

function addImageMessagesToUI(images, role) {
  const container = document.getElementById('chatMessages');
  images.forEach(img => {
    const div = document.createElement('div');
    div.className = `message ${role}-message image-message`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    const imgEl = document.createElement('img');
    imgEl.src = img.data;
    imgEl.className = 'message-image';
    imgEl.addEventListener('click', () => viewImage(img.data, img.name));
    contentDiv.appendChild(imgEl);
    div.appendChild(contentDiv);
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

function showWaitingIndicator() {
  removeWaitingIndicator();
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const waitEl = document.createElement('div');
  waitEl.id = 'waitingIndicator';
  waitEl.className = 'message bot-message waiting-message';
  waitEl.innerHTML = `<div class="waiting-indicator">${t('waiting')}</div>`;
  container.appendChild(waitEl);
  container.scrollTop = container.scrollHeight;
  chrome.storage.local.set({ picoclawWaiting: true });
  typingTimeout = setTimeout(() => {
    removeWaitingIndicator();
  }, 180000);
}

function removeWaitingIndicator() {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
  const indicator = document.getElementById('waitingIndicator');
  if (indicator) indicator.remove();
  chrome.storage.local.set({ picoclawWaiting: false });
}

function handleBotMessage(msg) {
  const content = msg.payload?.content || '';
  const media = msg.payload?.media || [];
  removeWaitingIndicator();

  if (media.length > 0) {
    media.forEach(mediaUrl => {
      if (typeof mediaUrl === 'string' && mediaUrl.startsWith('data:image/')) {
        addImageFromBot(mediaUrl);
      }
    });
  }

  if (content) addMessageToUI(content, 'bot');
}

function addImageFromBot(dataUrl) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message bot-message image-message';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  const imgEl = document.createElement('img');
  imgEl.src = dataUrl;
  imgEl.className = 'message-image';
  imgEl.addEventListener('click', () => viewImage(dataUrl, 'image'));
  contentDiv.appendChild(imgEl);
  div.appendChild(contentDiv);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function handleMessageUpdate(msg) {
  const messageId = msg.payload?.message_id;
  const content = msg.payload?.content;
  if (messageId && content) {
    const messages = document.querySelectorAll('.message.bot-message');
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgEl = messages[i];
      if (msgEl.dataset.messageId === messageId) {
        msgEl.querySelector('.message-content').innerHTML = renderMarkdown(parseFileContent(content));
        return;
      }
    }
  }
}

function addMessageToUI(content, role) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}-message`;
  const parsed = parseFileContent(content);
  if (role === 'bot') {
    div.innerHTML = `<div class="message-content">${renderMarkdown(parsed)}</div>`;
  } else {
    div.innerHTML = `<div class="message-content"><p>${escapeHtml(parsed)}</p></div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  }
  return `<p>${escapeHtml(text)}</p>`;
}

function setupLinkHandler() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.addEventListener('click', (e) => {
    let link = e.target;
    while (link && link.tagName !== 'A') {
      link = link.parentElement;
    }
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({ url: link.href });
    }
  });
}

function parseFileContent(content) {
  const fileRegex = /\[FILE:([^:]+):([^:]+):([^\]]+)\]/g;
  return content.replace(fileRegex, (match, filename, mimetype, base64) => {
    const decodedFilename = decodeURIComponent(filename);
    const isImage = mimetype.startsWith('image/');
    const dataUrl = `data:${mimetype};base64,${base64}`;
    if (isImage) {
      return `<div class="file-attachment image-attachment">
        <img src="${dataUrl}" alt="${escapeHtml(decodedFilename)}" class="message-image" onclick="viewImage('${dataUrl}', '${escapeHtml(decodedFilename)}')">
        <div class="image-overlay" onclick="viewImage('${dataUrl}', '${escapeHtml(decodedFilename)}')">
          <span class="image-name">${escapeHtml(decodedFilename)}</span>
        </div>
      </div>`;
    }
    return `<div class="file-attachment" data-filename="${escapeHtml(decodedFilename)}" data-mimetype="${escapeHtml(mimetype)}" data-content="${base64}">
      <span class="file-icon">📎</span>
      <span class="file-name">${escapeHtml(decodedFilename)}</span>
      <span class="file-download" onclick="downloadFile('${escapeHtml(decodedFilename)}', '${escapeHtml(mimetype)}', '${base64}')">下载</span>
    </div>`;
  });
}

function viewImage(dataUrl, filename) {
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  overlay.innerHTML = `<div class="image-viewer-content">
    <img src="${dataUrl}" alt="${filename}">
    <button class="image-viewer-close" onclick="this.parentElement.parentElement.remove()">✕</button>
  </div>`;
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function downloadFile(filename, mimetype, base64Content) {
  try {
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (e) { showToast('文件下载失败'); }
}

function showTypingIndicator() {
  removeTypingIndicator();
  const container = document.getElementById('chatMessages');
  const indicator = document.createElement('div');
  indicator.className = 'message bot-message typing-message';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function handleImageSelect(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const maxImages = 5;
  if (attachedImages.length + files.length > maxImages) {
    showToast(`最多只能上傳 ${maxImages} 張圖片`);
    imageInput.value = '';
    return;
  }

  const processFile = (file, index) => {
    if (!file.type.startsWith('image/')) {
      showToast('僅支援圖片格式（PNG/JPG/GIF/WebP）');
      return;
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast(`圖片 ${file.name} 超過 20MB 限制`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      attachedImages.push({
        name: file.name,
        type: file.type,
        data: reader.result
      });
      saveAttachedImages();
      renderImagePreview();

      if (index < files.length - 1) {
        processFile(files[index + 1], index + 1);
      }
    };
    reader.readAsDataURL(file);
  };

  attachedImages = [];
  processFile(files[0], 0);
  imageInput.value = '';
}

function saveAttachedImages() {
  chrome.storage.local.set({ picoclawAttachedImages: attachedImages });
}

function renderImagePreview() {
  const area = document.getElementById('imagePreviewArea');
  const list = document.getElementById('imagePreviewList');
  if (!area || !list) return;

  if (attachedImages.length === 0) {
    area.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  area.style.display = 'flex';
  list.innerHTML = '';

  attachedImages.forEach((img, idx) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    const imgEl = document.createElement('img');
    imgEl.src = img.data;
    imgEl.alt = img.name;
    const btn = document.createElement('button');
    btn.className = 'image-remove-btn';
    btn.textContent = '✕';
    btn.dataset.index = idx;
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.index, 10);
      attachedImages.splice(i, 1);
      renderImagePreview();
      saveAttachedImages();
    });
    div.appendChild(imgEl);
    div.appendChild(btn);
    list.appendChild(div);
  });
}

function removeAttachedImage(index) {
  attachedImages.splice(index, 1);
  renderImagePreview();
  saveAttachedImages();
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ============ API Helpers ============

function getApiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.authCookie) {
    headers['X-Auth-Cookie'] = settings.authCookie;
  }
  return headers;
}

function getApiBaseUrl() {
  if (!settings.serverUrl) return '';
  let host = settings.serverUrl;
  if (host.startsWith('http://')) host = host.substring(7);
  else if (host.startsWith('https://')) host = host.substring(8);
  const portIdx = host.indexOf(':');
  if (portIdx > 0) host = host.substring(0, portIdx);
  return `http://${host}:${settings.tokenProxyPort || '18801'}`;
}

function showDebugInfo() {
  const info = [
    `${t('serverAddress')} ${settings.serverUrl || t('notConnected')}`,
    `WS Port: ${settings.wsPort || '18800'}`,
    `Token Port: ${settings.tokenProxyPort || '18801'}`,
    `Password: ${settings.password ? settings.password.substring(0, 6) + '...' : t('notConnected')}`,
    `Cookie: ${settings.authCookie ? settings.authCookie.substring(0, 8) + '...' : '—'}`,
    `Session: ${currentSessionId ? currentSessionId.substring(0, 8) + '...' : '—'}`,
    `Status: ${isConnected ? t('connected') : t('disconnected')}`,
  ];
  alert(info.join('\n'));
}

// ============ Model Management ============

function toggleModelMenu() {
  if (modelMenuOpen) closeModelMenu(); else openModelMenu();
}

function openModelMenu() {
  modelMenuOpen = true;
  document.getElementById('modelMenu').style.display = 'flex';
  loadModelList();
}

function closeModelMenu() {
  modelMenuOpen = false;
  document.getElementById('modelMenu').style.display = 'none';
}

async function loadModelList() {
  const listEl = document.getElementById('modelList');
  const baseUrl = getApiBaseUrl();
  listEl.innerHTML = `<div class="model-loading">加载中...</div>`;

  if (!baseUrl) {
    listEl.innerHTML = '<div class="model-empty">未配置服务器</div>';
    return;
  }

  let resp;
  try {
    resp = await fetch(`${baseUrl}/api/models`, { headers: getApiHeaders() });
  } catch (e) {
    listEl.innerHTML = '<div class="model-empty">无法连接服务器</div>';
    return;
  }

  if (!resp.ok) {
    listEl.innerHTML = `<div class="model-empty">HTTP ${resp.status}</div>`;
    return;
  }

  const data = await resp.json();
  const models = data.models || [];

  // Show models that are either enabled or available (not disabled/unavailable)
  const filtered = models.filter(m => m.enabled || m.available);

  const seen = new Set();
  const unique = filtered.filter(m => {
    if (seen.has(m.model_name)) return false;
    seen.add(m.model_name);
    return true;
  });

  if (unique.length === 0) {
    listEl.innerHTML = '<div class="model-empty">暂无可用模型</div>';
    return;
  }

  listEl.innerHTML = '';
  unique.forEach(m => {
    const item = document.createElement('div');
    item.className = `model-item${m.is_default ? ' active' : ''}`;
    item.innerHTML = `
      <div class="model-item-info">
        <div class="model-item-name">${escapeHtml(m.model_name || m.model)}</div>
        <div class="model-item-detail">${escapeHtml(m.model)}${m.is_default ? ' ✓ 默认' : ''}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      if (!m.is_default) setDefaultModel(m.model_name);
      closeModelMenu();
    });
    listEl.appendChild(item);
  });
}

async function setDefaultModel(modelName) {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;

    const resp = await fetch(`${baseUrl}/api/models/default`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ model_name: modelName }),
    });

    if (!resp.ok) {
      showToast('切换失败');
      return;
    }

    showToast('正在重启服务...');
    updateModelButtonLabel(modelName);

    await fetch(`${baseUrl}/api/gateway/restart`, { method: 'POST', headers: getApiHeaders() });

    setTimeout(() => showToast(`已切换模型: ${modelName}`), 2000);
  } catch (e) {
    showToast('切换失败');
  }
}

function updateModelButtonLabel(modelName) {
  const btn = document.getElementById('modelBtn');
  if (!btn) return;
  if (modelName) {
    const short = modelName.length > 12 ? modelName.substring(0, 12) + '…' : modelName;
    btn.title = t('currentModel', { model: modelName });
    btn.textContent = `🤖 ${short}`;
    chrome.storage.local.set({ picoclawCurrentModel: modelName });
  } else {
    btn.title = t('modelSwitch');
    btn.textContent = '🤖';
    chrome.storage.local.set({ picoclawCurrentModel: null });
  }
}

async function loadCurrentModel() {
  try {
    chrome.storage.local.get(['picoclawCurrentModel'], (result) => {
      if (result.picoclawCurrentModel) {
        updateModelButtonLabel(result.picoclawCurrentModel);
        return;
      }
    });
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;
    const resp = await fetch(`${baseUrl}/api/models`, { headers: getApiHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    const models = (data.models || []).filter(m => m.enabled || m.available);
    const defaultModel = models.find(m => m.is_default);
    if (defaultModel) {
      chrome.storage.local.set({ picoclawCurrentModel: defaultModel.model_name });
      updateModelButtonLabel(defaultModel.model_name);
    }
  } catch (e) {}
}

// ============ Session Management ============

function updateSessionButtonLabel() {
  const btn = document.getElementById('sessionBtn');
  if (!btn) return;
  if (currentSessionId) {
    const short = currentSessionId.substring(0, 8);
    btn.title = `${t('sessionManage')}: ${short}...`;
  } else {
    btn.title = t('sessionManage');
  }
}

function toggleSessionMenu() {
  if (sessionMenuOpen) closeSessionMenu(); else openSessionMenu();
}

function openSessionMenu() {
  sessionMenuOpen = true;
  document.getElementById('sessionMenu').style.display = 'flex';
  loadSessionList();
}

function closeSessionMenu() {
  sessionMenuOpen = false;
  document.getElementById('sessionMenu').style.display = 'none';
}

async function loadSessionList() {
  const listEl = document.getElementById('sessionList');
  const baseUrl = getApiBaseUrl();
  listEl.innerHTML = `<div class="session-loading">加载中...<br><small style="color:#666">${escapeHtml(baseUrl || '未配置')}</small></div>`;

  if (!baseUrl) {
    listEl.innerHTML = '<div class="session-empty">未配置服务器</div>';
    return;
  }

  const url = `${baseUrl}/api/sessions?limit=50`;

  let resp;
  try {
    resp = await fetch(url, { headers: getApiHeaders() });
  } catch (fetchErr) {
    listEl.innerHTML = `<div class="session-empty">无法连接服务器<br><small>${escapeHtml(fetchErr.message)}</small></div>`;
    return;
  }

  if (!resp.ok) {
    listEl.innerHTML = `<div class="session-empty">无法获取对话列表<br><small>HTTP ${resp.status}<br>${escapeHtml(url)}</small></div>`;
    return;
  }

  const sessions = await resp.json();
  if (!sessions || sessions.length === 0) {
    listEl.innerHTML = '<div class="session-empty">暂无对话记录</div>';
    return;
  }

  listEl.innerHTML = '';
  sessions.forEach(sess => {
    const item = document.createElement('div');
    item.className = `session-item${sess.id === currentSessionId ? ' active' : ''}`;

    const title = sess.title || sess.preview || `对话 ${sess.id.substring(0, 8)}`;
    const time = formatTime(sess.updated);
    const msgCount = sess.message_count || 0;

    item.innerHTML = `
      <div class="session-item-info">
        <div class="session-item-title">${escapeHtml(title)}</div>
        <div class="session-item-meta">
          <span>${time}</span>
          <span>${msgCount} 条消息</span>
        </div>
      </div>
      <button class="session-item-delete" title="删除此对话">🗑️</button>
    `;

    item.querySelector('.session-item-info').addEventListener('click', () => {
      switchToSession(sess.id);
    });

    item.querySelector('.session-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(sess.id, title);
    });

    listEl.appendChild(item);
  });
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  let date;
  if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'number') {
    date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
  } else {
    return '';
  }
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-TW');
}

function createNewSession() {
  const newId = crypto.randomUUID ? crypto.randomUUID() : generateFallbackUuid();
  currentSessionId = newId;
  chrome.storage.local.set({ picoclawSessionId: newId });

  clearChatUI();
  updateSessionButtonLabel();
  closeSessionMenu();

  chrome.runtime.sendMessage({ type: 'reconnect_with_session', sessionId: newId });
  showToast('已创建新对话');
}

function generateFallbackUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function switchToSession(sessionId) {
  if (sessionId === currentSessionId) { closeSessionMenu(); return; }

  currentSessionId = sessionId;
  chrome.storage.local.set({ picoclawSessionId: sessionId });

  clearChatUI();
  updateSessionButtonLabel();
  closeSessionMenu();

  chrome.runtime.sendMessage({ type: 'reconnect_with_session', sessionId });

  if (isConnected) {
    loadSessionHistory(sessionId);
  }
}

function deleteSession(sessionId, title) {
  if (!confirm(`确定要删除对话「${title}」吗？\n此操作不可恢复！`)) return;
  if (!confirm(`再次确认：真的要永久删除「${title}」？\n服务器端的数据也会被删除！`)) return;
  deleteSessionOnServer(sessionId, title);
}

async function deleteSessionOnServer(sessionId, title) {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) { showToast('未配置服务器地址'); return; }

    const resp = await fetch(`${baseUrl}/api/sessions/${sessionId}`, { method: 'DELETE', headers: getApiHeaders() });

    if (resp.ok || resp.status === 204) {
      showToast(`已删除对话「${title}」`);
      if (currentSessionId === sessionId) {
        currentSessionId = null;
        chrome.storage.local.set({ picoclawSessionId: null });
        clearChatUI();
        updateSessionButtonLabel();
      }
      loadSessionList();
    } else {
      showToast('删除失败');
    }
  } catch (e) {
    console.error('[PicoClaw] Failed to delete session:', e);
    showToast('删除失败');
  }
}

async function loadSessionHistory(sessionId) {
  if (!sessionId) return;

  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;

    const resp = await fetch(`${baseUrl}/api/sessions/${sessionId}`, { headers: getApiHeaders() });
    if (!resp.ok) return;

    const session = await resp.json();
    const messages = session.messages || session.history || [];

    clearChatUI();

    messages.forEach(msg => {
      let role = msg.role;
      if (role === 'assistant') role = 'bot';
      const content = msg.content || '';
      const media = msg.media || [];

      if (media.length > 0) {
        media.forEach(mediaUrl => {
          if (typeof mediaUrl === 'string' && (mediaUrl.startsWith('data:') || mediaUrl.startsWith('http'))) {
            if (role === 'bot') {
              addImageFromBot(mediaUrl);
            } else {
              addImageMessagesToUI([{ data: mediaUrl, name: 'image' }], role);
            }
          }
        });
      }

      if (content) addMessageToUI(content, role);
    });
  } catch (e) {
    console.error('[PicoClaw] Failed to load session history:', e);
  }
}

function clearChatUI() {
  document.getElementById('chatMessages').innerHTML = '';
}
