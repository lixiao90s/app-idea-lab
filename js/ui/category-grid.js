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
      const scoreInfo = analysis ? categoryScore(analysis) : null;

      card.innerHTML = `
        <span class="icon">${Icons.el(genre.icon, 'category-icon')}</span>
        <span class="name">${genre.name}</span>
        ${scoreInfo
          ? `<span class="score-badge score-${scoreInfo.level}">${scoreInfo.score}</span>`
          : ''
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
