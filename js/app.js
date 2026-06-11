// App initialization
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // Init all modules
    Progress.init();
    CategoryGrid.init();
    CategoryDetail.init();
    AppDetail.init();
    SearchBar.init();
    Ads.init();
    Icons.refresh();
    initSupportQr();

    // Close detail button
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      CategoryDetail.close();
    });

    // Welcome state
    console.log('App Idea Lab 已启动');
  });

  function initSupportQr() {
    function bindQr(imgId, hintId) {
      const img = document.getElementById(imgId);
      const hint = hintId ? document.getElementById(hintId) : null;
      if (!img) return;

      function showQr() {
        img.hidden = false;
        if (hint) hint.hidden = true;
      }
      function hideQr() {
        img.hidden = true;
        if (hint) hint.hidden = false;
      }

      img.addEventListener('load', showQr);
      img.addEventListener('error', hideQr);

      if (img.complete) {
        img.naturalWidth > 0 ? showQr() : hideQr();
      }
    }

    bindQr('supportQrLeft', 'supportHintLeft');
    bindQr('supportQrRight', 'supportHintRight');
    bindQr('supportQrMobile', 'supportHintMobile');
  }
})();
