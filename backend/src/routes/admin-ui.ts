   if (!main) return;

   ensureProductsOverviewStyles();

   main.innerHTML = `
    <div class="products-overview-page" style="min-height:100%;background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);padding:60px 40px;">
      <div style="text-align:center;margin-bottom:60px;">
        <h1 id="products-main-title" class="gradient-text" style="font-size:clamp(32px, 5vw, 72px);font-weight:700;margin:0 0 24px 0;color:#1a202c;line-height:1.1;min-height:160px;display:flex;align-items:center;justify-content:center;">
          Featured Products
        </h1>
        <div style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
          <button class="nav-tab" data-page="create" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.3s ease;">Create Product</button>
          <button class="nav-tab" data-page="store" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.3s ease;">Product Store</button>
          <button class="nav-tab" data-page="orders" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.3s ease;">Orders</button>
          <button class="nav-tab" data-page="settings" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.3s ease;">Settings</button>
          <button class="nav-tab" data-page="upsells" style="background:white;color:#4a5568;font-size:16px;font-weight:600;padding:12px 28px;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.3s ease;">Upsells</button>
        </div>
        <p id="products-subtitle" style="font-size:20px;color:#4a5568;margin:0;">Create products and link them to your store, events and shows</p>
      </div>
      <div id="products-page-content">
        <div id="products-overview-page">
          <div style="display:flex;justify-content:center;align-items:center;margin-bottom:80px;position:relative;height:400px;max-width:1200px;margin-left:auto;margin-right:auto;">
            <div class="product-card" style="background:linear-gradient(145deg, #ffffff, #f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% - 320px)) rotate(-6deg);z-index:1;">
              <div style="width:100%;height:100%;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
                <div style="text-align:center;">
                  <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Signed Merchandise</div>
                  <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Special items</div>
                </div>
              </div>
            </div>
            <div class="product-card" style="background:linear-gradient(145deg, #ffffff, #f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% - 160px)) rotate(-3deg);z-index:2;">
              <div style="width:100%;height:100%;background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
                <div style="text-align:center;">
                  <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Books</div>
                  <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Custom signage</div>
                </div>
              </div>
            </div>
            <div class="product-card" style="background:linear-gradient(145deg, #ffffff, #f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 12px 32px rgba(0, 0, 0, 0.2);overflow:hidden;position:absolute;left:50%;transform:translateX(-50%) rotate(0deg);z-index:3;">
              <div style="width:100%;height:100%;background:linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
                <div style="text-align:center;">
                  <div style="font-size:30px;font-weight:700;color:white;margin-bottom:12px;line-height:1.2;">Event T-Shirts</div>
                  <div style="font-size:17px;color:rgba(255,255,255,0.9);font-weight:500;">Premium apparel</div>
                </div>
              </div>
            </div>
            <div class="product-card" style="background:linear-gradient(145deg, #ffffff, #f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% + 160px)) rotate(3deg);z-index:2;">
              <div style="width:100%;height:100%;background:linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
                <div style="text-align:center;">
                  <div style="font-size:30px;font-weight:700;color:#333;margin-bottom:12px;line-height:1.2;">Event Posters</div>
                  <div style="font-size:17px;color:rgba(0,0,0,0.7);font-weight:500;">High-quality prints</div>
                </div>
              </div>
            </div>
            <div class="product-card" style="background:linear-gradient(145deg, #ffffff, #f0f0f0);border-radius:16px;padding:0;width:220px;height:340px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.15);overflow:hidden;position:absolute;left:50%;transform:translateX(calc(-50% + 320px)) rotate(6deg);z-index:1;">
              <div style="width:100%;height:100%;background:linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;position:relative;">
                <div style="text-align:center;">
                  <div style="font-size:30px;font-weight:700;color:#333;margin-bottom:12px;line-height:1.2;">Custom Mugs</div>
                  <div style="font-size:17px;color:rgba(0,0,0,0.7);font-weight:500;">Personalized drinkware</div>
                </div>
              </div>
            </div>
          </div>
          <div style="text-align:center;max-width:700px;margin:0 auto;background:white;padding:48px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <h2 id="products-cta-heading" style="font-size:40px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Create Your Product</h2>
            <p id="products-cta-description" style="font-size:18px;color:#4a5568;margin:0 0 32px 0;line-height:1.6;">Ready to bring your vision to life? Design custom merchandise that perfectly represents your event or brand. Our platform makes it simple to create professional products.</p>
            <button id="products-create-button" class="cta-button" style="background:#009fe3;color:white;font-size:20px;font-weight:600;padding:18px 48px;border:none;border-radius:12px;cursor:pointer;">Create Product</button>
          </div>
        </div>
        <div id="products-create-page" style="display:none;">
          <div style="text-align:center;max-width:600px;margin:80px auto;background:white;padding:80px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <div style="font-size:64px;margin-bottom:24px;">🛍️</div>
            <h2 style="font-size:36px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Create Product</h2>
            <p style="font-size:18px;color:#4a5568;margin:0;">Page coming soon</p>
          </div>
        </div>
        <div id="products-store-page" style="display:none;">
          <div style="text-align:center;max-width:600px;margin:80px auto;background:white;padding:80px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <div style="font-size:64px;margin-bottom:24px;">🏪</div>
            <h2 style="font-size:36px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Product Store</h2>
            <p style="font-size:18px;color:#4a5568;margin:0;">Page coming soon</p>
          </div>
        </div>
        <div id="products-orders-page" style="display:none;">
          <div style="text-align:center;max-width:600px;margin:80px auto;background:white;padding:80px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <div style="font-size:64px;margin-bottom:24px;">📦</div>
            <h2 style="font-size:36px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Orders</h2>
            <p style="font-size:18px;color:#4a5568;margin:0;">Page coming soon</p>
          </div>
        </div>
        <div id="products-settings-page" style="display:none;">
          <div style="text-align:center;max-width:600px;margin:80px auto;background:white;padding:80px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <div style="font-size:64px;margin-bottom:24px;">⚙️</div>
            <h2 style="font-size:36px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Settings</h2>
            <p style="font-size:18px;color:#4a5568;margin:0;">Page coming soon</p>
          </div>
        </div>
        <div id="products-upsells-page" style="display:none;">
          <div style="text-align:center;max-width:600px;margin:80px auto;background:white;padding:80px 40px;border-radius:24px;box-shadow:0 8px 24px rgba(0, 0, 0, 0.1);">
            <div style="font-size:64px;margin-bottom:24px;">💰</div>
            <h2 style="font-size:36px;font-weight:700;margin:0 0 16px 0;color:#2d3748;">Upsells</h2>
            <p style="font-size:18px;color:#4a5568;margin:0;">Page coming soon</p>
          </div>
        </div>
      </div>
    </div>
   `;

   bindProductsOverviewInteractions();
  function ensureProductsOverviewStyles(){
    if (document.getElementById('products-overview-style')) return;

    var head = document.head || document.getElementsByTagName('head')[0];
    if (head){
      if (!document.getElementById('products-overview-font-preconnect')){
        var fontPreconnect = document.createElement('link');
        fontPreconnect.id = 'products-overview-font-preconnect';
        fontPreconnect.rel = 'preconnect';
        fontPreconnect.href = 'https://fonts.googleapis.com';
        head.appendChild(fontPreconnect);
      }

      if (!document.getElementById('products-overview-font-preconnect-gstatic')){
        var fontPreconnectStatic = document.createElement('link');
        fontPreconnectStatic.id = 'products-overview-font-preconnect-gstatic';
        fontPreconnectStatic.rel = 'preconnect';
        fontPreconnectStatic.href = 'https://fonts.gstatic.com';
        fontPreconnectStatic.crossOrigin = 'anonymous';
        head.appendChild(fontPreconnectStatic);
      }

      if (!document.getElementById('products-overview-font')){
        var fontLink = document.createElement('link');
        fontLink.id = 'products-overview-font';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap';
        head.appendChild(fontLink);
      }

      var style = document.createElement('style');
      style.id = 'products-overview-style';
      style.textContent =
        '.products-overview-page, .products-overview-page * { box-sizing: border-box; font-family: \"Space Grotesk\", -apple-system, BlinkMacSystemFont, sans-serif; }' +
        '.products-overview-page .product-card { pointer-events: none; }' +
        '.products-overview-page .cta-button { transition: all 0.3s ease; }' +
        '.products-overview-page .cta-button:hover { transform: scale(1.05); box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3); }' +
        '.products-overview-page .gradient-text { color: #009fe3; }' +
        '.products-overview-page .nav-tab:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }' +
        '.products-overview-page .nav-tab:active { transform: translateY(0); }' +
        '@view-transition { navigation: auto; }';
      head.appendChild(style);
    }
  }

  function bindProductsOverviewInteractions(){
    var createButton = document.getElementById('products-create-button');
    if (createButton && !createButton.dataset.bound){
      createButton.dataset.bound = 'true';
      createButton.addEventListener('click', function(){
        var button = document.getElementById('products-create-button');
        if (!button) return;
        var originalText = button.textContent;
        button.textContent = '��� Opening...';
        button.style.background = '#48bb78';

        setTimeout(function(){
          button.textContent = originalText || 'Create Product';
          button.style.background = '#009fe3';
        }, 1500);
      });
    }

    var navTabs = Array.prototype.slice.call(document.querySelectorAll('.products-overview-page .nav-tab'));
    if (!navTabs.length) return;

    navTabs.forEach(function(tab){
      if (tab.dataset.bound === 'true') return;
      tab.dataset.bound = 'true';
      tab.addEventListener('click', function(event){
        var target = event.currentTarget;
        if (!target) return;
        var page = target.getAttribute('data-page');

        navTabs.forEach(function(resetTab){
          resetTab.style.background = 'white';
          resetTab.style.color = '#4a5568';
          resetTab.style.border = '2px solid #e2e8f0';
        });

        target.style.background = '#009fe3';
        target.style.color = 'white';
        target.style.border = 'none';

        var subtitle = document.getElementById('products-subtitle');
        var originalSubtitle = subtitle ? subtitle.textContent : '';
        if (subtitle){
          subtitle.textContent = 'Navigating to ' + target.textContent + '...';
          subtitle.style.color = '#009fe3';
        }

        setTimeout(function(){
          if (subtitle){
            subtitle.textContent = originalSubtitle;
            subtitle.style.color = '#4a5568';
          }

          var mainTitle = document.getElementById('products-main-title');
          if (mainTitle){
            mainTitle.style.opacity = '0';
            mainTitle.style.transition = 'opacity 0.5s ease';
          }

          setTimeout(function(){
            if (mainTitle){
              if (page === 'create'){
                mainTitle.textContent = 'Create products that people love';
                if (subtitle) subtitle.textContent = 'Design and configure your products with custom pricing, images, and descriptions';
              } else if (page === 'store'){
                mainTitle.textContent = 'Your store, your rules, your vibe';
                if (subtitle) subtitle.textContent = 'Manage your product catalog, organize collections, and control your storefront visibility';
              } else if (page === 'orders'){
                mainTitle.textContent = 'Orders flying in? We got you';
                if (subtitle) subtitle.textContent = 'Track all customer orders, manage fulfillment status, and process refunds in one place';
              } else if (page === 'settings'){
                mainTitle.textContent = 'Tweak it till it feels just right';
                if (subtitle) subtitle.textContent = 'Configure store preferences, payment methods, shipping options, and notification settings';
              } else if (page === 'upsells'){
                mainTitle.textContent = 'More money, less effort. Nice';
                if (subtitle) subtitle.textContent = 'Create automated product recommendations and bundle offers to increase average order value';
              }
              mainTitle.style.opacity = '1';
            }
          }, 500);

          var pages = [
            'products-overview-page',
            'products-create-page',
            'products-store-page',
            'products-orders-page',
            'products-settings-page',
            'products-upsells-page'
          ];

          pages.forEach(function(pageId){
            var pageEl = document.getElementById(pageId);
            if (pageEl) pageEl.style.display = 'none';
          });

          var selectedPage = document.getElementById('products-' + page + '-page');
          if (selectedPage) selectedPage.style.display = 'block';
        }, 1500);
      });
    });
  }

