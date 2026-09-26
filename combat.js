/* =========================================================
   combat.js — 伤害、死亡、攻击、反伤、撤退、亡语、召唤、计策、策、舍
   ========================================================= */

function findGuardian(target) {
  if (!target || target.dead) return null;
  if (hasKeyword(target, 'guardian')) return null;
  return G.units.find(u =>
    u !== target && u.owner === target.owner && !u.isBase && !u.dead &&
    u.r === target.r && hasKeyword(u, 'guardian')
  ) || null;
}

async function applyDamage(target, dmg, source) {
  if (!target || target.dead) return;
  if (G && G.gameOver) return;
  const guardian = findGuardian(target);
  if (guardian) {
    log(`🛡️ ${guardian.name} 守护了 ${target.name}`, guardian.owner);
    showGuardianFx(guardian.r, guardian.c);
    target = guardian;
  }
  if (!target.isBase && source && !source.isBase && source.uid != null) {
    target.lastDamageFrom = source.uid;
  }
  if (target.isBase) {
    const dmgDone = dmg;
    target.hp -= dmg; render();
    if (target.hp <= 0) {
      const winner = target.owner === 'player' ? 'ai' : 'player';
      endGame(winner);
      return;
    }
    setTimeout(() => {
      if (G && !G.gameOver && G.turn !== target.owner) {
        triggerSchemesOnBaseDamage(target.owner, dmgDone);
      }
    }, 80);
    return;
  }
  target.def -= dmg;
  if (target.def <= 0) await killUnit(target);
  if (G && !G.gameOver) checkGameOver();
}

function triggerOnActionEffect(u) {
  if (!u || u.dead) return;
  if (u.hasOnAction) {
    if (u.atk > 1) {
      u.atk -= 1;
      log(`💂 ${u.name} 行动后攻击力 -1（现 ${u.atk}）`, u.owner);
      showStatChangeFx(u.r, u.c, -1, 'atk');
    }
  }
}

async function killUnit(u) {
  if (!u || u.isBase || u.dead) return;
  if (u.cardId === 'guerrilla' && G && G.turn !== u.owner) {
    u.dead = true;
    const p = u.owner === 'player' ? G.player : G.ai;
    const def = CARD_MAP[u.cardId];
    if (def) {
      p.deck.push({ ...def });
      p.deck = shuffle(p.deck);
      log(`🪖 ${u.name} 在敌方回合阵亡，洗入牌库`, u.owner);
    }
    removeUnit(u);
    render();
    return;
  }
  u.dead = true;
  if (u.effect && u.effect.type === 'deathrattle') {
    const key = u.effect.trigger;
    const fn = DEATHRATTLE_REGISTRY[key]
            || (typeof window[key] === 'function' ? window[key] : null);
    if (typeof fn === 'function') {
      try { log(`✦ ${u.name} 触发亡语：${u.effect.desc}`, u.owner); await fn(u); }
      catch (err) { console.error(err); log(`⚠️ ${u.name} 亡语触发异常`, u.owner); }
    }
  }
  if (G && G.stats) {
    if (u.owner === 'ai') G.stats.playerKills++;
    else if (u.owner === 'player') G.stats.aiKills++;
  }
  const deathOwner = u.owner;
  removeUnit(u);
  if (G && !G.gameOver) {
    const robbers = G.units.filter(x =>
      x.owner === deathOwner && !x.dead && !x.isBase && hasKeyword(x, 'graverobber')
    );
    for (const rob of robbers) {
      drawCard(rob.owner, { extra: true });
      log(`⛏️ ${rob.name}：友方阵亡，抽一张牌`, rob.owner);
      showCoinAt(rob.r, rob.c);
      render();
      await sleep(450);
    }
  }
  if (u.returnToHand) {
    const p = u.owner === 'player' ? G.player : G.ai;
    if (p.hand.length < HAND_LIMIT) {
      const def = CARD_MAP[u.cardId];
      if (def) { p.hand.push({ ...def }); log(`✨ ${u.name} 触发「回到手牌」`, u.owner); render(); return; }
    }
    log(`⚠️ 手牌已满，${u.name} 未能回到手牌`, u.owner);
    return;
  }
  log(`💀 ${u.name} 离场`, u.owner);
}

function triggerSeerDraw(u) {
  if (!u || u.dead || u.cardId !== 'seer') return;
  if (!G || G.gameOver) return;
  const before = u.owner === 'player' ? G.player.hand.length : G.ai.hand.length;
  drawCard(u.owner, { extra: true });
  const after = u.owner === 'player' ? G.player.hand.length : G.ai.hand.length;
  if (after > before) log(`🔮 ${u.name}：行动时抽一张牌`, u.owner);
}

async function guerrillaRetreat(u) {
  const lastRow = u.owner === 'player' ? PLAYER_LAST_ROW : AI_LAST_ROW;
  if (u.r === lastRow) return false;
  const dr = u.owner === 'player' ? 1 : -1;
  let targetR = u.r + dr;
  while (inBounds(targetR, u.c) && G.board[targetR][u.c]) targetR += dr;
  if (!inBounds(targetR, u.c) || G.board[targetR][u.c]) return false;
  await playRetreatAnimation(u, targetR, u.c);
  G.board[u.r][u.c] = null; u.r = targetR; G.board[u.r][u.c] = u;
  return true;
}

async function shuffleUnitIntoDeck(u) {
  const boardEl = $('#board');
  if (boardEl) {
    const el = boardEl.querySelector(`.unit[data-uid="${u.uid}"]`);
    if (el) { el.classList.add('retreating-to-hand'); await sleep(560); }
  }
  const p = u.owner === 'player' ? G.player : G.ai;
  const def = CARD_MAP[u.cardId];
  if (def) { p.deck.push({ ...def }); p.deck = shuffle(p.deck); }
  removeUnit(u);
}

/* =========================================================
   ★ 法师响应
   ========================================================= */
async function triggerMageOnScheme(owner) {
  if (!G || G.gameOver) return;
  const mages = G.units.filter(u =>
    u.owner === owner && u.cardId === 'mage' && !u.dead
  );
  if (!mages.length) return;
  for (const mage of mages) {
    if (G.gameOver) return;
    const enemies = G.units.filter(u => u.owner !== owner && !u.dead && !u.untargetable);
    if (!enemies.length) return;
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    log(`🎩 ${mage.name}：友方策触发，对 ${target.name} 造成 2 点伤害`, owner);
    showMageFx(mage.r, mage.c, target.r, target.c);
    await sleep(320);
    await applyDamage(target, 2, mage);
    render();
    await sleep(180);
  }
}

/* =========================================================
   ★ 圈套
   ========================================================= */
async function checkSnare(attacker) {
  if (!G || G.gameOver) return false;
  const enemyOwner = attacker.owner === 'player' ? 'ai' : 'player';
  const snares = getActiveSchemesByCardId(enemyOwner, 'snare');
  if (!snares.length) return false;

  const snare = snares[0];
  log(`🪤 圈套触发！${attacker.name} 的攻击被取消，受到 3 点伤害`, enemyOwner);
  showSnareFx(attacker.r, attacker.c);
  await sleep(400);

  removeSchemeFromHand(enemyOwner, snare);
  G.activeSchemes[enemyOwner] = G.activeSchemes[enemyOwner].filter(s => s.handUid !== snare.handUid);

  await applyDamage(attacker, 3);
  render();
  await triggerMageOnScheme(enemyOwner);
  return true;
}

