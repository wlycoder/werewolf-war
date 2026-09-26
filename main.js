/* =========================================================
   main.js — 初始化、菜单、卡组编辑、联机 UI
   ========================================================= */
let editing = { id: null, name: '', icon: '🃏', cards: [] };
let currentTab = 'unit';

const RULE_TICKER_LINES = [
  '⚡ 迅捷：被召唤的回合即可立即行动',
  '👣 疾行 X：每回合可额外行动 X 次',
  '🛡 守护：同行友方单位或总部受伤时，伤害转移给本守卫',
  '💀 亡语：单位离场时触发效果',
  '🚫 禁言：被禁言的单位无法行动，回合结束自动解除',
  '🔙 撤退：向自己总部方向后退一行；无处可退则回到手牌',
  '🩸 血祭：狼单位召唤时须献祭一个友方民/神单位',
  '🐺 狼阵营：狼→神/狼受反伤；狼→民/无无反伤；神/无→狼受反伤；民→狼不造成伤害但受反伤',
  '⚔ 反伤（其余）：神→神 受目标攻击力；神→民 固定 1；神→无 无；民/无→神 受神攻击力',
  '❔ 策：激活后留在手牌，敌方回合中触发；未触发则下回合开始解除（不返法力）',
  '📦 空牌库：牌库抽空后，随机一个友方目标受到 2 点伤害',
  '🚫 手牌上限：抽牌时手牌已满，该牌会被弃掉',
  '🎯 射程：带「射程+X」的卡牌可攻击更远的敌人',
  '🟣 行动花费：单位左下角紫色圆圈显示每次行动消耗的法力',
  '🔢 卡牌编号：每张卡牌拥有唯一的 16 进制编号',
  '🏘️ 舍：只能部署在友方单位周围 3×3 范围内，无法移动；点击可消耗法力激活',
  '🌐 联机：村庄先手；角色随机分配；双方都会播放动画'
];
let _ruleTickerIdx = 0, _ruleTickerTimer = null;
function startRuleTicker() {
  const el = document.getElementById('rule-ticker-content');
  if (!el || _ruleTickerTimer) return;
  const showNext = () => {
    el.classList.add('fade');
    setTimeout(() => {
      el.textContent = RULE_TICKER_LINES[_ruleTickerIdx++ % RULE_TICKER_LINES.length];
      el.classList.remove('fade');
    }, 360);
  };
  showNext();
  _ruleTickerTimer = setInterval(showNext, 15000);
}

/* =========================================================
   弹幕
   ========================================================= */
const DANMAKU_DEFAULT = ['我已经0秒没有听到11连败笑话了','看啊看啊，这是谁来了？','向您致敬！','那是个错误','幸运女神不在我这边','到我怀里来！'];
let _danmakuList = [], _danmakuTimer = null, _danmakuIdx = 0;

