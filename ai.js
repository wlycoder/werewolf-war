/* =========================================================
   ai.js — AI 决策（强化版）
   ========================================================= */

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
function unitValue(u) {
  if (!u || u.isBase || u.dead) return 0;
  if (u.isHut) {
    if (u.cardId === 'fieldHospital') return 22;
    return 15;
  }
  let v = u.atk * 3 + u.def * 1.5;
  if (hasKeyword(u, 'guardian')) v += 6;
  if (hasKeyword(u, 'swift')) v += 3;
  if (hasKeyword(u, 'haste')) v += (u.maxActions - 1) * 5;
  if (u.effect && u.effect.type === 'deathrattle') v += 5;
  if (u.returnToHand) v += 2;
  if (u.range > 1) v += (u.range - 1) * 7;
  if (u.cardId === 'elder') v += 8;
  if (u.cardId === 'graverobber') v += 3;
  if (u.cardId === 'idiot') v += 3;
  if (u.cardId === 'guerrilla') v += 6;
  if (u.cardId === 'seer') v += 5;
  if (u.cardId === 'cupid') v += 4;
  if (u.cardId === 'werewolf') v += 12;
  if (u.cardId === 'witchhunter') v += 8;
  if (u.cardId === 'witch') v += 3;
  if (u.cardId === 'guard') v += 10;
  if (u.cardId === 'mage') v += 5;
  if (u.cardId === 'borer') v += 5;
  if (u.cardId === 'assassin') v += 5;
  if (u.cardId === 'shade') v += 6;
  if (u.cardId === 'paladin') v += 20;
  return v;
}
function threatScore(u) {
  if (!u || u.isBase) return 0;
  if (u.isHut) return 3;
  let t = u.atk * 4;
  if (hasKeyword(u, 'haste')) t += (u.maxActions - 1) * 12;
  if (hasKeyword(u, 'swift')) t += 3;
  if (hasKeyword(u, 'guardian')) t += 6;
  if (u.range > 1) t += (u.range - 1) * 14;
  if (u.cardId === 'elder') t += 10;
  if (u.cardId === 'guerrilla') t += 5;
  if (u.cardId === 'seer') t += 4;
  if (u.cardId === 'werewolf') t += 10;
  if (u.cardId === 'witchhunter') t += 10;
  if (u.cardId === 'witch') t += 3;
  if (u.cardId === 'guard') t += 8;
  if (u.cardId === 'mage') t += 4;
  if (u.cardId === 'borer') t += 6;
  if (u.cardId === 'assassin') t += 6;
  if (u.cardId === 'shade') t += 8;
  if (u.cardId === 'paladin') t += 20;
  return t;
}
function getBaseThreats() {
  if (!G) return [];
  const myBase = G.units.find(u => u.owner === AI_SIDE && u.isBase);
  if (!myBase || myBase.hp <= 0) return [];
  const threats = [];
  for (const e of G.units) {
    if (e.owner === AI_SIDE || e.dead || e.isBase) continue;
    if (e.isHut) continue;
    if (e.untargetable) continue;
    if (dist(e, myBase) <= (e.range || 1)) threats.push(e);
  }
  return threats;
}
function isThreatToBase(e) {
  if (!e || e.owner === AI_SIDE || e.dead || e.isBase) return false;
  if (e.isHut) return false;
  if (e.untargetable) return false;
  const myBase = G.units.find(u => u.owner === AI_SIDE && u.isBase);
  if (!myBase || myBase.hp <= 0) return false;
  return dist(e, myBase) <= (e.range || 1);
}
function isWolfRushDeck() {
  if (AI_SIDE !== 'ai') return false;
  return G && G.aiDeckName === '狼群突袭';
}
function scoreUnitUrgency(u, baseThreats) {
  if (!u || !baseThreats || !baseThreats.length) return 0;
  if (u.isHut) return 0;
  let score = 0;
  const range = u.range || 1;
  for (const t of baseThreats) {
    const d = dist(u, t);
    if (d <= range) { score += 100; if (hasKeyword(u, 'swift')) score += 20; if (t.def <= u.atk) score += 120; }
    else if (hasKeyword(u, 'swift')) {
      const movesLeft = (u.moveLimit || 99) - (u.moveCount || 0);
      if (movesLeft >= 1 && d - 1 <= range) score += 70;
    }
    const v = computeCombatValues(u.faction, u.atk, t.faction || '无', t.atk || 0);
    if (v.damage > 0) score += 15;
  }
  return score;
}
function enemiesInRange(u) {
  const res = [];
  if (!u || u.isHut) return res;
  const range = u.range || 1;
  for (const t of G.units) {
    if (t.owner === u.owner || t.dead) continue;
    /* ★ 圣骑士免疫敌方选中 */
    if (t.untargetable && t.owner !== u.owner) continue;
    if (distForRange(u, t) <= range) res.push(t);
  }
  return res;
}