/* =========================================================
   ★ 陷阱
   ========================================================= */
async function checkPitfall(mover) {
  if (!G || G.gameOver) return false;
  const enemyOwner = mover.owner === 'player' ? 'ai' : 'player';
  const traps = getActiveSchemesByCardId(enemyOwner, 'pitfall');
  if (!traps.length) return false;

  const trap = traps[0];
  log(`🕳️ 陷阱触发！${mover.name} 被消灭`, enemyOwner);
  showPitfallFx(mover.r, mover.c);
  await sleep(400);

  removeSchemeFromHand(enemyOwner, trap);
  G.activeSchemes[enemyOwner] = G.activeSchemes[enemyOwner].filter(s => s.handUid !== trap.handUid);

  await killUnit(mover);
  render();
  await triggerMageOnScheme(enemyOwner);
  return true;
}

/* =========================================================
   ★ 埋伏
   ========================================================= */
async function checkAmbush(newUnit) {
  if (!G || G.gameOver) return false;
  if (!newUnit || newUnit.dead || newUnit.isBase) return false;

  const enemyOwner = newUnit.owner === 'player' ? 'ai' : 'player';
  const ambushes = getActiveSchemesByCardId(enemyOwner, 'ambush');
  if (!ambushes.length) return false;

  const scheme = ambushes[0];
  log(`🫥 埋伏触发！${newUnit.name} 被伏击：受到 3 点伤害并获得禁言`, enemyOwner);

  showAmbushFx(newUnit.r, newUnit.c);
  await sleep(420);
  if (!G || G.gameOver) return true;

  removeSchemeFromHand(enemyOwner, scheme);
  G.activeSchemes[enemyOwner] =
    G.activeSchemes[enemyOwner].filter(s => s.handUid !== scheme.handUid);

  await applyDamage(newUnit, 3);

  if (!newUnit.dead && G && !G.gameOver) {
    newUnit.silenced = true;
    showSilenceFx(newUnit.r, newUnit.c);
    log(`🚫 ${newUnit.name} 被禁言，本回合无法行动`, enemyOwner);
  }
  render();
  await triggerMageOnScheme(enemyOwner);
  return true;
}

/* =========================================================
   攻击结算
   ========================================================= */
async function resolveAttack(attacker, target) {
  if (!attacker || !target) return;
  if (G && G.gameOver) return;
  if (attacker.silenced) return;
  const p = attacker.owner === 'player' ? G.player : G.ai;
  if (attacker.actionsLeft <= 0 || p.mana < attacker.actionCost) return;
  if ((attacker.attacksMade || 0) >= (attacker.attackLimit || 99)) return;
  const range = attacker.range || 1;
  if (dist(attacker, target) > range) return;

  /* 圣骑士免疫敌方单位攻击 */
  if (target.untargetable && target.owner !== attacker.owner) return;

  /* 先消耗行动点和法力 */
  p.mana -= attacker.actionCost;
  attacker.actionsLeft--;
  attacker.attacksMade = (attacker.attacksMade || 0) + 1;

  /* 圈套检查 */
  if (await checkSnare(attacker)) return;

  triggerSeerDraw(attacker);

  const originalTarget = target;
  const guardian = attacker.ignoresGuardian ? null : findGuardian(target);
  const effectiveTarget = guardian || target;

  if (effectiveTarget.cardId === 'guerrilla' && !effectiveTarget.isBase && !effectiveTarget.dead) {
    const success = await guerrillaRetreat(effectiveTarget);
    if (success) log(`🪖 ${effectiveTarget.name} 撤退成功，闪避了攻击`, effectiveTarget.owner);
    else { log(`🪖 ${effectiveTarget.name} 无处可退，被洗入牌库`, effectiveTarget.owner); await shuffleUnitIntoDeck(effectiveTarget); }
    triggerOnActionEffect(attacker);
    render(); return;
  }

  const values = computeCombatValues(
    attacker.faction, attacker.atk,
    effectiveTarget.faction || '无', effectiveTarget.atk || 0
  );
  let recoil = values.recoil;
  if (attacker.noRecoil || effectiveTarget.noRecoil) recoil = 0;
  const dmg = values.damage;
  const snap = {
    isBase: !!effectiveTarget.isBase,
    faction: effectiveTarget.faction || '无',
    atk: effectiveTarget.atk || 0, recoil
  };
  const effR = effectiveTarget.r, effC = effectiveTarget.c;

  /* ★ 主机广播攻击事件给客机 */
  if (G.net && G.net.mode === 'host') {
    hostEvent({
      type: 'attack',
      attackerUid: attacker.uid,
      targetUid: effectiveTarget.uid,
      ranged: attacker.cardId === 'hunter' || attacker.cardId === 'witchhunter'
    });
  }

  if (attacker.cardId === 'hunter' || attacker.cardId === 'witchhunter') {
    await playRangedAttackAnimation(attacker, effectiveTarget);
  } else {
    await playAttackAnimation(attacker, originalTarget);
  }
  if (G.gameOver) return;

  await applyDamage(target, dmg, attacker);
  if (G.gameOver) return;

  const atkTag = attacker.owner === 'player' ? '🔵' : '🔴';
  const tgtTag = originalTarget.owner === 'player' ? '🔵' : (originalTarget.owner === 'ai' ? '🔴' : '');
  if (dmg > 0) log(`${atkTag}${attacker.name} → ${tgtTag}${originalTarget.name}：造成 ${dmg} 点伤害`, attacker.owner);
  else log(`${atkTag}${attacker.name} → ${tgtTag}${originalTarget.name}：无法造成伤害`, attacker.owner);

  if (!snap.isBase && effectiveTarget.dead) showSkullAt(effR, effC);
  triggerOnActionEffect(attacker);

  /* 刺客：攻击总部后 +1 攻击 */
  if (attacker.cardId === 'assassin' && snap.isBase && !attacker.dead) {
    attacker.atk += 1;
    log(`🥷 ${attacker.name}：攻击总部后攻击力 +1（现 ${attacker.atk}）`, attacker.owner);
    showStatChangeFx(attacker.r, attacker.c, 1, 'atk');
  }

  /* 蛀虫：攻击后弃掉对手牌库顶 2 张 */
  if (attacker.cardId === 'borer' && !attacker.dead) {
    const enemyP = attacker.owner === 'player' ? G.ai : G.player;
    let dropped = 0;
    for (let i = 0; i < 2; i++) {
      if (!enemyP.deck.length) break;
      enemyP.deck.pop();
      dropped++;
    }
    if (dropped > 0) {
      log(`🐛 ${attacker.name}：弃掉对手牌库顶 ${dropped} 张`, attacker.owner);
      render();
    }
  }

  if (snap.isBase) return;
  if (attacker.isBase || attacker.dead) return;

  if (recoil > 0 && !G.gameOver) {
    log(`⚡ 反伤：${attacker.name} 受到 ${recoil} 点伤害`, attacker.owner);
    const atkR = attacker.r, atkC = attacker.c;
    const atkWasDead = attacker.dead;
    await applyDamage(attacker, recoil, effectiveTarget);
    if (!G.gameOver && attacker.dead && !atkWasDead) showSkullAt(atkR, atkC);
  }
}

