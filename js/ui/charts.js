let scatterChartInstance = null;
let radarChartInstance = null;

function destroyScatterChart() {
  if (scatterChartInstance) {
    scatterChartInstance.destroy();
    scatterChartInstance = null;
  }
}

const BUBBLE_LEVEL_STYLES = {
  high: {
    label: '高机会',
    center: 'rgba(22, 163, 74, 0.02)',
    centerHover: 'rgba(22, 163, 74, 0.08)',
    mid: 'rgba(22, 163, 74, 0.22)',
    midHover: 'rgba(22, 163, 74, 0.38)',
    edge: 'rgba(22, 163, 74, 0.78)',
    border: '#15803d',
    width: 2.2,
  },
  medium: {
    label: '中等',
    center: 'rgba(217, 119, 6, 0.02)',
    centerHover: 'rgba(217, 119, 6, 0.08)',
    mid: 'rgba(217, 119, 6, 0.24)',
    midHover: 'rgba(217, 119, 6, 0.42)',
    edge: 'rgba(217, 119, 6, 0.82)',
    border: '#b45309',
    width: 2,
  },
  low: {
    label: '竞争激烈',
    center: 'rgba(113, 113, 122, 0.02)',
    centerHover: 'rgba(113, 113, 122, 0.06)',
    mid: 'rgba(113, 113, 122, 0.16)',
    midHover: 'rgba(113, 113, 122, 0.28)',
    edge: 'rgba(113, 113, 122, 0.52)',
    border: '#52525b',
    width: 1.6,
  },
};

function bubbleRadialGradient(ctx, x, y, r, style, hover = false) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, hover ? style.centerHover : style.center);
  gradient.addColorStop(0.35, hover ? style.midHover : style.mid);
  gradient.addColorStop(0.72, style.edge);
  gradient.addColorStop(1, style.edge);
  return gradient;
}

const bubbleGradientPlugin = {
  id: 'bubbleGradient',
  beforeDatasetsDraw(chart) {
    const { ctx, data } = chart;
    data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'bubble') return;

      const style = BUBBLE_LEVEL_STYLES[dataset._level] || BUBBLE_LEVEL_STYLES.low;

      meta.data.forEach((point, i) => {
        const { x, y } = point.getProps(['x', 'y'], true);
        const r = dataset.data[i]?.r ?? 8;

        point.options.backgroundColor = bubbleRadialGradient(ctx, x, y, r, style, false);
        point.options.borderColor = style.border;
        point.options.borderWidth = style.width;
        point.options.hoverBackgroundColor = bubbleRadialGradient(ctx, x, y, r, style, true);
        point.options.hoverBorderColor = style.border;
        point.options.hoverBorderWidth = style.width + 0.5;
      });
    });
  },
};

function bubbleLevel(app) {
  return app._scores?.level || opportunityLevel(app._scores?.normalized || 0);
}

function buildBubbleDatasets(scoredApps, genreId) {
  const groups = { high: [], medium: [], low: [] };

  scoredApps.forEach(app => {
    const level = bubbleLevel(app);
    const bucket = groups[level] || groups.low;
    const dl = estimateDownloads(app, { genreId });
    bucket.push({
      x: app.averageUserRating || 0,
      y: Math.max(1, dl.displayMonthly),
      r: Math.max(6, Math.min(20, app._scores.normalized / 5)),
      app,
    });
  });

  return ['high', 'medium', 'low'].map(level => {
    const style = BUBBLE_LEVEL_STYLES[level];
    return {
      label: style.label,
      _level: level,
      data: groups[level],
      backgroundColor: style.edge,
      borderColor: style.border,
      borderWidth: style.width,
    };
  });
}

function renderScatterChart(scoredApps, categoryContext) {
  const canvas = document.getElementById('scatterChart');
  if (!canvas) return;

  destroyScatterChart();

  const genreId = categoryContext?.genreId;
  const datasets = buildBubbleDatasets(scoredApps, genreId);
  const ctx = canvas.getContext('2d');

  scatterChartInstance = new Chart(ctx, {
    type: 'bubble',
    plugins: [bubbleGradientPlugin],
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: '#e4e4e7',
          borderWidth: 1,
          titleColor: '#18181b',
          bodyColor: '#52525b',
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
          titleFont: { family: "'Inter', sans-serif", size: 13, weight: '600' },
          callbacks: {
            label: function(context) {
              const app = context.raw.app;
              const dl = estimateDownloads(app, { genreId: categoryContext?.genreId });
              const levelLabel = OPPORTUNITY_LABELS[app._scores?.level]?.text || '';
              const tag = levelLabel ? ` · ${levelLabel}` : '';
              return [
                (app.trackName || 'Unknown') + tag,
                `评分: ${app.averageUserRating?.toFixed(1) || 'N/A'}`,
                `估月下载: ${dl.displayRange}`,
                `机会分: ${app._scores.normalized}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '平均评分',
            color: '#71717a',
            font: { size: 11, weight: '500', family: "'Inter', sans-serif" },
          },
          min: 0,
          max: 5,
          grid: { color: 'rgba(24, 24, 27, 0.06)' },
          ticks: { color: '#71717a', font: { size: 10 } },
          border: { color: '#e4e4e7' },
        },
        y: {
          title: {
            display: true,
            text: '估月下载',
            color: '#71717a',
            font: { size: 11, weight: '500', family: "'Inter', sans-serif" },
          },
          type: 'logarithmic',
          grid: { color: 'rgba(24, 24, 27, 0.06)' },
          ticks: {
            color: '#71717a',
            font: { size: 10 },
            callback: function(value) {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
              return value;
            },
          },
          border: { color: '#e4e4e7' },
        },
      },
      onClick: function(event, elements) {
        if (elements.length > 0) {
          const el = elements[0];
          const point = scatterChartInstance.data.datasets[el.datasetIndex].data[el.index];
          showAppDetail(point.app);
        }
      },
    },
  });
}

// ── Radar Chart for 5-dimension opportunity score ──

function renderRadarChart(app) {
  const canvas = document.getElementById('radarChart');
  if (!canvas || !app._scores) return;

  if (radarChartInstance) {
    radarChartInstance.destroy();
    radarChartInstance = null;
  }

  const scores = app._scores;
  const labels = ['市场需求', '竞品质量', '维护活跃', '痛点强度', '变现潜力', '搜索热度'];
  const values = [scores.demand, scores.quality, scores.freshness, scores.pain, scores.monetization, scores.heat || 0];

  radarChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: 'rgba(204, 120, 92, 0.12)',
        borderColor: 'rgba(204, 120, 92, 0.7)',
        borderWidth: 2,
        pointBackgroundColor: [
          'rgba(91, 143, 185, 0.9)',   // demand - blue
          'rgba(204, 120, 92, 0.9)',   // quality - coral
          'rgba(93, 184, 114, 0.9)',   // freshness - green
          'rgba(198, 69, 69, 0.9)',    // pain - red
          'rgba(232, 165, 90, 0.9)',   // monetization - amber
        ],
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: '#e6dfd8',
          borderWidth: 1,
          titleColor: '#141413',
          bodyColor: '#6c6a64',
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed.r.toFixed(1)} / 5`,
          },
        },
      },
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: {
            stepSize: 1,
            color: '#8e8b82',
            font: { size: 9 },
            backdropColor: 'transparent',
          },
          grid: { color: 'rgba(230, 223, 216, 0.5)' },
          angleLines: { color: 'rgba(230, 223, 216, 0.5)' },
          pointLabels: {
            color: '#6c6a64',
            font: { size: 10, family: "'Inter', sans-serif" },
          },
        },
      },
    },
  });
}
