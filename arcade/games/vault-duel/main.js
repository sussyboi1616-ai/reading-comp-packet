(function () {
  var D = window.VB_DATA;
  var STORE = window.VB_STORE;
  var BATTLE = window.VB_BATTLE;
  var pickP1 = 'vault';
  var pickP2 = 'blitz';
  var pickMap = 'random';
  var ready = [false, false];
  var lastPicks = ['vault', 'blitz'];
  var lastMap = 'random';
  var lastWinner = 0;
  var settings = loadSettings();
  var ONLINE = window.VB_ONLINE;
  var onlineChar = 'vault';
  var onlineMap = 'random';
  var onlineReady = false;
  var onlineActive = false;
  var onlineBattleStarted = false;
  var lobbyRefreshTimer = null;
  var lastLobbyFetch = 0;
  var lobbyListKey = '';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function charById(id) { return D.CHARACTERS.filter(function (c) { return c.id === id; })[0] || D.CHARACTERS[0]; }
  function unlocked() { return STORE.unlockedChars(); }
  function unlockedChars() { var ids = unlocked(); return D.CHARACTERS.filter(function (c) { return ids.indexOf(c.id) !== -1; }); }

  function loadSettings() {
    try { return Object.assign({ sound: true, shake: true }, JSON.parse(localStorage.getItem('vault-brawl-settings') || '{}')); }
    catch (e) { return { sound: true, shake: true }; }
  }
  function saveSettings() { try { localStorage.setItem('vault-brawl-settings', JSON.stringify(settings)); } catch (e) {} }
  function clickSound(freq) {
    if (!settings.sound || !window.AudioContext) return;
    try {
      var ac = window.__vbAudio || (window.__vbAudio = new AudioContext());
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq || 320; g.gain.setValueAtTime(.035, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .06);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .065);
    } catch (e) {}
  }

  function showScreen(name) {
    if (name === 'menu' && onlineActive) {
      ONLINE.leaveRoom().finally(function () {
        onlineActive = false;
        onlineBattleStarted = false;
      });
    }
    document.querySelectorAll('.screen').forEach(function (el) { el.classList.toggle('active', el.id === 'screen-' + name); });
    if (name !== 'battle') BATTLE.stop();
    if (name === 'menu' || name === 'select' || name === 'shop') refreshCoins();
    if (name === 'select') { ready = [false, false]; renderLobby(); }
    if (name === 'shop') $('shopResult').textContent = '';
    if (name === 'roster') renderRoster();
    if (name === 'settings') renderSettings();
    if (name === 'online-menu') renderOnlineMenu();
    if (name === 'online-lobby') renderOnlineLobby();
    if (name !== 'battle' && name !== 'results') {
      onlineBattleStarted = false;
      $('onlineResultLobbyBtn').style.display = 'none';
      $('rematchBtn').style.display = '';
      $('changeFightersBtn').style.display = '';
    }
  }

  function refreshCoins() {
    ['menuCoins','selectCoins','shopCoins'].forEach(function (id) { if ($(id)) $(id).textContent = STORE.coins(); });
  }

  function fighterModel(c) {
    return '<div class="fighter-platform"></div><div class="fighter-model" style="--fighter:' + esc(c.color) + ';--accent:' + esc(c.accent) + ';--weapon:' + esc(window.vbWeapon(c).color) + '"><span class="fighter-face"></span><span class="fighter-weapon"></span></div>';
  }

  function stat(label, value) { return '<span class="stat"><b>' + esc(value) + '</b><small>' + label + '</small></span>'; }

  function renderPlayer(slot) {
    var n = slot + 1, id = slot ? pickP2 : pickP1, c = charById(id), w = window.vbWeapon(c);
    $('p' + n + 'Name').textContent = c.name;
    $('p' + n + 'Preview').innerHTML = fighterModel(c);
    $('p' + n + 'Meta').innerHTML = stat('HP', c.health || 100) + stat('SPEED', Math.round(c.speed * 10)) + stat('WEAPON', w.name.replace(/^(Vault|Blitz|Anvil|Spark|Gold|Shade|Ember|Crown)\s+/,'')) + '<span class="special-label">SPECIAL · ' + esc(c.specialName) + '</span>';
    var btn = $('p' + n + 'Ready');
    btn.classList.toggle('ready', ready[slot]);
    btn.querySelector('.ready-icon').textContent = ready[slot] ? '✓' : '×';
    btn.querySelector('b').textContent = ready[slot] ? 'READY' : 'NOT READY';
    btn.querySelector('small').textContent = ready[slot] ? 'Fighter locked' : 'Click to lock fighter';
    $('p' + n + 'Bay').classList.toggle('ready', ready[slot]);
  }

  function renderDock() {
    var ids = unlocked();
    $('sharedChars').innerHTML = D.CHARACTERS.map(function (c) {
      var ok = ids.indexOf(c.id) !== -1;
      var cls = 'char-card' + (ok ? '' : ' locked') + (pickP1 === c.id ? ' selected-p1' : '') + (pickP2 === c.id ? ' selected-p2' : '');
      return '<button type="button" class="' + cls + '" data-fighter="' + esc(c.id) + '"' + (ok ? '' : ' disabled') + ' style="--fighter:' + esc(c.color) + ';--accent:' + esc(c.accent) + '">' +
        (c.rarity === 'rare' ? '<span class="rare-tag">RARE</span>' : '') + '<span class="mini-head"></span><span class="char-name">' + esc(ok ? c.name : 'LOCKED') + '</span></button>';
    }).join('');
  }

  function mapOptions() { return [{ id:'random', name:'Random', bgTop:'#25344e', bgBottom:'#080d16', accent:'#f2c14e' }].concat(D.MAPS); }
  function renderMap() {
    var opts = mapOptions(), m = opts.filter(function (x) { return x.id === pickMap; })[0] || opts[0], idx = opts.indexOf(m);
    $('stageName').textContent = m.name;
    $('stageIndex').textContent = m.id === 'random' ? 'Random arena' : (idx + ' / ' + (opts.length - 1));
    $('stagePreview').style.background = 'linear-gradient(180deg,' + m.bgTop + ',' + m.bgBottom + ')';
    $('stagePreview').style.setProperty('--stage-accent', m.accent);
  }

  function renderLobby() {
    renderPlayer(0); renderPlayer(1); renderDock(); renderMap();
    var both = ready[0] && ready[1];
    $('startBattle').disabled = !both;
    $('startBattle').textContent = both ? 'ENTER THE ARENA' : ready[0] || ready[1] ? 'WAITING FOR OTHER PLAYER' : 'WAITING FOR PLAYERS';
  }

  function cycleFighter(slot, dir) {
    if (ready[slot]) return;
    var list = unlockedChars(), current = slot ? pickP2 : pickP1, idx = list.findIndex(function (c) { return c.id === current; });
    idx = (idx + dir + list.length) % list.length;
    if (slot) pickP2 = list[idx].id; else pickP1 = list[idx].id;
    clickSound(slot ? 360 : 280); renderLobby();
  }

  function cycleMap(dir) {
    if (ready[0] || ready[1]) return;
    var opts = mapOptions(), idx = opts.findIndex(function (m) { return m.id === pickMap; });
    pickMap = opts[(idx + dir + opts.length) % opts.length].id;
    clickSound(420); renderMap();
  }

  function toggleReady(slot) {
    ready[slot] = !ready[slot]; clickSound(ready[slot] ? 620 : 220); renderLobby();
  }

  function startFight() {
    if (!(ready[0] && ready[1])) return;
    lastPicks = [pickP1, pickP2]; lastMap = pickMap; clickSound(760);
    document.body.classList.toggle('shake-enabled', !!settings.shake);
    showScreen('battle');
    BATTLE.start(pickP1, pickP2, pickMap, onBattleEnd);
  }

  function onBattleEnd(winnerSlot) {
    lastWinner = winnerSlot;
    var earned = D.WIN_COINS + D.LOSE_COINS, winner = charById(lastPicks[winnerSlot]);
    STORE.addCoins(earned);
    $('resultTitle').textContent = 'Player ' + (winnerSlot + 1) + ' wins!';
    $('winnerPreview').innerHTML = fighterModel(winner);
    $('resultDetail').textContent = winner.name + ' secured the vault · shared stash +' + earned + ' coins';
    showScreen('results'); refreshCoins();
  }

  function renderRoster() {
    $('rosterGrid').innerHTML = D.CHARACTERS.map(function (c) {
      var ok = STORE.isUnlocked(c.id);
      return '<div class="roster-card' + (ok ? '' : ' locked') + '"><div class="char-swatch" style="background:linear-gradient(160deg,' + esc(c.color) + ',' + esc(c.accent) + ')"></div><div><strong>' + esc(c.name) + '</strong><div class="rarity">' + esc(c.rarity.toUpperCase()) + ' · ' + (c.health || 100) + ' HP · ' + esc(window.vbWeapon(c).name) + '</div><p>' + esc(c.desc) + '</p>' + (ok ? '<span class="owned">UNLOCKED</span>' : '<span class="locked-tag">LOCKED</span>') + '</div></div>';
    }).join('');
  }

  function buyChest(kind) {
    var cost = kind === 'rare' ? D.CHEST_RARE_COST : D.CHEST_NORMAL_COST;
    if (!STORE.spendCoins(cost)) { $('shopResult').textContent = 'Not enough coins.'; clickSound(120); return; }
    var res = STORE.rollChest(kind); $('shopResult').textContent = res.message; clickSound(res.type === 'char' ? 820 : 480); refreshCoins();
  }

  function renderSettings() {
    [['soundToggle','sound'],['shakeToggle','shake']].forEach(function (row) {
      var el = $(row[0]), on = settings[row[1]]; el.classList.toggle('active', on); el.textContent = on ? 'ON' : 'OFF';
    });
  }
  function toggleSetting(key) { settings[key] = !settings[key]; saveSettings(); renderSettings(); clickSound(440); }

  function handleOnlineAuthError(err) {
    var msg = (err && err.message) || 'Could not connect online.';
    if (/sign in/i.test(msg)) {
      ONLINE.clearAuth();
      setOnlineSignedIn(false, null);
    }
    return msg;
  }

  function renderOnlineMenu() {
    $('onlineMenuError').textContent = '';
    $('onlineUser').textContent = 'Checking account…';
    $('onlineSigninPanel').hidden = true;
    $('onlineActionsPanel').hidden = true;
    ONLINE.ensureSession({ refreshParent: true }).then(function (profile) {
      setOnlineSignedIn(true, profile);
      refreshPublicLobbies();
    }).catch(function () {
      ONLINE.tryAutoAuth().then(function (profile) {
        if (profile) {
          setOnlineSignedIn(true, profile);
          refreshPublicLobbies();
        } else {
          setOnlineSignedIn(false, null);
        }
      });
    });
  }

  function setOnlineSignedIn(signedIn, profile) {
    $('onlineSigninPanel').hidden = !!signedIn;
    $('onlineActionsPanel').hidden = !signedIn;
    if (signedIn && profile) {
      $('onlineUser').textContent = 'Signed in as ' + profile.username;
      if (!$('onlineRoomName').value) $('onlineRoomName').placeholder = profile.username + '\'s lobby';
    } else {
      $('onlineUser').textContent = 'Not signed in — use THE VAULT login or sign in below';
    }
  }

  function refreshPublicLobbies(force) {
    if (!force && $('onlineLobbyList') && $('onlineLobbyList').dataset.hover === '1') {
      window.__vbLobbyPending = true;
      return;
    }
    var now = Date.now();
    if (!force && now - lastLobbyFetch < 5000) {
      clearTimeout(lobbyRefreshTimer);
      lobbyRefreshTimer = setTimeout(function () { refreshPublicLobbies(true); }, 5000 - (now - lastLobbyFetch));
      return;
    }
    lastLobbyFetch = now;
    window.__vbLobbyPending = false;
    var query = ($('onlineLobbySearch') && $('onlineLobbySearch').value) || '';
    var list = $('onlineLobbyList');
    if (list && !list.querySelector('.public-lobby-row')) {
      list.innerHTML = '<div class="public-lobby-empty">Loading public lobbies…</div>';
    }
    ONLINE.listPublicLobbies(query).then(function (rows) {
      renderPublicLobbies(rows || []);
    }).catch(function (err) {
      $('onlineLobbyList').innerHTML = '<div class="public-lobby-empty">' + esc((err && err.message) || 'Could not load lobbies.') + '</div>';
      lobbyListKey = '';
    });
  }

  function renderPublicLobbies(rows) {
    var key = rows.map(function (row) {
      return [row.room_code, row.player_count, row.map_id, row.room_name].join(':');
    }).join('|');
    if (key === lobbyListKey) return;
    lobbyListKey = key;
    if (!rows.length) {
      $('onlineLobbyList').innerHTML = '<div class="public-lobby-empty">No public lobbies open right now. Create one above.</div>';
      return;
    }
    $('onlineLobbyList').innerHTML = rows.map(function (row) {
      var full = Number(row.player_count || 0) >= Number(row.max_players || 2);
      var label = esc(row.room_name || row.host_username || 'Public lobby');
      var host = esc(row.host_username || 'Host');
      var code = esc(row.room_code || '');
      var map = esc(row.map_id || 'random');
      return '<button type="button" class="public-lobby-row' + (full ? ' full' : '') + '" data-public-code="' + code + '"' + (full ? ' disabled' : '') + '>' +
        '<span class="pl-main"><strong>' + label + '</strong><small>Host · ' + host + ' · ' + map + '</small></span>' +
        '<span class="pl-meta"><b>#' + code + '</b><small>' + Number(row.player_count || 0) + '/2</small></span>' +
        '</button>';
    }).join('');
  }

  function renderOnlineLobby() {
    var state = ONLINE.getLobbyState();
    if (!state.matchId) return;
    if (state.me && state.me.char_id) onlineChar = state.me.char_id;
    if (state.mapId) onlineMap = state.mapId;
    $('onlineRoomCode').textContent = state.roomCode || '----';
    $('onlineMyName').textContent = state.me ? charById(state.me.char_id).name : '—';
    $('onlineMyLabel').textContent = state.isHost ? 'HOST · SLOT 1' : 'GUEST · SLOT 2';
    $('onlineOppName').textContent = state.opponent ? (state.opponent.username || 'Fighter') : 'Waiting…';
    renderOnlineMyFighter();
    renderOnlineOppFighter(state.opponent);
    renderOnlineMap(state.mapId, state.isHost);
    onlineReady = !!(state.me && state.me.ready);
    updateOnlineReadyBtn();
    updateOnlineOppReady(state.opponent);
    var hasOpp = !!state.opponent;
    $('onlineStatusText').textContent = hasOpp ? (state.bothReady ? 'Both ready!' : 'Opponent joined') : 'Waiting for opponent…';
    $('onlineStatusSub').textContent = state.isHost ? 'Share code #' + state.roomCode : 'Connected to #' + state.roomCode;
    var canStart = state.isHost && state.bothReady;
    $('onlineStartBtn').disabled = !canStart;
    $('onlineStartBtn').textContent = !hasOpp ? 'WAITING FOR OPPONENT' : (canStart ? 'START ONLINE MATCH' : 'WAITING FOR READY');
    $('onlineMapPrev').disabled = !state.isHost;
    $('onlineMapNext').disabled = !state.isHost;
    $('onlineLobbyError').textContent = '';
  }

  function renderOnlineMyFighter() {
    var c = charById(onlineChar);
    $('onlineMyPreview').innerHTML = fighterModel(c);
    var w = window.vbWeapon(c);
    $('onlineMyMeta').innerHTML = stat('HP', c.health || 100) + stat('SPEED', Math.round(c.speed * 10)) + stat('WEAPON', w.name.replace(/^(Vault|Blitz|Anvil|Spark|Gold|Shade|Ember|Crown)\s+/,'')) + '<span class="special-label">SPECIAL · ' + esc(c.specialName) + '</span>';
  }

  function renderOnlineOppFighter(opponent) {
    if (!opponent) {
      $('onlineOppPreview').innerHTML = '<div class="waiting-slot">?</div>';
      $('onlineOppMeta').innerHTML = '<span class="special-label">Waiting for challenger…</span>';
      return;
    }
    var c = charById(opponent.char_id);
    $('onlineOppPreview').innerHTML = fighterModel(c);
    var w = window.vbWeapon(c);
    $('onlineOppMeta').innerHTML = stat('HP', c.health || 100) + stat('SPEED', Math.round(c.speed * 10)) + stat('WEAPON', w.name.replace(/^(Vault|Blitz|Anvil|Spark|Gold|Shade|Ember|Crown)\s+/,'')) + '<span class="special-label">SPECIAL · ' + esc(c.specialName) + '</span>';
  }

  function renderOnlineMap(mapId, isHost) {
    var opts = mapOptions();
    onlineMap = mapId || onlineMap || 'random';
    var m = opts.filter(function (x) { return x.id === onlineMap; })[0] || opts[0];
    var idx = opts.indexOf(m);
    $('onlineStageName').textContent = m.name;
    $('onlineStageIndex').textContent = m.id === 'random' ? 'Random arena' : (idx + ' / ' + (opts.length - 1));
    $('onlineStagePreview').style.background = 'linear-gradient(180deg,' + m.bgTop + ',' + m.bgBottom + ')';
    $('onlineStagePreview').style.setProperty('--stage-accent', m.accent);
    $('onlineStagePreview').style.opacity = isHost ? '1' : '0.75';
  }

  function updateOnlineReadyBtn() {
    var btn = $('onlineReadyBtn');
    btn.classList.toggle('ready', onlineReady);
    btn.querySelector('.ready-icon').textContent = onlineReady ? '✓' : '×';
    btn.querySelector('b').textContent = onlineReady ? 'READY' : 'NOT READY';
    btn.querySelector('small').textContent = onlineReady ? 'Waiting for start' : 'Lock fighter to ready up';
  }

  function updateOnlineOppReady(opponent) {
    var btn = $('onlineOppReady');
    var ready = !!(opponent && opponent.ready);
    btn.classList.toggle('ready', ready);
    btn.querySelector('.ready-icon').textContent = ready ? '✓' : '×';
    btn.querySelector('b').textContent = ready ? 'READY' : 'NOT READY';
    btn.querySelector('small').textContent = opponent ? (ready ? 'Locked in' : 'Choosing fighter…') : '—';
  }

  function cycleOnlineChar(dir) {
    if (onlineReady) return;
    var list = unlockedChars();
    var idx = list.findIndex(function (c) { return c.id === onlineChar; });
    idx = (idx + dir + list.length) % list.length;
    onlineChar = list[idx].id;
    clickSound(320);
    renderOnlineMyFighter();
    ONLINE.setCharacter(onlineChar).catch(function (err) {
      $('onlineLobbyError').textContent = (err && err.message) || 'Could not update fighter.';
    });
  }

  function cycleOnlineMap(dir) {
    var state = ONLINE.getLobbyState();
    if (!state.isHost || onlineReady) return;
    var opts = mapOptions();
    var idx = opts.findIndex(function (m) { return m.id === onlineMap; });
    onlineMap = opts[(idx + dir + opts.length) % opts.length].id;
    clickSound(420);
    ONLINE.setMap(onlineMap);
    renderOnlineMap(onlineMap, true);
  }

  function toggleOnlineReady() {
    onlineReady = !onlineReady;
    clickSound(onlineReady ? 620 : 220);
    updateOnlineReadyBtn();
    ONLINE.setReady(onlineReady).catch(function (err) {
      onlineReady = !onlineReady;
      updateOnlineReadyBtn();
      $('onlineLobbyError').textContent = (err && err.message) || 'Could not update ready state.';
    });
  }

  function startOnlineFlow() {
    onlineActive = true;
    var state = ONLINE.getLobbyState();
    onlineChar = (state.me && state.me.char_id) || pickP1;
    onlineMap = (state.mapId) || 'random';
    onlineReady = !!(state.me && state.me.ready);
    showScreen('online-lobby');
  }

  function onOnlineBattleEnd(winner, winnerPlayer) {
    if (!onlineBattleStarted && !BATTLE.isOnline()) return;
    onlineBattleStarted = false;
    var earned = D.WIN_COINS + D.LOSE_COINS;
    var mySlot = ONLINE.getLobbyState().mySlot;
    var iWon = winner && winner.slot === mySlot;
    STORE.addCoins(earned);
    var winnerChar = charById(winner ? winner.char_id : (winnerPlayer && winnerPlayer.char_id) || 'vault');
    $('resultTitle').textContent = iWon ? 'Victory!' : 'Defeat';
    $('winnerPreview').innerHTML = fighterModel(winnerChar);
    $('resultDetail').textContent = winnerChar.name + ' wins the online brawl · +' + earned + ' coins';
    $('rematchBtn').style.display = 'none';
    $('changeFightersBtn').style.display = 'none';
    $('onlineResultLobbyBtn').style.display = '';
    showScreen('results');
    refreshCoins();
  }

  ONLINE.setHandlers({
    onAuthChange: function (profile) {
      setOnlineSignedIn(!!profile, profile);
      if (profile && $('screen-online-menu').classList.contains('active')) {
        refreshPublicLobbies(true);
      }
    },
    onLobbyChange: function () {
      if ($('screen-online-lobby').classList.contains('active')) renderOnlineLobby();
    },
    onMatchStart: function (state) {
      if (onlineBattleStarted) return;
      onlineBattleStarted = true;
      document.body.classList.toggle('shake-enabled', !!settings.shake);
      showScreen('battle');
      ONLINE.beginOnlineBattle(state, function (winnerSlot, winnerPlayer) {
        var winner = ONLINE.getLobbyState().players.filter(function (p) { return p.slot === winnerSlot; })[0] || winnerPlayer;
        onOnlineBattleEnd(winner, winnerPlayer);
      });
    },
    onMatchEnd: function (winnerSlot) {
      if (!onlineBattleStarted) return;
      BATTLE.stop();
      var winner = ONLINE.getLobbyState().players.filter(function (p) { return p.slot === winnerSlot; })[0];
      onOnlineBattleEnd(winner);
    },
    onError: function (msg) {
      if ($('screen-online-menu').classList.contains('active')) $('onlineMenuError').textContent = msg;
      if ($('screen-online-lobby').classList.contains('active')) $('onlineLobbyError').textContent = msg;
    }
  });

  document.querySelectorAll('[data-go]').forEach(function (btn) { btn.addEventListener('click', function () { clickSound(300); showScreen(btn.getAttribute('data-go')); }); });
  document.querySelectorAll('[data-cycle]').forEach(function (btn) { btn.addEventListener('click', function () { cycleFighter(Number(btn.dataset.cycle) - 1, Number(btn.dataset.dir)); }); });
  document.querySelectorAll('[data-map-cycle]').forEach(function (btn) { btn.addEventListener('click', function () { cycleMap(Number(btn.dataset.mapCycle)); }); });
  $('sharedChars').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fighter]'); if (!btn || btn.disabled) return;
    var target = ready[0] && !ready[1] ? 1 : 0;
    if (ready[target]) return;
    if (target) pickP2 = btn.dataset.fighter; else pickP1 = btn.dataset.fighter;
    clickSound(target ? 360 : 280); renderLobby();
  });
  $('p1Ready').addEventListener('click', function () { toggleReady(0); });
  $('p2Ready').addEventListener('click', function () { toggleReady(1); });
  $('startBattle').addEventListener('click', startFight);
  $('buyNormal').addEventListener('click', function () { buyChest('normal'); });
  $('buyRare').addEventListener('click', function () { buyChest('rare'); });
  $('soundToggle').addEventListener('click', function () { toggleSetting('sound'); });
  $('shakeToggle').addEventListener('click', function () { toggleSetting('shake'); });
  $('battleMenuBtn').addEventListener('click', function () {
    if (onlineActive && BATTLE.isOnline()) {
      BATTLE.stop();
      ONLINE.leaveRoom().finally(function () {
        onlineActive = false;
        showScreen('online-lobby');
      });
      return;
    }
    showScreen('select');
  });
  $('changeFightersBtn').addEventListener('click', function () { showScreen('select'); });
  $('rematchBtn').addEventListener('click', function () { pickP1 = lastPicks[0]; pickP2 = lastPicks[1]; pickMap = lastMap; ready = [true,true]; startFight(); });

  $('onlineCreateBtn').addEventListener('click', function () {
    clickSound(420);
    $('onlineMenuError').textContent = 'Creating room…';
    ONLINE.createRoom({
      isPublic: !!$('onlinePublicCheck').checked,
      roomName: $('onlineRoomName').value
    }).then(function () {
      startOnlineFlow();
    }).catch(function (err) {
      $('onlineMenuError').textContent = handleOnlineAuthError(err);
    });
  });
  $('onlineJoinBtn').addEventListener('click', function () {
    clickSound(420);
    $('onlineMenuError').textContent = 'Joining…';
    ONLINE.joinRoom($('onlineJoinCode').value).then(function () {
      startOnlineFlow();
    }).catch(function (err) {
      $('onlineMenuError').textContent = handleOnlineAuthError(err);
      refreshPublicLobbies();
    });
  });
  $('onlineSigninBtn').addEventListener('click', function () {
    clickSound(320);
    $('onlineMenuError').textContent = 'Signing in…';
    ONLINE.signIn($('onlineAuthUser').value, $('onlineAuthPass').value).then(function (profile) {
      $('onlineMenuError').textContent = '';
      $('onlineAuthPass').value = '';
      setOnlineSignedIn(true, profile);
      refreshPublicLobbies();
    }).catch(function (err) {
      $('onlineMenuError').textContent = (err && err.message) || 'Sign in failed.';
    });
  });
  $('onlineAuthPass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('onlineSigninBtn').click();
  });
  $('onlineRetryAuthBtn').addEventListener('click', function () {
    clickSound(280);
    $('onlineMenuError').textContent = 'Retrying…';
    ONLINE.ensureSession({ refreshParent: true }).then(function (profile) {
      $('onlineMenuError').textContent = '';
      setOnlineSignedIn(true, profile);
      refreshPublicLobbies();
    }).catch(function () {
      ONLINE.tryAutoAuth().then(function (profile) {
        $('onlineMenuError').textContent = profile ? '' : 'Auto sign-in failed. Use the form below.';
        setOnlineSignedIn(!!profile, profile);
        if (profile) refreshPublicLobbies();
      });
    });
  });
  $('onlineLobbyRefresh').addEventListener('click', function () {
    clickSound(280);
    refreshPublicLobbies(true);
  });
  $('onlineLobbySearch').addEventListener('input', function () {
    clearTimeout(window.__vbLobbySearchTimer);
    window.__vbLobbySearchTimer = setTimeout(function () { refreshPublicLobbies(true); }, 700);
  });
  if ($('onlineLobbyList')) {
    $('onlineLobbyList').addEventListener('mouseenter', function () {
      $('onlineLobbyList').dataset.hover = '1';
    });
    $('onlineLobbyList').addEventListener('mouseleave', function () {
      $('onlineLobbyList').dataset.hover = '0';
      if (window.__vbLobbyPending) refreshPublicLobbies(true);
    });
  }
  $('onlineLobbyList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-public-code]');
    if (!btn || btn.disabled) return;
    clickSound(420);
    $('onlineJoinCode').value = btn.getAttribute('data-public-code') || '';
    $('onlineMenuError').textContent = 'Joining…';
    ONLINE.joinRoom(btn.getAttribute('data-public-code')).then(function () {
      startOnlineFlow();
    }).catch(function (err) {
      $('onlineMenuError').textContent = handleOnlineAuthError(err);
      refreshPublicLobbies();
    });
  });
  $('onlineJoinCode').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('onlineJoinBtn').click();
  });
  $('onlineLeaveBtn').addEventListener('click', function () {
    clickSound(220);
    ONLINE.leaveRoom().then(function () {
      onlineActive = false;
      showScreen('online-menu');
    });
  });
  $('onlineCharPrev').addEventListener('click', function () { cycleOnlineChar(-1); });
  $('onlineCharNext').addEventListener('click', function () { cycleOnlineChar(1); });
  $('onlineMapPrev').addEventListener('click', function () { cycleOnlineMap(-1); });
  $('onlineMapNext').addEventListener('click', function () { cycleOnlineMap(1); });
  $('onlineReadyBtn').addEventListener('click', toggleOnlineReady);
  $('onlineStartBtn').addEventListener('click', function () {
    clickSound(760);
    $('onlineLobbyError').textContent = 'Starting…';
    ONLINE.startMatch().catch(function (err) {
      $('onlineLobbyError').textContent = (err && err.message) || 'Could not start match.';
    });
  });
  $('onlineResultLobbyBtn').addEventListener('click', function () {
    onlineReady = false;
    onlineBattleStarted = false;
    var state = ONLINE.getLobbyState();
    var done = state.isHost
      ? ONLINE.resetMatchToLobby().then(function () { return ONLINE.setReady(false); })
      : ONLINE.setReady(false);
    done.finally(function () {
      showScreen('online-lobby');
    });
  });

  window.addEventListener('keydown', function (e) {
    if ($('screen-select').classList.contains('active')) {
      if (e.key === 'a' || e.key === 'A') cycleFighter(0,-1);
      if (e.key === 'd' || e.key === 'D') cycleFighter(0,1);
      if (e.key === 'ArrowLeft') cycleFighter(1,-1);
      if (e.key === 'ArrowRight') cycleFighter(1,1);
    }
    if (e.key === 'Escape' && $('screen-battle').classList.contains('active')) {
      if (onlineActive && BATTLE.isOnline()) return;
      showScreen('select');
    }
  });

  showScreen('menu');
})();