async function executeRetreat(u) {
  if (!u || u.isBase || u.dead) return;
  if (G.gameOver) return;
  const startR = u.r, startC = u.c;
  const lastRow = u.owner === 'player' ? PLAYER_LAST_ROW : AI_LAST_ROW;
  let canMove = false, targetR = -1;
  if (u.r !== lastRow) {
    const dr = u.owner === 'player' ? 1 : -1;
    let r = u.r + dr;
    while (inBounds(r, u.c) && G.board[r][u.c]) r += dr;
    if (inBounds(r, u.c) && !G.board[r][u.c]) { canMove = true; targetR = r; }
  }
  if (canMove) {
    await playRetreatAnimation(u, targetR, u.c);
    G.board[u.r][u.c] = null; u.r = targetR; G.board[u.r][u.c] = u;
    log(`🔙 ${u.name} 撤退到后方`, u.owner);
  } else {
    await playRetreatToHandAnimation(u);
    const p = u.owner === 'player' ? G.player : G.ai;
    if (p.hand.length < HAND_LIMIT) {
      const def = CARD_MAP[u.cardId];
      if (def) { p.hand.push({ ...def }); log(`🔙 ${u.name} 无处可退，回到手牌`, u.owner); }
    } else log(`⚠️ 手牌已满，${u.name} 无处可退，被移除`, u.owner);
    removeUnit(u);
  }
  showRetreatIcon(startR, startC);
}

/* ---------- 亡语 ---------- */
async function magicianDeathrattle(u) {
  const allies = G.units.filter(x => x.owner === u.owner && !x.isBase);
  if (!allies.length) return;
  let chosen = null;
  if (u.owner === 'player') chosen = await askPlayerChooseAlly(allies);
  else {
    const available = allies.filter(x => !x.returnToHand);
    const pool = available.length ? available : allies;
    chosen = pool.slice().sort((a,b) => unitValue(b) - unitValue(a))[0];
    await sleep(280);
  }
  if (!chosen || G.gameOver) return;
  playMagicianEffect(u, chosen);
  await sleep(500);
  chosen.returnToHand = true;
  log(`🔮 ${u.name} 的亡语：${chosen.name} 获得「亡语：回到手牌」`, u.owner);
  render();
}
async function bomberDeathrattle(u) {
  const targets = G.units.filter(x => !x.dead);
  if (!targets.length) return;
  const picks = [];
  for (let i = 0; i < 3; i++) picks.push(targets[Math.floor(Math.random() * targets.length)]);
  log(`💥 ${u.name} 的亡语：随机选中 ${picks.map(t => t.name).join('、')}`, u.owner);
  for (const t of picks) {
    if (G.gameOver) return;
    if (t.dead) continue;
    const wasAlive = !t.dead;
    const tr = t.r, tc = t.c, isBase = t.isBase;
    showBombFx(tr, tc);
    await sleep(220);
    await applyDamage(t, 2, u);
    if (wasAlive && t.dead && !isBase && !G.gameOver) showSkullAt(tr, tc);
  }
}
async function witchDeathrattle(u) {
  let choice = null;
  if (u.owner === 'player') choice = await askWitchChoice();
  else {
    const myBase = G.units.find(x => x.owner === u.owner && x.isBase);
    const enemyBase = G.units.find(x => x.owner !== u.owner && x.isBase);
    if (enemyBase && enemyBase.hp <= 2) choice = 'apple';
    else if (myBase && myBase.hp <= 6) choice = 'green';
    else if (enemyBase && enemyBase.hp <= 8) choice = 'apple';
    else choice = 'green';
    await sleep(360);
  }
  if (!choice || G.gameOver) return;
  if (choice === 'apple') {
    const enemyBase = G.units.find(x => x.owner !== u.owner && x.isBase && x.hp > 0);
    if (enemyBase) {
      log(`🧹 ${u.name} 的亡语：💔 对敌方总部造成 2 点伤害`, u.owner);
      showWitchFx(enemyBase.r, enemyBase.c, 'apple');
      await sleep(300);
      await applyDamage(enemyBase, 2, u);
    }
  } else {
    const myBase = G.units.find(x => x.owner === u.owner && x.isBase && x.hp > 0);
    if (myBase) {
      myBase.hp += 2;
      log(`🧹 ${u.name} 的亡语：💖 友方总部 +2 血量（现 ${myBase.hp}）`, u.owner);
      showWitchFx(myBase.r, myBase.c, 'green');
    }
  }
  render();
}

/* 刺客亡语 */
async function assassinDeathrattle(u) {
  if (!G || G.gameOver) return;
  const src = u.lastDamageFrom
    ? G.units.find(x => x.uid === u.lastDamageFrom && !x.dead && !x.isBase)
    : null;

  if (src) {
    log(`🥷 ${u.name} 的亡语：消灭了 ${src.name}`, u.owner);
    if (!src.isBase) showSkullAt(src.r, src.c);
    await sleep(360);
    if (!G || G.gameOver) return;
    await killUnit(src);
    render();
    return;
  }

  const enemies = G.units.filter(x => x.owner !== u.owner && !x.dead && !x.untargetable);
  if (!enemies.length) {
    log(`🥷 ${u.name} 的亡语：没有可打击的敌方单位`, u.owner);
    return;
  }
  const tgt = enemies[Math.floor(Math.random() * enemies.length)];
  log(`🥷 ${u.name} 的亡语：对 ${tgt.name} 造成 2 点伤害`, u.owner);
  if (!tgt.isBase) showSkullAt(tgt.r, tgt.c);
  await sleep(280);
  if (!G || G.gameOver) return;
  await applyDamage(tgt, 2, u);
  render();
}

/* ---------- 召唤触发 ---------- */
async function triggerElderSummon(u) {
  const enemies = G.units.filter(x => x.owner !== u.owner && !x.dead && !x.isBase && !x.untargetable);
  if (!enemies.length) return;
  let chosen = null;
  if (u.owner === 'player') chosen = await askPlayerChooseEnemy(enemies);
  else { chosen = enemies.slice().sort((a,b)=>threatScore(b)-threatScore(a))[0]; await sleep(320); }
  if (!chosen || G.gameOver) return;
  u.silenceTargetUid = chosen.uid;
  log(`🚫 ${u.name} 选择 ${chosen.name} 作为禁言目标`, u.owner);
  render();
}
async function triggerIdiotSummon(u) {
  const allUnits = G.units.filter(x => !x.dead && !x.isBase && x !== u && !(x.untargetable && x.owner !== u.owner));
  if (!allUnits.length) return;
  let chosen = null;
  if (u.owner === 'player') chosen = await askPlayerChooseAnyUnit(allUnits);
  else {
    const enemies = allUnits.filter(x => x.owner !== u.owner);
    chosen = (enemies.length ? enemies : allUnits).slice().sort((a,b)=>threatScore(b)-threatScore(a))[0];
    await sleep(320);
  }
  if (!chosen || G.gameOver) return;
  await executeRetreat(chosen);
  log(`🤤 ${u.name} 使 ${chosen.name} 撤退`, u.owner);
  render();
}
async function triggerCupidSummon(u) {
  const allUnits = G.units.filter(x => !x.dead && !x.isBase && x !== u && !(x.untargetable && x.owner !== u.owner));
  if (!allUnits.length) return;
  let chosen = null;
  if (u.owner === 'player') chosen = await askPlayerChooseAnyUnit(allUnits);
  else {
    const allies = allUnits.filter(x => x.owner === u.owner);
    const pool = allies.length ? allies : allUnits;
    chosen = pool.slice().sort((a,b)=>unitValue(b)-unitValue(a))[0];
    await sleep(320);
  }
  if (!chosen || G.gameOver) return;
  chosen.def += 2; chosen.blessed = true;
  log(`💘 ${u.name} 祝福了 ${chosen.name}，+2 防御（现 ${chosen.def}）`, u.owner);
  showStatChangeFx(chosen.r, chosen.c, 2, 'def');
  render();
}
async function triggerWolfSummon(wolf) {
  const candidates = G.units.filter(u =>
    u.owner === wolf.owner && !u.isBase && !u.dead && u !== wolf &&
    (u.faction === '民' || u.faction === '神')
  );
  if (!candidates.length) { log(`🩸 ${wolf.name} 没有可献祭的友方民/神单位，召唤失败`, wolf.owner); return false; }
  let chosen = null;
  if (wolf.owner === 'player') chosen = await askPlayerChooseSacrifice(candidates);
  else { chosen = candidates.slice().sort((a,b)=>unitValue(a)-unitValue(b))[0]; await sleep(320); }
  if (!chosen || G.gameOver) return false;
  log(`🩸 ${wolf.name} 献祭了 ${chosen.name}`, wolf.owner);
  showBloodFx(chosen.r, chosen.c);
  await sleep(500);
  await killUnit(chosen);
  render();
  return true;
}

