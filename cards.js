/* =========================================================
   cards.js — 卡牌数据（新增圈套🪤 / 陷阱🕳️ / 法师🎩 / 妥协🤝 / 埋伏🫥）
   ========================================================= */

const CARDS = [
  { hex:'01', id:'knight', name:'骑士', icon:'🗡️', faction:'神', type:'unit',
    summonCost:2, actionCost:1, atk:3, def:3, maxCopies:2, rangeBonus:0,
    effect:null, keywords:[{id:'swift'},{id:'haste',level:2}] },
  { hex:'02', id:'rogue', name:'老流氓', icon:'🧔🏼‍♂️', faction:'民', type:'unit',
    summonCost:0, actionCost:0, atk:2, def:3, maxCopies:4, rangeBonus:0,
    effect:null, keywords:[{id:'swift'},{id:'haste',level:1}] },
  { hex:'03', id:'magician', name:'魔术师', icon:'🪄', faction:'神', type:'unit',
    summonCost:3, actionCost:1, atk:2, def:2, maxCopies:3, rangeBonus:0,
    effect:{ type:'deathrattle', label:'亡语', desc:'选择一个友方单位，使其获得「亡语：回到手牌」', trigger:'magicianDeathrattle' },
    keywords:[] },
  { hex:'04', id:'bomber', name:'炸弹人', icon:'💣', faction:'无', type:'unit',
    summonCost:4, actionCost:1, atk:0, def:1, maxCopies:3, rangeBonus:0,
    effect:{ type:'deathrattle', label:'亡语', desc:'随机对三个目标各造成两点伤害', trigger:'bomberDeathrattle' },
    keywords:[{id:'swift'}] },
  { hex:'05', id:'guardian', name:'守卫', icon:'assets/Texture/unit/guardian.png', faction:'神', type:'unit',
    summonCost:2, actionCost:1, atk:2, def:5, maxCopies:3, rangeBonus:0,
    effect:null, keywords:[{id:'guardian'}] },
  { hex:'06', id:'hunter', name:'猎人', icon:'🏹', faction:'神', type:'unit',
    summonCost:2, actionCost:2, atk:3, def:5, maxCopies:2, rangeBonus:1,
    effect:{label:'被动',desc:'攻击范围为 2 格'}, keywords:[{id:'swift'},{id:'haste',level:1}] },
  { hex:'07', id:'graverobber', name:'盗墓人', icon:'⛏️', faction:'无', type:'unit',
    summonCost:4, actionCost:1, atk:2, def:2, maxCopies:1, rangeBonus:0,
    effect:{label:'被动',desc:'一个友方单位死亡时，抽一张牌'}, keywords:[{id:'graverobber'}] },
  { hex:'08', id:'elder', name:'禁言长老', icon:'🧙', faction:'神', type:'unit',
    summonCost:5, actionCost:2, atk:2, def:3, maxCopies:1, rangeBonus:0,
    effect:{label:'召唤',desc:'选择一个敌方单位，每个敌方回合开始时使其获得「禁言」'}, keywords:[] },
  { hex:'09', id:'gatekeeper', name:'门卫', icon:'🚪', faction:'民', type:'unit',
    summonCost:1, actionCost:1, atk:1, def:3, maxCopies:4, rangeBonus:0,
    effect:null, keywords:[{id:'guardian'}] },
  { hex:'0A', id:'idiot', name:'白痴', icon:'🤤', faction:'民', type:'unit',
    summonCost:3, actionCost:1, atk:2, def:4, maxCopies:3, rangeBonus:0,
    effect:{label:'召唤',desc:'选择一个单位，使其撤退（向自己总部方向后退一行，若已在最后一行或前方无空位则回到手牌）'}, keywords:[] },
  { hex:'0B', id:'guerrilla', name:'游击队员', icon:'🪖', faction:'民', type:'unit',
    summonCost:2, actionCost:1, atk:3, def:3, maxCopies:1, rangeBonus:0, diagonal:true,
    effect:{label:'被动',desc:'被攻击时撤退。撤退成功则闪避；若无处可退则洗入牌库。敌方回合死亡时改为洗入牌库。可斜向移动'},
    keywords:[{id:'swift'},{id:'haste',level:1}] },
  { hex:'0C', id:'seer', name:'预言家', icon:'🔮', faction:'神', type:'unit',
    summonCost:3, actionCost:1, atk:2, def:2, maxCopies:2, rangeBonus:0,
    effect:{type:'onAction',label:'被动',desc:'此单位行动时（移动或攻击）抽一张牌'}, keywords:[] },
  { hex:'0D', id:'cupid', name:'丘比特', icon:'💘', faction:'无', type:'unit',
    summonCost:4, actionCost:2, atk:3, def:3, maxCopies:3, rangeBonus:0,
    effect:{label:'召唤',desc:'选择一个单位（不含总部），使其获得 +2 防御力'}, keywords:[] },
  { hex:'10', id:'werewolf', name:'狼人', icon:'🐺', faction:'狼', type:'unit',
    summonCost:2, actionCost:0, atk:4, def:2, maxCopies:3, rangeBonus:0,
    moveLimit:3, attackLimit:1, specialMaxActions:4,
    effect:{label:'血祭',desc:'召唤时必须选中一个友方民/神单位作为祭品（红色高亮），被选中的单位被献祭'},
    keywords:[{id:'swift'},{id:'bloodrite',level:1}] },
  { hex:'11', id:'witch', name:'女巫', icon:'🧹', faction:'神', type:'unit',
    summonCost:4, actionCost:1, atk:1, def:2, maxCopies:2, rangeBonus:0,
    effect:{ type:'deathrattle', label:'亡语', desc:'选择：①💔 对敌方总部造成 2 点伤害；②💖 使友方总部获得 +2 防御力', trigger:'witchDeathrattle' },
    keywords:[] },
  { hex:'12', id:'witchhunter', name:'猎魔人', icon:'🪬', faction:'神', type:'unit',
    summonCost:3, actionCost:2, atk:3, def:5, maxCopies:2, rangeBonus:1, noRecoil:true,
    effect:{label:'被动',desc:'无法触发反伤（既不受反伤，也不造成反伤，即使被守护）'},
    keywords:[{id:'swift'},{id:'haste',level:1}] },
  { hex:'14', id:'guard', name:'护卫', icon:'💂', faction:'神', type:'unit',
    summonCost:4, actionCost:1, atk:4, def:6, maxCopies:2, rangeBonus:0,
    effect:{ type:'onAction', label:'被动', desc:'此单位每次行动后 -1 攻击力' },
    keywords:[{id:'guardian'},{id:'swift'}] },
  /* ★ 法师 */
  { hex:'1D', id:'mage', name:'法师', icon:'🎩', faction:'无', type:'unit',
    summonCost:3, actionCost:1, atk:2, def:2, maxCopies:4, rangeBonus:0,
    effect:{ type:'onScheme', label:'被动', desc:'友方策触发时，对一个随机敌方目标造成 2 点伤害' },
    keywords:[] },

  /* ========== 计 ========== */
  { hex:'0E', id:'forcedMarch', name:'急行军', icon:'📯', faction:'无', type:'tactic',
    summonCost:1, maxCopies:2,
    effect:{label:'策略',desc:'本回合内，场上所有己方单位解除禁言、获得迅捷；若已有迅捷，改为 +1 疾行', trigger:'tacticForcedMarch'}, keywords:[] },
  { hex:'0F', id:'lastStand', name:'绝地反击', icon:'🚩', faction:'无', type:'tactic',
    summonCost:8, maxCopies:1,
    effect:{label:'策略',desc:'对场上所有目标（含总部）造成 3 点伤害；被消灭的单位洗入使用者的牌库，然后抽三张牌', trigger:'tacticLastStand'}, keywords:[] },
  { hex:'13', id:'expandAdvantage', name:'扩大优势', icon:'📈', faction:'无', type:'tactic',
    summonCost:1, maxCopies:3,
    effect:{label:'策略',desc:'若友方单位多于敌方单位，则抽两张牌；否则无法使用', trigger:'tacticExpandAdvantage'}, keywords:[] },
  { hex:'16', id:'harvest', name:'丰收', icon:'🌾', faction:'无', type:'tactic',
    summonCost:3, maxCopies:2,
    effect:{label:'策略',desc:'手牌较多的一方再抽两张牌', trigger:'tacticHarvest'}, keywords:[] },
  { hex:'19', id:'merchant', name:'流浪商队', icon:'🐫', faction:'无', type:'tactic',
    summonCost:4, maxCopies:1,
    effect:{label:'策略',desc:'抽 3 张牌，随后将「费用+1、抽牌数+1」的版本加入敌方手牌', trigger:'tacticMerchant'}, keywords:[] },
  { hex:'1A', id:'standoff', name:'对峙', icon:'🆚', faction:'无', type:'tactic',
    summonCost:1, maxCopies:2,
    effect:{label:'策略',desc:'双方各抽一张牌，费用更高者保留此牌，费用低者弃掉；相同则都弃掉（重复3次）。若一方牌库已空，则由有牌方抽牌，无牌方触发空牌库疲劳伤害（2 点）', trigger:'tacticStandoff'}, keywords:[] },
  /* ★ 新增：妥协 */
  { hex:'1E', id:'compromise', name:'妥协', icon:'🤝', faction:'无', type:'tactic',
    summonCost:4, maxCopies:3,
    effect:{label:'策略',desc:'选择：① 抽一张牌；② 己方总部 +1 血量；③ 双方各抽两张牌', trigger:'tacticCompromise'}, keywords:[] },

  /* ========== 策 ========== */
  { hex:'15', id:'raid', name:'劫营', icon:'🚷', faction:'无', type:'scheme',
    summonCost:1, maxCopies:4,
    effect:{ label:'策', desc:'敌方额外抽牌时，对一个随机敌方目标造成 3 点伤害', trigger:'schemeRaid' }, keywords:[] },
  { hex:'17', id:'cheapScheme', name:'轻谋浅虑', icon:'🤪', faction:'无', type:'scheme',
    summonCost:2, maxCopies:3,
    effect:{ label:'策', desc:'敌方使用计时，对其总部造成等同于此计花费的伤害', trigger:'schemeCheap' }, keywords:[] },
  { hex:'18', id:'revenge', name:'复仇', icon:'💢', faction:'无', type:'scheme',
    summonCost:2, maxCopies:4,
    effect:{ label:'策', desc:'友方总部受到伤害时，对敌方两个随机目标造成同等伤害', trigger:'schemeRevenge' }, keywords:[] },
  /* ★ 新增：圈套 */
  { hex:'1B', id:'snare', name:'圈套', icon:'🪤', faction:'无', type:'scheme',
    summonCost:4, maxCopies:2,
    effect:{ label:'策', desc:'敌方单位攻击时，取消本次攻击，对其造成 3 点伤害', trigger:'schemeSnare' }, keywords:[] },
  /* ★ 新增：陷阱 */
  { hex:'1C', id:'pitfall', name:'陷阱', icon:'🕳️', faction:'无', type:'scheme',
    summonCost:3, maxCopies:1,
    effect:{ label:'策', desc:'敌方单位移动时，将其消灭', trigger:'schemePitfall' }, keywords:[] },
  /* ★ 新增：埋伏 */
  { hex:'1F', id:'ambush', name:'埋伏', icon:'🫥', faction:'无', type:'scheme',
    summonCost:1, maxCopies:4,
    effect:{ label:'策', desc:'敌方部署单位时，对其造成 3 点伤害，并使其获得「禁言」', trigger:'schemeAmbush' }, keywords:[] },
	/* ★ 新增：转圜 */
  { hex:'20', id:'turnaround', name:'转圜', icon:'⤴️', faction:'无', type:'tactic',
    summonCost:3, maxCopies:3,
    effect:{label:'策略',desc:'选择一个敌方目标，对其造成 2 点伤害，随后将敌方已激活的策全部弃掉（仍然会触发轻谋浅虑）', trigger:'tacticTurnaround'}, keywords:[] },
  /* ★ 新增：圣歌 */
  { hex:'21', id:'hymn', name:'圣歌', icon:'🎼', faction:'无', type:'tactic',
    summonCost:5, maxCopies:2,
    effect:{label:'策略',desc:'使友方场上所有神单位获得 -1 行动花费（至少为 0），手牌中所有神单位获得 +1 攻击力和 +2 防御，牌库中所有神单位获得 -1 召唤花费', trigger:'tacticHymn'}, keywords:[] },
  /* ★ 新增：休养生息 */
  { hex:'22', id:'rest', name:'休养生息', icon:'❤️‍🩹', faction:'无', type:'tactic',
    summonCost:4, maxCopies:2,
    effect:{label:'策略',desc:'场上每有一个友方民或无，随机获得 +2 法力值（可超出上限）或使其获得 +2 防御力', trigger:'tacticRest'}, keywords:[] },
	/* ★ 新增：蛀虫 */
  { hex:'23', id:'borer', name:'蛀虫', icon:'🐛', faction:'民', type:'unit',
    summonCost:3, actionCost:1, atk:2, def:4, maxCopies:2, rangeBonus:0,
    effect:{label:'被动',desc:'此单位每次攻击后，弃掉对手牌库顶 2 张牌'}, keywords:[] },
  /* ★ 新增：村庄（舍） */
  { hex:'24', id:'village', name:'村庄', icon:'assets/Texture/hut/village.png', faction:'民', type:'hut',
    summonCost:4, activateCost:2, atk:0, def:4, maxCopies:2,
    effect:{label:'舍',desc:'只能部署在友方单位周围 3×3 范围内，无法移动或攻击。部署后点击可消耗 2 法力：从牌库抽取一张单位加入手牌；若牌库无单位，则随机生成 2 个民单位，二选一加入手牌，另一个弃掉'},
    keywords:[] },
    /* ★ 新增：贿赂 */
  { hex:'25', id:'bribe', name:'贿赂', icon:'💰', faction:'无', type:'tactic',
    summonCost:0, maxCopies:3,
    effect:{label:'策略',desc:'敌方抽两张牌，友方获得两点法力值', trigger:'tacticBribe'}, keywords:[] },
      /* ★ 新增：仓廪空虚 */
  { hex:'26', id:'granary', name:'仓廪空虚', icon:'🏚️', faction:'无', type:'tactic',
    summonCost:5, maxCopies:1,
    effect:{label:'策略',desc:'选择一个敌方目标，对其造成 (9 − 敌方手牌数) 点伤害（至少 0）', trigger:'tacticGranary'}, keywords:[] },
      /* ★ 新增：贪得无厌 */
  { hex:'27', id:'greed', name:'贪得无厌', icon:'🤑', faction:'无', type:'scheme',
    summonCost:1, maxCopies:2,
    effect:{label:'策',desc:'敌方额外抽牌时，再额外多抽 2 张', trigger:'schemeGreed'}, keywords:[] },
      /* ★ 新增：战地医院 */
  { hex:'28', id:'fieldHospital', name:'战地医院', icon:'assets/Texture/hut/field_hospital.png',
    faction:'民', type:'hut',
    summonCost:5, activateCost:3, atk:0, def:3, maxCopies:1,
    effect:{label:'舍',desc:'只能部署在友方单位周围 3×3 范围内，无法移动。点击可消耗 3 法力：治疗所有友方单位 3 点防御'},
    keywords:[] },
      /* ★ 新增：清廉 */
  { hex:'29', id:'integrity', name:'清廉', icon:'💧', faction:'无', type:'scheme',
    summonCost:3, maxCopies:2,
    effect:{label:'策',desc:'敌方回合时，己方额外抽牌触发；触发后直至下个己方回合开始前，己方无法额外抽牌', trigger:'schemeIntegrity'}, keywords:[] },
      /* ★ 新增：刺客 */
  { hex:'2A', id:'assassin', name:'刺客', icon:'🥷', faction:'无', type:'unit',
    summonCost:1, actionCost:0, atk:2, def:1, maxCopies:2, rangeBonus:0,
    moveLimit:3, specialMaxActions:3,
    effect:{ type:'deathrattle', label:'亡语', desc:'攻击总部后获得 +1 攻击；每回合可移动 3 次；消灭最后对此单位造成伤害的单位，若无，则改为对一个随机敌方单位造成 2 点伤害', trigger:'assassinDeathrattle' },
    keywords:[{id:'swift'}] },
    /* ★ 新增：影刺 */
  { hex:'2B', id:'shade', name:'影刺', icon:'🥷‍♂️', faction:'无', type:'unit',
    summonCost:2, actionCost:0, atk:3, def:1, maxCopies:2, rangeBonus:0,
    ignoresGuardian:true, noRecoil:true,
    effect:{label:'被动',desc:'攻击时无视守护；攻击时无反伤'},
    keywords:[{id:'swift'},{id:'haste',level:1}] },

  /* ★ 新增：机械狼 */
  { hex:'2C', id:'mechwolf', name:'机械狼', icon:'🐺', faction:'无', type:'tactic',
    summonCost:2, maxCopies:3,
    effect:{label:'策略',desc:'选择一个单位（无论敌友），触发其亡语或部署效果', trigger:'tacticMechwolf'}, keywords:[] },

  /* ★ 新增：圣骑士 */
  { hex:'2D', id:'paladin', name:'圣骑士', icon:'⚔️', faction:'神', type:'unit',
    summonCost:4, actionCost:1, atk:5, def:5, maxCopies:2, rangeBonus:0,
    untargetable:true,
    effect:{label:'被动',desc:'无法被敌方的「计」或单位选中'},
    keywords:[{id:'haste',level:1}] },

  /* ★ 新增：暴怒 */
  { hex:'2E', id:'fury', name:'暴怒', icon:'🩸', faction:'无', type:'tactic',
    summonCost:3, maxCopies:2,
    effect:{label:'策略',desc:'己方所有单位本回合 +2 攻击力；下回合开始时失去 1 防御', trigger:'tacticFury'}, keywords:[] }
];

