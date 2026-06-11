// Search heat — proxy metrics from App Store search results + optional Worker /heat endpoint

function computeLocalHeat(searchResults, term) {
  const results = searchResults || [];
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

  return {
    term,
    score,
    level,
    label: HEAT_LABELS[level].text,
    metrics: {
      resultCount: count,
      totalReviews,
      avgRating: Math.round(avgRating * 100) / 100,
      staleRate: count ? Math.round((staleCount / count) * 100) : 0,
    },
    disclaimer: '基于 App Store 搜索结果的代理指标，非官方搜索量',
  };
}

async function fetchSearchHeat(term, genreId) {
  if (!API.API_PROXY) {
    return null;
  }

  const cacheKey = `heat_${term}_${genreId || 'all'}`;
  const cached = Cache.get(cacheKey);
  if (cached) return cached;

  try {
    let url = `${API.API_PROXY}/heat?term=${encodeURIComponent(term)}`;
    if (genreId) url += `&genreId=${genreId}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    Cache.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

async function getSearchHeat(term, searchResults, genreId) {
  const remote = await fetchSearchHeat(term, genreId);
  if (remote && remote.score != null) return remote;
  return computeLocalHeat(searchResults, term);
}
