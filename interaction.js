/* =========================================================
   interaction.js — 玩家操作（支持联机）
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
  if (u.isHut) return;
  const p = G[u.owner];
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
        if (t.untargetable && t.owner !== u.owner) continue;
        if (distForRange(u, { r, c }) <= range) {
          G.attackHighlights.push({ r, c });
        }
      }
    }
  }
}

/* 召唤范围：舍 3×3；普通单位走己方区域 */
function computeSummonSpots(card, side) {
  side = side || G.mySide;
  const spots = [];
  if (card && card.type === 'hut') {
    const allies = G.units.filter(u =>
      u.owner === side && !u.isBase && !u.dead && !u.isHut
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
  const zone = side === 'player' ? PLAYER_ZONE : [0, 1];
  for (let r = zone[0]; r <= zone[1]; r++)
    for (let c = 0; c < BOARD_COLS; c++)
      if (!G.board[r][c]) spots.push({ r, c });
  return spots;
}

function doMove(u, r, c) {
  if (u.isHut) return false;
  const p = G[u.owner];
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

async function onHandClick(idx, side) {
  side = side || G.mySide;
  if (!G || G.gameOver || G.busy) return;
  if (G.choiceMode || mulliganState) return;
  if (G.turn !== side) return;

  /* 客机转发 */
  if (G.net && G.net.mode === 'guest') {
    guestSendAction({ type: 'handClick', idx });
    return;
  }

  const me = G[side];
  const card = me.hand[idx];
  if (!card) return;
  if (!card._handUid) card._handUid = ++handUidSeq;

  if (isSchemeCard(card)) {
    const active = isSchemeActive(side, card._handUid);
    if (active) {
      deactivateScheme(side, card._handUid);
    } else {
      const ok = activateScheme(side, card._handUid);
      if (!ok) playSound('error');
    }
    clearSelection();
    render();
    return;
  }

  if (G.selectedCardIdx === idx) {
    clearSelection(); render(); return;
  }

  if (card.summonCost > me.mana) {
    log('法力不足', side); playSound('error'); return;
  }

  if (card.type === 'tactic') {
    if (card.id === 'expandAdvantage') {
      const myCount = G.units.filter(u => u.owner === side && !u.isBase && !u.dead).length;
      const enemyCount = G.units.filter(u => u.owner !== side && !u.isBase && !u.dead).length;
      if (myCount <= enemyCount) {
        log(`📈 扩大优势：友方单位(${myCount}) 不多于敌方(${enemyCount})，无法使用`, side);
        playSound('error'); return;
      }
    }
    await useTacticCard(idx);
    return;
  }

  if (card.id === 'werewolf') {
    const sacrifices = G.units.filter(u =>
      u.owner === side && !u.isBase && !u.dead &&
      (u.faction === '民' || u.faction === '神')
    );
    if (!sacrifices.length) {
      log('🩸 没有可献祭的友方民/神单位，无法召唤狼人', side);
      playSound('error'); return;
    }
  }

  G.selected = null;
  G.moveHighlights = [];
  G.attackHighlights = [];
  G.selectedCardIdx = idx;
  G.summonHighlights = computeSummonSpots(card, side);

  if (!G.summonHighlights.length) {
    log(card.type === 'hut'
      ? '🏘️ 没有可部署舍的位置（需友方单位周围 3×3 空位）'
      : '己方区域已满，无法召唤', side);
    playSound('error');
    G.selectedCardIdx = null; G.summonHighlights = [];
  } else {
    playSound('click');
  }
  render();
}

async function onCellClick(r, c, side) {
  side = side || G.mySide;
  if (!G || G.gameOver || mulliganState) return;

  /* 客机转发 */
  if (G.net && G.net.mode === 'guest') {
    guestSendAction({ type: 'cellClick', r, c });
    return;
  }

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
  if (G.busy || G.turn !== side) return;
  const clicked = G.board[r][c];

  if (G.selectedCardIdx !== null) {
    if (!clicked && G.summonHighlights.some(h => h.r === r && h.c === c)) {
      await playerSummon(G.selectedCardIdx, r, c, side);
      return;
    }
  }
  if (G.selected && !clicked && G.moveHighlights.some(h => h.r === r && h.c === c)) {
    const u = G.selected;
    G.busy = true;
    try {
      const p = G[u.owner];

      /* 先扣费、扣行动 */
      p.mana -= u.actionCost;
      u.actionsLeft--;
      u.moveCount = (u.moveCount || 0) + 1;

      /* 陷阱检查 */
      if (!(await checkPitfall(u))) {
        /* 主机广播移动事件 */
        if (G.net && G.net.mode === 'host') {
          hostEvent({ type: 'move', uid: u.uid, fromR: u.r, fromC: u.c, toR: r, toC: c });
        }
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
  if (G.selected && clicked && clicked.owner !== side &&
      G.attackHighlights.some(h => h.r === r && h.c === c)) {
    G.busy = true;
    try { await resolveAttack(G.selected, clicked); }
    finally { G.busy = false; }
    if (!G.gameOver) { updateHighlights(); render(); }
    return;
  }
  if (clicked && clicked.owner === side && !clicked.isBase) {
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

async function playerSummon(idx, r, c, side) {
  side = side || G.mySide;
  const me = G[side];
  const card = me.hand[idx];
  if (!card || card.summonCost > me.mana) return;
  if (card.id === 'werewolf') {
    const sacrifices = G.units.filter(u =>
      u.owner === side && !u.isBase && !u.dead &&
      (u.faction === '民' || u.faction === '神')
    );
    if (!sacrifices.length) { log('🩸 没有可献祭的友方民/神单位，无法召唤狼人', side); return; }
  }
  me.mana -= card.summonCost;
  me.hand.splice(idx, 1);
  const u = createUnit(card, side, r, c);
  placeUnit(u);
  clearSelection(); render();
  await playSummonAnimation(u);
  log(`${side === 'player' ? '🔵' : '🔴'} 召唤了 ${card.name}`, side);

  await checkAmbush(u);
  if (!G || G.gameOver) return;
  if (u.dead) return;

  if (card.id === 'elder') await triggerElderSummon(u);
  else if (card.id === 'idiot') await triggerIdiotSummon(u);
  else if (card.id === 'cupid') await triggerCupidSummon(u);
  else if (card.id === 'werewolf') await triggerWolfSummon(u);
}