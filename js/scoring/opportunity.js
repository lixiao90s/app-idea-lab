// Demand Score: based on rating count (proxy for user demand)
function demandScore(ratingCount) {
  if (!ratingCount || ratingCount <= 0) return 0;
  return Math.min(5, Math.log10(ratingCount));
}

// Quality Score: inverted rating (lower rating = more opportunity)
function qualityScore(avgRating) {
  if (!avgRating || avgRating === 0) return 3;
  return Math.max(0, 6 - avgRating);
}

// Freshness Score: how stale the app is
function freshnessScore(lastUpdateDate) {
  if (!lastUpdateDate) return 3;
  const daysSinceUpdate = (Date.now() - new Date(lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < THRESHOLDS.STALENESS_DAYS.FRESH) return 1;
  if (daysSinceUpdate < THRESHOLDS.STALENESS_DAYS.MODERATE) return 2;
  if (daysSinceUpdate < THRESHOLDS.STALENESS_DAYS.STALE) return 3;
  if (daysSinceUpdate < THRESHOLDS.STALENESS_DAYS.VERY_STALE) return 4;
  return 5;
}

// Pain Score: based on average rating (lower = stronger pain signal)
function painScore(app) {
  const rating = app.averageUserRating;
  if (!rating) return 2.5;
  if (rating < 2.0) return 5;
  if (rating < 2.5) return 4;
  if (rating < 3.0) return 3;
  if (rating < 3.5) return 2;
  if (rating < 4.0) return 1;
  return 0;
}

// Monetization Score: potential for making money
function monetizationScore(app, categoryContext) {
  const count = app.userRatingCount || 0;
  const price = app.price || 0;
  const isFree = price === 0;

  // Check category pricing data if available
  const pricing = generatePricingMap(categoryContext);

  if (isFree) {
    if (count > 10000) return 4.5;       // Large market, freemium viable
    if (count > 1000) return 3.5;        // Medium market
    if (count > 100) return 2.5;         // Small but viable
    return 1.5;                          // Too small
  } else {
    // Paid app — users already pay, good signal
    if (price >= 0.99 && price <= 4.99 && count > 500) return 4;
    if (price >= 0.99 && price <= 9.99) return 3;
    if (price > 9.99) return 2.5;       // High price = smaller audience
    return 2;
  }
}

function heatScore(heatData) {
  if (!heatData || heatData.score == null) return 2.5;
  return (heatData.score / 100) * 5;
}

// Combined opportunity score — weighted average of 6 dimensions (0-100)
function opportunityScore(app, categoryContext) {
  const d = demandScore(app.userRatingCount || 0);
  const q = qualityScore(app.averageUserRating || 0);
  const f = freshnessScore(app.currentVersionReleaseDate);
  const p = painScore(app);
  const m = monetizationScore(app, categoryContext);
  const h = heatScore(categoryContext?.heat || app._heat);

  const w = SCORE_WEIGHTS;
  const weighted = d * w.demand + q * w.quality + f * w.freshness
    + p * w.pain + m * w.monetization + h * w.heat;
  return Math.round((weighted / 5) * 100);
}

function opportunityLevel(score) {
  if (score >= THRESHOLDS.SCORE.HIGH) return 'high';
  if (score >= THRESHOLDS.SCORE.MEDIUM) return 'medium';
  return 'low';
}

function isReferenceApp(app) {
  if (!app || !app._scores) return false;
  return app._scores.level === 'high' || app._scores.normalized >= THRESHOLDS.SCORE.HIGH;
}

// Score a single app
function scoreApp(app, categoryContext) {
  const normalized = opportunityScore(app, categoryContext);
  const level = opportunityLevel(normalized);

  return {
    ...app,
    _scores: {
      demand: demandScore(app.userRatingCount || 0),
      quality: qualityScore(app.averageUserRating || 0),
      freshness: freshnessScore(app.currentVersionReleaseDate),
      pain: painScore(app),
      monetization: monetizationScore(app, categoryContext),
      heat: heatScore(categoryContext?.heat || app._heat),
      normalized,
      level,
    },
  };
}

// Score and sort
function scoreAndSort(apps, categoryContext) {
  return apps
    .filter(app => app.trackId)
    .map(app => scoreApp(app, categoryContext))
    .sort((a, b) => b._scores.normalized - a._scores.normalized);
}

// ── Rich multi-dimension insight generation ──

function generateInsights(app, categoryContext) {
  const insights = [];
  const rating = app.averageUserRating;
  const count = app.userRatingCount || 0;
  const lastUpdate = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null;
  const daysSince = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const price = app.price || 0;
  const isFree = price === 0;
  const totalApps = categoryContext?.totalApps || 0;

  // 1. Market Scale — user demand
  if (count > 50000) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      title: `该领域用户需求旺盛，已有 ${(count / 1000).toFixed(0)}K+ 量级的用户反馈`,
      detail: `${count.toLocaleString()} 条评论意味着大量用户曾尝试这类应用。用户基数大，说明市场需求真实且持续。作为新品进入，不需要教育市场，只需做出更好的产品就能自然获得流量。`,
    });
  } else if (count > 5000) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      title: `该领域有稳定的用户群体，${count.toLocaleString()} 条评论代表一定规模的市场`,
      detail: `中等规模的评论数说明这不是一个小众方向，有一定用户基数。这个量级的市场对独立开发者很友好 — 足够大到有商业价值，但又不会引起大厂的关注。`,
    });
  } else if (count > 500) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      title: `小众市场，${count.toLocaleString()} 条评论说明有核心用户群`,
      detail: `评论数不多，意味着这是一个相对小众的领域。好处是竞争可能更少，但需要评估市场天花板是否足够高。适合做一个精致的垂直工具。`,
    });
  } else if (count > 0) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      title: `新兴或极小众市场，仅 ${count} 条评论`,
      detail: `极少的评论数意味着市场验证尚不充分。这可能是蓝海机会，也可能是伪需求。建议进一步调研该方向的搜索热度和社区讨论。`,
    });
  }

  // 2. Competitor Quality
  if (rating && rating < 2.5) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      title: `现有竞品评分仅 ${rating.toFixed(1)} 分，用户极度不满`,
      detail: `低于 2.5 的评分意味着大多数用户都有负面体验。这是最强烈的机会信号 — 用户已经知道他们需要什么，但现有产品无法满足。只要你能解决核心痛点，口碑传播会很快。`,
    });
  } else if (rating && rating < 3.5) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      title: `竞品评分 ${rating.toFixed(1)} 分，用户满意度偏低，有明显的提升空间`,
      detail: `3.0-3.5 这个区间的评分说明产品有基本功能但体验不佳。常见原因包括：界面过时、功能缺失、Bug 频出。这是一个可以通过"做得更好"来获胜的领域。`,
    });
  } else if (rating && rating < 4.0) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      title: `竞品评分 ${rating.toFixed(1)} 分，处于及格线附近`,
      detail: `4.0 以下意味着用户虽有不满但尚未彻底放弃。此时进入市场，需要找到竞品的具体短板（看下方用户抱怨），做出差异化体验。`,
    });
  }

  // 3. Maintenance Status
  if (daysSince !== null && daysSince > 730) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      title: `已 ${Math.floor(daysSince / 365)} 年未更新，开发者几乎确定已放弃`,
      detail: `超过 2 年未更新的应用，在新版 iOS 上可能已出现兼容问题。这些应用在 App Store 搜索中仍会显示（因为有一定历史权重），但用户体验在持续恶化。你的新应用可以轻松在评分和"最近更新"上超越它。`,
    });
  } else if (daysSince !== null && daysSince > 365) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      title: `已 ${Math.floor(daysSince / 30)} 个月未更新，维护停滞中`,
      detail: `超过一年未更新说明开发者可能已不再投入精力。这类应用无法跟进 iOS 新特性（如 Widget、快捷指令、Live Activity 等），而这正是你做差异化的好角度。`,
    });
  } else if (daysSince !== null && daysSince > 180) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      title: `更新节奏缓慢，${Math.floor(daysSince / 30)} 个月未更新`,
      detail: `半年以上未更新，维护力度不足。可能开发者已转向其他项目。可以考虑在 iOS 新版本发布后第一时间适配新特性来抢占排名。`,
    });
  }

  // 4. Pricing Strategy
  if (isFree) {
    insights.push({
      dimension: 'pricing',
      label: '价格策略',
      title: `该竞品为免费应用，需评估付费或订阅模式的可行性`,
      detail: `免费应用可能靠广告或内购变现。你可以考虑：做一个付费版（一次性购买，定价 $2.99-4.99）主打"无广告、无订阅"的简洁体验，这在当前订阅疲劳的市场中很有吸引力。`,
    });
  } else {
    insights.push({
      dimension: 'pricing',
      label: '价格策略',
      title: `该竞品售价 $${price.toFixed(2)}，分析定价空间`,
      detail: `用户已经愿意为这类应用付费，说明有付费意愿。你可以定一个有竞争力的价格，或者用免费+高级功能的模式来获取更多用户。`,
    });
  }

  // 5. Pain Points (from rating + description)
  const desc = (app.description || '').toLowerCase();
  const painPoints = [];
  if (rating && rating < 3.5) {
    if (desc.includes('simple') || desc.includes('easy')) painPoints.push('宣传简单易用但评分低，说明实际体验与承诺差距大');
    if (desc.includes('free') || desc.includes('no ads')) painPoints.push('免费模式可能引入了影响体验的广告或限制');
    if (desc.includes('subscription') || desc.includes('premium')) painPoints.push('订阅模式可能引发用户不满');
    if (painPoints.length === 0) {
      painPoints.push('低评分暗示核心功能或体验存在明显问题，具体痛点可参考下方用户评论');
    }
    insights.push({
      dimension: 'pain',
      label: '用户痛点',
      title: painPoints[0],
      detail: `评分 ${rating.toFixed(1)} 的应用，用户差评集中在体验问题。建议仔细阅读下方的用户抱怨，这些就是你的产品需求文档。`,
    });
  }

  // 6. Competition Density
  if (totalApps > 0) {
    if (totalApps > 100) {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        title: `该类别有 ${totalApps}+ 款应用，竞争较激烈`,
        detail: `应用数量多说明市场已被充分探索。要在红海中突围，需要找到极度细分的子方向或做出显著优于竞品的体验。ASO（应用商店优化）也很关键。`,
      });
    } else if (totalApps > 30) {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        title: `该类别有 ${totalApps} 款应用，竞争适中`,
        detail: `中等数量的竞品说明市场已被验证，但尚未饱和。这是独立开发者的舒适区 — 足够多的参考案例，但仍有差异化空间。`,
      });
    } else {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        title: `该类别仅有 ${totalApps} 款应用，蓝海特征明显`,
        detail: `竞争者少意味着更容易获得搜索排名。但需要确认：是因为市场太小没人做，还是因为技术门槛高？如果是前者，需要评估市场规模是否足够。`,
      });
    }
  }

  // Fallback
  if (insights.length === 0) {
    insights.push({
      dimension: 'market',
      label: '综合评估',
      title: '暂无强烈的机会信号',
      detail: '该应用的数据未触发明显的机会阈值。建议与其他同类应用对比分析，或查看用户评论了解更多细节。',
    });
  }

  return insights;
}

