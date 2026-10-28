// Shadowflame: The Sea Beast — playable slice (vanilla JS + Canvas)
'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 960, H = 540;

// ---------- utils ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

// ---------- input ----------
const keys = {}, pressed = {};
const mouse = { x: W / 2, y: H / 2, l: false, r: false, lp: false, rp: false };
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
function toCanvas(e) { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * W / r.width; mouse.y = (e.clientY - r.top) * H / r.height; }
cv.addEventListener('mousemove', toCanvas);
cv.addEventListener('mousedown', e => { toCanvas(e); if (e.button === 0) { mouse.l = true; mouse.lp = true; } if (e.button === 2) { mouse.r = true; mouse.rp = true; } });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
const confirmPressed = () => pressed.Enter || pressed.Space || mouse.lp;

// ---------- world state ----------
let scene = 'title';
let sceneT = 0;
let P, inky, enemies, projs, parts, hazards, texts, obstacles, circles, bounds, door, boss;
let shake = 0, dialog = null, banner = null, stats = { start: 0, taken: 0 };
let story = null;
let seaWon = false, tavernOpen = false;

function makePlayer(x, y) {
  return { x, y, r: 14, hp: 100, max: 100, face: 0, atkCd: 0, slashT: 0, flameCd: 0, dashCd: 0, dashT: 0, dashDir: { x: 0, y: 0 }, inv: 0, walk: 0 };
}
function makeInky(x, y) { return { x, y, r: 10, cd: 1, healCd: 4, bob: 0 }; }

function say(name, text, dur = 3) { dialog = { name, text, t: dur }; }
function showBanner(text, sub = '', dur = 2.5) { banner = { text, sub, t: dur, max: dur }; }
function floatText(x, y, s, col) { texts.push({ x, y, s, col, t: 0.8 }); }
function burst(x, y, n, cols, spd = 160, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(spd * 0.3, spd);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(life * 0.5, life), max: life, col: cols[(Math.random() * cols.length) | 0], size: rand(size * 0.6, size * 1.4) });
  }
}

function resetCommon() {
  enemies = []; projs = []; parts = []; hazards = []; texts = []; obstacles = []; circles = [];
  dialog = null; banner = null; door = null; boss = null; shake = 0;
}

// ---------- scenes ----------
function startStory(pages, next) { scene = 'story'; story = { pages, i: 0, next, t: 0 }; }

function startSea() {
  resetCommon();
  scene = 'sea'; sceneT = 0; seaWon = false;
  bounds = { x: 150, y: 175, w: 660, h: 320 };
  circles = [{ x: 480, y: 380, r: 20 }]; // mast
  obstacles = [{ x: 220, y: 420, w: 50, h: 40 }, { x: 690, y: 250, w: 50, h: 40 }]; // crates
  P = makePlayer(480, 450);
  inky = makeInky(440, 470);
  boss = {
    type: 'boss', x: 480, y: -40, ty: 95, r: 72, hp: 600, max: 600, flash: 0,
    atkT: 3, pattern: 0, phase: 1, emerge: 0, eyeGlow: 0, dead: false, deathT: 0, contactCd: 0
  };
  enemies.push(boss);
  showBanner('THE CROSSING', 'Slay the Flame-Eater spawn', 3);
  setTimeout(() => { if (scene === 'sea') say('Inky', "Casimir! It's coming up under the ship!", 3); }, 600);
}

function startTavern() {
  resetCommon();
  scene = 'tavern'; sceneT = 0; tavernOpen = false;
  bounds = { x: 80, y: 120, w: 800, h: 380 };
  obstacles = [
    { x: 80, y: 120, w: 420, h: 46 },           // bar counter
    { x: 250, y: 260, w: 80, h: 50 }, { x: 560, y: 220, w: 80, h: 50 },
    { x: 420, y: 390, w: 90, h: 50 }, { x: 700, y: 380, w: 70, h: 50 }
  ];
  circles = [];
  door = { x: 868, y: 270, w: 14, h: 80 };
  P = makePlayer(140, 420);
  P.hp = Math.max(P.hp, 100);
  inky = makeInky(120, 450);
  enemies.push(makeBandit(650, 160, 'brawler'), makeBandit(760, 300, 'brawler'), makeBandit(800, 460, 'thrower'));
  showBanner('GREYHARBOR', 'The Drowned Lantern tavern', 2.5);
  setTimeout(() => { if (scene === 'tavern') say('Bandit', 'Nice sword, stranger. Hand it over — and the girl.', 3); }, 500);
  setTimeout(() => { if (scene === 'tavern') say('Casimir', 'Come and take it.', 2.2); }, 3600);
}

function makeBandit(x, y, kind) {
  return { type: 'bandit', kind, x, y, r: 14, hp: kind === 'thrower' ? 35 : 50, max: kind === 'thrower' ? 35 : 50, flash: 0,
    state: 'idle', st: rand(0.8, 1.6), cd: 0, face: Math.PI, kx: 0, ky: 0, wake: 1.2 + rand(0, 0.6) };
}
function makeCrawler(x, y) {
  return { type: 'crawler', x, y, r: 11, hp: 24, max: 24, flash: 0, cd: 0, kx: 0, ky: 0, leg: rand(0, 6) };
}

// ---------- combat ----------
function hurtPlayer(d, sx, sy) {
  if (P.inv > 0 || P.hp <= 0) return;
  P.hp -= d; stats.taken += d; P.inv = 0.6; shake = Math.max(shake, 8);
  floatText(P.x, P.y - 20, '-' + d, '#ff6b6b');
  burst(P.x, P.y, 10, ['#ff5050', '#802020'], 140, 0.4);
  if (sx !== undefined) { const a = Math.atan2(P.y - sy, P.x - sx); P.x += Math.cos(a) * 14; P.y += Math.sin(a) * 14; }
  if (P.hp <= 0) { P.hp = 0; burst(P.x, P.y, 40, ['#f5c542', '#2a1640', '#000'], 220, 1); setTimeout(() => { scene = 'dead'; }, 900); }
}
function hurtEnemy(e, d, fromX, fromY, col = '#f5c542') {
  if (e.dead) return;
  e.hp -= d; e.flash = 0.12;
  floatText(e.x + rand(-10, 10), e.y - e.r - 6, String(d), col);
  if (e.type !== 'boss') { const a = Math.atan2(e.y - fromY, e.x - fromX); e.kx = Math.cos(a) * 220; e.ky = Math.sin(a) * 220; }
  if (e.hp <= 0) {
    e.hp = 0;
    if (e.type === 'boss') { e.dying = true; e.deathT = 0; shake = 20; say('Inky', 'It\u2019s going down!', 2.5); }
    else { e.dead = true; burst(e.x, e.y, 22, e.type === 'crawler' ? ['#3b2a4a', '#7a3', '#222'] : ['#a33', '#d9a066', '#333'], 200, 0.6); }
  }
}

