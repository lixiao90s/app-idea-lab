const Cache = {
  _prefix: 'asif_',

  get(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.CACHE_TTL_MS) {
        localStorage.removeItem(this._prefix + key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  set(key, data) {
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify({
        data,
        ts: Date.now(),
      }));
    } catch {
      // Storage full - clear old entries
      this.clearOld();
    }
  },

  clearOld() {
    const now = Date.now();
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this._prefix)) {
        try {
          const { ts } = JSON.parse(localStorage.getItem(k));
          if (now - ts > CONFIG.CACHE_TTL_MS) keys.push(k);
        } catch {
          keys.push(k);
        }
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  },

  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this._prefix)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  },
};