const CARD_MAP = Object.fromEntries(CARDS.map(c => [c.id, c]));
const CARD_BY_HEX = Object.fromEntries(CARDS.map(c => [c.hex.toUpperCase(), c]));

function isTactic(card) { return card && card.type === 'tactic'; }
function isScheme(card) { return card && card.type === 'scheme'; }
function isUnit(card)   { return card && card.type !== 'tactic' && card.type !== 'scheme'; }

function exportDeckString(deck) {
  const icon = (deck.icon || '🃏').trim() || '🃏';
  const name = (deck.name || '未命名卡组').trim() || '未命名卡组';
  const safeName = name.replace(/\|/g, '·');
  const hexes = deck.cards.map(id => { const c = CARD_MAP[id]; return c ? c.hex : ''; }).join('');
  return `${icon}|${safeName}|${hexes}`;
}
function importDeckString(str) {
  if (typeof str !== 'string') return null;
  str = str.trim(); if (!str) return null;
  let icon = '🃏', name = '', hexStr = '';
  if (str.includes('|')) {
    const parts = str.split('|');
    if (parts.length >= 3) { icon = (parts[0]||'').trim()||'🃏'; name = (parts[1]||'').trim(); hexStr = parts.slice(2).join(''); }
    else if (parts.length === 2) { icon = (parts[0]||'').trim()||'🃏'; hexStr = parts[1]||''; }
  } else if (str.includes(':')) {
    const i = str.indexOf(':');
    const ip = str.slice(0,i).trim(); if (ip) icon = ip;
    hexStr = str.slice(i+1);
  } else hexStr = str;
  hexStr = hexStr.replace(/[\s,，;；|]+/g,'').toUpperCase();
  if (hexStr.length < 2) return null;
  const cards = [];
  for (let i = 0; i + 2 <= hexStr.length; i += 2) {
    const card = CARD_BY_HEX[hexStr.slice(i,i+2)];
    if (card) cards.push(card.id);
  }
  if (!cards.length) return null;
  return { icon, name, cards };
}
function validateDeck(cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length !== DECK_SIZE) {
    return { valid:false, reason:`卡组必须正好 ${DECK_SIZE} 张（当前 ${cardIds?cardIds.length:0} 张）` };
  }
  const counts = {};
  for (const id of cardIds) {
    const card = CARD_MAP[id];
    if (!card) return { valid:false, reason:`未知卡牌：${id}` };
    const max = card.maxCopies || DECK_SIZE;
    counts[id] = (counts[id]||0) + 1;
    if (counts[id] > max) return { valid:false, reason:`「${card.name}」最多携带 ${max} 张` };
  }
  return { valid:true };
}
function normalizeDeck(cardIds) {
  const counts = {}, result = [];
  const list = Array.isArray(cardIds) ? cardIds : [];
  for (const id of list) {
    const card = CARD_MAP[id]; if (!card) continue;
    const max = card.maxCopies || DECK_SIZE;
    counts[id] = (counts[id]||0) + 1;
    if (counts[id] <= max) result.push(id);
  }
  while (result.length < DECK_SIZE) {
    let best=null, bc=Infinity;
    for (const card of CARDS) {
      const c = result.filter(x=>x===card.id).length;
      const max = card.maxCopies || DECK_SIZE;
      if (c < max && c < bc) { bc=c; best=card.id; }
    }
    if (!best) break;
    result.push(best);
  }
  return result.slice(0, DECK_SIZE);
}