async function loadDanmakuList() {
  /* ① sub.txt */
  try {
    const res = await fetch('assets/sub.txt', { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const lines = text
        .split(/\r?\n/)
        .flatMap(l => l.split('/n'))
        .map(s => s.trim())
        .filter(Boolean);
      if (lines.length) {
        _danmakuList = lines;
        console.log(`[danmaku] 已从 sub.txt 加载 ${lines.length} 条弹幕`);
        return;
      }
      console.warn('[danmaku] sub.txt 内容为空或全被过滤');
    } else {
      console.warn('[danmaku] sub.txt 返回状态:', res.status);
    }
  } catch (e) {
    console.warn('[danmaku] sub.txt 读取失败（file:// 下正常），尝试 sub.js…');
  }
  /* ② sub.js */
  const jsLines = await loadDanmakuScript();
  if (Array.isArray(jsLines) && jsLines.length) {
    _danmakuList = jsLines.map(s => String(s).trim()).filter(Boolean);
    console.log(`[danmaku] 已从 sub.js 加载 ${_danmakuList.length} 条弹幕`);
    return;
  }
  /* ③ 兜底 */
  console.warn('[danmaku] sub.txt / sub.js 均不可用，使用内置默认弹幕');
  _danmakuList = DANMAKU_DEFAULT.slice();
}

function loadDanmakuScript() {
  return new Promise(resolve => {
    window.DANMAKU_LIST = null;
    const s = document.createElement('script');
    s.src = 'assets/sub.js?t=' + Date.now();
    s.onload = () => resolve(window.DANMAKU_LIST || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

function spawnDanmaku() {
  if (!BG_SETTINGS.bgEnabled) return;
  const menu = document.getElementById('screen-menu');
  if (!menu || !menu.classList.contains('active') || document.hidden) return;
  const layer = document.getElementById('danmaku-layer');
  if (!layer || !_danmakuList.length) return;
  const el = document.createElement('div');
  el.className = 'danmaku';
  el.textContent = _danmakuList[_danmakuIdx++ % _danmakuList.length];
  el.style.top = (8 + Math.random() * 80) + 'vh';
  el.style.fontSize = (14 + Math.random() * 8).toFixed(1) + 'px';
  const pal = ['#f5e9c8','#ffe9a8','#e8c86a','#bfdbfe','#fda4af','#c4b5fd'];
  el.style.color = pal[Math.floor(Math.random() * pal.length)];
  const dur = 10 + Math.random() * 8;
  el.style.animationDuration = dur + 's';
  layer.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, (dur + 0.6) * 1000);
}
function scheduleNextDanmaku() {
  if (_danmakuTimer) clearTimeout(_danmakuTimer);
  _danmakuTimer = setTimeout(() => { spawnDanmaku(); scheduleNextDanmaku(); }, 1200 + Math.random() * 2300);
}
function initDanmaku() {
  loadDanmakuList().then(() => {
    setTimeout(spawnDanmaku, 800);
    setTimeout(spawnDanmaku, 2000);
    scheduleNextDanmaku();
  });
}

/* =========================================================
   背景设置
   ========================================================= */
const BG_DEFAULTS = { spawnInterval: 2.8, driftRange: 160, bgEnabled: true };
let BG_SETTINGS = { ...BG_DEFAULTS };
function loadBGSettings() {
  const obj = loadBgSettingsRaw(); if (!obj) return;
  if (typeof obj.spawnInterval === 'number' && obj.spawnInterval > 0) BG_SETTINGS.spawnInterval = obj.spawnInterval;
  if (typeof obj.driftRange === 'number' && obj.driftRange >= 0) BG_SETTINGS.driftRange = obj.driftRange;
  if (typeof obj.bgEnabled === 'boolean') BG_SETTINGS.bgEnabled = obj.bgEnabled;
}
function persistBGSettings() { saveBgSettingsRaw(BG_SETTINGS); }
function applyBGSettings() {
  document.body.classList.toggle('no-bg-anim', !BG_SETTINGS.bgEnabled);
  const sv = $('#setting-spawn-value'), dv = $('#setting-drift-value');
  const ss = $('#setting-spawn'), ds = $('#setting-drift');
  const bt = $('#setting-bg-toggle'), bv = $('#setting-bg-value');
  if (sv) sv.textContent = BG_SETTINGS.spawnInterval.toFixed(1) + 's';
  if (dv) dv.textContent = BG_SETTINGS.driftRange + 'px';
  if (ss) ss.value = BG_SETTINGS.spawnInterval;
  if (ds) ds.value = BG_SETTINGS.driftRange;
  if (bt) bt.checked = BG_SETTINGS.bgEnabled;
  if (bv) bv.textContent = BG_SETTINGS.bgEnabled ? '开启' : '关闭';
}
function initMenuBg() {
  const grid = document.getElementById('menu-board-bg');
  if (!grid || grid.dataset.filled) return;
  grid.dataset.filled = '1';
  for (let i = 0; i < 30; i++) {
    const cell = document.createElement('div');
    cell.className = 'board-bg-cell';
    cell.style.animationDelay = (-Math.random() * 6).toFixed(2) + 's';
    cell.style.animationDuration = (5 + Math.random() * 4).toFixed(2) + 's';
    grid.appendChild(cell);
  }
}
const FLYING_CARDS = ['🃏','🗡️','🛡','💣','🏹','🪄','🔮','💘','🐺','🚩','📯','⚔️','🩸','🚪','⛏️','🤤','🧹','🪬','📈','💂','🚷','🤪','😡','🌾','🏘️','🐛','🥷'];
let _flyTimer = null;
function spawnFlyingCard() {
  if (!BG_SETTINGS.bgEnabled) return;
  const menu = document.getElementById('screen-menu');
  if (!menu || !menu.classList.contains('active') || document.hidden) return;
  const bg = document.querySelector('.menu-bg');
  if (!bg) return;
  const el = document.createElement('div');
  el.className = 'flying-card';
  el.textContent = FLYING_CARDS[Math.floor(Math.random() * FLYING_CARDS.length)];
  el.style.top = (5 + Math.random() * 85) + 'vh';
  el.style.left = '-80px';
  el.style.fontSize = (20 + Math.random() * 30) + 'px';
  const dur = 8 + Math.random() * 5;
  el.style.animationDuration = dur + 's';
  const range = BG_SETTINGS.driftRange;
  el.style.setProperty('--drift-y', (-range / 2 + Math.random() * range) + 'px');
  bg.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, (dur + 1) * 1000);
}
function scheduleNextFlyingCard() {
  if (_flyTimer) clearTimeout(_flyTimer);
  _flyTimer = setTimeout(() => { spawnFlyingCard(); scheduleNextFlyingCard(); }, BG_SETTINGS.spawnInterval * 1000);
}
function initFlyingCards() {
  setTimeout(spawnFlyingCard, 700);
  setTimeout(spawnFlyingCard, 1900);
  scheduleNextFlyingCard();
}

/* =========================================================
   ★ 音乐 UI 同步
   ========================================================= */
function initMusicUI() {
  const slider = document.getElementById('setting-music');
  const label = document.getElementById('setting-music-value');
  if (!slider) {
    console.warn('[music] 找不到 #setting-music 滑块，请检查 index.html');
    return;
  }
  const pct = Math.round(MUSIC_SETTINGS.volume * 100);
  slider.value = pct;
  if (label) label.textContent = pct + '%';
  if (slider.dataset.bound) return;
  slider.dataset.bound = '1';
  slider.addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v)) return;
    setMusicVolume(v / 100);
    if (label) label.textContent = v + '%';
    console.log('[music] 音量 =', v + '%', '实际音量 =', MUSIC_SETTINGS.volume);
  });
  console.log('[music] UI 就绪，当前音量:', pct + '%');
}

/* =========================================================
   ★ 女巫亡语：二选一
   ========================================================= */
function askWitchChoice() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-box" style="max-width:540px;">
        <div class="witch-choice">
          <button class="witch-btn" data-act="apple">
            <div class="witch-icon">💔</div>
            <div class="witch-label">对敌方总部造成 2 点伤害</div>
          </button>
          <button class="witch-btn" data-act="green">
            <div class="witch-icon">💖</div>
            <div class="witch-label">友方总部 +2 血量</div>
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.witch-btn').forEach(btn => {
      btn.addEventListener('click', () => { overlay.remove(); resolve(btn.dataset.act); });
    });
  });
}

/* =========================================================
   ★ 妥协：二选一
   ========================================================= */
