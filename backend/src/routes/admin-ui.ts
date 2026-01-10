        { key: 'social', label: 'Social Media Campaigns', path: '/admin/ui/marketing', mount: marketingPage },
        { key: 'imports', label: 'Imports & Exports', path: '/admin/ui/imports-exports', mount: importsExports },
        { key: 'add', label: 'Add Customers', path: '/admin/ui/customers/add', mount: addCustomersOverview }
    var initialTab = (options && options.tab) || (function(){
      try {
        return new URLSearchParams(location.search || '').get('tab');
      } catch (e) {
        return null;
      }
    })();
    if (initialTab && sections[initialTab]) {
      setTab(initialTab);
    }

function customersOverview(){
  ensureMarketingOverviewAssets();
  main.innerHTML = '<div class="card"><div class="muted">Loading marketing overview...</div></div>';
  fetch('/static/marketing-overview.html', { credentials: 'include' })
    .then(function(res){ return res.text(); })
    .then(function(html){
      main.innerHTML = html;
    })
    .catch(function(){
      main.innerHTML =
        '<div class="card">'
          +'<div class="title">Marketing overview</div>'
          +'<div class="muted" style="margin-top:6px;">Unable to load the marketing overview content.</div>'
        +'</div>';
    });
}

function ensureMarketingOverviewAssets(){
  if (document.getElementById('marketing-overview-font')) return;
  var link = document.createElement('link');
  link.id = 'marketing-overview-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap';
  document.head.appendChild(link);
}

function addCustomersOverview(){
  marketingPage({
    title: 'Add Customers',
    subtitle: 'Add and manage customer profiles for marketing outreach.',
    tab: 'contacts',
  });
      if (path === '/admin/ui/customers/add') return addCustomersOverview();