// ── 1. Go/No-Go Verdict ─────────────────────

function generateVerdict(app, insights) {
  const score = app._scores ? app._scores.normalized : 0;
  const rating = app.averageUserRating || 5;
  const count = app.userRatingCount || 0;
  const lastUpdate = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null;
  const daysSince = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000*60*60*24)) : 0;

  let signals = 0;
  if (rating < 3.5) signals++;
  if (count > 1000) signals++;
  if (daysSince > 365) signals++;
  if (score >= 70) signals++;

  if (score >= 70 || signals >= 3) {
    const reasons = [];
    if (rating < 3.5) reasons.push('竞品质量差');
    if (daysSince > 365) reasons.push('久未更新');
    if (count > 5000) reasons.push('用户需求已被验证');
    else if (count > 500) reasons.push('有稳定用户群');
    return {
      verdict: 'go',
      label: '值得做',
      color: 'var(--accent)',
      bg: 'var(--bg-card)',
      reason: reasons.join('、') + ' — 这是一个值得认真投入的方向',
    };
  } else if (score >= 40 || signals >= 2) {
    return {
      verdict: 'maybe',
      label: '可以考虑',
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      reason: '有一定机会但竞争或风险存在，建议进一步调研用户需求后再决定',
    };
  } else {
    return {
      verdict: 'no',
      label: '不建议',
      color: 'var(--text-tertiary)',
      bg: 'var(--bg-raised)',
      reason: '该方向竞争激烈或市场验证不足，投入产出比可能不理想',
    };
  }
}

