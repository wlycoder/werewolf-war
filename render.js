/* =========================================================
   render.js — 渲染
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
    /* ★ 圣骑士免疫敌方的计 */
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
/* ★ 转圜：选择敌方目标（含总部） */
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
}

function renderBoard() {
  const boardEl = $('#board'); if (!boardEl) return;
  boardEl.querySelectorAll('.cell').forEach(c => c.remove());
  let fxLayer = boardEl.querySelector('#fx-layer');
  if (!fxLayer) { fxLayer = document.createElement('div'); fxLayer.id = 'fx-layer'; boardEl.appendChild(fxLayer); }

  const choiceUids = (G.choiceMode && G.choiceMode.active)
    ? new Set(G.choiceMode.candidates.map(u => u.uid)) : null;
  const choiceColor = (G.choiceMode && G.choiceMode.active)
    ? (G.choiceMode.color || 'white') : 'white';

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (r <= 1) cell.classList.add('zone-ai');
      else if (r >= BOARD_ROWS - 2) cell.classList.add('zone-player');
      else cell.classList.add('zone-mid');
      if (G.summonHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-summon');
      if (G.moveHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-move');
      if (G.attackHighlights.some(h => h.r === r && h.c === c)) cell.classList.add('hl-attack');

      const u = G.board[r][c];
      if (!u) cell.classList.add('cell-empty');   /* ★ 空格子背景 */

      if (choiceUids && u && choiceUids.has(u.uid)) {
        cell.classList.add(choiceColor === 'red' ? 'hl-sacrifice' : 'hl-choice');
      }

      if (u) {
        const el = document.createElement('div');
        el.dataset.uid = u.uid;
        if (u.isBase) {
          el.className = 'unit unit-base ' + (u.owner === 'player' ? 'unit-base-player' : 'unit-base-ai');
          if (u.hp <= 0) el.classList.add('destroyed');
        } else if (u.isHut) {
          el.className = 'unit unit-hut ' + (u.owner === 'player' ? 'unit-hut-player' : 'unit-hut-ai');
        } else {
          el.className = 'unit ' + (u.owner === 'player' ? 'unit-player' : 'unit-ai');
          if (u.actionsLeft <= 0) el.classList.add('spent');
        }
        if (G.selected && G.selected.uid === u.uid) el.classList.add('selected');

        if (u.isBase) {
          const dead = u.hp <= 0;
          const baseCls = u.owner === 'player' ? 'player-base' : 'ai-base';
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
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function renderHand() {
  const handEl = $('#hand');
  handEl.innerHTML = '';
  if (!G.player.hand.length) {
    handEl.innerHTML = '<p class="empty-tip" style="align-self:center;width:100%;">手牌已空</p>';
    return;
  }
  G.player.hand.forEach((card, idx) => {
    if (!card._handUid) card._handUid = ++handUidSeq;
    const el = document.createElement('div');
    el.className = 'hand-card';
    if (idx === G.selectedCardIdx && !isSchemeCard(card)) el.classList.add('selected');
    if (card.summonCost > G.player.mana || G.turn !== 'player' || G.gameOver || G.choiceMode || mulliganState) {
      if (isSchemeCard(card) && isSchemeActive('player', card._handUid)) { }
      else el.classList.add('disabled');
    }

    const eff = getCardDesc(card);

    if (isSchemeCard(card)) {
      const active = isSchemeActive('player', card._handUid);
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
  /* ★ 玩家法力条 */
  const manaValueEl = document.getElementById('mana-value');
  if (manaValueEl) manaValueEl.textContent = `${G.player.mana}/${G.player.maxMana}`;
  const fillEl = document.getElementById('mana-fill');
  if (fillEl) {
    const pct = G.player.maxMana > 0
      ? Math.min(100, (G.player.mana / G.player.maxMana) * 100)
      : 0;
    fillEl.style.width = pct + '%';
  }

  /* ★ 敌方法力条（红色） */
  const aiManaVal = document.getElementById('ai-mana-value');
  const aiManaFill = document.getElementById('ai-mana-fill');
  if (aiManaVal) aiManaVal.textContent = `${G.ai.mana}/${G.ai.maxMana}`;
  if (aiManaFill) {
    const aiPct = G.ai.maxMana > 0
      ? Math.min(100, (G.ai.mana / G.ai.maxMana) * 100)
      : 0;
    aiManaFill.style.width = aiPct + '%';
  }

  $('#deck-count-info').textContent = G.player.deck.length;
  const aiDeckEl = document.getElementById('ai-deck-count-info');
  if (aiDeckEl) aiDeckEl.textContent = G.ai.deck.length;

  $('#player-hand-count').textContent = G.player.hand.length;
  $('#ai-hand-count').textContent = G.ai.hand.length;
  $('#hand-limit-player').textContent = HAND_LIMIT;
  $('#hand-limit-ai').textContent = HAND_LIMIT;

  const pb = G.units.find(u => u.owner === 'player' && u.isBase);
  const ab = G.units.find(u => u.owner === 'ai' && u.isBase);
  $('#player-base-hp').textContent = pb ? Math.max(0, pb.hp) : 0;
  $('#ai-base-hp').textContent = ab ? Math.max(0, ab.hp) : 0;

  const ind = $('#turn-indicator');
  if (G.gameOver) { ind.textContent = '对局结束'; ind.className = 'turn-indicator'; }
  else if (mulliganState) { ind.textContent = '换牌阶段'; ind.className = 'turn-indicator'; }
  else if (G.turn === 'player') { ind.textContent = '你的回合'; ind.className = 'turn-indicator p-turn'; }
  else { ind.textContent = '狼人回合'; ind.className = 'turn-indicator a-turn'; }

  $('#btn-end-turn').disabled = G.gameOver || G.turn !== 'player' || !!G.choiceMode || !!mulliganState;
}
  /* ★ 取消选择按钮显隐 */
  const cancelBtn = document.getElementById('btn-cancel-selection');
  if (cancelBtn) {
    const shouldShow = !!(G.selected || G.selectedCardIdx !== null ||
                          (G.choiceMode && G.choiceMode.active));
    cancelBtn.classList.toggle('hidden', !shouldShow);
  }