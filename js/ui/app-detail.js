const AppDetail = {
  el: null,
  currentApp: null,
  currentCategoryContext: null,
  reviewsTranslated: false,
  sentimentChartInstance: null,

  init() {
    this.el = document.getElementById('appDetail');
    document.getElementById('btnTranslateAll').addEventListener('click', () => {
      this.translateAll();
    });
  },

  setCategoryContext(context) {
    this.currentCategoryContext = context;
  },

  async show(app) {
    if (!app._scores && this.currentCategoryContext) {
      app = scoreApp(app, this.currentCategoryContext);
    }
    this.currentApp = app;
    this.reviewsTranslated = false;
    this.el.classList.add('active');
    this.el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Report date
    const now = new Date();
    document.getElementById('reportDate').textContent =
      `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

    // Basic info
    document.getElementById('appIcon').src = app.artworkUrl512 || app.artworkUrl60 || '';
    document.getElementById('appName').textContent = app.trackName || '未知应用';
    document.getElementById('appDeveloper').textContent = app.sellerName || app.artistName || '';

    document.getElementById('appRating').textContent = app.averageUserRating
      ? app.averageUserRating.toFixed(1) : 'N/A';
    document.getElementById('appRatingCount').textContent = app.userRatingCount
      ? app.userRatingCount.toLocaleString() : '0';

    if (app.currentVersionReleaseDate) {
      const d = new Date(app.currentVersionReleaseDate);
      document.getElementById('appLastUpdate').textContent =
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } else {
      document.getElementById('appLastUpdate').textContent = 'N/A';
    }

    const scoreEl = document.getElementById('appOppScore');
    if (app._scores) {
      scoreEl.textContent = app._scores.normalized;
      scoreEl.style.color =
        app._scores.level === 'high' ? 'var(--success)' :
        app._scores.level === 'medium' ? 'var(--warning)' : 'var(--danger)';
    } else {
      scoreEl.textContent = '-';
    }

    document.getElementById('appStoreLink').href =
      `https://apps.apple.com/us/app/id${app.trackId}`;

    const dl = estimateDownloads(app, this.currentCategoryContext);
    document.getElementById('appEstDownloads').textContent = formatDownloads(dl.displayMonthly);

    const heat = this.currentCategoryContext?.heat;
    const heatEl = document.getElementById('appHeatScore');
    if (heat) {
      heatEl.textContent = heat.score;
      heatEl.style.color = HEAT_LABELS[heat.level]?.color || 'inherit';
    } else {
      heatEl.textContent = '-';
    }

    this.renderDownloads(app);
    const insights = generateInsights(app, this.currentCategoryContext);
    this.renderVerdict(app, insights);
    this.renderScoreBreakdown(app);
    this.renderInsights(insights);
    this.renderRevenue(app);
    this.renderRiskAndStrategy(app, insights);

    // ── Async: load reviews then render review-dependent features ──
    const reviewSection = document.getElementById('reviewSection');
    const reviewKeywords = document.getElementById('reviewKeywords');
    const reviewQuotes = document.getElementById('reviewQuotes');
    reviewSection.style.display = 'none';
    reviewKeywords.innerHTML = '';
    reviewQuotes.innerHTML = '';

    // Hide review-dependent sections
    ['featureGapSection', 'mvpSection', 'personaSection', 'sentimentSection'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    try {
      const reviews = await fetchReviews(app.trackId);
      if (reviews.length > 0) {
        // Feature gaps (now returns { complaints, requests })
        const featureGaps = extractFeatureGaps(reviews);
        this.renderFeatureGaps(featureGaps);

        // MVP
        this.renderMVP(app, featureGaps);

        // Persona
        this.renderPersona(app, reviews);

        // Sentiment
        const sentiment = analyzeSentimentTrend(reviews);
        this.renderSentiment(sentiment);

        // Reviews (existing)
        reviewSection.style.display = 'block';
        this.renderReviews(reviews);
      }
    } catch {
      // Reviews not available
    }
  },

  // ── 1. Verdict ──

  renderVerdict(app, insights) {
    const container = document.getElementById('verdictBanner');
    const verdict = generateVerdict(app, insights);

    container.style.background = verdict.bg;
    container.style.color = verdict.color;
    container.innerHTML = `
      <span class="verdict-badge">${verdict.label}</span>
      <div class="verdict-reason">
        <strong>${verdict.reason}</strong>
      </div>
    `;
  },

  // ── 2. Score Breakdown (5 dimensions + radar) ──

  renderScoreBreakdown(app) {
    const container = document.getElementById('scoreBreakdown');
    if (!app._scores) { container.innerHTML = ''; return; }

    const scores = app._scores;
    const maxPerDim = 5;

    const dims = [
      { key: 'demand', label: '市场需求', value: scores.demand, color: 'demand', hint: `${(app.userRatingCount || 0).toLocaleString()} 条评论` },
      { key: 'quality', label: '竞品质量', value: scores.quality, color: 'quality', hint: app.averageUserRating ? `评分 ${app.averageUserRating.toFixed(1)}` : '无评分' },
      { key: 'freshness', label: '维护活跃', value: scores.freshness, color: 'freshness', hint: app.currentVersionReleaseDate ? `${Math.floor((Date.now() - new Date(app.currentVersionReleaseDate).getTime()) / (1000*60*60*24))} 天前更新` : '未知' },
      { key: 'pain', label: '痛点强度', value: scores.pain, color: 'pain', hint: app.averageUserRating ? `基于评分 ${app.averageUserRating.toFixed(1)}` : '无数据' },
      { key: 'monetization', label: '变现潜力', value: scores.monetization, color: 'monetization', hint: (app.price || 0) === 0 ? '免费市场' : `$${app.price.toFixed(2)} 付费` },
      { key: 'heat', label: '搜索热度', value: scores.heat || 0, color: 'heat', hint: this.currentCategoryContext?.heat ? `${this.currentCategoryContext.heat.score} · ${this.currentCategoryContext.heat.label}` : '无数据' },
    ];

    container.innerHTML = `
      <div class="radar-chart-container">
        <canvas id="radarChart"></canvas>
      </div>
      <div class="score-breakdown-header">
        <span class="total-label">机会分数</span>
        <span>
          <span class="total-score">${scores.normalized}</span>
          <span class="total-max">/ 100</span>
        </span>
      </div>
      ${dims.map(d => `
        <div class="score-dim">
          <span class="dim-label">${d.label}</span>
          <div class="dim-bar-track">
            <div class="dim-bar-fill ${d.color}" style="width: ${(d.value / maxPerDim) * 100}%"></div>
          </div>
          <span class="dim-value">${d.value.toFixed(1)}</span>
          <span class="dim-hint">${d.hint}</span>
        </div>
      `).join('')}
    `;

    // Now render radar chart into the freshly created canvas
    renderRadarChart(app);
  },

  // ── 3. Insights ──

  renderInsights(insights) {
    const container = document.getElementById('insightItems');
    container.innerHTML = insights.map(item => `
      <div class="insight-item">
        <span class="insight-label ${item.dimension}">${item.label}</span>
        <div class="insight-title">${item.title}</div>
        <div class="insight-detail">${item.detail}</div>
      </div>
    `).join('');
  },

  // ── Downloads estimate ──

  renderDownloads(app) {
    const section = document.getElementById('downloadsSection');
    const content = document.getElementById('downloadsContent');
    const disclaimer = document.getElementById('downloadsDisclaimer');
    const dl = estimateDownloads(app, this.currentCategoryContext);

    section.style.display = 'block';
    content.innerHTML = `
      <div class="revenue-grid">
        <div class="revenue-item">
          <div class="revenue-label">保守估月下载</div>
          <div class="revenue-value">${dl.conservative.monthly.toLocaleString()}</div>
        </div>
        <div class="revenue-item">
          <div class="revenue-label">中性估月下载</div>
          <div class="revenue-value highlight">${dl.neutral.monthly.toLocaleString()}</div>
        </div>
        <div class="revenue-item">
          <div class="revenue-label">乐观估月下载</div>
          <div class="revenue-value">${dl.optimistic.monthly.toLocaleString()}</div>
        </div>
        <div class="revenue-item">
          <div class="revenue-label">估总下载</div>
          <div class="revenue-value">${dl.neutral.total.toLocaleString()}</div>
        </div>
      </div>
    `;
    disclaimer.textContent = dl.disclaimer;
  },

  // ── 4. Revenue ──

  renderRevenue(app) {
    const section = document.getElementById('revenueSection');
    const content = document.getElementById('revenueContent');
    const est = generateRevenueEstimate(app, this.currentCategoryContext);
    const pricing = generatePricingMap(this.currentCategoryContext);

    section.style.display = 'block';

    let pricingHtml = '';
    if (pricing) {
      pricingHtml = `
        <div class="revenue-grid">
          <div class="revenue-item">
            <div class="revenue-label">类别免费占比</div>
            <div class="revenue-value">${pricing.freeRatio}%</div>
          </div>
          <div class="revenue-item">
            <div class="revenue-label">付费中位数</div>
            <div class="revenue-value">$${pricing.medianPrice.toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="revenue-grid">
        <div class="revenue-item">
          <div class="revenue-label">预估月下载</div>
          <div class="revenue-value">${est.estimatedMonthlyDownloads.toLocaleString()}</div>
        </div>
        <div class="revenue-item">
          <div class="revenue-label">预估月收入</div>
          <div class="revenue-value highlight">$${est.lowRevenue.toLocaleString()} - $${est.highRevenue.toLocaleString()}</div>
        </div>
      </div>
      ${pricingHtml}
      <div class="recommendation">
        <strong>定价建议：</strong>${est.priceRecommendation}
      </div>
    `;
  },

  // ── 5. Risk & Strategy ──

  renderRiskAndStrategy(app, insights) {
    const section = document.getElementById('riskStrategySection');
    const content = document.getElementById('riskStrategyContent');
    const result = generateRiskAndStrategy(app, insights, this.currentCategoryContext);

    section.style.display = 'block';

    let html = '';

    // Risks
    if (result.risks.length > 0) {
      html += `
        <div class="risk-section">
          <div class="risk-group-label">风险提示</div>
          <ul class="risk-list">
            ${result.risks.map(r => `
              <li class="risk-item">
                <span class="risk-dot ${r.level}"></span>
                <span class="risk-text">${r.text}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Strategies
    if (result.strategies.length > 0) {
      html += `
        <div class="strategy-section">
          <div class="strategy-group-label">切入策略</div>
          <ul class="strategy-list">
            ${result.strategies.map(s => `
              <li class="strategy-item">
                <span class="strategy-tag ${s.fit}">${s.type}</span>
                <div class="strategy-desc">${s.desc}</div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    content.innerHTML = html;
  },

  // ── 6. MVP ──

  renderMVP(app, featureGaps) {
    const section = document.getElementById('mvpSection');
    const content = document.getElementById('mvpContent');
    const mvp = generateMVPFeatures(app, featureGaps);
    section.style.display = 'block';

    content.innerHTML = `
      <div class="mvp-group">
        <div class="mvp-group-label">必须有</div>
        <div class="mvp-feature-list">
          ${mvp.mustHave.map(f => `<span class="mvp-tag must">${f}</span>`).join('')}
        </div>
      </div>
      <div class="mvp-group">
        <div class="mvp-group-label">竞品已有（基线）</div>
        <div class="mvp-feature-list">
          ${mvp.baseline.map(f => `<span class="mvp-tag baseline">${f}</span>`).join('')}
        </div>
      </div>
      <div class="mvp-group">
        <div class="mvp-group-label">加分项</div>
        <div class="mvp-feature-list">
          ${mvp.niceToHave.map(f => `<span class="mvp-tag nice">${f}</span>`).join('')}
        </div>
      </div>
    `;
  },

  // ── 7. Persona ──

  renderPersona(app, reviews) {
    const section = document.getElementById('personaSection');
    const content = document.getElementById('personaContent');
    const persona = generatePersona(app, reviews);
    section.style.display = 'block';

    content.innerHTML = `
      <div class="persona-summary">${persona.summary}</div>
      <div class="persona-detail">${persona.tone}</div>
    `;
  },

  // ── 8. Feature Gaps (structured: complaints + requests) ──

  renderFeatureGaps(featureGaps) {
    const section = document.getElementById('featureGapSection');
    const content = document.getElementById('featureGapContent');

    // Handle both old array format and new object format
    let complaints = [];
    let requests = [];

    if (Array.isArray(featureGaps)) {
      requests = featureGaps;
    } else if (featureGaps && typeof featureGaps === 'object') {
      complaints = featureGaps.complaints || [];
      requests = featureGaps.requests || [];
    }

    if (complaints.length === 0 && requests.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    function renderList(items) {
      if (items.length === 0) return '<div style="font-size:0.82rem;color:var(--text-tertiary);padding:0.3rem 0;">数据不足</div>';
      return `
        <ul class="feature-gap-list">
          ${items.map((g, i) => `
            <li class="feature-gap-item">
              <span class="gap-rank">${i + 1}.</span>
              <span class="gap-text">${g.feature}</span>
              <span class="gap-count">${g.count}x</span>
            </li>
          `).join('')}
        </ul>
      `;
    }

    content.innerHTML = `
      <div class="feature-gap-columns">
        <div>
          <div class="feature-gap-group-label complaints">用户抱怨</div>
          ${renderList(complaints)}
        </div>
        <div>
          <div class="feature-gap-group-label requests">功能期望</div>
          ${renderList(requests)}
        </div>
      </div>
    `;
  },

  // ── 9. Sentiment Trend ──

  renderSentiment(sentiment) {
    const section = document.getElementById('sentimentSection');

    if (!sentiment) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    const trendIcons = { declining: '\u2B07', improving: '\u2B06', stable: '\u2192' };
    document.getElementById('sentimentContent').innerHTML = `
      <div class="sentiment-summary">
        <span class="trend-icon">${trendIcons[sentiment.trend]}</span>
        趋势：${sentiment.trendLabel}
      </div>
      <div class="sentiment-desc">${sentiment.trendDesc}</div>
    `;

    // Mini chart
    const canvas = document.getElementById('sentimentChart');
    if (this.sentimentChartInstance) {
      this.sentimentChartInstance.destroy();
      this.sentimentChartInstance = null;
    }

    this.sentimentChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: sentiment.months.map(m => m.month),
        datasets: [{
          data: sentiment.months.map(m => Math.round(m.avg * 100) / 100),
          borderColor: sentiment.trend === 'declining' ? 'rgba(93,184,114,0.8)' :
                       sentiment.trend === 'improving' ? 'rgba(198,69,69,0.6)' : 'rgba(142,139,130,0.6)',
          backgroundColor: sentiment.trend === 'declining' ? 'rgba(93,184,114,0.08)' :
                          sentiment.trend === 'improving' ? 'rgba(198,69,69,0.06)' : 'rgba(142,139,130,0.06)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: '#fff', borderColor: '#e6dfd8', borderWidth: 1,
          titleColor: '#141413', bodyColor: '#6c6a64', displayColors: false, cornerRadius: 6,
          callbacks: { label: ctx => `平均评分: ${ctx.parsed.y.toFixed(1)}` },
        }},
        scales: {
          x: { display: false },
          y: { min: 1, max: 5, grid: { color: 'rgba(230,223,216,0.4)' }, ticks: { color: '#8e8b82', font: { size: 9 }, stepSize: 1 }, border: { display: false } },
        },
      },
    });
  },

  // ── 10. Reviews ──

  renderReviews(reviews) {
    const reviewKeywords = document.getElementById('reviewKeywords');
    const reviewQuotes = document.getElementById('reviewQuotes');

    const negativeReviews = reviews.filter(r => r.rating <= 3);
    const keywords = this.extractKeywords(negativeReviews);

    reviewKeywords.innerHTML = '';
    keywords.forEach(kw => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = kw;
      reviewKeywords.appendChild(tag);
    });

    const topNegative = negativeReviews.slice(0, 5);
    reviewQuotes.innerHTML = '';

    topNegative.forEach((review, idx) => {
      const li = document.createElement('li');
      li.className = 'review-item';
      li.dataset.reviewIdx = idx;
      li.dataset.originalText = review.content || '';

      const isZh = Translate.isChinese(review.content || '');

      li.innerHTML = `
        <div>
          <span class="review-stars">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</span>
          <span class="review-title">${review.title || ''}</span>
        </div>
        <div class="review-content">${(review.content || '').substring(0, 200)}${(review.content || '').length > 200 ? '...' : ''}</div>
        ${!isZh ? '<button class="btn-translate" data-action="translate">翻译</button>' : ''}
        <div class="review-translation-slot" data-translated="false"></div>
      `;

      const btn = li.querySelector('.btn-translate');
      if (btn) {
        btn.addEventListener('click', async () => {
          const slot = li.querySelector('.review-translation-slot');
          if (slot.dataset.translated === 'true') {
            slot.innerHTML = '';
            slot.dataset.translated = 'false';
            btn.textContent = '翻译';
            return;
          }
          btn.textContent = '翻译中...';
          const translated = await Translate.translate(review.content || '');
          slot.innerHTML = `<div class="review-translation">${translated}</div>`;
          slot.dataset.translated = 'true';
          btn.textContent = '收起翻译';
        });
      }

      reviewQuotes.appendChild(li);
    });
  },

  async translateAll() {
    const btn = document.getElementById('btnTranslateAll');
    const items = document.querySelectorAll('.review-item');

    if (this.reviewsTranslated) {
      items.forEach(li => {
        const slot = li.querySelector('.review-translation-slot');
        const btnT = li.querySelector('.btn-translate');
        if (slot) { slot.innerHTML = ''; slot.dataset.translated = 'false'; }
        if (btnT) btnT.textContent = '翻译';
      });
      btn.textContent = '翻译全部';
      this.reviewsTranslated = false;
      return;
    }

    btn.textContent = '翻译中...';
    const promises = [];

    items.forEach(li => {
      const text = li.dataset.originalText || '';
      const isZh = Translate.isChinese(text);
      if (isZh) return;

      const slot = li.querySelector('.review-translation-slot');
      if (slot && slot.dataset.translated !== 'true') {
        promises.push(
          Translate.translate(text).then(translated => {
            slot.innerHTML = `<div class="review-translation">${translated}</div>`;
            slot.dataset.translated = 'true';
            const btnT = li.querySelector('.btn-translate');
            if (btnT) btnT.textContent = '收起翻译';
          })
        );
      }
    });

    await Promise.all(promises);
    btn.textContent = '收起全部翻译';
    this.reviewsTranslated = true;
  },

  extractKeywords(reviews) {
    const text = reviews.map(r => `${r.title} ${r.content}`).join(' ').toLowerCase();
    const patterns = [
      { en: 'crash', zh: '崩溃' }, { en: 'bug', zh: 'Bug' }, { en: 'slow', zh: '卡顿' },
      { en: 'subscription', zh: '订阅太贵' }, { en: 'ads', zh: '广告太多' },
      { en: 'update', zh: '不更新' }, { en: 'sync', zh: '同步问题' },
      { en: 'login', zh: '登录问题' }, { en: 'export', zh: '无法导出' },
      { en: 'widget', zh: '缺少小组件' }, { en: 'dark mode', zh: '无深色模式' },
      { en: 'privacy', zh: '隐私担忧' }, { en: 'data', zh: '数据丢失' },
      { en: 'offline', zh: '不支持离线' }, { en: 'design', zh: '界面过时' },
      { en: 'feature', zh: '功能缺失' }, { en: 'support', zh: '客服不回应' },
    ];
    const matched = [];
    patterns.forEach(p => {
      if (text.includes(p.en) || text.includes(p.zh.toLowerCase())) matched.push(p.zh);
    });
    return matched.length > 0 ? matched : ['暂无关键词数据'];
  },

  close() {
    this.el.classList.remove('active');
  },
};

function showAppDetail(app) {
  AppDetail.show(app);
}