function playerAttack() {
  P.atkCd = 0.34; P.slashT = 0.18;
  const reach = 64;
  burst(P.x + Math.cos(P.face) * 40, P.y + Math.sin(P.face) * 40, 8, ['#ffd84a', '#f5a623', '#1a0b2a'], 120, 0.35);
  for (const e of enemies) {
    if (e.dead || e.dying || (e.type === 'boss' && e.emerge < 1)) continue;
    const d = dist(P, e), a = Math.atan2(e.y - P.y, e.x - P.x);
    if (d < reach + e.r && (angDiff(a, P.face) < 1.15 || d < e.r + P.r + 6)) {
      hurtEnemy(e, 14 + ((Math.random() * 4) | 0), P.x, P.y);
      burst(e.x - Math.cos(a) * e.r * 0.6, e.y - Math.sin(a) * e.r * 0.6, 10, ['#ffe27a', '#f5a623', '#2a1640'], 220, 0.4);
      shake = Math.max(shake, 3);
    }
  }
}
function playerFlame() {
  P.flameCd = 1.1;
  const sp = 560;
  projs.push({ x: P.x + Math.cos(P.face) * 20, y: P.y + Math.sin(P.face) * 20, vx: Math.cos(P.face) * sp, vy: Math.sin(P.face) * sp, r: 9, dmg: 26, friendly: true, kind: 'flame', life: 1.2 });
  burst(P.x, P.y, 10, ['#ffd84a', '#1a0b2a', '#000'], 150, 0.4);
}

// ---------- collisions ----------
function pushOutRect(o, rc) {
  const cx = clamp(o.x, rc.x, rc.x + rc.w), cy = clamp(o.y, rc.y, rc.y + rc.h);
  const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
  if (d < o.r) {
    if (d === 0) { // center inside: push out the nearest side
      const l = o.x - rc.x, r = rc.x + rc.w - o.x, t = o.y - rc.y, b = rc.y + rc.h - o.y, m = Math.min(l, r, t, b);
      if (m === l) o.x = rc.x - o.r; else if (m === r) o.x = rc.x + rc.w + o.r; else if (m === t) o.y = rc.y - o.r; else o.y = rc.y + rc.h + o.r;
      return;
    }
    o.x = cx + dx / d * o.r; o.y = cy + dy / d * o.r;
  }
}
function pushOutCircle(o, c) {
  const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy) || 0.01, m = o.r + c.r;
  if (d < m) { o.x = c.x + dx / d * m; o.y = c.y + dy / d * m; }
}
function collideWorld(o) {
  for (const rc of obstacles) pushOutRect(o, rc);
  for (const c of circles) pushOutCircle(o, c);
  o.x = clamp(o.x, bounds.x + o.r, bounds.x + bounds.w - o.r);
  o.y = clamp(o.y, bounds.y + o.r, bounds.y + bounds.h - o.r);
}
function pointBlocked(x, y) {
  for (const rc of obstacles) if (x > rc.x && x < rc.x + rc.w && y > rc.y && y < rc.y + rc.h) return true;
  for (const c of circles) if (Math.hypot(x - c.x, y - c.y) < c.r) return true;
  return false;
}

// ---------- update ----------
function updatePlayer(dt) {
  if (P.hp <= 0) return;
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx--;
  if (keys.KeyD || keys.ArrowRight) mx++;
  if (keys.KeyW || keys.ArrowUp) my--;
  if (keys.KeyS || keys.ArrowDown) my++;
  const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
  P.face = Math.atan2(mouse.y - P.y, mouse.x - P.x);
  P.atkCd -= dt; P.flameCd -= dt; P.dashCd -= dt; P.slashT -= dt; P.inv -= dt;
  if ((pressed.ShiftLeft || pressed.ShiftRight) && P.dashCd <= 0) {
    P.dashT = 0.16; P.dashCd = 0.8; P.inv = Math.max(P.inv, 0.22);
    P.dashDir = ml ? { x: mx, y: my } : { x: Math.cos(P.face), y: Math.sin(P.face) };
  }
  let sp = 230;
  if (P.dashT > 0) {
    P.dashT -= dt; mx = P.dashDir.x; my = P.dashDir.y; sp = 720;
    parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, t: 0.25, max: 0.25, col: '#2a1640', size: 10 });
  }
  P.x += mx * sp * dt; P.y += my * sp * dt;
  if (mx || my) P.walk += dt * 10;
  collideWorld(P);
  if (boss && !boss.dead && boss.emerge >= 1) pushOutCircle(P, boss);
  if ((keys.Space || mouse.l) && P.atkCd <= 0) playerAttack();
  if ((mouse.rp || pressed.KeyE || pressed.KeyF) && P.flameCd <= 0) playerFlame();
}

