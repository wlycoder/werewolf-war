/* =========================================================
   animations.js — 所有视觉动画
   ========================================================= */

/* 1. 攻击动画 */
async function playAttackAnimation(attacker, originalTarget) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const atkEl = boardEl.querySelector(`.unit[data-uid="${attacker.uid}"]`);
  const tgtEl = boardEl.querySelector(`.unit[data-uid="${originalTarget.uid}"]`);

  if (atkEl && tgtEl) {
    const aR = atkEl.getBoundingClientRect();
    const tR = tgtEl.getBoundingClientRect();
    let dx = (tR.left + tR.width / 2) - (aR.left + aR.width / 2);
    let dy = (tR.top + tR.height / 2) - (aR.top + aR.height / 2);
    dx *= 0.65; dy *= 0.65;
    atkEl.style.setProperty('--dx', dx + 'px');
    atkEl.style.setProperty('--dy', dy + 'px');
    atkEl.classList.add('attacking');
  }
  if (tgtEl) setTimeout(() => tgtEl.classList.add('hit'), 140);

  await sleep(400);
  if (atkEl) {
    atkEl.classList.remove('attacking');
    atkEl.style.removeProperty('--dx');
    atkEl.style.removeProperty('--dy');
  }
  if (tgtEl) tgtEl.classList.remove('hit');
}

/* 2. 移动动画 */
async function playMoveAnimation(unit, fromR, fromC, toR, toC) {
  const boardEl = $('#board');
  if (!boardEl) return;
  await new Promise(r => requestAnimationFrame(() => r()));
  const unitEl = boardEl.querySelector(`.unit[data-uid="${unit.uid}"]`);
  if (!unitEl) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[fromR * BOARD_COLS + fromC];
  const toCell   = cells[toR * BOARD_COLS + toC];
  if (!fromCell || !toCell) return;
  const dx = toCell.offsetLeft - fromCell.offsetLeft;
  const dy = toCell.offsetTop  - fromCell.offsetTop;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  unitEl.style.setProperty('--dx', dx + 'px');
  unitEl.style.setProperty('--dy', dy + 'px');
  unitEl.classList.remove('moving');
  unitEl.classList.remove('summoning');
  void unitEl.offsetWidth;
  unitEl.classList.add('moving');
  await sleep(420);
  unitEl.classList.remove('moving');
}

/* 3. 撤退动画 */
async function playRetreatAnimation(unit, toR, toC) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const unitEl = boardEl.querySelector(`.unit[data-uid="${unit.uid}"]`);
  if (!unitEl) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[unit.r * BOARD_COLS + unit.c];
  const toCell   = cells[toR * BOARD_COLS + toC];
  if (!fromCell || !toCell) return;
  const dx = toCell.offsetLeft - fromCell.offsetLeft;
  const dy = toCell.offsetTop  - fromCell.offsetTop;
  unitEl.style.setProperty('--retreat-dx', dx + 'px');
  unitEl.style.setProperty('--retreat-dy', dy + 'px');
  unitEl.classList.add('retreating');
  await sleep(500);
}
async function playRetreatToHandAnimation(unit) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const unitEl = boardEl.querySelector(`.unit[data-uid="${unit.uid}"]`);
  if (!unitEl) return;
  unitEl.classList.add('retreating-to-hand');
  await sleep(560);
}

/* 4. 召唤动画（含部署音效） */
async function playSummonAnimation(u) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const el = boardEl.querySelector(`.unit[data-uid="${u.uid}"]`);
  if (el) {
    el.classList.add('summoning');
    setTimeout(() => el.classList.remove('summoning'), 600);
  }
  playSound('place');
  await sleep(280);
}

/* 5. 通用工具 */
function _spawnCellFx(r, c, emoji, className, duration) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return null;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return null;
  const fx = document.createElement('div');
  fx.className = className;
  fx.textContent = emoji;
  fx.style.left   = cell.offsetLeft   + 'px';
  fx.style.top    = cell.offsetTop    + 'px';
  fx.style.width  = cell.offsetWidth  + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), duration);
  return fx;
}

