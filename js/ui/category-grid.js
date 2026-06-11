const CategoryGrid = {
  container: null,
  categoryData: {},

  init() {
    this.container = document.getElementById('categoryGrid');
    this.render();
  },

  cardBg(genreId) {
    const idx = (parseInt(genreId, 10) % 8) + 1;
    return `assets/ui/card-bg/cell${idx}.png`;
  },

  render() {
    this.container.innerHTML = '';

    Object.values(GENRES).forEach(genre => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.genreId = genre.id;
      card.style.backgroundImage = `url('${this.cardBg(genre.id)}')`;

      const analysis = this.categoryData[genre.id];
      const scoreInfo = analysis ? categoryScore(analysis) : { score: 0, level: 'unknown' };
      const heatHtml = analysis?.heat
        ? `<span class="heat-tag heat-${analysis.heat.level}">${analysis.heat.label} ${analysis.heat.score}</span>`
        : '';

      card.innerHTML = `
        <div class="icon">${Icons.el(genre.icon, 'category-icon')}</div>
        <div class="name">${genre.name}</div>
        ${analysis
          ? `<span class="score-badge score-${scoreInfo.level}">${scoreInfo.score}分</span>${heatHtml}`
          : `<span class="score-badge score-unknown">${Icons.el('scan-line', 'badge-icon')} 点击扫描</span>`
        }
      `;

      if (analysis) card.classList.add('scanned');

      card.addEventListener('click', () => openCategoryDetail(genre.id));
      this.container.appendChild(card);
    });

    Icons.refresh(this.container);
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
