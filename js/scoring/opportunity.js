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

function formatReviewScale(count) {
  if (count >= 10000) return `${Math.round(count / 1000)}K+`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatStalePeriod(days) {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months > 0 ? `${years} 年 ${months} 个月` : `${years} 年`;
  }
  if (days >= 30) return `${Math.floor(days / 30)} 个月`;
  return `${days} 天`;
}

function generateInsights(app, categoryContext) {
  const insights = [];
  const rating = app.averageUserRating;
  const count = app.userRatingCount || 0;
  const lastUpdate = app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate) : null;
  const daysSince = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const price = app.price || 0;
  const isFree = price === 0;
  const totalApps = categoryContext?.totalApps || 0;
  const pricing = generatePricingMap(categoryContext);
  const heat = categoryContext?.heat;

  // 1. Market scale (review count as demand proxy)
  if (count > 50000) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      priority: 80,
      title: `评论量 ${formatReviewScale(count)}，需求已被充分验证`,
      detail: `${count.toLocaleString()} 条评论说明大量用户尝试过这类产品。市场教育成本低，但获客竞争也更激烈——需要明确差异化，而不是简单复制功能。`,
    });
  } else if (count > 5000) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      priority: 75,
      title: `评论量 ${count.toLocaleString()}，具备稳定用户基础`,
      detail: `中等评论量级通常对独立开发者较友好：需求真实存在，又不像头部品类那样被大厂牢牢占据。适合聚焦 1–2 个核心场景做深。`,
    });
  } else if (count > 500) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      priority: 65,
      title: `评论量 ${count.toLocaleString()}，偏垂直小众`,
      detail: `用户群规模有限，天花板需要提前评估。优势是竞争压力通常较小，适合做成体验精致、定价清晰的工具型产品。`,
    });
  } else if (count > 0) {
    insights.push({
      dimension: 'market',
      label: '市场规模',
      priority: 50,
      title: `评论量仅 ${count} 条，市场验证不足`,
      detail: `数据样本偏少，可能是早期产品，也可能是伪需求。建议结合搜索热度、相关社区讨论再做判断，避免仅凭直觉投入。`,
    });
  }

  // 2. Competitor quality
  if (rating && rating < 2.5) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      priority: 95,
      title: `评分 ${rating.toFixed(1)} 分，用户满意度极低`,
      detail: `大量差评通常指向核心体验缺陷（崩溃、卡顿、功能缺失等）。若你能稳定解决主痛点，口碑转化会快于冷启动获客。`,
    });
  } else if (rating && rating < 3.5) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      priority: 85,
      title: `评分 ${rating.toFixed(1)} 分，体验有明显短板`,
      detail: `产品可用但不够好——常见问题是 UI 陈旧、关键功能缺失或 Bug 反复出现。结合下方用户抱怨，可以反推 MVP 优先级。`,
    });
  } else if (rating && rating < 4.0) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      priority: 55,
      title: `评分 ${rating.toFixed(1)} 分，处于及格线`,
      detail: `用户尚未完全流失，但已有不满信号。需要找到具体短板（而非全面复制），在 1–2 个关键体验上做到明显更好。`,
    });
  } else if (rating && rating >= 4.0) {
    insights.push({
      dimension: 'quality',
      label: '竞品质量',
      priority: 30,
      title: `评分 ${rating.toFixed(1)} 分，竞品口碑较好`,
      detail: `正面评价占主导，单纯「做得更好」难度较高。更可行的路径是细分人群、新场景或平台特性（Widget、快捷指令等）差异化。`,
    });
  }

  // 3. Maintenance status
  if (daysSince !== null && daysSince > 730) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      priority: 90,
      title: `${formatStalePeriod(daysSince)}未更新，维护基本停滞`,
      detail: `长期不更新的应用往往无法适配新 iOS 能力，兼容性和体验会逐渐落后。新应用可在「最近更新」和系统特性支持上快速建立优势。`,
    });
  } else if (daysSince !== null && daysSince > 365) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      priority: 88,
      title: `${formatStalePeriod(daysSince)}未更新，维护明显放缓`,
      detail: `更新停滞通常意味着团队精力转移或产品进入维护模式。Widget、快捷指令、Live Activity 等能力可作为切入角度。`,
    });
  } else if (daysSince !== null && daysSince > 180) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      priority: 60,
      title: `${formatStalePeriod(daysSince)}未更新，节奏偏慢`,
      detail: `不算完全放弃，但迭代频率偏低。若能在新 iOS 版本发布窗口快速跟进，有机会在搜索排序上获得短期红利。`,
    });
  } else if (daysSince !== null && daysSince <= 90) {
    insights.push({
      dimension: 'maintenance',
      label: '维护状态',
      priority: 35,
      title: `近 ${formatStalePeriod(daysSince)}内有更新，维护活跃`,
      detail: `竞品仍在持续投入，功能差距可能随时间缩小。需要更快的产品迭代节奏或更清晰的差异化定位。`,
    });
  }

  // 4. Pricing strategy (context-aware)
  if (isFree) {
    if (pricing && pricing.freeRatio > 70) {
      insights.push({
        dimension: 'pricing',
        label: '价格策略',
        priority: 62,
        title: `免费竞品为主（类别中 ${pricing.freeRatio}% 免费）`,
        detail: `用户习惯免费下载，直接做付费下载难度较大。可考虑一次性买断（$2.99–$4.99）强调无广告无订阅，或免费基础版 + Pro 解锁。`,
      });
    } else {
      insights.push({
        dimension: 'pricing',
        label: '价格策略',
        priority: 58,
        title: `该竞品免费，变现模式待验证`,
        detail: `免费应用通常依赖广告或内购。可评估用户是否愿意为「干净体验」付费，或采用免费试用 + 订阅/买断组合。`,
      });
    }
  } else if (pricing && pricing.medianPrice > 0) {
    insights.push({
      dimension: 'pricing',
      label: '价格策略',
      priority: 58,
      title: `售价 $${price.toFixed(2)}，类别付费中位数 $${pricing.medianPrice.toFixed(2)}`,
      detail: `用户已有付费习惯。定价可参考中位数：显著高于中位数需更强体验支撑，低于中位数则利于早期获客。`,
    });
  } else {
    insights.push({
      dimension: 'pricing',
      label: '价格策略',
      priority: 55,
      title: `售价 $${price.toFixed(2)}，存在付费意愿`,
      detail: `付费下载说明用户认可产品价值。可用略低定价或免费增值模式测试转化，再逐步调整价格带。`,
    });
  }

  // 5. Pain points (only when quality insight is weak)
  const hasStrongQualityInsight = rating && rating < 3.5;
  if (!hasStrongQualityInsight && rating && rating < 4.0) {
    const desc = (app.description || '').toLowerCase();
    let painTitle = '评分一般，具体痛点需看用户评论';
    if (desc.includes('subscription') || desc.includes('premium')) {
      painTitle = '订阅/付费设计可能是主要不满来源';
    } else if (desc.includes('free') || desc.includes('no ads')) {
      painTitle = '宣传无广告但评分不高，实际体验可能打折扣';
    }
    insights.push({
      dimension: 'pain',
      label: '用户痛点',
      priority: 45,
      title: painTitle,
      detail: `评分 ${rating.toFixed(1)} 分本身信息有限，下方差评摘录更能反映真实问题——建议从中提炼 2–3 个必做功能。`,
    });
  }

  // 6. Competition density (search result count, not full App Store)
  if (totalApps > 0) {
    if (totalApps > 100) {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        priority: 70,
        title: `本次搜索发现 ${totalApps}+ 款同类应用`,
        detail: `结果数量多说明方向已被反复验证，也是红海信号。建议收窄子场景（人群/平台/工作流），而不是做「全能版」竞品。`,
      });
    } else if (totalApps > 30) {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        priority: 68,
        title: `本次搜索发现 ${totalApps} 款同类应用`,
        detail: `竞争适中：有足够参考样本，也仍有差异化空间。独立开发者常见的舒适区间，重点是把核心体验做扎实。`,
      });
    } else {
      insights.push({
        dimension: 'competition',
        label: '竞争密度',
        priority: 55,
        title: `本次搜索仅 ${totalApps} 款应用，竞品较少`,
        detail: `竞争者少不等于机会大——也可能是市场太小或需求不明确。需结合评论量和搜索热度交叉验证。`,
      });
    }
  }

  // 7. Search heat (when available)
  if (heat) {
    const heatPriority = heat.level === 'hot' ? 78 : heat.level === 'warm' ? 72 : 40;
    insights.push({
      dimension: 'heat',
      label: '搜索热度',
      priority: heatPriority,
      title: `热度 ${heat.score} · ${heat.label}`,
      detail: heat.level === 'hot'
        ? `搜索侧需求活跃，新品更容易获得自然曝光。但热度高也意味着更多团队盯上同一方向，执行速度很重要。`
        : heat.level === 'warm'
        ? `搜索需求稳定，适合长期经营型产品。不必追求爆发式增长，打磨留存和口碑更关键。`
        : `搜索偏冷，获客可能依赖 ASO 长尾词或外部渠道。适合低维护成本的小工具，不适合重运营产品。`,
    });
  }

  if (insights.length === 0) {
    return [{
      dimension: 'market',
      label: '综合评估',
      priority: 0,
      title: '暂无显著机会信号',
      detail: '当前数据未触发主要阈值。建议对比同类应用、查看差评摘录，或换一个关键词/类别重新扫描。',
    }];
  }

  return insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ priority, ...rest }) => rest);
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
    if (rating < 3.5) reasons.push('竞品体验差');
    if (daysSince > 365) reasons.push('久未更新');
    if (count > 5000) reasons.push('需求已验证');
    else if (count > 500) reasons.push('有稳定用户群');
    return {
      verdict: 'go',
      label: '值得做',
      color: 'var(--accent)',
      bg: 'var(--bg-card)',
      reason: reasons.length > 0
        ? reasons.join('、') + ' — 机会信号较强，值得深入调研并做小范围验证'
        : '综合评分较高 — 建议结合差评和搜索热度做最后确认',
    };
  } else if (score >= 40 || signals >= 2) {
    return {
      verdict: 'maybe',
      label: '可以考虑',
      color: 'var(--warning)',
      bg: 'var(--warning-bg)',
      reason: '有机会但不明显 — 建议先做原型或落地页验证，再决定是否全职投入',
    };
  } else {
    return {
      verdict: 'no',
      label: '不建议',
      color: 'var(--text-tertiary)',
      bg: 'var(--bg-raised)',
      reason: '机会信号偏弱 — 竞品强势或市场验证不足，投入产出比可能不理想',
    };
  }
}

