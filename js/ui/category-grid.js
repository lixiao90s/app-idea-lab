const CategoryGrid = {
  container: null,
  categoryData: {},

  init() {
    this.container = document.getElementById('categoryGrid');
    this.render();
  },

  render() {
    this.container.innerHTML = '';

    Object.values(GENRES).forEach(genre => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.genreId = genre.id;

      const analysis = this.categoryData[genre.id];
      const scoreInfo = analysis ? categoryScore(analysis) : { score: 0, level: 'unknown' };
      const label = OPPORTUNITY_LABELS[scoreInfo.level];
      const heatHtml = analysis?.heat
        ? `<span class="heat-tag heat-${analysis.heat.level}">${analysis.heat.label} ${analysis.heat.score}</span>`
        : '';

      card.innerHTML = `
        <div class="icon">${genre.icon}</div>
        <div class="name">${genre.name}</div>
        ${analysis
          ? `<span class="score-badge score-${scoreInfo.level}">${scoreInfo.score}分</span>${heatHtml}`
          : `<span class="score-badge score-unknown">点击扫描</span>`
        }
      `;

      if (analysis) card.classList.add('scanned');

      card.addEventListener('click', () => {
        openCategoryDetail(genre.id);
      });

      this.container.appendChild(card);
    });
  },

  updateCard(genreId, analysis) {
    this.categoryData[genreId] = analysis;
    this.render();
  },

  setAllData(data) {
    this.categoryData = data;
    this.render();
  },
};
