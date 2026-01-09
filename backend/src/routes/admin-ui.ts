  function productStorePage(mountNode, options){
    var target = mountNode || main;
    var navigate = options && options.navigate ? options.navigate : go;
    if (!target) return;
    target.innerHTML = ''
    if (btnCreate) btnCreate.addEventListener('click', function(){ navigate('/admin/ui/product-store/create'); });
    if (btnOrders) btnOrders.addEventListener('click', function(){ navigate('/admin/ui/product-store/orders'); });
    if (btnOrdersFooter) btnOrdersFooter.addEventListener('click', function(){ navigate('/admin/ui/product-store/orders'); });
    if (btnSettings) btnSettings.addEventListener('click', function(){ navigate('/admin/ui/product-store/settings'); });
    if (btnUpsells) btnUpsells.addEventListener('click', function(){ navigate('/admin/ui/product-store/upsells'); });
    if (btnCreateStore) btnCreateStore.addEventListener('click', function(){ navigate('/admin/ui/product-store/settings'); });
              navigate('/admin/ui/product-store/products/' + product.id + '/edit');
  function productStoreSettingsPage(mountNode, options){
    var target = mountNode || main;
    var navigate = options && options.navigate ? options.navigate : go;
    if (!target) return;
    target.innerHTML = ''
    $('#ps_settings_back').addEventListener('click', function(){ navigate('/admin/ui/product-store'); });
  function productStoreProductForm(productId, options){
    var target = (options && options.mount) ? options.mount : main;
    var navigate = options && options.navigate ? options.navigate : go;
    if (!target) return;
    target.innerHTML = ''
      cancelBtn.addEventListener('click', function(){ navigate('/admin/ui/product-store'); });
            navigate('/admin/ui/product-store/products/' + data.product.id + '/edit');
            navigate('/admin/ui/product-store');
  function productStoreOrdersPage(mountNode, options){
    var target = mountNode || main;
    var navigate = options && options.navigate ? options.navigate : go;
    if (!target) return;
    target.innerHTML = ''
    $('#ps_orders_back').addEventListener('click', function(){ navigate('/admin/ui/product-store'); });
            if (order){ navigate('/admin/ui/product-store/orders/' + order.id); }
  function productStoreUpsellsPage(mountNode, options){
    var target = mountNode || main;
    var navigate = options && options.navigate ? options.navigate : go;
    if (!target) return;
    target.innerHTML = ''
    $('#ps_upsells_back').addEventListener('click', function(){ navigate('/admin/ui/product-store'); });
        +'<div id="products-subpage-content" style="display:none;"></div>'
    var navTabs = Array.prototype.slice.call(document.querySelectorAll('.products-overview-page .nav-tab'));
    var tabLabels = {
      create: 'Create Product',
      store: 'Product Store',
      orders: 'Orders',
      settings: 'Settings',
      upsells: 'Upsells'
    };
    var tabTitles = {
      create: {
        title: 'Create products that people love',
        subtitle: 'Design and configure your products with custom pricing, images, and descriptions'
      },
      store: {
        title: 'Your store, your rules, your vibe',
        subtitle: 'Manage your product catalog, organize collections, and control your storefront visibility'
      },
      orders: {
        title: 'Orders flying in? We got you',
        subtitle: 'Track all customer orders, manage fulfillment status, and process refunds in one place'
      },
      settings: {
        title: 'Tweak it till it feels just right',
        subtitle: 'Configure store preferences, payment methods, shipping options, and notification settings'
      },
      upsells: {
        title: 'More money, less effort. Nice',
        subtitle: 'Create automated product recommendations and bundle offers to increase average order value'
      }
    };
    function resolvePageFromPath(path){
      if (path === '/admin/ui/product-store') return 'store';
      if (path === '/admin/ui/product-store/create' || path === '/admin/ui/product-store/products/new') return 'create';
      if (path === '/admin/ui/product-store/orders') return 'orders';
      if (path === '/admin/ui/product-store/settings') return 'settings';
      if (path === '/admin/ui/product-store/upsells') return 'upsells';
      return null;
    function renderProductsSubpage(page){
      var overview = document.getElementById('products-overview-page');
      var subpage = document.getElementById('products-subpage-content');
      if (!overview || !subpage) return;
      if (!page){
        overview.style.display = 'block';
        subpage.style.display = 'none';
        subpage.innerHTML = '';
        return;
      }
      overview.style.display = 'none';
      subpage.style.display = 'block';
      subpage.innerHTML = '';
      var embeddedNavigate = function(path){
        var nextPage = resolvePageFromPath(path);
        if (nextPage){
          activateProductsTab(nextPage, { withLoading: false });
          return;
        }
        go(path);
      };
      var options = { navigate: embeddedNavigate };
      if (page === 'create'){
        productStoreProductForm(null, { mount: subpage, navigate: embeddedNavigate });
      } else if (page === 'store'){
        productStorePage(subpage, options);
      } else if (page === 'orders'){
        productStoreOrdersPage(subpage, options);
      } else if (page === 'settings'){
        productStoreSettingsPage(subpage, options);
      } else if (page === 'upsells'){
        productStoreUpsellsPage(subpage, options);
      }
    }

    function setActiveTab(page){
      navTabs.forEach(function(resetTab){
        resetTab.style.background = 'white';
        resetTab.style.color = '#4a5568';
        resetTab.style.border = '2px solid #e2e8f0';
      });

      if (!page) return;
      var active = navTabs.find(function(tab){
        return tab.getAttribute('data-page') === page;
      });
      if (active){
        active.style.background = '#009fe3';
        active.style.color = 'white';
        active.style.border = 'none';
      }
    }

    function applyHeaderForPage(page){
      var mainTitle = document.getElementById('products-main-title');
      var subtitle = document.getElementById('products-subtitle');
      var config = tabTitles[page];
      if (!config || !mainTitle || !subtitle) return;
      mainTitle.textContent = config.title;
      subtitle.textContent = config.subtitle;
      subtitle.style.color = '#4a5568';
    }

    function activateProductsTab(page, options){
      var subtitle = document.getElementById('products-subtitle');
      var mainTitle = document.getElementById('products-main-title');
      var label = tabLabels[page] || page || '';
      var withLoading = !options || options.withLoading !== false;
      var originalSubtitle = subtitle ? subtitle.textContent : '';
      var startTransition = function(){
        if (mainTitle){
          mainTitle.style.opacity = '0';
          mainTitle.style.transition = 'opacity 0.5s ease';
        setTimeout(function(){
          applyHeaderForPage(page);
          if (mainTitle) mainTitle.style.opacity = '1';
          renderProductsSubpage(page);
        }, 500);
      };

      setActiveTab(page);

      if (subtitle && withLoading){
        subtitle.textContent = 'Navigating to ' + label + '...';
        subtitle.style.color = '#009fe3';
      }

      if (withLoading){
          startTransition();
        }, 1500);
      } else {
        startTransition();
      }
    }
    if (createButton && !createButton.dataset.bound){
      createButton.dataset.bound = 'true';
      createButton.addEventListener('click', function(){
        activateProductsTab('create');
      });
    }
    if (!navTabs.length) return;
    navTabs.forEach(function(tab){
      if (tab.dataset.bound === 'true') return;
      tab.dataset.bound = 'true';
      tab.addEventListener('click', function(event){
        var target = event.currentTarget;
        if (!target) return;
        var page = target.getAttribute('data-page');

        activateProductsTab(page);
