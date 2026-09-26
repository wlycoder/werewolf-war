/* =========================================================
   render.js — 渲染（支持联机，本机视角）
   ========================================================= */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function log(msg, who) {
  const el = $('#log'); if (!el) return;
  const div = document.createElement('div');
  div.textContent = msg;
  if (who === 'player') div.className = 'player';
  else if (who === 'ai') div.className = 'ai';
  else div.className = 'system';
  el.prepend(div);
  while (el.children.length > 60) el.lastChild.remove();
}
function showChoiceBanner(icon, text) {
  $('#choice-banner-icon').textContent = icon;
  $('#choice-banner-text').textContent = text;
  $('#choice-banner').classList.remove('hidden');
}
function hideChoiceBanner() { $('#choice-banner').classList.add('hidden'); }

function askPlayerChooseAlly(allies) {
  return new Promise(resolve => {
    G.choiceMode = { active: true, candidates: allies.slice(), resolve, color: 'white' };
    showChoiceBanner('🔮', '魔术师亡语：点击一个白光高亮的友方单位（含自身）');
    render();
  });
}
function askPlayerChooseEnemy(enemies) {
  return new Promise(resolve => {
    const pool = enemies.filter(u => !(u.untargetable));
    G.choiceMode = { active: true, candidates: pool.slice(), resolve, color: 'white' };
    showChoiceBanner('🚫', '禁言长老：点击一个白光高亮的敌方单位（不含总部）');
    render();
  });
}
function askPlayerChooseAnyUnit(units) {
  return new Promise(resolve => {
    G.choiceMode = { active: true, candidates: units.slice(), resolve, color: 'white' };
    showChoiceBanner('🤤', '请点击一个白光高亮的单位（不含总部）');
    render();
  });
}
function askPlayerChooseSacrifice(units) {
  return new Promise(resolve => {
    G.choiceMode = { active: true, candidates: units.slice(), resolve, color: 'red' };
    showChoiceBanner('🩸', '血祭：点击一个红光高亮的友方民/神单位献祭');
    render();
  });
}
function askPlayerChooseEnemyTarget(enemies) {
  return new Promise(resolve => {
    const pool = enemies.filter(u => !(u.untargetable));
    G.choiceMode = { active: true, candidates: pool.slice(), resolve, color: 'white' };
    showChoiceBanner('🎯', '点击一个白光高亮的敌方目标（含总部）');
    render();
  });
}

function render() {
  if (!G) return;
  if (G.selected && !G.units.includes(G.selected)) G.selected = null;
  renderBoard();
  renderHand();
  renderSidebar();

  /* 取消选择按钮显隐 */
  const cancelBtn = document.getElementById('btn-cancel-selection');
  if (cancelBtn) {
    const shouldShow = !!(G.selected || G.selectedCardIdx !== null ||
                          (G.choiceMode && G.choiceMode.active));
    cancelBtn.classList.toggle('hidden', !shouldShow);
  }

  /* 主机：节流广播状态 */
  if (G.net && G.net.mode === 'host') {
    const now = Date.now();
    if (!render._lastBc || now - render._lastBc > 250) {
      render._lastBc = now;
      hostBroadcastState();
    }
  }
}