function nearestEnemy(from, range) {
  let best = null, bd = range;
  for (const e of enemies) {
    if (e.dead || e.dying || (e.type === 'boss' && e.emerge < 1)) continue;
    const d = dist(from, e) - e.r; if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function updateInky(dt) {
  inky.bob += dt * 4;
  const back = P.face + Math.PI;
  const tx = P.x + Math.cos(back) * 46 + Math.cos(back + 1.6) * 20, ty = P.y + Math.sin(back) * 46 + Math.sin(back + 1.6) * 20;
  const dx = tx - inky.x, dy = ty - inky.y, d = Math.hypot(dx, dy);
  if (d > 4) { const s = Math.min(d * 4, 260); inky.x += dx / d * s * dt; inky.y += dy / d * s * dt; }
  collideWorld(inky);
  inky.cd -= dt; inky.healCd -= dt;
  if (P.hp <= 0) return;
  if (P.hp < 55 && inky.healCd <= 0) {
    const h = 22; P.hp = Math.min(P.max, P.hp + h); inky.healCd = 11;
    floatText(P.x, P.y - 28, '+' + h, '#6fd3ff');
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; parts.push({ x: P.x + Math.cos(a) * 30, y: P.y + Math.sin(a) * 30, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60 - 20, t: 0.6, max: 0.6, col: i % 2 ? '#6fd3ff' : '#d8f6ff', size: 3 }); }
    say('Inky', ['Hold still — tide-mend!', 'I\u2019ve got you!', 'Don\u2019t you dare fall!'][(Math.random() * 3) | 0], 2);
  }
  const t = nearestEnemy(inky, 420);
  if (t && inky.cd <= 0) {
    inky.cd = 1.25;
    const a = Math.atan2(t.y - inky.y, t.x - inky.x), sp = 420;
    projs.push({ x: inky.x, y: inky.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: 7, friendly: true, kind: 'water', life: 1.3 });
  }
}

function updateBoss(dt) {
  const b = boss;
  if (b.dead) return;
  b.flash -= dt; b.eyeGlow += dt;
  if (b.emerge < 1) { b.emerge = Math.min(1, b.emerge + dt / 2); b.y = -40 + (b.ty + 40) * (1 - Math.pow(1 - b.emerge, 3)); if (Math.random() < 0.5) burst(rand(330, 630), 165, 1, ['#bfe6ff', '#5a8fb8'], 120, 0.6); shake = Math.max(shake, 3); return; }
  b.y = b.ty + Math.sin(sceneT * 1.3) * 6;
  if (b.dying) {
    b.deathT += dt; shake = Math.max(shake, 6);
    if (Math.random() < 0.6) burst(b.x + rand(-60, 60), b.y + rand(-40, 40), 6, ['#ff7a1a', '#2a1640', '#000', '#ffd84a'], 200, 0.7, 4);
    b.y += b.deathT * 40 * dt * 4;
    if (b.deathT > 2.2) { b.dead = true; enemies = enemies.filter(e => e !== b); onSeaWin(); }
    return;
  }
  if (b.phase === 1 && b.hp < b.max * 0.5) { b.phase = 2; showBanner('IT ENRAGES', 'The Flame-Eater\u2019s hunger grows', 2); shake = 14; say('Inky', 'Its eyes — it\u2019s eating the fire! Keep moving!', 3); }
  b.contactCd -= dt;
  if (dist(P, b) < P.r + b.r + 4 && b.contactCd <= 0) { hurtPlayer(10, b.x, b.y); b.contactCd = 0.8; }
  b.atkT -= dt;
  if (b.atkT <= 0) {
    const f = b.phase === 2 ? 0.7 : 1;
    const pat = b.pattern++ % 4;
    if (pat === 0 || pat === 2) { // tentacle slams
      const n = b.phase === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const ox = i === 0 ? 0 : rand(-110, 110), oy = i === 0 ? 0 : rand(-80, 80);
        hazards.push({ x: clamp(P.x + ox, bounds.x + 20, bounds.x + bounds.w - 20), y: clamp(P.y + oy, bounds.y + 20, bounds.y + bounds.h - 20), r: 52, t: 0, delay: 1.0 + i * 0.25, dmg: 18, done: false, side: Math.random() < 0.5 ? -1 : 1 });
      }
      b.atkT = 2.0 * f;
    } else if (pat === 1) { // ink spit fan
      const n = b.phase === 2 ? 9 : 6, base = Math.atan2(P.y - b.y, P.x - b.x), spread = 1.0;
      for (let i = 0; i < n; i++) {
        const a = base - spread / 2 + spread * i / (n - 1);
        projs.push({ x: b.x + Math.cos(a) * 50, y: b.y + Math.sin(a) * 50, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 8, dmg: 10, friendly: false, kind: 'ink', life: 3 });
      }
      burst(b.x, b.y + 40, 14, ['#2a1640', '#000', '#5b2a7a'], 150, 0.5, 4);
      b.atkT = 1.8 * f;
    } else { // spawn crawlers
      const alive = enemies.filter(e => e.type === 'crawler' && !e.dead).length;
      if (alive < 4) {
        const n = b.phase === 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const left = Math.random() < 0.5, x = left ? bounds.x + 15 : bounds.x + bounds.w - 15, y = rand(bounds.y + 60, bounds.y + bounds.h - 30);
          enemies.push(makeCrawler(x, y)); burst(x, y, 14, ['#bfe6ff', '#5a8fb8'], 140, 0.5);
        }
        if (Math.random() < 0.5) say('Inky', 'Spawnlings climbing the rails!', 2);
      }
      b.atkT = 2.2 * f;
    }
  }
}

function updateCrawler(e, dt) {
  e.flash -= dt; e.leg += dt * 14; e.cd -= dt;
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  e.x += (Math.cos(a) * 120 + e.kx) * dt; e.y += (Math.sin(a) * 120 + e.ky) * dt;
  e.kx *= 0.88; e.ky *= 0.88;
  collideWorld(e);
  if (dist(e, P) < e.r + P.r + 2 && e.cd <= 0) { hurtPlayer(8, e.x, e.y); e.cd = 0.9; }
}

