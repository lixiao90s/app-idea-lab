let scatterChartInstance = null;
let radarChartInstance = null;

function destroyScatterChart() {
  if (scatterChartInstance) {
    scatterChartInstance.destroy();
    scatterChartInstance = null;
  }
}

function mangaBubbleStyle(app) {
  const valuable = isReferenceApp(app);
  if (valuable) {
    return {
      bg: 'rgba(22, 163, 74, 0.55)',
      border: '#15803d',
      width: 2,
    };
  }
  return {
    bg: 'rgba(255, 255, 255, 0.9)',
    border: '#52525b',
    width: 1.5,
  };
}

function renderScatterChart(scoredApps, categoryContext) {
  const canvas = document.getElementById('scatterChart');
  if (!canvas) return;

  destroyScatterChart();

  const genreId = categoryContext?.genreId;
  const data = scoredApps.map(app => {
    const dl = estimateDownloads(app, { genreId });
    return {
      x: app.averageUserRating || 0,
      y: Math.max(1, dl.displayMonthly),
      r: Math.max(5, Math.min(18, app._scores.normalized / 6)),
      app: app,
    };
  });

  const styles = data.map(d => mangaBubbleStyle(d.app));
  const ctx = canvas.getContext('2d');

  scatterChartInstance = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: '应用',
        data: data,
        backgroundColor: styles.map(s => s.bg),
        borderColor: styles.map(s => s.border),
        borderWidth: styles.map(s => s.width),
      }],
    },
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
              const tag = isReferenceApp(app) ? ' ★ 值得参考' : '';
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
          const idx = elements[0].index;
          showAppDetail(data[idx].app);
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
