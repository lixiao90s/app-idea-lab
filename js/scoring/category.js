function analyzeCategory(scoredApps, heatData) {
  if (!scoredApps.length) return null;

  const total = scoredApps.length;
  const highOpp = scoredApps.filter(a => a._scores.level === 'high').length;
  const medOpp = scoredApps.filter(a => a._scores.level === 'medium').length;

  const avgRating = scoredApps.reduce((s, a) => s + (a.averageUserRating || 0), 0) / total;
  const avgScore = scoredApps.reduce((s, a) => s + a._scores.normalized, 0) / total;
  const avgDownloads = scoredApps.reduce((s, a) => {
    const est = estimateDownloads(a, { genreId: heatData?.genreId });
    return s + est.displayMonthly;
  }, 0) / total;

  const staleApps = scoredApps.filter(a => {
    if (!a.currentVersionReleaseDate) return false;
    const days = (Date.now() - new Date(a.currentVersionReleaseDate).getTime()) / (1000 * 60 * 60 * 24);
    return days > THRESHOLDS.STALENESS_DAYS.STALE;
  }).length;

  return {
    totalApps: total,
    avgRating: Math.round(avgRating * 100) / 100,
    avgScore: Math.round(avgScore),
    avgDownloads: Math.round(avgDownloads),
    highOpportunityCount: highOpp,
    mediumOpportunityCount: medOpp,
    opportunityDensity: Math.round((highOpp / total) * 100),
    staleRate: Math.round((staleApps / total) * 100),
    heat: heatData || null,
    topApps: scoredApps.slice(0, 20),
    level: opportunityLevel(avgScore),
  };
}

function categoryScore(analysis) {
  if (!analysis) return { score: 0, level: 'unknown' };
  return { score: analysis.avgScore, level: analysis.level };
}
