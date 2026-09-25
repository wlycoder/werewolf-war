/* =========================================================
   storage.js — 卡组本地存取（安全版，支持 iPadOS）
   使用 safeStorage 封装：localStorage 失败时回退到内存
   ========================================================= */
const LS_DECKS = 'wc_decks_v7';
const LS_ACTIVE = 'wc_active_deck_v7';
const LS_BG = 'wc_bg_settings_v2';

/* ★ 内存兜底存储（当 localStorage 不可用时使用） */
const _memoryStore = {};

function storageAvailable() {
  try {
    const k = '__wc_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}
const _hasLS = storageAvailable();
console.log('[storage] localStorage ' + (_hasLS ? '可用' : '不可用，将使用内存兜底（刷新页面会丢失数据）'));

function safeGet(key) {
  if (_hasLS) {
    try { return localStorage.getItem(key); }
    catch (e) { console.warn('[storage] 读取失败:', key, e); }
  }
  return _memoryStore[key] || null;
}
function safeSet(key, value) {
  if (_hasLS) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[storage] 写入失败（可能配额已满）:', key, e);
    }
  }
  _memoryStore[key] = value;
  return false;
}
function safeRemove(key) {
  if (_hasLS) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  delete _memoryStore[key];
}

/* ---------- 卡组读写 ---------- */
function loadDecks() {
  try {
    const raw = safeGet(LS_DECKS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[storage] 卡组 JSON 解析失败:', e);
    return [];
  }
}
function saveDecks(d) {
  const ok = safeSet(LS_DECKS, JSON.stringify(d));
  return ok;
}
function getActiveDeckId() { return safeGet(LS_ACTIVE); }
function setActiveDeckId(id) { safeSet(LS_ACTIVE, id); }

function getActiveDeckCards() {
  const decks = loadDecks();
  const id = getActiveDeckId();
  const d = decks.find(x => x.id === id) || decks[0];
  if (!d || !d.cards || d.cards.length !== DECK_SIZE) return DEFAULT_DECK.slice();
  return d.cards.slice();
}

/* ---------- 背景设置读写 ---------- */
function loadBgSettingsRaw() {
  try {
    const raw = safeGet(LS_BG);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveBgSettingsRaw(obj) {
  return safeSet(LS_BG, JSON.stringify(obj));
}