/* =========================================================
   ★ 舍（村庄）：点击激活
   ========================================================= */
async function activateHut(hut, owner) {
  if (!G || G.gameOver) return false;
  if (!hut || !hut.isHut || hut.dead) return false;
  if (hut.owner !== owner) return false;
  if (hut.hutUsedThisTurn) {
    if (owner === 'player') log('🏘️ 此舍本回合已激活', owner);
    return false;
  }
  const p = owner === 'player' ? G.player : G.ai;
  const cost = hut.activateCost || 0;
  if (p.mana < cost) {
    if (owner === 'player') log('💧 法力不足，无法激活舍', owner);
    return false;
  }

  p.mana -= cost;
  hut.hutUsedThisTurn = true;

  showHutFx(hut.r, hut.c);
  log(`🏘️ ${owner === 'player' ? '🔵' : '🔴'}激活了舍（消耗 ${cost} 法力）`, owner);
  render();
  await sleep(420);
  if (!G || G.gameOver) return true;

  if (hut.cardId === 'fieldHospital') {
    log(`🏥 战地医院：治疗所有友方单位 3 点防御`, owner);
    const allies = G.units.filter(u => u.owner === owner && !u.dead && !u.isBase);
    for (const a of allies) {
      if (a.dead) continue;
      a.def += 3;
      showStatChangeFx(a.r, a.c, 3, 'def');
      log(`🏥 ${a.name} +3 防御（现 ${a.def}）`, owner);
      render();
      await sleep(180);
    }
    return true;
  }

  const deckUnits = p.deck.filter(c => c.type === 'unit');
  if (deckUnits.length > 0) {
    const pick = deckUnits[Math.floor(Math.random() * deckUnits.length)];
    const idx = p.deck.indexOf(pick);
    if (idx >= 0) p.deck.splice(idx, 1);
    if (!pick._handUid) pick._handUid = ++handUidSeq;
    if (p.hand.length < HAND_LIMIT) {
      p.hand.push(pick);
      log(`🏘️ 舍：从牌库抽取 ${pick.name} 加入手牌`, owner);
    } else {
      showDiscardFx(pick, owner);
      log(`🏘️ 舍：手牌已满，${pick.name} 被弃掉`, owner);
    }
    render();
    await sleep(320);
  } else {
    const folkCards = CARDS.filter(c => c.type === 'unit' && c.faction === '民');
    if (!folkCards.length) {
      log(`🏘️ 舍：没有可用的民`, owner);
      return true;
    }
    const picks = [];
    for (let i = 0; i < 2; i++) {
      const c = folkCards[Math.floor(Math.random() * folkCards.length)];
      picks.push({ ...c, _handUid: ++handUidSeq });
    }
    log(`🏘️ 舍：牌库无单位，随机生成 ${picks.map(x => x.name).join('、')}`, owner);

    let chosen = null;
    if (owner === 'player' && !G.autoMode) {
      chosen = await askPlayerChooseHutReward(picks);
    } else {
      chosen = picks.slice().sort((a, b) => (b.summonCost || 0) - (a.summonCost || 0))[0];
      await sleep(360);
    }
    if (!chosen || !G || G.gameOver) return true;

    const discarded = picks.find(x => x._handUid !== chosen._handUid);
    if (p.hand.length < HAND_LIMIT) {
      p.hand.push(chosen);
      log(`🏘️ 舍：获得 ${chosen.name} 加入手牌`, owner);
    } else {
      showDiscardFx(chosen, owner);
      log(`🏘️ 舍：手牌已满，${chosen.name} 被弃掉`, owner);
    }
    if (discarded) log(`🏘️ 舍：另一个 ${discarded.name} 被弃掉`, owner);
    render();
    await sleep(400);
  }
  return true;
}

async function activateHutForPlayer(hut) {
  if (!G || G.gameOver) return;
  if (G.turn !== G.mySide) return;
  if (G.busy || G.choiceMode || mulliganState) return;
  G.busy = true;
  try {
    const ok = await activateHut(hut, G.mySide);
    if (!ok) playSound('error');
    else playSound('click');
  } finally { G.busy = false; }
  if (!G.gameOver) render();
}

/* =========================================================
   策激活 / 取消激活
   ========================================================= */
function activateScheme(owner, handUid) {
  if (!G || !G.activeSchemes) return false;
  const p = owner === 'player' ? G.player : G.ai;
  const handCard = p.hand.find(c => c._handUid === handUid);
  if (!handCard || !isSchemeCard(handCard)) return false;
  const card = CARD_MAP[handCard.id];
  if (!card) return false;
  if (G.activeSchemes[owner].some(s => s.handUid === handUid)) return false;
  if (p.mana < card.summonCost) { log(`法力不足，无法激活 ${card.name}`, owner); return false; }

  p.mana -= card.summonCost;
  G.activeSchemes[owner].push({
    cardId: handCard.id,
    manaCost: card.summonCost,
    activatedOnTurn: G.stats.totalTurns,
    handUid
  });

  if (owner === 'player') playSound('schemeActivate');

  if (owner === 'player') {
    log(`❔ 激活策：${card.name}（消耗 ${card.summonCost} 法力）`, owner);
  } else {
    log(`❔ 狼人消耗了 ${card.summonCost} 点法力`, 'system');
  }
  return true;
}
function deactivateScheme(owner, handUid) {
  if (!G || !G.activeSchemes) return false;
  const list = G.activeSchemes[owner];
  const idx = list.findIndex(s => s.handUid === handUid);
  if (idx < 0) return false;
  const s = list.splice(idx, 1)[0];
  const p = owner === 'player' ? G.player : G.ai;
  p.mana += s.manaCost;
  const card = CARD_MAP[s.cardId];
  if (owner === 'player') {
    log(`❓ 取消激活策：${card ? card.name : '?'}（返还 ${s.manaCost} 法力）`, owner);
  } else {
    log(`❓ 狼人返还了 ${s.manaCost} 点法力`, 'system');
  }
  return true;
}
function isSchemeActive(owner, handUid) {
  if (!G || !G.activeSchemes) return false;
  return G.activeSchemes[owner].some(s => s.handUid === handUid);
}
function getActiveSchemesByCardId(owner, cardId) {
  if (!G || !G.activeSchemes) return [];
  return G.activeSchemes[owner].filter(s => s.cardId === cardId);
}
function removeSchemeFromHand(owner, schemeEntry) {
  const p = owner === 'player' ? G.player : G.ai;
  const idx = p.hand.findIndex(c => c._handUid === schemeEntry.handUid);
  if (idx >= 0) {
    const card = p.hand[idx];
    if (owner === 'player') log(`❔ 你的策「${card.name}」已触发`, owner);
    else log(`❔ 狼人的策已触发`, 'system');
    p.hand.splice(idx, 1);
    return true;
  }
  return false;
}

