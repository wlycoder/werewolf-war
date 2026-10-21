/* =========================================================
   ai.js — AI 决策（v2 强化版）
   ---------------------------------------------------------
   结构：
   ① 基础评估：单位价值 / 威胁 / 斩杀估算 / 卡组风格
   ② 行为评估：攻击收益、防守优先级、圈套与陷阱博弈
   ③ 回合流程：经济计策 → 铺场 → 战斗计策 → 行动 → 策 → 舍
   ④ 寻路：BFS 稳定接近目标（不会被己方单位卡死）
   ========================================================= */

let _aiTurnG = null;

/* ---------- 基础查询 ---------- */
function aiAlive() {
  return !!G && G === _aiTurnG && !G.gameOver && G.turn === AI_SIDE;
}
function aiFoeSide() { return AI_SIDE === 'ai' ? 'player' : 'ai'; }
function aiMe() { return G ? G[AI_SIDE] : null; }
function aiFoe() { return G ? G[aiFoeSide()] : null; }
function aiMyUnits() { return G ? G.units.filter(u => u.owner === AI_SIDE && !u.dead) : []; }
function aiFoeUnits() { return G ? G.units.filter(u => u.owner !== AI_SIDE && !u.dead) : []; }
function aiMyField() { return aiMyUnits().filter(u => !u.isBase); }
function aiFoeField() { return aiFoeUnits().filter(u => !u.isBase); }
function aiMyBase() { return G ? G.units.find(u => u.owner === AI_SIDE && u.isBase && !u.dead) : null; }
function aiFoeBase() { return G ? G.units.find(u => u.owner !== AI_SIDE && u.isBase && !u.dead) : null; }
function aiAdvance(row) { return AI_SIDE === 'ai' ? row : (BOARD_ROWS - 1 - row); }

/* ---------- 策查询 ---------- */
function aiSchemeCount(owner, cardId) {
  if (!G || !G.activeSchemes || !G.activeSchemes[owner]) return 0;
  return G.activeSchemes[owner].filter(s => s.cardId === cardId).length;
}
function aiEnemySchemeCount(cardId) { return aiSchemeCount(aiFoeSide(), cardId); }
function aiActiveSchemeTotal(owner) {
  if (!G || !G.activeSchemes || !G.activeSchemes[owner]) return 0;
  return G.activeSchemes[owner].length;
}

/* ---------- 卡牌价值 ---------- */
const AI_CARD_VALUE = {
  knight: 4, rogue: 2, magician: 6, bomber: 4, guardian: 4, hunter: 5,
  graverobber: 5, elder: 8, gatekeeper: 2, idiot: 5, guerrilla: 8, seer: 6,
  cupid: 6, werewolf: 14, witch: 5, witchhunter: 9, guard: 9, mage: 6,
  borer: 6, village: 0, fieldHospital: 4, assassin: 8, shade: 10, paladin: 16
};
/* 场上同名只保留一张的卡（多张收益极低） */
const AI_UNIQUE_ON_FIELD = new Set([
  'elder', 'graverobber', 'idiot', 'guerrilla', 'cupid', 'seer',
  'werewolf', 'witchhunter', 'guard', 'assassin', 'shade', 'paladin'
]);

function computeRecoil(attacker, target) {
  if (!target || target.isBase || target.dead) return 0;
  if (attacker.noRecoil || target.noRecoil) return 0;
  const v = computeCombatValues(attacker.faction, attacker.atk, target.faction || '无', target.atk || 0);
  return v.recoil;
}
function effectiveTarget(t) {
  if (!t || t.dead) return t;
  if (hasKeyword(t, 'guardian')) return t;
  const g = G.units.find(u => u !== t && u.owner === t.owner && !u.isBase && !u.dead &&
    u.r === t.r && hasKeyword(u, 'guardian'));
  return g || t;
}

/* 单位价值：用于交换评估、献祭选择、AI 自动选项 */
function unitValue(u) {
  if (!u || u.isBase || u.dead) return 0;
  if (u.isHut) return u.cardId === 'fieldHospital' ? 24 : 18;
  let v = (u.atk || 0) * 3.2 + (u.def || 0) * 1.8;
  if (hasKeyword(u, 'guardian')) v += 7;
  if (hasKeyword(u, 'swift')) v += 4;
  if (hasKeyword(u, 'haste')) v += ((u.maxActions || 1) - 1) * 6;
  if (u.effect && u.effect.type === 'deathrattle') v += 6;
  if (u.returnToHand) v += 3;
  if ((u.range || 1) > 1) v += ((u.range || 1) - 1) * 8;
  v += AI_CARD_VALUE[u.cardId] || 0;
  if (u.silenced) v -= 4;
  return v;
}

/* 威胁分：用于选择击杀/防守优先级 */
function threatScore(u) {
  if (!u || u.isBase || u.dead) return 0;
  if (u.isHut) return 4;
  let t = (u.atk || 0) * 4;
  t += ((u.maxActions || 1) - 1) * 10;
  if (hasKeyword(u, 'swift')) t += 4;
  if ((u.range || 1) > 1) t += ((u.range || 1) - 1) * 12;
  t += AI_CARD_VALUE[u.cardId] || 0;
  if (u.silenced) t *= 0.5;
  return t;
}