function askCompromiseChoice() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-box" style="max-width:660px;">
        <h2 style="font-size:22px;letter-spacing:4px;color:#e8c86a;">🤝 妥协</h2>
        <p style="color:#b9b1d4;font-size:13px;line-height:1.6;">选择一种妥协方式：</p>
        <div class="compromise-choice">
          <button class="compromise-btn" data-act="draw">
            <div class="compromise-title">👋</div>
            <div class="compromise-label">抽一张牌<br>己方总部 +1 血量</div>
          </button>
          <button class="compromise-btn" data-act="both">
            <div class="compromise-title">🤝</div>
            <div class="compromise-label">双方各进行两次<br>（抽一张牌 + 总部 +1 血量）</div>
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.compromise-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.remove();
        resolve(btn.dataset.act);
      });
    });
  });
}

/* =========================================================
   ★ 舍：二选一浮层
   ========================================================= */
function askPlayerChooseHutReward(cards) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const btns = cards.map((c, i) => `
      <button class="hut-reward-btn" data-idx="${i}">
        <div class="hr-icon">${iconHTML(c.icon)}</div>
        <div class="hr-name">${c.name}</div>
        <div class="hr-stats">
          <span>⚔${c.atk || 0}</span>
          <span>🛡${c.def || 0}</span>
          <span>⚡${c.actionCost || 0}</span>
        </div>
        <div class="hr-cost">💧${c.summonCost}</div>
      </button>
    `).join('');
    overlay.innerHTML = `
      <div class="overlay-box" style="max-width:560px;">
        <h2 style="font-size:22px;letter-spacing:4px;color:#e8c86a;">🏘️ 舍</h2>
        <p style="color:#b9b1d4;font-size:13px;line-height:1.6;">选择一个民加入手牌（另一个弃掉）：</p>
        <div class="hut-reward-choice">${btns}</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.hut-reward-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        overlay.remove();
        resolve(cards[idx]);
      });
    });
  });
}

/* =========================================================
   ★ 使用"计"牌（支持取消回滚 + 联机）
   ========================================================= */
async function useTacticCard(idx) {
  if (!G || G.gameOver) return;
  const mySide = G.mySide;
  if (G.turn !== mySide) return;
  if (G.busy || G.choiceMode || mulliganState) return;

  const me = G[mySide];
  const card = me.hand[idx];
  if (!card || card.type !== 'tactic') return;
  if (card.summonCost > me.mana) { log('法力不足，无法使用该计', mySide); return; }

  const savedCard = card;
  me.mana -= card.summonCost;
  me.hand.splice(idx, 1);
  log(`📜 ${mySide === 'player' ? '🔵' : '🔴'} 使用了计策：${card.name}`, mySide);
  clearSelection();

  G.pendingTactic = { card: savedCard, cost: card.summonCost, cancelled: false };

  render();

  await triggerSchemesOnEnemyTactic(mySide, card);

  if (card.effect && card.effect.trigger) {
    const fn = TACTIC_REGISTRY[card.effect.trigger];
    if (typeof fn === 'function') {
      try { await fn(card); } catch (err) { console.error(err); log(`⚠️ ${card.name} 使用异常`, mySide); }
    }
  }

  if (G.pendingTactic && G.pendingTactic.cancelled) {
    me.mana += G.pendingTactic.cost;
    if (me.hand.length < HAND_LIMIT) {
      me.hand.push(savedCard);
      log(`↩️ 已取消「${card.name}」，返还 ${G.pendingTactic.cost} 法力`, mySide);
    }
  }
  G.pendingTactic = null;
  render();
}

/* =========================================================
   主菜单渲染
   ========================================================= */
function renderMenu() {
  const decks = loadDecks();
  const activeId = getActiveDeckId();
  const listEl = $('#deck-list');
  listEl.innerHTML = '';
  if (!decks.length) listEl.innerHTML = '<p class="empty-tip">还没有卡组<br>点击「创建卡组」开始吧</p>';
  decks.forEach(d => {
    const el = document.createElement('div');
    el.className = 'deck-item' + (d.id === activeId ? ' active' : '');
    const v = validateDeck(d.cards);
    const warn = v.valid ? '' : ' <span style="color:#f87171">⚠</span>';
    const icon = d.icon || '🃏';
    el.innerHTML = `
      <div>
        <div class="deck-item-name"><span class="deck-item-icon">${iconHTML(icon)}</span>${esc(d.name)}${warn}</div>
        <div class="deck-item-count">${d.cards.length} 张卡牌</div>
      </div>
      <div class="deck-item-actions">
        <button class="mini-btn" data-act="use" data-id="${d.id}">${d.id === activeId ? '使用中' : '使用'}</button>
        <button class="mini-btn" data-act="edit" data-id="${d.id}">编辑</button>
        <button class="mini-btn danger" data-act="del" data-id="${d.id}">删除</button>
      </div>`;
    listEl.appendChild(el);
  });
  listEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id, act = btn.dataset.act;
      const now = loadDecks();
      if (act === 'use') { setActiveDeckId(id); renderMenu(); }
      else if (act === 'edit') { const d = now.find(x => x.id === id); if (d) openDeckEditor(d); }
      else if (act === 'del') {
        if (confirm('确定要删除该卡组吗？')) {
          saveDecks(now.filter(x => x.id !== id));
          if (getActiveDeckId() === id) {
            const rest = loadDecks();
            if (rest.length) setActiveDeckId(rest[0].id);
            else safeRemove(LS_ACTIVE);
          }
          renderMenu();
        }
      }
    });
  });
  const act = decks.find(d => d.id === activeId);
  $('#active-deck-name').textContent = act ? `${act.icon || '🃏'} ${act.name}` : '未选择';
}

function openDeckEditor(deck) {
  if (deck) {
    let cards = Array.isArray(deck.cards) ? [...deck.cards] : [];
    const v = validateDeck(cards);
    if (!v.valid) cards = normalizeDeck(cards);
    editing = { id: deck.id, name: deck.name || '未命名卡组', icon: deck.icon || '🃏', cards };
  } else {
    editing = { id: null, name: '新卡组', icon: '🃏', cards: [] };
  }
  currentTab = 'unit';
  syncDeckTabs();
  renderDeckEditor();
  showScreen('screen-deck');
}
function syncDeckTabs() {
  document.querySelectorAll('.deck-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
}
function cardBlockHTML(card, extra) {
  extra = extra || '';
  const kw = (card.keywords || []).map(k => kwText(k)).join(' · ');
  const eff = effectText(card.effect);
  const maxCopies = card.maxCopies || DECK_SIZE;
  if (card.type === 'tactic' || card.type === 'scheme') {
    const badge = card.type === 'tactic' ? '计' : '策';
    const badgeCls = card.type === 'tactic' ? 'tactic-badge' : 'scheme-badge';
    return `
      <div class="pc-top">
        <span class="pc-icon">${iconHTML(card.icon)}</span>
        <span class="pc-name">${card.name}</span>
        <span class="pc-faction ${badgeCls}">${badge}</span>
      </div>
      <div class="pc-stats"><span class="cost">花费${card.summonCost}</span></div>
      <div class="pc-kw" style="color:#94a3b8">上限 ${maxCopies} 张</div>
      ${eff ? `<div class="pc-eff">${esc(eff)}</div>` : ''}
      <div class="pc-hex">#${card.hex}</div>
      ${extra}`;
  }
  if (card.type === 'hut') {
    return `
      <div class="pc-top">
        <span class="pc-icon">${iconHTML(card.icon)}</span>
        <span class="pc-name">${card.name}</span>
        <span class="pc-faction hut-badge">舍</span>
      </div>
      <div class="pc-stats">
        <span class="cost">部署${card.summonCost}</span>
        <span class="act">激活${card.activateCost || 0}</span>
        <span class="def">防${card.def}</span>
      </div>
      <div class="pc-kw" style="color:#94a3b8">上限 ${maxCopies} 张</div>
      ${eff ? `<div class="pc-eff">${esc(eff)}</div>` : ''}
      <div class="pc-hex">#${card.hex}</div>
      ${extra}`;
  }
  const rng = getCardRange(card);
  const rangeTag = rng > 1 ? `<span style="color:#c4b5fd">射程${rng}</span>` : '';
  return `
    <div class="pc-top">
      <span class="pc-icon">${iconHTML(card.icon)}</span>
      <span class="pc-name">${card.name}</span>
      <span class="pc-faction ${factionClass(card.faction)}">${card.faction}</span>
    </div>
    <div class="pc-stats">
      <span class="cost">召唤${card.summonCost}</span>
      <span class="act">行动${card.actionCost}</span>
      <span class="atk">攻${card.atk}</span>
      <span class="def">防${card.def}</span>
      ${rangeTag}
    </div>
    <div class="pc-kw" style="color:#94a3b8">上限 ${maxCopies} 张</div>
    ${kw ? `<div class="pc-kw">${kw}</div>` : ''}
    ${eff ? `<div class="pc-eff">${esc(eff)}</div>` : ''}
    <div class="pc-hex">#${card.hex}</div>
    ${extra}`;
}
function renderDeckEditor() {
  $('#deck-name').value = editing.name;
  $('#deck-icon').value = editing.icon;
  const v = validateDeck(editing.cards);

  const poolEl = $('#card-pool');
  poolEl.innerHTML = '';
  CARDS.forEach(card => {
    const cardType = card.type || 'unit';
    if (cardType !== currentTab) return;
    const cnt = editing.cards.filter(id => id === card.id).length;
    const max = card.maxCopies || DECK_SIZE;
    const atMax = cnt >= max, deckFull = editing.cards.length >= DECK_SIZE;
    const el = document.createElement('div');
    el.className = 'pool-card' + (cardType === 'tactic' ? ' tactic' : '') + (cardType === 'scheme' ? ' scheme' : '') + (cardType === 'hut' ? ' hut' : '');
    el.innerHTML = cardBlockHTML(card, `
      <div class="pc-actions">
        <button class="mini-btn" data-act="add" ${atMax || deckFull ? 'disabled' : ''}>
          ${atMax ? '已满' : (deckFull ? '卡组已满' : '加入')}
        </button>
        <button class="mini-btn danger" data-act="sub" ${cnt <= 0 ? 'disabled' : ''}>移除</button>
      </div>`) + (cnt > 0 ? `<span class="badge" style="${atMax ? 'background:#f87171;color:#fff' : ''}">×${cnt}/${max}</span>` : '');
    el.querySelector('[data-act="add"]').addEventListener('click', () => {
      if (editing.cards.length >= DECK_SIZE) { alert(`卡组已满 ${DECK_SIZE} 张`); return; }
      if (editing.cards.filter(x => x === card.id).length >= max) { alert(`「${card.name}」最多携带 ${max} 张`); return; }
      editing.cards.push(card.id); renderDeckEditor();
    });
    el.querySelector('[data-act="sub"]').addEventListener('click', () => {
      const i = editing.cards.lastIndexOf(card.id); if (i >= 0) editing.cards.splice(i, 1);
      renderDeckEditor();
    });
    poolEl.appendChild(el);
  });
  if (!poolEl.children.length) poolEl.innerHTML = `<p class="empty-tip">当前分类暂无卡牌</p>`;

  const deckEl = $('#deck-cards');
  deckEl.innerHTML = '';
  const counts = {};
  editing.cards.forEach(id => counts[id] = (counts[id] || 0) + 1);
  let allEntries = Object.entries(counts);

  const typeOrder = { unit: 0, hut: 1, tactic: 2, scheme: 3 };
  allEntries.sort((a, b) => {
    const ca = CARD_MAP[a[0]], cb = CARD_MAP[b[0]];
    const ta = ca?.type || 'unit', tb = cb?.type || 'unit';
    if (ta === currentTab && tb !== currentTab) return -1;
    if (tb === currentTab && ta !== currentTab) return 1;
    return (typeOrder[ta] || 0) - (typeOrder[tb] || 0);
  });

  if (!allEntries.length) {
    deckEl.innerHTML = `<p class="empty-tip">卡组为空</p>`;
  } else {
    allEntries.forEach(([id, n]) => {
      const card = CARD_MAP[id]; if (!card) return;
      const max = card.maxCopies || DECK_SIZE;
      const over = n > max;
      const cardType = card.type || 'unit';
      const el = document.createElement('div');
      el.className = 'pool-card' + (cardType === 'tactic' ? ' tactic' : '') + (cardType === 'scheme' ? ' scheme' : '') + (cardType === 'hut' ? ' hut' : '');
      if (cardType === currentTab) el.classList.add('highlight-tab');
      if (over) el.style.borderColor = '#f87171';
      el.innerHTML = cardBlockHTML(card, `
        <div class="pc-actions"><button class="mini-btn danger">移除一张</button></div>`)
        + `<span class="badge" style="${over ? 'background:#f87171;color:#fff' : ''}">×${n}/${max}${over ? ' 超限!' : ''}</span>`;
      el.querySelector('button').addEventListener('click', () => {
        const i = editing.cards.lastIndexOf(id); if (i >= 0) editing.cards.splice(i, 1);
        renderDeckEditor();
      });
      deckEl.appendChild(el);
    });
  }

  const cntEl = $('#deck-count');
  cntEl.textContent = `${editing.cards.length} / ${DECK_SIZE}` + (v.valid ? '' : ` · ${v.reason}`);
  cntEl.className = '';
  if (v.valid) cntEl.classList.add('ok'); else cntEl.classList.add('over');
}
function saveDeck() {
  const name = ($('#deck-name').value || '').trim() || '未命名卡组';
  const icon = ($('#deck-icon').value || '').trim() || '🃏';
  let cards = [...editing.cards];
  const v = validateDeck(cards);
  if (!v.valid) {
    const fixed = normalizeDeck(cards);
    if (validateDeck(fixed).valid) {
      if (!confirm(`当前卡组不合法（${v.reason}）\n是否自动修正后保存？`)) return;
      cards = fixed; editing.cards = fixed;
    } else { alert(`无法保存：${v.reason}`); return; }
  }
  const decks = loadDecks();
  if (editing.id) {
    const d = decks.find(x => x.id === editing.id);
    if (d) { d.name = name; d.icon = icon; d.cards = [...cards]; }
    else decks.push({ id: editing.id, name, icon, cards: [...cards] });
  } else {
    const id = 'deck_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    decks.push({ id, name, icon, cards: [...cards] });
    editing.id = id;
    if (!getActiveDeckId()) setActiveDeckId(id);
  }
  const ok = saveDecks(decks);
  alert(ok ? '✅ 卡组已保存到本地' : '⚠️ 浏览器拒绝了存储');
  showScreen('screen-menu'); renderMenu();
}
function exportEditingDeck() {
  if (!editing.cards.length) { alert('卡组为空，无法导出'); return; }
  const str = exportDeckString({
    icon: ($('#deck-icon').value || '').trim() || '🃏',
    name: ($('#deck-name').value || '').trim() || '未命名卡组',
    cards: editing.cards
  });
  showExportDialog(str);
}
function showExportDialog(str) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="overlay-box" style="max-width:560px;">
      <h2 style="font-size:22px;letter-spacing:4px;">📤 导出卡组</h2>
      <div class="code-box">${esc(str)}</div>
      <div style="display:flex;gap:10px;">
        <button class="btn" data-act="copy">📋 复制</button>
        <button class="btn btn-primary" data-act="close">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const box = overlay.querySelector('.code-box');
  overlay.querySelector('[data-act="close"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="copy"]').addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(() => alert('✅ 已复制'));
    } else {
      const range = document.createRange(); range.selectNodeContents(box);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      alert('已选中，请 Ctrl+C');
    }
  });
}
function showImportDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="overlay-box" style="max-width:560px;">
      <h2 style="font-size:22px;letter-spacing:4px;">📥 导入卡组</h2>
      <textarea class="code-input" rows="4"></textarea>
      <div style="display:flex;gap:10px;">
        <button class="btn" data-act="cancel">取消</button>
        <button class="btn btn-primary" data-act="ok">导入</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ta = overlay.querySelector('.code-input'); ta.focus();
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const str = ta.value.trim(); if (!str) return;
    const parsed = importDeckString(str); if (!parsed) { alert('❌ 无法解析'); return; }
    const cards = normalizeDeck(parsed.cards);
    const decks = loadDecks();
    const id = 'deck_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const name = parsed.name || `导入卡组 ${decks.length + 1}`;
    decks.push({ id, name, icon: parsed.icon || '📥', cards });
    saveDecks(decks); renderMenu(); overlay.remove();
    alert(`✅ 导入成功：${name}`);
  });
}
function ensureInitialDecks() {
  let decks = loadDecks(); let changed = false;
  decks = decks.map(d => {
    const v = validateDeck(d.cards);
    const hasIcon = typeof d.icon === 'string' && d.icon.length > 0;
    if (!v.valid || !hasIcon) {
      changed = true;
      return { ...d, icon: d.icon || '🃏', cards: v.valid ? d.cards : normalizeDeck(d.cards) };
    }
    return d;
  });
  if (changed) saveDecks(decks);
  if (decks.length === 0) {
    decks = PRESET_DECKS.map(p => {
      const cards = validateDeck(p.cards).valid ? [...p.cards] : normalizeDeck(p.cards);
      return { id: p.id, name: p.name, icon: p.icon || '🃏', cards };
    });
    saveDecks(decks); setActiveDeckId(decks[0].id); return true;
  }
  const activeId = getActiveDeckId();
  if (!activeId || !decks.some(d => d.id === activeId)) setActiveDeckId(decks[0].id);
  return false;
}

/* =========================================================
   init()
   ========================================================= */
function init() {
  initSounds();
  initMusic();
  loadBGSettings(); applyBGSettings();
  initMusicUI();
  initMenuBg(); initFlyingCards(); initDanmaku(); startRuleTicker();
  ensureInitialDecks(); renderMenu();

  $('#btn-start').addEventListener('click', async () => {
    if (!loadDecks().length) { alert('请先创建卡组'); return; }
    await newGame();
  });
  $('#btn-create').addEventListener('click', () => openDeckEditor(null));
  $('#btn-import').addEventListener('click', () => showImportDialog());
  $('#btn-about').addEventListener('click', () => $('#about-overlay').classList.remove('hidden'));
  $('#btn-about-close').addEventListener('click', () => $('#about-overlay').classList.add('hidden'));
  $('#btn-settings').addEventListener('click', () => {
    applyBGSettings();
    initMusicUI();
    $('#settings-overlay').classList.remove('hidden');
  });
  $('#btn-settings-close').addEventListener('click', () => $('#settings-overlay').classList.add('hidden'));
  $('#btn-settings-reset').addEventListener('click', () => {
    BG_SETTINGS = { ...BG_DEFAULTS };
    persistBGSettings(); applyBGSettings(); scheduleNextFlyingCard();

    MUSIC_SETTINGS = { ...MUSIC_DEFAULTS };
    persistMusicSettings();
    if (_musicEl) _musicEl.volume = MUSIC_SETTINGS.enabled ? MUSIC_SETTINGS.volume : 0;
    initMusicUI();
  });
  $('#setting-spawn').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) {
      BG_SETTINGS.spawnInterval = v;
      $('#setting-spawn-value').textContent = v.toFixed(1) + 's';
      persistBGSettings(); scheduleNextFlyingCard();
    }
  });
  $('#setting-drift').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v) && v >= 0) {
      BG_SETTINGS.driftRange = v;
      $('#setting-drift-value').textContent = v + 'px';
      persistBGSettings();
    }
  });
  $('#setting-bg-toggle').addEventListener('change', e => {
    BG_SETTINGS.bgEnabled = !!e.target.checked;
    $('#setting-bg-value').textContent = BG_SETTINGS.bgEnabled ? '开启' : '关闭';
    persistBGSettings(); applyBGSettings();
    if (BG_SETTINGS.bgEnabled) scheduleNextFlyingCard();
    else {
      if (_flyTimer) { clearTimeout(_flyTimer); _flyTimer = null; }
      if (_danmakuTimer) { clearTimeout(_danmakuTimer); _danmakuTimer = null; }
      document.querySelectorAll('.flying-card,.danmaku').forEach(el => el.remove());
    }
  });
  $('#btn-save-deck').addEventListener('click', saveDeck);
  $('#btn-export-deck').addEventListener('click', exportEditingDeck);
  $('#btn-eval-deck').addEventListener('click', startEvaluation);
  $('#eval-close').addEventListener('click', () => {
    $('#eval-overlay').classList.add('hidden');
    if (typeof editing !== 'undefined' && editing) {
      showScreen('screen-deck');
      syncDeckTabs();
      renderDeckEditor();
    } else {
      showScreen('screen-menu');
      renderMenu();
    }
  });
  $('#btn-back-menu').addEventListener('click', () => { showScreen('screen-menu'); renderMenu(); });
  $('#deck-name').addEventListener('input', e => { editing.name = e.target.value; });
  $('#deck-icon').addEventListener('input', e => { editing.icon = e.target.value || '🃏'; });
  document.querySelectorAll('.deck-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      syncDeckTabs(); renderDeckEditor();
    });
  });
  $('#btn-end-turn').addEventListener('click', () => {
    if (!G) return;
    if (G.gameOver || G.choiceMode || mulliganState) return;
    if (G.turn !== G.mySide) return;
    endTurn();
  });
  $('#btn-quit').addEventListener('click', () => {
    if (G && !G.gameOver && !confirm('确定要退出当前对局吗？')) return;
    try { if (G && G.choiceMode) { const r = G.choiceMode.resolve; G.choiceMode = null; hideChoiceBanner(); if (r) r(null); } } catch (e) {}
    try { if (mulliganState) { const r = mulliganState.resolve; mulliganState = null; const el = $('#mulligan-overlay'); if (el) { el.classList.add('hidden'); el.style.display = ''; } if (r) r(); } } catch (e) {}
    try { netDestroy(); } catch (e) {}
    G = null; gameStarting = false;
    const o = $('#overlay'); if (o) o.classList.add('hidden');
    const m = $('#mulligan-overlay'); if (m) { m.classList.add('hidden'); m.style.display = ''; }
    hideChoiceBanner();
    showScreen('screen-menu'); renderMenu();
  });
  $('#overlay-btn').addEventListener('click', () => {
    try { if (G && G.choiceMode) { const r = G.choiceMode.resolve; G.choiceMode = null; hideChoiceBanner(); if (r) r(null); } } catch (e) {}
    try { if (mulliganState) { const r = mulliganState.resolve; mulliganState = null; const el = $('#mulligan-overlay'); if (el) { el.classList.add('hidden'); el.style.display = ''; } if (r) r(); } } catch (e) {}
    try { netDestroy(); } catch (e) {}
    G = null; gameStarting = false;
    const o = $('#overlay'); if (o) o.classList.add('hidden');
    const m = $('#mulligan-overlay'); if (m) { m.classList.add('hidden'); m.style.display = ''; }
    hideChoiceBanner();
    showScreen('screen-menu'); renderMenu();
  });
  $('#btn-mulligan-confirm').addEventListener('click', () => {
    if (typeof window.confirmMulligan === 'function') window.confirmMulligan();
  });

  /* 取消选择按钮 */
  const cancelBtn = document.getElementById('btn-cancel-selection');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (!G) return;
      if (G.pendingTactic) G.pendingTactic.cancelled = true;
      if (G.choiceMode && G.choiceMode.active) {
        const r = G.choiceMode.resolve;
        G.choiceMode = null;
        hideChoiceBanner();
        if (r) r(null);
      }
      clearSelection();
      render();
    });
  }

  /* 联机 UI */
  initMultiplayerUI();
}
document.addEventListener('DOMContentLoaded', init);

/* =========================================================
   ★ 卡组评估：双方 AI 自动对战 5 局
   ========================================================= */
let _evalRunning = false;

async function startEvaluation() {
  if (_evalRunning) { alert('评估进行中，请稍候…'); return; }
  const v = validateDeck(editing.cards);
  if (!v.valid) {
    alert(`当前卡组不合法：${v.reason}\n请先修正后再评估`);
    return;
  }

  _evalRunning = true;
  const TOTAL = 5;
  const results = [];

  const overlay = $('#eval-overlay');
  overlay.classList.remove('hidden');
  $('#eval-title').textContent = '📊 卡组评估';
  $('#eval-progress-text').textContent = '准备开始…';
  $('#eval-progress-fill').style.width = '0%';
  $('#eval-result').classList.add('hidden');

  for (let i = 0; i < TOTAL; i++) {
    if (!_evalRunning) break;

    $('#eval-progress-text').textContent = `第 ${i + 1}/${TOTAL} 局 · 对战中…`;
    $('#eval-progress-fill').style.width = ((i) / TOTAL * 100) + '%';

    if (G) G.gameOver = true;
    await sleep(700);

    await newGame({
      playerDeck: editing.cards.slice(),
      autoMode: true,
      evalMode: true,
      skipMulligan: true
    });

    await waitForEvalGameEnd();

    const ab = G.units.find(u => u.owner === 'ai' && u.isBase);
    const playerWon = !ab || ab.hp <= 0;
    results.push(playerWon);

    $('#eval-progress-fill').style.width = ((i + 1) / TOTAL * 100) + '%';
    $('#eval-progress-text').textContent =
      `第 ${i + 1}/${TOTAL} 局 · ${playerWon ? '✅ 胜' : '❌ 负'}`;

    $('#overlay').classList.add('hidden');
    await sleep(500);
  }

  const wins = results.filter(Boolean).length;
  const rate = Math.round(wins / results.length * 100);
  $('#eval-title').textContent = '📊 评估结果';
  $('#eval-progress-text').textContent = '评估完成';
  $('#eval-result-rate').textContent = `${rate}%`;
  $('#eval-result-detail').textContent =
    `友方 ${wins} 胜 / ${results.length - wins} 负（共 ${results.length} 局）`;
  $('#eval-result').classList.remove('hidden');

  _evalRunning = false;
}

function waitForEvalGameEnd() {
  return new Promise(resolve => {
    const check = () => {
      if (!G || G.gameOver) resolve();
      else setTimeout(check, 200);
    };
    check();
  });
}

let _guestDeck = null;
let _guestDeckName = '';
let _gameStarted = false;
/* =========================================================
   ★ 联机 UI + 游戏启动
   ========================================================= */
function initMultiplayerUI() {
  const overlay = document.getElementById('multiplayer-overlay');
  if (!overlay) { console.warn('[net] 未找到联机浮层'); return; }

  const stepChoose    = document.getElementById('mp-step-choose');
  const stepJoin      = document.getElementById('mp-step-join');
  const stepWait      = document.getElementById('mp-step-wait');
  const stepConnected = document.getElementById('mp-step-connected');
  const statusEl      = document.getElementById('mp-status');
  const roomShowEl    = document.getElementById('mp-room-show');

  const showStep = which => {
    [stepChoose, stepJoin, stepWait, stepConnected].forEach(el => el && el.classList.add('hidden'));
    which && which.classList.remove('hidden');
  };
  const setStatus = text => { if (statusEl) statusEl.textContent = text; };

  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    /* ★ 重置状态 */
    _guestDeck = null;
    _guestDeckName = '';
    _gameStarted = false;
    showStep(stepChoose);
    overlay.classList.remove('hidden');
  });
  document.getElementById('mp-btn-close').addEventListener('click', () => overlay.classList.add('hidden'));

  document.getElementById('mp-btn-create').addEventListener('click', () => {
    showStep(stepWait);
    roomShowEl.textContent = '------';
    setStatus('正在创建房间…');
    netCreateRoom(
      code => { roomShowEl.textContent = code; setStatus('等待好友加入…'); },
      err => setStatus('❌ 创建失败：' + (err?.message || '未知错误'))
    );
  });

  document.getElementById('mp-btn-copy').addEventListener('click', () => {
    const code = netGetRoomCode();
    if (!code) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => alert('✅ 已复制房间号：' + code));
    } else prompt('请手动复制房间号：', code);
  });

  document.getElementById('mp-btn-cancel').addEventListener('click', () => {
    netDestroy();
    showStep(stepChoose);
  });

  document.getElementById('mp-btn-join').addEventListener('click', () => {
    showStep(stepJoin);
    const input = document.getElementById('mp-room-input');
    if (input) { input.value = ''; input.focus(); }
  });
  document.getElementById('mp-btn-back-choose').addEventListener('click', () => showStep(stepChoose));

  document.getElementById('mp-btn-join-go').addEventListener('click', () => {
    const input = document.getElementById('mp-room-input');
    const code = (input?.value || '').trim().toUpperCase();
    if (code.length !== 6) { alert('房间号必须是 6 位'); return; }
    showStep(stepWait);
    roomShowEl.textContent = code;
    setStatus('正在连接主机…');
    netJoinRoom(code,
      () => {},
      err => setStatus('❌ 连接失败：' + (err?.message || '未知错误'))
    );
  });

  document.getElementById('mp-btn-disconnect').addEventListener('click', () => {
    netDestroy();
    _guestDeck = null;
    _guestDeckName = '';
    _gameStarted = false;
    showStep(stepChoose);
  });

    /* 网络事件 */
  onNetConnected(role => {
    console.log('[net] 已连接，角色：', role);
    if (role === 'host') {
      document.getElementById('mp-connected-text').textContent = '✅ 客机已加入，等待上传卡组…';
      showStep(stepConnected);
      /* 3 秒超时兜底：若迟迟收不到客机卡组，用主机卡组开始 */
      setTimeout(() => {
        if (!_gameStarted) {
          console.warn('[net] 未收到客机卡组，使用主机卡组兜底');
          startNetworkedGameAsHost();
        }
      }, 3000);
    } else {
      document.getElementById('mp-connected-text').textContent = '✅ 已连接，上传卡组中…';
      showStep(stepConnected);
      /* ★ 客机：立即把自己的卡组发给主机 */
      const decks = loadDecks();
      const activeId = getActiveDeckId();
      const active = decks.find(d => d.id === activeId) || decks[0];
      const deck = getActiveDeckCards();
      netSend({
        type: 'guestDeck',
        deck: deck,
        deckName: active ? active.name : '我的卡组'
      });
      console.log('[net] 已上传客机卡组:', active ? active.name : '未知', '共', deck.length, '张');
    }
  });

  onNetMessage(data => {
    if (!data || !data.type) return;

    /* ★ 主机：收到客机卡组 → 记录并开局 */
    if (data.type === 'guestDeck' && netIsHost()) {
      _guestDeck = data.deck;
      _guestDeckName = data.deckName || '对手';
      console.log('[net] 收到客机卡组:', _guestDeckName, '共', _guestDeck.length, '张');
      if (!_gameStarted) startNetworkedGameAsHost();
      return;
    }

    if (data.type === 'init' && data.for === 'guest') {
      /* 客机初始化 */
      G = deserializeG(data.state, data.mySide, { mode: 'guest' });
      document.getElementById('multiplayer-overlay').classList.add('hidden');
      document.getElementById('log').innerHTML = '';
      document.getElementById('overlay').classList.add('hidden');
      document.getElementById('mulligan-overlay').classList.add('hidden');
      hideChoiceBanner();
      showScreen('screen-game');
      render();
      log(`🐺 你控制：${data.mySide === 'player' ? '村庄（先手）' : '狼穴'}`, data.mySide);
      return;
    }
    if (data.type === 'state') {
      guestApplyState(data.state);
      return;
    }
    if (data.type === 'event') {
      guestQueueEvent(data.event);
      return;
    }
    if (data.type === 'action') {
      hostHandleGuestAction(data.action);
      return;
    }
  });

  onNetClose(() => {
    console.warn('[net] 连接已断开');
    if (G && !G.gameOver) alert('⚠️ 与对方的连接已断开');
  });

  onNetError(err => {
    console.error('[net] 网络错误', err);
  });
}

/* 主机：等待客机卡组后启动游戏 */
async function startNetworkedGameAsHost() {
  if (!netIsHost()) return;
  if (_gameStarted) return;
  _gameStarted = true;

  const hostMySide = Math.random() < 0.5 ? 'player' : 'ai';
  const guestMySide = oppSide(hostMySide);

  /* 主机卡组 */
  const hostDeck = getActiveDeckCards();
  const hostDeckName = (() => {
    const decks = loadDecks();
    const activeId = getActiveDeckId();
    const d = decks.find(x => x.id === activeId);
    return d ? d.name : '主机';
  })();

  /* 客机卡组（兜底：若没收到，用主机卡组） */
  const guestDeck = (_guestDeck && _guestDeck.length) ? _guestDeck : hostDeck;
  const guestDeckName = _guestDeckName || '对手';

  console.log('[net] 开局 — 主机方：', hostMySide, '主机卡组：', hostDeckName,
              '客机卡组：', guestDeckName);

  document.getElementById('multiplayer-overlay').classList.add('hidden');

  const opts = {
    mySide: hostMySide,
    net: { mode: 'host' },
    firstPlayer: 'player',   /* 村庄先手 */
    skipMulligan: true
  };

  if (hostMySide === 'player') {
    /* 主机是村庄（player），客机是狼穴（ai） */
    opts.playerDeck = hostDeck;
    opts.aiDeck = guestDeck;
    opts.aiDeckName = guestDeckName;
  } else {
    /* 主机是狼穴（ai），客机是村庄（player） */
    opts.playerDeck = guestDeck;
    opts.aiDeck = hostDeck;
    opts.aiDeckName = hostDeckName;
  }

  await newGame(opts);

  /* 广播初始状态给客机 */
  netSend({
    type: 'init',
    for: 'guest',
    mySide: guestMySide,
    state: serializeG(G)
  });

  log(`🐺 你控制：${hostMySide === 'player' ? '村庄（先手）' : '狼穴'}`, hostMySide);
}