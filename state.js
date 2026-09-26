/* =========================================================
   state.js — 游戏状态、单位工厂、开局、回合流程、胜负
   ========================================================= */
let G = null;
let uidSeq = 0;
let handUidSeq = 0;
let mulliganState = null;
let gameStarting = false;

function makeBase(owner, r, c) {
  return {
    uid: ++uidSeq,
    name: owner === 'player' ? '村庄总部' : '狼穴总部',
    icon: '🏰', faction: '无',
    isBase: true, owner, r, c,
    hp: BASE_HP, maxHp: BASE_HP,
    atk: 0, def: BASE_HP, range: 1,
    actionsLeft: 0, maxActions: 0
  };
}

function createUnit(card, owner, r, c) {
  const keywords = card.keywords || [];
  const swift = keywords.some(k => k.id === 'swift');
  const haste = keywords.find(k => k.id === 'haste');
  const baseActions = 1 + (haste ? haste.level : 0);
  const isHut = card.type === 'hut';
  const maxActions = isHut ? 0 : (card.specialMaxActions || baseActions);
  return {
    uid: ++uidSeq,
    cardId: card.id, name: card.name, icon: card.icon,
    faction: card.faction,
    atk: isHut ? 0 : card.atk,
    def: card.def, maxDef: card.def,
    summonCost: card.summonCost,
    actionCost: isHut ? 0 : card.actionCost,
    activateCost: card.activateCost || 0,
    range: isHut ? 0 : getCardRange(card),
    keywords: keywords.map(k => ({ ...k })),
    effect: card.effect,
    returnToHand: false, silenced: false, silenceTargetUid: null,
    blessed: false,
    summonedOnTurn: (G && G.stats) ? G.stats.totalTurns : 0,
    tempSwift: false, tempHasteDelta: 0,
    moveLimit: isHut ? 0 : (card.moveLimit || 99), moveCount: 0,
    attackLimit: isHut ? 0 : (card.attackLimit || 99), attacksMade: 0,
    noRecoil: !!card.noRecoil,
    diagonal: !!card.diagonal,
    ignoresGuardian: !!card.ignoresGuardian,
    untargetable: !!card.untargetable,
    hasOnAction: !!(card.effect && card.effect.type === 'onAction' && card.id === 'guard'),
    swift, maxActions,
    actionsLeft: isHut ? 0 : (swift ? maxActions : 0),
    owner, r, c, isBase: false,
    isHut,
    hutUsedThisTurn: false,
    lastDamageFrom: null,
    tempAtk: 0,
    furyMark: null
  };
}

function placeUnit(u) { G.board[u.r][u.c] = u; G.units.push(u); }
function removeUnit(u) {
  if (G.board[u.r][u.c] === u) G.board[u.r][u.c] = null;
  G.units = G.units.filter(x => x.uid !== u.uid);
  if (G.selected && G.selected.uid === u.uid) G.selected = null;
}

function drawCard(who, options) {
  options = options || {};
  const isExtra = !!options.extra;
  const p = who === 'player' ? G.player : G.ai;

  if (isExtra && !G.gameOver) {
    if (p.noExtraDrawUntilOwnTurn) return;
    if (G.turn !== who) {
      const schemes = getActiveSchemesByCardId(who, 'integrity');
      if (schemes.length) {
        const s = schemes[0];
        const base = G.units.find(u => u.owner === who && u.isBase);
        if (base && typeof showIntegrityFx === 'function') showIntegrityFx(base.r, base.c);
        log(`💧 清廉触发！${who === 'player' ? '你' : '狼人'}本回合内不再额外抽牌`, who);
        removeSchemeFromHand(who, s);
        G.activeSchemes[who] = G.activeSchemes[who].filter(x => x.handUid !== s.handUid);
        p.noExtraDrawUntilOwnTurn = true;
        render();
        return;
      }
    }
  }

  if (p.hand.length >= HAND_LIMIT) {
    if (!p.deck.length) return;
    const c = p.deck.pop();
    if (c) { showDiscardFx(c, who); log(`🚫 手牌已满，${c.name} 被弃掉`, who); }
    return;
  }
  if (!p.deck.length) {
    const allies = G.units.filter(u => u.owner === who && !u.dead);
    if (allies.length && !G.gameOver) {
      const target = allies[Math.floor(Math.random() * allies.length)];
      showEmptyDeckFx(target.r, target.c);
      log(`💸 ${who === 'player' ? '你的' : '狼人的'}牌库已空！${target.name} 受到 2 点伤害`, who);
      setTimeout(() => { applyDamage(target, 2); }, 50);
    }
    return;
  }
  const card = p.deck.pop();
  card._handUid = ++handUidSeq;
  p.hand.push(card);
  render();
  if (isExtra) setTimeout(() => { triggerSchemesOnExtraDraw(who); }, 60);
}

