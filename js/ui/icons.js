const Icons = {
  refresh(root = document) {
    if (window.lucide) {
      lucide.createIcons({ attrs: { 'stroke-width': 1.75 }, root });
    }
  },

  el(name, className = '') {
    return `<i data-lucide="${name}" class="lucide-icon ${className}"></i>`;
  },

  emptyState(icon, text) {
    return `<div class="empty-state">${this.el(icon, 'empty-icon')}${text}</div>`;
  },
};
