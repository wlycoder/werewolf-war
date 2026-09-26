/* =========================================================
   network.js — PeerJS 联机封装 + 状态同步 + 事件驱动动画
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

function onNetMessage(fn)   { _netCallbacks.onMessage = fn; }
function onNetClose(fn)     { _netCallbacks.onClose = fn; }
function onNetError(fn)     { _netCallbacks.onError = fn; }
function onNetConnected(fn) { _netCallbacks.onConnected = fn; }

/* ---------- 工具 ---------- */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function netRoomToPeerId(code) {
  return 'wv4-' + String(code).toUpperCase();
}

/* ---------- 主机 ---------- */
function netCreateRoom(onReady, onError) {
  netDestroy();
  _isHost = true;
  _roomCode = generateRoomCode();

  if (typeof Peer === 'undefined') {
    onError && onError(new Error('PeerJS 未加载'));
    return;
  }

  _peer = new Peer(netRoomToPeerId(_roomCode), { debug: 1 });

  _peer.on('open', () => {
    console.log('[net] 主机已就绪，房间号：', _roomCode);
    onReady && onReady(_roomCode);
  });

  _peer.on('connection', conn => {
    if (_conn && _conn.open) { try { conn.close(); } catch (e) {} return; }
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
    try { _peer.reconnect(); } catch (e) {}
  });
}

/* ---------- 客机 ---------- */
function netJoinRoom(code, onOpen, onError) {
  netDestroy();
  _isHost = false;
  _roomCode = String(code).toUpperCase();

  if (typeof Peer === 'undefined') {
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
    try { _peer.reconnect(); } catch (e) {}
  });
}

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

function netSend(data) {
  if (!_conn || !_conn.open) return false;
  try { _conn.send(data); return true; }
  catch (e) { console.error('[net] 发送失败', e); return false; }
}
function netIsConnected() { return !!(_conn && _conn.open); }
function netIsHost() { return _isHost; }
function netGetRoomCode() { return _roomCode; }
function netDestroy() {
  try { if (_conn) _conn.close(); } catch (e) {}
  try { if (_peer) _peer.destroy(); } catch (e) {}
  _conn = null;
  _peer = null;
}

/* =========================================================
   ★ 状态广播 / 事件广播
   ========================================================= */

/* 主机：广播完整状态 */
function hostBroadcastState() {
  if (!_isHost || !netIsConnected()) return;
  if (!G || !G.net || G.net.mode !== 'host') return;
  netSend({ type: 'state', state: serializeG(G) });
}

/* 主机：广播动画事件（移动 / 攻击 / 特效） */
function hostEvent(ev) {
  if (!_isHost || !netIsConnected()) return;
  if (!G || !G.net || G.net.mode !== 'host') return;
  netSend({ type: 'event', event: ev });
}

/* 主机：处理客机的操作 */
async function hostHandleGuestAction(action) {
  if (!G || !G.net || G.net.mode !== 'host') return;
  if (G.gameOver) return;
  if (G.turn === G.mySide) return;
  const a = action;
  if (a.type === 'handClick') {
    await onHandClick(a.idx, G.turn);
  } else if (a.type === 'cellClick') {
    await onCellClick(a.r, a.c, G.turn);
  } else if (a.type === 'endTurn') {
    if (G.turn !== G.mySide) endTurn();
  }
  setTimeout(() => hostBroadcastState(), 250);
}

/* 客机：发送操作 */
function guestSendAction(action) {
  if (!G || !G.net || G.net.mode !== 'guest') return false;
  return netSend({ type: 'action', action });
}

/* 客机：待回放的事件队列 */
let _pendingEvents = [];
function guestQueueEvent(ev) {
  _pendingEvents.push(ev);
  if (_pendingEvents.length > 80) _pendingEvents.shift();
}

/* =========================================================
   ★ 客机：应用状态 + 回放动画
   ========================================================= */
let _lastGuestG = null;

