window.VB_DATA = {
  WIN_COINS: 15,
  LOSE_COINS: 4,
  CHEST_NORMAL_COST: 40,
  CHEST_RARE_COST: 120,
  STOCKS: 3,

  WEAPONS: {
    pistol: {
      id: 'pistol', name: 'Vault Pistol', type: 'projectile',
      damage: 8, cooldown: 26, speed: 12, size: 5, knockback: 0.7, color: '#66c0f4'
    },
    smg: {
      id: 'smg', name: 'Blitz SMG', type: 'projectile',
      damage: 5, cooldown: 10, speed: 13, size: 4, knockback: 0.45, color: '#5fd4a4'
    },
    hammer: {
      id: 'hammer', name: 'Anvil Hammer', type: 'melee',
      damage: 18, cooldown: 38, reach: 48, knockback: 0.9, color: '#8b9cb3', swing: 14
    },
    blade: {
      id: 'blade', name: 'Spark Blade', type: 'melee',
      damage: 7, cooldown: 14, reach: 40, knockback: 0.55, color: '#ff7b9c', swing: 10
    },
    gauntlet: {
      id: 'gauntlet', name: 'Gold Gauntlets', type: 'melee',
      damage: 14, cooldown: 24, reach: 36, knockback: 0.75, color: '#e2b34d', swing: 12
    },
    crossbow: {
      id: 'crossbow', name: 'Shade Crossbow', type: 'projectile',
      damage: 12, cooldown: 34, speed: 15, size: 6, knockback: 0.65, color: '#9b7bff', pierce: true
    },
    launcher: {
      id: 'launcher', name: 'Ember Launcher', type: 'projectile',
      damage: 11, cooldown: 30, speed: 9, size: 10, knockback: 0.8, color: '#f4a261',
      arc: true, launchAngle: -0.35
    },
    royalbow: {
      id: 'royalbow', name: 'Crown Bow', type: 'projectile',
      damage: 10, cooldown: 22, speed: 14, size: 5, knockback: 0.6, color: '#e6edf3', speedY: -1
    }
  },

  CHARACTERS: [
    {
      id: 'vault', name: 'Vault', rarity: 'starter',
      color: '#66c0f4', accent: '#1a4a6e', shape: 'soldier',
      desc: 'Balanced fighter with a pistol.', health: 100,
      speed: 4.2, jump: 11.5, weight: 1, power: 1, weapon: 'pistol',
      special: 'burst', specialName: 'Triple Tap'
    },
    {
      id: 'blitz', name: 'Blitz', rarity: 'starter',
      color: '#5fd4a4', accent: '#1a5e48', shape: 'runner',
      desc: 'Fast SMG rushdown. Low HP.', health: 80,
      speed: 5.4, jump: 12, weight: 0.82, power: 0.85, weapon: 'smg',
      special: 'overdrive', specialName: 'Overdrive'
    },
    {
      id: 'anvil', name: 'Anvil', rarity: 'common',
      color: '#8b9cb3', accent: '#3a4558', shape: 'tank',
      desc: 'Tanky hammer bruiser.', health: 140,
      speed: 3.4, jump: 10, weight: 1.35, power: 1.2, weapon: 'hammer',
      special: 'slam', specialName: 'Vault Slam'
    },
    {
      id: 'spark', name: 'Spark', rarity: 'common',
      color: '#ff7b9c', accent: '#6e2a42', shape: 'ninja',
      desc: 'Glass cannon blade duelist.', health: 75,
      speed: 4.6, jump: 13.2, weight: 0.78, power: 0.9, weapon: 'blade',
      special: 'blink', specialName: 'Phase Blink'
    },
    {
      id: 'gold', name: 'Goldknuckle', rarity: 'common',
      color: '#e2b34d', accent: '#6e5520', shape: 'brawler',
      desc: 'Heavy gauntlet punches.', health: 115,
      speed: 3.8, jump: 11, weight: 1.1, power: 1.45, weapon: 'gauntlet',
      special: 'guard', specialName: 'Gold Guard'
    },
    {
      id: 'shade', name: 'Shade', rarity: 'rare',
      color: '#9b7bff', accent: '#3f2a6e', shape: 'hood',
      desc: 'Crossbow sniper + dash.', health: 95,
      speed: 4.8, jump: 11.8, weight: 0.9, power: 1.15, weapon: 'crossbow',
      special: 'dash', specialName: 'Shadow Dash'
    },
    {
      id: 'ember', name: 'Ember', rarity: 'rare',
      color: '#f4a261', accent: '#6e4020', shape: 'pyro',
      desc: 'Arcing flame launcher.', health: 100,
      speed: 4, jump: 11.2, weight: 0.95, power: 1.35, weapon: 'launcher',
      special: 'nova', specialName: 'Ember Nova'
    },
    {
      id: 'crown', name: 'Crown', rarity: 'rare',
      color: '#e6edf3', accent: '#4a5568', shape: 'royal',
      desc: 'Royal bow archer.', health: 105,
      speed: 4.1, jump: 11.4, weight: 1.05, power: 1.3, weapon: 'royalbow',
      special: 'volley', specialName: 'Royal Volley'
    }
  ],

  MAPS: [
    {
      id: 'vault', name: 'Main Vault',
      bgTop: '#1a2238', bgBottom: '#0d1117', accent: '#66c0f4',
      platforms: [
        { x: 0, y: 500, w: 960, h: 40 },
        { x: 120, y: 360, w: 200, h: 18 },
        { x: 380, y: 290, w: 200, h: 18 },
        { x: 640, y: 360, w: 200, h: 18 },
        { x: 300, y: 180, w: 360, h: 18 }
      ],
      movers: [{ platform: 2, axis: 'y', distance: 75, speed: 0.018 }],
      spawns: [[220, 420], [740, 420]]
    },
    {
      id: 'spire', name: 'Sky Spire',
      bgTop: '#1e2848', bgBottom: '#0a0e18', accent: '#9b7bff',
      platforms: [
        { x: 0, y: 500, w: 960, h: 40 },
        { x: 400, y: 380, w: 160, h: 18 },
        { x: 360, y: 280, w: 240, h: 18 },
        { x: 400, y: 180, w: 160, h: 18 },
        { x: 80, y: 320, w: 120, h: 16 },
        { x: 760, y: 320, w: 120, h: 16 }
      ],
      movers: [{ platform: 1, axis: 'y', distance: 90, speed: 0.022 }, { platform: 4, axis: 'x', distance: 70, speed: 0.016 }],
      spawns: [[180, 420], [780, 420]]
    },
    {
      id: 'twins', name: 'Twin Peaks',
      bgTop: '#142238', bgBottom: '#081018', accent: '#5fd4a4',
      platforms: [
        { x: 0, y: 500, w: 960, h: 40 },
        { x: 60, y: 340, w: 220, h: 18 },
        { x: 680, y: 340, w: 220, h: 18 },
        { x: 300, y: 220, w: 360, h: 18 }
      ],
      movers: [{ platform: 1, axis: 'y', distance: 55, speed: 0.017 }, { platform: 2, axis: 'y', distance: 55, speed: 0.017, phase: 3.14 }],
      spawns: [[160, 420], [800, 420]]
    },
    {
      id: 'bridge', name: 'Glass Bridge',
      bgTop: '#122030', bgBottom: '#060a10', accent: '#e2b34d',
      platforms: [
        { x: 0, y: 500, w: 200, h: 40 },
        { x: 760, y: 500, w: 200, h: 40 },
        { x: 280, y: 360, w: 400, h: 16 },
        { x: 360, y: 240, w: 240, h: 16 }
      ],
      movers: [{ platform: 2, axis: 'x', distance: 105, speed: 0.015 }],
      spawns: [[100, 420], [860, 420]]
    },
    {
      id: 'pit', name: 'The Pit',
      bgTop: '#281a1a', bgBottom: '#100808', accent: '#ff7b9c',
      platforms: [
        { x: 330, y: 500, w: 300, h: 40 },
        { x: 80, y: 380, w: 140, h: 16 },
        { x: 740, y: 380, w: 140, h: 16 },
        { x: 200, y: 260, w: 120, h: 16 },
        { x: 640, y: 260, w: 120, h: 16 },
        { x: 400, y: 160, w: 160, h: 16 }
      ],
      movers: [{ platform: 5, axis: 'y', distance: 70, speed: 0.021 }],
      spawns: [[400, 420], [520, 420]]
    },
    {
      id: 'cloud', name: 'Cloud Nine',
      bgTop: '#2a3a5a', bgBottom: '#141c30', accent: '#e6edf3',
      platforms: [
        { x: 0, y: 500, w: 960, h: 40 },
        { x: 40, y: 400, w: 100, h: 14 },
        { x: 200, y: 330, w: 100, h: 14 },
        { x: 380, y: 270, w: 200, h: 14 },
        { x: 660, y: 330, w: 100, h: 14 },
        { x: 820, y: 400, w: 100, h: 14 },
        { x: 430, y: 170, w: 100, h: 14 }
      ],
      movers: [{ platform: 1, axis: 'x', distance: 70, speed: 0.012 }, { platform: 5, axis: 'x', distance: 70, speed: 0.012, phase: 3.14 }],
      spawns: [[120, 420], [840, 420]]
    },
    {
      id: 'fort', name: 'Fortress',
      bgTop: '#1a2830', bgBottom: '#0c1218', accent: '#8b9cb3',
      platforms: [
        { x: 0, y: 500, w: 960, h: 50 },
        { x: 0, y: 350, w: 80, h: 150 },
        { x: 880, y: 350, w: 80, h: 150 },
        { x: 300, y: 300, w: 360, h: 18 }
      ],
      movers: [{ platform: 3, axis: 'y', distance: 95, speed: 0.014 }],
      spawns: [[200, 420], [760, 420]]
    },
    {
      id: 'scatter', name: 'Scattered',
      bgTop: '#201838', bgBottom: '#0e0a18', accent: '#f4a261',
      platforms: [
        { x: 120, y: 500, w: 180, h: 30 },
        { x: 660, y: 500, w: 180, h: 30 },
        { x: 300, y: 400, w: 120, h: 14 },
        { x: 540, y: 400, w: 120, h: 14 },
        { x: 180, y: 280, w: 100, h: 14 },
        { x: 680, y: 280, w: 100, h: 14 },
        { x: 400, y: 180, w: 160, h: 14 }
      ],
      movers: [{ platform: 2, axis: 'x', distance: 65, speed: 0.019 }, { platform: 3, axis: 'x', distance: 65, speed: 0.019, phase: 3.14 }],
      spawns: [[200, 420], [760, 420]]
    },
    {
      id: 'arena', name: 'Open Arena',
      bgTop: '#182238', bgBottom: '#0a1018', accent: '#66c0f4',
      platforms: [
        { x: 0, y: 500, w: 960, h: 40 }
      ],
      movers: [{ platform: 0, axis: 'y', distance: 18, speed: 0.009 }],
      spawns: [[280, 420], [680, 420]]
    },
    {
      id: 'isles', name: 'Floating Isles',
      bgTop: '#1a3040', bgBottom: '#081820', accent: '#5fd4a4',
      platforms: [
        { x: 60, y: 420, w: 160, h: 20 },
        { x: 740, y: 420, w: 160, h: 20 },
        { x: 260, y: 310, w: 140, h: 16 },
        { x: 560, y: 310, w: 140, h: 16 },
        { x: 400, y: 190, w: 160, h: 16 },
        { x: 380, y: 500, w: 200, h: 30 }
      ],
      movers: [{ platform: 2, axis: 'y', distance: 65, speed: 0.016 }, { platform: 3, axis: 'y', distance: 65, speed: 0.016, phase: 3.14 }],
      spawns: [[140, 360], [820, 360]]
    }
  ],

  BLAST: { left: -80, right: 1040, bottom: 620 },

  NORMAL_CHEST: [
    { type: 'char', pool: 'common', weight: 55 },
    { type: 'coins', amount: 20, weight: 30 },
    { type: 'char', pool: 'rare', weight: 5 },
    { type: 'coins', amount: 35, weight: 10 }
  ],

  RARE_CHEST: [
    { type: 'char', pool: 'rare', weight: 70 },
    { type: 'char', pool: 'common', weight: 15 },
    { type: 'coins', amount: 60, weight: 15 }
  ]
};

function vbWeapon(char) {
  return window.VB_DATA.WEAPONS[char.weapon] || window.VB_DATA.WEAPONS.pistol;
}

function vbMapById(id) {
  var maps = window.VB_DATA.MAPS;
  for (var i = 0; i < maps.length; i++) {
    if (maps[i].id === id) return maps[i];
  }
  return maps[0];
}

function vbRandomMap() {
  var maps = window.VB_DATA.MAPS;
  return maps[Math.floor(Math.random() * maps.length)];
}

function vbResolveMapId(mapId, seed) {
  var maps = window.VB_DATA.MAPS;
  if (mapId && mapId !== 'random') {
    for (var i = 0; i < maps.length; i++) {
      if (maps[i].id === mapId) return mapId;
    }
  }
  var ids = maps.map(function (m) { return m.id; });
  var hash = 0;
  var s = String(seed || 'vault');
  for (var j = 0; j < s.length; j++) hash = ((hash << 5) - hash) + s.charCodeAt(j);
  return ids[Math.abs(hash) % ids.length];
}