/* =========================================================
   触发：劫营 + 贪得无厌
   ========================================================= */
async function triggerSchemesOnExtraDraw(drawerWho) {
  if (!G || G.gameOver) return;
  const opponent = drawerWho === 'player' ? 'ai' : 'player';

  const raids = getActiveSchemesByCardId(opponent, 'raid');
  if (raids.length) {
    const triggered = [];
    for (const s of raids) {
      if (G.gameOver) break;
      const enemies = G.units.filter(u => u.owner === drawerWho && !u.dead);
      if (!enemies.length) break;
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      log(`🚷 劫营触发！对 ${target.name} 造成 3 点伤害`, opponent);
      showRaidFx(target.r, target.c);
      await sleep(300);
      await applyDamage(target, 3);
      render();
      await sleep(200);
      removeSchemeFromHand(opponent, s);
      triggered.push(s.handUid);
    }
    G.activeSchemes[opponent] = G.activeSchemes[opponent].filter(s => !triggered.includes(s.handUid));
    render();
    if (triggered.length) await triggerMageOnScheme(opponent);
  }

  const greeds = getActiveSchemesByCardId(opponent, 'greed');
  if (greeds.length && !G.gameOver) {
    const enemyBase = G.units.find(u => u.owner === opponent && u.isBase);
    const triggered = [];
    for (const s of greeds) {
      if (G.gameOver) break;
      if (enemyBase) showGreedFx(enemyBase.r, enemyBase.c);
      log(`🤑 贪得无厌触发！${drawerWho === 'player' ? '你' : '狼人'}再额外抽 2 张`, opponent);
      await sleep(360);
      for (let i = 0; i < 2; i++) {
        if (!G || G.gameOver) break;
        drawCard(drawerWho, { extra: false });
        render();
        await sleep(220);
      }
      removeSchemeFromHand(opponent, s);
      triggered.push(s.handUid);
    }
    G.activeSchemes[opponent] = G.activeSchemes[opponent].filter(s => !triggered.includes(s.handUid));
  }
}

/* =========================================================
   触发：轻谋浅虑
   ========================================================= */
async function triggerSchemesOnEnemyTactic(casterWho, tacticCard) {
  if (!G || G.gameOver) return;
  const opponent = casterWho === 'player' ? 'ai' : 'player';
  const schemes = getActiveSchemesByCardId(opponent, 'cheapScheme');
  if (!schemes.length) return;
  const triggered = [];
  for (const s of schemes) {
    if (G.gameOver) break;
    const enemyBase = G.units.find(u => u.owner === casterWho && u.isBase && u.hp > 0);
    if (!enemyBase) break;
    log(`🤪 轻谋浅虑触发！对敌方总部造成 ${tacticCard.summonCost} 点伤害`, opponent);
    showCheapSchemeFx(enemyBase.r, enemyBase.c);
    await sleep(300);
    await applyDamage(enemyBase, tacticCard.summonCost);
    render();
    await sleep(200);
    removeSchemeFromHand(opponent, s);
    triggered.push(s.handUid);
  }
  G.activeSchemes[opponent] = G.activeSchemes[opponent].filter(s => !triggered.includes(s.handUid));
  render();
  if (triggered.length) await triggerMageOnScheme(opponent);
}

/* =========================================================
   触发：复仇
   ========================================================= */
async function triggerSchemesOnBaseDamage(hurtOwner, dmgAmount) {
  if (!G || G.gameOver) return;
  if (G.turn === hurtOwner) return;
  const schemes = getActiveSchemesByCardId(hurtOwner, 'revenge');
  if (!schemes.length) return;
  const opponent = hurtOwner === 'player' ? 'ai' : 'player';
  const triggered = [];
  for (const s of schemes) {
    if (G.gameOver) break;
    const enemies = G.units.filter(u => u.owner === opponent && !u.dead);
    if (!enemies.length) break;
    const shuffled = enemies.slice().sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 2);
    log(`😡 复仇触发！对敌方 ${targets.length} 个目标各造成 ${dmgAmount} 点伤害`, hurtOwner);
    for (const t of targets) {
      if (G.gameOver) return;
      showRevengeFx(t.r, t.c);
      await sleep(200);
      await applyDamage(t, dmgAmount);
      render();
      await sleep(150);
    }
    removeSchemeFromHand(hurtOwner, s);
    triggered.push(s.handUid);
  }
  G.activeSchemes[hurtOwner] = G.activeSchemes[hurtOwner].filter(s => !triggered.includes(s.handUid));
  render();
  if (triggered.length) await triggerMageOnScheme(hurtOwner);
}

/* =========================================================
   使用"计"牌（内部调用，玩家入口已在 main.js）
   ========================================================= */
async function useTacticCard(idx) {
  /* 该入口已迁移到 main.js；此处保留兼容 */
  if (typeof window._useTacticCardMain === 'function') return window._useTacticCardMain(idx);
}

