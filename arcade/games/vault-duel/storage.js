window.VB_STORE = (function () {
  var KEY = 'vault-brawl-save-v1';

  function defaultSave() {
    return {
      coins: 0,
      unlocked: ['vault', 'blitz']
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      var data = JSON.parse(raw);
      if (!data.unlocked || !data.unlocked.length) data.unlocked = ['vault', 'blitz'];
      data.coins = Number(data.coins) || 0;
      return data;
    } catch (e) {
      return defaultSave();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function coins() {
    return load().coins;
  }

  function addCoins(n) {
    var data = load();
    data.coins = Math.max(0, data.coins + n);
    save(data);
    return data.coins;
  }

  function spendCoins(n) {
    var data = load();
    if (data.coins < n) return false;
    data.coins -= n;
    save(data);
    return true;
  }

  function isUnlocked(id) {
    return load().unlocked.indexOf(id) !== -1;
  }

  function unlock(id) {
    var data = load();
    if (data.unlocked.indexOf(id) !== -1) return false;
    data.unlocked.push(id);
    save(data);
    return true;
  }

  function unlockedChars() {
    return load().unlocked.slice();
  }

  function pickWeighted(table) {
    var total = 0;
    table.forEach(function (row) { total += row.weight; });
    var roll = Math.random() * total;
    for (var i = 0; i < table.length; i++) {
      roll -= table[i].weight;
      if (roll <= 0) return table[i];
    }
    return table[table.length - 1];
  }

  function charsInPool(pool) {
    return window.VB_DATA.CHARACTERS.filter(function (c) {
      if (c.rarity === 'starter') return false;
      if (pool === 'common') return c.rarity === 'common';
      if (pool === 'rare') return c.rarity === 'rare';
      return false;
    });
  }

  function rollChest(kind) {
    var table = kind === 'rare' ? window.VB_DATA.RARE_CHEST : window.VB_DATA.NORMAL_CHEST;
    var pick = pickWeighted(table);
    if (pick.type === 'coins') {
      addCoins(pick.amount);
      return { type: 'coins', amount: pick.amount, message: '+' + pick.amount + ' coins (duplicate refund)' };
    }
    var pool = charsInPool(pick.pool).filter(function (c) { return !isUnlocked(c.id); });
    if (!pool.length) {
      var refund = kind === 'rare' ? 50 : 18;
      addCoins(refund);
      return { type: 'coins', amount: refund, message: 'Already own everyone in this tier — +' + refund + ' coins' };
    }
    var chosen = pool[Math.floor(Math.random() * pool.length)];
    unlock(chosen.id);
    return { type: 'char', char: chosen, message: 'Unlocked ' + chosen.name + '!' };
  }

  return {
    load: load,
    coins: coins,
    addCoins: addCoins,
    spendCoins: spendCoins,
    isUnlocked: isUnlocked,
    unlock: unlock,
    unlockedChars: unlockedChars,
    rollChest: rollChest
  };
})();