/* ---------- 卡组风格 ---------- */
function aiStyle() {
  const empty = { wolfRush: false, schemeHeavy: false, godHeavy: false, deathrattle: false, rush: false, hut: false };
  if (!G || !G[AI_SIDE]) return empty;
  if (G._aiStyle && G._aiStyleFor === AI_SIDE) return G._aiStyle;
  const cards = G[AI_SIDE].allCards || [];
  const cnt = id => cards.filter(c => c && c.id === id).length;
  const gods = cards.filter(c => c && c.faction === '神').length;
  const style = {
    wolfRush: cnt('werewolf') >= 2 || (AI_SIDE === 'ai' && String(G.aiDeckName || '').includes('突袭')),
    schemeHeavy: cnt('raid') + cnt('snare') + cnt('pitfall') + cnt('ambush') +
      cnt('greed') + cnt('revenge') + cnt('cheapScheme') + cnt('integrity') >= 4,
    godHeavy: gods >= 10,
    deathrattle: cnt('magician') + cnt('bomber') + cnt('witch') >= 3,
    rush: cnt('werewolf') + cnt('assassin') + cnt('shade') + cnt('forcedMarch') >= 4,
    hut: cnt('village') + cnt('fieldHospital') > 0
  };
  G._aiStyle = style;
  G._aiStyleFor = AI_SIDE;
  return style;
}
function isWolfRushDeck() { return !!aiStyle().wolfRush; }

/* ---------- 总部威胁 ---------- */
function getBaseThreats() {
  if (!G) return [];
  const myBase = aiMyBase();
  if (!myBase || myBase.hp <= 0) return [];
  const threats = [];
  for (const e of aiFoeUnits()) {
    if (e.isBase || e.isHut || e.untargetable) continue;
    if (distForRange(e, myBase) <= (e.range || 1)) threats.push(e);
  }
  return threats;
}
function isThreatToBase(e) {
  if (!e || e.owner === AI_SIDE || e.dead || e.isBase || e.isHut || e.untargetable) return false;
  const myBase = aiMyBase();
  if (!myBase || myBase.hp <= 0) return false;
  return distForRange(e, myBase) <= (e.range || 1);
}
function enemiesInRange(u) {
  const res = [];
  if (!u || u.isHut) return res;
  const range = u.range || 1;
  for (const t of G.units) {
    if (t.owner === u.owner || t.dead) continue;
    if (t.untargetable && t.owner !== u.owner) continue;
    if (distForRange(u, t) <= range) res.push(t);
  }
  return res;
}

/* ---------- 斩杀评估 ---------- */
function estimateBaseDamage() {
  const base = aiFoeBase();
  if (!base) return 0;
  const p = aiMe();
  if (!p) return 0;
  let total = 0;
  for (const u of aiMyUnits()) {
    if (u.isBase || u.isHut || u.silenced) continue;
    if ((u.actionsLeft || 0) <= 0) continue;
    if ((u.attacksMade || 0) >= (u.attackLimit || 99)) continue;
    if ((u.atk || 0) <= 0) continue;
    if (p.mana < (u.actionCost || 0)) continue;
    const v = computeCombatValues(u.faction, u.atk, base.faction || '无', base.atk || 0);
    if (v.damage <= 0) continue;
    const rng = u.range || 1;
    const d = distForRange(u, base);
    if (d <= rng) total += v.damage;
    else if ((u.moveCount || 0) < (u.moveLimit || 99) && d - rng <= 1) total += v.damage;
  }
  const hand = p.hand || [];
  for (const c of hand) {
    if (!c || c.type !== 'tactic' || (c.summonCost || 0) > p.mana) continue;
    if (c.id === 'granary') total += Math.max(0, 9 - (aiFoe().hand || []).length);
    else if (c.id === 'lastStand' && (!aiMyBase() || aiMyBase().hp > 3)) total += 3;
    else if (c.id === 'turnaround') total += 2;
    else if (c.id === 'fury') {
      for (const u of aiMyUnits()) {
        if (u.isBase || u.isHut || (u.atk || 0) <= 0) continue;
        if (distForRange(u, base) <= (u.range || 1)) total += 2;
      }
    }
  }
  return total;
}
function isLethalAvailable() {
  const base = aiFoeBase();
  if (!base) return false;
  return estimateBaseDamage() >= base.hp;
}
function canKillWith(attacker, target) {
  if (!attacker || !target || target.dead) return false;
  const eff = effectiveTarget(target);
  const v = computeCombatValues(attacker.faction, attacker.atk, eff.faction || '无', eff.atk || 0);
  if (v.damage <= 0) return false;
  if (eff.isBase) return eff.hp <= v.damage;
  return eff.def <= v.damage;
}

/* =========================================================
   攻击收益评估
   ========================================================= */