async function tacticForcedMarch() {
  const affected = G.units.filter(u => u.owner === G.turn && !u.isBase && !u.dead && !u.isHut);
  if (!affected.length) { log('📯 急行军：场上没有己方单位', G.turn); render(); return; }
  let count = 0;
  for (const u of affected) {
    if (u.silenced) { u.silenced = false; log(`📯 ${u.name} 解除了禁言`, G.turn); }
    const swiftKw = u.keywords.find(k => k.id === 'swift');
    if (!swiftKw) {
      u.keywords.push({ id: 'swift' }); u.swift = true; u.tempSwift = true;
      if (u.actionsLeft < u.maxActions) u.actionsLeft = u.maxActions;
    } else {
      let h = u.keywords.find(k => k.id === 'haste');
      if (h) h.level += 1; else u.keywords.push({ id: 'haste', level: 1 });
      u.maxActions += 1; u.actionsLeft += 1;
      u.tempHasteDelta = (u.tempHasteDelta || 0) + 1;
    }
    count++;
    showHornAt(u.r, u.c);
    render();
    await sleep(150);
  }
  log(`📯 急行军：${count} 个己方单位获得增益`, G.turn);
  render();
}
function clearForcedMarchEffects(who) {
  if (!G) return;
  let cleared = 0;
  G.units.forEach(u => {
    if (u.owner !== who) return;
    let ch = false;
    if (u.tempSwift) {
      u.keywords = u.keywords.filter(k => k.id !== 'swift');
      u.swift = false; u.tempSwift = false; ch = true;
    }
    if (u.tempHasteDelta) {
      const h = u.keywords.find(k => k.id === 'haste');
      if (h) { h.level -= u.tempHasteDelta; if (h.level <= 0) u.keywords = u.keywords.filter(k => k.id !== 'haste'); }
      u.maxActions -= u.tempHasteDelta;
      if (u.actionsLeft > u.maxActions) u.actionsLeft = u.maxActions;
      u.tempHasteDelta = 0; ch = true;
    }
    if (ch) cleared++;
  });
  if (cleared > 0) log(`📯 急行军效果结束（${cleared} 个单位）`, who);
}
async function tacticLastStand() {
  const user = G.turn;
  const userP = user === 'player' ? G.player : G.ai;
  const userLabel = user === 'player' ? '你的' : '狼人的';
  showJudgmentWave();
  await sleep(500);
  if (G.gameOver) return;
  const targets = G.units.filter(u => !u.dead);
  let killedCount = 0, recycledCount = 0;
  for (const t of targets) {
    if (t.dead || G.gameOver) continue;
    const tr = t.r, tc = t.c;
    const isBase = !!t.isBase;
    const cardId = t.cardId, oldOwner = t.owner;
    if (isBase) t.hp -= 3; else { t.def -= 3; flashUnitDamage(t.uid); }
    render();
    await sleep(150);
    if (!t.dead && (isBase ? t.hp <= 0 : t.def <= 0)) {
      if (isBase) {
        const w = t.owner === 'player' ? 'ai' : 'player';
        log(`🚩 绝地反击摧毁了${t.owner === 'player' ? '村庄' : '狼穴'}总部！`, user);
        endGame(w); return;
      }
      killedCount++;
      await killUnit(t);
      showSkullAt(tr, tc);
      if (cardId) {
        const def = CARD_MAP[cardId];
        if (def) {
          userP.deck.push({ ...def });
          userP.deck = shuffle(userP.deck);
          recycledCount++;
          log(`📚 ${def.name} 已洗入${userLabel}牌库`, user);
        }
      }
      render();
      await sleep(150);
    }
  }
  if (G.gameOver) return;
  log(`🚩 绝地反击：${killedCount} 个单位被消灭，${recycledCount} 张洗入牌库`, user);
  let drawnCount = 0;
  for (let i = 0; i < 3; i++) {
    if (G.gameOver) return;
    const before = userP.hand.length;
    drawCard(user, { extra: true });
    if (userP.hand.length > before) { drawnCount++; render(); await sleep(180); }
    else break;
  }
  if (drawnCount > 0) log(`🚩 绝地反击：额外抽了 ${drawnCount} 张牌`, user);
  checkGameOver();
  render();
}
async function tacticExpandAdvantage() {
  const myUnits = G.units.filter(u => u.owner === G.turn && !u.isBase && !u.dead).length;
  const enemyUnits = G.units.filter(u => u.owner !== G.turn && !u.isBase && !u.dead).length;
  if (myUnits <= enemyUnits) {
    log(`📈 扩大优势：友方单位(${myUnits}) 不多于敌方(${enemyUnits})，无法生效`, G.turn);
    return;
  }
  showExpandFx(G.turn);
  let drawnCount = 0;
  for (let i = 0; i < 2; i++) {
    if (G.gameOver) return;
    const p = G.turn === 'player' ? G.player : G.ai;
    const before = p.hand.length;
    drawCard(G.turn, { extra: true });
    if (p.hand.length > before) { drawnCount++; render(); await sleep(160); }
    else break;
  }
  log(`📈 扩大优势：友方 ${myUnits} 对敌方 ${enemyUnits}，抽了 ${drawnCount} 张牌`, G.turn);
}
async function tacticHarvest() {
  const myHand = G.turn === 'player' ? G.player.hand.length : G.ai.hand.length;
  const enemyHand = G.turn === 'player' ? G.ai.hand.length : G.player.hand.length;
  let targetWho = null;
  if (myHand > enemyHand) targetWho = G.turn;
  else if (enemyHand > myHand) targetWho = G.turn === 'player' ? 'ai' : 'player';
  else { log(`🌾 丰收：双方手牌一样多，效果无效`, G.turn); return; }
  const base = G.units.find(u => u.owner === targetWho && u.isBase);
  if (base) showHarvestFx(base.r, base.c);
  await sleep(400);
  let drawnCount = 0;
  for (let i = 0; i < 2; i++) {
    if (G.gameOver) return;
    const p = targetWho === 'player' ? G.player : G.ai;
    const before = p.hand.length;
    drawCard(targetWho, { extra: true });
    if (p.hand.length > before) { drawnCount++; render(); await sleep(180); }
    else break;
  }
  log(`🌾 丰收：${targetWho === 'player' ? '你' : '狼人'}（手牌较多）抽了 ${drawnCount} 张牌`, G.turn);
}
async function tacticMerchant(card) {
  const user = G.turn;
  const userP = user === 'player' ? G.player : G.ai;
  const enemyP = user === 'player' ? G.ai : G.player;
  const enemyOwner = user === 'player' ? 'ai' : 'player';
  const currentCost = card.summonCost;
  const drawCount = currentCost - 1;
  showMerchantFx(user);
  await sleep(900);
  if (G.gameOver) return;
  let drawnCount = 0;
  for (let i = 0; i < drawCount; i++) {
    if (G.gameOver) return;
    const before = userP.hand.length;
    drawCard(user, { extra: true });
    if (userP.hand.length > before) { drawnCount++; render(); await sleep(160); }
    else break;
  }
  log(`🐫 流浪商队：${user === 'player' ? '你' : '狼人'}抽了 ${drawnCount} 张牌`, user);
  const baseCard = CARD_MAP['merchant'];
  const newCard = { ...baseCard, summonCost: currentCost + 1, _handUid: ++handUidSeq };
  enemyP.hand.push(newCard);
  log(`🐫 流浪商队：${currentCost + 1} 费版本加入${enemyOwner === 'player' ? '你' : '狼人'}手牌`, user);
  render();
}

/* 妥协 */
async function tacticCompromise(card) {
  const user = G.turn;
  const enemy = user === 'player' ? 'ai' : 'player';
  const enemyP = enemy === 'player' ? G.player : G.ai;
  const userLabel = user === 'player' ? '你' : '狼人';
  const enemyLabel = enemy === 'player' ? '你' : '狼人';

  let choice = null;
  const isHumanPlayer = (user === G.mySide) && !G.autoMode;
  if (isHumanPlayer) {
    choice = await askCompromiseChoice();
  } else {
    const myBase = G.units.find(u => u.owner === user && u.isBase && u.hp > 0);
    if (myBase && myBase.hp <= 8) choice = 'draw';
    else choice = 'both';
    await sleep(420);
  }
  if (!choice || !G || G.gameOver) return;

  if (choice === 'draw') {
    let myBase = G.units.find(u => u.owner === user && u.isBase);
    if (myBase) showCompromiseFloatFx(myBase.r, myBase.c, '👋');
    log(`👋 妥协：${userLabel}抽一张牌，己方总部 +1 血量`, user);
    render();
    await sleep(420);
    if (!G || G.gameOver) return;

    drawCard(user);
    render();
    await sleep(280);
    if (!G || G.gameOver) return;

    myBase = G.units.find(u => u.owner === user && u.isBase && u.hp > 0);
    if (myBase) {
      myBase.hp += 1;
      log(`👋 妥协：${userLabel}的总部 +1 血量（现 ${myBase.hp}）`, user);
    }
    render();
    await sleep(360);
  } else {
    const myBase = G.units.find(u => u.owner === user && u.isBase);
    const eBase = G.units.find(u => u.owner === enemy && u.isBase);
    if (myBase) showCompromiseFloatFx(myBase.r, myBase.c, '🤝');
    if (eBase) showCompromiseFloatFx(eBase.r, eBase.c, '🤝');
    log(`🤝 妥协：双方各进行两次（每次：抽一张牌 + 总部 +1 血量）`, user);
    render();
    await sleep(420);
    if (!G || G.gameOver) return;

    for (let i = 0; i < 2; i++) {
      if (!G || G.gameOver) return;

      drawCard(user);
      render();
      await sleep(220);
      if (!G || G.gameOver) return;

      const myB = G.units.find(u => u.owner === user && u.isBase && u.hp > 0);
      if (myB) {
        myB.hp += 1;
        log(`🤝 妥协：${userLabel}的总部 +1 血量（现 ${myB.hp}）`, user);
      }
      render();
      await sleep(200);
      if (!G || G.gameOver) return;

      drawCard(enemy);
      render();
      await sleep(220);
      if (!G || G.gameOver) return;

      const enB = G.units.find(u => u.owner === enemy && u.isBase && u.hp > 0);
      if (enB) {
        enB.hp += 1;
        log(`🤝 妥协：${enemyLabel}的总部 +1 血量（现 ${enB.hp}）`, enemy);
      }
      render();
      await sleep(200);
    }
  }
  render();
}