function guestApplyState(state) {
  if (!G || !G.net || G.net.mode !== 'guest') return;

  const oldG = G;
  const events = _pendingEvents.slice();
  _pendingEvents = [];

  const newG = deserializeG(state, G.mySide, G.net);
  if (!newG) return;

  G = newG;
  _lastGuestG = JSON.parse(JSON.stringify(state));

  /* 先渲染到新状态 */
  render();

  /* 再异步回放动画 */
  playGuestAnims(oldG, events, newG).catch(err => console.error('[net] 动画回放异常', err));
}

/* 客机：播放动画（事件 + 状态差异） */
async function playGuestAnims(oldG, events, newG) {
  if (!G || G.gameOver) return;

  /* ① 事件队列（移动 / 攻击） */
  for (const ev of events) {
    if (!G || !G.units) break;
    if (ev.type === 'move') {
      const u = newG.units.find(x => x.uid === ev.uid);
      if (u) await playGuestMoveAnim(u, ev.fromR, ev.fromC, ev.toR, ev.toC);
    } else if (ev.type === 'attack') {
      const atk = newG.units.find(x => x.uid === ev.attackerUid);
      const tgt = newG.units.find(x => x.uid === ev.targetUid);
      if (atk && tgt) {
        if (ev.ranged) await playRangedAttackAnimation(atk, tgt);
        else await playAttackAnimation(atk, tgt);
      }
    } else if (ev.type === 'fx') {
      /* 可选：直接展示指定特效 */
      try {
        if (ev.name && typeof window[ev.name] === 'function') {
          window[ev.name].apply(null, ev.args || []);
        }
      } catch (e) { /* ignore */ }
    }
  }

  /* ② 状态差异（召唤 / 死亡 / 受伤） */
  playStateDiffAnims(oldG, newG);
}

/* 客机移动动画：单位当前在 toR/toC，先视觉移回 fromR/fromC，再动画回 toR/toC */
async function playGuestMoveAnim(unit, fromR, fromC, toR, toC) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const unitEl = boardEl.querySelector(`.unit[data-uid="${unit.uid}"]`);
  if (!unitEl) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[fromR * BOARD_COLS + fromC];
  const toCell   = cells[toR * BOARD_COLS + toC];
  if (!fromCell || !toCell) return;

  const dx = fromCell.offsetLeft - toCell.offsetLeft;
  const dy = fromCell.offsetTop  - toCell.offsetTop;

  unitEl.style.transition = 'none';
  unitEl.style.transform = `translate(${dx}px, ${dy}px)`;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  unitEl.style.transition = 'transform .42s cubic-bezier(.42,0,.58,1)';
  unitEl.style.transform = '';
  await sleep(450);
  unitEl.style.transition = '';
  unitEl.style.transform = '';
}

/* 客机：状态差异动画 */
function playStateDiffAnims(oldG, newG) {
  if (!oldG || !oldG.units || !newG || !newG.units) return;
  const oldUids = new Set(oldG.units.map(u => u.uid));
  const newUids = new Set(newG.units.map(u => u.uid));

  /* 新单位出现 → 召唤动画 */
  newG.units.forEach(u => {
    if (!oldUids.has(u.uid) && !u.isBase) {
      const boardEl = $('#board');
      if (boardEl) {
        const el = boardEl.querySelector(`.unit[data-uid="${u.uid}"]`);
        if (el) {
          el.classList.add('summoning');
          setTimeout(() => el.classList.remove('summoning'), 600);
        }
      }
    }
  });

  /* 单位消失 → 骷髅 */
  oldG.units.forEach(u => {
    if (!newUids.has(u.uid) && !u.isBase) {
      showSkullAt(u.r, u.c);
    }
  });

  /* 防御减少 → 受击闪烁 */
  newG.units.forEach(u => {
    const old = oldG.units.find(x => x.uid === u.uid);
    if (old && old.def > u.def) {
      flashUnitDamage(u.uid);
    }
  });
}