function aiAttackEval(attacker, target, focusUid) {
  if (!attacker || !target || attacker.dead || target.dead) return null;
  const eff = effectiveTarget(target);
  if (!eff || eff.dead) return null;
  if (eff.untargetable && eff.owner !== attacker.owner) return null;

  const v = computeCombatValues(attacker.faction, attacker.atk, eff.faction || '无', eff.atk || 0);
  let recoil = v.recoil;
  if (attacker.noRecoil || eff.noRecoil) recoil = 0;
  const dmg = v.damage;
  if (dmg <= 0) return { target, eff, dmg, recoil, kill: false, selfDie: false, overkill: 0, score: -999 };

  const ev = { target, eff, dmg, recoil, kill: false, selfDie: false, overkill: 0, score: 0 };

  if (eff.isBase) {
    ev.kill = dmg >= eff.hp;
    ev.score = ev.kill ? 100000 : dmg * 16 + (eff.hp <= 8 ? 10 : 0);
  } else {
    ev.kill = dmg >= eff.def;
    ev.overkill = ev.kill ? dmg - eff.def : 0;
    if (ev.kill) ev.score = unitValue(eff) * 12 + 25;
    else ev.score = Math.min(dmg, eff.def) * 6 + threatScore(eff) * 0.9;
    if (eff.cardId === 'guerrilla') {
      ev.kill = false;             // 会被撤退闪避，除非已无路可退
      ev.score -= 35;
      if (isThreatToBase(eff)) ev.score += 30;
    }
    if (eff.isHut) ev.score += 10;
  }

  if (recoil > 0) ev.score -= recoil * 4;
  if (!attacker.isBase && recoil >= (attacker.def || 0)) {
    ev.selfDie = true;
    ev.score -= unitValue(attacker) * (ev.kill ? 0.45 : 1.15);
  }
  if (focusUid && eff.uid === focusUid) ev.score += 35;
  if (!eff.isBase && isThreatToBase(eff)) ev.score += 30;
  if (!eff.isBase && (eff.range || 1) > 1) ev.score += 12;
  if (attacker.cardId === 'assassin' && eff.isBase) ev.score += 35;
  if (attacker.cardId === 'borer' && !eff.isBase) ev.score += 6;
  if (attacker.cardId === 'seer') {
    const deck = aiMe() ? aiMe().deck.length : 0;
    ev.score += deck > 0 ? 4 : -40;          // 牌库已空时行动会触发疲劳
  }
  return ev;
}

function pickTarget(attacker, enemies, focusUid, baseThreats) {
  let best = null, bestScore = -Infinity;
  for (const e of enemies) {
    const ev = aiAttackEval(attacker, e, focusUid);
    if (!ev || ev.dmg <= 0) continue;
    let s = ev.score;
    if (baseThreats && baseThreats.indexOf(e) >= 0) s += 45;
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best;
}

/* =========================================================
   移动：BFS 寻路
   ========================================================= */
function aiPassable(r, c) {
  return inBounds(r, c) && !G.board[r][c];
}

/* 返回通往“可攻击目标的位置”的下一步；无路可走时返回最接近的一步 */
function aiNextStep(u, target) {
  const range = u.range || 1;
  const dirs = getMoveDirs(u);
  const startKey = u.r * BOARD_COLS + u.c;
  const visited = new Set([startKey]);
  const queue = [];
  let fallback = null, fallbackD = Infinity;

  for (const [dr, dc] of dirs) {
    const nr = u.r + dr, nc = u.c + dc;
    if (!aiPassable(nr, nc)) continue;
    const k = nr * BOARD_COLS + nc;
    if (visited.has(k)) continue;
    visited.add(k);
    queue.push({ r: nr, c: nc, first: { r: nr, c: nc } });
  }

  let head = 0;
  while (head < queue.length && head < 400) {
    const cur = queue[head++];
    if (distForRange(cur, target) <= range) return cur.first;
    const d = distForRange(cur, target);
    if (d < fallbackD) { fallbackD = d; fallback = cur.first; }
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (!aiPassable(nr, nc)) continue;
      const k = nr * BOARD_COLS + nc;
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ r: nr, c: nc, first: cur.first });
    }
  }
  return fallback;
}

/* 选择这回合要靠近的目标 */
function aiPickMoveTarget(u) {
  const baseThreats = getBaseThreats();
  const style = aiStyle();
  const myBase = aiMyBase();
  const enemyBase = aiFoeBase();
  let best = null, bestScore = -Infinity;
  const consider = (t, s) => { if (s > bestScore) { bestScore = s; best = t; } };

  /* ① 正在攻击己方总部的单位最优先 */
  for (const t of baseThreats) {
    consider(t, 160 + threatScore(t) * 1.5 - distForRange(u, t) * 8);
  }

  /* ② 其他敌方单位 */
  for (const e of aiFoeUnits()) {
    if (e.isBase || e.isHut || e.untargetable) continue;
    const eff = effectiveTarget(e);
    const d = distForRange(u, eff);
    let s = 40 - d * 9 + Math.min(threatScore(eff), 140) * 0.8;
    if (d <= (u.range || 1)) s += 30;
    if (eff.def <= (u.atk || 0)) s += 25;
    if ((eff.range || 1) > 1) s += 20;
    if (isThreatToBase(eff)) s += 55;
    if (myBase) s += Math.max(0, 6 - distForRange(eff, myBase)) * 5;
    if (eff.cardId === 'guerrilla') s -= 12;
    consider(eff, s);
  }

  /* ③ 敌方总部 */
  if (enemyBase) {
    let s = 25 - distForRange(u, enemyBase) * 9;
    if (style.wolfRush) s += 55;
    if (style.rush) s += 18;
    if (baseThreats.length) s -= 70;
    if (enemyBase.hp <= Math.max(6, (u.atk || 0) * 2)) s += 30;
    consider(enemyBase, s);
  }
  return best;
}

/* 陷阱存在时，只让最廉价的单位去探路 */
function aiMayWalkIntoTraps(u) {
  if (aiEnemySchemeCount('pitfall') <= 0) return true;
  const base = aiMyBase();
  if (base && base.hp <= 3) return true;
  const movers = aiMyUnits().filter(x =>
    !x.isBase && !x.isHut && !x.dead && !x.silenced &&
    (x.actionsLeft || 0) > 0 && (x.moveCount || 0) < (x.moveLimit || 99)
  );
  if (!movers.length) return false;
  const cheapest = movers.reduce((a, b) => (unitValue(a) <= unitValue(b) ? a : b));
  if (cheapest !== u) return false;
  if (movers.length === 1 && unitValue(u) > 26) return false;
  return true;
}

