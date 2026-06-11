const Translate = {
  _cache: {},

  async translate(text, from = 'en', to = 'zh-CN') {
    if (!text || text.trim().length === 0) return text;

    // Skip if already Chinese
    if (/[\u4e00-\u9fff]/.test(text.substring(0, 50))) return text;

    const cacheKey = `${from}-${to}:${text}`;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      const url = `${API.TRANSLATE}?q=${encodeURIComponent(text.substring(0, 500))}&langpair=${from}|${to}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.responseStatus === 200 && data.responseData) {
        const translated = data.responseData.translatedText;
        this._cache[cacheKey] = translated;
        return translated;
      }
      return text;
    } catch {
      return text;
    }
  },

  isChinese(text) {
    if (!text) return false;
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);
    if (!chineseChars) return false;
    return chineseChars.length / text.length > 0.15;
  },
};