// ── 2. Revenue Estimation ────────────────────

function generateRevenueEstimate(app, categoryContext) {
  const reviewCount = app.userRatingCount || 0;
  const isFree = (app.price || 0) === 0;

  // Downloads estimation: 1 review ≈ 80 downloads (free) or ≈ 50 (paid)
  const downloadRatio = isFree ? 80 : 50;
  const totalDownloads = reviewCount * downloadRatio;

  // Estimate monthly downloads (assume app has been around ~2 years)
  const releaseDate = app.releaseDate ? new Date(app.releaseDate) : null;
  const monthsAlive = releaseDate ? Math.max(1, Math.floor((Date.now() - releaseDate.getTime()) / (1000*60*60*24*30))) : 24;
  const avgMonthlyDownloads = Math.round(totalDownloads / monthsAlive);

  // Revenue estimation
  let lowRevenue, highRevenue, model;
  if (isFree) {
    // Free app: assume 3% conversion to $4.99 IAP or subscription
    const convertingUsers = avgMonthlyDownloads * 0.03;
    lowRevenue = Math.round(convertingUsers * 2.99);
    highRevenue = Math.round(convertingUsers * 6.99);
    model = '免费 + 内购/订阅';
  } else {
    // Paid app
    lowRevenue = Math.round(avgMonthlyDownloads * 0.7 * app.price);
    highRevenue = Math.round(avgMonthlyDownloads * 1.2 * app.price);
    model = '付费下载';
  }

  // Pricing recommendation
  let priceRecommendation;
  if (isFree) {
    priceRecommendation = '建议 $3.99-4.99 一次性购买，主打"无广告无订阅"。或免费基础版 + $2.99 Pro 解锁。';
  } else if (app.price < 2) {
    priceRecommendation = '当前价位偏低，$3.99 可能更合适 — 用户对工具类应用的付费意愿在 $2.99-6.99 区间。';
  } else {
    priceRecommendation = `当前价位 $${app.price.toFixed(2)} 在合理区间。可考虑稍低定价抢占用户。`;
  }

  return {
    estimatedMonthlyDownloads: avgMonthlyDownloads,
    lowRevenue,
    highRevenue,
    model,
    priceRecommendation,
    totalDownloads,
  };
}

