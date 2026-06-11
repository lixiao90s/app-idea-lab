// Cloudflare Worker: unified Apple API proxy with KV cache, rate limiting, and cron prefetch
// Deploy: npx wrangler deploy (from worker/)

const ALLOWED_PREFIX = 'https://itunes.apple.com/';
const RATE_LIMIT_PER_MIN = 10;
const UPSTREAM_RETRY_DELAYS_MS = [1000, 2000, 4000];
const STALE_CACHE_TTL = 604800; // 7 days — served when Apple returns 429
const CACHE_TTL = {
  search: 14400,
  lookup: 21600,
  rss: 43200,
  heat: 14400,
  default: 21600,
};

const GENRE_KEYWORDS = {
  6000: 'business', 6001: 'weather', 6002: 'utility tool', 6003: 'travel',
  6004: 'sports', 6005: 'social network', 6006: 'reference', 6007: 'productivity',
  6008: 'photo video editor', 6009: 'news', 6010: 'navigation map',
  6011: 'health fitness', 6012: 'music', 6013: 'lifestyle', 6014: 'game',
  6015: 'finance money', 6016: 'entertainment', 6017: 'education learn',
  6018: 'book reading', 6020: 'medical health', 6021: 'magazine newspaper',
  6022: 'catalog', 6023: 'food drink recipe', 6024: 'shopping', 6025: 'sticker',
  6026: 'developer tool code', 6027: 'graphic design',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, ts: Date.now() });
    }

    if (url.pathname === '/heat') {
      return handleHeat(url, env);
    }

    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      return proxyAppleUrl(targetUrl, env);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(prefetchGenres(env));
  },
};

async function proxyAppleUrl(targetUrl, env) {
  if (!targetUrl.startsWith(ALLOWED_PREFIX)) {
    return new Response('Invalid URL', { status: 400, headers: corsHeaders() });
  }

  const cacheKey = `cache:${targetUrl}`;
  const staleKey = `stale:${targetUrl}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, { type: 'json' });
    if (cached && cached.data) {
      return jsonResponse(cached.data, {
        'X-Cache': 'HIT',
        'X-Cache-Time': cached.cachedAt || '',
      });
    }
  }

  const allowed = await checkRateLimit(env);
  if (!allowed) {
    const stale = env.CACHE ? await env.CACHE.get(staleKey, { type: 'json' }) : null;
    if (stale && stale.data) {
      return jsonResponse(stale.data, {
        'X-Cache': 'STALE',
        'X-Cache-Time': stale.cachedAt || '',
      });
    }
    return new Response(JSON.stringify({ error: 'Rate limited, retry later' }), {
      status: 429,
      headers: corsHeaders(),
    });
  }

  const response = await fetchWithRetry(targetUrl);
  if (!response.ok) {
    const stale = env.CACHE ? await env.CACHE.get(staleKey, { type: 'json' }) : null;
    if (stale && stale.data) {
      return jsonResponse(stale.data, {
        'X-Cache': 'STALE',
        'X-Cache-Time': stale.cachedAt || '',
      });
    }
    return new Response(JSON.stringify({ error: `Upstream HTTP ${response.status}` }), {
      status: response.status,
      headers: corsHeaders(),
    });
  }

  const data = await response.json();
  const ttl = getCacheTtl(targetUrl);
  const cachedAt = new Date().toISOString();
  const payload = { data, cachedAt };

  if (env.CACHE) {
    await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    await env.CACHE.put(staleKey, JSON.stringify(payload), { expirationTtl: STALE_CACHE_TTL });
  }

  return jsonResponse(data, { 'X-Cache': 'MISS' });
}

async function handleHeat(url, env) {
  const term = (url.searchParams.get('term') || '').trim();
  const genreId = url.searchParams.get('genreId') || '';
  if (!term) {
    return new Response('Missing term', { status: 400, headers: corsHeaders() });
  }

  const heatCacheKey = `heat:${term}:${genreId}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(heatCacheKey, { type: 'json' });
    if (cached) return jsonResponse(cached);
  }

  let searchUrl = `${ALLOWED_PREFIX}search?term=${encodeURIComponent(term)}&media=software&country=us&limit=200`;
  if (genreId) searchUrl += `&genreId=${genreId}`;

  const proxyResp = await proxyAppleUrl(searchUrl, env);
  const searchData = await proxyResp.json();
  const results = (searchData && searchData.results) || [];

  const heat = computeHeatScore(results, term);
  if (env.CACHE) {
    await env.CACHE.put(heatCacheKey, JSON.stringify(heat), { expirationTtl: CACHE_TTL.heat });
  }

  return jsonResponse(heat);
}

function computeHeatScore(results, term) {
  const count = results.length;
  const totalReviews = results.reduce((s, a) => s + (a.userRatingCount || 0), 0);
  const avgRating = count
    ? results.reduce((s, a) => s + (a.averageUserRating || 0), 0) / count
    : 0;
  const staleCount = results.filter(a => {
    if (!a.currentVersionReleaseDate) return false;
    const days = (Date.now() - new Date(a.currentVersionReleaseDate).getTime()) / 86400000;
    return days > 365;
  }).length;

  const volumeScore = Math.min(40, Math.log10(Math.max(totalReviews, 1)) * 10);
  const competitionScore = Math.min(25, count / 8);
  const demandGapScore = Math.min(20, Math.max(0, (3.8 - avgRating) * 8));
  const staleScore = count ? Math.min(15, (staleCount / count) * 30) : 0;

  const score = Math.round(Math.min(100, volumeScore + competitionScore + demandGapScore + staleScore));
  const level = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
  const labels = { hot: '热', warm: '温', cold: '冷' };

  return {
    term,
    score,
    level,
    label: labels[level],
    metrics: {
      resultCount: count,
      totalReviews,
      avgRating: Math.round(avgRating * 100) / 100,
      staleRate: count ? Math.round((staleCount / count) * 100) : 0,
    },
    disclaimer: '基于 App Store 搜索结果的代理指标，非官方搜索量',
    cachedAt: new Date().toISOString(),
  };
}

async function checkRateLimit(env) {
  if (!env.CACHE) return true;
  const minuteKey = `rl:${Math.floor(Date.now() / 60000)}`;
  const current = parseInt(await env.CACHE.get(minuteKey) || '0', 10);
  if (current >= RATE_LIMIT_PER_MIN) return false;
  await env.CACHE.put(minuteKey, String(current + 1), { expirationTtl: 120 });
  return true;
}

async function prefetchGenres(env) {
  for (const [genreId, keyword] of Object.entries(GENRE_KEYWORDS)) {
    try {
      await handleHeat(new URL(`https://worker/heat?term=${encodeURIComponent(keyword)}&genreId=${genreId}`), env);
    } catch {
      // continue on failure
    }
    await sleep(8000);
  }
}

async function fetchWithRetry(url) {
  let response = await fetch(url);
  for (const delayMs of UPSTREAM_RETRY_DELAYS_MS) {
    if (response.status !== 429) break;
    await sleep(delayMs);
    response = await fetch(url);
  }
  return response;
}

function getCacheTtl(targetUrl) {
  if (targetUrl.includes('/search?')) return CACHE_TTL.search;
  if (targetUrl.includes('/lookup?')) return CACHE_TTL.lookup;
  if (targetUrl.includes('/rss/')) return CACHE_TTL.rss;
  return CACHE_TTL.default;
}

function jsonResponse(data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders(), ...extraHeaders },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