function renderBoard() {
  const boardEl = $('#board'); if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach(c => c.remove());
  let fxLayer = boardEl.querySelector('#fx-layer');
  if (!fxLayer) { fxLayer = document.createElement('div'); fxLayer.id = 'fx-layer'; boardEl.appendChild(fxLayer); }

  /* ★ 视角翻转：控制狼穴方（ai）时，棋盘垂直翻转 */
  const flip = (G.mySide === 'ai');

  const choiceUids = (G.choiceMode && G.choiceMode.active)
    ? new Set(G.choiceMode.candidates.map(u => u.uid)) : null;
  const choiceColor = (G.choiceMode && G.choiceMode.active)
    ? (G.choiceMode.color || 'white') : 'white';

  /* 单元格按逻辑坐标顺序创建，通过 grid-row/grid-column 放到显示位置 */
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      /* 区域配色仍按逻辑坐标 */
      if (r <= 1) cell.classList.add('zone-ai');
      else if (r >= BOARD_ROWS - 2) cell.classList.add('zone-player');
      else cell.classList.add('zone-mid');
      if (G.summonHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-summon');
      if (G.moveHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-move');
      if (G.attackHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-attack');

      /* ★ 显示位置（翻转时上下颠倒） */
      const displayRow = flip ? (BOARD_ROWS - 1 - r) : r;
      cell.style.gridRow = String(displayRow + 1);
      cell.style.gridColumn = String(c + 1);

      const u = G.board[r][c];
      if (!u) cell.classList.add('cell-empty');

      if (choiceUids && u && choiceUids.has(u.uid)) {
        cell.classList.add(choiceColor === 'red' ? 'hl-sacrifice' : 'hl-choice');
      }

      if (u) {
        const el = document.createElement('div');
        el.dataset.uid = u.uid;
        const isMine = u.owner === G.mySide;
        if (u.isBase) {
          el.className = 'unit unit-base ' + (isMine ? 'unit-base-player' : 'unit-base-ai');
          if (u.hp <= 0) el.classList.add('destroyed');
        } else if (u.isHut) {
          el.className = 'unit unit-hut ' + (isMine ? 'unit-hut-player' : 'unit-hut-ai');
        } else {
          el.className = 'unit ' + (isMine ? 'unit-player' : 'unit-ai');
          if (u.actionsLeft <= 0) el.classList.add('spent');
        }
        if (G.selected && G.selected.uid === u.uid) el.classList.add('selected');

        if (u.isBase) {
          const dead = u.hp <= 0;
          const baseCls = isMine ? 'player-base' : 'ai-base';
          el.innerHTML = `
            <div class="unit-icon">${dead ? '💥' : iconHTML(u.icon)}</div>
            <div class="unit-name">${u.name}</div>
            <div class="unit-hp base ${baseCls} ${dead ? 'dead' : ''}">${Math.max(0, u.hp)}</div>`;
        } else if (u.isHut) {
          const used = u.hutUsedThisTurn;
          el.innerHTML = `
            <div class="unit-icon">${iconHTML(u.icon)}</div>
            <div class="unit-name">${u.name}</div>
            <div class="unit-hp">${Math.max(0, u.def)}</div>
            <div class="unit-activate ${used ? 'used' : ''}">${u.activateCost}</div>`;
        } else {
          const ready = u.actionsLeft > 0;
          const silenceTag = u.silenced ? `<div class="unit-silenced">🚫</div>` : '';
          const returnTag = u.returnToHand ? `<div class="unit-return">↩️</div>` : '';
          const hasteKw = u.keywords.find(k => k.id === 'haste');
          const hasteTag = hasteKw ? `<div class="unit-haste">👣${hasteKw.level}</div>` : '';
          el.innerHTML = `
            <div class="unit-icon">${iconHTML(u.icon)}</div>
            <div class="unit-name">${u.name}</div>
            <div class="unit-atk">${u.atk}</div>
            <div class="unit-hp">${Math.max(0, u.def)}</div>
            <div class="unit-cost">${u.actionCost}</div>
            <div class="unit-faction ${u.faction}">${u.faction}</div>
            ${ready && !u.silenced ? '<div class="unit-ready"></div>' : ''}
            ${hasteTag}${silenceTag}${returnTag}`;
        }
        cell.appendChild(el);
      }
      /* ★ 点击事件仍使用逻辑坐标 */
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function renderHand() {
  const handEl = $('#hand');
  handEl.innerHTML = '';
  const myHand = G[G.mySide]?.hand || [];
  if (!myHand.length) {
    handEl.innerHTML = '<p class="empty-tip" style="align-self:center;width:100%;">手牌已空</p>';
    return;
  }
  const me = G[G.mySide];
  const isMyTurn = G.turn === G.mySide;
  myHand.forEach((card, idx) => {
    if (!card._handUid) card._handUid = ++handUidSeq;
    const el = document.createElement('div');
    el.className = 'hand-card';
    if (idx === G.selectedCardIdx && !isSchemeCard(card)) el.classList.add('selected');
    if (card.summonCost > me.mana || !isMyTurn || G.gameOver || G.choiceMode || mulliganState) {
      if (isSchemeCard(card) && isSchemeActive(G.mySide, card._handUid)) { }
      else el.classList.add('disabled');
    }

    const eff = getCardDesc(card);

    if (isSchemeCard(card)) {
      const active = isSchemeActive(G.mySide, card._handUid);
      el.classList.add('scheme');
      if (active) el.classList.add('active');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-scheme-badge">策</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-eff">${esc(eff.length > 22 ? eff.slice(0, 22) + '…' : eff)}</div>
        <div class="hc-scheme-state">${active ? '❔' : '❓'}</div>`;
    } else if (card.type === 'tactic') {
      el.classList.add('tactic');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-tactic-badge">计</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-eff">${esc(eff.length > 24 ? eff.slice(0, 24) + '…' : eff)}</div>`;
    } else if (card.type === 'hut') {
      el.classList.add('hut');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-hut-badge">舍</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-stats">
          <span class="act">⚡激活${card.activateCost || 0}</span>
          <span class="def">🛡${card.def}</span>
        </div>
        <div class="hc-eff">${esc(eff.length > 22 ? eff.slice(0, 22) + '…' : eff)}</div>`;
    } else {
      const kw = (card.keywords || []).map(k => kwText(k)).join(' · ');
      const rng = getCardRange(card);
      const rangeTag = rng > 1 ? `<span style="color:#c4b5fd">射程${rng}</span>` : '';
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-faction ${factionClass(card.faction)}">${card.faction}</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-stats">
          <span class="atk">⚔${card.atk}</span>
          <span class="def">🛡${card.def}</span>
          <span class="act">⚡${card.actionCost}</span>
        </div>
        <div class="hc-kw">${kw}${kw && rangeTag ? ' · ' : ''}${rangeTag}</div>
        ${eff ? `<div class="hc-eff">${esc(eff.length > 16 ? eff.slice(0, 16) + '…' : eff)}</div>` : ''}`;
    }
    el.addEventListener('click', () => onHandClick(idx));
    handEl.appendChild(el);
  });
}

function renderMulligan() {
  if (!mulliganState) return;
  const handEl = $('#mulligan-hand');
  handEl.innerHTML = '';
  G.player.hand.forEach((card, idx) => {
    if (!card._handUid) card._handUid = ++handUidSeq;
    const el = document.createElement('div');
    el.className = 'hand-card';
    if (mulliganState.toReplace.has(idx)) el.classList.add('selected');
    const eff = getCardDesc(card);
    if (isSchemeCard(card)) {
      el.classList.add('scheme');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-scheme-badge">策</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-eff">${esc(eff.length > 22 ? eff.slice(0, 22) + '…' : eff)}</div>
        <div class="hc-scheme-state">❓</div>`;
    } else if (card.type === 'tactic') {
      el.classList.add('tactic');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-tactic-badge">计</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-eff">${esc(eff.length > 24 ? eff.slice(0, 24) + '…' : eff)}</div>`;
    } else if (card.type === 'hut') {
      el.classList.add('hut');
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-hut-badge">舍</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-stats">
          <span class="act">⚡激活${card.activateCost || 0}</span>
          <span class="def">🛡${card.def}</span>
        </div>`;
    } else {
      const kw = (card.keywords || []).map(k => kwText(k)).join(' · ');
      const rng = getCardRange(card);
      const rangeTag = rng > 1 ? `<span style="color:#c4b5fd">射程${rng}</span>` : '';
      el.innerHTML = `
        <div class="hc-cost">💧${card.summonCost}</div>
        <div class="hc-faction ${factionClass(card.faction)}">${card.faction}</div>
        <div class="hc-icon">${iconHTML(card.icon)}</div>
        <div class="hc-name">${card.name}</div>
        <div class="hc-stats">
          <span class="atk">⚔${card.atk}</span>
          <span class="def">🛡${card.def}</span>
          <span class="act">⚡${card.actionCost}</span>
        </div>
        <div class="hc-kw">${kw}${kw && rangeTag ? ' · ' : ''}${rangeTag}</div>`;
    }
    el.addEventListener('click', () => toggleMulliganCard(idx));
    handEl.appendChild(el);
  });
}

function renderSidebar() {
  const me = G[G.mySide];
  const opp = G[oppSide(G.mySide)];

  /* 玩家法力条 */
  const manaValueEl = document.getElementById('mana-value');
  if (manaValueEl) manaValueEl.textContent = `${me.mana}/${me.maxMana}`;
  const fillEl = document.getElementById('mana-fill');
  if (fillEl) {
    const pct = me.maxMana > 0 ? Math.min(100, (me.mana / me.maxMana) * 100) : 0;
    fillEl.style.width = pct + '%';
  }

  /* 敌方法力条 */
  const aiManaVal = document.getElementById('ai-mana-value');
  if (aiManaVal) aiManaVal.textContent = `${opp.mana}/${opp.maxMana}`;
  const aiManaFill = document.getElementById('ai-mana-fill');
  if (aiManaFill) {
    const aiPct = opp.maxMana > 0 ? Math.min(100, (opp.mana / opp.maxMana) * 100) : 0;
    aiManaFill.style.width = aiPct + '%';
  }

  $('#deck-count-info').textContent = me.deck.length;
  const aiDeckEl = document.getElementById('ai-deck-count-info');
  if (aiDeckEl) aiDeckEl.textContent = opp.deck.length;

  $('#player-hand-count').textContent = me.hand.length;
  $('#ai-hand-count').textContent = opp.hand.length;
  $('#hand-limit-player').textContent = HAND_LIMIT;
  $('#hand-limit-ai').textContent = HAND_LIMIT;

  /* 顶部 HP：左边永远是对手，右边永远是自己 */
  const myBase = G.units.find(u => u.owner === G.mySide && u.isBase);
  const oppBase = G.units.find(u => u.owner === oppSide(G.mySide) && u.isBase);

  const leftText = document.getElementById('top-left-base-text');
  if (leftText && oppBase) leftText.textContent = `${oppBase.icon} ${oppBase.name}`;
  const leftHp = document.getElementById('ai-base-hp');
  if (leftHp) leftHp.textContent = oppBase ? Math.max(0, oppBase.hp) : 0;

  const rightText = document.getElementById('top-right-base-text');
  if (rightText && myBase) rightText.textContent = `${myBase.icon} ${myBase.name}`;
  const rightHp = document.getElementById('player-base-hp');
  if (rightHp) rightHp.textContent = myBase ? Math.max(0, myBase.hp) : 0;

  const ind = $('#turn-indicator');
  const isMyTurn = G.turn === G.mySide;
  if (G.gameOver) { ind.textContent = '对局结束'; ind.className = 'turn-indicator'; }
  else if (mulliganState) { ind.textContent = '换牌阶段'; ind.className = 'turn-indicator'; }
  else if (isMyTurn) { ind.textContent = '你的回合'; ind.className = 'turn-indicator p-turn'; }
  else { ind.textContent = '对方回合'; ind.className = 'turn-indicator a-turn'; }

  $('#btn-end-turn').disabled = G.gameOver || !isMyTurn || !!G.choiceMode || !!mulliganState;
}