function updateBandit(e, dt) {
  e.flash -= dt; e.cd -= dt; e.st -= dt;
  if (e.wake > 0) { e.wake -= dt; return; }
  const d = dist(e, P), a = Math.atan2(P.y - e.y, P.x - e.x);
  let mvx = 0, mvy = 0, sp = 0;
  if (e.kind === 'brawler') {
    if (e.state === 'windup') {
      if (e.st <= 0) {
        e.state = 'strike'; e.st = 0.15;
        if (d < 58 && angDiff(a, e.face) < 1.2) hurtPlayer(12, e.x, e.y);
      }
    } else if (e.state === 'strike') { if (e.st <= 0) { e.state = 'recover'; e.st = 0.55; } }
    else if (e.state === 'recover') { if (e.st <= 0) e.state = 'chase'; sp = 40; mvx = -Math.cos(a); mvy = -Math.sin(a); }
    else {
      e.state = 'chase'; e.face = a; sp = 120; mvx = Math.cos(a); mvy = Math.sin(a);
      if (d < 46 && e.cd <= 0) { e.state = 'windup'; e.st = 0.45; e.cd = 1.1; }
    }
  } else { // thrower: keep distance, throw knives
    e.face = a;
    if (d < 180) { mvx = -Math.cos(a); mvy = -Math.sin(a); sp = 100; }
    else if (d > 320) { mvx = Math.cos(a); mvy = Math.sin(a); sp = 100; }
    else { mvx = Math.cos(a + Math.PI / 2); mvy = Math.sin(a + Math.PI / 2); sp = 60; }
    if (e.cd <= 0 && d < 450) {
      e.state = 'windup'; e.st = 0.4; e.cd = 1.9;
    }
    if (e.state === 'windup' && e.st <= 0) {
      e.state = 'idle';
      projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, r: 5, dmg: 9, friendly: false, kind: 'knife', life: 2 });
    }
  }
  const ox = e.x, oy = e.y;
  e.x += (mvx * sp + e.kx) * dt; e.y += (mvy * sp + e.ky) * dt;
  e.kx *= 0.85; e.ky *= 0.85;
  collideWorld(e);
  // if stuck against an obstacle, sidestep
  if (sp > 0 && Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.3) { e.x += Math.cos(a + Math.PI / 2) * sp * dt; e.y += Math.sin(a + Math.PI / 2) * sp * dt; collideWorld(e); }
  // separate from other enemies
  for (const o of enemies) if (o !== e && !o.dead && o.type !== 'boss') { const dd = dist(o, e); if (dd < o.r + e.r && dd > 0) { e.x += (e.x - o.x) / dd * 1.5; e.y += (e.y - o.y) / dd * 1.5; } }
}

function updateProjs(dt) {
  for (const p of projs) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.kind === 'flame') { parts.push({ x: p.x, y: p.y, vx: rand(-30, 30), vy: rand(-30, 30), t: 0.35, max: 0.35, col: Math.random() < 0.5 ? '#ffd84a' : '#1a0b2a', size: rand(3, 7) }); }
    if (p.kind === 'water' && Math.random() < 0.7) parts.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), t: 0.3, max: 0.3, col: Math.random() < 0.5 ? '#6fd3ff' : '#d8f6ff', size: 2.5 });
    if (p.kind === 'ink' && Math.random() < 0.3) parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0.3, max: 0.3, col: '#2a1640', size: 4 });
    if (pointBlocked(p.x, p.y) || p.x < -50 || p.x > W + 50 || p.y < -80 || p.y > H + 50) { p.life = 0; burst(p.x, p.y, 5, ['#888', '#555'], 80, 0.3); continue; }
    if (p.friendly) {
      for (const e of enemies) {
        if (e.dead || e.dying || (e.type === 'boss' && e.emerge < 1)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
          hurtEnemy(e, p.dmg, p.x - p.vx, p.y - p.vy, p.kind === 'water' ? '#6fd3ff' : '#ffd84a');
          burst(p.x, p.y, p.kind === 'flame' ? 22 : 10, p.kind === 'flame' ? ['#ffd84a', '#f5a623', '#1a0b2a', '#000'] : ['#6fd3ff', '#d8f6ff', '#2a7fb8'], 200, 0.45, 3);
          if (p.kind === 'flame') shake = Math.max(shake, 5);
          p.life = 0; break;
        }
      }
    } else if (Math.hypot(p.x - P.x, p.y - P.y) < p.r + P.r) {
      hurtPlayer(p.dmg, p.x - p.vx, p.y - p.vy); p.life = 0;
    }
  }
  projs = projs.filter(p => p.life > 0);
}

function updateHazards(dt) {
  for (const h of hazards) {
    h.t += dt;
    if (!h.done && h.t >= h.delay) {
      h.done = true; shake = Math.max(shake, 10);
      burst(h.x, h.y, 26, ['#bfe6ff', '#3b2a4a', '#5a8fb8', '#111'], 240, 0.6, 4);
      if (Math.hypot(P.x - h.x, P.y - h.y) < h.r + P.r * 0.5) hurtPlayer(h.dmg, h.x, h.y);
    }
  }
  hazards = hazards.filter(h => h.t < h.delay + 0.45);
}

function updateCommon(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.t -= dt; }
  parts = parts.filter(p => p.t > 0);
  if (parts.length > 1500) parts.splice(0, parts.length - 1500);
  for (const t of texts) { t.y -= 30 * dt; t.t -= dt; }
  texts = texts.filter(t => t.t > 0);
  if (dialog) { dialog.t -= dt; if (dialog.t <= 0) dialog = null; }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  shake *= 0.88;
}

function onSeaWin() {
  if (seaWon) return; seaWon = true;
  enemies.forEach(e => { if (e.type === 'crawler') { e.dead = true; burst(e.x, e.y, 10, ['#3b2a4a', '#222'], 150, 0.5); } });
  projs = projs.filter(p => p.friendly);
  hazards = [];
  showBanner('VICTORY', 'The Flame-Eater spawn sinks beneath the waves', 3.5);
  say('Casimir', 'Back to the deep with you.', 3);
  setTimeout(() => {
    if (scene !== 'sea') return;
    startStory([
      ['But the beast had torn the hull open. By dawn the ship was gone.', 'Casimir and Inky washed ashore at Greyharbor \u2014 soaked, starving, and alive.'],
      ['They found the only open door in town: the Drowned Lantern.', 'It already had company. The wrong kind.']
    ], startTavern);
  }, 3800);
}

