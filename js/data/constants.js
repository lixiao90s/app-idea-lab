const API = {
  SEARCH_BASE: 'https://itunes.apple.com/search',
  LOOKUP_BASE: 'https://itunes.apple.com/lookup',
  RSS_BASE: 'https://itunes.apple.com/rss',
  REVIEW_RSS: 'https://itunes.apple.com/rss/customerreviews',
  // Set after Cloudflare Worker deploy — e.g. https://app-idea-lab-api.xxx.workers.dev
  API_PROXY: 'https://app-idea-lab-api.lixiao918918.workers.dev',
  TRANSLATE: 'https://api.mymemory.translated.net/get',
};

const CONFIG = {
  SITE_NAME: 'App Idea Lab',
  REQUEST_INTERVAL_MS: 1500,
  CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  MAX_SEARCH_RESULTS: 200,
  LOOKUP_BATCH_SIZE: 100,
  RSS_TOP_LIMIT: 200,
  DEFAULT_COUNTRY: 'us',
  ADS_ENABLED: false,
  ADSENSE_CLIENT: 'ca-pub-7494284239496094',
  // PropellerAds
  PROPELLERADS_ENABLED: false,
  PROPELLERADS_PUSH: {
    url: 'https://3nbf4.com/tag.min.js',
    zoneId: 11132021, // Push (sw.js) — already verified
  },
  PROPELLERADS_MULTITAG: {
    url: 'https://quge5.com/88/tag.min.js',
    zoneId: 248649,
  },
  PROPELLERADS_BANNER_ZONES: {
    'side-left': '',
    'side-right': '',
    detail: '',
  },
};

const SCORE_WEIGHTS = {
  demand: 0.22,
  quality: 0.22,
  freshness: 0.18,
  pain: 0.13,
  monetization: 0.13,
  heat: 0.12,
};

const THRESHOLDS = {
  RATING: {
    STRONG_OPPORTUNITY: 3.0,
    MODERATE_OPPORTUNITY: 3.5,
    COMPETITIVE: 4.0,
    SATURATED: 4.5,
  },
  STALENESS_DAYS: {
    FRESH: 30,
    MODERATE: 180,
    STALE: 365,
    VERY_STALE: 730,
  },
  SCORE: {
    HIGH: 70,
    MEDIUM: 40,
  },
};

const OPPORTUNITY_LABELS = {
  high: { text: '高机会', color: '#16a34a', bg: '#f0fdf4' },
  medium: { text: '中等机会', color: '#d97706', bg: '#fffbeb' },
  low: { text: '竞争激烈', color: '#dc2626', bg: '#fef2f2' },
  unknown: { text: '未扫描', color: '#71717a', bg: '#f4f4f5' },
};

const HEAT_LABELS = {
  hot: { text: '热门', color: '#c64545', bg: '#faf0f0' },
  warm: { text: '温热', color: '#e8a55a', bg: '#fdf5ec' },
  cold: { text: '冷门', color: '#5b8fb9', bg: '#eef4f8' },
};