async function aiMoveUnit(u, step) {
  if (!aiAlive() || !u || u.isHut || u.dead || !step) return false;
  if ((u.moveCount || 0) >= (u.moveLimit || 99)) return false;
  const p = aiMe();
  if ((u.actionsLeft || 0) <= 0 || p.mana < (u.actionCost || 0)) return false;

  const fromR = u.r, fromC = u.c;
  p.mana -= u.actionCost || 0;
  u.actionsLeft--;
  u.moveCount = (u.moveCount || 0) + 1;

  if (await checkPitfall(u)) { render(); return true; }
  if (!aiAlive()) return false;

  if (G.net && G.net.mode === 'host' && typeof hostEvent === 'function') {
    hostEvent({ type: 'move', uid: u.uid, fromR, fromC, toR: step.r, toC: step.c });
  }

  await playMoveAnimation(u, fromR, fromC, step.r, step.c);
  if (G.board[fromR][fromC] === u) G.board[fromR][fromC] = null;
  u.r = step.r; u.c = step.c;
  G.board[u.r][u.c] = u;
  triggerSeerDraw(u);
  triggerOnActionEffect(u);
  render();
  return true;
}

/* =========================================================
   回合开始前：保留多少法力用于行动
   ========================================================= */
function aiAttackersReady() {
  const p = aiMe();
  if (!p) return [];
  return aiMyUnits().filter(u =>
    !u.isBase && !u.isHut && !u.dead && !u.silenced &&
    (u.actionsLeft || 0) > 0 && (u.atk || 0) > 0 &&
    p.mana >= (u.actionCost || 0) &&
    (u.attacksMade || 0) < (u.attackLimit || 99) &&
    enemiesInRange(u).length > 0
  );
}
function aiManaReserve() {
  let reserve = 0;
  const p = aiMe();
  const field = aiMyField().filter(u => !u.isHut);

  for (const u of aiAttackersReady()) {
    let good = false;
    for (const f of enemiesInRange(u)) {
      const ev = aiAttackEval(u, f, null);
      if (ev && ev.dmg > 0 && (ev.kill || ev.dmg >= 3 || isThreatToBase(ev.eff))) { good = true; break; }
    }
    if (good) reserve += (u.actionCost || 0);
  }
  if (getBaseThreats().length) reserve += 1;

  /* 预留便宜且收益高的计策（上限保守，避免压住铺场） */
  if (p) {
    const hitters = aiAttackersReady().length;
    for (const c of p.hand || []) {
      if (!c || c.type !== 'tactic') continue;
      if (c.id === 'forcedMarch' && field.length >= 3) reserve += 1;
      else if (c.id === 'expandAdvantage' && field.length >= 2) reserve += 1;
      else if (c.id === 'fury' && hitters >= 2 && field.length >= 3) reserve += 3;
    }
  }
  return Math.min(reserve, 4);
}

/* 总部当前承受的一次性伤害（用于判断是否进入防守状态） */
function aiBaseDanger() {
  const base = aiMyBase();
  if (!base) return 0;
  let dmg = 0;
  for (const t of getBaseThreats()) {
    const v = computeCombatValues(t.faction, t.atk, '无', 0);
    const acts = Math.max(1, t.maxActions || 1);
    dmg += Math.max(0, v.damage) * acts;
  }
  return dmg;
}
function aiBaseEmergency() {
  const base = aiMyBase();
  if (!base) return false;
  const danger = aiBaseDanger();
  return danger > 0 && (base.hp <= danger + 2 || base.hp <= 6);
}

/* =========================================================
   召唤：选牌 + 选位
   ========================================================= */
