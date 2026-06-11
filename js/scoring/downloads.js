// Download estimation — based on review count ratios (not official Apple data)

const DOWNLOAD_RATIOS = {
  free: { conservative: 120, neutral: 80, optimistic: 50 },
  paid: { conservative: 80, neutral: 50, optimistic: 30 },
};

const GENRE_MULTIPLIERS = {
  6014: 1.4, 6012: 1.3, 6016: 1.2, 6013: 1.1,
  6026: 0.7, 6020: 0.8, 6015: 0.9,
};

function getGenreMultiplier(genreId) {
  return GENRE_MULTIPLIERS[genreId] || 1.0;
}

function estimateDownloads(app, categoryContext) {
  const reviewCount = app.userRatingCount || 0;
  const isFree = (app.price || 0) === 0;
  const ratios = isFree ? DOWNLOAD_RATIOS.free : DOWNLOAD_RATIOS.paid;
  const genreId = categoryContext?.genreId || app.primaryGenreId;
  const multiplier = getGenreMultiplier(genreId);

  const releaseDate = app.releaseDate ? new Date(app.releaseDate) : null;
  const monthsAlive = releaseDate
    ? Math.max(1, Math.floor((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : 24;

  function calc(ratio) {
    const total = Math.round(reviewCount * ratio * multiplier);
    const monthly = Math.round(total / monthsAlive);
    return { total, monthly };
  }

  const conservative = calc(ratios.conservative);
  const neutral = calc(ratios.neutral);
  const optimistic = calc(ratios.optimistic);

  return {
    reviewCount,
    monthsAlive,
    isFree,
    multiplier,
    conservative,
    neutral,
    optimistic,
    displayMonthly: neutral.monthly,
    displayRange: `${conservative.monthly.toLocaleString()} - ${optimistic.monthly.toLocaleString()}`,
    disclaimer: '基于评论数 × 行业系数推算，非 App Store 官方下载数据',
  };
}

function formatDownloads(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