/* ---------- 斩杀评估 ---------- */
function canKillWith(attacker, target) {
  if (!attacker || !target || target.dead) return false;
  const eff = effectiveTarget(target);
  const v = computeCombatValues(attacker.faction, attacker.atk, eff.faction || '无', eff.atk || 0);
  if (v.damage <= 0) return false;
  if (eff.isBase) return eff.hp <= v.damage;
  return eff.def <= v.damage;
}
function estimateBaseDamage() {
  const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase && u.hp > 0);
  if (!enemyBase) return 0;
  const ready = G.units.filter(u =>
    u.owner === AI_SIDE && !u.isBase && !u.dead && !u.silenced && !u.isHut &&
    u.actionsLeft > 0 && G[AI_SIDE].mana >= u.actionCost &&
    (u.attacksMade || 0) < (u.attackLimit || 99)
  );
  let total = 0;
  for (const u of ready) {
    if (distForRange(u, enemyBase) <= (u.range || 1)) {
      const v = computeCombatValues(u.faction, u.atk, '无', 0);
      total += v.damage;
    }
  }
  const hand = G[AI_SIDE].hand || [];
  for (const c of hand) {
    if (c.type !== 'tactic') continue;
    if (c.summonCost > G[AI_SIDE].mana) continue;
    if (c.id === 'granary') {
      const enemyHand = G[getOpponentSide()].hand.length;
      total += Math.max(0, 9 - enemyHand);
    }
    if (c.id === 'lastStand') total += 3;
    if (c.id === 'fury') {
      const myUnits = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut);
      for (const u of myUnits) {
        if (distForRange(u, enemyBase) <= (u.range || 1)) total += 2;
      }
    }
  }
  return total;
}
function isLethalAvailable() {
  const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase && u.hp > 0);
  if (!enemyBase) return false;
  return estimateBaseDamage() >= enemyBase.hp;
}

/* ---------- AI 回合 ---------- */
async function aiTurn() {
  if (!G || G.gameOver || G.turn !== AI_SIDE) return;
  await aiTacticPhase();
  if (!G || G.gameOver) return;
  await aiSchemePhase();
  if (!G || G.gameOver) return;
  await aiSummonPhase();
  if (!G || G.gameOver) return;
  await aiHutActivatePhase();
  if (!G || G.gameOver) return;
  await aiActionPhase();
  if (!G || G.gameOver) return;
  await sleep(400);
  endTurn();
}