function aiSummonScore(card, ctx) {
  const p = ctx.p;
  const cost = card.summonCost || 0;
  if (cost > p.mana) return -Infinity;

  const isHut = card.type === 'hut';
  const myHuts = ctx.myAll.filter(u => u.isHut).length;
  if (isHut && myHuts >= 1) return -Infinity;

  const emergency = hasKeyword(card, 'guardian') && ctx.baseThreats.length > 0;
  if (!emergency && cost > p.mana - ctx.reserve) return -Infinity;

  const id = card.id;
  const myIds = ctx.myField.map(u => u.cardId);
  const has = x => myIds.indexOf(x) >= 0;

  if (AI_UNIQUE_ON_FIELD.has(id) && has(id)) return -Infinity;

  let s = cost * 2.2 + (card.atk || 0) * 1.7 + (card.def || 0) * 1.2;
  s += (AI_CARD_VALUE[id] || 0) * 0.8;
  if (hasKeyword(card, 'swift')) s += 4;
  const haste = (card.keywords || []).find(k => k.id === 'haste');
  if (haste) s += (haste.level || 0) * 6;
  const rng = getCardRange(card);
  if (rng > 1) s += 8 + (rng - 1) * 6;
  if (card.untargetable) s += 12;
  if (card.noRecoil) s += 4;
  if (card.diagonal) s += 4;
  if (hasKeyword(card, 'guardian')) s += (ctx.baseThreats.length || (ctx.myBase && ctx.myBase.hp <= 8)) ? 22 : 6;

  if (id === 'elder' && ctx.foeField.some(e => threatScore(e) >= 30)) s += 8;
  if (id === 'cupid' && ctx.myField.length >= 2) s += 6;
  if (id === 'mage') {
    const schemes = p.hand.filter(c => c.type === 'scheme').length + aiActiveSchemeTotal(AI_SIDE);
    s += schemes * 4;
  }
  if (id === 'witch' && ctx.myBase && ctx.myBase.hp <= 9) s += 7;
  if (id === 'seer' && p.hand.length <= 5) s += 4;
  if (id === 'borer' && ctx.foe.deck.length <= 10) s += 5;
  if ((id === 'hunter' || id === 'witchhunter') && ctx.foeField.some(e => (e.range || 1) > 1)) s += 5;
  if (id === 'bomber' && ctx.foeField.length > ctx.myField.length) s += 7;
  if (id === 'graverobber' && ctx.myField.length >= 3) s += 4;
  if ((id === 'assassin' || id === 'shade') && (ctx.style.rush || ctx.style.wolfRush)) s += 8;
  if (id === 'fieldHospital' && ctx.myAll.some(u => u.def < (u.maxDef || u.def))) s += 10;
  if (id === 'village') s += 4;
  if (ctx.myField.length <= 2 && (card.atk || 0) >= 2) s += 5;
  if (ctx.enemyBase && ctx.enemyBase.hp <= 8 && (card.atk || 0) >= 3) s += 5;

  if (id === 'werewolf') {
    const sacs = ctx.myField.filter(u => (u.faction === '民' || u.faction === '神'));
    if (!sacs.length) return -Infinity;
    const cheapest = Math.min.apply(null, sacs.map(unitValue));
    if (cheapest > 28 && !ctx.style.wolfRush) return -Infinity;
    s += ctx.style.wolfRush ? 16 : 6;
    s -= Math.max(0, cheapest - 20) * 0.9;
  }
  return s;
}

function aiChooseSummonSpot(card, spots) {
  if (!spots || !spots.length) return null;
  const isHut = card.type === 'hut';
  const isRanged = getCardRange(card) > 1;
  const guardian = hasKeyword(card, 'guardian');
  const myBase = aiMyBase();
  const baseUnderThreat = getBaseThreats().length > 0;
  const enemyRanged = aiFoeField().some(u => (u.range || 1) > 1);
  let best = spots[0], bestScore = -Infinity;

  for (const sp of spots) {
    const adv = aiAdvance(sp.r);
    let s = 0;
    if (isHut) s -= adv * 6;
    else if (guardian) s += baseUnderThreat ? adv * 10 : adv * 3 + 2;
    else if (isRanged) s -= adv * 5;
    else s += adv * 4;

    if (isRanged && enemyRanged) s -= adv * 3;
    if (myBase) s -= Math.abs(sp.c - myBase.c) * 1.2;
    if (card.id === 'assassin' || card.id === 'shade') s += adv * 5;
    if (card.id === 'elder' || card.id === 'graverobber' || card.id === 'seer') s -= adv * 4;
    if (card.id === 'bomber') s -= adv * 2;
    if (card.id === 'fieldHospital' || card.id === 'village') s -= adv * 2;

    if (s > bestScore) { bestScore = s; best = sp; }
  }
  return best;
}

async function aiSummonPhase() {
  const style = aiStyle();
  for (let guard = 0; guard < 10; guard++) {
    if (!aiAlive()) return;
    const p = aiMe();
    const myAll = aiMyField();
    const myField = myAll.filter(u => !u.isHut);
    if (myField.length >= 7) return;

    const ctx = {
      p, style,
      myAll, myField,
      foeField: aiFoeField().filter(u => !u.isHut),
      myBase: aiMyBase(),
      enemyBase: aiFoeBase(),
      foe: aiFoe(),
      baseThreats: getBaseThreats(),
      reserve: aiManaReserve()
    };

    let best = null;
    for (const card of p.hand) {
      if (!card || card.type === 'tactic' || card.type === 'scheme') continue;
      const spots = computeSummonSpots(card, AI_SIDE);
      if (!spots.length) continue;
      const score = aiSummonScore(card, ctx);
      if (score === -Infinity) continue;
      if (!best || score > best.score) best = { card, spots, score };
    }
    if (!best) return;

    const spot = aiChooseSummonSpot(best.card, best.spots);
    if (!spot) return;

    p.mana -= best.card.summonCost || 0;
    const idx = p.hand.indexOf(best.card);
    if (idx < 0) continue;
    p.hand.splice(idx, 1);

    const u = createUnit(best.card, AI_SIDE, spot.r, spot.c);
    placeUnit(u);
    log(`${AI_SIDE === 'player' ? '🔵' : '🐺'} 召唤了 ${best.card.name}`, AI_SIDE);
    render();
    await playSummonAnimation(u);

    await checkAmbush(u);
    if (!aiAlive()) return;
    if (u.dead) continue;

    if (best.card.id === 'elder') await triggerElderSummon(u);
    else if (best.card.id === 'idiot') await triggerIdiotSummon(u);
    else if (best.card.id === 'cupid') await triggerCupidSummon(u);
    else if (best.card.id === 'werewolf') await triggerWolfSummon(u);
    if (!aiAlive()) return;
    await sleep(120);
  }
}

/* =========================================================
   计策：使用时机
   ========================================================= */
