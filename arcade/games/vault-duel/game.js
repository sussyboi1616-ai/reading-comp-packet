(function () {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var CX = W / 2;
  var CY = H / 2 + 10;
  var ARENA_R = 168;
  var WIN_SCORE = 5;

  var keys = {};
  var state = 'play';
  var score = [0, 0];
  var respawnTimer = 0;

  var s1 = document.getElementById('s1');
  var s2 = document.getElementById('s2');
  var overlay = document.getElementById('overlay');
  var winnerEl = document.getElementById('winner');
  var hint = document.getElementById('hint');

  function Player(x, y, color, controls) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = 18;
    this.color = color;
    this.controls = controls;
    this.alive = true;
    this.fall = 0;
  }

  var players = [
    new Player(CX - 60, CY, '#66c0f4', { up: 'w', left: 'a', down: 's', right: 'd' }),
    new Player(CX + 60, CY, '#e2b34d', { up: 'ArrowUp', left: 'ArrowLeft', down: 'ArrowDown', right: 'ArrowRight' })
  ];

  function fitCanvas() {
    var maxW = window.innerWidth - 16;
    var maxH = window.innerHeight - 80;
    var scale = Math.min(maxW / W, maxH / H, 1);
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }

  function pressed(ctrl, key) {
    return !!keys[ctrl[key]];
  }

  function accelerate(p) {
    if (!p.alive) return;
    var ax = 0;
    var ay = 0;
    var c = p.controls;
    if (pressed(c, 'up')) ay -= 1;
    if (pressed(c, 'down')) ay += 1;
    if (pressed(c, 'left')) ax -= 1;
    if (pressed(c, 'right')) ax += 1;
    if (ax || ay) {
      var len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
      p.vx += ax * 0.55;
      p.vy += ay * 0.55;
    }
  }

  function maxSpeed(p, cap) {
    var sp = Math.hypot(p.vx, p.vy);
    if (sp > cap) {
      p.vx = (p.vx / sp) * cap;
      p.vy = (p.vy / sp) * cap;
    }
  }

  function collidePlayers(a, b) {
    if (!a.alive || !b.alive) return;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var dist = Math.hypot(dx, dy) || 0.001;
    var minDist = a.r + b.r;
    if (dist >= minDist) return;
    var nx = dx / dist;
    var ny = dy / dist;
    var overlap = minDist - dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    var dvx = b.vx - a.vx;
    var dvy = b.vy - a.vy;
    var impulse = (dvx * nx + dvy * ny) * 0.9;
    if (impulse < 0) return;
    a.vx += impulse * nx;
    a.vy += impulse * ny;
    b.vx -= impulse * nx;
    b.vy -= impulse * ny;
  }

  function resetPositions() {
    players[0].x = CX - 70;
    players[0].y = CY;
    players[0].vx = 0;
    players[0].vy = 0;
    players[0].alive = true;
    players[0].fall = 0;
    players[1].x = CX + 70;
    players[1].y = CY;
    players[1].vx = 0;
    players[1].vy = 0;
    players[1].alive = true;
    players[1].fall = 0;
  }

  function scorePoint(winner) {
    score[winner]++;
    s1.textContent = String(score[0]);
    s2.textContent = String(score[1]);
    if (score[winner] >= WIN_SCORE) {
      state = 'over';
      winnerEl.textContent = 'Player ' + (winner + 1) + ' wins!';
      overlay.classList.remove('hidden');
      hint.textContent = 'Match over';
      return;
    }
    respawnTimer = 50;
    hint.textContent = 'Player ' + (winner + 1) + ' scored!';
  }

  function rematch() {
    score = [0, 0];
    s1.textContent = '0';
    s2.textContent = '0';
    state = 'play';
    overlay.classList.add('hidden');
    hint.textContent = 'Bump your rival off the platform · first to 5 wins';
    resetPositions();
  }

  function update() {
    if (state !== 'play') return;

    if (respawnTimer > 0) {
      respawnTimer--;
      if (respawnTimer === 0) {
        resetPositions();
        hint.textContent = 'Bump your rival off the platform · first to 5 wins';
      }
      return;
    }

    for (var i = 0; i < players.length; i++) {
      accelerate(players[i]);
      maxSpeed(players[i], 5.2);
      players[i].vx *= 0.9;
      players[i].vy *= 0.9;
    }

    collidePlayers(players[0], players[1]);

    for (var j = 0; j < players.length; j++) {
      var p = players[j];
      if (!p.alive) continue;
      p.x += p.vx;
      p.y += p.vy;
      var dx = p.x - CX;
      var dy = p.y - CY;
      var dist = Math.hypot(dx, dy);
      if (dist > ARENA_R - p.r * 0.35) {
        p.alive = false;
        p.fall = 1;
        var winner = j === 0 ? 1 : 0;
        scorePoint(winner);
      }
    }

    for (var k = 0; k < players.length; k++) {
      if (!players[k].alive) {
        players[k].fall += 0.06;
        players[k].y += players[k].fall * 4;
        players[k].r *= 0.96;
      }
    }
  }

  function drawArena() {
    ctx.fillStyle = '#121828';
    ctx.fillRect(0, 0, W, H);

    var grd = ctx.createRadialGradient(CX, CY, 20, CX, CY, ARENA_R + 30);
    grd.addColorStop(0, '#1a2238');
    grd.addColorStop(1, '#0d1117');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(CX, CY, ARENA_R + 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e2840';
    ctx.beginPath();
    ctx.arc(CX, CY, ARENA_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(226, 179, 77, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, ARENA_R, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPlayer(p) {
    if (p.r < 2) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(-4, -4, p.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    drawArena();
    for (var i = 0; i < players.length; i++) drawPlayer(players[i]);
    if (respawnTimer > 0) {
      ctx.fillStyle = 'rgba(230, 237, 243, 0.85)';
      ctx.font = '600 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Respawning…', CX, CY);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (state === 'over' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      rematch();
    }
  });
  window.addEventListener('keyup', function (e) {
    keys[e.key] = false;
  });
  canvas.addEventListener('click', function () {
    if (state === 'over') rematch();
  });
  window.addEventListener('resize', fitCanvas);

  fitCanvas();
  resetPositions();
  loop();
})();