/* 转圜 */
async function tacticTurnaround(card) {
  const user = G.turn;
  const enemy = user === 'player' ? 'ai' : 'player';
  const userLabel = user === 'player' ? '你' : '狼人';

  const enemies = G.units.filter(u => u.owner === enemy && !u.dead && !u.untargetable);
  if (!enemies.length) { log('⤴️ 转圜：没有敌方目标', user); return; }

  let target = null;
  if (user === G.mySide && !G.autoMode) {
    target = await askPlayerChooseEnemyTarget(enemies);
  } else {
    target = enemies.slice().sort((a, b) => {
      const av = a.isBase ? a.hp : a.def;
      const bv = b.isBase ? b.hp : b.def;
      return av - bv;
    })[0];
    await sleep(320);
  }
  if (!target || G.gameOver) return;

  log(`⤴️ 转圜：${userLabel}对 ${target.name} 造成 2 点伤害`, user);
  showTurnaroundFx(target.r, target.c);
  await sleep(300);
  if (!G || G.gameOver) return;
  await applyDamage(target, 2);
  if (!G || G.gameOver) return;

  const active = G.activeSchemes[enemy] || [];
  if (active.length) {
    const p = enemy === 'player' ? G.player : G.ai;
    for (const s of active) {
      const idx = p.hand.findIndex(c => c._handUid === s.handUid);
      if (idx >= 0) p.hand.splice(idx, 1);
    }
    G.activeSchemes[enemy] = [];
    log(`⤴️ 转圜：弃掉了敌方 ${active.length} 张已激活的策`, user);
  }
  render();
  await sleep(300);
}

/* 圣歌 */
async function tacticHymn() {
  const user = G.turn;
  const userLabel = user === 'player' ? '你' : '狼人';
  const p = user === 'player' ? G.player : G.ai;
  log(`🎼 圣歌：${userLabel}的神单位获得增益`, user);

  const fieldUnits = G.units.filter(u => u.owner === user && !u.isBase && u.faction === '神' && !u.dead);
  for (const u of fieldUnits) {
    const old = u.actionCost;
    u.actionCost = Math.max(0, u.actionCost - 1);
    if (u.actionCost !== old) {
      showStatChangeFx(u.r, u.c, u.actionCost - old, 'cost');
      log(`🎼 ${u.name} 行动花费 ${old} → ${u.actionCost}`, user);
    }
  }

  for (const card of p.hand) {
    if (card.type === 'unit' && card.faction === '神') {
      card.atk = (card.atk || 0) + 1;
      card.def = (card.def || 0) + 2;
    }
  }

  for (const card of p.deck) {
    if (card.type === 'unit' && card.faction === '神') {
      card.summonCost = Math.max(0, card.summonCost - 1);
    }
  }

  render();
  await sleep(400);
}

/* 休养生息 */
async function tacticRest() {
  const user = G.turn;
  const p = user === 'player' ? G.player : G.ai;
  const allies = G.units.filter(u =>
    u.owner === user && !u.isBase && !u.dead &&
    (u.faction === '民' || u.faction === '无')
  );
  if (!allies.length) {
    log('❤️‍🩹 休养生息：没有友方民/无单位', user);
    return;
  }

  for (const u of allies) {
    if (Math.random() < 0.5) {
      p.mana += 2;
      log(`❤️‍🩹 ${u.name} 触发：获得 2 点法力（现 ${p.mana}/${p.maxMana}）`, user);
    } else {
      u.def += 2;
      showStatChangeFx(u.r, u.c, 2, 'def');
      log(`❤️‍🩹 ${u.name} 触发：+2 防御（现 ${u.def}）`, user);
    }
    showRestFx(u.r, u.c);
    render();
    await sleep(320);
  }
}

/* 贿赂 */
async function tacticBribe() {
  const user = G.turn;
  const enemy = user === 'player' ? 'ai' : 'player';
  const userP = user === 'player' ? G.player : G.ai;
  const userLabel = user === 'player' ? '你' : '狼人';
  const enemyLabel = enemy === 'player' ? '你' : '狼人';

  log(`💰 贿赂：${enemyLabel}抽两张牌，${userLabel}获得 2 点法力`, user);
  render();
  await sleep(300);
  if (!G || G.gameOver) return;

  for (let i = 0; i < 2; i++) {
    if (!G || G.gameOver) return;
    drawCard(enemy, { extra: true });
    render();
    await sleep(260);
  }
  if (!G || G.gameOver) return;

  userP.mana += 2;
  log(`💰 贿赂：${userLabel}获得 2 点法力（现 ${userP.mana}/${userP.maxMana}）`, user);
  render();
  await sleep(320);
}

/* 仓廪空虚 */
async function tacticGranary() {
  const user = G.turn;
  const enemy = user === 'player' ? 'ai' : 'player';
  const enemyP = enemy === 'player' ? G.player : G.ai;

  const targets = G.units.filter(u => u.owner === enemy && !u.dead && !u.untargetable);
  if (!targets.length) { log('🏚️ 仓廪空虚：没有敌方目标', user); return; }

  let target = null;
  if (user === G.mySide && !G.autoMode) {
    target = await askPlayerChooseEnemyTarget(targets);
  } else {
    target = targets.slice().sort((a, b) => {
      const av = a.isBase ? a.hp : a.def;
      const bv = b.isBase ? b.hp : b.def;
      return av - bv;
    })[0];
    await sleep(320);
  }
  if (!target || G.gameOver) return;

  const dmg = Math.max(0, 9 - enemyP.hand.length);
  log(`🏚️ 仓廪空虚：敌方手牌 ${enemyP.hand.length} 张 → 造成 ${dmg} 点伤害`, user);
  showGranaryFx(target.r, target.c);
  await sleep(500);
  if (!G || G.gameOver) return;
  if (dmg > 0) await applyDamage(target, dmg);
  render();
}