/* 6. 基础 emoji */
function showRetreatIcon(r, c) { _spawnCellFx(r, c, '🔙', 'retreat-icon', 1200); }
function showSkullAt(r, c)     { _spawnCellFx(r, c, '☠️', 'skull-pop', 1200); }
function showCoinAt(r, c)      { _spawnCellFx(r, c, '🪙', 'coin-pop', 1300); }
function showBuffFx(r, c)      { _spawnCellFx(r, c, '+2❤️', 'buff-pop', 1200); }
function showHornAt(r, c)      { _spawnCellFx(r, c, '📯', 'horn-fx', 1300); }
function showBloodFx(r, c)     { _spawnCellFx(r, c, '🩸', 'blood-fx', 1200); }

/* ★ 属性增减动画（22px 圆圈） */
function showStatChangeFx(r, c, value, type) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;

  const el = document.createElement('div');
  el.className = 'stat-change-fx';
  if (type === 'def') el.classList.add('def');
  else if (type === 'atk') el.classList.add('atk');
  else if (type === 'cost') el.classList.add('cost');

  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  el.textContent = sign + abs;

  const size = 22;
  el.style.left = (cell.offsetLeft + cell.offsetWidth  / 2 - size / 2) + 'px';
  el.style.top  = (cell.offsetTop  + cell.offsetHeight / 2 - size / 2) + 'px';
  el.style.width  = size + 'px';
  el.style.height = size + 'px';

  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/* 💥 炸弹人爆炸 */
function showBombFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'bomb-fx';
  fx.textContent = '💥';
  fx.style.left   = cell.offsetLeft   + 'px';
  fx.style.top    = cell.offsetTop    + 'px';
  fx.style.width  = cell.offsetWidth  + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1100);
}

/* ⚔️ → 🛡 守护触发 */
function showGuardianFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'guardian-fx';
  fx.textContent = '🛡';
  fx.style.left   = cell.offsetLeft   + 'px';
  fx.style.top    = (cell.offsetTop - 22) + 'px';
  fx.style.width  = cell.offsetWidth  + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1100);
}
/* 🤫 禁言触发 */
function showSilenceFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'silence-fx';
  fx.textContent = '🤫';
  fx.style.left   = cell.offsetLeft   + 'px';
  fx.style.top    = (cell.offsetTop - 14) + 'px';
  fx.style.width  = cell.offsetWidth  + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* 7. 魔术师亡语特效 */
function playMagicianEffect(fromUnit, toUnit) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[fromUnit.r * BOARD_COLS + fromUnit.c];
  const toCell   = cells[toUnit.r * BOARD_COLS + toUnit.c];
  if (toCell) {
    const fx = document.createElement('div');
    fx.className = 'magic-fx';
    fx.textContent = '✨';
    fx.style.left   = toCell.offsetLeft   + 'px';
    fx.style.top    = toCell.offsetTop    + 'px';
    fx.style.width  = toCell.offsetWidth  + 'px';
    fx.style.height = toCell.offsetHeight + 'px';
    fxLayer.appendChild(fx);
    setTimeout(() => fx.remove(), 1500);
  }
  if (fromCell && toCell) {
    const x1 = fromCell.offsetLeft + fromCell.offsetWidth / 2;
    const y1 = fromCell.offsetTop  + fromCell.offsetHeight / 2;
    const x2 = toCell.offsetLeft   + toCell.offsetWidth / 2;
    const y2 = toCell.offsetTop    + toCell.offsetHeight / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx);
    const link = document.createElement('div');
    link.className = 'magic-link';
    link.style.left = x1 + 'px';
    link.style.top  = y1 + 'px';
    link.style.width = len + 'px';
    link.style.transform = `rotate(${ang}rad)`;
    fxLayer.appendChild(link);
    setTimeout(() => link.remove(), 900);
  }
  const unitEl = boardEl.querySelector(`.unit[data-uid="${toUnit.uid}"]`);
  if (unitEl) {
    unitEl.classList.add('magic-blessed');
    setTimeout(() => unitEl.classList.remove('magic-blessed'), 1600);
  }
}

/* 8. 绝地反击 */
function showJudgmentWave() {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const wave = document.createElement('div');
  wave.className = 'judgment-wave';
  wave.style.left = '0'; wave.style.top = '0';
  wave.style.width = '100%'; wave.style.height = '100%';
  fxLayer.appendChild(wave);
  setTimeout(() => wave.remove(), 1500);
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);
}

