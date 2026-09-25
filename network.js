/* =========================================================
   network.js — PeerJS 联机封装
   ---------------------------------------------------------
   · 主机：用房间号作为 Peer ID，等待客机连接
   · 客机：用随机 Peer ID，连接到主机
   · 消息通过 DataChannel 双向传输
   ========================================================= */

let _peer = null;
let _conn = null;
let _isHost = false;
let _roomCode = '';
let _netCallbacks = {
  onMessage: null,
  onClose: null,
  onError: null,
  onConnected: null
};

function onNetMessage(fn) { _netCallbacks.onMessage = fn; }
function onNetClose(fn)   { _netCallbacks.onClose = fn; }
function onNetError(fn)   { _netCallbacks.onError = fn; }
function onNetConnected(fn) { _netCallbacks.onConnected = fn; }

/* ---------- 工具 ---------- */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 排除易混字符 I O 0 1 */
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function netRoomToPeerId(code) {
  return 'wv-' + String(code).toUpperCase();
}

/* ---------- 主机 ---------- */
function netCreateRoom(onReady, onError) {
  netDestroy();
  _isHost = true;
  _roomCode = generateRoomCode();

  if (typeof Peer === 'undefined') {
    console.error('[net] PeerJS 未加载');
    onError && onError(new Error('PeerJS 未加载'));
    return;
  }

  _peer = new Peer(netRoomToPeerId(_roomCode), { debug: 1 });

  _peer.on('open', id => {
    console.log('[net] 主机已就绪，房间号：', _roomCode, 'Peer ID:', id);
    onReady && onReady(_roomCode);
  });

  _peer.on('connection', conn => {
    if (_conn && _conn.open) {
      /* 已有客机连接，拒绝新连接 */
      try { conn.close(); } catch (e) {}
      return;
    }
    _conn = conn;
    _setupConn();
    console.log('[net] 客机已连接');
    _netCallbacks.onConnected && _netCallbacks.onConnected('host');
  });

  _peer.on('error', err => {
    console.error('[net] 主机错误', err);
    onError && onError(err);
  });

  _peer.on('disconnected', () => {
    console.warn('[net] 与信令服务器断开，尝试重连…');
    try { _peer.reconnect(); } catch (e) {}
  });
}

/* ---------- 客机 ---------- */
function netJoinRoom(code, onOpen, onError) {
  netDestroy();
  _isHost = false;
  _roomCode = String(code).toUpperCase();

  if (typeof Peer === 'undefined') {
    console.error('[net] PeerJS 未加载');
    onError && onError(new Error('PeerJS 未加载'));
    return;
  }

  _peer = new Peer({ debug: 1 });

  _peer.on('open', () => {
    console.log('[net] 客机已就绪，连接主机：', _roomCode);
    _conn = _peer.connect(netRoomToPeerId(_roomCode), { reliable: true });
    _setupConn();
  });

  _peer.on('error', err => {
    console.error('[net] 客机错误', err);
    onError && onError(err);
  });

  _peer.on('disconnected', () => {
    console.warn('[net] 与信令服务器断开，尝试重连…');
    try { _peer.reconnect(); } catch (e) {}
  });
}

/* ---------- 连接设置 ---------- */
function _setupConn() {
  if (!_conn) return;
  _conn.on('open', () => {
    console.log('[net] DataChannel 已打开');
    _netCallbacks.onConnected && _netCallbacks.onConnected(_isHost ? 'host' : 'guest');
  });
  _conn.on('data', data => {
    _netCallbacks.onMessage && _netCallbacks.onMessage(data);
  });
  _conn.on('close', () => {
    console.log('[net] DataChannel 关闭');
    _conn = null;
    _netCallbacks.onClose && _netCallbacks.onClose();
  });
  _conn.on('error', err => {
    console.error('[net] DataChannel 错误', err);
    _netCallbacks.onError && _netCallbacks.onError(err);
  });
}

/* ---------- 发送 / 销毁 ---------- */
function netSend(data) {
  if (!_conn || !_conn.open) return false;
  try {
    _conn.send(data);
    return true;
  } catch (e) {
    console.error('[net] 发送失败', e);
    return false;
  }
}

function netIsConnected() {
  return !!(_conn && _conn.open);
}

function netIsHost() { return _isHost; }
function netGetRoomCode() { return _roomCode; }

function netDestroy() {
  try { if (_conn) _conn.close(); } catch (e) {}
  try { if (_peer) _peer.destroy(); } catch (e) {}
  _conn = null;
  _peer = null;
}