const AI_TACTIC_PRIORITY = {
  economy: { merchant: 1, harvest: 2, compromise: 3, standoff: 4, bribe: 5 },
  clear: { lastStand: 1, granary: 2, turnaround: 3 },
  combat: {
    expandAdvantage: 2, forcedMarch: 3, fury: 4,
    hymn: 5, rest: 6, mechwolf: 7
  }
};

function aiShouldCastTactic(card, phase) {
  const p = aiMe(), enemy = aiFoe();
  if (!p || !enemy) return false;
  const cost = card.summonCost || 0;
  if (cost > p.mana) return false;

  const myBase = aiMyBase(), enemyBase = aiFoeBase();
  const myField = aiMyField().filter(u => !u.isHut);
  const foeField = aiFoeField().filter(u => !u.isHut);
  const hand = p.hand.length, enemyHand = enemy.hand.length;
  const id = card.id;

  /* 保证使用计策后仍有法力行动 */
  const attackers = aiAttackersReady();
  const actionReserve = Math.min(3, attackers.reduce((s, u) => s + (u.actionCost || 0), 0));
  const spare = p.mana - cost;

  if (phase === 'economy') {
    if (id === 'merchant') return p.hand.length <= 4 && p.deck.length >= 4;
    if (id === 'standoff') {
      if (enemy.deck.length === 0) return true;
      return p.deck.length >= 5 && hand <= 6;
    }
    if (id === 'compromise') {
      if (p.deck.length < 3) return false;
      if (myBase && myBase.hp <= 10) return true;
      return hand <= 5;
    }
    if (id === 'harvest') return p.deck.length >= 3 && hand > enemyHand && hand <= 5;
    if (id === 'bribe') {
      if (enemyHand >= HAND_LIMIT - 1) return true;      // 对方手牌将溢出
      const combo = aiSchemeCount(AI_SIDE, 'raid') + aiSchemeCount(AI_SIDE, 'greed');
      return combo > 0 && enemyHand <= 4;
    }
    return false;
  }

  if (phase === 'clear') {
    if (id !== 'lastStand' && id !== 'granary' && id !== 'turnaround') return false;
  } else if (phase === 'combat') {
    if (id === 'lastStand' || id === 'granary' || id === 'turnaround') return false;
  }

  /* combat phase */
  if (id === 'expandAdvantage') return p.deck.length >= 3 && myField.length > foeField.length && hand <= 6;
  if (id === 'fury') {
    if (isLethalAvailable()) return true;
    const hitters = myField.filter(u => (u.actionsLeft || 0) > 0 && enemiesInRange(u).length > 0).length;
    return hitters >= 2;
  }
  if (id === 'forcedMarch') {
    return myField.length >= 2;
  }
  if (id === 'hymn') {
    if (myBase && myBase.hp <= 6) return spare >= 0;
    const gods = myField.filter(u => u.faction === '神').length +
      p.hand.filter(c => c.type === 'unit' && c.faction === '神').length;
    return gods >= 3 && spare >= actionReserve;
  }
  if (id === 'rest') {
    const civ = myField.filter(u => u.faction === '民' || u.faction === '无').length;
    if (civ <= 0) return false;
    if (civ >= 2) return spare >= Math.min(1, actionReserve);
    return myBase && myBase.hp <= 10 && spare >= 0;
  }
  if (id === 'lastStand') {
    if (myBase && myBase.hp <= 3) return false;
    if (enemyBase && enemyBase.hp <= 3) return true;
    /* 只在自己受到的损失明显小于敌方时使用（被消灭的单位会洗入己方牌库） */
    const myLoss = myField.filter(u => u.def <= 3).reduce((s, u) => s + unitValue(u), 0);
    const foeGain = foeField.filter(u => u.def <= 3).reduce((s, u) => s + unitValue(u), 0);
    return myBase && myBase.hp > 8 && hand <= 5 && (foeGain - myLoss) >= 30;
  }
  if (id === 'turnaround') {
    if (aiActiveSchemeTotal(aiFoeSide()) >= 2) return true;
    const killable = foeField.filter(u => !u.untargetable && u.def <= 2 && threatScore(u) >= 20);
    return killable.length > 0 && spare >= Math.min(1, actionReserve);
  }
  if (id === 'granary') {
    const dmg = Math.max(0, 9 - enemyHand);
    if (dmg <= 0) return false;
    if (enemyBase && enemyBase.hp <= dmg) return true;
    const valuableKill = foeField.some(u => !u.untargetable && u.def <= dmg && threatScore(u) >= 25);
    return valuableKill || dmg >= 5;
  }
  if (id === 'mechwolf') {
    const ownGood = myField.filter(u => ['magician', 'cupid', 'witch', 'elder', 'idiot'].indexOf(u.cardId) >= 0);
    if (ownGood.length) return true;
    const bomber = myField.find(u => u.cardId === 'bomber');
    return !!bomber && aiStyle().deathrattle && foeField.length > myField.length + 1;
  }
  return false;
}

async function aiCastTactic(card) {
  const p = aiMe();
  if (!p) return false;
  const idx = p.hand.indexOf(card);
  if (idx < 0) return false;
  const cost = card.summonCost || 0;
  if (p.mana < cost) return false;

  p.mana -= cost;
  p.hand.splice(idx, 1);
  log(`${AI_SIDE === 'player' ? '🔵' : '🐺'} 使用了计策：${card.name}`, AI_SIDE);
  render();
  await sleep(200);

  await triggerSchemesOnEnemyTactic(AI_SIDE, card);
  if (!aiAlive()) return true;

  if (card.effect && card.effect.trigger) {
    const fn = TACTIC_REGISTRY[card.effect.trigger];
    if (typeof fn === 'function') {
      try { await fn(card); } catch (err) { console.error('[ai] 计策异常', card.id, err); }
    }
  }
  render();
  await sleep(240);
  return true;
}

