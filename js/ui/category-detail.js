const CategoryDetail = {
  el: null,
  titleEl: null,
  metaEl: null,
  appListEl: null,
  currentGenreId: null,
  currentApps: [],

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
    this.appListEl.innerHTML = '<div class="app-list-body"></div>';
    const body = this.appListEl.querySelector('.app-list-body');

    if (apps.length === 0) {
      body.innerHTML = Icons.emptyState('inbox', '<div>暂无数据</div>');
      return;
    }

    apps.forEach((app, idx) => {
      const valuable = isReferenceApp(app);
      const item = document.createElement('div');
      item.className = 'app-item' + (valuable ? ' app-item-valuable' : '');

      const scoreClass = `score-${app._scores.level}`;
      const iconUrl = app.artworkUrl60 || app.artworkUrl512 || '';
      const rating = app.averageUserRating ? app.averageUserRating.toFixed(1) : 'N/A';
      const count = app.userRatingCount ? app.userRatingCount.toLocaleString() : '0';

      item.innerHTML = `
        <div class="rank">${idx + 1}</div>
        <img class="app-icon" src="${iconUrl}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="app-info">
          <div class="app-name">${app.trackName || 'Unknown'}</div>
          <div class="app-meta">${rating} 分 · ${count} 评论</div>
        </div>
        <div class="app-score ${scoreClass}">${app._scores.normalized}</div>
        <button type="button" class="btn-app-detail-link" title="完整报告">详情</button>
      `;

      item.querySelector('.btn-app-detail-link').addEventListener('click', () => {
        showAppDetail(app);
      });

      body.appendChild(item);
    });

    Icons.refresh(this.appListEl);
  },

  close() {
    this.el.classList.remove('active');
    this.currentGenreId = null;
    this.currentApps = [];
  },
};

function openCategoryDetail(genreId) {
  CategoryDetail.open(genreId);
}