function update(dt) {
  sceneT += dt;
  if (scene === 'title') {
    if (confirmPressed()) {
      stats = { start: performance.now(), taken: 0 };
      startStory([
        ['Three days out from the mainland, the storm finally broke.', 'Then the sea itself rose up.'],
        ['Chitin and tentacle. Eyes burning like swallowed embers.', 'A spawn of the Flame-Eater \u2014 drawn to the fire in Casimir\u2019s blood.'],
        ['Casimir drew his blade. Gold fire and shadow answered.', '"Inky \u2014 stay behind me."']
      ], startSea);
    }
    return;
  }
  if (scene === 'story') {
    story.t += dt;
    if (confirmPressed() && story.t > 0.25) { story.i++; story.t = 0; if (story.i >= story.pages.length) story.next(); }
    return;
  }
  if (scene === 'dead') {
    if (pressed.KeyR || confirmPressed()) { if (seaWon) startTavern(); else startSea(); }
    return;
  }
  if (scene === 'win') {
    if (pressed.KeyR || (confirmPressed() && sceneT > 1)) { scene = 'title'; sceneT = 0; }
    return;
  }
  // gameplay scenes
  updatePlayer(dt);
  updateInky(dt);
  if (scene === 'sea') updateBoss(dt);
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === 'crawler') updateCrawler(e, dt);
    else if (e.type === 'bandit') updateBandit(e, dt);
  }
  enemies = enemies.filter(e => !e.dead || e.type === 'boss');
  updateProjs(dt);
  updateHazards(dt);
  updateCommon(dt);
  if (scene === 'tavern') {
    if (!tavernOpen && enemies.filter(e => !e.dead).length === 0 && sceneT > 1) {
      tavernOpen = true; showBanner('TAVERN CLEARED', 'Head for the door \u2192', 3);
      say('Inky', 'That\u2019s all of them. Let\u2019s get out of here before the watch shows up.', 3.5);
    }
    if (tavernOpen && P.x > door.x - P.r - 6 && P.y > door.y && P.y < door.y + door.h) { scene = 'win'; sceneT = 0; stats.time = (performance.now() - stats.start) / 1000; }
    if (tavernOpen) bounds.w = 830; // let the player step into the doorway
  }
}

// ---------- drawing ----------
function drawSeaBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1b2e'); g.addColorStop(1, '#06101c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,180,230,0.18)'; ctx.lineWidth = 2;
  for (let row = 0; row < 18; row++) {
    const y = row * 32 + 10; ctx.beginPath();
    for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.03 + sceneT * 2 + row) * 4; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }
  // ship hull + deck
  const sway = Math.sin(sceneT * 0.8) * 2;
  ctx.save(); ctx.translate(0, sway);
  ctx.fillStyle = '#3a2414';
  ctx.beginPath(); ctx.moveTo(120, 160); ctx.lineTo(840, 160); ctx.lineTo(900, 330); ctx.lineTo(840, 525); ctx.lineTo(120, 525); ctx.lineTo(60, 330); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(bounds.x - 10, bounds.y - 10, bounds.w + 20, bounds.h + 20);
  ctx.strokeStyle = '#4e331c'; ctx.lineWidth = 2;
  for (let y = bounds.y; y < bounds.y + bounds.h; y += 22) { ctx.beginPath(); ctx.moveTo(bounds.x - 10, y); ctx.lineTo(bounds.x + bounds.w + 10, y); ctx.stroke(); }
  for (let y = bounds.y, k = 0; y < bounds.y + bounds.h; y += 22, k++) for (let x = bounds.x + (k % 2) * 60; x < bounds.x + bounds.w; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); }
  ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 6; ctx.strokeRect(bounds.x - 10, bounds.y - 10, bounds.w + 20, bounds.h + 20);
  // crates
  for (const o of obstacles) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = '#4a2e14'; ctx.lineWidth = 3; ctx.strokeRect(o.x, o.y, o.w, o.h); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke(); }
  ctx.restore();
}
function drawMast() {
  for (const c of circles) {
    ctx.fillStyle = '#2a1a0c'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3a1c'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(220,210,180,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - 120, c.y - 4); ctx.lineTo(c.x + 120, c.y - 4); ctx.stroke(); // yard shadow
  }
}

function drawTentacle(x0, y0, x1, y1, t, w, col) {
  const segs = 14; ctx.strokeStyle = col; ctx.lineCap = 'round';
  let px = x0, py = y0;
  for (let i = 1; i <= segs; i++) {
    const k = i / segs, nx = x0 + (x1 - x0) * k + Math.sin(t + k * 5) * 18 * k, ny = y0 + (y1 - y0) * k + Math.cos(t * 1.3 + k * 4) * 12 * k;
    ctx.lineWidth = w * (1 - k * 0.8); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny;
  }
}