async function aiTacticPhase() {
  if (!G || G.gameOver) return;
  const p = G[AI_SIDE];
  const enemy = G[getOpponentSide()];
  const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase);
  const myBase = G.units.find(u => u.owner === AI_SIDE && u.isBase);
  const lethal = isLethalAvailable();

  for (let i = p.hand.length - 1; i >= 0; i--) {
    if (!G || G.gameOver) return;
    const card = p.hand[i];
    if (!card || card.type !== 'tactic') continue;
    if (card.summonCost > p.mana) continue;

    let shouldUse = false;

    if (card.id === 'forcedMarch') {
      const myUnits = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut);
      if (myUnits.length >= 3) shouldUse = true;
      else if (myUnits.length >= 2 && myUnits.some(u => !u.swift && u.actionsLeft === 0)) shouldUse = true;
    } else if (card.id === 'lastStand') {
      const myUnits = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead);
      const enemyUnits = G.units.filter(u => u.owner !== AI_SIDE && !u.isBase && !u.dead);
      const myDeaths = myUnits.filter(u => u.def <= 3).length;
      const enemyDeaths = enemyUnits.filter(u => u.def <= 3).length;
      const netGain = enemyDeaths - myDeaths;
      const mySafe = myBase && myBase.hp > 3;
      const canFinishBase = enemyBase && enemyBase.hp <= 3;
      if (mySafe && (canFinishBase || (netGain >= 2 && enemyBase && myBase && myBase.hp >= enemyBase.hp))) shouldUse = true;
    } else if (card.id === 'expandAdvantage') {
      const myUnits = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead).length;
      const enemyUnits = G.units.filter(u => u.owner !== AI_SIDE && !u.isBase && !u.dead).length;
      if (myUnits > enemyUnits && p.hand.length <= 5) shouldUse = true;
    } else if (card.id === 'harvest') {
      const myHand = p.hand.length;
      const enemyHand = enemy.hand.length;
      if (myHand > enemyHand && myHand <= 5) shouldUse = true;
    } else if (card.id === 'merchant') {
      if (p.hand.length <= 4 && p.deck.length >= 3) shouldUse = true;
    } else if (card.id === 'standoff') {
      if (p.deck.length >= 5) shouldUse = true;
    } else if (card.id === 'compromise') {
      const enemyDeckEmpty = enemy.deck.length === 0;
      if (p.hand.length <= 6 || (myBase && myBase.hp <= 8) || enemyDeckEmpty) shouldUse = true;
    } else if (card.id === 'turnaround') {
      if (enemy.activeSchemes && enemy.activeSchemes.length >= 2) shouldUse = true;
      else {
        const targets = G.units.filter(u => u.owner !== AI_SIDE && !u.dead && u.def <= 2 && !u.isBase && !u.untargetable);
        if (targets.length >= 1) shouldUse = true;
      }
    } else if (card.id === 'hymn') {
      const myGods = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && u.faction === '神').length;
      const handGods = p.hand.filter(c => c.type === 'unit' && c.faction === '神').length;
      if (myGods + handGods >= 3) shouldUse = true;
    } else if (card.id === 'rest') {
      const myCiv = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && (u.faction === '民' || u.faction === '无')).length;
      if (myCiv >= 2) shouldUse = true;
      else if (myCiv >= 1 && myBase && myBase.hp <= 10) shouldUse = true;
    } else if (card.id === 'bribe') {
      const hasRaid = G.activeSchemes[AI_SIDE].some(s => s.cardId === 'raid');
      const hasGreed = G.activeSchemes[AI_SIDE].some(s => s.cardId === 'greed');
      if ((hasRaid || hasGreed) && enemy.deck.length >= 4) shouldUse = true;
    } else if (card.id === 'granary') {
      const enemyHand = enemy.hand.length;
      if (enemyHand <= 6) shouldUse = true;
      else if (enemyBase && enemyBase.hp <= (9 - enemyHand)) shouldUse = true;
    } else if (card.id === 'mechwolf') {
      /* 场上有可触发的单位（有亡语或部署效果）时使用 */
      const candidates = G.units.filter(u => !u.dead && !u.isBase &&
        !(u.untargetable && u.owner !== AI_SIDE) &&
        ((u.effect && u.effect.type === 'deathrattle') ||
         ['elder','idiot','cupid','werewolf'].includes(u.cardId)));
      if (candidates.length >= 1) shouldUse = true;
    } else if (card.id === 'fury') {
      /* 斩杀时必用；否则场上单位 ≥ 3 时使用 */
      if (lethal) shouldUse = true;
      else {
        const myUnits = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut);
        if (myUnits.length >= 3) shouldUse = true;
      }
    }

    if (shouldUse) {
      p.mana -= card.summonCost;
      p.hand.splice(i, 1);
      log(`🐺 使用了计策：${card.name}`, AI_SIDE);
      render();
      await sleep(200);
      await triggerSchemesOnEnemyTactic(AI_SIDE, card);
      if (card.effect && card.effect.trigger) {
        const fn = TACTIC_REGISTRY[card.effect.trigger];
        if (typeof fn === 'function') {
          try { await fn(card); } catch (err) { console.error(err); }
        }
      }
      render();
      await sleep(300);
    }
  }
}

