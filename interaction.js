/* =========================================================
   interaction.js — 玩家操作
   ========================================================= */

function clearSelection() {
  if (!G) return;
  G.selected = null;
  G.selectedCardIdx = null;
  G.summonHighlights = [];
  G.moveHighlights = [];
  G.attackHighlights = [];
}

function updateHighlights() {
  G.moveHighlights = [];
  G.attackHighlights = [];
  const u = G.selected;
  if (!u || u.isBase || u.silenced) return;
  if (u.isHut) return;   /* ★ 舍不能移动或攻击 */
  const p = u.owner === 'player' ? G.player : G.ai;
  if (u.actionsLeft <= 0 || p.mana < u.actionCost) return;
  if ((u.moveCount || 0) < (u.moveLimit || 99)) {
    for (const [dr, dc] of getMoveDirs(u)) {
      const nr = u.r + dr, nc = u.c + dc;
      if (!inBounds(nr, nc)) continue;
      if (!G.board[nr][nc]) G.moveHighlights.push({ r: nr, c: nc });
    }
  }
  if ((u.attacksMade || 0) < (u.attackLimit || 99)) {
    const range = u.range || 1;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (r === u.r && c === u.c) continue;
        const t = G.board[r][c];
        if (!t || t.owner === u.owner) continue;
        /* ★ 圣骑士免疫敌方单位攻击 */
        if (t.untargetable && t.owner !== u.owner) continue;
        if (distForRange(u, { r, c }) <= range) {
          G.attackHighlights.push({ r, c });
        }
      }
    }
  }
}

/* ★ 召唤范围：普通单位走己方区域；舍只能部署在友方单位周围 3×3 */
function computeSummonSpots(card) {
  const spots = [];
  if (card && card.type === 'hut') {
    const allies = G.units.filter(u =>
      u.owner === 'player' && !u.isBase && !u.dead && !u.isHut
    );
    const seen = new Set();
    for (const a of allies) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = a.r + dr, c = a.c + dc;
          if (!inBounds(r, c)) continue;
          if (G.board[r][c]) continue;
          const key = r + ',' + c;
          if (seen.has(key)) continue;
          seen.add(key);
          spots.push({ r, c });
        }
      }
    }
    return spots;
  }
  for (let r = PLAYER_ZONE[0]; r <= PLAYER_ZONE[1]; r++)
    for (let c = 0; c < BOARD_COLS; c++)
      if (!G.board[r][c]) spots.push({ r, c });
  return spots;
}

function doMove(u, r, c) {
  if (u.isHut) return false;   /* ★ 舍无法移动 */
  const p = u.owner === 'player' ? G.player : G.ai;
  if (u.silenced) return false;
  if (u.actionsLeft <= 0 || p.mana < u.actionCost) return false;
  if (G.board[r][c]) return false;
  if ((u.moveCount || 0) >= (u.moveLimit || 99)) return false;
  const dr = Math.abs(r - u.r), dc = Math.abs(c - u.c);
  if (dr === 0 && dc === 0) return false;
  if (dr > 1 || dc > 1) return false;
  if (dr === 1 && dc === 1 && !u.diagonal) return false;
  p.mana -= u.actionCost;
  u.actionsLeft--;
  u.moveCount = (u.moveCount || 0) + 1;
  G.board[u.r][u.c] = null; u.r = r; u.c = c; G.board[r][c] = u;
  triggerOnActionEffect(u);
  return true;
}

async function onHandClick(idx) {
  if (!G || G.gameOver || G.busy) return;
  if (G.choiceMode || mulliganState) return;
  if (G.turn !== 'player') return;

  const card = G.player.hand[idx];
  if (!card) return;

  if (!card._handUid) card._handUid = ++handUidSeq;

  /* 策卡：激活 / 取消激活 */
  if (isSchemeCard(card)) {
    const active = isSchemeActive('player', card._handUid);
    if (active) {
      deactivateScheme('player', card._handUid);
    } else {
      const ok = activateScheme('player', card._handUid);
      if (!ok) playSound('error');
    }
    clearSelection();
    render();
    return;
  }

  /* 手牌再次点击取消选中 */
  if (G.selectedCardIdx === idx) {
    clearSelection();
    render();
    return;
  }

  /* 法力不足 */
  if (card.summonCost > G.player.mana) {
    log('法力不足', 'player');
    playSound('error');
    return;
  }

  if (card.type === 'tactic') {
    if (card.id === 'expandAdvantage') {
      const myCount = G.units.filter(u => u.owner === 'player' && !u.isBase && !u.dead).length;
      const enemyCount = G.units.filter(u => u.owner === 'ai' && !u.isBase && !u.dead).length;
      if (myCount <= enemyCount) {
        log(`📈 扩大优势：友方单位(${myCount}) 不多于敌方(${enemyCount})，无法使用`, 'player');
        playSound('error');
        return;
      }
    }
    await useTacticCard(idx);
    return;
  }

  /* 单位 / 舍 */
  if (card.id === 'werewolf') {
    const sacrifices = G.units.filter(u =>
      u.owner === 'player' && !u.isBase && !u.dead &&
      (u.faction === '民' || u.faction === '神')
    );
    if (!sacrifices.length) {
      log('🩸 没有可献祭的友方民/神单位，无法召唤狼人', 'player');
      playSound('error');
      return;
    }
  }

  G.selected = null;
  G.moveHighlights = [];
  G.attackHighlights = [];
  G.selectedCardIdx = idx;
  G.summonHighlights = computeSummonSpots(card);

  if (!G.summonHighlights.length) {
    log(card.type === 'hut'
      ? '🏘️ 没有可部署舍的位置（需友方单位周围 3×3 空位）'
      : '己方区域已满，无法召唤', 'player');
    playSound('error');
    G.selectedCardIdx = null;
    G.summonHighlights = [];
  } else {
    playSound('click');
  }
  render();
}

