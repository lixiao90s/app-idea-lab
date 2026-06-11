const Ads = {
  init() {
    this.initPropellerAds();
    this.initAdSense();
  },

  initPropellerAds() {
    if (!CONFIG.PROPELLERADS_ENABLED) return;

    const multitag = CONFIG.PROPELLERADS_MULTITAG;
    if (multitag?.url && multitag?.zoneId) {
      this.injectPropellerScript(multitag.url, multitag.zoneId);
    }

    const push = CONFIG.PROPELLERADS_PUSH;
    if (push?.url && push?.zoneId) {
      this.injectPropellerScript(push.url, push.zoneId);
    }

    const zones = CONFIG.PROPELLERADS_BANNER_ZONES || {};
    document.querySelectorAll('.ad-slot[data-ad-slot]').forEach((slot) => {
      const slotName = slot.dataset.adSlot;
      const zoneId = zones[slotName];
      if (!zoneId) return;

      const container = slot.querySelector('.propeller-ad');
      if (!container) return;

      const bannerUrl = push?.url || multitag?.url;
      if (!bannerUrl) return;

      this.injectPropellerScript(bannerUrl, zoneId, container);
    });
  },

  injectPropellerScript(url, zoneId, parent) {
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.setAttribute('data-zone', String(zoneId));
    script.setAttribute('data-cfasync', 'false');
    (parent || document.body || document.documentElement).appendChild(script);
  },

  initAdSense() {
    if (!CONFIG.ADS_ENABLED || !CONFIG.ADSENSE_CLIENT) return;

    document.body.classList.add('adsense-active');

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