// ── 2. Revenue Estimation ────────────────────

function generateRevenueEstimate(app, categoryContext) {
  const reviewCount = app.userRatingCount || 0;
  const isFree = (app.price || 0) === 0;
  const pricing = generatePricingMap(categoryContext);

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
    priceRecommendation = pricing && pricing.freeRatio > 70
      ? `类别以免费为主（${pricing.freeRatio}%），建议 $3.99–$4.99 一次性买断，或免费基础版 + Pro 解锁。`
      : '建议 $2.99–$4.99 一次性买断主打无广告，或免费试用 + 订阅/买断组合。';
  } else if (app.price < 2) {
    priceRecommendation = pricing && pricing.medianPrice > 0
      ? `当前 $${app.price.toFixed(2)} 低于类别中位数 $${pricing.medianPrice.toFixed(2)}，可维持低价获客或试探 $2.99–$3.99。`
      : '当前价位偏低，工具类常见区间为 $2.99–$6.99，可按功能深度逐步提价。';
  } else {
    priceRecommendation = pricing && pricing.medianPrice > 0
      ? `当前 $${app.price.toFixed(2)}，类别中位数 $${pricing.medianPrice.toFixed(2)} — 定价合理，差异化比降价更重要。`
      : `当前 $${app.price.toFixed(2)} 在常见区间内，可配合免费增值模式扩大用户基数。`;
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
    persona.tone = '用户评价偏负面 — 若解决核心痛点，口碑增长可能快于付费投放';
  } else if (posCount > negCount + 2) {
    persona.tone = '用户整体满意度尚可 — 需要更精准的细分定位，而非正面硬刚';
  } else {
    persona.tone = '评价两极分化 — 产品方向可能正确，但执行质量不稳定，可从差评高频词切入';
  }

  persona.summary = `主要面向${persona.segments.map(s => s.label).join('、')}。${persona.segments[0]?.desc || ''}`;

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
    trendDesc = '近期评分走低 — 竞品体验在恶化，窗口期有限，需尽快验证 MVP';
  } else if (recentAvg > olderAvg + 0.3) {
    trend = 'improving';
    trendLabel = '上升';
    trendDesc = '近期评分回升 — 竞品在修复问题，差异化空间在缩小，执行速度是关键';
  } else {
    trend = 'stable';
    trendLabel = '平稳';
    trendDesc = '情绪整体平稳 — 格局相对固化，需要明确细分场景或平台特性才能突围';
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
    risks.push({ level: 'high', text: '头部竞品高分且更新勤，需有清晰差异化，否则很难获得初始用户' });
  }

  if (count > 50000) {
    risks.push({ level: 'medium', text: '评论量大意味着竞争激烈，自然获客成本高，ASO 和口碑策略要前置规划' });
  }

  if (desc.includes('ai') || desc.includes('machine learning') || desc.includes('cloud')) {
    risks.push({ level: 'medium', text: '可能依赖后端或 AI 服务，开发与运维成本高于纯客户端工具' });
  }

  if (totalApps > 100) {
    risks.push({ level: 'medium', text: '同类应用多，排名波动大，需持续优化关键词和转化页' });
  }

  if (price > 9.99) {
    risks.push({ level: 'low', text: '高价区间用户预期高，UI/UX 和稳定性必须匹配定价' });
  }

  if (isFree && count > 10000) {
    risks.push({ level: 'medium', text: '免费主导市场，付费转化通常偏低，变现模型需提前设计' });
  }

  if (rating > 4.0 && count > 5000 && daysSince < 90) {
    risks.push({ level: 'high', text: '竞品强势（高分 + 活跃 + 大用户群），正面竞争难度大' });
  }

  // ── Entry Strategy ──

  if (rating < 3.0 && count > 1000) {
    strategies.push({
      type: '极简版',
      desc: '聚焦 1–2 个核心场景，把稳定性和速度做到极致，用「少而精」对抗功能堆砌',
      fit: 'high',
    });
    strategies.push({
      type: '专业版',
      desc: '面向高级用户的深度功能（批量操作、导出、自动化），服务愿意付费的细分人群',
      fit: 'medium',
    });
  }

  if (daysSince > 365) {
    strategies.push({
      type: '现代版',
      desc: '用 SwiftUI 重做，优先支持 Widget、快捷指令、Live Activity 等系统能力',
      fit: 'high',
    });
  }

  if (pricing && pricing.freeRatio > 70) {
    strategies.push({
      type: '付费精简版',
      desc: `类别 ${pricing.freeRatio}% 为免费 — 尝试 $3.99 一次性买断，强调无广告、无订阅`,
      fit: 'high',
    });
  } else if (pricing && pricing.freeRatio < 40) {
    strategies.push({
      type: '免费增值版',
      desc: '市场以付费为主 — 免费基础版拉新，Pro 内购解锁高级功能',
      fit: 'high',
    });
  }

  const hasChinese = /[\u4e00-\u9fff]/.test(app.description || '');
  if (!hasChinese) {
    strategies.push({
      type: '本地化版',
      desc: '竞品描述无中文 — 中文界面 + 本地化 ASO 可切入华语用户',
      fit: 'medium',
    });
  }

  // Deduplicate and limit
  const uniqueRisks = risks.slice(0, 4);
  const uniqueStrategies = strategies.slice(0, 3);

  if (uniqueStrategies.length === 0) {
    uniqueStrategies.push({
      type: '调研验证',
      desc: '先做最小原型或 TestFlight 小范围测试，用真实反馈确认需求再扩大投入',
      fit: 'medium',
    });
  }

  return { risks: uniqueRisks, strategies: uniqueStrategies };
}