function drawBoss() {
  const b = boss; if (!b || b.dead) return;
  const t = sceneT;
  ctx.save();
  if (b.dying) ctx.globalAlpha = Math.max(0, 1 - b.deathT / 2.2);
  // tentacles behind (rising from water around ship)
  const tc = '#2b1d3a';
  drawTentacle(b.x - 50, b.y + 10, 70, 220 + Math.sin(t) * 30, t, 22, tc);
  drawTentacle(b.x + 50, b.y + 10, 890, 230 + Math.cos(t) * 30, t + 2, 22, tc);
  drawTentacle(b.x - 30, b.y + 20, 40, 420 + Math.sin(t * 0.7) * 40, t + 4, 18, tc);
  drawTentacle(b.x + 30, b.y + 20, 920, 430 + Math.cos(t * 0.7) * 40, t + 1, 18, tc);
  // body
  ctx.fillStyle = b.flash > 0 ? '#6a4a86' : '#1c1226';
  ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 1.25, b.r, 0, 0, 7); ctx.fill();
  // chitin plates
  ctx.strokeStyle = '#4a3560'; ctx.lineWidth = 4;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(b.x + i * 26, b.y - 20, 30, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  ctx.fillStyle = '#2e1f3e';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(b.x + i * 22 - 8, b.y - b.r + 10 + Math.abs(i) * 6); ctx.lineTo(b.x + i * 22, b.y - b.r - 18 + Math.abs(i) * 8); ctx.lineTo(b.x + i * 22 + 8, b.y - b.r + 10 + Math.abs(i) * 6); ctx.fill(); }
  // eyes (ember-glow)
  const glow = 0.6 + Math.sin(b.eyeGlow * (b.phase === 2 ? 8 : 3)) * 0.4;
  for (const s of [-1, 1]) for (const k of [0, 1]) {
    const ex = b.x + s * (22 + k * 22), ey = b.y - 6 + k * 10;
    ctx.fillStyle = `rgba(255,${b.phase === 2 ? 60 : 120},20,${0.3 * glow})`; ctx.beginPath(); ctx.arc(ex, ey, 14 - k * 3, 0, 7); ctx.fill();
    ctx.fillStyle = b.phase === 2 ? '#ff3b1a' : '#ff9a2a'; ctx.beginPath(); ctx.arc(ex, ey, 6 - k * 2, 0, 7); ctx.fill();
  }
  // maw
  ctx.fillStyle = '#0a0410'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 32, 30, 14 + Math.sin(t * 4) * 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8cfa8';
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(b.x + i * 8 - 3, b.y + 22); ctx.lineTo(b.x + i * 8, b.y + 32); ctx.lineTo(b.x + i * 8 + 3, b.y + 22); ctx.fill(); }
  ctx.restore();
}

function drawHazards() {
  for (const h of hazards) {
    if (!h.done) {
      const k = h.t / h.delay;
      ctx.fillStyle = `rgba(200,30,30,${0.12 + k * 0.25})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,80,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,80,60,0.35)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * k, 0, 7); ctx.fill();
      // tentacle rising from the side
      if (k > 0.5) drawTentacle(h.side < 0 ? 40 : 920, h.y - 60, h.x, h.y, sceneT * 3, 26 * (k - 0.3), 'rgba(43,29,58,0.9)');
    } else {
      const k = (h.t - h.delay) / 0.45;
      drawTentacle(h.side < 0 ? 40 : 920, h.y - 60, h.x, h.y, 0, 30 * (1 - k * 0.5), `rgba(43,29,58,${1 - k})`);
      ctx.strokeStyle = `rgba(190,230,255,${1 - k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (0.6 + k * 0.6), 0, 7); ctx.stroke();
    }
  }
}

function drawTavernBackground() {
  ctx.fillStyle = '#120c08'; ctx.fillRect(0, 0, W, H);
  // floor
  ctx.fillStyle = '#4a3220'; ctx.fillRect(bounds.x, bounds.y, 800, bounds.h);
  ctx.strokeStyle = '#3a2618'; ctx.lineWidth = 2;
  for (let x = bounds.x; x < bounds.x + 800; x += 26) { ctx.beginPath(); ctx.moveTo(x, bounds.y); ctx.lineTo(x, bounds.y + bounds.h); ctx.stroke(); }
  // walls
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(bounds.x - 20, bounds.y - 60, 840, 60);
  ctx.fillRect(bounds.x - 20, bounds.y, 20, bounds.h + 20); ctx.fillRect(bounds.x - 20, bounds.y + bounds.h, 840, 20);
  ctx.fillRect(bounds.x + 800, bounds.y, 20, door.y - bounds.y); ctx.fillRect(bounds.x + 800, door.y + door.h, 20, bounds.y + bounds.h - door.y - door.h + 20);
  // lanterns
  for (const lx of [200, 480, 760]) {
    const fl = 0.85 + Math.sin(sceneT * 9 + lx) * 0.08;
    const g = ctx.createRadialGradient(lx, 130, 4, lx, 130, 170 * fl); g.addColorStop(0, 'rgba(255,190,90,0.35)'); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, 130, 170, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffcc66'; ctx.beginPath(); ctx.arc(lx, 72, 6, 0, 7); ctx.fill();
  }
  // door
  ctx.fillStyle = tavernOpen ? '#0a0604' : '#6b4424'; ctx.fillRect(door.x, door.y, door.w, door.h);
  if (tavernOpen) { const a = 0.5 + Math.sin(sceneT * 5) * 0.3; ctx.fillStyle = `rgba(245,197,66,${a})`; ctx.font = 'bold 22px Georgia'; ctx.textAlign = 'right'; ctx.fillText('EXIT \u2192', door.x - 8, door.y + door.h / 2 + 7); }
  else { ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 3; ctx.strokeRect(door.x, door.y, door.w, door.h); }
  // furniture
  obstacles.forEach((o, i) => {
    if (i === 0) { // bar
      ctx.fillStyle = '#5a3418'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.fillStyle = '#7a4a24'; ctx.fillRect(o.x, o.y + o.h - 12, o.w, 12);
      for (let x = o.x + 30; x < o.x + o.w; x += 60) { ctx.fillStyle = '#c9a25a'; ctx.fillRect(x, o.y + 8, 10, 16); }
    } else {
      ctx.fillStyle = '#6a4020'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 3; ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#d9c48a'; ctx.beginPath(); ctx.arc(o.x + 20, o.y + 18, 5, 0, 7); ctx.fill();
    }
  });
}

function drawPlayer() {
  if (P.hp <= 0) return;
  const blink = P.inv > 0 && Math.floor(P.inv * 20) % 2 === 0 && P.dashT <= 0;
  if (blink) ctx.globalAlpha = 0.45;
  // aura
  const g = ctx.createRadialGradient(P.x, P.y, 4, P.x, P.y, 34); g.addColorStop(0, 'rgba(245,197,66,0.25)'); g.addColorStop(1, 'rgba(20,0,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, 34, 0, 7); ctx.fill();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 12, 14, 5, 0, 0, 7); ctx.fill();
  // cloak
  ctx.fillStyle = '#1a1024'; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, 7); ctx.stroke();
  // head
  ctx.fillStyle = '#e6c9a0'; ctx.beginPath(); ctx.arc(P.x + Math.cos(P.face) * 3, P.y + Math.sin(P.face) * 3 - 2, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(P.x + Math.cos(P.face) * 1, P.y + Math.sin(P.face) * 1 - 5, 6, Math.PI, 0); ctx.fill();
  // sword
  let sa = P.face;
  if (P.slashT > 0) sa = P.face - 1.1 + (1 - P.slashT / 0.18) * 2.2;
  const sx = P.x + Math.cos(sa) * 12, sy = P.y + Math.sin(sa) * 12;
  ctx.strokeStyle = '#2a1640'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(sa) * 30, sy + Math.sin(sa) * 30); ctx.stroke();
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(sa) * 30, sy + Math.sin(sa) * 30); ctx.stroke();
  // slash arc VFX
  if (P.slashT > 0) {
    const k = P.slashT / 0.18;
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#1a0b2a'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(P.x, P.y, 44, P.face - 1.15, P.face + 1.15); ctx.stroke();
    ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(P.x, P.y, 52, P.face - 1.1, P.face + 1.1); ctx.stroke();
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.x, P.y, 58, P.face - 1.0, P.face + 1.0); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawInky() {
  const y = inky.y + Math.sin(inky.bob) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(inky.x, inky.y + 10, 10, 4, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(inky.x, y, 2, inky.x, y, 24); g.addColorStop(0, 'rgba(111,211,255,0.35)'); g.addColorStop(1, 'rgba(111,211,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(inky.x, y, 24, 0, 7); ctx.fill();
  ctx.fillStyle = '#1f5f8f'; ctx.beginPath(); ctx.arc(inky.x, y, inky.r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6fd3ff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f0d6b8'; ctx.beginPath(); ctx.arc(inky.x, y - 2, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#0b0b2a'; ctx.beginPath(); ctx.arc(inky.x, y - 5, 6, Math.PI, 0); ctx.fill(); // ink-black hair
}

function drawEnemy(e) {
  if (e.dead) return;
  if (e.type === 'crawler') {
    ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const la = Math.sin(e.leg + i) * 4; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + s * 16, e.y - 6 + i * 6 + la); ctx.stroke(); }
    ctx.fillStyle = e.flash > 0 ? '#fff' : '#3b2a4a'; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(e.x - 4, e.y - 3, 2, 0, 7); ctx.arc(e.x + 4, e.y - 3, 2, 0, 7); ctx.fill();
  } else if (e.type === 'bandit') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 12, 14, 5, 0, 0, 7); ctx.fill();
    if (e.state === 'windup') { ctx.fillStyle = 'rgba(255,60,40,0.35)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, 7); ctx.fill(); }
    ctx.fillStyle = e.flash > 0 ? '#fff' : (e.kind === 'thrower' ? '#4a5a2a' : '#6a3a2a'); ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9a080'; ctx.beginPath(); ctx.arc(e.x + Math.cos(e.face) * 3, e.y + Math.sin(e.face) * 3 - 2, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#a02020'; ctx.fillRect(e.x - 7, e.y - 9, 14, 4); // bandana
    // weapon
    let wa = e.face; if (e.state === 'strike') wa += 0.8; if (e.state === 'windup') wa -= 0.9;
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(wa) * 10, e.y + Math.sin(wa) * 10); ctx.lineTo(e.x + Math.cos(wa) * (e.kind === 'thrower' ? 20 : 28), e.y + Math.sin(wa) * (e.kind === 'thrower' ? 20 : 28)); ctx.stroke();
    if (e.state === 'strike') { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, 40, e.face - 1, e.face + 1); ctx.stroke(); }
  }
  if (e.type !== 'boss' && e.hp < e.max) { ctx.fillStyle = '#300'; ctx.fillRect(e.x - 16, e.y - e.r - 10, 32, 4); ctx.fillStyle = '#e04040'; ctx.fillRect(e.x - 16, e.y - e.r - 10, 32 * e.hp / e.max, 4); }
}