function clearExpiredSchemes(who) {
  if (!G || !G.activeSchemes) return;
  const list = G.activeSchemes[who];
  if (!list || !list.length) return;
  const before = list.length;
  G.activeSchemes[who] = list.filter(s => s.activatedOnTurn === G.stats.totalTurns);
  const after = G.activeSchemes[who].length;
  if (before !== after) log(`❓ 未触发的策已自动解除（${before-after} 张）`, who);
}

async function newGame(opts = {}) {
  if (gameStarting) return;
  gameStarting = true;
  try {
    uidSeq = 0; handUidSeq = 0;

    let playerIds = opts.playerDeck && Array.isArray(opts.playerDeck)
      ? opts.playerDeck.slice()
      : getActiveDeckCards();
    const check = validateDeck(playerIds);
    if (!check.valid) playerIds = normalizeDeck(playerIds);
    const playerCards = playerIds.map(id => ({ ...CARD_MAP[id] }));

    let aiTemplate, aiCards;
    if (opts.aiDeck && Array.isArray(opts.aiDeck) && opts.aiDeck.length) {
      const aiIds = opts.aiDeck.slice();
      aiTemplate = { name: opts.aiDeckName || '好友卡组', cards: aiIds };
      aiCards = aiIds.map(id => ({ ...CARD_MAP[id] }));
    } else {
      aiTemplate = AI_DECKS[Math.floor(Math.random() * AI_DECKS.length)];
      aiCards = aiTemplate.cards.map(id => ({ ...CARD_MAP[id] }));
    }

    /* 联机：村庄先手；单机：随机 */
    let firstPlayer;
    if (opts.firstPlayer) firstPlayer = opts.firstPlayer;
    else if (opts.net) firstPlayer = 'player';
    else firstPlayer = Math.random() < 0.5 ? 'player' : 'ai';

    G = {
      board: Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null)),
      units: [], turn: null, gameOver: false, busy: false,
      selected: null, selectedCardIdx: null,
      summonHighlights: [], moveHighlights: [], attackHighlights: [],
      choiceMode: null,
      pendingTactic: null,
      activeSchemes: { player: [], ai: [] },
      stats: { playerKills: 0, aiKills: 0, totalTurns: 0 },
      aiDeckName: aiTemplate.name,
      firstPlayer,
      mySide: opts.mySide || 'player',
      net: opts.net || null,
      autoMode: !!opts.autoMode,
      evalMode: !!opts.evalMode,
      player: { mana: 0, maxMana: 0, hand: [], deck: shuffle(playerCards.slice()),
                allCards: playerCards, turnCount: 0, noExtraDrawUntilOwnTurn: false },
      ai:     { mana: 0, maxMana: 0, hand: [], deck: shuffle(aiCards.slice()),
                allCards: aiCards, turnCount: 0, noExtraDrawUntilOwnTurn: false }
    };

    placeUnit(makeBase('player', PLAYER_LAST_ROW, 2));
    placeUnit(makeBase('ai', 0, 2));

    const pStart = firstPlayer === 'player' ? HAND_START_FIRST : HAND_START_SECOND;
    const aStart = firstPlayer === 'ai'     ? HAND_START_FIRST : HAND_START_SECOND;
    for (let i = 0; i < pStart; i++) drawCard('player');
    for (let i = 0; i < aStart; i++) drawCard('ai');

    $('#log').innerHTML = '';
    $('#overlay').classList.add('hidden');
    $('#overlay-stats').innerHTML = '';
    $('#mulligan-overlay').classList.add('hidden');
    hideChoiceBanner();
    $('#overlay-icon').style.display = '';
    $('#overlay-btn').style.display = '';
    $('#overlay-title').className = '';
    showScreen('screen-game');
    render();

    if (!check.valid) log(`⚠️ 你的卡组不合法（${check.reason}），已自动修正`, 'player');

    if (!opts.skipMulligan && !opts.net) {
      await runMulliganPhase();
    } else {
      aiMulligan();
    }
    if (G.gameOver) { gameStarting = false; return; }

    render();
    if (!opts.net) log(`🐺 狼人使用卡组：${aiTemplate.name}`, 'ai');
    if (firstPlayer === 'player') log(`🎲 村庄先手`, 'player');
    else log(`🎲 狼穴先手`, 'player');
    startTurn(firstPlayer);
  } finally {
    gameStarting = false;
  }
}

