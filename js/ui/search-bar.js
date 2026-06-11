const SearchBar = {
  input: null,
  btnSearch: null,
  btnInspire: null,
  heatBadge: null,

  init() {
    this.input = document.getElementById('searchInput');
    this.btnSearch = document.getElementById('btnSearch');
    this.btnInspire = document.getElementById('btnInspire');
    this.heatBadge = document.getElementById('searchHeatBadge');

    this.btnSearch.addEventListener('click', () => this.doSearch());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doSearch();
    });
    this.btnInspire.addEventListener('click', () => this.doInspire());
  },

  showHeatBadge(heat) {
    if (!heat || !this.heatBadge) return;
    this.heatBadge.classList.remove('hidden');
    this.heatBadge.innerHTML = `
      <span class="heat-tag heat-${heat.level}">${heat.term} · 搜索热度 ${heat.score} · ${heat.label}</span>
    `;
  },

  async doSearch() {
    const term = this.input.value.trim();
    if (!term) return;

    AppDetail.close();

    const detailEl = document.getElementById('categoryDetail');
    detailEl.classList.add('active');
    document.getElementById('detailTitle').textContent = `搜索: "${term}"`;
    document.getElementById('detailMeta').classList.add('hidden');

    const appListEl = document.getElementById('appList');
    appListEl.innerHTML = Icons.emptyState('search', '<div>正在搜索...</div>');
    Icons.refresh(appListEl);

    try {
      Progress.show(`正在搜索 "${term}"...`, 20);

      const results = await searchApps(term);
      const heat = await getSearchHeat(term, results);
      this.showHeatBadge(heat);

      Progress.update('正在分析...', 70);

      if (results.length === 0) {
        appListEl.innerHTML = Icons.emptyState('inbox', '<div>未找到相关应用，试试其他关键词</div>');
        Icons.refresh(appListEl);
        Progress.hide();
        return;
      }

      const ctx = { totalApps: results.length, apps: results, heat };
      const scored = scoreAndSort(results, ctx);

      AppDetail.setCategoryContext(ctx);
      CategoryDetail.currentApps = scored;
      CategoryDetail.renderAppList(scored.slice(0, 50));
      renderScatterChart(scored, ctx);

      const metaEl = document.getElementById('detailMeta');
      if (heat) {
        metaEl.classList.remove('hidden');
        metaEl.innerHTML = `<span class="heat-tag heat-${heat.level}">搜索热度 ${heat.score} · ${heat.label}</span>`;
      }

      Progress.update(`找到 ${scored.length} 个应用`, 100);
      setTimeout(() => Progress.hide(), 1000);

    } catch (err) {
      console.error('Search error:', err);
      appListEl.innerHTML = Icons.emptyState('alert-circle', `<div>搜索失败：${err.message}</div>`);
      Icons.refresh(appListEl);
      Progress.hide();
    }
  },

  async doInspire() {
    const genreIds = Object.keys(GENRES);
    const randomGenreId = parseInt(genreIds[Math.floor(Math.random() * genreIds.length)]);
    const genre = GENRES[randomGenreId];

    this.input.value = '';
    AppDetail.close();

    Progress.show(`正在为你寻找灵感... 扫描「${genre.name}」类别`, 20);

    try {
      const results = await searchApps(genre.keyword, { genreId: randomGenreId });

      if (results.length === 0) {
        Progress.hide();
        this.doInspire();
        return;
      }

      const heat = await getSearchHeat(genre.keyword, results, randomGenreId);
      const ctx = { totalApps: results.length, apps: results, heat, genreId: randomGenreId };
      const scored = scoreAndSort(results, ctx);
      const topApp = scored[0];

      if (topApp) {
        this.showHeatBadge(heat);
        Progress.update('找到灵感！', 100);
        setTimeout(() => Progress.hide(), 500);
        openCategoryDetail(randomGenreId);
        setTimeout(() => showAppDetail(topApp), 500);
      } else {
        Progress.hide();
        this.doInspire();
      }
    } catch {
      Progress.hide();
    }
  },
};
