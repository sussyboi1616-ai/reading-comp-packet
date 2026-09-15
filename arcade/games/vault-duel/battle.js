window.VB_BATTLE = (function () {
  var D = window.VB_DATA;
  var canvas, ctx, raf;
  var keys = {};
  var players = [];
  var projectiles = [];
  var platforms = [];
  var currentMap = null;
  var running = false;
  var onEnd = null;
  var frame = 0;
  var particles = [];
  var onlineMode = false;
  var isHost = false;
  var mySlot = 0;
  var mouseClientX = 480;
  var mouseClientY = 270;
  var mouseDown = false;
  var mouseBound = false;
  var prevMouseDown = false;
  var clientPredictedShots = [];
  var pendingNetworkInput = null;

  function charById(id) {
    for (var i = 0; i < D.CHARACTERS.length; i++) {
      if (D.CHARACTERS[i].id === id) return D.CHARACTERS[i];
    }
    return D.CHARACTERS[0];
  }

  function weaponOf(p) {
    return window.vbWeapon(p.char);
  }

  function weaponById(id) {
    return D.WEAPONS[id] || D.WEAPONS.pistol;
  }

  function maxHp(char) {
    return char.health || 100;
  }

  function emptyInput() {
    return { left: false, right: false, jump: false, atk: false, atkEdge: false, special: false, aimAngle: 0 };
  }

  function makeFighter(slot, charId, x, y, opts) {
    opts = opts || {};
    var c = charById(charId);
    return {
      slot: slot,
      char: c,
      charId: charId,
      x: x,
      y: y,
      w: 34,
      h: 52,
      vx: 0,
      vy: 0,
      facing: slot === 0 ? 1 : -1,
      onGround: false,
      hp: maxHp(c),
      maxHp: maxHp(c),
      stocks: D.STOCKS,
      atkCd: 0,
      swing: 0,
      specialCd: 0,
      specialHeld: false,
      boostTimer: 0,
      guardTimer: 0,
      specialFlash: 0,
      invuln: opts.noSpawnInvuln ? 0 : 90,
      respawn: 0,
      atkKeyHeld: false,
      hitFlash: 0
    };
  }

  function loadMap(mapId) {
    if (mapId === 'random') {
      currentMap = onlineMode ? window.vbMapById('vault') : window.vbRandomMap();
    } else {
      currentMap = window.vbMapById(mapId);
    }
    platforms = currentMap.platforms.map(function (p) {
      return { x: p.x, y: p.y, w: p.w, h: p.h, baseX: p.x, baseY: p.y, dx: 0, dy: 0, moving: false };
    });
    (currentMap.movers || []).forEach(function (m) {
      if (!platforms[m.platform]) return;
      platforms[m.platform].mover = m;
      platforms[m.platform].moving = true;
    });
  }

  function resetMatch(p1Id, p2Id, forOnline) {
    projectiles = [];
    particles = [];
    frame = 0;
    var sp = currentMap.spawns;
    var spawnOpts = forOnline ? { noSpawnInvuln: true } : null;
    players = [
      makeFighter(0, p1Id, sp[0][0], sp[0][1], spawnOpts),
      makeFighter(1, p2Id, sp[1][0], sp[1][1], spawnOpts)
    ];
  }

  function syncMapFromSnapshot(snap) {
    if (!snap || !snap.mapId || snap.mapId === 'random') return false;
    if (currentMap && currentMap.id === snap.mapId) return false;
    loadMap(snap.mapId);
    return true;
  }

  function controls(slot) {
    if (slot === 0) {
      return { left: 'a', right: 'd', up: 'w', down: 's', jump: 'w', atk: 's', special: 'e' };
    }
    return { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'ArrowUp', atk: 'ArrowDown', special: 'Shift' };
  }

  function keyDown(k) { return !!keys[k]; }

  var AIM_MAX = Math.PI / 2.35;

  function computeAimAngle() {
    var me = players[mySlot];
    if (!me || !canvas) return me && me.facing > 0 ? 0 : Math.PI;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return me.facing > 0 ? 0 : Math.PI;
    var mx = (mouseClientX - rect.left) * (canvas.width / rect.width);
    var my = (mouseClientY - rect.top) * (canvas.height / rect.height);
    var ox = me.x + me.facing * 18;
    var oy = me.y - 6;
    var dx = mx - ox;
    var dy = my - oy;
    var localX = dx * me.facing;
    var localY = dy;
    if (localX < 8) localX = 8;
    var a = Math.atan2(localY, localX);
    a = Math.max(-AIM_MAX, Math.min(AIM_MAX, a));
    return me.facing > 0 ? a : (Math.PI - a);
  }

  function gatherLocalInput(slot) {
    var c = controls(slot);
    return {
      left: keyDown(c.left),
      right: keyDown(c.right),
      jump: keyDown(c.jump),
      atk: keyDown(c.atk),
      special: keyDown(c.special),
      aimAngle: 0
    };
  }

  function gatherOnlineInput() {
    var atk = mouseDown;
    return {
      left: keyDown('a') || keyDown('A') || keyDown('ArrowLeft'),
      right: keyDown('d') || keyDown('D') || keyDown('ArrowRight'),
      jump: keyDown('w') || keyDown('W') || keyDown(' ') || keyDown('ArrowUp'),
      atk: atk,
      atkEdge: atk && !prevMouseDown,
      special: keyDown('e') || keyDown('E'),
      aimAngle: computeAimAngle()
    };
  }

  function commitMouseEdge() {
    prevMouseDown = mouseDown;
  }

  function gatherInput(slot, remoteOverride) {
    if (remoteOverride) {
      if (remoteInputAt[slot] > 0 && performance.now() - remoteInputAt[slot] > INPUT_STALE_MS) return emptyInput();
      return remoteOverride;
    }
    if (onlineMode && slot === mySlot) return gatherOnlineInput();
    if (onlineMode) return emptyInput();
    return gatherLocalInput(slot);
  }

  function bindMouseControls() {
    if (mouseBound || !canvas) return;
    mouseBound = true;
    canvas.addEventListener('mousemove', function (e) {
      mouseClientX = e.clientX;
      mouseClientY = e.clientY;
    });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) mouseDown = true;
    });
    canvas.addEventListener('mouseup', function () { mouseDown = false; });
    canvas.addEventListener('mouseleave', function () { mouseDown = false; });
  }

  function collidePlatformsRect(x, y, w, h) {
    for (var i = 0; i < platforms.length; i++) {
      var pl = platforms[i];
      if (x + w > pl.x && x < pl.x + pl.w && y + h > pl.y && y < pl.y + pl.h) return true;
    }
    return false;
  }

  function collidePlatforms(p) {
    p.onGround = false;
    for (var i = 0; i < platforms.length; i++) {
      var pl = platforms[i];
      var px = p.x - p.w / 2;
      var py = p.y - p.h / 2;
      if (px + p.w > pl.x && px < pl.x + pl.w && py + p.h > pl.y && py < pl.y + pl.h) {
        var overlapL = px + p.w - pl.x;
        var overlapR = pl.x + pl.w - px;
        var overlapT = py + p.h - pl.y;
        var overlapB = pl.y + pl.h - py;
        var min = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (min === overlapT && p.vy >= 0) {
          p.y = pl.y - p.h / 2;
          p.vy = 0;
          p.onGround = true;
        } else if (min === overlapB && p.vy < 0) {
          p.y = pl.y + pl.h + p.h / 2;
          p.vy = 0;
        } else if (min === overlapL) {
          p.x = pl.x - p.w / 2;
          p.vx = 0;
        } else if (min === overlapR) {
          p.x = pl.x + pl.w + p.w / 2;
          p.vx = 0;
        }
      }
    }
  }

  function fighterRect(p) {
    return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function applyKnockback(victim, dir, force) {
    victim.vx = dir * force * 0.5;
    victim.vy = -force * 0.35;
  }

  function damageFighter(attacker, victim, amount, wpn) {
    if (victim.invuln > 0 || victim.respawn > 0) return;
    if (victim.guardTimer > 0) {
      victim.guardTimer = Math.max(0, victim.guardTimer - 18);
      burstParticles(victim.x, victim.y, '#e2b34d', 7);
      return;
    }
    var dmg = Math.max(1, Math.round(amount * (attacker.char.power || 1)));
    victim.hp = Math.max(0, victim.hp - dmg);
    victim.hitFlash = 10;
    victim.invuln = 8;
    applyKnockback(victim, attacker.facing, wpn.knockback * 4);
    if (victim.hp <= 0) koFighter(victim);
    if (attacker.char.special === 'dash') {
      attacker.vx = attacker.facing * 9;
      attacker.specialCd = 90;
    }
  }

  function koFighter(p) {
    p.stocks -= 1;
    if (p.stocks <= 0) {
      running = false;
      if (onEnd) onEnd(1 - p.slot);
      return;
    }
    p.hp = p.maxHp;
    p.vx = 0;
    p.vy = 0;
    p.respawn = 100;
    p.invuln = 100;
    var sp = currentMap.spawns[p.slot];
    p.x = sp[0];
    p.y = sp[1] - 80;
  }

  function spawnProjectile(p, wpn, aimAngle) {
    var dir = p.facing;
    var px = p.x + dir * 22;
    var py = p.y - 6;
    var vx = dir * wpn.speed;
    var vy = wpn.speedY || 0;
    if (onlineMode && aimAngle != null && wpn.type === 'projectile' && !wpn.arc) {
      vx = Math.cos(aimAngle) * wpn.speed;
      vy = Math.sin(aimAngle) * wpn.speed;
      px = p.x + Math.cos(aimAngle) * 22;
      py = p.y - 6 + Math.sin(aimAngle) * 22;
    } else if (wpn.arc) {
      vy = wpn.launchAngle * 10;
      vx = dir * (wpn.speed * 0.85);
    }
    return {
      x: px, y: py, vx: vx, vy: vy, r: wpn.size,
      owner: p.slot, wpn: wpn, life: 90, gravity: wpn.arc ? 0.18 : 0
    };
  }

  function pushProjectile(pr) {
    projectiles.push(pr);
  }

  function spawnClientPredictedShot(p, aimAngle) {
    if (isHost || !onlineMode || !p || p.respawn > 0 || p.atkCd > 0) return;
    var wpn = weaponOf(p);
    if (wpn.type !== 'projectile') return;
    var pr = spawnProjectile(p, wpn, aimAngle);
    pr.predicted = true;
    clientPredictedShots.push(pr);
    p.atkCd = wpn.cooldown;
  }

  function fireWeapon(p, aimAngle) {
    if (p.atkCd > 0 || p.respawn > 0) return;
    var wpn = weaponOf(p);
    p.atkCd = wpn.cooldown;
    if (wpn.type === 'projectile') {
      pushProjectile(spawnProjectile(p, wpn, aimAngle));
      return;
    }
    p.swing = wpn.swing || 12;
    var hb = meleeHitbox(p, wpn);
    var other = players[1 - p.slot];
    if (rectsOverlap(hb, fighterRect(other))) {
      damageFighter(p, other, wpn.damage, wpn);
    }
  }

  function spawnSpecialProjectile(p, wpn, angle, damageScale) {
    var dir = p.facing;
    projectiles.push({
      x: p.x + dir * 22, y: p.y - 6,
      vx: Math.cos(angle) * wpn.speed * dir,
      vy: Math.sin(angle) * wpn.speed,
      r: Math.max(4, wpn.size), owner: p.slot,
      wpn: Object.assign({}, wpn, { damage: Math.round(wpn.damage * damageScale), pierce: false }),
      life: 75, gravity: 0
    });
  }

  function burstParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) particles.push({
      x: x, y: y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7,
      life: 28 + Math.random() * 15, color: color, size: 2 + Math.random() * 4
    });
  }

  function useSpecial(p) {
    if (p.specialCd > 0 || p.respawn > 0) return;
    var other = players[1 - p.slot];
    var wpn = weaponOf(p);
    p.specialCd = 300;
    p.specialFlash = 22;
    burstParticles(p.x, p.y, p.char.color, 14);
    if (p.char.special === 'burst') {
      [-0.18, 0, 0.18].forEach(function (a) { spawnSpecialProjectile(p, wpn, a, 0.8); });
    } else if (p.char.special === 'overdrive') {
      p.boostTimer = 180; p.specialCd = 360;
    } else if (p.char.special === 'slam') {
      p.vy = -5;
      if (Math.abs(other.x - p.x) < 145 && Math.abs(other.y - p.y) < 95) damageFighter(p, other, 22, { knockback: 1.6 });
      burstParticles(p.x, p.y + 24, '#ffffff', 24);
    } else if (p.char.special === 'blink') {
      p.x += p.facing * 115; p.invuln = 20;
    } else if (p.char.special === 'guard') {
      p.guardTimer = 150; p.specialCd = 390;
    } else if (p.char.special === 'dash') {
      p.vx = p.facing * 14; p.invuln = 18;
    } else if (p.char.special === 'nova') {
      for (var i = 0; i < 8; i++) spawnSpecialProjectile(p, wpn, (Math.PI * 2 * i) / 8, 0.65);
      p.specialCd = 420;
    } else if (p.char.special === 'volley') {
      [-0.32, -0.12, 0.1].forEach(function (a) { spawnSpecialProjectile(p, wpn, a, 0.9); });
    }
  }

  function meleeHitbox(p, wpn) {
    var reach = wpn.reach;
    var x = p.facing > 0 ? p.x + 6 : p.x - 6 - reach;
    return { x: x, y: p.y - 22, w: reach, h: 36 };
  }

  function updateProjectiles() {
    for (var i = projectiles.length - 1; i >= 0; i--) {
      var pr = projectiles[i];
      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.vy += pr.gravity;
      pr.life--;
      if (pr.life <= 0 || pr.x < -40 || pr.x > 1000 || pr.y > 650) {
        projectiles.splice(i, 1);
        continue;
      }
      if (collidePlatformsRect(pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2) && !pr.wpn.pierce) {
        projectiles.splice(i, 1);
        continue;
      }
      for (var s = 0; s < players.length; s++) {
        if (s === pr.owner) continue;
        var victim = players[s];
        if (victim.respawn > 0) continue;
        var fr = fighterRect(victim);
        if (pr.x > fr.x - pr.r && pr.x < fr.x + fr.w + pr.r &&
            pr.y > fr.y - pr.r && pr.y < fr.y + fr.h + pr.r) {
          damageFighter(players[pr.owner], victim, pr.wpn.damage, pr.wpn);
          if (!pr.wpn.pierce) projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  function updateMovingPlatforms() {
    platforms.forEach(function (pl) {
      if (!pl.mover) return;
      var oldX = pl.x, oldY = pl.y, m = pl.mover;
      var offset = Math.sin(frame * m.speed + (m.phase || 0)) * m.distance;
      pl.x = pl.baseX + (m.axis === 'x' ? offset : 0);
      pl.y = pl.baseY + (m.axis === 'y' ? offset : 0);
      pl.dx = pl.x - oldX; pl.dy = pl.y - oldY;
      players.forEach(function (p) {
        var foot = p.y + p.h / 2;
        if (p.respawn <= 0 && p.x + p.w / 2 > oldX && p.x - p.w / 2 < oldX + pl.w && Math.abs(foot - oldY) < 7 && p.vy >= 0) {
          p.x += pl.dx; p.y += pl.dy;
        }
      });
    });
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var q = particles[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.08; q.life--;
      if (q.life <= 0) particles.splice(i, 1);
    }
  }

  function blastKO(p) {
    if (p.respawn > 0) return;
    if (p.x < D.BLAST.left || p.x > D.BLAST.right || p.y > D.BLAST.bottom) {
      p.stocks -= 1;
      if (p.stocks <= 0) {
        running = false;
        if (onEnd) onEnd(1 - p.slot);
        return;
      }
      p.hp = p.maxHp;
      p.vx = 0;
      p.vy = 0;
      p.respawn = 100;
      p.invuln = 100;
      var sp = currentMap.spawns[p.slot];
      p.x = sp[0];
      p.y = sp[1] - 80;
    }
  }

  function updatePlayer(p, input) {
    input = input || emptyInput();
    if (p.respawn > 0) {
      p.respawn--;
      p.y += 2;
      if (p.respawn <= 0) {
        var sp = currentMap.spawns[p.slot];
        p.x = sp[0];
        p.y = sp[1];
      }
      return;
    }
    if (p.invuln > 0) p.invuln--;
    if (p.hitFlash > 0) p.hitFlash--;
    if (p.atkCd > 0) p.atkCd--;
    if (p.swing > 0) p.swing--;
    if (p.specialCd > 0) p.specialCd--;
    if (p.specialFlash > 0) p.specialFlash--;
    if (p.boostTimer > 0) p.boostTimer--;
    if (p.guardTimer > 0) p.guardTimer--;

    var spd = p.char.speed * (p.boostTimer > 0 ? 1.55 : 1);
    if (input.left) { p.vx -= 0.7; p.facing = -1; }
    if (input.right) { p.vx += 0.7; p.facing = 1; }
    if (input.jump && p.onGround) {
      p.vy = -p.char.jump;
      p.onGround = false;
    }
    var atkNow = !!input.atk;
    if (input.atkEdge || (atkNow && !p.atkKeyHeld)) {
      fireWeapon(p, input.aimAngle);
      if (input.atkEdge) input.atkEdge = false;
    }
    p.atkKeyHeld = atkNow;
    var specialNow = !!input.special;
    if (specialNow && !p.specialHeld) useSpecial(p);
    p.specialHeld = specialNow;

    p.vy += 0.42;
    p.vx *= 0.82;
    if (p.onGround) p.vy *= 0.9;
    if (Math.abs(p.vx) > spd) p.vx = Math.sign(p.vx) * spd;
    if (p.vy > 14) p.vy = 14;
    p.x += p.vx;
    p.y += p.vy;
    collidePlatforms(p);
    blastKO(p);
  }

  function bumpFighters() {
    var a = players[0];
    var b = players[1];
    if (a.respawn > 0 || b.respawn > 0) return;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    if (Math.abs(dx) < (a.w + b.w) * 0.45 && Math.abs(dy) < (a.h + b.h) * 0.5) {
      var push = 2.2;
      a.vx -= push * Math.sign(dx);
      b.vx += push * Math.sign(dx);
    }
  }

  function simulateFrame(inputs) {
    frame++;
    updateMovingPlatforms();
    for (var i = 0; i < players.length; i++) {
      updatePlayer(players[i], inputs && inputs[i] ? inputs[i] : emptyInput());
    }
    updateProjectiles();
    if (!onlineMode || isHost) updateParticles();
    bumpFighters();
  }

  function serializePlayer(p) {
    return {
      slot: p.slot, charId: p.charId || p.char.id,
      x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx * 100) / 100, vy: Math.round(p.vy * 100) / 100,
      facing: p.facing, hp: p.hp, maxHp: p.maxHp, stocks: p.stocks,
      atkCd: p.atkCd, swing: p.swing, specialCd: p.specialCd,
      boostTimer: p.boostTimer, guardTimer: p.guardTimer, specialFlash: p.specialFlash,
      invuln: p.invuln, respawn: p.respawn, hitFlash: p.hitFlash, onGround: p.onGround
    };
  }

  function getSnapshot() {
    return {
      f: frame,
      mapId: currentMap.id,
      running: running,
      players: players.map(serializePlayer),
      projectiles: projectiles.map(function (pr) {
        return {
          x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, r: pr.r,
          owner: pr.owner, wpnId: pr.wpn.id, life: pr.life, gravity: pr.gravity
        };
      }),
      platforms: platforms.filter(function (pl) { return pl.moving; }).map(function (pl, i) {
        return { i: i, x: pl.x, y: pl.y };
      })
    };
  }

  function blendNum(a, b, t) { return a + (b - a) * t; }

  function copyPlayerState(p, sp) {
    if (p.charId !== sp.charId) {
      p.charId = sp.charId;
      p.char = charById(sp.charId);
      p.maxHp = maxHp(p.char);
    }
    p.x = sp.x; p.y = sp.y; p.vx = sp.vx; p.vy = sp.vy;
    p.facing = sp.facing; p.hp = sp.hp; p.maxHp = sp.maxHp; p.stocks = sp.stocks;
    p.atkCd = sp.atkCd; p.swing = sp.swing; p.specialCd = sp.specialCd;
    p.boostTimer = sp.boostTimer; p.guardTimer = sp.guardTimer; p.specialFlash = sp.specialFlash;
    p.invuln = sp.invuln; p.respawn = sp.respawn; p.hitFlash = sp.hitFlash; p.onGround = sp.onGround;
  }

  function blendPlayerState(p, prev, sp, t) {
    if (p.charId !== sp.charId) {
      p.charId = sp.charId;
      p.char = charById(sp.charId);
      p.maxHp = maxHp(p.char);
    }
    p.x = blendNum(prev.x, sp.x, t);
    p.y = blendNum(prev.y, sp.y, t);
    p.vx = blendNum(prev.vx, sp.vx, t);
    p.vy = blendNum(prev.vy, sp.vy, t);
    p.facing = sp.facing; p.hp = sp.hp; p.maxHp = sp.maxHp; p.stocks = sp.stocks;
    p.atkCd = sp.atkCd; p.swing = sp.swing; p.specialCd = sp.specialCd;
    p.boostTimer = sp.boostTimer; p.guardTimer = sp.guardTimer; p.specialFlash = sp.specialFlash;
    p.invuln = sp.invuln; p.respawn = sp.respawn; p.hitFlash = sp.hitFlash; p.onGround = sp.onGround;
  }

  function applyWorldFromSnapshot(snap) {
    var fromHost = (snap.projectiles || []).map(function (pr) {
      var wpn = weaponById(pr.wpnId);
      return {
        x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, r: pr.r,
        owner: pr.owner, wpn: wpn, life: pr.life, gravity: pr.gravity || 0
      };
    });
    if (!isHost && onlineMode) {
      if (fromHost.some(function (pr) { return pr.owner === mySlot; }) && clientPredictedShots.length) {
        clientPredictedShots.shift();
      }
      projectiles = fromHost.concat(clientPredictedShots);
    } else {
      projectiles = fromHost;
    }
    var moving = platforms.filter(function (pl) { return pl.moving; });
    (snap.platforms || []).forEach(function (plSnap) {
      if (moving[plSnap.i]) {
        moving[plSnap.i].x = plSnap.x;
        moving[plSnap.i].y = plSnap.y;
      }
    });
  }

  function syncLocalMetaFromSnap(sp) {
    var me = players[mySlot];
    if (!me || !sp) return;
    me.hp = sp.hp;
    me.stocks = sp.stocks;
    me.respawn = sp.respawn;
    me.invuln = sp.invuln;
    me.atkCd = sp.atkCd;
    me.swing = sp.swing;
    me.specialCd = sp.specialCd;
    me.boostTimer = sp.boostTimer;
    me.guardTimer = sp.guardTimer;
    me.hitFlash = sp.hitFlash;
    me.onGround = sp.onGround;
    if (sp.respawn > 0) {
      me.x = sp.x;
      me.y = sp.y;
      me.vx = sp.vx;
      me.vy = sp.vy;
      me.facing = sp.facing;
    }
  }

  function reconcileLocalFromSnap(sp) {
    var me = players[mySlot];
    if (!me || !sp) return;
    syncLocalMetaFromSnap(sp);
    if (sp.respawn > 0) return;
    var dx = sp.x - me.x;
    var dy = sp.y - me.y;
    var err = dx * dx + dy * dy;
    if (err > 65 * 65) {
      me.x = sp.x;
      me.y = sp.y;
      me.vx = sp.vx;
      me.vy = sp.vy;
      me.facing = sp.facing;
    } else if (err > 14 * 14) {
      me.x += dx * 0.15;
      me.y += dy * 0.15;
      me.facing = sp.facing;
    }
  }

  function applySnapshot(snap, blendFrom, alpha) {
    if (!snap) return;
    frame = snap.f || frame;
    if (snap.running === false) running = false;
    var useBlend = blendFrom && alpha != null && alpha < 1;

    snap.players.forEach(function (sp) {
      var prev = useBlend ? (blendFrom.players || []).filter(function (p) { return p.slot === sp.slot; })[0] : null;
      var p = players[sp.slot];
      if (!p) return;
      if (useBlend && prev) blendPlayerState(p, prev, sp, alpha);
      else copyPlayerState(p, sp);
    });

    applyWorldFromSnapshot(snap);
  }

  function applyClientView(snap, from, alpha, extrapMs) {
    if (!snap) return;
    frame = snap.f || frame;
    if (snap.running === false) running = false;
    var useBlend = from && alpha != null && alpha < 1;

    snap.players.forEach(function (sp) {
      if (sp.slot === mySlot) return;
      var p = players[sp.slot];
      if (!p) return;
      var prev = useBlend ? (from.players || []).filter(function (pl) { return pl.slot === sp.slot; })[0] : null;
      if (useBlend && prev) blendPlayerState(p, prev, sp, alpha);
      else copyPlayerState(p, sp);
      if (extrapMs > 0 && alpha >= 1) {
        p.x += sp.vx * extrapMs * 0.085;
        p.y += sp.vy * extrapMs * 0.085;
      }
    });

    applyWorldFromSnapshot(snap);

    var meSnap = (snap.players || []).filter(function (sp) { return sp.slot === mySlot; })[0];
    if (meSnap) syncLocalMetaFromSnap(meSnap);
  }

  function tickClientPredictedShots() {
    if (isHost || !onlineMode) return;
    for (var i = clientPredictedShots.length - 1; i >= 0; i--) {
      var pr = clientPredictedShots[i];
      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.vy += pr.gravity || 0;
      pr.life--;
      if (pr.life <= 0 || pr.x < -40 || pr.x > 1000 || pr.y > 650) {
        clientPredictedShots.splice(i, 1);
      }
    }
  }

  function runClientLocalSim(ts, localInp) {
    if (!clientLastFrame) clientLastFrame = ts;
    if (isNaN(clientSimAccum)) clientSimAccum = 0;
    var dt = Math.min(120, ts - clientLastFrame);
    if (dt < 0) dt = 0;
    clientLastFrame = ts;
    clientSimAccum += dt;
    var me = players[mySlot];
    if (!me || me.respawn > 0) return;
    var inp = localInp || gatherOnlineInput();
    var edgeLeft = !!inp.atkEdge;
    var steps = 0;
    while (clientSimAccum >= SIM_STEP_MS && steps < 4) {
      clientSimAccum -= SIM_STEP_MS;
      if (edgeLeft) {
        spawnClientPredictedShot(me, inp.aimAngle);
        edgeLeft = false;
      }
      updatePlayer(me, {
        left: inp.left,
        right: inp.right,
        jump: inp.jump,
        atk: false,
        atkEdge: false,
        special: inp.special,
        aimAngle: inp.aimAngle
      });
      collidePlatforms(me);
      blastKO(me);
      steps++;
    }
  }

  function drawPlatform(pl) {
    ctx.fillStyle = '#2a3348';
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = currentMap.accent || '#3a4558';
    ctx.globalAlpha = 0.45;
    ctx.fillRect(pl.x, pl.y, pl.w, 4);
    if (pl.moving) {
      ctx.globalAlpha = 0.8;
      for (var i = 12; i < pl.w - 8; i += 26) {
        ctx.beginPath(); ctx.arc(pl.x + i, pl.y + pl.h / 2, 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMachinery() {
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(frame * 0.004);
    ctx.strokeStyle = currentMap.accent; ctx.globalAlpha = 0.08; ctx.lineWidth = 9;
    for (var i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.strokeRect(145, -12, 42, 24); }
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  function drawParticles() {
    particles.forEach(function (q) {
      ctx.globalAlpha = Math.min(1, q.life / 18); ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawAimReticle() {
    if (!onlineMode || !canvas) return;
    var me = players[mySlot];
    if (!me || me.respawn > 0) return;
    var angle = computeAimAngle();
    var len = 42;
    var x1 = me.x + me.facing * 18;
    var y1 = me.y - 6;
    var x2 = x1 + Math.cos(angle) * len;
    var y2 = y1 + Math.sin(angle) * len;
    ctx.save();
    ctx.strokeStyle = 'rgba(242,193,78,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(x2, y2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBodyShape(p, x, y) {
    var c = p.char;
    var flash = p.hitFlash > 0;
    ctx.fillStyle = flash ? '#ffffff' : c.color;
    var shape = c.shape;

    if (shape === 'tank') {
      roundRect(x - 4, y + 8, p.w + 8, p.h - 8, 6);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + 4, y + 20, p.w - 8, 10);
    } else if (shape === 'runner') {
      roundRect(x + 6, y, p.w - 12, p.h, 10);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + 10, y + 8, 6, 18);
    } else if (shape === 'ninja') {
      ctx.beginPath();
      ctx.moveTo(x + p.w / 2, y);
      ctx.lineTo(x + p.w, y + p.h);
      ctx.lineTo(x, y + p.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + 8, y + 14, p.w - 16, 6);
    } else if (shape === 'brawler') {
      roundRect(x, y + 4, p.w, p.h - 4, 8);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(x - 4, y + 18, 8, 14);
      ctx.fillRect(x + p.w - 4, y + 18, 8, 14);
    } else if (shape === 'hood') {
      roundRect(x + 4, y + 10, p.w - 8, p.h - 10, 8);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(x + p.w / 2, y);
      ctx.lineTo(x + p.w - 4, y + 16);
      ctx.lineTo(x + 4, y + 16);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'pyro') {
      roundRect(x + 2, y + 12, p.w - 4, p.h - 12, 8);
      ctx.fill();
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.moveTo(x + p.w / 2, y - 4);
      ctx.lineTo(x + p.w / 2 + 10, y + 14);
      ctx.lineTo(x + p.w / 2 - 10, y + 14);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'royal') {
      roundRect(x + 3, y + 14, p.w - 6, p.h - 14, 8);
      ctx.fill();
      ctx.fillStyle = '#e2b34d';
      ctx.fillRect(x + 8, y + 4, 4, 8);
      ctx.fillRect(x + p.w / 2 - 2, y, 4, 12);
      ctx.fillRect(x + p.w - 12, y + 4, 4, 8);
    } else {
      roundRect(x, y + 6, p.w, p.h - 6, 8);
      ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + (p.facing > 0 ? p.w - 14 : 4), y + 16, 10, 8);
    }
  }

  function drawWeapon(p) {
    var wpn = weaponOf(p);
    var fx = p.facing;
    var wx = p.x + fx * 14;
    var wy = p.y - 2;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(fx > 0 ? 0.15 : Math.PI - 0.15);
    ctx.fillStyle = wpn.color;
    if (wpn.type === 'projectile') {
      if (wpn.id === 'royalbow' || wpn.id === 'crossbow') {
        ctx.fillRect(-2, -14, 4, 28);
        ctx.strokeStyle = wpn.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      } else if (wpn.id === 'launcher') {
        ctx.fillRect(-8, -6, 22, 12);
      } else {
        ctx.fillRect(-4, -4, 18, 8);
      }
    } else if (wpn.id === 'hammer') {
      ctx.fillRect(-4, -4, 26, 6);
      ctx.fillRect(16, -12, 12, 20);
    } else if (wpn.id === 'blade') {
      ctx.fillRect(-2, -16, 4, 32);
    } else {
      ctx.beginPath();
      ctx.arc(6, 0, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFighter(p) {
    if (p.respawn > 0 && p.respawn % 8 < 4) return;
    var x = p.x - p.w / 2;
    var y = p.y - p.h / 2;
    var wpn = weaponOf(p);
    ctx.save();
    if (p.guardTimer > 0) {
      ctx.strokeStyle = '#e2b34d'; ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(p.x, p.y, 38 + Math.sin(frame * 0.15) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (p.invuln > 0 && Math.floor(Date.now() / 80) % 2) ctx.globalAlpha = 0.5;
    drawBodyShape(p, x, y);
    drawWeapon(p);
    if (p.swing > 0) {
      var hb = meleeHitbox(p, wpn);
      ctx.fillStyle = 'rgba(226,179,77,0.35)';
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
    }
    ctx.restore();
  }

  function drawProjectile(pr) {
    ctx.save();
    ctx.fillStyle = pr.wpn.color;
    ctx.shadowColor = pr.wpn.color;
    ctx.shadowBlur = pr.wpn.id === 'launcher' ? 10 : 4;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, currentMap.bgTop);
    g.addColorStop(1, currentMap.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMachinery();

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(currentMap.name, canvas.width - 12, 20);
    if (onlineMode) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(76,201,255,0.55)';
      ctx.fillText('ONLINE', 12, 20);
    }

    platforms.forEach(drawPlatform);
    projectiles.forEach(drawProjectile);
    players.forEach(drawFighter);
    drawParticles();
    drawAimReticle();
  }

  var remoteInputs = [null, null];
  var remoteInputAt = [0, 0];
  var latestSnapshot = null;
  var onSnapshot = null;
  var SIM_STEP_MS = 1000 / 60;
  var simAccumMs = 0;
  var lastFrameTime = 0;
  var clientSnaps = { from: null, to: null, at: 0 };
  var clientSimAccum = 0;
  var clientLastFrame = 0;
  var CLIENT_INTERP_MS = 24;
  var CLIENT_EXTRAP_MS = 80;
  var INPUT_STALE_MS = 350;

  function runSimSteps(inputs, ts, maxSteps) {
    ts = ts || performance.now();
    if (!lastFrameTime || isNaN(lastFrameTime)) lastFrameTime = ts;
    if (isNaN(simAccumMs)) simAccumMs = 0;
    var dt = Math.min(120, ts - lastFrameTime);
    if (dt < 0) dt = 0;
    lastFrameTime = ts;
    simAccumMs += dt;
    var steps = 0;
    while (simAccumMs >= SIM_STEP_MS && steps < (maxSteps || 4)) {
      simAccumMs -= SIM_STEP_MS;
      simulateFrame(inputs);
      steps++;
    }
  }

  function tickLocal(ts) {
    if (!running) return;
    runSimSteps([gatherInput(0), gatherInput(1)], ts, 4);
    draw();
    updateHud();
    raf = requestAnimationFrame(tickLocal);
  }

  function tickOnlineHost(ts) {
    if (!running) return;
    var inputs = [
      gatherInput(0, remoteInputs[0]),
      gatherInput(1, remoteInputs[1])
    ];
    commitMouseEdge();
    runSimSteps(inputs, ts, 4);
    if (window.VB_ONLINE && window.VB_ONLINE.sendInputNow) window.VB_ONLINE.sendInputNow();
    draw();
    updateHud();
    if (onSnapshot) onSnapshot(getSnapshot());
    raf = requestAnimationFrame(tickOnlineHost);
  }

  function tickOnlineClient(ts) {
    if (!running) return;
    ts = ts || performance.now();
    if (clientSnaps.to) {
      var elapsed = performance.now() - clientSnaps.at;
      var alpha = Math.min(1, elapsed / CLIENT_INTERP_MS);
      var extrap = 0;
      if (alpha >= 1 && elapsed < CLIENT_INTERP_MS + CLIENT_EXTRAP_MS) {
        extrap = elapsed - CLIENT_INTERP_MS;
      }
      applyClientView(clientSnaps.to, clientSnaps.from, alpha, extrap);
    } else if (latestSnapshot) {
      applyClientView(latestSnapshot, null, 1, 0);
    }
    var localInp = gatherOnlineInput();
    commitMouseEdge();
    pendingNetworkInput = localInp;
    runClientLocalSim(ts, localInp);
    tickClientPredictedShots();
    if (window.VB_ONLINE && window.VB_ONLINE.sendInputNow) window.VB_ONLINE.sendInputNow();
    pendingNetworkInput = null;
    draw();
    updateHud();
    raf = requestAnimationFrame(tickOnlineClient);
  }

  function updateHud() {
    var hud = document.getElementById('battleHud');
    if (!hud) return;
    hud.innerHTML = players.map(function (p, i) {
      var pct = Math.max(0, (p.hp / p.maxHp) * 100);
      var specialPct = Math.max(0, 100 - (p.specialCd / 300) * 100);
      return '<div class="bh bh' + (i + 1) + '">' +
        '<span class="bh-name">' + p.char.name + '</span>' +
        '<div class="hp-bar"><div class="hp-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bh-hp">' + Math.ceil(p.hp) + ' / ' + p.maxHp + ' HP</span>' +
        '<span class="bh-stock">' + '♥'.repeat(p.stocks) + '</span>' +
        '<span class="bh-special">' + p.char.specialName + '<i><b style="width:' + specialPct + '%"></b></i></span></div>';
    }).join('');
  }

  function fitCanvas() {
    var maxW = window.innerWidth - 12;
    var maxH = window.innerHeight - 12;
    var scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    canvas.style.width = Math.floor(canvas.width * scale) + 'px';
    canvas.style.height = Math.floor(canvas.height * scale) + 'px';
  }

  function beginMatch(p1Id, p2Id, mapId, endCb, opts) {
    canvas = document.getElementById('c');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    onEnd = endCb;
    onlineMode = !!(opts && opts.online);
    isHost = !!(opts && opts.isHost);
    mySlot = (opts && opts.mySlot != null) ? opts.mySlot : 0;
    remoteInputs = [null, null];
    remoteInputAt = [0, 0];
    latestSnapshot = null;
    clientPredictedShots = [];
    prevMouseDown = false;
    clientSnaps = { from: null, to: null, at: 0 };
    clientSimAccum = 0;
    clientLastFrame = 0;
    simAccumMs = 0;
    lastFrameTime = 0;
    lastSnapSend = 0;
    if (onlineMode && mapId === 'random' && opts.matchId) {
      mapId = window.vbResolveMapId('random', opts.matchId);
    } else if (onlineMode && mapId === 'random') {
      mapId = 'vault';
    }
    loadMap(mapId || 'vault');
    resetMatch(p1Id, p2Id, onlineMode);
    running = true;
    fitCanvas();
    updateHud();
    if (raf) cancelAnimationFrame(raf);
    if (onlineMode) {
      bindMouseControls();
      canvas.style.cursor = 'crosshair';
      raf = requestAnimationFrame(isHost ? tickOnlineHost : tickOnlineClient);
    } else {
      canvas.style.cursor = '';
      raf = requestAnimationFrame(tickLocal);
    }
  }

  function start(p1Id, p2Id, mapId, endCb) {
    beginMatch(p1Id, p2Id, mapId, endCb, null);
  }

  function startOnline(opts) {
    opts = opts || {};
    beginMatch(opts.p1Id, opts.p2Id, opts.mapId, opts.onEnd, {
      online: true,
      isHost: opts.isHost,
      mySlot: opts.mySlot,
      matchId: opts.matchId
    });
  }

  function stop() {
    running = false;
    onlineMode = false;
    isHost = false;
    if (raf) cancelAnimationFrame(raf);
    projectiles = [];
    clientPredictedShots = [];
    if (canvas) canvas.style.cursor = '';
  }

  function setRemoteInput(slot, input) {
    remoteInputs[slot] = input;
    remoteInputAt[slot] = performance.now();
  }

  function receiveSnapshot(snap) {
    if (!snap) return;
    syncMapFromSnapshot(snap);
    if (!clientSnaps.to) clientSnaps.from = snap;
    else clientSnaps.from = clientSnaps.to;
    clientSnaps.to = snap;
    clientSnaps.at = performance.now();
    latestSnapshot = snap;
    if (snap.running === false && running) running = false;
    var meSnap = (snap.players || []).filter(function (sp) { return sp.slot === mySlot; })[0];
    if (meSnap && !isHost) reconcileLocalFromSnap(meSnap);
  }

  function pushHostSnapshot() {
    if (!isHost || !onSnapshot) return;
    var snap = getSnapshot();
    onSnapshot(snap);
    return snap;
  }

  function isRunning() { return running; }

  function winnerSlotFromSnapshot(snap) {
    if (!snap || !snap.players || !snap.players.length) return 0;
    var alive = snap.players.filter(function (p) { return p.stocks > 0; });
    if (alive.length === 1) return alive[0].slot;
    var best = snap.players[0];
    snap.players.forEach(function (p) {
      if (p.stocks > best.stocks || (p.stocks === best.stocks && p.hp > best.hp)) best = p;
    });
    return best.slot;
  }

  function getLocalInput() {
    if (pendingNetworkInput) return pendingNetworkInput;
    return gatherInput(mySlot);
  }

  function isOnline() { return onlineMode; }
  function getMySlot() { return mySlot; }
  function getIsHost() { return isHost; }
  function getFrame() { return frame; }

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) !== -1) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });
  window.addEventListener('resize', function () { if (canvas) fitCanvas(); });

  return {
    start: start,
    startOnline: startOnline,
    stop: stop,
    gatherInput: gatherInput,
    getLocalInput: getLocalInput,
    simulateFrame: simulateFrame,
    getSnapshot: getSnapshot,
    applySnapshot: applySnapshot,
    setRemoteInput: setRemoteInput,
    receiveSnapshot: receiveSnapshot,
    setSnapshotHandler: function (fn) { onSnapshot = fn; },
    isOnline: isOnline,
    getMySlot: getMySlot,
    getIsHost: getIsHost,
    getFrame: getFrame,
    pushHostSnapshot: pushHostSnapshot,
    isRunning: isRunning,
    winnerSlotFromSnapshot: winnerSlotFromSnapshot
  };
})();