async function onCellClick(r, c) {
  if (!G || G.gameOver || mulliganState) return;
  if (G.choiceMode && G.choiceMode.active) {
    const u = G.board[r][c];
    if (u && G.choiceMode.candidates.some(x => x.uid === u.uid)) {
      const resolve = G.choiceMode.resolve;
      G.choiceMode = null;
      hideChoiceBanner();
      render();
      if (resolve) resolve(u);
    }
    return;
  }
  if (G.busy || G.turn !== 'player') return;
  const clicked = G.board[r][c];

  if (G.selectedCardIdx !== null) {
    if (!clicked && G.summonHighlights.some(h => h.r === r && h.c === c)) {
      await playerSummon(G.selectedCardIdx, r, c);
      return;
    }
  }
  if (G.selected && !clicked && G.moveHighlights.some(h => h.r === r && h.c === c)) {
    const u = G.selected;
    G.busy = true;
    try {
      const p = u.owner === 'player' ? G.player : G.ai;

      /* ★ 先消耗行动点与法力（即使陷阱触发，行动次数也已消耗） */
      p.mana -= u.actionCost;
      u.actionsLeft--;
      u.moveCount = (u.moveCount || 0) + 1;

      /* ★ 陷阱检查：即使触发，行动次数已消耗 */
      if (!(await checkPitfall(u))) {
        await playMoveAnimation(u, u.r, u.c, r, c);
        G.board[u.r][u.c] = null;
        u.r = r; u.c = c;
        G.board[r][c] = u;
        triggerSeerDraw(u);
        triggerOnActionEffect(u);
      }
    } finally { G.busy = false; }
    updateHighlights(); render();
    return;
  }
  if (G.selected && clicked && clicked.owner !== 'player' &&
      G.attackHighlights.some(h => h.r === r && h.c === c)) {
    G.busy = true;
    try { await resolveAttack(G.selected, clicked); }
    finally { G.busy = false; }
    if (!G.gameOver) { updateHighlights(); render(); }
    return;
  }
  if (clicked && clicked.owner === 'player' && !clicked.isBase) {
    /* ★ 舍：点击即激活 */
    if (clicked.isHut) {
      await activateHutForPlayer(clicked);
      return;
    }
    if (G.selected && G.selected.uid === clicked.uid) clearSelection();
    else {
      G.selected = clicked;
      G.selectedCardIdx = null;
      G.summonHighlights = [];
      updateHighlights();
    }
    render(); return;
  }
  clearSelection(); render();
}

async function playerSummon(idx, r, c) {
  const card = G.player.hand[idx];
  if (!card || card.summonCost > G.player.mana) return;
  if (card.id === 'werewolf') {
    const sacrifices = G.units.filter(u =>
      u.owner === 'player' && !u.isBase && !u.dead &&
      (u.faction === '民' || u.faction === '神')
    );
    if (!sacrifices.length) { log('🩸 没有可献祭的友方民/神单位，无法召唤狼人', 'player'); return; }
  }
  G.player.mana -= card.summonCost;
  G.player.hand.splice(idx, 1);
  const u = createUnit(card, 'player', r, c);
  placeUnit(u);
  clearSelection(); render();
  await playSummonAnimation(u);
  log(`你召唤了 ${card.name}`, 'player');

  /* ★ 埋伏检查 */
  await checkAmbush(u);
  if (!G || G.gameOver) return;
  if (u.dead) return;

  if (card.id === 'elder') await triggerElderSummon(u);
  else if (card.id === 'idiot') await triggerIdiotSummon(u);
  else if (card.id === 'cupid') await triggerCupidSummon(u);
  else if (card.id === 'werewolf') await triggerWolfSummon(u);
}