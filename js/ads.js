const Ads = {
  init() {
    if (!CONFIG.ADS_ENABLED || !CONFIG.ADSENSE_CLIENT) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    document.querySelectorAll('.ad-slot ins.adsbygoogle').forEach(() => {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
    });
  },
};
