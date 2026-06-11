const CategoryDetail = {
  el: null,
  titleEl: null,
  metaEl: null,
  appListEl: null,
  currentGenreId: null,
  currentApps: [],
  expandedTrackId: null,

  init() {
    this.el = document.getElementById('categoryDetail');
    this.titleEl = document.getElementById('detailTitle');
    this.metaEl = document.getElementById('detailMeta');
    this.appListEl = document.getElementById('appList');
  },

  async open(genreId) {
    const genre = GENRES[genreId];
    if (!genre) return;

    this.currentGenreId = genreId;
    this.expandedTrackId = null;
    this.el.classList.add('active');
    this.titleEl.innerHTML = `${Icons.el(genre.icon, 'title-icon')} ${genre.name}`;
    Icons.refresh(this.titleEl);
    this.metaEl.classList.add('hidden');
    this.metaEl.innerHTML = '';
    this.appListEl.innerHTML = Icons.emptyState('loader-circle', '<div>正在扫描...</div>');
    Icons.refresh(this.appListEl);

    AppDetail.close();

    try {
      Progress.show(`正在扫描「${genre.name}」...`, 10);

      const searchResults = await searchApps(genre.keyword, { genreId: genreId });
      Progress.update('正在计算搜索热度...', 50);

      const heat = await getSearchHeat(genre.keyword, searchResults, genreId);
      Progress.update('正在分析...', 70);

      if (searchResults.length === 0) {
        this.appListEl.innerHTML = Icons.emptyState('inbox', '<div>未找到相关应用</div>');
        Progress.hide();
        return;
      }

      const ctx = { totalApps: searchResults.length, apps: searchResults, heat, genreId };
      const scored = scoreAndSort(searchResults, ctx);
      this.currentApps = scored;

      AppDetail.setCategoryContext({ totalApps: scored.length, apps: scored, heat, genreId });

      if (heat) {
        this.metaEl.classList.remove('hidden');
        this.metaEl.innerHTML = `
          <span class="heat-tag heat-${heat.level}">热度 ${heat.score} · ${heat.label}</span>
          <span class="meta-sep">·</span>
          <span>${heat.metrics.resultCount} 竞品 · ${heat.metrics.totalReviews.toLocaleString()} 评论</span>
        `;
      }

      this.renderAppList(scored.slice(0, 50));
      renderScatterChart(scored, ctx);

      const analysis = analyzeCategory(scored, { ...heat, genreId });
      CategoryGrid.updateCard(genreId, analysis);

      Progress.update(`完成 · ${scored.length} 个应用`, 100);
      setTimeout(() => Progress.hide(), 800);

    } catch (err) {
      console.error('Category scan error:', err);
      this.appListEl.innerHTML = Icons.emptyState('alert-circle', `<div>加载失败：${err.message}</div>`);
      Progress.hide();
    }
  },

  renderAppList(apps) {
    this.appListEl.innerHTML = `
      <div class="app-list-header">
        <span>#</span><span></span><span>应用</span><span>分数</span><span></span>
      </div>
      <div class="app-list-body"></div>
    `;
    const body = this.appListEl.querySelector('.app-list-body');

    if (apps.length === 0) {
      body.innerHTML = Icons.emptyState('inbox', '<div>暂无数据</div>');
      return;
    }

    apps.forEach((app, idx) => {
      const row = document.createElement('div');
      row.className = 'app-row';
      row.dataset.trackId = app.trackId;

      const valuable = isReferenceApp(app);
      const item = document.createElement('div');
      item.className = 'app-item' + (valuable ? ' app-item-valuable' : '');

      const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';
      const scoreClass = `score-${app._scores.level}`;
      const iconUrl = app.artworkUrl60 || app.artworkUrl512 || '';
      const rating = app.averageUserRating ? app.averageUserRating.toFixed(1) : 'N/A';
      const count = app.userRatingCount ? app.userRatingCount.toLocaleString() : '0';
      const dl = estimateDownloads(app, { genreId: this.currentGenreId });
      const dlText = formatDownloads(dl.displayMonthly) + '/月';

      item.innerHTML = `
        <div class="rank ${rankClass}">${idx + 1}</div>
        <img class="app-icon" src="${iconUrl}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="app-info">
          <div class="app-name-row">
            <span class="app-name">${app.trackName || 'Unknown'}</span>
            ${valuable ? '<span class="ref-badge">值得参考</span>' : ''}
          </div>
          <div class="app-meta">${rating} 分 · ${count} 评论 · 估 ${dlText}</div>
        </div>
        <div class="app-score ${scoreClass}">${app._scores.normalized}</div>
        <button type="button" class="btn-app-detail-link" title="完整报告">详情</button>
      `;

      const panel = document.createElement('div');
      panel.className = 'app-reviews-panel hidden';
      panel.innerHTML = '<div class="reviews-loading">加载差评中...</div>';

      item.querySelector('.btn-app-detail-link').addEventListener('click', (e) => {
        e.stopPropagation();
        showAppDetail(app);
      });

      item.addEventListener('click', () => this.toggleReviews(app, row, panel));

      row.appendChild(item);
      row.appendChild(panel);
      body.appendChild(row);
    });

    Icons.refresh(this.appListEl);
  },

  async toggleReviews(app, row, panel) {
    const trackId = app.trackId;

    if (this.expandedTrackId === trackId) {
      panel.classList.add('hidden');
      row.classList.remove('expanded');
      this.expandedTrackId = null;
      return;
    }

    this.appListEl.querySelectorAll('.app-row.expanded').forEach(r => {
      r.classList.remove('expanded');
      r.querySelector('.app-reviews-panel')?.classList.add('hidden');
    });

    row.classList.add('expanded');
    panel.classList.remove('hidden');
    this.expandedTrackId = trackId;

    if (app._badReviews) {
      this.renderBadReviews(panel, app._badReviews);
      return;
    }

    panel.innerHTML = '<div class="reviews-loading">加载差评中...</div>';

    try {
      const reviews = await fetchReviews(trackId);
      const bad = reviews
        .filter(r => r.rating <= 3)
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 3);
      app._badReviews = bad;
      this.renderBadReviews(panel, bad);
    } catch {
      panel.innerHTML = '<div class="reviews-empty">暂无差评数据</div>';
    }
  },

  renderBadReviews(panel, reviews) {
    if (!reviews.length) {
      panel.innerHTML = '<div class="reviews-empty">暂无 1～3 星差评</div>';
      return;
    }

    panel.innerHTML = `
      <div class="reviews-panel-head">用户差评摘录</div>
      <ul class="inline-review-list">
        ${reviews.map(r => `
          <li class="inline-review-item">
            <span class="review-stars bad">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            ${r.title ? `<strong>${this.escapeHtml(r.title)}</strong> · ` : ''}
            <span>${this.escapeHtml(this.truncate(r.content, 160))}</span>
          </li>
        `).join('')}
      </ul>
    `;
  },

  truncate(text, max) {
    const s = (text || '').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
  },

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  close() {
    this.el.classList.remove('active');
    this.currentGenreId = null;
    this.currentApps = [];
    this.expandedTrackId = null;
  },
};

function openCategoryDetail(genreId) {
  CategoryDetail.open(genreId);
}
