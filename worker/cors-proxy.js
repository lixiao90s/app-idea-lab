// Cloudflare Worker: CORS proxy for Apple RSS feeds
// Deploy with: npx wrangler deploy
// Local dev: npx wrangler dev

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl || !targetUrl.startsWith('https://itunes.apple.com/')) {
      return new Response('Invalid request', { status: 400, headers: corsHeaders() });
    }

    // Check KV cache
    if (env.CACHE) {
      const cached = await env.CACHE.get(targetUrl, { type: 'json' });
      if (cached) {
        return new Response(JSON.stringify(cached), { headers: corsHeaders() });
      }
    }

    const response = await fetch(targetUrl);
    const data = await response.json();

    // Cache for 6 hours
    if (env.CACHE) {
      await env.CACHE.put(targetUrl, JSON.stringify(data), { expirationTtl: 21600 });
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders() });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=21600',
  };
}
