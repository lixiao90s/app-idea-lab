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

    // Close detail button
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      CategoryDetail.close();
    });

    // Welcome state
    console.log('App Store 灵感发现工具已启动');
  });
})();