function drawProjs() {
  for (const p of projs) {
    if (p.kind === 'flame') {
      ctx.fillStyle = '#1a0b2a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5a623'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, 7); ctx.fill();
    } else if (p.kind === 'water') {
      ctx.fillStyle = '#6fd3ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, p.r * 0.4, 0, 7); ctx.fill();
    } else if (p.kind === 'ink') {
      ctx.fillStyle = '#5b2a7a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#12061c'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    } else if (p.kind === 'knife') {
      const a = Math.atan2(p.vy, p.vx); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8); ctx.lineTo(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8); ctx.stroke();
    }
  }
}

function drawParts() {
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.t / p.max); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = 'bold 15px Georgia';
  for (const t of texts) { ctx.globalAlpha = Math.min(1, t.t * 2); ctx.fillStyle = '#000'; ctx.fillText(t.s, t.x + 1, t.y + 1); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, t.y); }
  ctx.globalAlpha = 1;
}

function bar(x, y, w, h, k, col, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#2a0a0a'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(k, 0, 1), h);
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Georgia'; ctx.textAlign = 'left'; ctx.fillText(label, x + 6, y + h - 3); }
}

function drawHUD() {
  bar(20, 18, 220, 16, P.hp / P.max, '#d4a62a', `Casimir  ${Math.ceil(P.hp)}/${P.max}`);
  // ability pips
  const pip = (x, label, cd, max, col) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, 42, 60, 20);
    ctx.fillStyle = cd <= 0 ? col : '#444'; ctx.fillRect(x + 2, 44, 56 * (cd <= 0 ? 1 : 1 - cd / max), 16);
    ctx.fillStyle = '#fff'; ctx.font = '11px Georgia'; ctx.textAlign = 'center'; ctx.fillText(label, x + 30, 56);
  };
  pip(20, 'Flame [RMB/E]', P.flameCd, 1.1, '#b07a10');
  pip(86, 'Dash [Shift]', P.dashCd, 0.8, '#4a2a6a');
  pip(152, 'Inky heal', inky.healCd, 11, '#2a7fb8');
  if (boss && !boss.dead && scene === 'sea') {
    bar(W / 2 - 200, 20, 400, 12, boss.hp / boss.max, boss.phase === 2 ? '#c2331a' : '#7a3aa0', '');
    ctx.fillStyle = '#e8d9a8'; ctx.font = 'bold 13px Georgia'; ctx.textAlign = 'center'; ctx.fillText('FLAME-EATER SPAWN', W / 2, 12);
  }
  if (scene === 'tavern') {
    const n = enemies.filter(e => !e.dead).length;
    ctx.fillStyle = '#e8d9a8'; ctx.font = 'bold 15px Georgia'; ctx.textAlign = 'right';
    ctx.fillText(tavernOpen ? 'Objective: Leave through the door \u2192' : `Objective: Defeat the bandits (${n} left)`, W - 20, 30);
  }
  ctx.fillStyle = 'rgba(232,217,168,0.55)'; ctx.font = '12px Georgia'; ctx.textAlign = 'right';
  ctx.fillText('WASD move \u00b7 Mouse aim \u00b7 LMB/Space slash \u00b7 RMB/E Shadowflame \u00b7 Shift dash', W - 20, H - 12);
  if (dialog) {
    ctx.fillStyle = 'rgba(8,6,14,0.85)'; ctx.fillRect(20, H - 82, 520, 50);
    ctx.strokeStyle = dialog.name === 'Inky' ? '#6fd3ff' : dialog.name === 'Casimir' ? '#f5c542' : '#c44'; ctx.lineWidth = 2; ctx.strokeRect(20, H - 82, 520, 50);
    ctx.textAlign = 'left'; ctx.font = 'bold 13px Georgia'; ctx.fillStyle = ctx.strokeStyle; ctx.fillText(dialog.name, 32, H - 62);
    ctx.font = '15px Georgia'; ctx.fillStyle = '#eee'; ctx.fillText(dialog.text, 32, H - 42);
  }
  if (banner) {
    const k = banner.t / banner.max, a = Math.min(1, (1 - k) * 6, banner.t * 2);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H / 2 - 60, W, 90);
    ctx.font = 'bold 44px Georgia'; ctx.fillStyle = '#f5c542'; ctx.fillText(banner.text, W / 2, H / 2 - 10);
    ctx.font = 'italic 18px Georgia'; ctx.fillStyle = '#e8d9a8'; ctx.fillText(banner.sub, W / 2, H / 2 + 20);
    ctx.globalAlpha = 1;
  }
}