/* 9. 受击闪红 */
function flashUnitDamage(uid) {
  const boardEl = $('#board');
  if (!boardEl) return;
  const el = boardEl.querySelector(`.unit[data-uid="${uid}"]`);
  if (!el) return;
  el.classList.add('taking-damage');
  setTimeout(() => el.classList.remove('taking-damage'), 500);
}

/* 10. 扩大优势 📈 */
function showExpandFx(owner) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const base = G.units.find(u => u.owner === owner && u.isBase && !u.dead);
  if (!base) return;
  const cell = boardEl.querySelectorAll('.cell')[base.r * BOARD_COLS + base.c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'expand-fx';
  fx.textContent = '📈';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1400);
}

/* 11. 女巫亡语 */
function showWitchFx(r, c, type) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'witch-fx';
  fx.textContent = type === 'apple' ? '💔' : '💖';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1400);
}

/* 12. 空牌库 💸 */
function showEmptyDeckFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'empty-deck-fx';
  fx.textContent = '💸';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1500);
}

/* 13. 弃牌 */
function showDiscardFx(card, who) {
  const overlay = document.createElement('div');
  overlay.className = 'discard-popup';
  overlay.textContent = `🚫 ${who === 'player' ? '你' : '狼人'}的 ${card.name} 被弃掉`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 20);
  setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 400);
  }, 1600);

  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const w = boardEl.offsetWidth;
  const h = boardEl.offsetHeight;
  const el = document.createElement('div');
  el.className = 'discard-card-fx';
  el.innerHTML = `
    <div class="dc-cost">💧${card.summonCost}</div>
    <div class="dc-icon">${iconHTML(card.icon) || '🃏'}</div>
    <div class="dc-name">${card.name || ''}</div>`;
  el.style.left = ((w - 80) / 2) + 'px';
  el.style.top = ((h - 110) / 2) + 'px';
  el.style.width = '80px';
  el.style.height = '110px';
  fxLayer.appendChild(el);
  setTimeout(() => el.remove(), 1250);
}

/* 14. 劫营 🚷：在被选中的卡牌上出现，随后缩小消失 */
function showRaidFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'raid-fx';
  fx.textContent = '🚷';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1200);
}

/* 15. 轻谋浅虑 🤪 */
function showCheapSchemeFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'cheap-fx';
  fx.textContent = '🤪';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* 16. 复仇 💢 */
function showRevengeFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'revenge-fx';
  fx.textContent = '💢';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1200);
}

/* 17. 丰收 🌾 */
function showHarvestFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'harvest-fx';
  fx.textContent = '🌾';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1400);
}

/* 18. 流浪商队 🐫 */
function showMerchantFx(fromOwner) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const fromBase = G.units.find(u => u.owner === fromOwner && u.isBase);
  const toBase = G.units.find(u => u.owner !== fromOwner && u.isBase);
  if (!fromBase || !toBase) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[fromBase.r * BOARD_COLS + fromBase.c];
  const toCell   = cells[toBase.r * BOARD_COLS + toBase.c];
  if (!fromCell || !toCell) return;

  const dx = toCell.offsetLeft - fromCell.offsetLeft;
  const dy = toCell.offsetTop  - fromCell.offsetTop;

  const fx = document.createElement('div');
  fx.className = 'merchant-fx';
  fx.textContent = '🐫';
  fx.style.left = fromCell.offsetLeft + 'px';
  fx.style.top = fromCell.offsetTop + 'px';
  fx.style.width = fromCell.offsetWidth + 'px';
  fx.style.height = fromCell.offsetHeight + 'px';
  fx.style.setProperty('--tx', dx + 'px');
  fx.style.setProperty('--ty', dy + 'px');
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1900);
}

