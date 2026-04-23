const i18n = {
  'zh-CN': {
    appName: 'PicoClaw 聊天',
    settingsTitle: 'PicoClaw 设置',
    settings: '设置',
    langSwitch: 'English',
    serverAddress: '服务器地址:',
    wsPort: 'WS端口:',
    tokenProxyPort: 'Token代理端口:',
    token: '认证 Token:',
    saveSettings: '保存设置',
    testConnection: '测试连接',
    connect: '连接',
    disconnect: '断开连接',
    send: '发送',
    placeholder: '输入消息...',
    connected: 'PicoClaw 已连接',
    disconnected: 'PicoClaw 未连接',
    welcome: '你好！我是 PicoClaw 助手。请先配置服务器地址和 Token 开始聊天！',
    chatCleared: '聊天已清空，开始新对话吧！',
    connectionSuccess: '连接成功！',
    connectionFailed: '连接失败，请检查设置',
    testing: '正在测试连接...',
    saving: '设置已保存！',
    disconnectedMsg: '已断开连接',
    notConnected: '未连接服务器',
    sendingFailed: '发送失败，请重试',
    fileTooBig: '文件大小不能超过 5MB',
    fileReadError: '文件读取失败',
    fileSent: '文件已发送',
    fileSendFailed: '文件发送失败',
    chatDeleted: '聊天记录已删除',
    confirmDelete: '确定要删除所有聊天记录吗？',
    pleaseEnterServer: '请输入服务器地址',
    pleaseEnterToken: '请输入认证 Token',
    pleaseFillAll: '请填写服务器地址和 Token',
    newSession: '新对话',
    sessionManage: '对话管理',
    loading: '加载中...',
    noSessions: '暂无对话记录',
    noServer: '未配置服务器',
    fetchFailed: '无法获取对话列表',
    connectFailed: '无法连接服务器',
    deleteConfirm1: '确定要删除对话「{title}」吗？\n此操作不可恢复！',
    deleteConfirm2: '再次确认：真的要永久删除「{title}」？\n服务器端的数据也会被删除！',
    sessionDeleted: '已删除对话「{title}」',
    deleteFailed: '删除失败',
    sessionCreated: '已创建新对话',
    noServerConfig: '未配置服务器地址',
    modelSwitch: '切换模型',
    currentModel: '当前模型: {model}',
    modelSwitched: '已切换模型: {model}',
    modelSwitchFailed: '切换失败',
    noModels: '暂无模型',
    waiting: '等待回复中...',
    debugInfo: '除错资讯'
  },
  'en': {
    appName: 'PicoClaw Chat',
    settingsTitle: 'PicoClaw Settings',
    settings: 'Settings',
    langSwitch: '中文',
    serverAddress: 'Server Address:',
    wsPort: 'WS Port:',
    tokenProxyPort: 'Token Proxy Port:',
    token: 'Auth Token:',
    saveSettings: 'Save Settings',
    testConnection: 'Test Connection',
    debugInfo: 'Debug Info',
    connect: 'Connect',
    disconnect: 'Disconnect',
    send: 'Send',
    placeholder: 'Type a message...',
    connected: 'PicoClaw Connected',
    disconnected: 'PicoClaw Disconnected',
    welcome: 'Hello! I am PicoClaw assistant. Please configure server address and Token to start chatting!',
    chatCleared: 'Chat cleared, start a new conversation!',
    connectionSuccess: 'Connection successful!',
    connectionFailed: 'Connection failed, please check settings',
    testing: 'Testing connection...',
    saving: 'Settings saved!',
    disconnectedMsg: 'Disconnected',
    notConnected: 'Not connected to server',
    sendingFailed: 'Send failed, please retry',
    fileTooBig: 'File size cannot exceed 5MB',
    fileReadError: 'File read error',
    fileSent: 'File sent',
    fileSendFailed: 'File send failed',
    chatDeleted: 'Chat history deleted',
    confirmDelete: 'Are you sure you want to delete all chat history?',
    pleaseEnterServer: 'Please enter server address',
    pleaseEnterToken: 'Please enter auth Token',
    pleaseFillAll: 'Please fill in server address and Token',
    newSession: 'New Chat',
    sessionManage: 'Session Manager',
    loading: 'Loading...',
    noSessions: 'No conversations yet',
    noServer: 'Server not configured',
    fetchFailed: 'Failed to fetch conversations',
    connectFailed: 'Cannot connect to server',
    deleteConfirm1: 'Delete conversation "{title}"?\nThis cannot be undone!',
    deleteConfirm2: 'Confirm again: permanently delete "{title}"?\nServer data will also be deleted!',
    sessionDeleted: 'Deleted conversation "{title}"',
    deleteFailed: 'Delete failed',
    sessionCreated: 'New chat created',
    noServerConfig: 'Server not configured',
    modelSwitch: 'Switch Model',
    currentModel: 'Current model: {model}',
    modelSwitched: 'Switched to: {model}',
    modelSwitchFailed: 'Switch failed',
    noModels: 'No models',
    waiting: 'Waiting for reply...',
    debugInfo: 'Debug Info'
  }
};