async function aiTacticPhase(phase) {
  if (!aiAlive()) return;
  const p = aiMe();
  if (!p) return;
  const order = AI_TACTIC_PRIORITY[phase] || {};
  const snapshot = p.hand.filter(c => c && c.type === 'tactic').slice();
  snapshot.sort((a, b) => {
    const oa = order[a.id] != null ? order[a.id] : 50;
    const ob = order[b.id] != null ? order[b.id] : 50;
    if (oa !== ob) return oa - ob;
    return (a.summonCost || 0) - (b.summonCost || 0);
  });

  for (const card of snapshot) {
    if (!aiAlive()) return;
    if (p.hand.indexOf(card) < 0) continue;
    if ((card.summonCost || 0) > p.mana) continue;
    if (!aiShouldCastTactic(card, phase)) continue;
    await aiCastTactic(card);
  }
}

/* =========================================================
   策：激活时机（放在行动之后，消耗剩余法力）
   ========================================================= */
function aiShouldActivateScheme(card) {
  const p = aiMe(), enemy = aiFoe();
  if (!p || !enemy) return false;
  const foeField = aiFoeField().filter(u => !u.isHut);
  const myBase = aiMyBase();
  const id = card.id;

  if (id === 'raid') return enemy.hand.length <= 5 || enemy.deck.length <= 8;
  if (id === 'cheapScheme') return enemy.hand.length >= 3;
  if (id === 'revenge') return !!(myBase && myBase.hp <= 11);
  if (id === 'snare') return foeField.filter(u => (u.atk || 0) > 0).length >= 2;
  if (id === 'pitfall') return foeField.length >= 2;
  if (id === 'ambush') return true;
  if (id === 'greed') return aiSchemeCount(AI_SIDE, 'raid') > 0 || enemy.deck.length >= 12;
  if (id === 'integrity') {
    const foeSchemes = aiSchemeCount(aiFoeSide(), 'raid') + aiSchemeCount(aiFoeSide(), 'greed') +
      aiSchemeCount(aiFoeSide(), 'integrity');
    return foeSchemes > 0 || enemy.deck.length <= 10;
  }
  return false;
}

async function aiSchemePhase() {
  if (!aiAlive()) return;
  const p = aiMe();
  if (!p) return;
  const cards = p.hand.filter(c => isSchemeCard(c));
  for (const card of cards) {
    if (!aiAlive()) return;
    if (p.hand.indexOf(card) < 0) continue;
    if (!card._handUid) card._handUid = ++handUidSeq;
    if (isSchemeActive(AI_SIDE, card._handUid)) continue;
    if ((card.summonCost || 0) > p.mana) continue;
    if (!aiShouldActivateScheme(card)) continue;
    if (activateScheme(AI_SIDE, card._handUid)) {
      render();
      await sleep(240);
    }
  }
}

/* =========================================================
   舍：激活时机
   ========================================================= */
function aiShouldActivateHut(hut) {
  const p = aiMe();
  if (!p) return false;
  if ((p.mana || 0) < (hut.activateCost || 0)) return false;
  if (hut.cardId === 'fieldHospital') {
    const injured = aiMyUnits().filter(u => !u.isBase && !u.dead && u.def < (u.maxDef || u.def));
    const missing = injured.reduce((s, u) => s + ((u.maxDef || u.def) - u.def), 0);
    return missing >= 4 || getBaseThreats().length > 0;
  }
  if (p.hand.length >= HAND_LIMIT) return false;
  return true;
}

async function aiHutActivatePhase() {
  if (!aiAlive()) return;
  const huts = aiMyUnits()
    .filter(u => u.isHut && !u.dead && !u.hutUsedThisTurn)
    .sort((a, b) => (a.cardId === 'fieldHospital' ? -1 : 1) - (b.cardId === 'fieldHospital' ? -1 : 1));
  for (const h of huts) {
    if (!aiAlive()) return;
    if (!aiShouldActivateHut(h)) continue;
    await activateHut(h, AI_SIDE);
    render();
    await sleep(200);
  }
}

/* =========================================================
   行动阶段
   ========================================================= */
