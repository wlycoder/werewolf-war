/* =========================================================
   config.js — 常量、通用工具、词条显示
   棋盘：6 行 × 5 列
   ========================================================= */
const BOARD_ROWS = 6;
const BOARD_COLS = 5;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const BASE_HP = 15;
const MAX_MANA = 12;
const DECK_SIZE = 24;
const HAND_LIMIT = 7;
const PLAYER_ZONE = [4, 5];
const PLAYER_LAST_ROW = 5;
const AI_LAST_ROW = 0;
const HAND_START = 3;

const $ = s => document.querySelector(s);
const inBounds = (r,c) => r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS;
const dist = (a,b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
const sleep = ms => new Promise(res => setTimeout(res, ms));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function factionClass(f) {
  if (f === '神' || f === '民' || f === '狼') return 'faction-' + f;
  return 'faction-无';
}
function factionColor(f) {
  if (f === '神') return '#fde047';
  if (f === '民') return '#93c5fd';
  if (f === '狼') return '#fb923c';
  return '#c4b5fd';
}
function getCardRange(card) {
  return 1 + (card.rangeBonus || 0);
}
function kwText(kw) {
  if (kw.id === 'swift') return '迅捷';
  if (kw.id === 'haste') return '疾行' + kw.level;
  if (kw.id === 'guardian') return '守护';
  if (kw.id === 'graverobber') return '掘墓';
  if (kw.id === 'bloodrite') return '血祭' + kw.level;
  return '';
}
function effectText(eff) {
  if (!eff) return '';
  if (eff.label) return `${eff.label}：${eff.desc}`;
  return eff.desc || '';
}
function hasKeyword(u, id) {
  return !!(u && u.keywords && u.keywords.some(k => k.id === id));
}
function getMoveDirs(u) {
  if (u && u.diagonal) {
    return [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  }
  return DIRS;
}

/* ★ 卡牌描述：可动态生成（流浪商队抽牌数随费用变化） */
function getCardDesc(card) {
  if (!card) return '';
  if (card.id === 'merchant') {
    const drawCount = card.summonCost - 1;
    return `策略：抽 ${drawCount} 张牌，随后将「费用+1、抽牌数+1」的版本加入敌方手牌`;
  }
  return effectText(card.effect);
}

function isSchemeCard(card) { return card && card.type === 'scheme'; }
function isTacticCard(card) { return card && card.type === 'tactic'; }
function isHut(card)    { return card && card.type === 'hut'; }
function isUnit(card)   { return card && card.type !== 'tactic' && card.type !== 'scheme' && card.type !== 'hut'; }

/* ★ 图标助手：支持 emoji 或图片路径 */
function isImageIcon(icon) {
  return typeof icon === 'string' && /\.(png|jpe?g|gif|webp|svg)$/i.test(icon);
}
function iconHTML(icon) {
  if (!icon) return '';
  if (isImageIcon(icon)) {
    return `<img class="icon-img" src="${icon}" alt="">`;
  }
  return String(icon);
}
/* =========================================================
   战斗数值矩阵
   ========================================================= */
function computeCombatValues(atkFaction, atk, defFaction, defAtk) {
  const af = atkFaction || '无';
  const df = defFaction || '无';
  let damage = atk;
  let recoil = 0;

  if (af === '狼') {
    if (df === '神' || df === '狼') recoil = defAtk;
  } else if (df === '狼') {
    if (af === '神' || af === '无' || af === '狼') recoil = defAtk;
    else if (af === '民') { damage = 0; recoil = defAtk; }
  } else {
    if (af === '神' && df === '神') recoil = defAtk;
    else if (af === '神' && df === '民') recoil = 1;
    else if (af === '神' && df === '无') recoil = 0;
    else if ((af === '民' || af === '无') && df === '神') recoil = defAtk;
  }

  return { damage, recoil };
}

/* =========================================================
   ★ 音效
   ========================================================= */
const SOUND_FILES = {
  schemeActivate: 'assets/Audio/interact/active.mp3',   /* 策激活 */
  place:          'assets/Audio/interact/place1.ogg',   /* 单位部署 */
  click:          'assets/Audio/interact/click1.ogg',   /* 选中手牌单位 */
  error:          'assets/Audio/interact/error1.ogg'    /* 手牌不可用 */
};
const SOUNDS = {};

/** 预加载所有音效（在 init 时调用一次） */
function initSounds() {
  Object.entries(SOUND_FILES).forEach(([key, path]) => {
    try {
      const a = new Audio();
      a.src = path;
      a.preload = 'auto';
      a.volume = 0.6;
      SOUNDS[key] = a;
    } catch (e) {
      console.warn('[音效] 加载失败:', key, e);
    }
  });
}

/** 播放音效（cloneNode 允许同一音效重叠播放） */
function playSound(key) {
  const base = SOUNDS[key];
  if (!base) return;
  try {
    const a = base.cloneNode();
    a.volume = base.volume;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* 浏览器自动播放策略拦截，静默忽略 */ });
    }
  } catch (e) { /* ignore */ }
}