async function aiSchemePhase() {
  if (!G || G.gameOver) return;
  const p = G[AI_SIDE];
  const enemy = G[getOpponentSide()];
  const myBase = G.units.find(u => u.owner === AI_SIDE && u.isBase);
  const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase);

  const schemeCards = p.hand.filter(c => isSchemeCard(c));
  for (const card of schemeCards) {
    if (!G || G.gameOver) return;
    if (!card._handUid) card._handUid = ++handUidSeq;
    if (isSchemeActive(AI_SIDE, card._handUid)) continue;
    if (p.mana < card.summonCost) continue;

    let shouldActivate = false;
    if (card.id === 'raid') {
      if (enemy.hand.length >= 4 || enemy.deck.length < 10) shouldActivate = true;
    } else if (card.id === 'cheapScheme') {
      if (p.mana >= card.summonCost + 1) shouldActivate = true;
    } else if (card.id === 'revenge') {
      if (myBase && myBase.hp <= 10) shouldActivate = true;
    } else if (card.id === 'snare' || card.id === 'pitfall' || card.id === 'ambush') {
      if (p.mana >= card.summonCost + 1 && enemy.mana >= 2) shouldActivate = true;
    } else if (card.id === 'greed') {
      const hasRaid = G.activeSchemes[AI_SIDE].some(s => s.cardId === 'raid');
      if (hasRaid || enemy.deck.length >= 12) shouldActivate = true;
    } else if (card.id === 'integrity') {
      if (p.deck.length <= 10) shouldActivate = true;
      else if (enemy.hand.some(c => c.type === 'tactic' &&
        (c.id === 'bribe' || c.id === 'standoff'))) shouldActivate = true;
    }
    if (shouldActivate) {
      if (activateScheme(AI_SIDE, card._handUid)) {
        render();
        await sleep(300);
      }
    }
  }
}

