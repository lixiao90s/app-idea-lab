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
    this.appListEl.innerHTML = Icons.emptyState('loader-circle', '<div>正在扫描该类别...</div>');
    Icons.refresh(this.appListEl);

    AppDetail.close();
    this.el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      Progress.show(`正在扫描「${genre.name}」类别...`, 10);

      const searchResults = await searchApps(genre.keyword, { genreId: genreId });
      Progress.update('正在计算搜索热度...', 50);

      const heat = await getSearchHeat(genre.keyword, searchResults, genreId);
      Progress.update('正在分析应用数据...', 70);

      if (searchResults.length === 0) {
        this.appListEl.innerHTML = Icons.emptyState('inbox', '<div>未找到该类别的应用数据</div>');
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
          <span class="heat-tag heat-${heat.level}">搜索热度 ${heat.score} · ${heat.label}</span>
          <span class="meta-sep">·</span>
          <span>${heat.metrics.resultCount} 个竞品 · ${heat.metrics.totalReviews.toLocaleString()} 条评论</span>
        `;
      }

      this.renderAppList(scored.slice(0, 50));
      renderScatterChart(scored, ctx);

      const analysis = analyzeCategory(scored, { ...heat, genreId });
      CategoryGrid.updateCard(genreId, analysis);

      Progress.update(`扫描完成，发现 ${scored.length} 个应用`, 100);
      setTimeout(() => Progress.hide(), 1000);

    } catch (err) {
      console.error('Category scan error:', err);
      this.appListEl.innerHTML = Icons.emptyState('alert-circle', `<div>加载失败：${err.message}</div>`);
      Progress.hide();
    }
  },

  renderAppList(apps) {
    this.appListEl.innerHTML = '';

    if (apps.length === 0) {
      this.appListEl.innerHTML = Icons.emptyState('inbox', '<div>暂无数据</div>');
      return;
    }

    apps.forEach((app, idx) => {
      const item = document.createElement('div');
      item.className = 'app-item';

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
          <div class="app-name">${app.trackName || 'Unknown'}</div>
          <div class="app-meta">${rating} 分 · ${count} 评论 · 估 ${dlText}</div>
        </div>
        <div class="app-score ${scoreClass}">${app._scores.normalized}</div>
      `;

      item.addEventListener('click', () => showAppDetail(app));
      this.appListEl.appendChild(item);
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
