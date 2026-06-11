// iTunes API — routes through Cloudflare Worker when API_PROXY is set

async function apiFetch(url) {
  const proxy = API.API_PROXY;
  if (proxy) {
    try {
      const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        console.warn(`Worker HTTP ${resp.status}, falling back to JSONP`);
        return jsonpFetch(url);
      }
      return resp.json();
    } catch (err) {
      console.warn('Worker unreachable, falling back to JSONP');
      return jsonpFetch(url);
    }
  }
  return jsonpFetch(url);
}

async function proxyFetch(url) {
  return apiFetch(url);
}

async function searchApps(term, options = {}) {
  const country = options.country || CONFIG.DEFAULT_COUNTRY;
  const limit = options.limit || CONFIG.MAX_SEARCH_RESULTS;
  const genreId = options.genreId || '';
  const cacheKey = `search_${term}_${country}_${genreId}_${limit}`;

  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  let url = `${API.SEARCH_BASE}?term=${encodeURIComponent(term)}&media=software&country=${country}&limit=${limit}`;
  if (genreId) url += `&genreId=${genreId}`;

  const data = await scheduler.enqueue(url, !API.API_PROXY);
  const results = (data && data.results) || [];
  Cache.set(cacheKey, results);
  return results;
}

async function lookupApps(trackIds) {
  if (!trackIds.length) return [];

  const batchSize = CONFIG.LOOKUP_BATCH_SIZE;
  const allResults = [];

  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const cacheKey = `lookup_${batch.join(',')}`;

    const cached = Cache.get(cacheKey);
    if (cached) {
      allResults.push(...cached);
      continue;
    }

    const url = `${API.LOOKUP_BASE}?id=${batch.join(',')}`;
    const data = await scheduler.enqueue(url, !API.API_PROXY);
    const results = (data && data.results) || [];
    Cache.set(cacheKey, results);
    allResults.push(...results);
  }

  return allResults;
}

async function fetchTopCharts(genreId, chartType = 'topfreeapplications') {
  const cacheKey = `rss_${chartType}_${genreId}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const url = `${API.RSS_BASE}/${chartType}/limit=${CONFIG.RSS_TOP_LIMIT}/genre=${genreId}/json`;
  const data = await scheduler.enqueue(url, !API.API_PROXY);
  const entries = (data && data.feed && data.feed.entry) || [];
  Cache.set(cacheKey, entries);
  return entries;
}

async function fetchReviews(trackId) {
  const cacheKey = `reviews_${trackId}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  const url = `${API.REVIEW_RSS}/id=${trackId}/sortBy=mostRecent/json`;
  try {
    const data = await scheduler.enqueue(url, !API.API_PROXY);
    const entries = (data && data.feed && data.feed.entry) || [];
    const reviews = entries
      .filter(e => e['im:rating'])
      .map(e => ({
        rating: parseInt(e['im:rating'].label),
        title: e.title ? e.title.label : '',
        content: e.content ? e.content.label : '',
        author: e.author ? e.author.name.label : '',
        date: e.updated ? e.updated.label : '',
      }));
    Cache.set(cacheKey, reviews);
    return reviews;
  } catch {
    return [];
  }
}

function extractTrackIds(rssEntries) {
  return rssEntries
    .map(e => {
      const idObj = e.id && e.id.attributes;
      return idObj ? idObj['im:id'] : null;
    })
    .filter(Boolean);
}

// JSONP fallback when Worker is not configured
function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cb = '_jp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timeout = setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('JSONP load error')); };

    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + cb;
    document.head.appendChild(script);
  });
}