/* 19. 对峙 🆚 */
async function showStandoffFx(playerCard, aiCard, pc, ac) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;

  const w = boardEl.offsetWidth;
  const h = boardEl.offsetHeight;
  const cardW = 64, cardH = 88;

  const pEl = document.createElement('div');
  pEl.className = 'standoff-card player';
  pEl.innerHTML = `
    <div class="sc-cost">💧${pc}</div>
    <div class="sc-icon">${iconHTML(playerCard.icon) || '🃏'}</div>
    <div class="sc-name">${playerCard.name || ''}</div>`;
  pEl.style.left = (w - cardW - 16) + 'px';
  pEl.style.top  = (h - cardH - 16) + 'px';
  pEl.style.width = cardW + 'px';
  pEl.style.height = cardH + 'px';
  fxLayer.appendChild(pEl);

  const aEl = document.createElement('div');
  aEl.className = 'standoff-card ai';
  aEl.innerHTML = `
    <div class="sc-cost">💧${ac}</div>
    <div class="sc-icon">${iconHTML(aiCard.icon) || '🃏'}</div>
    <div class="sc-name">${aiCard.name || ''}</div>`;
  aEl.style.left = 16 + 'px';
  aEl.style.top  = 16 + 'px';
  aEl.style.width = cardW + 'px';
  aEl.style.height = cardH + 'px';
  fxLayer.appendChild(aEl);

  const vsEl = document.createElement('div');
  vsEl.className = 'standoff-vs';
  vsEl.textContent = '🆚';
  fxLayer.appendChild(vsEl);

  await sleep(650);

  if (pc > ac) {
    pEl.classList.add('keep-down');
    aEl.classList.add('discard');
  } else if (ac > pc) {
    pEl.classList.add('discard');
    aEl.classList.add('keep-up');
  } else {
    pEl.classList.add('discard');
    aEl.classList.add('discard');
  }

  await sleep(450);
  pEl.remove();
  aEl.remove();
  vsEl.remove();
}

/* =========================================================
   ★ 🪤 圈套
   ========================================================= */
function showSnareFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'snare-fx';
  fx.textContent = '🪤';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* =========================================================
   ★ 🕳️ 陷阱
   ========================================================= */
function showPitfallFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'pitfall-fx';
  fx.textContent = '🕳️';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1400);
}

/* =========================================================
   ★ 🫥 埋伏
   ========================================================= */
function showAmbushFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'ambush-fx';
  fx.textContent = '🫥';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* =========================================================
   ★ 🎩 法师响应
   ========================================================= */
function showMageFx(fromR, fromC, toR, toC) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[fromR * BOARD_COLS + fromC];
  const toCell = cells[toR * BOARD_COLS + toC];
  if (!fromCell || !toCell) return;

  const dx = toCell.offsetLeft - fromCell.offsetLeft;
  const dy = toCell.offsetTop  - fromCell.offsetTop;

  const fx = document.createElement('div');
  fx.className = 'mage-fx';
  fx.textContent = '🎩';
  fx.style.left = fromCell.offsetLeft + 'px';
  fx.style.top = fromCell.offsetTop + 'px';
  fx.style.width = fromCell.offsetWidth + 'px';
  fx.style.height = fromCell.offsetHeight + 'px';
  fx.style.setProperty('--tx', dx + 'px');
  fx.style.setProperty('--ty', dy + 'px');
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1000);
}

/* =========================================================
   ★ 射击动画
   ========================================================= */
function pickArrowEmoji(dr, dc) {
  const key = (dr === 0 ? 0 : (dr > 0 ? 1 : -1)) + ',' +
              (dc === 0 ? 0 : (dc > 0 ? 1 : -1));
  switch (key) {
    case '1,0':   return '⬇️';
    case '-1,0':  return '⬆️';
    case '0,1':   return '➡️';
    case '0,-1':  return '⬅️';
    case '1,1':   return '↘️';
    case '1,-1':  return '↙️';
    case '-1,1':  return '↗️';
    case '-1,-1': return '↖️';
    default:      return '➡️';
  }
}