function generatePricingMap(categoryContext) {
  if (!categoryContext || !categoryContext.apps) return null;

  const apps = categoryContext.apps;
  const freeCount = apps.filter(a => (a.price || 0) === 0).length;
  const paidApps = apps.filter(a => (a.price || 0) > 0);
  const paidPrices = paidApps.map(a => a.price).sort((a, b) => a - b);

  const freeRatio = Math.round((freeCount / apps.length) * 100);
  const medianPrice = paidPrices.length > 0 ? paidPrices[Math.floor(paidPrices.length / 2)] : 0;
  const avgPrice = paidPrices.length > 0 ? (paidPrices.reduce((a, b) => a + b, 0) / paidPrices.length) : 0;

  return {
    totalApps: apps.length,
    freeRatio,
    paidCount: paidApps.length,
    medianPrice,
    avgPrice: Math.round(avgPrice * 100) / 100,
  };
}

// ── 3. Feature Gap Mining (structured: complaints + requests) ──

function extractFeatureGaps(reviews) {
  if (!reviews || reviews.length === 0) return { complaints: [], requests: [] };

  const requestPatterns = [
    /\bwish\b/i, /\bwant\b/i, /\bneed\b/i, /\bhope\b/i,
    /\bshould\b/i, /\bcould\b/i, /\bmissing\b/i, /\badd\b/i,
    /\bwhy (?:doesn't|does not|no|can't|isn't)/i, /\bplease\b/i,
    /\bwould be (?:nice|great|helpful|good)/i, /\bit would be great/i,
    /\bif only\b/i, /\bneeds? to\b/i, /\ballow\b/i, /\bsupport\b/i,
  ];

  const complaintPatterns = [
    /\bbroken\b/i, /\bterrible\b/i, /\bworst\b/i, /\buseless\b/i,
    /\bfrustrating\b/i, /\bannoying\b/i, /\bcrash\b/i, /\bbug/i,
    /\bslow\b/i, /\bwaste\b/i, /\bdisappointed\b/i, /\bhate\b/i,
    /\bdoesn't work\b/i, /\bdoes not work\b/i, /\bkeeps crashing\b/i,
    /\bunusable\b/i, /\bgarbage\b/i, /\bhorrible\b/i, /\bawful\b/i,
    /\brobble\b/i, /\blost\b/i, /\berased\b/i, /\bdeleted\b/i,
  ];

  const stopWords = new Set(['i','me','my','we','our','you','your','it','its','the','a','an',
    'and','or','but','is','are','was','were','be','been','have','has','had','do','does','did',
    'will','would','could','should','may','might','can','to','of','in','for','on','with','at',
    'by','from','as','into','through','during','before','after','above','below','between',
    'this','that','these','those','am','if','then','else','when','up','out','just','about',
    'so','than','too','very','not','no','also','only','own','same','other','more','most',
    'some','any','all','both','each','few','many','much','such','what','which','who','how',
    'when','where','why','here','there','therefore','because','since','until','while','still',
    'even','like','get','got','make','made','much','really','back','way','thing','things',
    'use','using','used','app','application','one','two','new','time','update','work']);

  function extractPhrases(sentence) {
    const words = sentence.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
    const meaningful = words.filter(w => w.length > 3 && !stopWords.has(w));
    const counts = {};

    for (let i = 0; i < meaningful.length - 1; i++) {
      const phrase = meaningful[i] + ' ' + meaningful[i + 1];
      counts[phrase] = (counts[phrase] || 0) + 1;
    }
    meaningful.forEach(w => {
      if (w.length > 4) counts[w] = (counts[w] || 0) + 1;
    });

    return counts;
  }

  const complaintCounts = {};
  const requestCounts = {};

  reviews.forEach(review => {
    const content = review.content || '';
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

    sentences.forEach(sentence => {
      const isRequest = requestPatterns.some(p => p.test(sentence));
      const isComplaint = complaintPatterns.some(p => p.test(sentence));

      const phrases = extractPhrases(sentence);

      if (isComplaint) {
        Object.entries(phrases).forEach(([phrase, count]) => {
          complaintCounts[phrase] = (complaintCounts[phrase] || 0) + count;
        });
      }
      if (isRequest) {
        Object.entries(phrases).forEach(([phrase, count]) => {
          requestCounts[phrase] = (requestCounts[phrase] || 0) + count;
        });
      }
    });
  });

  function sortAndSlice(counts, minCount, maxItems) {
    return Object.entries(counts)
      .filter(([_, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([phrase, count]) => ({ feature: phrase, count }));
  }

  return {
    complaints: sortAndSlice(complaintCounts, 2, 5),
    requests: sortAndSlice(requestCounts, 2, 5),
  };
}

// ── 4. MVP Feature Suggestions ───────────────

function generateMVPFeatures(app, featureGaps) {
  const desc = (app.description || '').toLowerCase();

  // Detect what the competitor already does
  const baselineFeatures = [];
  const featureHints = [
    { patterns: ['track', 'log', 'record', 'journal'], label: '数据记录' },
    { patterns: ['remind', 'notification', 'alert'], label: '提醒通知' },
    { patterns: ['sync', 'cloud', 'backup'], label: '云同步' },
    { patterns: ['share', 'export', 'pdf', 'csv'], label: '导出分享' },
    { patterns: ['customize', 'personalize', 'theme'], label: '个性化定制' },
    { patterns: ['chart', 'graph', 'statistic', 'analytics', 'report'], label: '数据统计' },
    { patterns: ['timer', 'countdown', 'stopwatch'], label: '计时器' },
    { patterns: ['calendar', 'schedule', 'planner'], label: '日程规划' },
    { patterns: ['search', 'filter', 'sort'], label: '搜索筛选' },
    { patterns: ['folder', 'category', 'tag', 'label'], label: '分类管理' },
  ];

  featureHints.forEach(hint => {
    if (hint.patterns.some(p => desc.includes(p))) {
      baselineFeatures.push(hint.label);
    }
  });

  // Must-have: top feature gaps (handle both old array and new object format)
  const gaps = Array.isArray(featureGaps) ? featureGaps : (featureGaps.requests || []);
  const mustHave = gaps.slice(0, 3).map(g => g.feature);

  // Nice-to-have: iOS platform features
  const niceToHave = [];
  if (!desc.includes('widget')) niceToHave.push('桌面小组件');
  if (!desc.includes('shortcut') && !desc.includes('siri')) niceToHave.push('快捷指令/Siri 集成');
  if (!desc.includes('live activity') && !desc.includes('dynamic island')) niceToHave.push('实时活动/灵动岛');
  if (!desc.includes('apple watch')) niceToHave.push('Apple Watch 配套');
  if (!desc.includes('icloud')) niceToHave.push('iCloud 同步');

  return {
    mustHave: mustHave.length > 0 ? mustHave : ['核心功能（需调研确认）'],
    baseline: baselineFeatures.length > 0 ? baselineFeatures.slice(0, 5) : ['基础 CRUD 功能'],
    niceToHave: niceToHave.slice(0, 3),
  };
}

// ── 5. User Persona Sketch ───────────────────

function generatePersona(app, reviews) {
  const text = [
    app.description || '',
    ...reviews.map(r => `${r.title || ''} ${r.content || ''}`),
  ].join(' ').toLowerCase();

  const persona = {
    segments: [],
    tone: '',
    summary: '',
  };

  // Detect user segments
  const segments = [
    { patterns: ['professional', 'work', 'business', 'office', 'meeting', 'project', 'team', 'colleague'], label: '职场人士', desc: '追求效率和时间管理的上班族' },
    { patterns: ['student', 'study', 'exam', 'homework', 'class', 'school', 'teacher', 'college'], label: '学生群体', desc: '需要简洁工具辅助学习的学生' },
    { patterns: ['parent', 'baby', 'child', 'kid', 'family', 'mom', 'dad'], label: '家长用户', desc: '关注家庭和育儿需求的年轻父母' },
    { patterns: ['fitness', 'health', 'workout', 'exercise', 'gym', 'diet', 'calorie', 'weight'], label: '健康关注者', desc: '重视身体管理和健康数据的运动人群' },
    { patterns: ['travel', 'trip', 'vacation', 'flight', 'hotel', 'tourist'], label: '旅行者', desc: '频繁出行或计划旅行的用户' },
    { patterns: ['creative', 'design', 'art', 'photo', 'draw', 'write', 'music'], label: '创意工作者', desc: '有创作需求的摄影师/设计师/写作者' },
    { patterns: ['money', 'budget', 'finance', 'invest', 'save', 'expense', 'debt'], label: '理财用户', desc: '关注个人财务和支出管理的人群' },
    { patterns: ['meditation', 'mindful', 'anxiety', 'stress', 'sleep', 'relax', 'calm'], label: '身心调养者', desc: '关注心理健康和减压的用户' },
  ];

  segments.forEach(seg => {
    const matchCount = seg.patterns.filter(p => text.includes(p)).length;
    if (matchCount >= 2) persona.segments.push(seg);
  });

  if (persona.segments.length === 0) {
    persona.segments.push({ label: '通用工具用户', desc: '需求明确、追求简洁实用的普通用户' });
  }

  // Detect sentiment/tone
  const negativeWords = ['frustrated', 'annoyed', 'terrible', 'worst', 'hate', 'angry', 'disappointed'];
  const positiveWords = ['love', 'great', 'amazing', 'excellent', 'perfect', 'best', 'wonderful'];
  const negCount = negativeWords.filter(w => text.includes(w)).length;
  const posCount = positiveWords.filter(w => text.includes(w)).length;

  if (negCount > posCount + 2) {
    persona.tone = '用户普遍不满，情绪偏负面 — 这意味着只要做出好产品就能快速赢得口碑';
  } else if (posCount > negCount + 2) {
    persona.tone = '用户整体满意度尚可，需要找到更精准的差异化切入点';
  } else {
    persona.tone = '用户评价两极分化 — 部分人满意部分人不满意，说明产品方向对但执行有问题';
  }

  persona.summary = `主要用户为${persona.segments.map(s => s.label).join('和')}。${persona.segments[0]?.desc || ''}。`;

  return persona;
}

// ── 6. Sentiment Trend ───────────────────────

function analyzeSentimentTrend(reviews) {
  if (!reviews || reviews.length < 3) return null;

  // Sort by date
  const sorted = [...reviews]
    .filter(r => r.date && r.rating)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (sorted.length < 3) return null;

  // Group by month
  const monthly = {};
  sorted.forEach(r => {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthly[key]) monthly[key] = [];
    monthly[key].push(r.rating);
  });

  // Calculate monthly averages
  const months = Object.entries(monthly)
    .map(([month, ratings]) => ({
      month,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (months.length < 2) return null;

  // Determine trend
  const recent = months.slice(-3);
  const older = months.slice(0, Math.max(1, months.length - 3));
  const recentAvg = recent.reduce((s, m) => s + m.avg, 0) / recent.length;
  const olderAvg = older.reduce((s, m) => s + m.avg, 0) / older.length;

  let trend, trendLabel, trendDesc;
  if (recentAvg < olderAvg - 0.3) {
    trend = 'declining';
    trendLabel = '下降';
    trendDesc = '用户满意度在下降 — 竞品在恶化，这是你进入的好时机';
  } else if (recentAvg > olderAvg + 0.3) {
    trend = 'improving';
    trendLabel = '上升';
    trendDesc = '用户满意度在改善 — 竞品在变好，你需要更快的执行速度';
  } else {
    trend = 'stable';
    trendLabel = '平稳';
    trendDesc = '用户情绪整体平稳 — 市场格局相对固化，需要较强的差异化才能突破';
  }

  return { months, trend, trendLabel, trendDesc, recentAvg, olderAvg };
}

// ── 7. Risk Assessment + Entry Strategy ──────

function generateRiskAndStrategy(app, insights, categoryContext) {
  const risks = [];
  const strategies = [];

  const rating = app.averageUserRating || 5;
  const count = app.userRatingCount || 0;
  const price = app.price || 0;
  const isFree = price === 0;
  const lastUpdate = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null;
  const daysSince = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000*60*60*24)) : 0;
  const desc = (app.description || '').toLowerCase();
  const totalApps = categoryContext?.totalApps || 0;
  const pricing = generatePricingMap(categoryContext);

  // ── Risk Detection ──

  if (rating > 4.2 && daysSince < 180) {
    risks.push({ level: 'high', text: '头部产品评分高且更新勤，需要明确的差异化才能切入' });
  }

  if (count > 50000) {
    risks.push({ level: 'medium', text: '市场已充分竞争，获客成本可能较高，需要精准的 ASO 策略' });
  }

  if (desc.includes('ai') || desc.includes('machine learning') || desc.includes('cloud')) {
    risks.push({ level: 'medium', text: '可能需要后端基础设施，技术复杂度和运维成本较高' });
  }

  if (totalApps > 100) {
    risks.push({ level: 'medium', text: '竞争密度高，ASO 优化和口碑传播缺一不可' });
  }

  if (price > 9.99) {
    risks.push({ level: 'low', text: '高端定价区间，用户期望高，需要精致的 UI/UX 和稳定的体验' });
  }

  if (isFree && count > 10000) {
    risks.push({ level: 'medium', text: '免费主导的市场，付费转化率可能偏低，建议用免费增值模式' });
  }

  if (rating > 4.0 && count > 5000 && daysSince < 90) {
    risks.push({ level: 'high', text: '竞品强势（高分+活跃+大量用户），切入难度大' });
  }

  // ── Entry Strategy ──

  if (rating < 3.0 && count > 1000) {
    strategies.push({
      type: '极简版',
      desc: '竞品评分低说明核心体验有问题。做一个只聚焦 1-2 个核心功能的极简版，把体验做到极致',
      fit: 'high',
    });
    strategies.push({
      type: '专业版',
      desc: '用户抱怨功能不足，做一个功能更丰富的版本，满足高级用户需求',
      fit: 'medium',
    });
  }

  if (daysSince > 365) {
    strategies.push({
      type: '现代版',
      desc: '竞品久未更新，用 SwiftUI 重做，支持 Widget / 快捷指令 / Live Activity 等 iOS 新特性',
      fit: 'high',
    });
  }

  if (pricing && pricing.freeRatio > 70) {
    strategies.push({
      type: '付费精简版',
      desc: `类别中 ${pricing.freeRatio}% 为免费应用，做一个 $3.99 一次性购买的"无广告无订阅"版本`,
      fit: 'high',
    });
  } else if (pricing && pricing.freeRatio < 40) {
    strategies.push({
      type: '免费增值版',
      desc: '市场以付费为主，做免费基础版快速获取用户，再通过 Pro 内购变现',
      fit: 'high',
    });
  }

  // Check if description is English-only (no Chinese localization)
  const hasChinese = /[\u4e00-\u9fff]/.test(app.description || '');
  if (!hasChinese) {
    strategies.push({
      type: '本地化版',
      desc: '竞品无中文支持，做中文本地化版本切入华人市场',
      fit: 'medium',
    });
  }

  // Deduplicate and limit
  const uniqueRisks = risks.slice(0, 4);
  const uniqueStrategies = strategies.slice(0, 3);

  // Fallback if nothing detected
  if (uniqueStrategies.length === 0) {
    uniqueStrategies.push({
      type: '调研验证',
      desc: '建议先做最小原型验证需求，通过社区反馈确认方向后再投入开发',
      fit: 'medium',
    });
  }

  return { risks: uniqueRisks, strategies: uniqueStrategies };
}