const DEFAULT_DECK = [
  'knight','knight','rogue','rogue','rogue','rogue',
  'magician','magician','bomber','bomber','guardian','guardian','guardian',
  'hunter','hunter','graverobber','elder','seer','seer','cupid','cupid',
  'werewolf','werewolf','werewolf'
];

const PRESET_DECKS = [
  { id:'preset_beginner', name:'新手卡组', icon:'🃏', desc:'攻守均衡，标准 24 张',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','guardian','hunter','hunter','graverobber','elder','seer','seer','cupid','cupid','werewolf','werewolf','werewolf'] },
  { id:'preset_hunter', name:'猎魔连队', icon:'🪬', desc:'猎魔人 + 猎人远程压制',
    cards:['witchhunter','witchhunter','hunter','hunter','knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','graverobber','elder','witch','witch','seer','seer','raid','raid','raid'] },
  { id:'preset_wolfpack', name:'狼群突袭', icon:'🐺', desc:'三狼人冲锋，血祭爆发',
    cards:['werewolf','werewolf','werewolf','knight','knight','rogue','rogue','rogue','magician','magician','bomber','guardian','guardian','hunter','graverobber','elder','seer','cupid','forcedMarch','forcedMarch','raid','raid','raid','raid'] },
  { id:'preset_guard', name:'近卫军团', icon:'💂', desc:'护卫守家，稳扎稳打',
    cards:['guard','guard','guardian','guardian','guardian','knight','knight','rogue','rogue','rogue','magician','magician','bomber','hunter','graverobber','elder','seer','seer','cupid','cupid','revenge','revenge','revenge','revenge'] },
  { id:'preset_merchant', name:'商队奇谋', icon:'🐫', desc:'流浪商队 + 对峙，控制节奏',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','cupid','merchant','standoff','standoff','raid','cheapScheme','revenge'] },
  /* ★ 暗影诡术 */
  { id:'preset_shadow', name:'暗影诡术', icon:'🪤', desc:'陷阱 + 圈套 + 埋伏 + 法师，埋伏反击',
    cards:['mage','mage','knight','knight','rogue','rogue','rogue','magician','magician','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','ambush','snare','snare','pitfall','raid','cheapScheme','revenge'] },
  /* ★ 新增：妥协之道 */
  { id:'preset_compromise', name:'妥协之道', icon:'🤝', desc:'妥协 + 埋伏，以退为进',
    cards:['knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','cupid','compromise','compromise','compromise','ambush','ambush','raid','revenge'] }
];

const AI_DECKS = [
  { id:'ai_balance', name:'均衡之阵',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','cupid','werewolf','werewolf','werewolf','raid','raid'] },
  { id:'ai_fortress', name:'守护壁垒',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','bomber','guardian','guardian','guardian','hunter','hunter','graverobber','elder','gatekeeper','gatekeeper','gatekeeper','gatekeeper','cupid','werewolf','werewolf','seer','revenge'] },
  { id:'ai_blitz', name:'闪电突袭',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','bomber','guardian','guardian','hunter','graverobber','elder','cupid','seer','werewolf','werewolf','werewolf','forcedMarch','forcedMarch','raid'] },
  { id:'ai_undeath', name:'亡语奇兵',
    cards:['knight','knight','rogue','rogue','rogue','magician','magician','magician','bomber','bomber','bomber','guardian','guardian','hunter','graverobber','elder','seer','cupid','witch','witch','werewolf','werewolf','revenge','revenge'] },
  { id:'ai_hunter', name:'猎手连队',
    cards:['witchhunter','witchhunter','hunter','hunter','knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','graverobber','elder','witch','seer','cupid','raid','raid','raid','raid'] },
  { id:'ai_lastStand', name:'背水一战',
    cards:['knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','bomber','guardian','guardian','guardian','hunter','hunter','graverobber','elder','werewolf','lastStand','forcedMarch','forcedMarch','revenge','harvest','raid'] },
  { id:'ai_wolfRush', name:'狼群突袭',
    cards:['werewolf','werewolf','werewolf','gatekeeper','gatekeeper','gatekeeper','gatekeeper','rogue','rogue','rogue','rogue','magician','bomber','bomber','guardian','hunter','graverobber','seer','cupid','forcedMarch','expandAdvantage','expandAdvantage','expandAdvantage','raid'] },
  { id:'ai_witch', name:'巫女奇谋',
    cards:['witch','witch','witchhunter','witchhunter','knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','graverobber','elder','raid','raid','raid','revenge','revenge','cheapScheme'] },
  { id:'ai_scheme', name:'暗算筹谋',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','graverobber','elder','raid','raid','raid','raid','cheapScheme','cheapScheme','cheapScheme','revenge','revenge'] },
  { id:'ai_merchant', name:'商队远行',
    cards:['knight','knight','rogue','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','cupid','merchant','standoff','standoff','expandAdvantage','harvest','raid'] },
  /* ★ 暗影诡术 */
  { id:'ai_shadow', name:'暗影诡术',
    cards:['mage','mage','knight','knight','rogue','rogue','rogue','magician','magician','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','ambush','snare','snare','pitfall','raid','cheapScheme','revenge'] },
  /* ★ 新增：妥协之道 */
  { id:'ai_compromise', name:'妥协之道',
    cards:['knight','knight','rogue','rogue','rogue','magician','magician','bomber','bomber','guardian','guardian','hunter','hunter','graverobber','elder','seer','cupid','compromise','compromise','compromise','ambush','ambush','raid','revenge'] }
];

const AI_DECK = AI_DECKS[0].cards;