function runMulliganPhase() {
  return new Promise(resolve => {
    mulliganState = { toReplace: new Set(), resolve };
    renderMulligan();
    const el = $('#mulligan-overlay');
    el.classList.remove('hidden');
    el.style.display = 'flex';
  });
}
function confirmMulligan() {
  if (!mulliganState) return;
  const toReplace = [...mulliganState.toReplace].sort((a,b)=>b-a);
  const removed = [];
  for (const idx of toReplace) if (G.player.hand[idx]) removed.push(G.player.hand.splice(idx,1)[0]);
  for (const c of removed) G.player.deck.push(c);
  G.player.deck = shuffle(G.player.deck);
  for (let i = 0; i < removed.length; i++) {
    if (G.player.deck.length) G.player.hand.push(G.player.deck.pop());
    else break;
  }
  aiMulligan();
  const el = $('#mulligan-overlay');
  el.classList.add('hidden'); el.style.display = '';
  const r = mulliganState.resolve; mulliganState = null;
  render(); if (r) r();
}
function toggleMulliganCard(idx) {
  if (!mulliganState) return;
  if (mulliganState.toReplace.has(idx)) mulliganState.toReplace.delete(idx);
  else mulliganState.toReplace.add(idx);
  renderMulligan();
}
function aiMulligan() {
  const hand = G.ai.hand; if (!hand.length || !G.ai.deck.length) return;
  let maxIdx = 0;
  hand.forEach((c,i) => { if (c.summonCost > hand[maxIdx].summonCost) maxIdx = i; });
  if (hand[maxIdx].summonCost >= 4) {
    const removed = hand.splice(maxIdx,1)[0];
    G.ai.deck.push(removed);
    G.ai.deck = shuffle(G.ai.deck);
    if (G.ai.deck.length) G.ai.hand.push(G.ai.deck.pop());
  }
}