/* =========================================================
   ★ 攻击范围计算（区分对角线单位）
   ========================================================= */
function distForRange(a, b) {
  if (a && a.diagonal) {
    return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
  }
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/* =========================================================
   ★ 起手 / AI 阵营
   ========================================================= */
const HAND_START_FIRST  = 3;    /* 先手起手牌数 */
const HAND_START_SECOND = 5;    /* 后手起手牌数 */

/* 当前 AI 控制的一方（评估模式下会切换） */
let AI_SIDE = 'ai';
function getOpponentSide() { return AI_SIDE === 'ai' ? 'player' : 'ai'; }

/* =========================================================
   ★ 背景音乐引擎（manifest 自动发现）
   ---------------------------------------------------------
   支持两种清单文件（放一个即可，两个都放也行）：
   ① manifest.json —— 标准 JSON 数组格式，需要 HTTP 服务器：
        ["01.ogg", "02.ogg", "03.mp3"]
       ⚠️ 通过 file:// 直接打开 HTML 时 fetch 会被 CORS 拦，
          这时会自动回退到 ②。
   ② manifest.js   —— 通过 <script> 标签加载，file:// 也能用：
        window.MUSIC_MANIFEST = ["01.ogg", "02.ogg", "03.mp3"];
   ========================================================= */
const MUSIC_DIR = 'assets/Audio/music/';
const MUSIC_MANIFEST_JSON = MUSIC_DIR + 'manifest.json';
const MUSIC_MANIFEST_JS   = MUSIC_DIR + 'manifest.js';

const MUSIC_LS_KEY = 'wc_music_v1';
const MUSIC_DEFAULTS = { enabled: true, volume: 0.35 };
let MUSIC_SETTINGS = { ...MUSIC_DEFAULTS };

let MUSIC_TRACKS = [];
let _musicEl = null;
let _musicPlayIdx = -1;
let _musicUnlocked = false;
let _musicFailCount = 0;

function loadMusicSettings() {
  try {
    const raw = localStorage.getItem(MUSIC_LS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (typeof obj.enabled === 'boolean') MUSIC_SETTINGS.enabled = obj.enabled;
    if (typeof obj.volume === 'number') {
      MUSIC_SETTINGS.volume = Math.max(0, Math.min(1, obj.volume));
    }
  } catch (e) { /* ignore */ }
}

function persistMusicSettings() {
  try {
    localStorage.setItem(MUSIC_LS_KEY, JSON.stringify(MUSIC_SETTINGS));
  } catch (e) { /* ignore */ }
}

/* ---------- 通过 <script> 标签加载清单（file:// 兼容） ---------- */
function loadManifestScript() {
  return new Promise(resolve => {
    window.MUSIC_MANIFEST = null;
    const s = document.createElement('script');
    s.src = MUSIC_MANIFEST_JS + '?t=' + Date.now();
    s.onload = () => resolve(window.MUSIC_MANIFEST || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

/* ---------- 发现曲目：先试 JSON，再试 JS ---------- */
async function discoverMusicTracks() {
  let list = null;
  let source = '';

  /* ① 尝试 manifest.json（需要 HTTP 服务器） */
  try {
    const res = await fetch(MUSIC_MANIFEST_JSON, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      list = Array.isArray(data) ? data
           : (data && Array.isArray(data.tracks) ? data.tracks : null);
      if (list && list.length) source = 'manifest.json';
    }
  } catch (e) {
    /* file:// 下 fetch 会被 CORS 拦，静默回退到 JS */
  }

  /* ② 回退到 manifest.js */
  if (!list || !list.length) {
    const jsList = await loadManifestScript();
    if (Array.isArray(jsList) && jsList.length) {
      list = jsList;
      source = 'manifest.js';
    }
  }

  if (!list || !list.length) {
    console.warn('[music] 未找到有效清单：请检查 assets/Audio/music/ 下是否有 manifest.json 或 manifest.js');
    return [];
  }

  const full = list
    .map(f => String(f).trim())
    .filter(Boolean)
    .map(f => MUSIC_DIR + f);

  console.log(`[music] 已从 ${source} 加载 ${full.length} 首曲目:`, full);
  return full;
}

/* ---------- 初始化 ---------- */
async function initMusic() {
  loadMusicSettings();

  MUSIC_TRACKS = await discoverMusicTracks();
  if (!MUSIC_TRACKS.length) {
    console.warn('[music] 未发现任何音乐文件，背景音乐已禁用');
    return;
  }

  _musicEl = new Audio();
  _musicEl.loop = false;
  _musicEl.preload = 'auto';
  _musicEl.volume = MUSIC_SETTINGS.enabled ? MUSIC_SETTINGS.volume : 0;

  _musicEl.addEventListener('ended', () => {
    _musicFailCount = 0;
    playNextMusicTrack();
  });

  _musicEl.addEventListener('error', () => {
    if (!_musicEl.src) return;
    _musicFailCount++;
    console.warn('[music] 加载失败:', _musicEl.src);
    if (_musicFailCount <= MUSIC_TRACKS.length) {
      setTimeout(playNextMusicTrack, 400);
    } else {
      console.warn('[music] 所有音乐均无法播放，已停止尝试');
    }
  });

  const unlock = () => {
    if (_musicUnlocked) return;
    _musicUnlocked = true;
    playNextMusicTrack();
  };
  ['click', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, unlock, { passive: true })
  );
}

function playNextMusicTrack() {
  if (!_musicEl || !MUSIC_SETTINGS.enabled) return;
  if (!MUSIC_TRACKS.length) return;
  _musicPlayIdx = (_musicPlayIdx + 1) % MUSIC_TRACKS.length;
  _musicEl.src = MUSIC_TRACKS[_musicPlayIdx];
  _musicEl.volume = MUSIC_SETTINGS.volume;
  const p = _musicEl.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => { /* 自动播放被拦截时静默 */ });
  }
}

function setMusicEnabled(b) {
  MUSIC_SETTINGS.enabled = !!b;
  persistMusicSettings();
  if (!_musicEl) return;
  if (MUSIC_SETTINGS.enabled) {
    _musicEl.volume = MUSIC_SETTINGS.volume;
    if (_musicEl.paused) playNextMusicTrack();
  } else {
    _musicEl.pause();
  }
}

function setMusicVolume(v) {
  MUSIC_SETTINGS.volume = Math.max(0, Math.min(1, v));
  persistMusicSettings();
  if (_musicEl) {
    _musicEl.volume = MUSIC_SETTINGS.enabled ? MUSIC_SETTINGS.volume : 0;
  }
}

/* =========================================================
   ★ 联机辅助
   ========================================================= */
function oppSide(side) { return side === 'player' ? 'ai' : 'player'; }
function isNetMode()   { return !!(G && G.net); }
function isNetHost()   { return !!(G && G.net && G.net.mode === 'host'); }
function isNetGuest()  { return !!(G && G.net && G.net.mode === 'guest'); }