let currentLang = 'en';

function detectSystemLanguage() {
  const lang = navigator.language || navigator.userLanguage || 'en';
  if (lang.startsWith('zh') && !lang.startsWith('zh-TW') && !lang.startsWith('zh-HK')) return 'zh-CN';
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK')) return 'zh-CN';
  return 'en';
}

function t(key, params) {
  let str = i18n[currentLang]?.[key] || i18n['en']?.[key] || key;
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.replace(`{${k}}`, params[k]);
    });
  }
  return str;
}

function setLanguage(lang) {
  currentLang = lang;
  chrome.storage.local.set({ picoclawLang: lang });
  updateUIText();
}

function getCurrentLangFlag() {
  return currentLang === 'zh-CN' ? 'EN' : '中文';
}

function updateUIText() {
  document.title = t('appName');
  const settingsTitle = document.getElementById('settingsTitle');
  if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
  document.getElementById('headerTitle').textContent = isConnected ? t('connected') : t('disconnected');
  
  const serverLabel = document.querySelector('label[for="serverUrl"]');
  if (serverLabel) serverLabel.textContent = t('serverAddress');
  
  const wsPortLabel = document.querySelector('label[for="wsPort"]');
  if (wsPortLabel) wsPortLabel.textContent = t('wsPort');
  
  const tokenProxyPortLabel = document.querySelector('label[for="tokenProxyPort"]');
  if (tokenProxyPortLabel) tokenProxyPortLabel.textContent = t('tokenProxyPort');
  
  const tokenLabel = document.querySelector('label[for="dashToken"]');
  if (tokenLabel) tokenLabel.textContent = t('token');
  
  const saveSettingsBtn = document.getElementById('saveSettings');
  if (saveSettingsBtn) saveSettingsBtn.textContent = t('saveSettings');
  const testConnectionBtn = document.getElementById('testConnection');
  if (testConnectionBtn) testConnectionBtn.textContent = t('testConnection');
  const msgInput = document.getElementById('messageInput');
  if (msgInput) msgInput.placeholder = t('placeholder');
  const sendBtn = document.getElementById('sendMessage');
  if (sendBtn) sendBtn.textContent = t('send');
  const debugInfoText = document.getElementById('debugInfoText');
  if (debugInfoText) debugInfoText.textContent = t('debugInfo');
  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.textContent = getCurrentLangFlag();
    langBtn.title = t('langSwitch');
  }
  const newSessBtn = document.getElementById('newSessionBtn');
  if (newSessBtn) newSessBtn.innerHTML = `<span class="action-icon">＋</span> ${t('newSession')}`;
  const sessBtn = document.getElementById('sessionBtn');
  const toggleSettingsLabel = document.getElementById('toggleSettings');
  if (toggleSettingsLabel) toggleSettingsLabel.title = t('settings');
  if (sessBtn && !currentSessionId) sessBtn.title = t('sessionManage');
  if (sessBtn && !currentSessionId) sessBtn.title = t('sessionManage');
  
  const welcomeMsg = document.querySelector('.message.bot-message .message-content p');
  if (welcomeMsg) {
    welcomeMsg.textContent = t('welcome');
  }
}

function cycleLanguage() {
  const langs = ['zh-CN', 'en'];
  const currentIndex = langs.indexOf(currentLang);
  const nextIndex = (currentIndex + 1) % langs.length;
  setLanguage(langs[nextIndex]);
}