async function playRangedAttackAnimation(attacker, target) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;

  const cells = boardEl.querySelectorAll('.cell');
  const fromCell = cells[attacker.r * BOARD_COLS + attacker.c];
  const toCell   = cells[target.r * BOARD_COLS + target.c];
  if (!fromCell || !toCell) return;

  const dx = toCell.offsetLeft - fromCell.offsetLeft;
  const dy = toCell.offsetTop  - fromCell.offsetTop;
  const dr = target.r - attacker.r;
  const dc = target.c - attacker.c;
  const emoji = pickArrowEmoji(dr, dc);

  const atkEl = boardEl.querySelector(`.unit[data-uid="${attacker.uid}"]`);
  if (atkEl) {
    atkEl.style.transition = 'transform .12s ease';
    atkEl.style.transform = `translate(${-dx * 0.05}px, ${-dy * 0.05}px)`;
    setTimeout(() => {
      if (atkEl) { atkEl.style.transform = ''; }
    }, 200);
  }

  const arrow = document.createElement('div');
  arrow.className = 'shot-arrow';
  arrow.textContent = emoji;
  arrow.style.left = fromCell.offsetLeft + 'px';
  arrow.style.top = fromCell.offsetTop + 'px';
  arrow.style.width = fromCell.offsetWidth + 'px';
  arrow.style.height = fromCell.offsetHeight + 'px';
  arrow.style.setProperty('--sx', dx + 'px');
  arrow.style.setProperty('--sy', dy + 'px');
  fxLayer.appendChild(arrow);
  setTimeout(() => arrow.remove(), 700);

  await sleep(500);
  if (!G || G.gameOver) return;

  const impact = document.createElement('div');
  impact.className = 'shot-impact';
  impact.textContent = '✸';
  impact.style.left = toCell.offsetLeft + 'px';
  impact.style.top  = toCell.offsetTop  + 'px';
  impact.style.width = toCell.offsetWidth + 'px';
  impact.style.height = toCell.offsetHeight + 'px';
  fxLayer.appendChild(impact);
  setTimeout(() => impact.remove(), 600);

  const tgtEl = boardEl.querySelector(`.unit[data-uid="${target.uid}"]`);
  if (tgtEl) {
    tgtEl.classList.add('hit');
    setTimeout(() => tgtEl.classList.remove('hit'), 380);
  }
}

/* =========================================================
   ★ 🤝 妥协
   ========================================================= */
function showCompromiseFloatFx(r, c, emoji) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'compromise-float-fx';
  fx.textContent = emoji;
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1400);
}

/* =========================================================
   ★ ❤️‍🩹 休养生息
   ========================================================= */
function showRestFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'rest-fx';
  fx.textContent = '❤️‍🩹';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1500);
}

/* =========================================================
   ★ ⤴️ 转圜
   ========================================================= */
function showTurnaroundFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'turnaround-fx';
  fx.textContent = '⤴️';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1200);
}

/* =========================================================
   ★ 🏘️ 舍激活
   ========================================================= */
function showHutFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'hut-fx';
  fx.textContent = '🏘️';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* =========================================================
   ★ 🏚️ 仓廪空虚
   ========================================================= */
function showGranaryFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'granary-fx';
  fx.textContent = '🏚️';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}

/* =========================================================
   ★ 🤑 贪得无厌
   ========================================================= */
function showGreedFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'greed-fx';
  fx.textContent = '🤑';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1200);
}

/* =========================================================
   ★ 💧 清廉
   ========================================================= */
function showIntegrityFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'integrity-fx';
  fx.textContent = '💧';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1200);
}

/* 🐺 机械狼 */
function showMechwolfFx(r, c) {
  const boardEl = $('#board');
  const fxLayer = $('#fx-layer');
  if (!boardEl || !fxLayer) return;
  const cell = boardEl.querySelectorAll('.cell')[r * BOARD_COLS + c];
  if (!cell) return;
  const fx = document.createElement('div');
  fx.className = 'mechwolf-fx';
  fx.textContent = '🐺';
  fx.style.left = cell.offsetLeft + 'px';
  fx.style.top = cell.offsetTop + 'px';
  fx.style.width = cell.offsetWidth + 'px';
  fx.style.height = cell.offsetHeight + 'px';
  fxLayer.appendChild(fx);
  setTimeout(() => fx.remove(), 1300);
}
/* =========================================================
   ★ 客机移动动画（先把视觉位置放回 from，再动画到 to）
   ========================================================= */
async function playGuestMoveAnim(unit, fromR, fromC, toR, toC) {
  /* 已在 network.js 中实现 */
}