async function aiSummonPhase() {
  const wolfRush = isWolfRushDeck();
  const p = G[AI_SIDE];
  for (let guard = 0; guard < 10; guard++) {
    if (!G || G.gameOver) return;
    const myUnitCount = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut).length;
    if (myUnitCount >= 7) break;

    const candidates = p.hand
      .map((c, i) => ({ card: c, idx: i }))
      .filter(x => {
        if (x.card.type === 'tactic' || x.card.type === 'scheme') return false;
        if (x.card.summonCost > p.mana) return false;
        if (x.card.id === 'werewolf') {
          const sac = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut && (u.faction === '民' || u.faction === '神'));
          if (!sac.length) return false;
        }
        return true;
      });
    if (!candidates.length) break;

    const myBase = G.units.find(u => u.owner === AI_SIDE && u.isBase);
    const enemyUnits = G.units.filter(u => u.owner !== AI_SIDE && !u.isBase && !u.dead && !u.isHut);
    const baseThreats = getBaseThreats();
    const baseUnderThreat = baseThreats.length > 0;
    const baseLowHp = myBase && myBase.hp <= 6;
    const baseVeryLow = myBase && myBase.hp <= 3;
    const needDefense = (myBase && myBase.hp <= 8) || enemyUnits.length >= 3 ||
      enemyUnits.some(p2 => p2.r <= 1) || baseUnderThreat;
    const enemyHasRanged = enemyUnits.some(u => (u.range || 1) > 1);
    const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase);

    const hasElder = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'elder' && !u.dead);
    const hasRobber = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'graverobber' && !u.dead);
    const hasIdiot = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'idiot' && !u.dead);
    const hasGuerrilla = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'guerrilla' && !u.dead);
    const hasCupid = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'cupid' && !u.dead);
    const hasSeer = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'seer' && !u.dead);
    const hasWerewolf = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'werewolf' && !u.dead);
    const hasWitchhunter = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'witchhunter' && !u.dead);
    const hasGuard = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'guard' && !u.dead);
    const hasAssassin = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'assassin' && !u.dead);
    const hasShade = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'shade' && !u.dead);
    const hasPaladin = G.units.some(u => u.owner === AI_SIDE && u.cardId === 'paladin' && !u.dead);
    const myHasRanged = G.units.some(u => u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut && (u.range || 1) > 1);

    let best = null, bestScore = -Infinity;
    for (const { card, idx } of candidates) {
      let score = card.summonCost * 3 + (card.atk || 0) * 1.2 + (card.def || 0) * 0.6;
      if (wolfRush && card.id === 'werewolf') score += 30;
      if (needDefense && hasKeyword(card, 'guardian')) score += 22;
      if (baseVeryLow && hasKeyword(card, 'guardian')) score += 18;
      if (card.id === 'bomber') score += 4;
      if (card.id === 'magician') score += 4;
      if (hasKeyword(card, 'swift')) score += 4;
      if (hasKeyword(card, 'haste')) score += 5;
      if (card.id === 'elder') score += hasElder ? -100 : 12;
      if (card.id === 'graverobber') score += hasRobber ? -100 : 5;
      if (card.id === 'idiot') score += hasIdiot ? -100 : 6;
      if (card.id === 'guerrilla') score += hasGuerrilla ? -100 : 8;
      if (card.id === 'cupid') score += hasCupid ? -100 : 7;
      if (card.id === 'seer') score += hasSeer ? -100 : 6;
      if (card.id === 'werewolf') score += hasWerewolf ? -100 : 14;
      if (card.id === 'witchhunter') score += hasWitchhunter ? -100 : 9;
      if (card.id === 'guard') score += hasGuard ? -100 : 12;
      if (card.id === 'borer') score += 6;
      if (card.id === 'assassin') score += hasAssassin ? -100 : 8;
      if (card.id === 'shade') score += hasShade ? -100 : 10;
      if (card.id === 'paladin') score += hasPaladin ? -100 : 22;
      if (card.type === 'hut') {
        const myHuts = G.units.filter(u => u.owner === AI_SIDE && u.isHut && !u.dead).length;
        if (myHuts >= 1) score -= 60;
        else score += 8;
        if (card.id === 'fieldHospital') {
          const injuredAllies = G.units.filter(u => u.owner === AI_SIDE && !u.isBase && !u.dead && u.def < u.maxDef).length;
          score += injuredAllies * 4;
        }
      }
      const rng = getCardRange(card);
      if (rng > 1) { score += (rng - 1) * 6; if (enemyHasRanged) score += 8; if (!myHasRanged) score += 6; }
      if (baseUnderThreat) { if (rng > 1) score += 8; score += (card.atk || 0) * 2; if (hasKeyword(card, 'swift')) score += 6; }
      if (baseLowHp && hasKeyword(card, 'guardian')) score += 10;
      if (myUnitCount <= 2 && (card.atk || 0) >= 2) score += 5;
      if (enemyBase && enemyBase.hp <= 8 && (card.atk || 0) >= 3) score += 6;
      if (score > bestScore) { bestScore = score; best = { card, idx }; }
    }
    if (!best) break;

    let spots = [];
    if (best.card.type === 'hut') {
      const allies = G.units.filter(u =>
        u.owner === AI_SIDE && !u.isBase && !u.dead && !u.isHut
      );
      const seen = new Set();
      for (const a of allies) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = a.r + dr, cc = a.c + dc;
            if (!inBounds(rr, cc)) continue;
            if (G.board[rr][cc]) continue;
            if (rr > 2) continue;
            const key = rr + ',' + cc;
            if (seen.has(key)) continue;
            seen.add(key);
            spots.push({ r: rr, c: cc });
          }
        }
      }
    } else {
      for (let r = 0; r <= 1; r++)
        for (let c = 0; c < BOARD_COLS; c++)
          if (!G.board[r][c]) spots.push({ r, c });
    }
    if (!spots.length) break;

    const hasSwift = hasKeyword(best.card, 'swift');
    let bestSpot = spots[0], spotScore = -Infinity;
    for (const sp of spots) {
      let score = sp.r * 4 - Math.abs(sp.c - 2) * 2;
      if (hasKeyword(best.card, 'guardian')) {
        if (baseUnderThreat) { if (sp.r === 1) score += 18; else if (sp.r === 0) score += 3; }
        else if (sp.r === 0) score += 12;
      }
      if (baseUnderThreat && !hasKeyword(best.card, 'guardian') && sp.r === 1) score += 8;
      if (getCardRange(best.card) > 1) score -= sp.r * 3;
      if (best.card.id === 'elder' || best.card.id === 'graverobber') score -= sp.r * 4;
      if (best.card.id === 'bomber') score -= sp.r * 2;
      if (best.card.id === 'guerrilla') score -= sp.r * 2;
      if (best.card.id === 'werewolf') score -= sp.r * 2;
      if (best.card.id === 'assassin') score -= sp.r * 2;
      if (best.card.type === 'hut') score -= sp.r * 1;
      if (hasSwift && (best.card.atk || 0) >= 2 && sp.r === 1) score += 6;
      if (score > spotScore) { spotScore = score; bestSpot = sp; }
    }

    p.mana -= best.card.summonCost;
    p.hand.splice(best.idx, 1);
    const u = createUnit(best.card, AI_SIDE, bestSpot.r, bestSpot.c);
    placeUnit(u);
    log(`🐺 召唤了 ${best.card.name}`, AI_SIDE);
    render();
    await playSummonAnimation(u);

    await checkAmbush(u);
    if (!G || G.gameOver) return;
    if (u.dead) continue;

    if (best.card.id === 'elder') {
      const enemies = G.units.filter(x => x.owner !== AI_SIDE && !x.dead && !x.isBase && !x.isHut && !x.untargetable);
      if (enemies.length) {
        const sorted = enemies.slice().sort((a, b) => {
          let sa = threatScore(a), sb = threatScore(b);
          if (isThreatToBase(a)) sa += 50;
          if (isThreatToBase(b)) sb += 50;
          if (myBase) { sa += Math.max(0, 8 - dist(a, myBase)) * 5; sb += Math.max(0, 8 - dist(b, myBase)) * 5; }
          return sb - sa;
        });
        u.silenceTargetUid = sorted[0].uid;
        log(`🚫 ${u.name} 选择 ${sorted[0].name} 作为禁言目标`, AI_SIDE);
        render();
      }
    }
    if (best.card.id === 'idiot') {
      const enemies = G.units.filter(x => x.owner !== AI_SIDE && !x.dead && !x.isBase && !x.isHut && !x.untargetable);
      if (enemies.length) {
        const threats = enemies.filter(isThreatToBase);
        const pool = threats.length ? threats : enemies;
        const sorted = pool.slice().sort((a, b) => threatScore(b) - threatScore(a));
        await sleep(300);
        await executeRetreat(sorted[0]);
        render();
      }
    }
    if (best.card.id === 'cupid') await triggerCupidSummon(u);
    if (best.card.id === 'werewolf') await triggerWolfSummon(u);
  }
}

