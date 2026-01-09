  ensureHeadAsset('ps-tailwind', 'script', { src: 'https://cdn.tailwindcss.com' });
  ensureHeadAsset('ps-fonts', 'link', {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap'
  });
  ensureHeadAsset('ps-element-sdk', 'script', { src: '/_sdk/element_sdk.js' });
  ensureHeadAsset('ps-data-sdk', 'script', { src: '/_sdk/data_sdk.js', type: 'text/javascript' });

  main.innerHTML = ''
    + '<style>'
    + '  body {'
    + '    box-sizing: border-box;'
    + '  }'
    + '  * {'
    + '    font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif;'
    + '  }'
    + '  .product-card {'
    + '    pointer-events: none;'
    + '  }'
    + '  .cta-button {'
    + '    transition: all 0.3s ease;'
    + '  }'
    + '  .cta-button:hover {'
    + '    transform: scale(1.05);'
    + '    box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);'
    + '  }'
    + '  .gradient-text {'
    + '    color: #009fe3;'
    + '  }'
    + '  .nav-tab:hover {'
    + '    transform: translateY(-2px);'
    + '    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);'
    + '  }'
    + '  .nav-tab:active {'
    + '    transform: translateY(0);'
    + '  }'
    + '  .nav-tab.is-active {'
    + '    background: #009fe3;'
    + '    color: white;'
    + '    border: none;'
    + '  }'
    + '  .products-tab-panel {'
    + '    display: none;'
    + '  }'
    + '  .products-tab-panel.is-active {'
    + '    display: block;'
    + '  }'
    + '</style>'
    + '<style>@view-transition { navigation: auto; }</style>'
    + '<div class="h-full w-full overflow-auto" style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);">'
    +   '<div class="w-full min-h-full" style="padding: 60px 40px;">'
    +     '<div style="text-align: center; margin-bottom: 60px;">'
    +       '<h1 id="main-title" style="font-size: clamp(32px, 5vw, 72px); font-weight: 700; margin: 0 0 24px 0; color: #1a202c; line-height: 1.1; min-height: 160px; display: flex; align-items: center; justify-content: center;" class="gradient-text">Featured Products</h1>'
    +       '<div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">'
    +         '<button class="nav-tab" data-page="create" style="background: white; color: #4a5568; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">Create Product</button>'
    +         '<button class="nav-tab" data-page="store" style="background: white; color: #4a5568; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">Product Store</button>'
    +         '<button class="nav-tab" data-page="orders" style="background: white; color: #4a5568; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">Orders</button>'
    +         '<button class="nav-tab" data-page="settings" style="background: white; color: #4a5568; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">Settings</button>'
    +         '<button class="nav-tab" data-page="upsells" style="background: white; color: #4a5568; font-size: 16px; font-weight: 600; padding: 12px 28px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;">Upsells</button>'
    +       '</div>'
    +       '<p id="subtitle" style="font-size: 20px; color: #4a5568; margin: 0;">Create products and link them to your store, events and shows</p>'
    +     '</div>'
    +     '<div id="products-hero">'
    +       '<div style="display: flex; justify-content: center; align-items: center; margin-bottom: 80px; position: relative; height: 400px; max-width: 1200px; margin-left: auto; margin-right: auto;">'
    +         '<div class="product-card" style="background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 16px; padding: 0; width: 220px; height: 340px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); overflow: hidden; position: absolute; left: 50%; transform: translateX(calc(-50% - 320px)) rotate(-6deg); z-index: 1;">'
    +           '<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">'
    +             '<div style="text-align: center;">'
    +               '<div style="font-size: 30px; font-weight: 700; color: white; margin-bottom: 12px; line-height: 1.2;">Signed Merchandise</div>'
    +               '<div style="font-size: 17px; color: rgba(255,255,255,0.9); font-weight: 500;">Special items</div>'
    +             '</div>'
    +           '</div>'
    +         '</div>'
    +         '<div class="product-card" style="background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 16px; padding: 0; width: 220px; height: 340px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); overflow: hidden; position: absolute; left: 50%; transform: translateX(calc(-50% - 160px)) rotate(-3deg); z-index: 2;">'
    +           '<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">'
    +             '<div style="text-align: center;">'
    +               '<div style="font-size: 30px; font-weight: 700; color: white; margin-bottom: 12px; line-height: 1.2;">Books</div>'
    +               '<div style="font-size: 17px; color: rgba(255,255,255,0.9); font-weight: 500;">Custom signage</div>'
    +             '</div>'
    +           '</div>'
    +         '</div>'
    +         '<div class="product-card" style="background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 16px; padding: 0; width: 220px; height: 340px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2); overflow: hidden; position: absolute; left: 50%; transform: translateX(-50%) rotate(0deg); z-index: 3;">'
    +           '<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">'
    +             '<div style="text-align: center;">'
    +               '<div style="font-size: 30px; font-weight: 700; color: white; margin-bottom: 12px; line-height: 1.2;">Event T-Shirts</div>'
    +               '<div style="font-size: 17px; color: rgba(255,255,255,0.9); font-weight: 500;">Premium apparel</div>'
    +             '</div>'
    +           '</div>'
    +         '</div>'
    +         '<div class="product-card" style="background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 16px; padding: 0; width: 220px; height: 340px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); overflow: hidden; position: absolute; left: 50%; transform: translateX(calc(-50% + 160px)) rotate(3deg); z-index: 2;">'
    +           '<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">'
    +             '<div style="text-align: center;">'
    +               '<div style="font-size: 30px; font-weight: 700; color: #333; margin-bottom: 12px; line-height: 1.2;">Event Posters</div>'
    +               '<div style="font-size: 17px; color: rgba(0,0,0,0.7); font-weight: 500;">High-quality prints</div>'
    +             '</div>'
    +           '</div>'
    +         '</div>'
    +         '<div class="product-card" style="background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 16px; padding: 0; width: 220px; height: 340px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); overflow: hidden; position: absolute; left: 50%; transform: translateX(calc(-50% + 320px)) rotate(6deg); z-index: 1;">'
    +           '<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; position: relative;">'
    +             '<div style="text-align: center;">'
    +               '<div style="font-size: 30px; font-weight: 700; color: #333; margin-bottom: 12px; line-height: 1.2;">Custom Mugs</div>'
    +               '<div style="font-size: 17px; color: rgba(0,0,0,0.7); font-weight: 500;">Personalized drinkware</div>'
    +             '</div>'
    +           '</div>'
    +         '</div>'
    +       '</div>'
    +       '<div style="text-align: center; max-width: 700px; margin: 0 auto 40px; background: white; padding: 48px 40px; border-radius: 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);">'
    +         '<h2 id="cta-heading" style="font-size: 40px; font-weight: 700; margin: 0 0 16px 0; color: #2d3748;">Create Your Product</h2>'
    +         '<p id="cta-description" style="font-size: 18px; color: #4a5568; margin: 0 0 32px 0; line-height: 1.6;">Ready to bring your vision to life? Design custom merchandise that perfectly represents your event or brand. Our platform makes it simple to create professional products.</p>'
    +         '<button id="create-button" class="cta-button" style="background: #009fe3; color: white; font-size: 20px; font-weight: 600; padding: 18px 48px; border: none; border-radius: 12px; cursor: pointer;">Create Product</button>'
    +       '</div>'
    +     '</div>'
    +     '<div id="page-content">'
    +       '<div id="create-page" class="products-tab-panel"></div>'
    +       '<div id="store-page" class="products-tab-panel"></div>'
    +       '<div id="orders-page" class="products-tab-panel"></div>'
    +       '<div id="settings-page" class="products-tab-panel"></div>'
    +       '<div id="upsells-page" class="products-tab-panel"></div>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  var defaultConfig = {
    main_title: "Selling products just got superpowers",
    subtitle: "Create products and link them to your store, events and shows",
    cta_heading: "Create Your Product",
    cta_description: "Creating products has never been simpler. Whether you're an event organiser, a product seller, or both, our platform lets you sell across your store and connect with other TixAll stores. Link products to tickets and shows, or sell across our entire partner network. Start creating professional products that work everywhere.",
    button_text: "Create Product"
  };

  function onConfigChange(config){
    document.getElementById('main-title').textContent = config.main_title || defaultConfig.main_title;
    document.getElementById('subtitle').textContent = config.subtitle || defaultConfig.subtitle;
    document.getElementById('cta-heading').textContent = config.cta_heading || defaultConfig.cta_heading;
    document.getElementById('cta-description').textContent = config.cta_description || defaultConfig.cta_description;
    document.getElementById('create-button').textContent = config.button_text || defaultConfig.button_text;
  }

  function mapToCapabilities(){
    return {
      recolorables: [],
      borderables: [],
      fontEditable: undefined,
      fontSizeable: undefined
    };
  }

  function mapToEditPanelValues(config){
    return new Map([
      ["main_title", config.main_title || defaultConfig.main_title],
      ["subtitle", config.subtitle || defaultConfig.subtitle],
      ["cta_heading", config.cta_heading || defaultConfig.cta_heading],
      ["cta_description", config.cta_description || defaultConfig.cta_description],
      ["button_text", config.button_text || defaultConfig.button_text]
    ]);
  }

  if (window.elementSdk) {
    window.elementSdk.init({
      defaultConfig: defaultConfig,
      onConfigChange: onConfigChange,
      mapToCapabilities: mapToCapabilities,
      mapToEditPanelValues: mapToEditPanelValues
    });
  }

  var navTabs = $$('.nav-tab');
  var createButton = $('#create-button');
  var hero = $('#products-hero');
  var panels = {
    create: $('#create-page'),
    store: $('#store-page'),
    orders: $('#orders-page'),
    settings: $('#settings-page'),
    upsells: $('#upsells-page')
  };
  var tabCopy = {
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

  function mountTab(panel, renderFn){
    if (!panel) return;
    panel.innerHTML = '';
    var prevMain = main;
    main = panel;
    renderFn();
    main = prevMain;
  }

  function setActiveTab(tabKey, options){
    options = options || {};
    if (!panels[tabKey]) tabKey = 'store';

    Object.keys(panels).forEach(function(key){
      var panel = panels[key];
      if (panel) {
        panel.classList.remove('is-active');
        panel.style.display = 'none';
      }
    });

    navTabs.forEach(function(tab){
      var isActive = tab.getAttribute('data-page') === tabKey;
      tab.classList.toggle('is-active', isActive);
    });

    var panel = panels[tabKey];
    if (panel) {
      panel.classList.add('is-active');
      panel.style.display = 'block';
    }

    if (hero){
      hero.style.display = (tabKey === 'store') ? 'block' : 'none';
    }

    var copy = tabCopy[tabKey];
    if (copy){
      $('#main-title').textContent = copy.title;
      $('#subtitle').textContent = copy.subtitle;
    }

    if (panel) {
      mountTab(panel, function(){
        if (tabKey === 'create') return productStoreProductForm();
        if (tabKey === 'store') return productStorePage();
        if (tabKey === 'orders') return productStoreOrdersPage();
        if (tabKey === 'settings') return productStoreSettingsPage();
        if (tabKey === 'upsells') return productStoreUpsellsPage();
      });
    }

    if (options.remember !== false){
      try{
        localStorage.setItem('admin-products-tab', tabKey);
      }catch(err){
        console.warn('Unable to persist products tab', err);
      }
    }

    if (options.updateUrl !== false){
      var url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      history.pushState(null, '', url.toString());
    }
  }

  if (createButton){
    createButton.addEventListener('click', function(){
      var originalText = createButton.textContent;
      createButton.textContent = '✓ Opening...';
      createButton.style.background = '#48bb78';
      setTimeout(function(){
        createButton.textContent = originalText;
        createButton.style.background = '#009fe3';
        setActiveTab('create');
      }, 400);
    });
  }

  navTabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      setActiveTab(tab.getAttribute('data-page'));
    });
  });

  function normalizeTab(raw){
    if (!raw) return '';
    var value = String(raw).toLowerCase();
    if (!panels[value]) return '';
    return value;
  }

  var urlTab = normalizeTab(new URLSearchParams(window.location.search).get('tab'));
  var storedTab = '';
  try{
    storedTab = localStorage.getItem('admin-products-tab') || '';
  }catch(err){
    storedTab = '';
  }
  var initialTab = urlTab || normalizeTab(storedTab) || 'store';
  setActiveTab(initialTab, { updateUrl: !!urlTab, remember: !urlTab });

  window.addEventListener('popstate', function(){
    var popTab = normalizeTab(new URLSearchParams(window.location.search).get('tab'));
    if (popTab){
      setActiveTab(popTab, { updateUrl: false, remember: false });
    }
  });
