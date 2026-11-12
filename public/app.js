const socket = io();

const statusEl    = document.getElementById('status');
const messagesEl  = document.getElementById('messages');
const form        = document.getElementById('chat-form');
const input       = document.getElementById('msg-input');
const sendBtn     = document.getElementById('send-btn');
const nextBtn     = document.getElementById('next-btn');
const reportBtn   = document.getElementById('report-btn');
const onlineCount = document.getElementById('online-count');

function setStatus(text, state) {
  statusEl.textContent = text;
  statusEl.className = state || '';
}

function setInputEnabled(enabled) {
  input.disabled  = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) input.focus();
}

function clearMessages() {
  messagesEl.innerHTML = '';
}

function addMessage(text, type = 'system') {
  const div = document.createElement('div');
  div.classList.add('msg', type);
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

socket.on('connect', () => {
  setStatus('Đang tìm người lạ...', '');
  setInputEnabled(false);
  addMessage('Đã kết nối server. Đang tìm người lạ...');
});

socket.on('matched', (data) => {
  clearMessages();
  setStatus('Đang trò chuyện với người lạ', 'connected');
  setInputEnabled(true);
  addMessage(data.message);
});

socket.on('chat-message', (msg) => {
  addMessage(msg, 'them');
});

socket.on('partner-left', (data) => {
  setStatus('Người lạ đã rời đi', 'disconnected');
  setInputEnabled(false);
  addMessage(data.message);
});

socket.on('waiting', (data) => {
  clearMessages();
  setStatus('Đang tìm người lạ...', '');
  setInputEnabled(false);
  addMessage(data.message);
});

socket.on('error-msg', (data) => {
  addMessage(data.message, 'error');
});

socket.on('report-ack', (data) => {
  addMessage(data.message);
});

socket.on('online-count', (count) => {
  onlineCount.textContent = `👥 ${count}`;
});

socket.on('disconnect', () => {
  setStatus('Mất kết nối server', 'disconnected');
  setInputEnabled(false);
  addMessage('Mất kết nối. Đang thử kết nối lại...');
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit('chat-message', msg);
  addMessage(msg, 'me');
  input.value = '';
  input.focus();
});

nextBtn.addEventListener('click', () => {
  socket.emit('next');
});

reportBtn.addEventListener('click', () => {
  socket.emit('report');
});