async function aiHutActivatePhase() {
  if (!G || G.gameOver) return;
  const myHuts = G.units.filter(u =>
    u.owner === AI_SIDE && u.isHut && !u.dead && !u.hutUsedThisTurn
  );
  for (const h of myHuts) {
    if (!G || G.gameOver) return;
    const p = G[AI_SIDE];
    if (p.mana >= (h.activateCost || 0)) {
      await activateHut(h, AI_SIDE);
      render();
      await sleep(280);
    }
  }
}

function pickTarget(attacker, enemies, focusUid, baseThreats) {
  let best = null, bestScore = -Infinity;
  const myBase = G.units.find(x => x.owner === AI_SIDE && x.isBase);
  const wolfRush = isWolfRushDeck();

  if (attacker.cardId === 'assassin') {
    const base = enemies.find(e => e.isBase);
    if (base) {
      const dmg = computeCombatValues(attacker.faction, attacker.atk, '无', 0).damage;
      if (base.hp > 3 || base.hp <= dmg) return base;
      const threats = enemies.filter(e => !e.isBase && isThreatToBase(e) && e.def <= dmg);
      if (threats.length) return threats.sort((a,b) => threatScore(b) - threatScore(a))[0];
      return base;
    }
  }

  for (const e of enemies) {
    const eff = effectiveTarget(e);
    let score = 0;
    const v = computeCombatValues(attacker.faction, attacker.atk, eff.faction || '无', eff.atk || 0);
    const dmg = v.damage;
    let recoil = v.recoil;
    if (attacker.noRecoil || eff.noRecoil) recoil = 0;

    if (eff.isBase) {
      score = eff.hp <= dmg ? 2000 : 80;
      if (wolfRush) score += 200;
      if (focusUid === eff.uid) score += 500;
    } else if (eff.isHut) {
      score = eff.def <= dmg ? 120 : 30;
    } else {
      const canKill = eff.def <= dmg;
      if (canKill) score += 500;
      score += threatScore(eff) * 5;
      if (focusUid === eff.uid) score += 300;
      const rng = eff.range || 1;
      if (rng > 1) score += (rng - 1) * 100;
      if (myBase) {
        const dToBase = dist(eff, myBase);
        if (dToBase <= (eff.range || 1)) { score += 500; if (canKill) score += 400; }
        else score += Math.max(0, 8 - dToBase) * 25;
      }
      if (hasKeyword(eff, 'swift')) score += 40;
      score -= recoil * 6;
      if (recoil >= attacker.def && !canKill) score -= 800;
      if (eff.cardId === 'guerrilla') score -= 40;
      if (dmg <= 0) score -= 500;
    }
    if (e.isBase && eff !== e) score += 5;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

async function aiMoveTowards(u) {
  if (!u || u.isHut) return false;
  const range = u.range || 1;
  const baseThreats = getBaseThreats();
  const myBase = G.units.find(x => x.owner === AI_SIDE && x.isBase);
  const wolfRush = isWolfRushDeck();
  let bestTarget = null;

  if (baseThreats.length) {
    let nearest = null, ns = -Infinity;
    for (const t of baseThreats) {
      if (!myBase) break;
      const s = -dist(t, myBase);
      if (s > ns) { ns = s; nearest = t; }
    }
    if (nearest && dist(u, nearest) <= range) return false;
    bestTarget = nearest;
  }

  if (!bestTarget) {
    const enemies = G.units.filter(x => x.owner !== u.owner && !x.dead && !x.isHut &&
      !(x.untargetable && x.owner !== u.owner));
    if (!enemies.length) return false;
    let bestScore = -Infinity;
    for (const e of enemies) {
      const eff = effectiveTarget(e);
      let score = -dist(u, eff) * 2;
      if (eff.isBase) { score -= 3; if (wolfRush) score += 30; }
      if (!eff.isBase && eff.def <= u.atk) score += 15;
      if (!eff.isBase) score += threatScore(eff) * 0.4;
      if (!eff.isBase && (eff.range || 1) > 1) score += 15;
      if (myBase && !eff.isBase) score += Math.max(0, 8 - dist(eff, myBase)) * 5;
      if (score > bestScore) { bestScore = score; bestTarget = eff; }
    }
    if (!bestTarget) return false;
    if (dist(u, bestTarget) <= range) return false;
  }

  const dirs = getMoveDirs(u);
  let bestSpot = null, bestD = dist(u, bestTarget);
  for (const [dr, dc] of dirs) {
    const nr = u.r + dr, nc = u.c + dc;
    if (!inBounds(nr, nc) || G.board[nr][nc]) continue;
    const d = Math.abs(bestTarget.r - nr) + Math.abs(bestTarget.c - nc);
    if (d < bestD) { bestD = d; bestSpot = { r: nr, c: nc }; }
  }
  if (!bestSpot) return false;

  const p = u.owner === 'player' ? G.player : G.ai;

  p.mana -= u.actionCost;
  u.actionsLeft--;
  u.moveCount = (u.moveCount || 0) + 1;

  if (await checkPitfall(u)) return true;

  await playMoveAnimation(u, u.r, u.c, bestSpot.r, bestSpot.c);
  G.board[u.r][u.c] = null;
  u.r = bestSpot.r; u.c = bestSpot.c;
  G.board[u.r][u.c] = u;
  triggerSeerDraw(u);
  triggerOnActionEffect(u);
  return true;
}

async function aiActionPhase() {
  let focusUid = null;
  const enemyBase = G.units.find(u => u.owner !== AI_SIDE && u.isBase && u.hp > 0);
  const lethal = isLethalAvailable();

  for (let guard = 0; guard < 80; guard++) {
    if (!G || G.gameOver) return;
    if (focusUid) {
      const t = G.units.find(x => x.uid === focusUid);
      if (!t || t.dead) focusUid = null;
    }
    const ready = G.units.filter(u =>
      u.owner === AI_SIDE && !u.isBase && !u.dead && !u.silenced && !u.isHut &&
      u.actionsLeft > 0 && G[AI_SIDE].mana >= u.actionCost);
    if (!ready.length) return;

    const baseThreats = getBaseThreats();
    const baseUnderThreat = baseThreats.length > 0;

    ready.sort((a, b) => {
      if (baseUnderThreat) {
        const sa = scoreUnitUrgency(a, baseThreats);
        const sb = scoreUnitUrgency(b, baseThreats);
        if (sa !== sb) return sb - sa;
      }
      return unitValue(b) - unitValue(a);
    });

    /* 斩杀模式 */
    if (lethal && enemyBase) {
      let attacked = false;
      for (const u of ready) {
        if (u.atk <= 0) continue;
        if ((u.attacksMade || 0) >= (u.attackLimit || 99)) continue;
        if (distForRange(u, enemyBase) <= (u.range || 1)) {
          await resolveAttack(u, enemyBase);
          render();
          if (G.gameOver) return;
          await sleep(340);
          attacked = true;
          break;
        }
      }
      if (attacked) continue;
      for (const u of ready) {
        if ((u.moveCount || 0) >= (u.moveLimit || 99)) continue;
        if (await aiMoveTowards(u)) {
          render();
          await sleep(300);
          attacked = true;
          break;
        }
      }
      if (attacked) continue;
    }

    let acted = false;
    for (const u of ready) {
      if (u.atk <= 0) continue;
      if ((u.attacksMade || 0) >= (u.attackLimit || 99)) continue;
      const foes = enemiesInRange(u);
      if (!foes.length) continue;
      const target = pickTarget(u, foes, focusUid, baseThreats);
      if (!target) continue;
      const eff = effectiveTarget(target);
      const v = computeCombatValues(u.faction, u.atk, eff.faction || '无', eff.atk || 0);
      let recoil = v.recoil;
      if (u.noRecoil || eff.noRecoil) recoil = 0;
      const wouldDie = recoil >= u.def && u.def > 0;
      const wouldKill = eff.isBase ? eff.hp <= v.damage : eff.def <= v.damage;
      if (wouldDie && !wouldKill) continue;
      if (v.damage <= 0) continue;
      await resolveAttack(u, target);
      render();
      if (G.gameOver) return;
      await sleep(340);
      focusUid = eff.dead ? null : eff.uid;
      acted = true;
      break;
    }
    if (acted) continue;
    for (const u of ready) {
      if ((u.moveCount || 0) >= (u.moveLimit || 99)) continue;
      if (await aiMoveTowards(u)) {
        render();
        await sleep(300);
        acted = true;
        break;
      }
    }
    if (!acted) return;
  }
}