async function aiActionPhase() {
  let focusUid = null;

  for (let guard = 0; guard < 120; guard++) {
    if (!aiAlive()) return;
    if (G.choiceMode) return;                 // 等待选择结果

    const p = aiMe();
    const ready = aiMyUnits().filter(u =>
      !u.isBase && !u.isHut && !u.dead && !u.silenced &&
      (u.actionsLeft || 0) > 0 && p.mana >= (u.actionCost || 0)
    );
    if (!ready.length) return;

    if (focusUid && !G.units.some(u => u.uid === focusUid && !u.dead)) focusUid = null;

    const baseThreats = getBaseThreats();
    const enemyBase = aiFoeBase();
    const lethal = isLethalAvailable();
    const snares = aiEnemySchemeCount('snare');
    const traps = aiEnemySchemeCount('pitfall');
    const emergency = aiBaseEmergency();

    /* ① 圈套博弈：用最廉价的单位骗掉圈套 */
    let skipAttacks = false;
    if (snares > 0) {
      const attackers = ready.filter(u =>
        (u.atk || 0) > 0 &&
        (u.attacksMade || 0) < (u.attackLimit || 99) &&
        enemiesInRange(u).length > 0
      );
      if (attackers.length >= 2) {
        const bait = attackers.slice().sort((a, b) => unitValue(a) - unitValue(b))[0];
        const foe = enemiesInRange(bait)[0];
        if (foe) {
          await resolveAttack(bait, foe);
          if (!G || G.gameOver) return;
          render();
          await sleep(320);
          continue;
        }
      } else if (!lethal) {
        skipAttacks = true;                 // 只有一个攻击者且无法斩杀，不白送
      }
    }

    /* ② 斩杀：直接攻击敌方总部 */
    if (lethal && enemyBase && !skipAttacks) {
      let acted = false;
      const ordered = ready.slice().sort((a, b) => (b.atk || 0) - (a.atk || 0));
      for (const u of ordered) {
        if ((u.atk || 0) <= 0) continue;
        if ((u.attacksMade || 0) >= (u.attackLimit || 99)) continue;
        if (distForRange(u, enemyBase) > (u.range || 1)) continue;
        const ev = aiAttackEval(u, enemyBase, null);
        if (!ev || ev.dmg <= 0 || ev.selfDie) continue;
        await resolveAttack(u, enemyBase);
        if (!G || G.gameOver) return;
        render();
        await sleep(340);
        acted = true;
        break;
      }
      if (acted) continue;
    }

    /* ③ 选择收益最高的攻击；总部告急时优先处理正在进攻总部的单位 */
    let best = null;
    if (!skipAttacks) {
      for (const u of ready) {
        if ((u.atk || 0) <= 0) continue;
        if ((u.attacksMade || 0) >= (u.attackLimit || 99)) continue;
        let foes = enemiesInRange(u);
        if (!foes.length) continue;
        const threatFoes = foes.filter(f => baseThreats.indexOf(f) >= 0);
        if (threatFoes.length) foes = threatFoes;
        else if (emergency) continue;          // 总部告急：不去打无关目标
        const t = pickTarget(u, foes, focusUid, baseThreats);
        if (!t) continue;
        const ev = aiAttackEval(u, t, focusUid);
        if (!ev || ev.dmg <= 0) continue;
        if (u.cardId === 'seer' && p.deck.length === 0 && !ev.kill) continue;
        let score = ev.score;
        if (ev.selfDie && !ev.kill) score -= 400;
        if (!best || score > best.score) best = { u, t, ev, score };
      }
    }
    if (best && (best.score > 0 || emergency)) {
      await resolveAttack(best.u, best.t);
      if (!G || G.gameOver) return;
      render();
      await sleep(340);
      const eff = best.ev.eff;
      focusUid = eff && !eff.dead && !eff.isBase ? eff.uid : null;
      continue;
    }

    /* ④ 移动：总部威胁优先，其次选择推进收益最高的一步 */
    let bestMove = null;
    for (const u of ready) {
      if ((u.moveCount || 0) >= (u.moveLimit || 99)) continue;
      if (u.cardId === 'seer' && p.deck.length === 0) continue;   // 空牌库时避免疲劳
      if (traps > 0 && !aiMayWalkIntoTraps(u)) continue;
      const target = aiPickMoveTarget(u);
      if (!target) continue;
      if (distForRange(u, target) <= (u.range || 1)) continue;
      const step = aiNextStep(u, target);
      if (!step) continue;
      if (step.r === u.r && step.c === u.c) continue;

      let s = 30 - unitValue(u) * 0.05;
      if (isThreatToBase(target)) s += 100;
      if ((u.range || 1) > 1) s += 8;
      if (distForRange(step, target) <= (u.range || 1)) s += 18;
      if (emergency && !isThreatToBase(target)) s -= 60;
      if (!bestMove || s > bestMove.s) bestMove = { u, target, step, s };
    }
    if (!bestMove) return;

    await aiMoveUnit(bestMove.u, bestMove.step);
    continue;
  }
}

/* =========================================================
   AI 回合
   ========================================================= */
async function aiTurn() {
  if (!G || G.gameOver || G.turn !== AI_SIDE) return;
  if (G._aiRunning) return;

  const turnG = G;
  turnG._aiRunning = true;
  _aiTurnG = turnG;

  try {
    /* 经济计策（抽牌/回血）先用，再清场/铺场 */
    await aiTacticPhase('economy');
    if (!aiAlive()) return;

    await aiTacticPhase('clear');
    if (!aiAlive()) return;

    await aiSummonPhase();
    if (!aiAlive()) return;

    /* 铺场后的增益与清场计策 */
    await aiTacticPhase('combat');
    if (!aiAlive()) return;

    await aiActionPhase();
    if (!aiAlive()) return;

    /* 剩余法力用于布策与舍 */
    await aiSchemePhase();
    if (!aiAlive()) return;

    await aiHutActivatePhase();
    if (!aiAlive()) return;

    await sleep(350);
    if (!aiAlive()) return;
    endTurn();
  } catch (err) {
    console.error('[ai] 回合异常', err);
    try { if (aiAlive()) endTurn(); } catch (e) { /* ignore */ }
  } finally {
    turnG._aiRunning = false;
    if (_aiTurnG === turnG) _aiTurnG = null;
  }
}