function startTurn(who) {
  if (!G || G.gameOver) return;
  G.turn = who;
  const p = who === 'player' ? G.player : G.ai;
  p.turnCount++;
  G.stats.totalTurns++;
  p.maxMana = Math.min(MAX_MANA, 2 + p.turnCount);
  p.mana = p.maxMana;

  p.noExtraDrawUntilOwnTurn = false;

  /* 暴怒：在使用者的下个回合开始时，恢复临时攻击并 -1 防御 */
  G.units.slice().forEach(u => {
    if (u.furyMark === who && !u.isBase && !u.dead) {
      if (u.tempAtk) {
        u.atk = Math.max(0, u.atk - u.tempAtk);
        u.tempAtk = 0;
      }
      u.def -= 1;
      showStatChangeFx(u.r, u.c, -1, 'def');
      u.furyMark = null;
      if (u.def <= 0) {
        setTimeout(() => { if (u && !u.dead) { killUnit(u); render(); } }, 60);
      }
    }
  });

  clearExpiredSchemes(who);

  G.units.forEach(u => {
    if (u.owner === who && !u.isBase) {
      u.actionsLeft = u.maxActions;
      u.silenced = false;
      u.moveCount = 0;
      u.attacksMade = 0;
      u.hutUsedThisTurn = false;
    }
  });

  G.units.forEach(elder => {
    if (elder.cardId !== 'elder' || elder.dead || !elder.silenceTargetUid) return;
    if (elder.owner === who) return;
    const target = G.units.find(x => x.uid === elder.silenceTargetUid);
    if (target && !target.dead && target.owner === who && !target.isBase) {
      target.silenced = true;
      log(`🚫 ${target.name} 被 ${elder.name} 禁言，本回合无法行动`, who);
      showSilenceFx(target.r, target.c);
    }
  });

  drawCard(who, { extra: false });
  clearSelection();
  render();

  /* 联机模式：不自动触发 AI */
  if (G.net) return;

  if (who === 'ai') {
    setTimeout(() => { AI_SIDE = 'ai'; aiTurn(); }, 650);
  } else if (G && G.autoMode) {
    setTimeout(() => { AI_SIDE = 'player'; aiTurn(); }, 650);
  }
}

function endTurn() {
  if (!G || G.gameOver) return;

  /* ★ 客机点击结束回合 → 转发给主机 */
  if (G.net && G.net.mode === 'guest') {
    guestSendAction({ type: 'endTurn' });
    return;
  }

  const who = G.turn;
  G.units.forEach(u => { if (u.owner === who) u.silenced = false; });
  clearForcedMarchEffects(who);
  clearSelection();
  startTurn(who === 'player' ? 'ai' : 'player');
}

function checkGameOver() {
  if (!G || G.gameOver) return true;
  const pb = G.units.find(u => u.owner === 'player' && u.isBase);
  const ab = G.units.find(u => u.owner === 'ai' && u.isBase);
  if (!ab || ab.hp <= 0) { endGame('player'); return true; }
  if (!pb || pb.hp <= 0) { endGame('ai'); return true; }
  return false;
}

function endGame(winner) {
  if (!G || G.gameOver) return;
  G.gameOver = true; G.turn = null; G.busy = false;
  if (G.choiceMode) {
    const r = G.choiceMode.resolve; G.choiceMode = null;
    hideChoiceBanner(); if (r) r(null);
  }
  if (mulliganState) {
    const r = mulliganState.resolve; mulliganState = null;
    const el = $('#mulligan-overlay');
    el.classList.add('hidden'); el.style.display = '';
    if (r) r();
  }
  clearSelection(); render();

  if (G.evalMode) return;

  const pb = G.units.find(u => u.owner === 'player' && u.isBase);
  const ab = G.units.find(u => u.owner === 'ai' && u.isBase);
  const playerUnits = G.units.filter(u => u.owner === 'player' && !u.isBase && !u.dead);
  const aiUnits = G.units.filter(u => u.owner === 'ai' && !u.isBase && !u.dead);

  const isWin = winner === 'player';
  $('#overlay-icon').textContent = isWin ? '🏆' : '💀';
  $('#overlay-icon').style.display = '';
  $('#overlay-title').textContent = isWin ? '胜 利' : '失 败';
  $('#overlay-title').className = isWin ? 'win' : 'lose';
  $('#overlay-text').textContent = isWin
    ? `你摧毁了「${G.aiDeckName || '狼群'}」的狼穴总部！`
    : `你被「${G.aiDeckName || '狼群'}」攻陷了总部……`;

  const pHp = pb ? Math.max(0, pb.hp) : 0;
  const aHp = ab ? Math.max(0, ab.hp) : 0;

  $('#overlay-stats').innerHTML = `
    <div class="result-line"><span>对局结果</span><b class="${isWin ? 'win' : 'lose'}">${isWin ? '胜利' : '失败'}</b></div>
    <div class="result-line"><span>敌方卡组</span><b class="ai-val">${esc(G.aiDeckName || '—')}</b></div>
    <div class="result-line"><span>🔵 你方总部血量</span><b class="player-val">${pHp}</b></div>
    <div class="result-line"><span>🔴 敌方总部血量</span><b class="ai-val">${aHp}</b></div>
    <div class="result-line"><span>🔵 你方存活单位</span><b class="player-val">${playerUnits.length}</b></div>
    <div class="result-line"><span>🔴 敌方存活单位</span><b class="ai-val">${aiUnits.length}</b></div>
    <div class="result-line"><span>击杀敌方单位</span><b class="player-val">${G.stats.playerKills}</b></div>
    <div class="result-line"><span>损失我方单位</span><b class="ai-val">${G.stats.aiKills}</b></div>
    <div class="result-line"><span>总回合数</span><b style="color:#e8c86a">${G.stats.totalTurns}</b></div>
  `;

  $('#overlay').classList.remove('hidden');
}