function drawCentered(lines, y0, font, col, gap = 30) {
  ctx.textAlign = 'center'; ctx.font = font; ctx.fillStyle = col;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * gap));
}

function drawTitle() {
  ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = (i * 97 + sceneT * 20) % W, y = H - ((i * 53 + sceneT * 40 * (1 + i % 3)) % H); ctx.fillStyle = i % 2 ? 'rgba(245,197,66,0.6)' : 'rgba(90,40,140,0.6)'; ctx.fillRect(x, y, 3, 3); }
  const g = ctx.createRadialGradient(W / 2, 200, 10, W / 2, 200, 260); g.addColorStop(0, 'rgba(245,197,66,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawCentered(['SHADOWFLAME'], 200, 'bold 72px Georgia', '#f5c542');
  drawCentered(['Chapter 1 \u2014 The Crossing'], 245, 'italic 22px Georgia', '#e8d9a8');
  const a = 0.5 + Math.sin(sceneT * 3) * 0.5; ctx.globalAlpha = a;
  drawCentered(['Click or press Enter to begin'], 330, '20px Georgia', '#fff'); ctx.globalAlpha = 1;
  drawCentered(['WASD / Arrows \u2014 move     Mouse \u2014 aim', 'Left click / Space \u2014 sword slash     Right click / E \u2014 Shadowflame bolt', 'Shift \u2014 dash (brief invulnerability)     Inky fights and heals on his own'], 400, '15px Georgia', '#b8a878', 24);
}
function drawStory() {
  ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, W, H);
  const pg = story.pages[story.i]; ctx.globalAlpha = Math.min(1, story.t * 3);
  drawCentered(pg, H / 2 - 20, 'italic 22px Georgia', '#e8d9a8', 36); ctx.globalAlpha = 1;
  drawCentered(['click / Enter \u25b8'], H - 40, '14px Georgia', '#8a7a58');
}
function drawWin() {
  ctx.fillStyle = 'rgba(7,7,12,0.92)'; ctx.fillRect(0, 0, W, H);
  drawCentered(['SLICE COMPLETE'], 170, 'bold 54px Georgia', '#f5c542');
  drawCentered(['Greyharbor is quiet \u2014 for now.', 'The mine and the Whispering Key wait inland. The Flame-Eater still hungers.', 'To be continued\u2026'], 230, 'italic 20px Georgia', '#e8d9a8', 32);
  drawCentered([`Time: ${(stats.time || 0).toFixed(1)}s     Damage taken: ${stats.taken}`], 370, '18px Georgia', '#b8a878');
  if (sceneT > 1) drawCentered(['Click or press R to return to title'], 430, '16px Georgia', '#fff');
}
function drawDead() {
  ctx.fillStyle = 'rgba(10,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  drawCentered(['CASIMIR HAS FALLEN'], H / 2 - 20, 'bold 46px Georgia', '#c43');
  drawCentered(['Press R or click to try this fight again'], H / 2 + 30, '18px Georgia', '#e8d9a8');
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (scene === 'title') return drawTitle();
  if (scene === 'story') return drawStory();
  ctx.save();
  if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  if (scene === 'sea' || (scene === 'dead' && !seaWon)) { drawSeaBackground(); drawBoss(); drawHazards(); drawMast(); }
  else { drawTavernBackground(); }
  for (const e of enemies) if (e.type !== 'boss') drawEnemy(e);
  drawInky(); drawPlayer(); drawProjs(); drawParts();
  ctx.restore();
  drawHUD();
  if (scene === 'dead') drawDead();
  if (scene === 'win') drawWin();
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  try { update(dt); draw(); }
  catch (err) { console.error(err); }
  for (const k in pressed) pressed[k] = false;
  mouse.lp = mouse.rp = false;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { get scene() { return scene; }, get P() { return P; }, get enemies() { return enemies; }, get boss() { return boss; }, startSea, startTavern };
