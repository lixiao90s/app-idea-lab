const Progress = {
  el: null,
  textEl: null,
  fillEl: null,

  init() {
    this.el = document.getElementById('progressBar');
    this.textEl = document.getElementById('progressText');
    this.fillEl = document.getElementById('progressFill');
  },

  show(text, percent) {
    this.el.classList.add('active');
    if (text) this.textEl.textContent = text;
    if (percent !== undefined) this.fillEl.style.width = percent + '%';
  },

  update(text, percent) {
    if (text) this.textEl.textContent = text;
    if (percent !== undefined) this.fillEl.style.width = percent + '%';
  },

  hide() {
    this.el.classList.remove('active');
    this.fillEl.style.width = '0%';
  },
};