/* =========================================================
  ★ 联机序列化 / 反序列化
   ========================================================= */
function serializeG(g) {
  if (!g) return null;
  return JSON.parse(JSON.stringify({
    board: g.board.map(row => row.map(u => u ? u.uid : null)),
    units: g.units,
    turn: g.turn,
    gameOver: g.gameOver,
    /* ★ 选择状态（让客机同步高亮） */
    selectedCardIdx: g.selectedCardIdx,
    selectedUid: g.selected ? g.selected.uid : null,
    summonHighlights: g.summonHighlights,
    moveHighlights: g.moveHighlights,
    attackHighlights: g.attackHighlights,
    /* 策 / 统计 */
    activeSchemes: g.activeSchemes,
    stats: g.stats,
    aiDeckName: g.aiDeckName,
    firstPlayer: g.firstPlayer,
    player: {
      mana: g.player.mana, maxMana: g.player.maxMana,
      hand: g.player.hand, deck: g.player.deck,
      turnCount: g.player.turnCount,
      noExtraDrawUntilOwnTurn: g.player.noExtraDrawUntilOwnTurn
    },
    ai: {
      mana: g.ai.mana, maxMana: g.ai.maxMana,
      hand: g.ai.hand, deck: g.ai.deck,
      turnCount: g.ai.turnCount,
      noExtraDrawUntilOwnTurn: g.ai.noExtraDrawUntilOwnTurn
    }
  }));
}

function deserializeG(obj, mySide, net) {
  if (!obj) return null;
  const unitMap = new Map();
  obj.units.forEach(u => unitMap.set(u.uid, u));
  const board = obj.board.map(row => row.map(uid => uid == null ? null : unitMap.get(uid)));
  return {
    board,
    units: Array.from(unitMap.values()),
    turn: obj.turn,
    gameOver: obj.gameOver,
    busy: false,
    /* ★ 恢复选择状态 */
    selected: obj.selectedUid != null ? (unitMap.get(obj.selectedUid) || null) : null,
    selectedCardIdx: obj.selectedCardIdx != null ? obj.selectedCardIdx : null,
    summonHighlights: obj.summonHighlights || [],
    moveHighlights: obj.moveHighlights || [],
    attackHighlights: obj.attackHighlights || [],
    choiceMode: null, pendingTactic: null,
    activeSchemes: obj.activeSchemes,
    stats: obj.stats,
    aiDeckName: obj.aiDeckName,
    firstPlayer: obj.firstPlayer,
    autoMode: false, evalMode: false,
    mySide: mySide,
    net: net,
    player: obj.player,
    ai: obj.ai
  };
}