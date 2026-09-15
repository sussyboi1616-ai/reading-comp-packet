window.VB_ONLINE = (function () {
  var SUPABASE_URL = 'https://wirgrmkyubuvkiuweunp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcmdybWt5dWJ1dmtpdXdldW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NTc0MjMsImV4cCI6MjEwMzUzMzQyM30.wloysi8MI42W_2c2NOYxi_B9Cpx0B-bII3gKFQDRqyY';
  var EMAIL_DOMAIN = '@vault.internal';

  var sb = null;
  var profile = null;
  var matchId = null;
  var matchRow = null;
  var players = [];
  var mySlot = 0;
  var isHost = false;
  var matchChannel = null;
  var dbChannel = null;
  var heartbeatTimer = null;
  var inputTimer = null;
  var onLobbyChange = null;
  var onMatchStart = null;
  var onMatchEnd = null;
  var onError = null;
  var onAuthReady = null;
  var onAuthChange = null;
  var remoteInputs = [null, null];
  var lastRemoteSeen = [0, 0];
  var lastSnapshotAt = 0;
  var lobbyEmitTimer = null;
  var battleActive = false;

  function emitError(msg) {
    if (onError) onError(msg);
  }

  function emailFromUsername(username) {
    return String(username || '').trim().toLowerCase() + EMAIL_DOMAIN;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function getCreateClient() {
    var s = window.supabase;
    if (s && typeof s.createClient === 'function') return s.createClient;
    if (s && s.default && typeof s.default.createClient === 'function') return s.default.createClient;
    return null;
  }

  function requestParentProfile() {
    return new Promise(function (resolve) {
      var done = false;
      function finish(data) {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMsg);
        resolve(data || null);
      }
      function onMsg(e) {
        if (!e.data || e.data.type !== 'vault-profile') return;
        finish(e.data);
      }
      window.addEventListener('message', onMsg);
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'vault-request-profile' }, '*');
        }
      } catch (err) {}
      setTimeout(function () { finish(null); }, 1200);
    });
  }

  function requestParentAuth() {
    return new Promise(function (resolve, reject) {
      var done = false;
      function finish(ok, err) {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMsg);
        if (err) reject(err);
        else resolve(ok);
      }
      function onMsg(e) {
        if (!e.data || e.data.type !== 'vault-auth') return;
        if (e.data.error) finish(null, new Error('No session from THE VAULT.'));
        else finish(e.data);
      }
      window.addEventListener('message', onMsg);
      var inFrame = false;
      try {
        inFrame = window.parent && window.parent !== window;
        if (inFrame) window.parent.postMessage({ type: 'vault-request-auth' }, '*');
      } catch (err) {}
      if (!inFrame) finish(null, new Error('No session from THE VAULT.'));
      setTimeout(function () {
        finish(null, new Error('No session from THE VAULT.'));
      }, 2500);
    });
  }

  function iframeAuthStorage() {
    var ss = null;
    try { ss = sessionStorage; } catch (e) {}
    try {
      var ls = localStorage;
      if (ls) {
        var doomed = [];
        for (var i = 0; i < ls.length; i++) {
          var k = ls.key(i);
          if (!k) continue;
          if (k === 'the-vault-remember' || k === 'the-vault-auth' || k === 'the-vault-guest' ||
              k.indexOf('the-vault-ls:') === 0 || k.indexOf('sb-') === 0) doomed.push(k);
        }
        doomed.forEach(function (k) { ls.removeItem(k); });
      }
    } catch (e) {}
    return {
      getItem: function (k) {
        try { return ss ? ss.getItem(k) : null; } catch (e) { return null; }
      },
      setItem: function (k, v) {
        try { if (ss) ss.setItem(k, v); } catch (e) {}
      },
      removeItem: function (k) {
        try { if (ss) ss.removeItem(k); } catch (e) {}
      }
    };
  }

  function ensureClient() {
    if (sb) return Promise.resolve(sb);
    return loadScript('/supabase.js').then(function () {
      var createClient = getCreateClient();
      if (!createClient) throw new Error('Supabase client unavailable');
      sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: 'the-vault-auth',
          storage: iframeAuthStorage()
        }
      });
      return sb;
    });
  }

  function rpcCall(name, args) {
    return Promise.resolve(sb.rpc(name, args));
  }

  function loadProfileFromDb(userId, fallbackUsername) {
    return sb.from('profiles').select('id, username').eq('id', userId).maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      var row = res.data;
      profile = {
        id: userId,
        username: (row && row.username) || fallbackUsername || 'Player'
      };
      if (onAuthReady) onAuthReady(profile);
      if (onAuthChange) onAuthChange(profile);
      return profile;
    });
  }

  function setSessionFromParent(authMsg) {
    return sb.auth.setSession({
      access_token: authMsg.access_token,
      refresh_token: authMsg.refresh_token
    }).then(function (setWrap) {
      if (setWrap.error) throw setWrap.error;
      profile = {
        id: authMsg.id,
        username: authMsg.username || 'Player'
      };
      if (onAuthReady) onAuthReady(profile);
      if (onAuthChange) onAuthChange(profile);
      return profile;
    });
  }

  function tryAutoAuth() {
    return ensureClient().then(function () {
      return sb.auth.getSession();
    }).then(function (wrap) {
      if (wrap.data.session) {
        return requestParentProfile().then(function (parentProfile) {
          return sb.auth.getUser().then(function (userWrap) {
            var user = userWrap.data.user;
            if (!user) return null;
            return loadProfileFromDb(
              user.id,
              (parentProfile && parentProfile.username) || (user.user_metadata && user.user_metadata.username)
            );
          });
        });
      }
      return requestParentAuth().then(function (authMsg) {
        return setSessionFromParent(authMsg);
      }).catch(function () {
        return null;
      });
    }).catch(function () {
      return null;
    });
  }

  function isInVaultFrame() {
    try { return !!(window.parent && window.parent !== window); } catch (e) { return false; }
  }

  function clearAuth() {
    profile = null;
    if (onAuthChange) onAuthChange(null);
  }

  function ensureSession(opts) {
    opts = opts || {};
    return ensureClient().then(function () {
      if (opts.refreshParent && isInVaultFrame()) {
        return requestParentAuth().then(function (authMsg) {
          return setSessionFromParent(authMsg);
        }).catch(function () {
          return sb.auth.getSession();
        });
      }
      return sb.auth.getSession();
    }).then(function (wrap) {
      var sess = wrap && wrap.data && wrap.data.session;
      if (wrap && !wrap.data) sess = null;
      if (typeof wrap === 'object' && wrap.id && wrap.username) return wrap;
      if (sess) {
        if (profile && profile.id) return profile;
        return sb.auth.getUser().then(function (userWrap) {
          var user = userWrap.data.user;
          if (!user) throw new Error('Sign in to play online.');
          return loadProfileFromDb(user.id);
        });
      }
      clearAuth();
      return tryAutoAuth().then(function (p) {
        if (!p) throw new Error('Sign in to play online.');
        return sb.auth.getSession().then(function (check) {
          if (!check.data.session) {
            clearAuth();
            throw new Error('Sign in to play online.');
          }
          return p;
        });
      });
    });
  }

  function signIn(username, password) {
    username = String(username || '').trim();
    password = String(password || '');
    if (!username || !password) return Promise.reject(new Error('Enter a username and password.'));
    return ensureClient().then(function () {
      return sb.auth.signInWithPassword({
        email: emailFromUsername(username),
        password: password
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      if (!res.data.session) throw new Error('Sign in failed.');
      return loadProfileFromDb(res.data.user.id, username);
    }).catch(function (err) {
      var msg = (err && err.message) || 'Sign in failed.';
      if (/invalid login/i.test(msg)) msg = 'Wrong username or password.';
      throw new Error(msg);
    });
  }

  function initSupabase() {
    return ensureSession({ refreshParent: isInVaultFrame() });
  }

  function refreshPlayers() {
    if (!matchId || !sb) return Promise.resolve();
    return sb.from('arcade_match_players')
      .select('*')
      .eq('match_id', matchId)
      .order('slot')
      .then(function (res) {
        if (res.error) throw res.error;
        players = res.data || [];
        mySlot = 0;
        isHost = matchRow && matchRow.host_id === profile.id;
        for (var i = 0; i < players.length; i++) {
          if (players[i].profile_id === profile.id) mySlot = players[i].slot;
        }
        emitLobbyChange();
      });
  }

  function refreshMatch() {
    if (!matchId || !sb) return Promise.resolve();
    return sb.from('arcade_matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        matchRow = res.data;
        return refreshPlayers();
      });
  }

  function emitLobbyChange() {
    if (!onLobbyChange) return;
    clearTimeout(lobbyEmitTimer);
    lobbyEmitTimer = setTimeout(function () {
      onLobbyChange(getLobbyState());
    }, 120);
  }

  function getLobbyState() {
    var opponent = null;
    for (var i = 0; i < players.length; i++) {
      if (players[i].profile_id !== profile.id) opponent = players[i];
    }
    var me = players.filter(function (p) { return p.profile_id === profile.id; })[0] || null;
    var bothReady = players.length >= 2 && players.every(function (p) { return p.ready; });
    return {
      matchId: matchId,
      roomCode: matchRow ? matchRow.room_code : '',
      mapId: matchRow ? matchRow.map_id : 'random',
      status: matchRow ? matchRow.status : 'lobby',
      isPublic: !!(matchRow && matchRow.is_public),
      roomName: matchRow ? matchRow.room_name : '',
      isHost: isHost,
      mySlot: mySlot,
      me: me,
      opponent: opponent,
      players: players.slice(),
      bothReady: bothReady
    };
  }

  function listPublicLobbies(query) {
    return initSupabase().then(function () {
      return rpcCall('cleanup_stale_arcade_matches').catch(function () { return { data: 0 }; });
    }).then(function () {
      return rpcCall('list_public_arcade_lobbies', {
        p_game_id: 'vault-duel',
        p_query: String(query || '').trim()
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function whenMatchChannelReady() {
    return new Promise(function (resolve) {
      if (!matchChannel) {
        resolve();
        return;
      }
      if (matchChannel.state === 'joined') {
        resolve();
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(); }
      }, 2500);
      matchChannel.subscribe(function (status) {
        if (status === 'SUBSCRIBED' && !done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  function subscribeMatchChannel() {
    if (!sb || !matchId) return;
    if (matchChannel) {
      sb.removeChannel(matchChannel);
      matchChannel = null;
    }
    matchChannel = sb.channel('arcade-match:' + matchId, { config: { broadcast: { self: false } } });
    matchChannel.on('broadcast', { event: 'input' }, function (msg) {
      var payload = msg.payload || {};
      if (payload.slot == null || !payload.input) return;
      remoteInputs[payload.slot] = payload.input;
      lastRemoteSeen[payload.slot] = Date.now();
      window.VB_BATTLE.setRemoteInput(payload.slot, payload.input);
    });
    matchChannel.on('broadcast', { event: 'snapshot' }, function (msg) {
      if (window.VB_BATTLE.getIsHost()) return;
      var wasRunning = window.VB_BATTLE.isRunning();
      window.VB_BATTLE.receiveSnapshot(msg.payload);
      lastSnapshotAt = Date.now();
      var snap = msg.payload || {};
      if (wasRunning && snap.running === false && onMatchEnd) {
        onMatchEnd(window.VB_BATTLE.winnerSlotFromSnapshot(snap));
      }
    });
    matchChannel.on('broadcast', { event: 'end' }, function (msg) {
      var payload = msg.payload || {};
      if (onMatchEnd) onMatchEnd(payload.winnerSlot, payload.winnerId);
    });
    matchChannel.subscribe();
  }

  function subscribeDbChanges() {
    if (!sb || !matchId) return;
    if (dbChannel) {
      sb.removeChannel(dbChannel);
      dbChannel = null;
    }
    dbChannel = sb.channel('arcade-db:' + matchId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arcade_match_players', filter: 'match_id=eq.' + matchId }, function () {
        refreshPlayers();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'arcade_matches', filter: 'id=eq.' + matchId }, function (payload) {
        matchRow = payload.new;
        if (matchRow.status === 'playing' && onMatchStart) {
          onMatchStart(getLobbyState());
        }
        if (matchRow.status === 'finished' || matchRow.status === 'cancelled') {
          if (battleActive && window.VB_BATTLE && window.VB_BATTLE.isRunning()) {
            window.VB_BATTLE.stop();
            stopInputLoop();
            battleActive = false;
            if (onMatchEnd) {
              var winner = players.filter(function (p) { return p.profile_id === matchRow.winner_id; })[0];
              onMatchEnd(winner ? winner.slot : (1 - mySlot));
            }
          }
          emitLobbyChange();
        }
        if (matchRow.status === 'lobby') {
          emitLobbyChange();
        }
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED' && matchRow && matchRow.status === 'playing' && onMatchStart) {
          onMatchStart(getLobbyState());
        }
      });
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(function () {
      if (!matchId || !sb) return;
      rpcCall('touch_arcade_match_player', { p_match_id: matchId }).catch(function () {});
    }, 8000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function finishMatchRpc(winnerId) {
    if (!sb || !matchId) return Promise.resolve();
    return rpcCall('finish_arcade_match', {
      p_match_id: matchId,
      p_winner_id: winnerId || null
    }).catch(function () {});
  }

  function startInputLoop() {
    stopInputLoop();
    lastRemoteSeen = [0, 0];
    lastSnapshotAt = Date.now();
    inputTimer = setInterval(function () {
      if (!matchChannel || !window.VB_BATTLE.isOnline() || matchChannel.state !== 'joined') return;
      sendInputNow();
      var now = Date.now();
      if (window.VB_BATTLE.getIsHost()) {
        for (var s = 0; s < 2; s++) {
          if (s === mySlot) continue;
          if (lastRemoteSeen[s] > 0 && now - lastRemoteSeen[s] > 12000 && players.length >= 2) {
            endBattleForfeit(mySlot);
            return;
          }
        }
      } else if (lastSnapshotAt > 0 && now - lastSnapshotAt > 12000) {
        endBattleForfeit(1 - mySlot);
      }
    }, 1000 / 60);
  }

  function sendInputNow() {
    if (!matchChannel || !window.VB_BATTLE.isOnline() || matchChannel.state !== 'joined') return;
    var input = window.VB_BATTLE.getLocalInput();
    try {
      matchChannel.send({
        type: 'broadcast',
        event: 'input',
        payload: { slot: mySlot, frame: window.VB_BATTLE.getFrame(), input: input }
      });
    } catch (e) {}
  }

  function endBattleForfeit(winnerSlot) {
    if (!battleActive) return;
    battleActive = false;
    window.VB_BATTLE.stop();
    stopInputLoop();
    var winner = players.filter(function (p) { return p.slot === winnerSlot; })[0];
    finishMatchRpc(winner ? winner.profile_id : null);
    if (matchChannel) {
      matchChannel.send({
        type: 'broadcast',
        event: 'end',
        payload: { winnerSlot: winnerSlot, winnerId: winner ? winner.profile_id : null }
      });
    }
    if (onMatchEnd) onMatchEnd(winnerSlot);
  }

  function stopInputLoop() {
    if (inputTimer) clearInterval(inputTimer);
    inputTimer = null;
  }

  function createRoom(opts) {
    opts = opts || {};
    return ensureSession({ refreshParent: true }).then(function () {
      return rpcCall('create_arcade_match', {
        p_game_id: 'vault-duel',
        p_is_public: !!opts.isPublic,
        p_room_name: String(opts.roomName || '').trim()
      });
    }).then(function (res) {
      if (res.error) throw res.error;
      var row = (res.data && res.data[0]) || {};
      matchId = row.match_id;
      return refreshMatch();
    }).then(function () {
      subscribeMatchChannel();
      subscribeDbChanges();
      startHeartbeat();
      return getLobbyState();
    }).catch(function (err) {
      var msg = (err && err.message) || 'Could not create room.';
      if (/sign in required/i.test(msg)) msg = 'Sign in to play online.';
      emitError(msg);
      throw new Error(msg);
    });
  }

  function joinRoom(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return Promise.reject(new Error('Enter a room code.'));
    return ensureSession({ refreshParent: true }).then(function () {
      return rpcCall('join_arcade_match', { p_room_code: code });
    }).then(function (res) {
      if (res.error) throw res.error;
      matchId = res.data;
      return refreshMatch();
    }).then(function () {
      subscribeMatchChannel();
      subscribeDbChanges();
      startHeartbeat();
      return getLobbyState();
    }).catch(function (err) {
      var msg = (err && err.message) || 'Could not join room.';
      if (/sign in required/i.test(msg)) msg = 'Sign in to play online.';
      emitError(msg);
      throw new Error(msg);
    });
  }

  function setCharacter(charId) {
    if (!matchId || !sb) return Promise.resolve();
    return rpcCall('update_arcade_match_player', {
      p_match_id: matchId,
      p_char_id: charId,
      p_ready: null
    }).then(function (res) {
      if (res.error) throw res.error;
      return refreshPlayers();
    });
  }

  function setReady(ready) {
    if (!matchId || !sb) return Promise.resolve();
    return rpcCall('update_arcade_match_player', {
      p_match_id: matchId,
      p_char_id: null,
      p_ready: !!ready
    }).then(function (res) {
      if (res.error) throw res.error;
      return refreshPlayers();
    });
  }

  function setMap(mapId) {
    if (!matchId || !sb || !isHost) return Promise.resolve();
    mapId = mapId || 'random';
    return rpcCall('set_arcade_match_map', {
      p_match_id: matchId,
      p_map_id: mapId
    }).then(function (res) {
      if (res.error) throw res.error;
      matchRow = Object.assign({}, matchRow, { map_id: mapId });
      emitLobbyChange();
    });
  }

  function resetMatchToLobby() {
    if (!matchId || !sb || !isHost) return Promise.resolve();
    return rpcCall('reset_arcade_match_to_lobby', { p_match_id: matchId }).then(function (res) {
      if (res.error) throw res.error;
      battleActive = false;
      return refreshMatch();
    });
  }

  function resolveMapId(mapId) {
    if (mapId && mapId !== 'random') return mapId;
    if (matchRow && matchRow.map_id && matchRow.map_id !== 'random') return matchRow.map_id;
    return window.vbResolveMapId('random', matchId || 'vault');
  }

  function pickRandomMapId() {
    var maps = window.VB_DATA.MAPS;
    return maps[Math.floor(Math.random() * maps.length)].id;
  }

  function startMatch() {
    if (!matchId || !sb || !isHost) return Promise.reject(new Error('Only the host can start.'));
    var mapId = (matchRow && matchRow.map_id) || 'random';
    if (mapId === 'random') mapId = pickRandomMapId();
    return rpcCall('start_arcade_match', { p_match_id: matchId, p_map_id: mapId }).then(function (res) {
      if (res.error) throw res.error;
      matchRow = Object.assign({}, matchRow || {}, { map_id: mapId, status: 'playing' });
      return refreshMatch();
    }).then(function () {
      if (matchRow && matchRow.status === 'playing' && onMatchStart) {
        onMatchStart(getLobbyState());
      }
    });
  }

  function beginOnlineBattle(state, onBattleEnd) {
    return whenMatchChannelReady().then(function () {
      return refreshMatch();
    }).then(function () {
      var fresh = getLobbyState();
      var p1 = players.filter(function (p) { return p.slot === 0; })[0];
      var p2 = players.filter(function (p) { return p.slot === 1; })[0];
      if (!p1 || !p2) return;

      var mapId = resolveMapId(fresh.mapId || state.mapId || 'random');
      battleActive = true;
      lastRemoteSeen = [0, 0];
      lastSnapshotAt = Date.now();
      var BATTLE = window.VB_BATTLE;
      BATTLE.setSnapshotHandler(function (snap) {
        if (matchChannel && isHost && matchChannel.state === 'joined') {
          matchChannel.send({ type: 'broadcast', event: 'snapshot', payload: snap });
        }
      });

      BATTLE.startOnline({
        p1Id: p1.char_id,
        p2Id: p2.char_id,
        mapId: mapId,
        matchId: matchId,
        isHost: isHost,
        mySlot: mySlot,
        onEnd: function (winnerSlot) {
          battleActive = false;
          stopInputLoop();
          var winner = players.filter(function (p) { return p.slot === winnerSlot; })[0];
          finishMatchRpc(winner ? winner.profile_id : null);
          if (matchChannel) {
            matchChannel.send({
              type: 'broadcast',
              event: 'end',
              payload: { winnerSlot: winnerSlot, winnerId: winner ? winner.profile_id : null }
            });
          }
          if (onBattleEnd) onBattleEnd(winnerSlot, winner);
        }
      });

      if (isHost) BATTLE.pushHostSnapshot();
      startInputLoop();
    });
  }

  function leaveRoom() {
    stopInputLoop();
    stopHeartbeat();
    battleActive = false;
    var p = Promise.resolve();
    if (matchId && sb) {
      p = rpcCall('leave_arcade_match', { p_match_id: matchId }).catch(function () {});
    }
    return p.then(function () {
      if (matchChannel && sb) sb.removeChannel(matchChannel);
      if (dbChannel && sb) sb.removeChannel(dbChannel);
      matchChannel = null;
      dbChannel = null;
      matchId = null;
      matchRow = null;
      players = [];
    });
  }

  function isSignedIn() {
    return !!profile;
  }

  function getProfile() {
    return profile;
  }

  function setHandlers(handlers) {
    handlers = handlers || {};
    onLobbyChange = handlers.onLobbyChange || null;
    onMatchStart = handlers.onMatchStart || null;
    onMatchEnd = handlers.onMatchEnd || null;
    onError = handlers.onError || null;
    onAuthReady = handlers.onAuthReady || null;
    onAuthChange = handlers.onAuthChange || null;
  }

  function ensureAuth() {
    return ensureSession({ refreshParent: isInVaultFrame() });
  }

  return {
    ensureAuth: ensureAuth,
    ensureSession: ensureSession,
    tryAutoAuth: tryAutoAuth,
    signIn: signIn,
    clearAuth: clearAuth,
    createRoom: createRoom,
    joinRoom: joinRoom,
    listPublicLobbies: listPublicLobbies,
    setCharacter: setCharacter,
    setReady: setReady,
    setMap: setMap,
    resetMatchToLobby: resetMatchToLobby,
    startMatch: startMatch,
    beginOnlineBattle: beginOnlineBattle,
    leaveRoom: leaveRoom,
    getLobbyState: getLobbyState,
    setHandlers: setHandlers,
    isSignedIn: isSignedIn,
    getProfile: getProfile,
    sendInputNow: sendInputNow
  };
})();
