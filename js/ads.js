const Ads = {
  init() {
    this.initPropellerAds();
    this.initAdSense();
  },

  initPropellerAds() {
    if (!CONFIG.PROPELLERADS_ENABLED || !CONFIG.PROPELLERADS_ZONE_ID || !CONFIG.PROPELLERADS_TAG_URL) return;

    const script = document.createElement('script');
    script.src = CONFIG.PROPELLERADS_TAG_URL;
    script.setAttribute('data-zone', String(CONFIG.PROPELLERADS_ZONE_ID));
    script.setAttribute('data-cfasync', 'false');
    (document.body || document.documentElement).appendChild(script);
  },

  initAdSense() {
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