/* 机械狼 */
async function tacticMechwolf() {
  const user = G.turn;
  const userLabel = user === 'player' ? '你' : '狼人';

  const allUnits = G.units.filter(u => !u.dead && !u.isBase);
  const targetable = allUnits.filter(u => !(u.untargetable && u.owner !== user));
  if (!targetable.length) { log('🐺 机械狼：没有可选择的单位', user); return; }

  let chosen = null;
  if (user === G.mySide && !G.autoMode) {
    chosen = await askPlayerChooseAnyUnit(targetable);
  } else {
    const score = u => {
      let s = 0;
      if (u.effect && u.effect.type === 'deathrattle') s += 10;
      if (['elder','idiot','cupid','werewolf'].includes(u.cardId)) s += 8;
      if (u.owner === user) s += 2;
      return s;
    };
    chosen = targetable.slice().sort((a,b) => score(b) - score(a))[0];
    await sleep(360);
  }
  if (!chosen || !G || G.gameOver) return;

  log(`🐺 机械狼：触发 ${chosen.name} 的效果`, user);
  showMechwolfFx(chosen.r, chosen.c);
  await sleep(400);
  if (!G || G.gameOver) return;

  if (chosen.effect && chosen.effect.type === 'deathrattle' && !chosen.dead) {
    const fn = DEATHRATTLE_REGISTRY[chosen.effect.trigger];
    if (typeof fn === 'function') {
      try { await fn(chosen); } catch (err) { console.error(err); }
    }
  }
  if (!chosen.dead) {
    if (chosen.cardId === 'elder') await triggerElderSummon(chosen);
    else if (chosen.cardId === 'idiot') await triggerIdiotSummon(chosen);
    else if (chosen.cardId === 'cupid') await triggerCupidSummon(chosen);
    else if (chosen.cardId === 'werewolf') await triggerWolfSummon(chosen);
  }
  render();
}

/* 暴怒 */
async function tacticFury() {
  const user = G.turn;
  const userLabel = user === 'player' ? '你' : '狼人';
  const allies = G.units.filter(u => u.owner === user && !u.isBase && !u.dead);
  if (!allies.length) {
    log('🩸 暴怒：没有己方单位', user);
    return;
  }
  log(`🩸 暴怒：${userLabel}所有单位本回合 +2 攻击力`, user);
  for (const u of allies) {
    u.atk += 2;
    u.tempAtk = (u.tempAtk || 0) + 2;
    u.furyMark = user;
    showStatChangeFx(u.r, u.c, 2, 'atk');
    render();
    await sleep(150);
  }
}

/* =========================================================
   对峙
   ========================================================= */
async function standoffDraw(who) {
  const p = who === 'player' ? G.player : G.ai;
  if (!p.deck.length) return;
  const c = p.deck.pop();
  c._handUid = ++handUidSeq;
  const label = who === 'player' ? '你' : '狼人';
  if (p.hand.length < HAND_LIMIT) {
    p.hand.push(c);
    log(`🆚 对峙：${label}抽到 ${c.name}`, who);
  } else {
    showDiscardFx(c, who);
    log(`🆚 对峙：手牌已满，${c.name} 被弃掉`, who);
  }
  render();
  await sleep(320);
}
async function standoffFatigue(who) {
  if (!G || G.gameOver) return;
  const allies = G.units.filter(u => u.owner === who && !u.dead);
  if (!allies.length) return;
  const target = allies[Math.floor(Math.random() * allies.length)];
  const label = who === 'player' ? '你的' : '狼人的';
  showEmptyDeckFx(target.r, target.c);
  log(`💸 ${label}牌库已空！${target.name} 受到 2 点疲劳伤害`, who);
  render();
  await sleep(320);
  if (!G || G.gameOver) return;
  await applyDamage(target, 2);
}
async function tacticStandoffSingle() {
  const user = G.turn;
  const enemy = user === 'player' ? 'ai' : 'player';
  const userP = user === 'player' ? G.player : G.ai;
  const enemyP = enemy === 'player' ? G.player : G.ai;

  const userHas = userP.deck.length > 0;
  const enemyHas = enemyP.deck.length > 0;

  if (!userHas && !enemyHas) {
    log('🆚 对峙：双方牌库皆空，双方都触发疲劳伤害', 'system');
    await standoffFatigue(user);
    if (!G || G.gameOver) return;
    await standoffFatigue(enemy);
    render();
    return;
  }

  if (!userHas || !enemyHas) {
    if (userHas) {
      await standoffDraw(user);
      if (!G || G.gameOver) return;
      await standoffFatigue(enemy);
    } else {
      await standoffFatigue(user);
      if (!G || G.gameOver) return;
      await standoffDraw(enemy);
    }
    render();
    return;
  }

  const userCard = userP.deck.pop();
  const enemyCard = enemyP.deck.pop();
  userCard._handUid = ++handUidSeq;
  enemyCard._handUid = ++handUidSeq;

  const uc = userCard.summonCost;
  const ec = enemyCard.summonCost;

  const isCasterPlayer = (user === 'player');
  const playerCard = isCasterPlayer ? userCard  : enemyCard;
  const aiCard     = isCasterPlayer ? enemyCard : userCard;
  const pc = isCasterPlayer ? uc : ec;
  const ac = isCasterPlayer ? ec : uc;

  await showStandoffFx(playerCard, aiCard, pc, ac);
  if (!G || G.gameOver) return;

  if (uc > ec) {
    if (userP.hand.length < HAND_LIMIT) {
      userP.hand.push(userCard);
      log(`🆚 对峙：${user === 'player' ? '你的' : '狼人的'}牌（💧${uc}）更大，保留`, user);
    } else {
      showDiscardFx(userCard, user);
      log(`🆚 对峙：${user === 'player' ? '你' : '狼人'}的手牌已满，${userCard.name} 被弃掉`, user);
    }
    log(`🆚 对峙：${enemy === 'player' ? '你的' : '狼人的'}牌（💧${ec}）更小，弃掉`, enemy);
  } else if (ec > uc) {
    if (enemyP.hand.length < HAND_LIMIT) {
      enemyP.hand.push(enemyCard);
      log(`🆚 对峙：${enemy === 'player' ? '你的' : '狼人的'}牌（💧${ec}）更大，保留`, enemy);
    } else {
      showDiscardFx(enemyCard, enemy);
      log(`🆚 对峙：${enemy === 'player' ? '你' : '狼人'}的手牌已满，${enemyCard.name} 被弃掉`, enemy);
    }
    log(`🆚 对峙：${user === 'player' ? '你的' : '狼人的'}牌（💧${uc}）更小，弃掉`, user);
  } else {
    log(`🆚 对峙：双方牌费用相同（💧${uc}），都弃掉`, 'system');
  }
  render();
}
async function tacticStandoff() {
  for (let i = 0; i < 3; i++) {
    if (!G || G.gameOver) return;
    await tacticStandoffSingle();
    if (!G || G.gameOver) return;
    await sleep(200);
  }
}

const DEATHRATTLE_REGISTRY = {
  magicianDeathrattle,
  bomberDeathrattle,
  witchDeathrattle,
  assassinDeathrattle
};

const TACTIC_REGISTRY = {
  tacticForcedMarch,
  tacticLastStand,
  tacticExpandAdvantage,
  tacticHarvest,
  tacticMerchant,
  tacticStandoff,
  tacticCompromise,
  tacticTurnaround,
  tacticHymn,
  tacticRest,
  tacticBribe,
  tacticGranary,
  tacticMechwolf,
  tacticFury
};