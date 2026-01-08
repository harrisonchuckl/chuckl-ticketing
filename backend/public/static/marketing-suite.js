const navItems = [
  { label: 'Marketing Home', path: '/admin/marketing' },
  { label: 'Campaigns', path: '/admin/marketing/campaigns' },
  { label: 'Intelligent Campaigns', path: '/admin/marketing/intelligent' },
  { label: 'Automations', path: '/admin/marketing/automations' },
  { label: 'Contacts', path: '/admin/marketing/contacts' },
  { label: 'Segments', path: '/admin/marketing/segments' },
  { label: 'Templates', path: '/admin/marketing/templates' },
  { label: 'Analytics', path: '/admin/marketing/analytics' },
  { label: 'Deliverability', path: '/admin/marketing/deliverability' },
  { label: 'Settings', path: '/admin/marketing/settings' },
];

const createOptions = [
  { label: 'Create campaign', value: 'campaign' },
  { label: 'Create template', value: 'template' },
  { label: 'Create segment', value: 'segment' },
  { label: 'Create automation', value: 'automation' },
];

const mergeTags = [
  { group: 'Contact', value: '{{contact.firstName}}', label: 'First name' },
  { group: 'Contact', value: '{{contact.lastName}}', label: 'Last name' },
  { group: 'Contact', value: '{{contact.email}}', label: 'Email' },
  { group: 'Contact', value: '{{contact.town}}', label: 'Town' },
  { group: 'Contact', value: '{{contact.county}}', label: 'County' },
  { group: 'Contact', value: '{{contact.tags}}', label: 'Tags' },
  { group: 'Show', value: '{{show.title}}', label: 'Show title' },
  { group: 'Show', value: '{{show.venue}}', label: 'Show venue' },
  { group: 'Show', value: '{{show.date}}', label: 'Show date' },
  { group: 'Show', value: '{{show.time}}', label: 'Show time' },
  { group: 'Show', value: '{{show.priceFrom}}', label: 'Show price from' },
  { group: 'Show', value: '{{show.image}}', label: 'Show image' },
  { group: 'Links', value: '{{links.ticketLink}}', label: 'Ticket link' },
  { group: 'Links', value: '{{links.managePreferencesLink}}', label: 'Manage preferences link' },
  { group: 'Links', value: '{{links.unsubscribeLink}}', label: 'Unsubscribe link' },
];

const SOCIAL_ICON_LIBRARY = {
  facebook: {
    label: 'Facebook',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M13.7 8.5h2.1V6h-2.1c-2.1 0-3.6 1.5-3.6 3.6v1.3H8.4v2.7h1.7V19h3v-5.4h2.2l.4-2.7H13v-1.2c0-.7.4-1.2 1.3-1.2z" fill="#FFFFFF"/></svg>',
  },
  instagram: {
    label: 'Instagram',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig-gradient" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F58529"/><stop offset="0.3" stop-color="#FEDA77"/><stop offset="0.6" stop-color="#DD2A7B"/><stop offset="1" stop-color="#515BD4"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-gradient)"/><rect x="6.5" y="6.5" width="11" height="11" rx="3.5" fill="none" stroke="#FFFFFF" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="#FFFFFF" stroke-width="2"/><circle cx="16.2" cy="7.8" r="1.2" fill="#FFFFFF"/></svg>',
  },
  x: {
    label: 'X (Twitter)',
    svg: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#000000"/><path d="M7 6h3.2l2.4 3.2L15.2 6h2.8l-4.2 5.1L18 18h-3.2l-2.6-3.5L9.3 18H6.5l4.6-5.7L7 6z" fill="#FFFFFF"/></svg>',
  },
  tiktok: {
    label: 'TikTok',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#000000"/><path d="M13.6 6.4v7.1a2.7 2.7 0 1 1-2-2.6V8.6l4.8 1.4V8.1z" fill="#FFFFFF"/><path d="M12.9 6v7a2.7 2.7 0 0 1-2.1 2.6 2.7 2.7 0 0 0 3.2-2.7V6.4z" fill="#25F4EE" opacity="0.9"/><path d="M14.2 6.8v7a2.7 2.7 0 0 1-2.2 2.7 2.7 2.7 0 0 0 3.3-2.7V7.2z" fill="#FE2C55" opacity="0.9"/></svg>',
  },
  youtube: {
    label: 'YouTube',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000"/><polygon points="10 9 16 12 10 15" fill="#FFFFFF"/></svg>',
  },
  linkedin: {
    label: 'LinkedIn',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0A66C2"/><circle cx="8.3" cy="7.7" r="1.2" fill="#FFFFFF"/><rect x="7.2" y="9.5" width="2.2" height="7" fill="#FFFFFF"/><path d="M11.4 9.5h2.2v1c.4-.7 1.3-1.2 2.6-1.2 2 0 3.3 1.3 3.3 3.5v3.7h-2.2v-3.4c0-1.1-.6-1.9-1.7-1.9-1.1 0-1.9.8-1.9 1.9v3.4h-2.2z" fill="#FFFFFF"/></svg>',
  },
  pinterest: {
    label: 'Pinterest',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#E60023"/><path d="M12.4 6.4c-3 0-5.4 2.1-5.4 5 0 2 1.2 3.6 2.8 4.2-.1-.4-.1-1 .1-1.5l.8-3.1c-.2-.4-.3-.9-.3-1.4 0-1.3.8-2.3 1.9-2.3.9 0 1.3.7 1.3 1.6 0 1-.6 2.5-.9 3.8-.2 1 .4 1.8 1.4 1.8 1.7 0 2.9-1.8 2.9-4.1 0-2.2-1.6-3.9-4-3.9z" fill="#FFFFFF"/></svg>',
  },
  snapchat: {
    label: 'Snapchat',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#FFFC00"/><path d="M12 6.5c-1.9 0-3.4 1.6-3.4 3.5v2c0 1-.7 1.8-1.6 2 1 .7 1.8 1 2.7 1.1.4 1.1 1.3 1.9 2.3 1.9s1.9-.8 2.3-1.9c.9-.1 1.7-.4 2.7-1.1-.9-.2-1.6-1-1.6-2v-2c0-1.9-1.5-3.5-3.4-3.5z" fill="#FFFFFF" stroke="#1F2937" stroke-width="0.6"/></svg>',
  },
  website: {
    label: 'Website',
    svg:
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#64748B"/><circle cx="12" cy="12" r="7" fill="none" stroke="#FFFFFF" stroke-width="1.6"/><path d="M5 12h14" stroke="#FFFFFF" stroke-width="1.6"/><path d="M12 5c2.2 2.6 2.2 11.4 0 14" stroke="#FFFFFF" stroke-width="1.6"/></svg>',
  },
};

const SOCIAL_DEFAULT_TYPES = ['facebook', 'instagram', 'x', 'tiktok'];

const API_BASE = '/admin/api/marketing';
const SEARCH_API_BASE = '/admin/marketing/api';

const appState = {
  status: null,
  templates: [],
  segments: [],
  automations: [],
  campaigns: [],
  contacts: [],
  shows: [],
  searchResults: null,
  modal: null,
  contactPage: 0,
  socialLinks: [],
};

function truncatePayload(payload, limit = 3000) {
  try {
    const text = JSON.stringify(payload);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
  } catch (error) {
    const fallback = String(payload || '');
    if (fallback.length <= limit) return fallback;
    return `${fallback.slice(0, limit)}…`;
  }
}

function fetchJson(url, opts = {}) {
  const method = String(opts.method || 'GET').toUpperCase();
  console.log('[marketing-suite] request', { url, method });
  return fetch(url, { credentials: 'include', ...opts }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    console.log('[marketing-suite] response', { url, method, status: res.status, payload: truncatePayload(data) });
    if (!res.ok || data.ok === false) {
      const message = data.message || data.error || 'Request failed';
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  });
}

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value || '').replace(/[&<>"']/g, (match) => map[match]);
}

function normalizeSocialType(type) {
  const raw = String(type || '').toLowerCase().trim();
  if (raw === 'twitter') return 'x';
  return SOCIAL_ICON_LIBRARY[raw] ? raw : null;
}

function normalizeSocialLinks(links, { includeDefaults = false } = {}) {
  const items = Array.isArray(links) ? links : [];
  const map = new Map();
  items.forEach((entry) => {
    const type = normalizeSocialType(entry?.type);
    if (!type || map.has(type)) return;
    map.set(type, { type, url: String(entry?.url || '') });
  });
  const baseItems = includeDefaults
    ? SOCIAL_DEFAULT_TYPES.map((type) => map.get(type) || { type, url: '' })
    : SOCIAL_DEFAULT_TYPES.filter((type) => map.has(type)).map((type) => map.get(type));
  const extraItems = [];
  map.forEach((value, type) => {
    if (!SOCIAL_DEFAULT_TYPES.includes(type)) extraItems.push(value);
  });
  return baseItems.concat(extraItems);
}

function buildDefaultSocialItems() {
  return normalizeSocialLinks(appState.socialLinks || [], { includeDefaults: true });
}

function ensureSocialBlockContent(block) {
  if (!block.content) block.content = {};
  if (Array.isArray(block.content.items)) {
    block.content.items = normalizeSocialLinks(block.content.items);
    const profileMap = new Map();
    (appState.socialLinks || []).forEach((entry) => {
      const type = normalizeSocialType(entry?.type);
      const url = String(entry?.url || '').trim();
      if (type && url) profileMap.set(type, url);
    });
    block.content.items = block.content.items.map((item) => {
      const type = normalizeSocialType(item.type);
      if (type && (!item.url || !String(item.url).trim()) && profileMap.has(type)) {
        return { ...item, url: profileMap.get(type) };
      }
      return item;
    });
    return;
  }
  const legacy = block.content || {};
  const legacyItems = [];
  if (legacy.fb) legacyItems.push({ type: 'facebook', url: legacy.fb });
  if (legacy.ig) legacyItems.push({ type: 'instagram', url: legacy.ig });
  if (legacy.tw) legacyItems.push({ type: 'x', url: legacy.tw });
  if (legacy.tiktok) legacyItems.push({ type: 'tiktok', url: legacy.tiktok });
  block.content.items = normalizeSocialLinks(legacyItems.length ? legacyItems : buildDefaultSocialItems(), {
    includeDefaults: true,
  });
}

function renderSocialIcon(type) {
  const normalized = normalizeSocialType(type);
  if (!normalized) return '';
  return SOCIAL_ICON_LIBRARY[normalized]?.svg || '';
}

function navigateTo(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  renderRoute();
}

function renderModal(title, innerHtml) {
  closeModal();
  const modal = document.createElement('div');
  modal.className = 'ms-modal';
  modal.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <h2>${escapeHtml(title)}</h2>
        <button class="ms-secondary" data-modal-close>Close</button>
      </div>
      <div class="ms-modal-body">${innerHtml}</div>
    </div>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  document.body.appendChild(modal);
  appState.modal = modal;
  return modal;
}

function closeModal() {
  if (appState.modal) {
    appState.modal.remove();
    appState.modal = null;
  }
}

function toast(message, type = 'info') {
  const toastEl = document.createElement('div');
  toastEl.className = `ms-toast ${type}`;
  toastEl.textContent = message;
  document.body.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 3200);
}

function renderTabs(tabs) {
  return `
    <div class="ms-tabs">
      <div class="ms-tab-list">
        ${tabs
          .map(
            (tab, index) =>
              `<button class="ms-secondary" data-tab="${tab.id}" ${index === 0 ? 'data-active="true"' : ''}>${tab.label}</button>`
          )
          .join('')}
      </div>
      ${tabs
        .map(
          (tab, index) =>
            `<div class="ms-tab-panel" data-tab-panel="${tab.id}" style="display:${index === 0 ? 'block' : 'none'};">${tab.content}</div>`
        )
        .join('')}
    </div>
  `;
}

function activateTabs(container) {
  const buttons = Array.from(container.querySelectorAll('[data-tab]'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-tab');
      buttons.forEach((btn) => btn.removeAttribute('data-active'));
      button.setAttribute('data-active', 'true');
      container.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        panel.style.display = panel.getAttribute('data-tab-panel') === id ? 'block' : 'none';
      });
    });
  });
}

function renderFormRow(label, inputHtml, help) {
  return `
    <div class="ms-field">
      <label>${escapeHtml(label)}</label>
      ${inputHtml}
      ${help ? `<div class="ms-muted">${help}</div>` : ''}
    </div>
  `;
}

function renderPill(status) {
  const tone = String(status || 'DRAFT').toLowerCase();
  return `<span class="ms-pill ms-pill-${tone}">${escapeHtml(status || '—')}</span>`;
}

function renderEmptyState(title, subtitle, buttonLabel, onClickName) {
  return `
    <div class="ms-empty">
      <h3>${escapeHtml(title)}</h3>
      <div class="ms-muted">${escapeHtml(subtitle)}</div>
      ${buttonLabel ? `<button class="ms-primary" data-action="${onClickName}">${escapeHtml(buttonLabel)}</button>` : ''}
    </div>
  `;
}

function renderErrorState(title, message, retryLabel = 'Retry') {
  return `
    <div class="ms-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="ms-muted">${escapeHtml(message || 'Something went wrong.')}</div>
      <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
        <button class="ms-secondary" data-action="retry">${escapeHtml(retryLabel)}</button>
      </div>
    </div>
  `;
}

function showErrorState(main, title, error, retryHandler, retryLabel) {
  if (!main) return;
  const message = error?.message || 'Request failed.';
  main.innerHTML = renderErrorState(title, message, retryLabel);
  const retryButton = main.querySelector('[data-action="retry"]');
  if (retryButton && retryHandler) retryButton.addEventListener('click', retryHandler);
}

function showGlobalErrorBanner(message) {
  if (!document.body) return;
  let banner = document.getElementById('ms-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'ms-error-banner';
    banner.style.position = 'fixed';
    banner.style.top = '16px';
    banner.style.left = '16px';
    banner.style.right = '16px';
    banner.style.zIndex = '9999';
    banner.innerHTML = `
      <div class="ms-card" style="border:1px solid #f87171;background:#fff7f7;">
        <div style="font-weight:600;margin-bottom:4px;">Something went wrong</div>
        <div class="ms-muted" data-ms-error-message></div>
      </div>
    `;
    document.body.appendChild(banner);
  }
  const messageEl = banner.querySelector('[data-ms-error-message]');
  if (messageEl) messageEl.textContent = message;
}

function renderPagination(page, hasMore) {
  return `
    <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
      <button class="ms-secondary" data-page="prev" ${page <= 0 ? 'disabled' : ''}>Prev</button>
      <button class="ms-secondary" data-page="next" ${!hasMore ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function renderShell(activePath) {
  const root = document.getElementById('ms-root');
  const nav = navItems
    .map((item) => {
      const active = activePath === item.path;
      return `<a class="${active ? 'active' : ''}" href="${item.path}">${item.label}</a>`;
    })
    .join('');

  root.innerHTML = `
    <div class="ms-shell">
      <aside class="ms-sidebar">
        <div class="ms-brand">TixAll Marketing</div>
        <div class="ms-muted">Mailchimp-style workspace</div>
        <nav class="ms-nav">${nav}</nav>
      </aside>
      <div class="ms-content">
        <div class="ms-topbar">
          <div class="ms-search">
            <input id="ms-search-input" type="search" placeholder="Search campaigns, templates, contacts..." />
            <div class="ms-search-results" id="ms-search-results"></div>
          </div>
          <div class="ms-actions">
            <select id="ms-create" class="ms-secondary">
              <option value="">Create</option>
              ${createOptions.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
            <div class="ms-status" id="ms-status">Loading status...</div>
          </div>
        </div>
        <div class="ms-main" id="ms-main"></div>
      </div>
    </div>
  `;

  root.querySelectorAll('a[href^="/admin/marketing"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      navigateTo(link.getAttribute('href'));
    });
  });

  const createSelect = document.getElementById('ms-create');
  if (createSelect) {
    createSelect.addEventListener('change', (event) => {
      const value = event.target.value;
      event.target.value = '';
      if (value === 'campaign') return openCampaignWizard();
      if (value === 'template') return openTemplateCreator();
      if (value === 'segment') return openSegmentCreator();
      if (value === 'automation') return openAutomationCreator();
    });
  }

  setupSearch();
}

function setupSearch() {
  const input = document.getElementById('ms-search-input');
  const results = document.getElementById('ms-search-results');
  if (!input || !results) return;
  let timer = null;
  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (timer) clearTimeout(timer);
    if (!query) {
      results.innerHTML = '';
      return;
    }
    timer = setTimeout(async () => {
      try {
        const data = await fetchJson(`${SEARCH_API_BASE}/search?q=${encodeURIComponent(query)}`);
        appState.searchResults = data;
        results.innerHTML = renderSearchResults(data);
        results.querySelectorAll('a[data-link]').forEach((link) => {
          link.addEventListener('click', (event) => {
            event.preventDefault();
            results.innerHTML = '';
            input.value = '';
            navigateTo(link.getAttribute('href'));
          });
        });
      } catch (error) {
        results.innerHTML = `<div class="ms-muted">Search failed</div>`;
      }
    }, 200);
  });
}

function renderSearchResults(data) {
  if (!data) return '';
  const sections = [
    { label: 'Campaigns', items: data.campaigns || [], buildHref: (item) => `/admin/marketing/campaigns/${item.id}` },
    { label: 'Templates', items: data.templates || [], buildHref: (item) => `/admin/marketing/templates/${item.id}/edit` },
    { label: 'Contacts', items: data.contacts || [], buildHref: (item) => `/admin/marketing/contacts/${item.id}` },
  ];
  return sections
    .map((section) => {
      if (!section.items.length) return '';
      return `
        <div class="ms-search-section">
          <div class="ms-muted">${section.label}</div>
          ${section.items
            .map((item) => `<a data-link href="${section.buildHref(item)}">${escapeHtml(item.name || item.email || item.subject || 'Result')}</a>`)
            .join('')}
        </div>
      `;
    })
    .join('');
}

async function loadStatus() {
  const statusEl = document.getElementById('ms-status');
  if (!statusEl) return;
  try {
    const data = await fetchJson(`${API_BASE}/status`);
    const verified = data.verifiedStatus || 'UNVERIFIED';
    const sender = data.senderConfigured ? 'Ready' : 'Sender missing';
    statusEl.textContent = `${sender} • ${verified}`;
  } catch (error) {
    statusEl.textContent = 'Status unavailable';
  }
}

function renderCard(title, body) {
  return `<div class="ms-card"><h2>${escapeHtml(title)}</h2><div class="ms-muted">${escapeHtml(body)}</div></div>`;
}

async function renderHome() {
  const main = document.getElementById('ms-main');
  main.innerHTML = `
    <div class="ms-grid cols-3">
      ${renderCard('Campaigns', 'Create campaign journeys, schedule, and send.')}
      ${renderCard('Templates', 'Design MJML-powered email templates.')}
      ${renderCard('Automations', 'Build drip flows with triggers and delays.')}
    </div>
    <div class="ms-card">
      <h2>Welcome to the Marketing Suite</h2>
      <p class="ms-muted">Use the left navigation to manage campaigns, audience, and deliverability.</p>
      <div class="ms-toolbar">
        <a class="ms-primary" href="/admin/marketing/campaigns">Go to Campaigns</a>
        <a class="ms-secondary" href="/admin/marketing/templates">Browse Templates</a>
        <a class="ms-secondary" href="/admin/ui/email?legacy=1">Open legacy Email Campaigns</a>
      </div>
    </div>
  `;
}

async function renderCampaigns() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaigns...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/campaigns`);
    appState.campaigns = data.items || [];
    if (!appState.campaigns.length) {
      main.innerHTML = `<div class="ms-card">${renderEmptyState('No campaigns yet', 'Create your first campaign to reach your audience.', 'Create campaign', 'openCampaignWizard')}</div>`;
      main.querySelector('[data-action="openCampaignWizard"]').addEventListener('click', openCampaignWizard);
      return;
    }
    const rows = appState.campaigns
      .map((item) => {
        const schedule = item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : '—';
        const sentAt = item.sentAt ? new Date(item.sentAt).toLocaleString() : '—';
        return `
          <tr>
            <td><a href="/admin/marketing/campaigns/${item.id}">${escapeHtml(item.name)}</a></td>
            <td>${renderPill(item.status)}</td>
            <td>${escapeHtml(item.segment?.name || '—')}</td>
            <td>${escapeHtml(item.template?.name || '—')}</td>
            <td>${escapeHtml(schedule)}</td>
            <td>${escapeHtml(sentAt)}</td>
          </tr>
        `;
      })
      .join('');
    main.innerHTML = `
      <div class="ms-card">
        <div class="ms-toolbar" style="justify-content:space-between;">
          <div>
            <h2>Campaigns</h2>
            <div class="ms-muted">List-first view of your email campaigns.</div>
          </div>
          <button class="ms-primary" id="ms-create-campaign">Create campaign</button>
        </div>
        <table class="ms-table" style="margin-top:16px;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Segment</th>
              <th>Template</th>
              <th>Scheduled</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    const createBtn = document.getElementById('ms-create-campaign');
    if (createBtn) createBtn.addEventListener('click', openCampaignWizard);
  } catch (error) {
    console.error('[marketing-suite] campaigns load failed', error);
    showErrorState(main, "Couldn't load campaigns", error, renderCampaigns);
  }
}

async function renderIntelligentCampaigns() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading intelligent campaigns...</div>';

  async function fetchJsonDetailed(url, opts = {}) {
    const method = String(opts.method || 'GET').toUpperCase();
    console.log('[marketing-suite] request', { url, method });
    const res = await fetch(url, { credentials: 'include', ...opts });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = {};
      }
    }
    console.log('[marketing-suite] response', { url, method, status: res.status, payload: truncatePayload(data) });
    if (!res.ok || data.ok === false) {
      const message = data.message || data.error || text || 'Request failed';
      const error = new Error(message);
      error.status = res.status;
      error.responseText = text;
      error.data = data;
      throw error;
    }
    return data;
  }

  try {
    const [data, report, templatesData] = await Promise.all([
      fetchJsonDetailed(`${API_BASE}/intelligent`),
      fetchJsonDetailed(`${API_BASE}/intelligent/report?days=30`),
      fetchJsonDetailed(`${API_BASE}/templates`),
    ]);
    const intelligentTypes = data.items || [];
    const configMap = new Map(intelligentTypes.map((config) => [config.kind, config]));
    const reportItems = report?.items || [];
    const statsMap = new Map(reportItems.map((item) => [item.kind, item]));
    const templates = templatesData.items || [];
    const statsRows = intelligentTypes
      .map((item) => {
        const stats = statsMap.get(item.kind) || {};
        return `
          <tr>
            <td>${escapeHtml(item.label)}</td>
            <td>${Number(stats.sent || 0).toLocaleString()}</td>
            <td>${Number(stats.opened || 0).toLocaleString()}</td>
            <td>${Number(stats.clicked || 0).toLocaleString()}</td>
            <td>${Number(stats.bounced || 0).toLocaleString()}</td>
            <td>${Number(stats.unsubscribed || 0).toLocaleString()}</td>
          </tr>
        `;
      })
      .join('');
    const templateOptions = templates.length
      ? templates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')
      : '<option value="">No templates available</option>';
    const baseStrategies = [
      { key: 'MONTHLY_DIGEST', label: 'Monthly digest' },
      { key: 'NEW_ON_SALE_BATCH', label: 'New on sale' },
      { key: 'ALMOST_SOLD_OUT', label: 'Almost sold out' },
      { key: 'ADDON_UPSELL', label: 'Addon upsell' },
    ];

    function resolveIntelligentTagRequirements(kind, strategyKey) {
      const isAddon = kind === 'ADDON_UPSELL' || strategyKey === 'ADDON_UPSELL';
      if (isAddon) {
        return {
          required: ['{{recommendedAddonsHtml}}'],
          optional: ['{{recommendedShowsHtml}}', '{{contact.firstName}}'],
        };
      }
      return {
        required: ['{{recommendedShowsHtml}}'],
        optional: ['{{contact.firstName}}'],
      };
    }

    function renderTagList(tags) {
      if (!tags.length) return '<span class="ms-muted">None</span>';
      return tags.map((tag) => `<code>${escapeHtml(tag)}</code>`).join(', ');
    }

    function normalizeConfig(configJson) {
      const fallback = { horizonDays: 90, maxPer30d: 3 };
      if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) return fallback;
      const horizonRaw = configJson.horizonDays ?? configJson.lookaheadDays;
      const maxRaw = configJson.maxPer30d ?? configJson.maxEmailsPer30DaysPerContact;
      const horizonDays = Number.isFinite(Number(horizonRaw)) ? Math.max(1, Number(horizonRaw)) : fallback.horizonDays;
      const maxPer30d = Number.isFinite(Number(maxRaw)) ? Math.max(0, Number(maxRaw)) : fallback.maxPer30d;
      return { horizonDays, maxPer30d };
    }

    main.innerHTML = `
      <div class="ms-campaign-setup">
        <div class="ms-campaign-form">
          <div class="ms-card">
            <div class="ms-toolbar" style="justify-content:space-between;">
              <div>
                <h2>Intelligent Campaigns</h2>
                <div class="ms-muted">Configure and preview automated campaign content for a specific contact.</div>
              </div>
              <button class="ms-primary" id="ms-intelligent-type-add">Add campaign type</button>
            </div>
          </div>
          <div class="ms-card">
            <h3>Campaign configuration</h3>
            <div class="ms-muted">Choose templates and guardrails for each intelligent campaign.</div>
            <div class="ms-grid cols-2" style="margin-top:12px;">
              ${intelligentTypes
                .map((item) => {
                  const config = configMap.get(item.kind) || {};
                  const configValues = normalizeConfig(config.configJson);
                  const tagRequirements = resolveIntelligentTagRequirements(item.kind, item.strategyKey);
                  return `
                    <div class="ms-card" data-intelligent-card="${item.kind}" style="margin:0;">
                      <div class="ms-toolbar" style="justify-content:space-between;">
                        <div>
                          <strong>${escapeHtml(item.label)}</strong>
                          <div class="ms-muted">${escapeHtml(item.description)}</div>
                        </div>
                      </div>
                      <div class="ms-grid cols-2" style="margin-top:12px;">
                        ${renderFormRow(
                          'Enabled',
                          `<label class="ms-checkbox-row">
                            <input type="checkbox" data-intelligent-enabled ${config.enabled ? 'checked' : ''} />
                            Enable campaign
                          </label>`
                        )}
                        ${renderFormRow(
                          'Template',
                          `<select data-intelligent-template ${templates.length ? '' : 'disabled'}>
                            <option value="">Select template</option>
                            ${templateOptions}
                          </select>`
                        )}
                        ${renderFormRow(
                          'Max emails per 30 days',
                          `<input type="number" min="0" data-intelligent-max value="${configValues.maxPer30d}" />`,
                          'Limit per contact for the last 30 days.'
                        )}
                        ${renderFormRow(
                          'Recommendation horizon (days)',
                          `<input type="number" min="1" data-intelligent-horizon value="${configValues.horizonDays}" />`,
                          'How far ahead to look for shows.'
                        )}
                      </div>
                      <div style="margin-top:12px;">
                        <div style="font-weight:600;">Required blocks</div>
                        <div class="ms-muted" style="margin-top:4px;">
                          <div><strong>Required:</strong> ${renderTagList(tagRequirements.required)}</div>
                          <div><strong>Optional:</strong> ${renderTagList(tagRequirements.optional)}</div>
                        </div>
                        <div class="ms-muted" data-intelligent-template-check style="margin-top:8px;">
                          Select a template to check required blocks.
                        </div>
                        <div class="ms-toolbar" style="justify-content:flex-start;margin-top:8px;gap:8px;flex-wrap:wrap;">
                          <button class="ms-secondary" data-intelligent-template-open disabled>Open template</button>
                          <button class="ms-primary" data-intelligent-template-insert disabled>Insert blocks into template</button>
                        </div>
                        <div
                          data-intelligent-template-error
                          style="display:none;border:1px solid #f87171;background:#fff7f7;padding:8px;border-radius:10px;margin-top:8px;font-size:12px;"
                        ></div>
                      </div>
                      <div class="ms-toolbar" style="justify-content:flex-end;margin-top:8px;">
                        <button class="ms-primary" data-intelligent-save>Save</button>
                      </div>
                      <div class="ms-muted" data-intelligent-status></div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
          <div class="ms-card">
            <h3>Last 30 days performance</h3>
            <div class="ms-muted">Aggregated intelligent campaign events per kind.</div>
            <table class="ms-table" style="margin-top:12px;">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Bounced</th>
                  <th>Unsubscribed</th>
                </tr>
              </thead>
              <tbody>${statsRows}</tbody>
            </table>
          </div>
          <div class="ms-card">
            <h3>Contact</h3>
            ${renderFormRow(
              'Search contacts',
              `<input id="ms-intelligent-contact-search" type="search" placeholder="Search by name or email" />`
            )}
            ${renderFormRow(
              'Select contact',
              `<select id="ms-intelligent-contact-select">
                <option value="">Select a contact</option>
              </select>`,
              'Search results are pulled from your existing contacts list.'
            )}
          </div>
          <div class="ms-card">
            <h3>Campaign kinds</h3>
            ${intelligentTypes
              .map((item) => {
                const config = configMap.get(item.kind);
                const statusLabel = config?.templateId ? 'Configured' : 'Not configured';
                return `
                  <div class="ms-card" style="margin-top:12px;">
                    <div class="ms-toolbar" style="justify-content:space-between;">
                      <div>
                        <strong>${escapeHtml(item.label)}</strong>
                        <div class="ms-muted">${escapeHtml(item.description)}</div>
                        <div class="ms-muted">Status: <span data-intelligent-status-label="${item.kind}">${escapeHtml(statusLabel)}</span></div>
                      </div>
                      <button class="ms-secondary" data-intelligent-preview="${item.kind}">Preview</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
        <div class="ms-campaign-preview">
          <div class="ms-card">
            <div class="ms-toolbar" style="justify-content:space-between;">
              <div>
                <h3>Preview</h3>
                <div class="ms-muted">Rendered HTML preview for the selected campaign and contact.</div>
              </div>
            </div>
            <div class="ms-preview-meta">
              <div><span class="ms-muted">To</span><strong id="ms-intelligent-preview-to">—</strong></div>
              <div><span class="ms-muted">Campaign</span><strong id="ms-intelligent-preview-kind">—</strong></div>
              <div><span class="ms-muted">Eligibility</span><strong id="ms-intelligent-preview-eligibility">—</strong></div>
            </div>
            <div class="ms-preview-frame">
              <iframe id="ms-intelligent-preview-frame" style="width:100%;height:420px;border:1px solid var(--ms-border);border-radius:12px;"></iframe>
              <div class="ms-muted" id="ms-intelligent-preview-empty">Choose a campaign kind and contact to render a preview.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const addTypeButton = document.getElementById('ms-intelligent-type-add');
    if (addTypeButton) {
      addTypeButton.addEventListener('click', () => {
        const modal = renderModal(
          'Add campaign type',
          `
            ${renderFormRow('Label', '<input id="ms-intelligent-type-label" type="text" placeholder="VIP reminders" />')}
            ${renderFormRow(
              'Description',
              '<textarea id="ms-intelligent-type-description" rows="3" placeholder="Describe when to use this campaign type."></textarea>'
            )}
            ${renderFormRow(
              'Base strategy',
              `<select id="ms-intelligent-type-strategy">
                ${baseStrategies
                  .map((strategy) => `<option value="${strategy.key}">${escapeHtml(strategy.label)}</option>`)
                  .join('')}
              </select>`,
              'Choose which built-in strategy powers this custom type.'
            )}
            <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
              <button class="ms-primary" id="ms-intelligent-type-create">Create</button>
            </div>
            <div class="ms-muted" id="ms-intelligent-type-status" style="margin-top:8px;"></div>
          `
        );

        const createButton = modal.querySelector('#ms-intelligent-type-create');
        const statusEl = modal.querySelector('#ms-intelligent-type-status');
        if (createButton) {
          createButton.addEventListener('click', async () => {
            const label = String(modal.querySelector('#ms-intelligent-type-label')?.value || '').trim();
            const description = String(modal.querySelector('#ms-intelligent-type-description')?.value || '').trim();
            const strategyKey = String(modal.querySelector('#ms-intelligent-type-strategy')?.value || '').trim();
            if (!label) {
              if (statusEl) statusEl.textContent = 'Label is required.';
              return;
            }
            if (statusEl) statusEl.textContent = '';
            createButton.setAttribute('disabled', 'true');
            try {
              await fetchJson(`${API_BASE}/intelligent/types`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, description, strategyKey }),
              });
              closeModal();
              toast('Campaign type created.', 'success');
              renderIntelligentCampaigns();
            } catch (error) {
              if (statusEl) statusEl.textContent = error.message || 'Unable to create campaign type.';
              toast(error.message || 'Unable to create campaign type.', 'warning');
            } finally {
              createButton.removeAttribute('disabled');
            }
          });
        }
      });
    }

    const searchInput = document.getElementById('ms-intelligent-contact-search');
    const contactSelect = document.getElementById('ms-intelligent-contact-select');
    const previewTo = document.getElementById('ms-intelligent-preview-to');
    const previewKind = document.getElementById('ms-intelligent-preview-kind');
    const previewEligibility = document.getElementById('ms-intelligent-preview-eligibility');
    const previewFrame = document.getElementById('ms-intelligent-preview-frame');
    const previewEmpty = document.getElementById('ms-intelligent-preview-empty');
    let contactResults = [];
    let selectedContactId = '';

    function formatContactLabel(contact) {
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      return name ? `${contact.email} • ${name}` : contact.email;
    }

    function updateContactOptions(items) {
      const previousSelection = selectedContactId;
      contactSelect.innerHTML = `
        <option value="">Select a contact</option>
        ${items.map((contact) => `<option value="${contact.id}">${escapeHtml(formatContactLabel(contact))}</option>`).join('')}
      `;
      if (previousSelection && items.find((contact) => contact.id === previousSelection)) {
        contactSelect.value = previousSelection;
      }
      updatePreviewContact();
    }

    function updatePreviewContact() {
      const selected = contactResults.find((contact) => contact.id === selectedContactId);
      previewTo.textContent = selected ? formatContactLabel(selected) : '—';
    }

    async function loadContacts(query) {
      const url = query ? `${API_BASE}/contacts?q=${encodeURIComponent(query)}` : `${API_BASE}/contacts`;
      const response = await fetchJson(url);
      contactResults = response.items || [];
      updateContactOptions(contactResults);
    }

    await loadContacts('');

    searchInput.addEventListener('input', () => {
      loadContacts(searchInput.value.trim());
    });

    contactSelect.addEventListener('change', () => {
      selectedContactId = contactSelect.value;
      updatePreviewContact();
    });

    main.querySelectorAll('[data-intelligent-card]').forEach((card) => {
      const kind = card.getAttribute('data-intelligent-card');
      const enabledInput = card.querySelector('[data-intelligent-enabled]');
      const templateSelect = card.querySelector('[data-intelligent-template]');
      const maxInput = card.querySelector('[data-intelligent-max]');
      const horizonInput = card.querySelector('[data-intelligent-horizon]');
      const statusEl = card.querySelector('[data-intelligent-status]');
      const saveButton = card.querySelector('[data-intelligent-save]');
      const templateCheckEl = card.querySelector('[data-intelligent-template-check]');
      const templateErrorEl = card.querySelector('[data-intelligent-template-error]');
      const insertButton = card.querySelector('[data-intelligent-template-insert]');
      const openButton = card.querySelector('[data-intelligent-template-open]');

      const config = configMap.get(kind) || {};
      if (templateSelect && config.templateId) templateSelect.value = config.templateId;

      const updateTemplateButtons = (templateId) => {
        const enabled = Boolean(templateId);
        if (insertButton) insertButton.toggleAttribute('disabled', !enabled);
        if (openButton) openButton.toggleAttribute('disabled', !enabled);
      };

      const renderTemplateError = (error) => {
        if (!templateErrorEl) return;
        if (!error) {
          templateErrorEl.style.display = 'none';
          templateErrorEl.innerHTML = '';
          return;
        }
        const statusLabel = error.status ? `Status ${error.status}` : 'Status unavailable';
        const message = error.message || 'Request failed.';
        templateErrorEl.style.display = 'block';
        templateErrorEl.innerHTML = `<strong>${escapeHtml(statusLabel)}</strong> — ${escapeHtml(message)}`;
      };

      const runTemplateCheck = async (templateId) => {
        if (!templateCheckEl) return null;
        if (!templateId) {
          templateCheckEl.textContent = 'Select a template to check required blocks.';
          renderTemplateError(null);
          return null;
        }
        templateCheckEl.textContent = 'Checking template...';
        renderTemplateError(null);
        try {
          const result = await fetchJsonDetailed(
            `${API_BASE}/intelligent/template-check?templateId=${encodeURIComponent(templateId)}&kind=${encodeURIComponent(kind)}`
          );
          const missing = result.missing || [];
          if (!missing.length) {
            templateCheckEl.textContent = '✅ Template includes required blocks';
          } else {
            templateCheckEl.textContent = `⚠️ Missing: ${missing.join(', ')}`;
          }
          return result;
        } catch (error) {
          templateCheckEl.textContent = '⚠️ Template check failed';
          renderTemplateError(error);
          toast(error.message || 'Template check failed.', 'warning');
          return null;
        }
      };

      updateTemplateButtons(templateSelect?.value);
      if (templateSelect?.value) {
        runTemplateCheck(templateSelect.value);
      }

      if (templateSelect) {
        templateSelect.addEventListener('change', () => {
          updateTemplateButtons(templateSelect.value);
          runTemplateCheck(templateSelect.value);
        });
      }

      if (openButton) {
        openButton.addEventListener('click', () => {
          const templateId = String(templateSelect?.value || '').trim();
          if (!templateId) return;
          window.location.assign(`/admin/marketing/templates/${templateId}/edit`);
        });
      }

      if (insertButton) {
        insertButton.addEventListener('click', async () => {
          const templateId = String(templateSelect?.value || '').trim();
          if (!templateId) return;
          insertButton.setAttribute('disabled', 'true');
          renderTemplateError(null);
          try {
            const response = await fetchJsonDetailed(`${API_BASE}/intelligent/template-insert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templateId, kind }),
            });
            if (response.updated) {
              toast('Inserted required blocks into template.', 'success');
            } else {
              toast('Template already includes required blocks.', 'success');
            }
            await runTemplateCheck(templateId);
          } catch (error) {
            renderTemplateError(error);
            toast(error.message || 'Template insert failed.', 'warning');
          } finally {
            updateTemplateButtons(templateSelect.value);
          }
        });
      }

      if (saveButton) {
        saveButton.addEventListener('click', async () => {
          if (statusEl) statusEl.textContent = '';
          saveButton.setAttribute('disabled', 'true');
          const horizonDays = Number(horizonInput?.value || 0);
          const maxPer30d = Number(maxInput?.value || 0);
          const existingConfig = configMap.get(kind) || {};
          const configJson =
            existingConfig.configJson && typeof existingConfig.configJson === 'object' && !Array.isArray(existingConfig.configJson)
              ? { ...existingConfig.configJson }
              : {};
          configJson.horizonDays = Number.isFinite(horizonDays) && horizonDays > 0 ? horizonDays : 90;
          configJson.maxEmailsPer30DaysPerContact = Number.isFinite(maxPer30d) && maxPer30d >= 0 ? maxPer30d : 3;
          try {
            const payload = {
              enabled: Boolean(enabledInput?.checked),
              templateId: String(templateSelect?.value || '').trim(),
              configJson,
            };
            const response = await fetchJson(`${API_BASE}/intelligent/${kind}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const updated = response.config || {};
            configMap.set(kind, { ...existingConfig, ...updated });
            const statusLabel = document.querySelector(`[data-intelligent-status-label="${kind}"]`);
            if (statusLabel) statusLabel.textContent = updated.templateId ? 'Configured' : 'Not configured';
            if (statusEl) statusEl.textContent = 'Saved.';
            toast('Intelligent campaign saved.', 'success');
          } catch (error) {
            if (statusEl) statusEl.textContent = error.message || 'Save failed.';
            toast(error.message || 'Save failed.', 'warning');
          } finally {
            saveButton.removeAttribute('disabled');
          }
        });
      }
    });

    main.querySelectorAll('[data-intelligent-preview]').forEach((button) => {
      button.addEventListener('click', async () => {
        const kind = button.getAttribute('data-intelligent-preview');
        const kindLabel = intelligentTypes.find((item) => item.kind === kind)?.label || kind;
        previewKind.textContent = kindLabel;

        if (!selectedContactId) {
          toast('Select a contact to preview this campaign.', 'warning');
          return;
        }

        previewEmpty.style.display = 'none';
        previewEligibility.textContent = 'Checking...';
        try {
          const preview = await fetchJson(`/api/marketing/intelligent/${kind}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: selectedContactId }),
          });
          previewFrame.srcdoc = preview.html || '';
          previewEligibility.textContent = preview.meta?.reasons?.length ? 'Suppressed' : 'Eligible';
        } catch (error) {
          previewFrame.removeAttribute('srcdoc');
          previewEmpty.style.display = 'block';
          previewEligibility.textContent = '—';
          toast(error.message || 'Preview failed', 'warning');
        }
      });
    });
  } catch (error) {
    console.error('[marketing-suite] intelligent campaigns load failed', error);
    const status = error?.status ? `Status ${error.status}` : 'Status unavailable';
    const responseText = error?.responseText ? error.responseText : error?.message || 'Unknown error';
    main.innerHTML = `
      <div class="ms-card" style="border:1px solid #f87171;background:#fff7f7;">
        <h2>Couldn't load intelligent campaigns</h2>
        <div class="ms-muted">We hit an API error while loading this page.</div>
        <div style="margin-top:12px;font-weight:600;">${escapeHtml(status)}</div>
        <pre style="white-space:pre-wrap;margin-top:8px;">${escapeHtml(responseText)}</pre>
        <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
          <button class="ms-secondary" data-action="retry">Retry</button>
        </div>
      </div>
    `;
    const retryButton = main.querySelector('[data-action="retry"]');
    if (retryButton) retryButton.addEventListener('click', renderIntelligentCampaigns);
  }
}

async function renderCampaignCreate() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaign builder...</div>';

  try {
    const [segmentsData, templatesData, showsData] = await Promise.all([
      fetchJson(`${API_BASE}/segments`),
      fetchJson(`${API_BASE}/templates`),
      fetchJson('/admin/shows'),
    ]);
    const segments = segmentsData.items || [];
    const templates = templatesData.items || [];
    const shows = showsData.items || [];
    const params = new URLSearchParams(window.location.search);
    const preselectedSegmentId = params.get('segment') || '';
    const selectedSegmentId = preselectedSegmentId || (segments[0] && segments[0].id) || '';
    const selectedTemplateId = (templates[0] && templates[0].id) || '';
    const templateMap = new Map(templates.map((template) => [template.id, template]));
    const segmentMap = new Map(segments.map((segment) => [segment.id, segment]));
    const selectedTemplate = templateMap.get(selectedTemplateId) || {};

  main.innerHTML = `
    <div class="ms-campaign-setup">
      <div class="ms-campaign-form">
        <div class="ms-card">
          <div class="ms-toolbar" style="justify-content:space-between;">
            <div>
              <h2>Create campaign</h2>
              <div class="ms-muted">Set your audience, subject, timing, and content before sending.</div>
            </div>
            <button class="ms-secondary" id="ms-campaign-back">Back to campaigns</button>
          </div>
          <div class="ms-grid cols-2" style="margin-top:16px;">
            ${renderFormRow('Campaign name', '<input id="ms-campaign-name" placeholder="Spring launch update" />')}
            ${renderFormRow(
              'Campaign type',
              `<select id="ms-campaign-type">
                <option value="ONE_OFF">One-off</option>
                <option value="SHOW_REMINDER">Show reminder</option>
                <option value="ROUNDUP">Roundup</option>
                <option value="ANNOUNCEMENT">Announcement</option>
              </select>`
            )}
          </div>
        </div>
        <div class="ms-card">
          <h3>To</h3>
          ${renderFormRow(
            'Audience segment',
            `<select id="ms-campaign-segment">
              ${
                segments.length
                  ? segments
                      .map(
                        (segment) =>
                          `<option value="${segment.id}" ${selectedSegmentId === segment.id ? 'selected' : ''}>${escapeHtml(segment.name)}</option>`
                      )
                      .join('')
                  : '<option value="">No segments available</option>'
              }
            </select>`,
            'Choose a segment, or manage automations from the Automations section.'
          )}
          <div class="ms-toolbar">
            <a class="ms-secondary" href="/admin/marketing/segments">Manage segments</a>
            <a class="ms-secondary" href="/admin/marketing/automations">Set up automation</a>
          </div>
        </div>
        <div class="ms-card">
          <h3>Subject</h3>
          ${renderFormRow(
            'Main line',
            `<input id="ms-campaign-preview-text" value="${escapeHtml(selectedTemplate.previewText || '')}" placeholder="A short preview line" />`,
            'Displayed as the preview text in inboxes.'
          )}
          ${renderFormRow('Subject line', `<input id="ms-campaign-subject" value="${escapeHtml(selectedTemplate.subject || '')}" placeholder="Subject line" />`)}
        </div>
        <div class="ms-card">
          <h3>Send time</h3>
          ${renderFormRow('Schedule for', `<input id="ms-campaign-schedule" type="datetime-local" />`, 'Pick a send time or leave blank to schedule later.')}
        </div>
        <div class="ms-card">
          <h3>Content</h3>
          ${renderFormRow(
            'Template',
            `<select id="ms-campaign-template">
              ${
                templates.length
                  ? templates.map((template) => `<option value="${template.id}">${escapeHtml(template.name)}</option>`).join('')
                  : '<option value="">No templates available</option>'
              }
            </select>`
          )}
          ${renderFormRow(
            'Show association (optional)',
            `<select id="ms-campaign-show">
              <option value="">No show</option>
              ${shows.map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`).join('')}
            </select>`
          )}
          <div class="ms-toolbar">
            <button class="ms-secondary" id="ms-campaign-open-designer">Open designer</button>
            <button class="ms-secondary" id="ms-campaign-refresh-preview">Refresh preview</button>
          </div>
        </div>
        <div class="ms-toolbar" style="justify-content:flex-end;">
          <button class="ms-primary" id="ms-campaign-create">Create campaign</button>
        </div>
      </div>
      <div class="ms-campaign-preview">
        <div class="ms-card">
          <div class="ms-toolbar" style="justify-content:space-between;">
            <div>
              <h3>Template preview</h3>
              <div class="ms-muted">See how the campaign will look before sending.</div>
            </div>
          </div>
          <div class="ms-preview-meta">
            <div><span class="ms-muted">To</span><strong id="ms-preview-to">—</strong></div>
            <div><span class="ms-muted">Subject</span><strong id="ms-preview-subject">—</strong></div>
            <div><span class="ms-muted">Send time</span><strong id="ms-preview-time">Not scheduled</strong></div>
          </div>
          <div class="ms-preview-frame">
            <iframe id="ms-campaign-preview-frame" style="width:100%;height:420px;border:1px solid var(--ms-border);border-radius:12px;"></iframe>
            <div class="ms-muted" id="ms-preview-empty">Select a template to see a live preview.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('ms-campaign-back').addEventListener('click', () => navigateTo('/admin/marketing/campaigns'));

  const previewTo = document.getElementById('ms-preview-to');
  const previewSubject = document.getElementById('ms-preview-subject');
  const previewTime = document.getElementById('ms-preview-time');
  const previewFrame = document.getElementById('ms-campaign-preview-frame');
  const previewEmpty = document.getElementById('ms-preview-empty');
  const segmentSelect = document.getElementById('ms-campaign-segment');
  const templateSelect = document.getElementById('ms-campaign-template');
  const showSelect = document.getElementById('ms-campaign-show');
  const subjectInput = document.getElementById('ms-campaign-subject');
  const previewTextInput = document.getElementById('ms-campaign-preview-text');
  const scheduleInput = document.getElementById('ms-campaign-schedule');
  const openDesignerBtn = document.getElementById('ms-campaign-open-designer');

  function updatePreviewSummary() {
    const segmentName = segmentMap.get(segmentSelect.value)?.name || '—';
    previewTo.textContent = segmentName;
    previewSubject.textContent = subjectInput.value || '—';
    previewTime.textContent = scheduleInput.value ? new Date(scheduleInput.value).toLocaleString() : 'Not scheduled';
  }

  async function updateTemplatePreview() {
    const templateId = templateSelect.value;
    if (!templateId) {
      previewFrame.removeAttribute('srcdoc');
      previewEmpty.style.display = 'block';
      return;
    }
    previewEmpty.style.display = 'none';
    const showId = showSelect.value || undefined;
    const preview = await fetchJson(`${API_BASE}/templates/${templateId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showId,
        sample: { email: 'sample@example.com', firstName: 'Sample', lastName: 'User', showId },
      }),
    });
    previewFrame.srcdoc = preview.html || '';
  }

  function syncTemplateFields() {
    const template = templateMap.get(templateSelect.value);
    if (!template) return;
    subjectInput.value = template.subject || '';
    previewTextInput.value = template.previewText || '';
    updatePreviewSummary();
  }

  updatePreviewSummary();
  if (selectedTemplateId) {
    await updateTemplatePreview();
  }

  segmentSelect.addEventListener('change', updatePreviewSummary);
  subjectInput.addEventListener('input', updatePreviewSummary);
  scheduleInput.addEventListener('change', updatePreviewSummary);
  templateSelect.addEventListener('change', async () => {
    syncTemplateFields();
    await updateTemplatePreview();
  });
  showSelect.addEventListener('change', updateTemplatePreview);

  document.getElementById('ms-campaign-refresh-preview').addEventListener('click', updateTemplatePreview);

  openDesignerBtn.addEventListener('click', () => {
    const templateId = templateSelect.value;
    if (!templateId) {
      toast('Select a template to edit.');
      return;
    }
    window.open(`/admin/marketing/templates/${templateId}/edit`, '_blank', 'noopener');
  });

    document.getElementById('ms-campaign-create').addEventListener('click', async () => {
      const name = document.getElementById('ms-campaign-name').value || 'New campaign';
      const type = document.getElementById('ms-campaign-type').value;
      const segmentId = segmentSelect.value;
    const templateId = templateSelect.value;
    const showId = showSelect.value || null;
    const subject = subjectInput.value;
    const previewText = previewTextInput.value;
    const scheduledFor = scheduleInput.value || null;

    if (!segmentId || !templateId) {
      toast('Please select a segment and template before creating the campaign.', 'warning');
      return;
    }

    await fetchJson(`${API_BASE}/templates/${templateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, previewText }),
    });

    const response = await fetchJson(`${API_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, showId, segmentId, templateId }),
    });

    if (scheduledFor) {
      await fetchJson(`${API_BASE}/campaigns/${response.campaign.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendNow: false, scheduledFor }),
      });
    }

      navigateTo(`/admin/marketing/campaigns/${response.campaign.id}`);
    });
  } catch (error) {
    console.error('[marketing-suite] campaign builder load failed', error);
    showErrorState(main, "Couldn't load campaign builder", error, renderCampaignCreate);
  }
}

async function renderCampaignDetail(campaignId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaign...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/campaigns/${campaignId}`);
    const campaign = data.campaign;
    const summary = data.summary || {};
    const preview = await fetchJson(`${API_BASE}/campaigns/${campaignId}/preview`);
    const estimate = preview.estimate || {};

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${escapeHtml(campaign.name)}</h2>
          <div class="ms-muted">Campaign detail • ${escapeHtml(campaign.status)}</div>
        </div>
        <div class="ms-toolbar">
          <button class="ms-secondary" id="ms-campaign-preview">Preview</button>
          <button class="ms-secondary" id="ms-campaign-test">Send test</button>
          <button class="ms-secondary" id="ms-campaign-schedule">Schedule send</button>
          <button class="ms-primary" id="ms-campaign-send">Send now</button>
          <button class="ms-secondary" id="ms-campaign-cancel">Cancel schedule</button>
        </div>
      </div>
      <div class="ms-grid cols-3" style="margin-top:16px;">
        ${renderCard('Recipients (estimate)', estimate.sendable || 0)}
        ${renderCard('Suppressed', estimate.suppressed || 0)}
        ${renderCard('Consent skipped', estimate.noConsent || 0)}
      </div>
      <div class="ms-grid cols-3" style="margin-top:16px;">
        ${renderCard('Sent', summary.sent || 0)}
        ${renderCard('Failed', summary.failed || 0)}
        ${renderCard('Pending', summary.pending || 0)}
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Summary</h3>
        <div class="ms-muted">Segment: ${escapeHtml(campaign.segment?.name || '—')}</div>
        <div class="ms-muted">Template: ${escapeHtml(campaign.template?.name || '—')}</div>
        <div class="ms-muted">Show: ${escapeHtml(campaign.show?.title || '—')}</div>
        <div class="ms-muted">Scheduled: ${campaign.scheduledFor ? new Date(campaign.scheduledFor).toLocaleString() : '—'}</div>
        <div class="ms-muted">Sent at: ${campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : '—'}</div>
      </div>
    </div>
  `;

    document.getElementById('ms-campaign-preview').addEventListener('click', () => openCampaignPreview(campaignId));
    document.getElementById('ms-campaign-test').addEventListener('click', () => sendCampaignTest(campaignId));
    document.getElementById('ms-campaign-schedule').addEventListener('click', () => scheduleCampaign(campaignId));
    document.getElementById('ms-campaign-send').addEventListener('click', () => sendCampaignNow(campaignId));
    document.getElementById('ms-campaign-cancel').addEventListener('click', () => cancelCampaignSchedule(campaignId));
  } catch (error) {
    console.error('[marketing-suite] campaign detail load failed', error);
    showErrorState(main, "Couldn't load campaign", error, () => renderCampaignDetail(campaignId));
  }
}

async function openCampaignPreview(campaignId) {
  const data = await fetchJson(`${API_BASE}/campaigns/${campaignId}/preview`);
  const modal = renderModal(
    'Campaign Preview',
    `<iframe id="ms-campaign-preview-frame" style="width:100%;height:70vh;border:1px solid var(--ms-border);border-radius:12px;"></iframe>`
  );
  modal.querySelector('#ms-campaign-preview-frame').srcdoc = data.html || '';
}

async function sendCampaignTest(campaignId) {
  const email = prompt('Send test to email address:');
  if (!email) return;
  await fetchJson(`${API_BASE}/campaigns/${campaignId}/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  toast('Test email sent.');
}

async function scheduleCampaign(campaignId) {
  const modal = renderModal(
    'Schedule campaign',
    renderFormRow('Schedule for', `<input id="ms-campaign-scheduled" type="datetime-local" />`) +
      `<div class="ms-toolbar" style="justify-content:flex-end;"><button class="ms-primary" id="ms-campaign-schedule-save">Schedule</button></div>`
  );
  modal.querySelector('#ms-campaign-schedule-save').addEventListener('click', async () => {
    const scheduledFor = modal.querySelector('#ms-campaign-scheduled').value;
    await fetchJson(`${API_BASE}/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendNow: false, scheduledFor }),
    });
    closeModal();
    toast('Campaign scheduled.');
    renderCampaignDetail(campaignId);
  });
}

async function sendCampaignNow(campaignId) {
  await fetchJson(`${API_BASE}/campaigns/${campaignId}/send-now`, { method: 'POST' });
  toast('Campaign queued for sending.');
  renderCampaignDetail(campaignId);
}

async function cancelCampaignSchedule(campaignId) {
  await fetchJson(`${API_BASE}/campaigns/${campaignId}/cancel-schedule`, { method: 'POST' });
  toast('Schedule cancelled.');
  renderCampaignDetail(campaignId);
}

async function renderTemplates() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading templates...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/templates`);
    appState.templates = data.items || [];
    if (!appState.templates.length) {
      main.innerHTML = `<div class="ms-card">${renderEmptyState('No templates yet', 'Create a MJML template to start sending.', 'Create template', 'openTemplateCreator')}</div>`;
      main.querySelector('[data-action="openTemplateCreator"]').addEventListener('click', openTemplateCreator);
      return;
    }
    const rows = appState.templates
      .map((item) => {
        return `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.subject)}</td>
            <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
            <td>
              <a class="ms-secondary" href="/admin/marketing/templates/${item.id}/edit">Edit</a>
            </td>
          </tr>
        `;
      })
      .join('');

    main.innerHTML = `
      <div class="ms-card">
        <div class="ms-toolbar" style="justify-content:space-between;">
          <div>
            <h2>Templates</h2>
            <div class="ms-muted">Design and manage MJML email templates.</div>
          </div>
          <button class="ms-primary" id="ms-create-template">Create template</button>
        </div>
        <table class="ms-table" style="margin-top:16px;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    const createBtn = document.getElementById('ms-create-template');
    if (createBtn) createBtn.addEventListener('click', openTemplateCreator);
  } catch (error) {
    console.error('[marketing-suite] templates load failed', error);
    showErrorState(main, "Couldn't load templates", error, renderTemplates);
  }
}

async function renderTemplateEditor(templateId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading editor...</div>';

  try {
    const [templateData, versionsData, showsData, profileData] = await Promise.all([
      fetchJson(`${API_BASE}/templates/${templateId}`),
      fetchJson(`${API_BASE}/templates/${templateId}/versions`),
      fetchJson('/admin/shows'),
      fetchJson('/auth/me').catch(() => ({ user: {} })),
    ]);
    const template = templateData.template;
    const versions = versionsData.versions || [];
    appState.shows = showsData.items || [];
    appState.socialLinks = normalizeSocialLinks(profileData?.user?.socialLinks || [], { includeDefaults: true });

  window.currentTemplateMeta = {
    name: template.name || '',
    subject: template.subject || '',
    previewText: template.previewText || '',
    fromName: template.fromName || '',
    fromEmail: template.fromEmail || '',
    replyTo: template.replyTo || '',
  };

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${escapeHtml(template.name)}</h2>
          <div class="ms-muted">Template editor</div>
        </div>
        <div class="ms-toolbar">
          <button class="ms-secondary" id="ms-template-preview">Preview</button>
          <button class="ms-primary" id="ms-template-save">Save changes</button>
        </div>
      </div>
      <div id="ms-template-tabs" style="margin-top:16px;">
        ${renderTabs([
         {
  id: 'editor',
  label: 'Visual Editor',
  content: `
  <div class="ms-visual-builder-toolbar">
    <div class="ms-visual-toolbar-group">
      <button class="ms-secondary" id="ms-editor-undo" type="button" disabled>Undo</button>
      <button class="ms-secondary" id="ms-editor-redo" type="button" disabled>Redo</button>
    </div>
  </div>
  <div class="ms-visual-builder">
    <div class="ms-builder-canvas-wrapper">
      <div id="ms-builder-canvas" class="ms-builder-canvas">
        <div class="ms-canvas-placeholder">Drag blocks here from the sidebar</div>
      </div>
    </div>

    <div class="ms-builder-sidebar">
      <div class="ms-sidebar-tabs">
        <button class="ms-tab-btn active" data-sidebar-tab="blocks">Content</button>
        <button class="ms-tab-btn" data-sidebar-tab="styles">Page styles</button>
      </div>

    <div id="ms-sidebar-blocks" class="ms-sidebar-panel active">
  <div class="ms-block-grid">
    <div class="ms-draggable-block" draggable="true" data-type="strip">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
      <span>Strip</span>
    </div>
    <div class="ms-draggable-block" draggable="true" data-type="text">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
            <span>Text</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="boxedtext">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h5"/></svg>
            <span>Boxed Text</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="divider">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Divider</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="space">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h16M4 15h16"/><path d="M7 6l-3 3 3 3M17 6l3 3-3 3"/></svg>
            <span>Space</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="image">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>Image</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="imagegroup">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>
            <span>Image Group</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="imagecard">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="12" rx="1"/><path d="M3 15h18v6H3z"/></svg>
            <span>Image Card</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="18" height="6" rx="2"/></svg>
            <span>Button</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="social">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            <span>Social</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="footer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M4 16h16M4 12h10"/></svg>
            <span>Footer</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="video">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="m10 8 6 4-6 4V8z"/></svg>
            <span>Video</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="product">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <span>Product</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="event">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h4M8 18h8"/></svg>
            <span>Event</span>
          </div>
          <div class="ms-draggable-block" draggable="true" data-type="code">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span>Code</span>
          </div>
        </div>
      </div>
    <div id="ms-sidebar-styles" class="ms-sidebar-panel">
      <div class="ms-sidebar-section-title">Page styles</div>
      ${renderModernColorPicker('Page Background', 'global-bg', '#ffffff', 'updateCanvasBg')}
      <div class="ms-field ms-palette-field">
        <label>Background palette</label>
        ${renderInlinePalette('global-bg', 'updateCanvasBg')}
      </div>
      <div class="ms-field" style="margin-top:12px;">
        <label>Gradient presets</label>
        <div class="ms-gradient-grid" id="ms-gradient-presets"></div>
      </div>
      <div class="ms-gradient-custom">
        <div class="ms-sidebar-section-title">Custom gradient</div>
        <div class="ms-gradient-picker">
          ${renderModernColorPicker('Start color', 'gradient-start', '#111827', 'updateGradientStart')}
          ${renderModernColorPicker('End color', 'gradient-end', '#f9fafb', 'updateGradientEnd')}
        </div>
        <div class="ms-field" style="margin-top:12px;">
          <label>Gradient direction</label>
          <select id="ms-gradient-direction">
            <option value="to bottom">Vertical</option>
            <option value="to right">Horizontal</option>
            <option value="135deg">Diagonal</option>
          </select>
        </div>
      </div>
    </div>

      <div id="ms-block-editor" class="ms-sidebar-panel hidden">
        <div class="ms-toolbar ms-block-editor-header" style="margin-bottom:10px;">
            <button class="ms-secondary small" id="ms-back-to-blocks">← Back</button>
            <div class="ms-block-editor-title" id="ms-block-editor-title">Edit Block</div>
        </div>
        <div id="ms-active-block-settings"></div>
      </div>
    </div>
  </div>
  `,
},
          {
            id: 'preview',
            label: 'Preview',
            content: `
              <div class="ms-grid cols-2">
                <div class="ms-card">
                  ${renderFormRow(
                    'Show',
                    `<select id="ms-template-show">
                      <option value="">Select show</option>
                      ${appState.shows.map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`).join('')}
                    </select>`
                  )}
                  ${renderFormRow('Sample email', `<input id="ms-template-sample-email" value="sample@example.com" />`)}
                  ${renderFormRow('Sample first name', `<input id="ms-template-sample-first" value="Sample" />`)}
                  ${renderFormRow('Sample last name', `<input id="ms-template-sample-last" value="User" />`)}
                  <div class="ms-toolbar" style="justify-content:flex-end;">
                    <button class="ms-primary" id="ms-template-run-preview">Render preview</button>
                  </div>
                </div>
                <div class="ms-card">
                  <h3>Preview</h3>
                  <iframe id="ms-template-preview-frame" style="width:100%;height:360px;border:1px solid var(--ms-border);border-radius:12px;"></iframe>
                </div>
              </div>
            `,
          },
          {
            id: 'versions',
            label: 'Versions',
            content: `
              <div class="ms-card">
                <h3>Version history</h3>
                <div class="ms-muted">Restore a prior version.</div>
                <table class="ms-table" style="margin-top:12px;">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Created</th>
                      <th>Author</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${versions
                      .map(
                        (version) => `
                          <tr>
                            <td>${version.version}</td>
                            <td>${new Date(version.createdAt).toLocaleString()}</td>
                            <td>${escapeHtml(version.createdBy?.email || '—')}</td>
                            <td><button class="ms-secondary" data-version="${version.id}">Restore</button></td>
                          </tr>
                        `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `,
          },
        ])}
      </div>
    </div>
  `;

  activateTabs(document.getElementById('ms-template-tabs'));

// Initialize the Visual Builder logic
setupVisualBuilder();
setupColorPickerListeners(); // NEW: Initialize picker listeners

function findBlockById(blocks, targetId) {
    for (const block of blocks) {
        if (block.id === targetId) return block;
        if (block.type === 'strip' && block.content?.blocks?.length) {
            const match = findBlockById(block.content.blocks, targetId);
            if (match) return match;
        }
    }
    return null;
}

window.updateBlockProp = function(prop, value) {
    if (window.activeBlockId) {
        const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
        if (block && block.content) {
            block.content[prop] = value;
            
            // Sync inputs if they exist (e.g. linking slider to number input)
            const input = document.getElementById(`input-${prop}`);
            const slider = document.getElementById(`slider-${prop}`);
            if (input && input.value !== value) input.value = value;
            if (slider && slider.value !== value) slider.value = value;

            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        }
    }
};
    
window.updateActiveBlockBg = function(color) {
    if (window.activeBlockId) {
        const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
        if (block && block.content) {
            block.content.bgColor = color;
            if (block.type === 'strip' || block.type === 'boxedtext') {
                block.content.gradient = null;
            }
            block.content.isTransparent = false;
            const transparentToggle = document.getElementById('input-strip-transparent');
            if (transparentToggle && transparentToggle.checked) {
                transparentToggle.checked = false;
            }
            const boxedTransparentToggle = document.getElementById('input-boxedtext-transparent');
            if (boxedTransparentToggle && boxedTransparentToggle.checked) {
                boxedTransparentToggle.checked = false;
            }
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas(); // Re-render to show change
        }
    }
};

function getActiveStripBlock() {
    if (!window.activeBlockId) return null;
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (!block || block.type !== 'strip') return null;
    return block;
}

function getActiveBoxedTextBlock() {
    if (!window.activeBlockId) return null;
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (!block || block.type !== 'boxedtext') return null;
    return block;
}

function getActiveButtonBlock() {
    if (!window.activeBlockId) return null;
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (!block || block.type !== 'button') return null;
    return block;
}

window.updateStripTransparency = function(isTransparent) {
    const block = getActiveStripBlock();
    if (!block || !block.content) return;
    block.content.isTransparent = isTransparent;
    if (isTransparent) {
        block.content.gradient = null;
    }
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateActiveStripGradient = function(gradient, payload = {}) {
    const block = getActiveStripBlock();
    if (!block || !block.content) return;
    block.content.gradient = {
        css: gradient,
        ...payload,
    };
    block.content.isTransparent = false;
    const transparentToggle = document.getElementById('input-strip-transparent');
    if (transparentToggle && transparentToggle.checked) {
        transparentToggle.checked = false;
    }
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateStripGradientStart = function(color) {
    window.currentStripGradientStart = color;
    const gradient = getGradientCss(
        window.currentStripGradientDirection || 'to bottom',
        window.currentStripGradientStart || '#111827',
        window.currentStripGradientEnd || '#f9fafb'
    );
    window.updateActiveStripGradient(gradient, {
        start: window.currentStripGradientStart,
        end: window.currentStripGradientEnd || '#f9fafb',
        direction: window.currentStripGradientDirection || 'to bottom',
    });
};

window.updateStripGradientEnd = function(color) {
    window.currentStripGradientEnd = color;
    const gradient = getGradientCss(
        window.currentStripGradientDirection || 'to bottom',
        window.currentStripGradientStart || '#111827',
        window.currentStripGradientEnd || '#f9fafb'
    );
    window.updateActiveStripGradient(gradient, {
        start: window.currentStripGradientStart || '#111827',
        end: window.currentStripGradientEnd,
        direction: window.currentStripGradientDirection || 'to bottom',
    });
};

window.updateBoxedTextTransparency = function(isTransparent) {
    const block = getActiveBoxedTextBlock();
    if (!block || !block.content) return;
    block.content.isTransparent = isTransparent;
    if (isTransparent) {
        block.content.gradient = null;
    }
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateActiveBoxedTextGradient = function(gradient, payload = {}) {
    const block = getActiveBoxedTextBlock();
    if (!block || !block.content) return;
    block.content.gradient = {
        css: gradient,
        ...payload,
    };
    block.content.isTransparent = false;
    const transparentToggle = document.getElementById('input-boxedtext-transparent');
    if (transparentToggle && transparentToggle.checked) {
        transparentToggle.checked = false;
    }
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateBoxedTextGradientStart = function(color) {
    window.currentBoxedTextGradientStart = color;
    const gradient = getGradientCss(
        window.currentBoxedTextGradientDirection || 'to bottom',
        window.currentBoxedTextGradientStart || '#111827',
        window.currentBoxedTextGradientEnd || '#f9fafb'
    );
    window.updateActiveBoxedTextGradient(gradient, {
        start: window.currentBoxedTextGradientStart,
        end: window.currentBoxedTextGradientEnd || '#f9fafb',
        direction: window.currentBoxedTextGradientDirection || 'to bottom',
    });
};

window.updateBoxedTextGradientEnd = function(color) {
    window.currentBoxedTextGradientEnd = color;
    const gradient = getGradientCss(
        window.currentBoxedTextGradientDirection || 'to bottom',
        window.currentBoxedTextGradientStart || '#111827',
        window.currentBoxedTextGradientEnd || '#f9fafb'
    );
    window.updateActiveBoxedTextGradient(gradient, {
        start: window.currentBoxedTextGradientStart || '#111827',
        end: window.currentBoxedTextGradientEnd,
        direction: window.currentBoxedTextGradientDirection || 'to bottom',
    });
};

window.updateActiveButtonBg = function(color) {
    const block = getActiveButtonBlock();
    if (!block || !block.content) return;
    block.content.color = color;
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateActiveButtonText = function(color) {
    const block = getActiveButtonBlock();
    if (!block || !block.content) return;
    block.content.textColor = color;
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
};

window.updateActiveBlockColor = function(color) {
    if (window.activeBlockId) {
        const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
        if (block && block.content) {
            block.content.color = color;
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        }
    }
};

function updateEventBlockStyle(prop, value) {
    if (!window.activeBlockId) return;
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (!block || block.type !== 'event' || !block.content) return;
    block.content[prop] = value;
    recordEditorHistory({ immediate: false });
    renderBuilderCanvas();
}

window.updateActiveEventCardBg = function(color) {
    updateEventBlockStyle('cardBackground', color);
};

window.updateActiveEventCardBorder = function(color) {
    updateEventBlockStyle('cardBorder', color);
};

window.updateActiveEventTitleColor = function(color) {
    updateEventBlockStyle('titleColor', color);
};

window.updateActiveEventMetaColor = function(color) {
    updateEventBlockStyle('metaColor', color);
};

window.updateActiveEventPriceColor = function(color) {
    updateEventBlockStyle('priceColor', color);
};

window.updateActiveTextColor = function(color) {
    if (!window.activeBlockId) return;
    const editor = document.getElementById('ms-text-editor');
    if (!editor) return;
    if (!savedRteSelection && !rteSelectionActive) return;
    restoreRteSelection(editor);
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, color);
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (block && block.content) {
        block.content.color = color;
        block.content.text = editor.innerHTML;
        recordEditorHistory({ immediate: false });
        renderBuilderCanvas();
    }
};

window.updateActiveTextHighlight = function(color) {
    if (!window.activeBlockId) return;
    const editor = document.getElementById('ms-text-editor');
    if (!editor) return;
    if (!savedRteSelection && !rteSelectionActive) return;
    restoreRteSelection(editor);
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, color);
    document.execCommand('backColor', false, color);
    const block = findBlockById(window.editorBlocks || [], window.activeBlockId);
    if (block && block.content) {
        block.content.highlightColor = color;
        block.content.text = editor.innerHTML;
        recordEditorHistory({ immediate: false });
        renderBuilderCanvas();
    }
};
    
    
  async function saveTemplate() {
    const meta = window.currentTemplateMeta || {};
    const getMetaField = (id, fallback) => {
      const el = document.getElementById(id);
      if (el) return el.value;
      return fallback || '';
    };
    const payload = {
      name: getMetaField('ms-template-name', meta.name),
      subject: getMetaField('ms-template-subject', meta.subject),
      previewText: getMetaField('ms-template-preview-text', meta.previewText),
      fromName: getMetaField('ms-template-from-name', meta.fromName),
      fromEmail: getMetaField('ms-template-from-email', meta.fromEmail),
      replyTo: getMetaField('ms-template-reply-to', meta.replyTo),
// We are saving the JSON state of the visual builder
mjmlBody: JSON.stringify(window.currentTemplateBlocks || []),    };
    const response = await fetchJson(`${API_BASE}/templates/${templateId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.approvalRequired) {
      toast('Template changes submitted for approval.', 'warning');
    } else {
      toast('Template saved.');
    }
  }

  document.getElementById('ms-template-save').addEventListener('click', saveTemplate);
  document.getElementById('ms-template-preview').addEventListener('click', () => activateTab('preview'));

  function activateTab(id) {
    document.querySelector(`[data-tab="${id}"]`).click();
  }

  document.getElementById('ms-template-run-preview').addEventListener('click', async () => {
    await saveTemplate();
    const showId = document.getElementById('ms-template-show').value;
    const sample = {
      email: document.getElementById('ms-template-sample-email').value,
      firstName: document.getElementById('ms-template-sample-first').value,
      lastName: document.getElementById('ms-template-sample-last').value,
    };
    const preview = await fetchJson(`${API_BASE}/templates/${templateId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showId, sample }),
    });
    const frame = document.getElementById('ms-template-preview-frame');
    frame.srcdoc = preview.html || '';
  });

    document.querySelectorAll('[data-version]').forEach((button) => {
      button.addEventListener('click', async () => {
        const versionId = button.getAttribute('data-version');
        await fetchJson(`${API_BASE}/templates/${templateId}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId }),
        });
        toast('Version restored.');
        renderTemplateEditor(templateId);
      });
    });
  } catch (error) {
    console.error('[marketing-suite] template editor load failed', error);
    showErrorState(main, "Couldn't load template", error, () => renderTemplateEditor(templateId));
  }
}

async function renderSegments() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading segments...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/segments`);
    appState.segments = data.items || [];
    if (!appState.segments.length) {
      main.innerHTML = `<div class="ms-card">${renderEmptyState('No segments yet', 'Create a segment to target your audience.', 'Create segment', 'openSegmentCreator')}</div>`;
      main.querySelector('[data-action="openSegmentCreator"]').addEventListener('click', openSegmentCreator);
      return;
    }
    const rows = appState.segments
      .map(
        (item) => `
          <tr>
            <td><a href="/admin/marketing/segments/${item.id}">${escapeHtml(item.name)}</a></td>
            <td>${escapeHtml(item.description || '—')}</td>
            <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
          </tr>
        `
      )
      .join('');
    main.innerHTML = `
      <div class="ms-card">
        <div class="ms-toolbar" style="justify-content:space-between;">
          <div>
            <h2>Segments</h2>
            <div class="ms-muted">Audience slices for targeted campaigns.</div>
          </div>
          <button class="ms-primary" id="ms-create-segment">Create segment</button>
        </div>
        <table class="ms-table" style="margin-top:16px;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    document.getElementById('ms-create-segment').addEventListener('click', openSegmentCreator);
  } catch (error) {
    console.error('[marketing-suite] segments load failed', error);
    showErrorState(main, "Couldn't load segments", error, renderSegments);
  }
}

async function renderSegmentDetail(segmentId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading segment...</div>';
  try {
    const [segmentData, evalData] = await Promise.all([
      fetchJson(`${API_BASE}/segments/${segmentId}`),
      fetchJson(`${API_BASE}/segments/${segmentId}/evaluate`, { method: 'POST' }),
    ]);
    const segment = segmentData.segment;
    const estimate = evalData.estimate || {};
    const sample = evalData.sample || [];

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${escapeHtml(segment.name)}</h2>
          <div class="ms-muted">${escapeHtml(segment.description || '')}</div>
        </div>
        <button class="ms-primary" id="ms-use-segment">Use in campaign</button>
      </div>
      <div class="ms-grid cols-3" style="margin-top:16px;">
        ${renderCard('Estimated recipients', estimate.sendable || 0)}
        ${renderCard('Suppressed', estimate.suppressed || 0)}
        ${renderCard('No consent', estimate.noConsent || 0)}
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Rules</h3>
        <pre class="ms-muted">${escapeHtml(JSON.stringify(segment.rules || {}, null, 2))}</pre>
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Sample contacts</h3>
        <table class="ms-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Town</th>
            </tr>
          </thead>
          <tbody>
            ${sample
              .map(
                (contact) => `
                  <tr>
                    <td>${escapeHtml(contact.email)}</td>
                    <td>${escapeHtml(`${contact.firstName || ''} ${contact.lastName || ''}`.trim())}</td>
                    <td>${escapeHtml(contact.town || '—')}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

    document.getElementById('ms-use-segment').addEventListener('click', () => openCampaignWizard(segmentId));
  } catch (error) {
    console.error('[marketing-suite] segment detail load failed', error);
    showErrorState(main, "Couldn't load segment", error, () => renderSegmentDetail(segmentId));
  }
}

async function renderContacts() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading contacts...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/contacts`);
    appState.contacts = data.items || [];

    if (!appState.contacts.length) {
      main.innerHTML = `<div class="ms-card">${renderEmptyState('No contacts found', 'Import contacts to build your audience.', 'Import contacts', 'openContactImporter')}</div>`;
      main.querySelector('[data-action="openContactImporter"]').addEventListener('click', openContactImporter);
      return;
    }

    const pageSize = 25;
    const start = appState.contactPage * pageSize;
    const rows = appState.contacts.slice(start, start + pageSize);
    const hasMore = start + pageSize < appState.contacts.length;

    main.innerHTML = `
      <div class="ms-card">
        <div class="ms-toolbar" style="justify-content:space-between;">
          <div>
            <h2>Contacts</h2>
            <div class="ms-muted">Audience records and subscriptions.</div>
          </div>
          <button class="ms-primary" id="ms-import-contacts">Import contacts</button>
        </div>
        <table class="ms-table" style="margin-top:16px;">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (item) => `
                  <tr>
                    <td><a href="/admin/marketing/contacts/${item.id}">${escapeHtml(item.email)}</a></td>
                    <td>${escapeHtml(`${item.firstName || ''} ${item.lastName || ''}`.trim())}</td>
                    <td>${escapeHtml(item.status || '—')}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
        ${renderPagination(appState.contactPage, hasMore)}
      </div>
    `;

    document.getElementById('ms-import-contacts').addEventListener('click', openContactImporter);
    main.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => {
        const direction = button.getAttribute('data-page');
        appState.contactPage += direction === 'next' ? 1 : -1;
        appState.contactPage = Math.max(0, appState.contactPage);
        renderContacts();
      });
    });
  } catch (error) {
    console.error('[marketing-suite] contacts load failed', error);
    showErrorState(main, "Couldn't load contacts", error, renderContacts);
  }
}

async function renderContactDetail(contactId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading contact...</div>';
  try {
    const [data, audit] = await Promise.all([
      fetchJson(`${API_BASE}/contacts/${contactId}`),
      fetchJson(`${API_BASE}/contacts/${contactId}/audit`),
    ]);
    const contact = data.contact;
    const consent = data.consent || {};
    const suppressions = data.suppressions || [];
    const preferences = data.preferences || [];
    const logs = audit.items || [];

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${escapeHtml(contact.email)}</h2>
          <div class="ms-muted">${escapeHtml(`${contact.firstName || ''} ${contact.lastName || ''}`.trim())}</div>
        </div>
        <div class="ms-toolbar">
          <button class="ms-secondary" id="ms-contact-suppress">Add suppression</button>
          <button class="ms-secondary" id="ms-contact-unsuppress">Remove suppression</button>
        </div>
      </div>
      <div class="ms-grid cols-3" style="margin-top:16px;">
        ${renderCard('Consent status', consent.status || 'TRANSACTIONAL_ONLY')}
        ${renderCard('Lawful basis', consent.lawfulBasis || '—')}
        ${renderCard('Source', consent.source || '—')}
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Preferences</h3>
        <ul>
          ${preferences
            .map((pref) => `<li>${escapeHtml(pref.name)} • <span class="ms-muted">${escapeHtml(pref.status || 'UNKNOWN')}</span></li>`)
            .join('')}
        </ul>
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Suppressions</h3>
        ${suppressions.length ? suppressions.map((sup) => `<div>${escapeHtml(sup.type)} • ${escapeHtml(sup.reason || '')}</div>`).join('') : '<div class="ms-muted">No suppressions</div>'}
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Audit timeline</h3>
        <ul>
          ${logs
            .map((log) => `<li>${new Date(log.createdAt).toLocaleString()} • ${escapeHtml(log.action)}</li>`)
            .join('')}
        </ul>
      </div>
    </div>
  `;

    document.getElementById('ms-contact-suppress').addEventListener('click', async () => {
      const reason = prompt('Suppression reason:', 'Manual suppression');
      await fetchJson(`${API_BASE}/contacts/${contactId}/suppress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      toast('Suppression added.');
      renderContactDetail(contactId);
    });
    document.getElementById('ms-contact-unsuppress').addEventListener('click', async () => {
      await fetchJson(`${API_BASE}/contacts/${contactId}/unsuppress`, { method: 'POST' });
      toast('Suppression removed.');
      renderContactDetail(contactId);
    });
  } catch (error) {
    console.error('[marketing-suite] contact detail load failed', error);
    showErrorState(main, "Couldn't load contact", error, () => renderContactDetail(contactId));
  }
}

async function renderAutomations() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading automations...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/automations`);
    appState.automations = data.items || [];
    if (!appState.automations.length) {
      main.innerHTML = `<div class="ms-card">${renderEmptyState('No automations yet', 'Create a flow to automate your messaging.', 'Create automation', 'openAutomationCreator')}</div>`;
      main.querySelector('[data-action="openAutomationCreator"]').addEventListener('click', openAutomationCreator);
      return;
    }
    const rows = appState.automations
      .map((item) => {
        return `
          <tr>
            <td><a href="/admin/marketing/automations/${item.id}">${escapeHtml(item.name)}</a></td>
            <td>${escapeHtml(item.triggerType)}</td>
            <td>${item.isEnabled ? 'Enabled' : 'Paused'}</td>
          </tr>
        `;
      })
      .join('');
    main.innerHTML = `
      <div class="ms-card">
        <div class="ms-toolbar" style="justify-content:space-between;">
          <div>
            <h2>Automations</h2>
            <div class="ms-muted">Trigger-based journeys with flows.</div>
          </div>
          <button class="ms-primary" id="ms-create-automation">Create automation</button>
        </div>
        <table class="ms-table" style="margin-top:16px;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    const createBtn = document.getElementById('ms-create-automation');
    if (createBtn) createBtn.addEventListener('click', openAutomationCreator);
  } catch (error) {
    console.error('[marketing-suite] automations load failed', error);
    showErrorState(main, "Couldn't load automations", error, renderAutomations);
  }
}

function buildFlowFromSteps(triggerType, steps) {
  const nodes = [{ id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { triggerType } }];
  const edges = [];
  let prev = 'trigger';
  steps.forEach((step, index) => {
    const id = `step_${index + 1}`;
    nodes.push({ id, type: step.type, position: { x: 200, y: index * 120 }, data: step.data || {} });
    edges.push({ id: `edge_${prev}_${id}`, source: prev, target: id });
    prev = id;
  });
  return { nodes, edges };
}

async function renderAutomationDetail(automationId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading automation...</div>';
  try {
    const [automationData, templateData] = await Promise.all([
      fetchJson(`${API_BASE}/automations/${automationId}`),
      fetchJson(`${API_BASE}/templates`),
    ]);
    const automation = automationData.automation;
    const templates = templateData.items || [];
    const steps = automation.steps || [];

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${escapeHtml(automation.name)}</h2>
          <div class="ms-muted">Trigger: ${escapeHtml(automation.triggerType)}</div>
        </div>
        <div class="ms-toolbar">
          <button class="ms-secondary" id="ms-automation-toggle">${automation.isEnabled ? 'Disable' : 'Enable'}</button>
          <button class="ms-secondary" id="ms-automation-edit-flow">Edit flow</button>
        </div>
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Compiled steps</h3>
        ${steps.length ? steps.map((step) => `<div>${escapeHtml(step.type)} • ${escapeHtml(step.template?.name || '')}</div>`).join('') : '<div class="ms-muted">No steps yet.</div>'}
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Flow JSON</h3>
        <pre class="ms-muted">${escapeHtml(JSON.stringify(automation.flowJson || {}, null, 2))}</pre>
      </div>
    </div>
  `;

    document.getElementById('ms-automation-toggle').addEventListener('click', async () => {
      await fetchJson(`${API_BASE}/automations/${automationId}/toggle`, { method: 'POST' });
      toast('Automation updated.');
      renderAutomationDetail(automationId);
    });

    document.getElementById('ms-automation-edit-flow').addEventListener('click', () => openAutomationFlowEditor(automation, templates));
  } catch (error) {
    console.error('[marketing-suite] automation detail load failed', error);
    showErrorState(main, "Couldn't load automation", error, () => renderAutomationDetail(automationId));
  }
}

function openAutomationFlowEditor(automation, templates) {
  const existingSteps = (automation.flowJson?.nodes || [])
    .filter((node) => node.id !== 'trigger')
    .map((node) => ({ type: node.type, data: node.data || {} }));

  const modal = renderModal(
    'Edit automation flow',
    `<div id="ms-flow-steps">
      ${existingSteps.map((step, index) => renderStepRow(step, index, templates)).join('')}
    </div>
    <button class="ms-secondary" id="ms-add-step">Add step</button>
    <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
      <button class="ms-primary" id="ms-save-flow">Save flow</button>
    </div>`
  );

  function renderStepRow(step, index, templateList) {
    return `
      <div class="ms-card" data-step-index="${index}" style="margin-top:12px;">
        ${renderFormRow(
          'Step type',
          `<select data-step-type>
            <option value="delay" ${step.type === 'delay' ? 'selected' : ''}>Delay</option>
            <option value="condition" ${step.type === 'condition' ? 'selected' : ''}>Condition</option>
            <option value="sendEmail" ${step.type === 'sendEmail' ? 'selected' : ''}>Send email</option>
            <option value="end" ${step.type === 'end' ? 'selected' : ''}>End</option>
          </select>`
        )}
        <div data-step-fields>
          ${step.type === 'delay'
            ? renderFormRow('Delay (minutes)', `<input type="number" data-delay value="${step.data?.delayMinutes || 0}" />`)
            : ''}
          ${step.type === 'sendEmail'
            ? renderFormRow(
                'Template',
                `<select data-template>
                  <option value="">Select template</option>
                  ${templateList.map((template) => `<option value="${template.id}" ${step.data?.templateId === template.id ? 'selected' : ''}>${escapeHtml(template.name)}</option>`).join('')}
                </select>`
              )
            : ''}
        </div>
      </div>
    `;
  }

  function refreshFields() {
    modal.querySelectorAll('[data-step-index]').forEach((row) => {
      const type = row.querySelector('[data-step-type]').value;
      const index = Number(row.getAttribute('data-step-index'));
      const step = existingSteps[index];
      step.type = type;
      row.querySelector('[data-step-fields]').innerHTML =
        type === 'delay'
          ? renderFormRow('Delay (minutes)', `<input type="number" data-delay value="${step.data?.delayMinutes || 0}" />`)
          : type === 'sendEmail'
          ? renderFormRow(
              'Template',
              `<select data-template>
                <option value="">Select template</option>
                ${templates.map((template) => `<option value="${template.id}" ${step.data?.templateId === template.id ? 'selected' : ''}>${escapeHtml(template.name)}</option>`).join('')}
              </select>`
            )
          : '';
    });
  }

  modal.querySelectorAll('[data-step-type]').forEach((select) => {
    select.addEventListener('change', refreshFields);
  });

  modal.querySelector('#ms-add-step').addEventListener('click', () => {
    existingSteps.push({ type: 'delay', data: { delayMinutes: 0 } });
    modal.querySelector('#ms-flow-steps').insertAdjacentHTML('beforeend', renderStepRow(existingSteps[existingSteps.length - 1], existingSteps.length - 1, templates));
    refreshFields();
  });

  modal.querySelector('#ms-save-flow').addEventListener('click', async () => {
    modal.querySelectorAll('[data-step-index]').forEach((row) => {
      const index = Number(row.getAttribute('data-step-index'));
      const type = row.querySelector('[data-step-type]').value;
      const data = {};
      if (type === 'delay') data.delayMinutes = Number(row.querySelector('[data-delay]').value || 0);
      if (type === 'sendEmail') data.templateId = row.querySelector('[data-template]').value;
      existingSteps[index] = { type, data };
    });
    const flowJson = buildFlowFromSteps(automation.triggerType, existingSteps);
    await fetchJson(`${API_BASE}/automations/${automation.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowJson }),
    });
    await fetchJson(`${API_BASE}/automations/${automation.id}/flow/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flowJson),
    });
    toast('Flow updated.');
    closeModal();
    renderAutomationDetail(automation.id);
  });
}

async function renderAnalytics() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading analytics...</div>';
  try {
    const data = await fetchJson(`${API_BASE}/analytics/summary`);

    main.innerHTML = `
      <div class="ms-card">
        <h2>Analytics</h2>
        <div class="ms-muted">Performance overview</div>
        <div class="ms-grid cols-4" style="margin-top:16px;">
          ${renderCard('Sent (7d)', data.sentLast7Days || 0)}
          ${renderCard('Sent (30d)', data.sentLast30Days || 0)}
          ${renderCard('Open rate', `${Math.round((data.openRate || 0) * 100)}%`)}
          ${renderCard('Click rate', `${Math.round((data.clickRate || 0) * 100)}%`)}
        </div>
        <div class="ms-grid cols-2" style="margin-top:16px;">
          <div class="ms-card">
            <h3>Top campaigns</h3>
            ${(data.topCampaigns || []).map((campaign) => `<div>${escapeHtml(campaign.name)} • ${campaign.events} events</div>`).join('') || '<div class="ms-muted">No campaign activity yet.</div>'}
          </div>
          <div class="ms-card">
            <h3>Top segments</h3>
            ${(data.topSegments || []).map((segment) => `<div>${escapeHtml(segment.name)} • ${segment.engagementRate || 0}%</div>`).join('') || '<div class="ms-muted">No segment activity yet.</div>'}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[marketing-suite] analytics load failed', error);
    showErrorState(main, "Couldn't load analytics", error, renderAnalytics);
  }
}

async function renderDeliverability() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading deliverability...</div>';
  try {
    const [summaryData, warmupData, statusData] = await Promise.all([
      fetchJson(`${API_BASE}/deliverability/summary?days=30`),
      fetchJson(`${API_BASE}/deliverability/warmup`),
      fetchJson(`${API_BASE}/status`),
    ]);
    const summary = summaryData.summary || {};
    const presets = warmupData.data || [];

    main.innerHTML = `
      <div class="ms-card">
        <h2>Deliverability</h2>
        <div class="ms-muted">30-day summary</div>
        <div class="ms-grid cols-3" style="margin-top:16px;">
          ${renderCard('Sent', summary.sent || 0)}
          ${renderCard('Opened', summary.opened || 0)}
          ${renderCard('Clicked', summary.clicked || 0)}
        </div>
        <div class="ms-card" style="margin-top:16px;">
          <h3>Verification status</h3>
          <div class="ms-muted">Sender configured: ${statusData.senderConfigured ? 'Yes' : 'No'} • Verified: ${statusData.verifiedStatus || 'UNVERIFIED'}</div>
        </div>
        <div class="ms-card" style="margin-top:16px;">
          <h3>Warmup presets</h3>
          ${presets.map((preset) => `<div>${escapeHtml(preset.label || 'Preset')} • ${preset.volume || 0} emails</div>`).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    if (error.status === 403) {
      showErrorState(main, "Couldn't load deliverability", error, renderDeliverability);
      return;
    }
    showErrorState(main, "Couldn't load deliverability", error, renderDeliverability);
  }
}

async function renderSettings() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading settings...</div>';
  try {
    const [settingsData, rolesData] = await Promise.all([
      fetchJson(`${API_BASE}/settings`),
      fetchJson(`${API_BASE}/settings/roles`),
    ]);
    const settings = settingsData.settings || {};
    const roles = rolesData.assignments || [];

    main.innerHTML = `
      <div class="ms-card">
        <h2>Settings</h2>
        <div class="ms-muted">Sender profiles and governance.</div>
        <div class="ms-grid cols-2" style="margin-top:16px;">
          ${renderFormRow('From name', `<input id="ms-settings-from-name" value="${escapeHtml(settings.defaultFromName || '')}" />`)}
          ${renderFormRow('From email', `<input id="ms-settings-from-email" value="${escapeHtml(settings.defaultFromEmail || '')}" />`)}
          ${renderFormRow('Reply-to', `<input id="ms-settings-reply-to" value="${escapeHtml(settings.defaultReplyTo || '')}" />`)}
          ${renderFormRow('Daily limit override', `<input id="ms-settings-daily-limit" type="number" value="${escapeHtml(settings.dailyLimitOverride || '')}" />`)}
        </div>
        <div class="ms-field">
          <label><input type="checkbox" id="ms-settings-verified" ${settings.requireVerifiedFrom ? 'checked' : ''} /> Require verified from address</label>
        </div>
        <div class="ms-toolbar" style="margin-top:16px;">
          <button class="ms-primary" id="ms-save-settings">Save settings</button>
        </div>
      </div>
      <div class="ms-card" style="margin-top:16px;">
        <h3>Governance roles</h3>
        <table class="ms-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${roles.map((assignment) => `<tr><td>${escapeHtml(assignment.userId)}</td><td>${escapeHtml(assignment.role)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="ms-toolbar" style="margin-top:12px;">
          <input id="ms-role-user" placeholder="User ID" />
          <select id="ms-role-role">
            <option value="VIEWER">Viewer</option>
            <option value="CAMPAIGN_CREATOR">Creator</option>
            <option value="APPROVER">Approver</option>
          </select>
          <button class="ms-secondary" id="ms-role-save">Assign role</button>
        </div>
      </div>
    `;

    document.getElementById('ms-save-settings').addEventListener('click', async () => {
      await fetchJson(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultFromName: document.getElementById('ms-settings-from-name').value,
          defaultFromEmail: document.getElementById('ms-settings-from-email').value,
          defaultReplyTo: document.getElementById('ms-settings-reply-to').value,
          dailyLimitOverride: document.getElementById('ms-settings-daily-limit').value || null,
          requireVerifiedFrom: document.getElementById('ms-settings-verified').checked,
        }),
      });
      toast('Settings saved.');
    });

    document.getElementById('ms-role-save').addEventListener('click', async () => {
      await fetchJson(`${API_BASE}/settings/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: document.getElementById('ms-role-user').value,
          role: document.getElementById('ms-role-role').value,
        }),
      });
      toast('Role assignment saved.');
      renderSettings();
    });
  } catch (error) {
    console.error('[marketing-suite] settings load failed', error);
    showErrorState(main, "Couldn't load settings", error, renderSettings);
  }
}

async function openTemplateCreator() {
  const modal = renderModal(
    'Create template',
    renderFormRow('Name', '<input id="ms-template-name" />') +
      renderFormRow('Subject', '<input id="ms-template-subject" />') +
      renderFormRow('Preview text', '<input id="ms-template-preview-text" />') +
      renderFormRow('From name', '<input id="ms-template-from-name" />') +
      renderFormRow('From email', '<input id="ms-template-from-email" />') +
      renderFormRow('Reply-to', '<input id="ms-template-reply-to" />') +
      `<div class="ms-toolbar" style="justify-content:flex-end;"><button class="ms-primary" id="ms-template-create">Create</button></div>`
  );

  modal.querySelector('#ms-template-create').addEventListener('click', async () => {
    const response = await fetchJson(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modal.querySelector('#ms-template-name').value,
        subject: modal.querySelector('#ms-template-subject').value,
        previewText: modal.querySelector('#ms-template-preview-text').value,
        fromName: modal.querySelector('#ms-template-from-name').value,
        fromEmail: modal.querySelector('#ms-template-from-email').value,
        replyTo: modal.querySelector('#ms-template-reply-to').value,
        editorType: 'MJML',
        mjmlBody: '<mjml><mj-body></mj-body></mjml>',
      }),
    });
    closeModal();
    navigateTo(`/admin/marketing/templates/${response.template.id}/edit`);
  });
}

async function openSegmentCreator() {
  const rules = [];
  const modal = renderModal(
    'Create segment',
    renderFormRow('Name', '<input id="ms-segment-name" />') +
      renderFormRow('Description', '<textarea id="ms-segment-description"></textarea>') +
      renderFormRow(
        'Match rules',
        `<select id="ms-segment-operator">
          <option value="AND">All rules (AND)</option>
          <option value="OR">Any rule (OR)</option>
        </select>`
      ) +
      `<div id="ms-segment-rules"></div>
      <button class="ms-secondary" id="ms-segment-add-rule">Add rule</button>
      <div class="ms-toolbar" style="justify-content:flex-end;"><button class="ms-primary" id="ms-segment-create">Create</button></div>`
  );

  function renderRuleRow(rule, index) {
    return `
      <div class="ms-card" data-rule-index="${index}" style="margin-top:12px;">
        ${renderFormRow(
          'Rule type',
          `<select data-rule-type>
            <option value="HAS_TAG">Tag contains</option>
            <option value="PURCHASED_TOWN_IS">Town/City equals</option>
            <option value="PURCHASED_COUNTY_IS">County equals</option>
            <option value="LAST_PURCHASE_OLDER_THAN">Last purchase older than (days)</option>
            <option value="VIEWED_NO_PURCHASE_AFTER">Viewed show but not purchased (days)</option>
            <option value="PURCHASED_CATEGORY_CONTAINS">Bought category</option>
          </select>`
        )}
        ${renderFormRow('Value', '<input data-rule-value />')}
      </div>
    `;
  }

  function updateRules() {
    modal.querySelectorAll('[data-rule-index]').forEach((row) => {
      const index = Number(row.getAttribute('data-rule-index'));
      const type = row.querySelector('[data-rule-type]').value;
      const value = row.querySelector('[data-rule-value]').value;
      rules[index] = type.includes('DAYS') || type.includes('OLDER_THAN') ? { type, days: Number(value || 0) } : { type, value };
    });
  }

  modal.querySelector('#ms-segment-add-rule').addEventListener('click', () => {
    const index = rules.length;
    rules.push({ type: 'HAS_TAG', value: '' });
    modal.querySelector('#ms-segment-rules').insertAdjacentHTML('beforeend', renderRuleRow(rules[index], index));
  });

  modal.querySelector('#ms-segment-create').addEventListener('click', async () => {
    updateRules();
    await fetchJson(`${API_BASE}/segments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modal.querySelector('#ms-segment-name').value,
        description: modal.querySelector('#ms-segment-description').value,
        rules: { rules, operator: modal.querySelector('#ms-segment-operator').value },
      }),
    });
    closeModal();
    renderSegments();
  });
}

async function openAutomationCreator() {
  const modal = renderModal(
    'Create automation',
    renderFormRow('Name', '<input id="ms-automation-name" />') +
      renderFormRow(
        'Trigger type',
        `<select id="ms-automation-trigger">
          <option value="TAG_APPLIED">Tag applied</option>
          <option value="DAYS_BEFORE_SHOW">Days before show</option>
          <option value="DAYS_AFTER_SHOW">Days after show</option>
          <option value="MONTHLY_ROUNDUP">Monthly roundup</option>
        </select>`
      ) +
      `<div class="ms-toolbar" style="justify-content:flex-end;"><button class="ms-primary" id="ms-automation-create">Create</button></div>`
  );

  modal.querySelector('#ms-automation-create').addEventListener('click', async () => {
    const response = await fetchJson(`${API_BASE}/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modal.querySelector('#ms-automation-name').value,
        triggerType: modal.querySelector('#ms-automation-trigger').value,
      }),
    });
    closeModal();
    navigateTo(`/admin/marketing/automations/${response.automation.id}`);
  });
}

async function openCampaignWizard(preselectedSegmentId) {
  const params = new URLSearchParams();
  if (preselectedSegmentId) params.set('segment', preselectedSegmentId);
  const query = params.toString();
  navigateTo(`/admin/marketing/campaigns/new${query ? `?${query}` : ''}`);
}

function openContactImporter() {
  const modal = renderModal(
    'Import contacts',
    `<input type="file" id="ms-import-file" accept=".csv" />
    <div class="ms-toolbar" style="justify-content:flex-end;margin-top:12px;">
      <button class="ms-primary" id="ms-import-run">Import</button>
    </div>`
  );
  modal.querySelector('#ms-import-run').addEventListener('click', async () => {
    const fileInput = modal.querySelector('#ms-import-file');
    if (!fileInput.files.length) return;
    const text = await fileInput.files[0].text();
    await fetchJson(`${API_BASE}/contacts/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text, filename: fileInput.files[0].name }),
    });
    closeModal();
    toast('Import started.');
    renderContacts();
  });
}

async function renderRoute() {
  const path = window.location.pathname.replace(/\/$/, '') || '/admin/marketing';
  const highlight =
    path.startsWith('/admin/marketing/campaigns')
      ? '/admin/marketing/campaigns'
      : path.startsWith('/admin/marketing/templates/')
        ? '/admin/marketing/templates'
        : path.startsWith('/admin/marketing/automations/')
          ? '/admin/marketing/automations'
          : path.startsWith('/admin/marketing/segments/')
            ? '/admin/marketing/segments'
            : path.startsWith('/admin/marketing/contacts/')
              ? '/admin/marketing/contacts'
          : path;
  renderShell(highlight);
  loadStatus();

  try {
    switch (path) {
      case '/admin/marketing':
        return renderHome();
      case '/admin/marketing/campaigns':
        return renderCampaigns();
      case '/admin/marketing/campaigns/new':
        return renderCampaignCreate();
      case '/admin/marketing/intelligent':
        return renderIntelligentCampaigns();
      case '/admin/marketing/automations':
        return renderAutomations();
      case '/admin/marketing/contacts':
        return renderContacts();
      case '/admin/marketing/segments':
        return renderSegments();
      case '/admin/marketing/templates':
        return renderTemplates();
      case '/admin/marketing/analytics':
        return renderAnalytics();
      case '/admin/marketing/deliverability':
        return renderDeliverability();
      case '/admin/marketing/settings':
        return renderSettings();
      default:
        break;
    }

    const campaignMatch = path.match(/\/admin\/marketing\/campaigns\/([^/]+)/);
    if (campaignMatch) return renderCampaignDetail(campaignMatch[1]);

    const templateMatch = path.match(/\/admin\/marketing\/templates\/([^/]+)\/edit/);
    if (templateMatch) return renderTemplateEditor(templateMatch[1]);

    const segmentMatch = path.match(/\/admin\/marketing\/segments\/([^/]+)/);
    if (segmentMatch) return renderSegmentDetail(segmentMatch[1]);

    const contactMatch = path.match(/\/admin\/marketing\/contacts\/([^/]+)/);
    if (contactMatch) return renderContactDetail(contactMatch[1]);

    const automationMatch = path.match(/\/admin\/marketing\/automations\/([^/]+)/);
    if (automationMatch) return renderAutomationDetail(automationMatch[1]);

    return renderHome();
  } catch (error) {
    console.error('[marketing-suite] render failed', error);
    const main = document.getElementById('ms-main');
    if (main) {
      showErrorState(main, "Couldn't load page", error, renderRoute);
    }
  }
}

window.addEventListener('popstate', () => {
  renderRoute();
});

document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;
  const target = event.target.closest('a');
  if (!target) return;
  if (target.target && target.target !== '_self') return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  const href = target.getAttribute('href');
  if (!href) return;
  if (!href.startsWith('/admin/marketing')) return;
  event.preventDefault();
  navigateTo(href);
});

window.addEventListener('error', (event) => {
  const location = event.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : '';
  const message = `${event.message || 'Unexpected error'}${location ? ` (${location})` : ''}`;
  showGlobalErrorBanner(message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || String(reason || 'Unhandled promise rejection');
  showGlobalErrorBanner(message);
});

renderRoute();

/* GLOBAL BUILDER HELPERS */
function generateBlockId() {
    return `blk_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function findBlockById(id, blocks = window.editorBlocks) {
    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        if (block.id === id) return { block, index, parent: blocks };
        if (block.type === 'strip' && block.content?.blocks) {
            const result = findBlockById(id, block.content.blocks);
            if (result) return result;
        }
    }
    return null;
}

function assignNewIds(block) {
    block.id = generateBlockId();
    if (block.type === 'strip' && block.content?.blocks) {
        block.content.blocks.forEach(assignNewIds);
    }
}

window.duplicateBlock = function(index) {
    const original = window.editorBlocks[index];
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    assignNewIds(copy);
    window.editorBlocks.splice(index + 1, 0, copy);
    recordEditorHistory();
    renderBuilderCanvas();
    toast('Block duplicated');
};

window.duplicateBlockById = function(id) {
    const result = findBlockById(id);
    if (!result) return;
    const copy = JSON.parse(JSON.stringify(result.block));
    assignNewIds(copy);
    result.parent.splice(result.index + 1, 0, copy);
    recordEditorHistory();
    renderBuilderCanvas();
    toast('Block duplicated');
};

window.openEditorFromIcon = function(id) {
    const result = findBlockById(id);
    if (result?.block) openBlockEditor(result.block);
};


/* =========================================
   VISUAL BUILDER LOGIC (v3 - Footer & Placeholders)
   ========================================= */

window.editorBlocks = [];
// Separate state for the mandatory footer
window.emailFooterState = {
    text: '<p style="font-size:12px; color:#6b7280; text-align:center;">© 2026 TixAll. All rights reserved.<br>You are receiving this email because you opted in via our website.<br><a href="{{links.unsubscribeLink}}" style="color:#4f46e5; text-decoration:underline;">Unsubscribe</a> | <a href="{{links.managePreferencesLink}}" style="color:#4f46e5; text-decoration:underline;">Manage Preferences</a></p>',
    bgColor: '#f8fafc'
};

const EDITOR_HISTORY_LIMIT = 60;
const editorHistory = {
    past: [],
    future: [],
    restoring: false,
};
let historyDebounce = null;

let draggedSource = null;
let draggedBlockIndex = null;
let savedRteSelection = null;
let rteCleanupHandler = null;
let rteSelectionActive = false;

const FONT_FAMILY_MAP = {
    Arial: 'Arial, Helvetica, sans-serif',
    Helvetica: 'Helvetica, Arial, sans-serif',
    Georgia: 'Georgia, "Times New Roman", serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Courier New': '"Courier New", Courier, monospace',
    Inter: '"Inter", "Helvetica Neue", Arial, sans-serif',
    'DM Sans': '"DM Sans", "Helvetica Neue", Arial, sans-serif',
    Manrope: '"Manrope", "Helvetica Neue", Arial, sans-serif',
    Rubik: '"Rubik", "Helvetica Neue", Arial, sans-serif',
    Quicksand: '"Quicksand", "Helvetica Neue", Arial, sans-serif',
    Karla: '"Karla", "Helvetica Neue", Arial, sans-serif',
    'Libre Franklin': '"Libre Franklin", "Helvetica Neue", Arial, sans-serif',
    'Libre Baskerville': '"Libre Baskerville", Georgia, serif',
    Lora: '"Lora", Georgia, serif',
    'Space Grotesk': '"Space Grotesk", "Helvetica Neue", Arial, sans-serif',
    Roboto: '"Roboto", "Helvetica Neue", Arial, sans-serif',
    'Open Sans': '"Open Sans", "Helvetica Neue", Arial, sans-serif',
    Lato: '"Lato", "Helvetica Neue", Arial, sans-serif',
    Montserrat: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
    Poppins: '"Poppins", "Helvetica Neue", Arial, sans-serif',
    Raleway: '"Raleway", "Helvetica Neue", Arial, sans-serif',
    'Playfair Display': '"Playfair Display", Georgia, serif',
    Merriweather: '"Merriweather", Georgia, serif',
    'Source Sans 3': '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    Nunito: '"Nunito", "Helvetica Neue", Arial, sans-serif',
    Ubuntu: '"Ubuntu", "Helvetica Neue", Arial, sans-serif',
    Oswald: '"Oswald", "Helvetica Neue", Arial, sans-serif',
    'PT Sans': '"PT Sans", "Helvetica Neue", Arial, sans-serif',
    'Work Sans': '"Work Sans", "Helvetica Neue", Arial, sans-serif',
    'Fira Sans': '"Fira Sans", "Helvetica Neue", Arial, sans-serif',
};

const TEXT_STYLE_PRESETS = [
    { value: 'paragraph-1', label: 'Paragraph 1', tag: 'p', fontSize: '16px', fontWeight: '400', lineHeight: '1.6' },
    { value: 'paragraph-2', label: 'Paragraph 2', tag: 'p', fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
    { value: 'heading-1', label: 'Heading 1', tag: 'h1', fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
    { value: 'heading-2', label: 'Heading 2', tag: 'h2', fontSize: '24px', fontWeight: '700', lineHeight: '1.25' },
    { value: 'heading-3', label: 'Heading 3', tag: 'h3', fontSize: '20px', fontWeight: '600', lineHeight: '1.3' },
    { value: 'heading-4', label: 'Heading 4', tag: 'h4', fontSize: '18px', fontWeight: '600', lineHeight: '1.3' },
];

function renderFontFamilyOptions(selectedValue) {
    return Object.keys(FONT_FAMILY_MAP)
        .map((font) => `<option value="${font}" ${font === selectedValue ? 'selected' : ''}>${font}</option>`)
        .join('');
}

// Helper to generate SVG data URI for placeholders
function getPlaceholderImage(width, height) {
    const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#e2e8f0"/>
        <g fill="none" stroke="#94a3b8" stroke-width="2">
            <rect x="${width/2 - 24}" y="${height/2 - 18}" width="48" height="36" rx="4"/>
            <circle cx="${width/2}" cy="${height/2}" r="8"/>
            <polyline points="${width/2 - 24 + 10} ${height/2 - 18 + 8} ${width/2 - 24 + 4} ${height/2 - 18 + 4} ${width/2 + 24 - 4} ${height/2 - 18 + 4} ${width/2 + 24 - 10} ${height/2 - 18 + 8}"/>
        </g>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
/**
 * Initializes listeners for the Visual Builder
 */
function setupVisualBuilder() {
  const canvas = document.getElementById('ms-builder-canvas');
  if (!canvas) return;
  const sidebarPanels = Array.from(document.querySelectorAll('.ms-sidebar-panel'));

  const showSidebarPanel = (panelId) => {
    sidebarPanels.forEach((panel) => {
      const isTarget = panel.id === panelId;
      panel.classList.toggle('active', isTarget);
      panel.classList.toggle('hidden', panel.id === 'ms-block-editor' && !isTarget);
      panel.style.display = isTarget ? 'block' : 'none';
    });
  };

  const resetSidebarPanels = () => {
    sidebarPanels.forEach((panel) => {
      panel.classList.remove('active');
      panel.classList.remove('hidden');
      panel.style.display = '';
    });
  };

  const syncSidebarForContent = () => {
    const activeBlock =
      window.activeBlockId && findBlockById(window.editorBlocks || [], window.activeBlockId)?.block;
    if (activeBlock) {
      openBlockEditor(activeBlock);
    } else {
      showSidebarPanel('ms-sidebar-blocks');
    }
  };

  // Background Color Logic
  const bgInput = document.getElementById('ms-style-bg');
  if (bgInput) {
    bgInput.addEventListener('input', (e) => {
      canvas.style.setProperty('--canvas-bg', e.target.value);
      window.currentTemplateStyles = window.currentTemplateStyles || {};
      window.currentTemplateStyles.canvasBg = e.target.value;
    });
  }

  // 1. Initialize State
  window.editorBlocks = window.editorBlocks.length ? window.editorBlocks : [];
  renderBuilderCanvas();
  initializeEditorHistory();

  const undoBtn = document.getElementById('ms-editor-undo');
  const redoBtn = document.getElementById('ms-editor-redo');
  if (undoBtn) {
      undoBtn.addEventListener('click', () => {
          undoEditorChange();
      });
  }
  if (redoBtn) {
      redoBtn.addEventListener('click', () => {
          redoEditorChange();
      });
  }

  canvas.addEventListener('click', (event) => {
      const anchor = event.target.closest('a');
      if (anchor && canvas.contains(anchor)) {
          event.preventDefault();
      }
  });

    // 2. Sidebar Tab Switching
    const tabBtns = document.querySelectorAll('.ms-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.ms-tab-btn').forEach(b => b.classList.remove('active'));
            resetSidebarPanels();
            e.target.classList.add('active');
            const targetId = `ms-sidebar-${e.target.dataset.sidebarTab}`;
            if (targetId === 'ms-sidebar-blocks') {
                syncSidebarForContent();
            } else {
                showSidebarPanel(targetId);
            }
        });
    });

    const directionSelect = document.getElementById('ms-gradient-direction');
    const gradientPresets = document.getElementById('ms-gradient-presets');
    if (gradientPresets) {
        gradientPresets.innerHTML = GRADIENT_PRESETS.map((preset, index) => {
            const gradient = getGradientCss(preset.direction, preset.start, preset.end);
            return `
                <button class="ms-gradient-swatch" type="button" data-gradient-index="${index}" style="background:${gradient}">
                    <span>${preset.name}</span>
                </button>
            `;
        }).join('');
        gradientPresets.querySelectorAll('[data-gradient-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number.parseInt(button.dataset.gradientIndex, 10);
                const preset = GRADIENT_PRESETS[index];
                if (!preset) return;
                window.currentGradientStart = preset.start;
                window.currentGradientEnd = preset.end;
                window.currentGradientDirection = preset.direction;
                const gradient = getGradientCss(preset.direction, preset.start, preset.end);
                window.updateCanvasGradient(gradient, {
                    start: preset.start,
                    end: preset.end,
                    direction: preset.direction,
                });
                const startInput = document.getElementById('input-gradient-start');
                const endInput = document.getElementById('input-gradient-end');
                const startPreview = document.getElementById('preview-gradient-start');
                const endPreview = document.getElementById('preview-gradient-end');
                if (startInput) startInput.value = preset.start;
                if (endInput) endInput.value = preset.end;
                if (startPreview) startPreview.style.backgroundColor = preset.start;
                if (endPreview) endPreview.style.backgroundColor = preset.end;
                if (directionSelect) directionSelect.value = preset.direction;
            });
        });
    }

    if (directionSelect) {
        directionSelect.addEventListener('change', (event) => {
            window.currentGradientDirection = event.target.value;
            const gradient = getGradientCss(
                window.currentGradientDirection,
                window.currentGradientStart || '#111827',
                window.currentGradientEnd || '#f9fafb'
            );
            window.updateCanvasGradient(gradient, {
                start: window.currentGradientStart || '#111827',
                end: window.currentGradientEnd || '#f9fafb',
                direction: window.currentGradientDirection,
            });
        });
    }

    const startInput = document.getElementById('input-gradient-start');
    const endInput = document.getElementById('input-gradient-end');
    window.currentGradientStart = startInput?.value || '#111827';
    window.currentGradientEnd = endInput?.value || '#f9fafb';
    window.currentGradientDirection = directionSelect?.value || 'to bottom';

 // 3. Drag Start (Sidebar Items)
    document.querySelectorAll('.ms-draggable-block').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedSource = 'sidebar';
            e.dataTransfer.setData('blockType', item.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
  
  // 4. Drag Over (Updated for ms-strip-inner support)
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();

    // Find if we are hovering over a strip's inner container or the main canvas
    const stripContainer = e.target.closest('.ms-strip');
    const stripInner = e.target.closest('.ms-strip-inner') || (stripContainer ? stripContainer.querySelector('.ms-strip-inner') : null);
    const container = stripInner || canvas;

    const afterElement = getDragAfterElement(container, e.clientY);
    let indicator = document.querySelector('.ms-drop-indicator') || document.createElement('div');
    indicator.className = 'ms-drop-indicator';

    if (afterElement == null) {
        container.appendChild(indicator);
    } else {
        container.insertBefore(indicator, afterElement);
    }
});
  
    // 5. Drag Leave Cleanup
    canvas.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && !canvas.contains(e.relatedTarget) && e.relatedTarget !== canvas) {
            const indicator = document.querySelector('.ms-drop-indicator');
            if (indicator) indicator.remove();
        }
    });

   // 6. Drop Logic (Supports reordering inside and outside strips)
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const indicator = document.querySelector('.ms-drop-indicator');
    if (!indicator) return;

    const dropContainer = indicator.parentElement;
    const siblings = Array.from(dropContainer.children);
    const dropIndex = siblings.indexOf(indicator);
    indicator.remove();

    const type = e.dataTransfer.getData('blockType');
    const isFromSidebar = draggedSource === 'sidebar';

    function findAndRemoveBlock(id, blocks = window.editorBlocks) {
        const topIdx = blocks.findIndex(b => b.id === id);
        if (topIdx > -1) return blocks.splice(topIdx, 1)[0];
        for (let b of blocks) {
            if (b.type === 'strip' && b.content.blocks) {
                const removed = findAndRemoveBlock(id, b.content.blocks);
                if (removed) return removed;
            }
        }
        return null;
    }

    let blockData;
    if (isFromSidebar) {
        blockData = {
            id: generateBlockId(),
            type: type,
            content: getDefaultBlockContent(type),
            styles: { padding: '10px', margin: '0px' }
        };
    } else {
        const draggedBlockId = e.dataTransfer.getData('blockId');
        blockData = findAndRemoveBlock(draggedBlockId);
    }

    if (!blockData) return;

    // Logic for nesting
    if (dropContainer.classList.contains('ms-strip-inner')) {
        const stripId = dropContainer.closest('.ms-builder-block')?.dataset.id;
        const stripResult = stripId ? findBlockById(stripId) : null;
        if (stripResult?.block) {
            stripResult.block.content.blocks = stripResult.block.content.blocks || [];
            stripResult.block.content.blocks.splice(dropIndex, 0, blockData);
        }
    } else {
        window.editorBlocks.splice(dropIndex, 0, blockData);
    }

    recordEditorHistory();
    renderBuilderCanvas();
    draggedSource = null;
});
  
    // 7. Back Button
    const backBtn = document.getElementById('ms-back-to-blocks');
    if (backBtn) {
       backBtn.addEventListener('click', () => {
    window.activeBlockId = null;
    showSidebarPanel('ms-sidebar-blocks');
    document.querySelectorAll('.ms-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-sidebar-tab="blocks"]').classList.add('active');
    
    // Clear selection on canvas
    document.querySelectorAll('.ms-builder-block').forEach(b => b.classList.remove('is-selected'));
});
    }

    canvas.addEventListener('click', (event) => {
        if (event.target.closest('.ms-builder-block')) return;
        document.querySelectorAll('.ms-builder-block').forEach(b => b.classList.remove('is-selected'));
        window.activeBlockId = null;
        const contentTab = document.querySelector('[data-sidebar-tab="blocks"]');
        if (contentTab?.classList.contains('active')) {
            showSidebarPanel('ms-sidebar-blocks');
        }
    });
}

/**
 * Helper: Detects which element is directly *after* the mouse cursor Y position
 */
function getDragAfterElement(container, y) {
    if (!container) return null;
    // Only consider direct children so we don't try to insert before nested blocks
    const draggableElements = Array.from(container.children).filter((child) => {
        return child.classList.contains('ms-builder-block') && !child.classList.contains('dragging');
    });

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Calculate distance from the middle of the box
        const offset = y - box.top - box.height / 2;
        
        // We want the element where the mouse is *above* the middle (negative offset)
        // and closest to 0
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Adds a new block to the state at a specific index
 */
function addBlockToCanvas(type, index) {
    const newBlock = {
        id: generateBlockId(),
        type: type,
        content: getDefaultBlockContent(type),
        styles: { padding: '10px', margin: '0px' }
    };

    // If index is invalid or -1 (end of list), push to end
    if (index === undefined || index === -1) {
        window.editorBlocks.push(newBlock);
    } else {
        // Insert at specific index
        window.editorBlocks.splice(index, 0, newBlock);
    }

    recordEditorHistory();
    renderBuilderCanvas();
    openBlockEditor(newBlock);
}

/**
 * Moves an existing block from oldIndex to newIndex
 */
function moveBlockInCanvas(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const blockToMove = window.editorBlocks[fromIndex];
    
    // Remove from old position
    window.editorBlocks.splice(fromIndex, 1);
    
    // Adjust index if we removed an item before the drop target
    // The "indicator" logic in the DOM gives us the visual index, 
    // but since we just removed an item from the array, we need to account for the shift.
    // However, since the DOM loop counted the indicator's position *among siblings*,
    // and the dragging element was hidden/ghosted but technically still there or removed...
    // The safest logic with the indicator approach is:
    
    // If we dropped "after" the item itself, the index decreases by 1
    let finalIndex = toIndex;
    if (fromIndex < toIndex) {
        finalIndex = toIndex - 1; 
    }
    
    window.editorBlocks.splice(finalIndex, 0, blockToMove);
    recordEditorHistory();
    renderBuilderCanvas();
}

/**
 * Returns default data for new blocks
 */
function getDefaultBlockContent(type) {
    const placeholderLarge = getPlaceholderImage(600, 300);
    const placeholderSmall = getPlaceholderImage(300, 200);
    
    switch (type) {
case 'strip': return { 
    bgColor: '#ffffff', 
    gradient: null,
    isTransparent: false,
    blocks: [], 
    fullWidth: false,   // Kept your existing setting
    padding: '20px',    // Kept your existing setting
    borderRadius: '0',  // Added new setting
    margin: '0'         // Added margin control
};
      case 'text': return { text: '<h3>New Text Block</h3><p>Enter your content here.</p>' };
        case 'boxedtext': return {
            text: '<p>This is text inside a colored box.</p>',
            bgColor: '#f1f5f9',
            gradient: null,
            isTransparent: false,
            fullWidth: false,
            padding: '20px',
            borderRadius: '6',
            margin: '0',
        };
        case 'image':
            return {
                src: placeholderLarge,
                alt: 'Image',
                link: '',
                showId: '',
                showImageUrl: '',
                linkShowId: '',
            };
        case 'imagegroup': {
            const baseImage = () => ({
                src: placeholderSmall,
                alt: '',
                link: '',
                showId: '',
                showImageUrl: '',
                linkShowId: '',
                text: '',
            });
            return {
                images: [baseImage(), baseImage()],
                textStyle: {
                    fontFamily: 'Inter',
                    fontSize: 14,
                    fontWeight: 400,
                    textAlign: 'left',
                    color: '#0f172a',
                },
            };
        }
        case 'imagecard': return { src: placeholderLarge, caption: '<p style="margin-top:10px;">Image caption goes here.</p>' };
        case 'button': return {
            label: 'Click Here',
            url: 'https://',
            color: '#4f46e5',
            textColor: '#ffffff',
            align: 'center',
            fontFamily: 'Inter',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 6,
            width: '',
            height: '',
            linkShowId: '',
        };
        case 'divider': return {
            color: '#e2e8f0',
            thickness: 1,
            lineStyle: 'solid',
            paddingTop: 18,
            paddingBottom: 18,
        };
        case 'space': return {
            height: 24,
        };
        case 'social': return { items: buildDefaultSocialItems() };
        case 'video': return { url: '', thumbnail: placeholderLarge, showId: '', showVideoKey: '' };
        case 'code': return { html: '' };
        case 'product': return { productId: null, title: 'Product Name', price: '£0.00' };
        case 'event':
            return {
                selectionMode: 'shows',
                showIds: [],
                town: '',
                county: '',
                layout: 'grid',
                cardBackground: '#ffffff',
                cardBorder: '#e2e8f0',
                titleColor: '#0f172a',
                metaColor: '#64748b',
                priceColor: '#0f172a',
                fontFamily: 'Inter',
            };
        default: return {};
    }
}

function getShowLink(show) {
    if (!show) return '';
    const storefrontSlug = show.organiser?.storefrontSlug || '';
    const slug = show.slug || '';
    if (storefrontSlug && slug) {
        return `/public/${storefrontSlug}/${slug}`;
    }
    if (show.id) {
        return `/public/event/${show.id}`;
    }
    return '';
}

function getShowTown(show) {
    return show?.town || show?.city || show?.location?.town || '';
}

function getShowCounty(show) {
    return show?.county || show?.region || show?.location?.county || '';
}

function getShowVenue(show) {
    return show?.venue || show?.venueName || show?.location?.venue || show?.locationName || '';
}

function getShowPrimaryImage(show) {
    const images = collectShowImages(show);
    if (images.length) return images[0].url;
    return getPlaceholderImage(600, 360);
}

function formatShowDateTime(show) {
    const dateValue = show?.date || show?.startDate || show?.startsAt || show?.startTime || show?.eventDate;
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    const dateText = date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const timeText = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
    return `${dateText} • ${timeText}`;
}

function getEventBlockShows(block) {
    const content = block?.content || {};
    const shows = Array.isArray(appState.shows) ? appState.shows : [];
    const normalizedTown = String(content.town || '').trim().toLowerCase();
    const normalizedCounty = String(content.county || '').trim().toLowerCase();
    let filtered = shows;
    if (content.selectionMode === 'shows') {
        const selected = new Set(content.showIds || []);
        filtered = shows.filter((show) => selected.has(show.id));
    } else if (content.selectionMode === 'town' && normalizedTown) {
        filtered = shows.filter((show) => String(getShowTown(show) || '').trim().toLowerCase() === normalizedTown);
    } else if (content.selectionMode === 'county' && normalizedCounty) {
        filtered = shows.filter((show) => String(getShowCounty(show) || '').trim().toLowerCase() === normalizedCounty);
    }
    return filtered.slice().sort((a, b) => {
        const aDate = new Date(a?.date || a?.startDate || a?.startsAt || 0).getTime();
        const bDate = new Date(b?.date || b?.startDate || b?.startsAt || 0).getTime();
        if (Number.isNaN(aDate) || Number.isNaN(bDate)) return 0;
        return aDate - bDate;
    });
}

function collectShowImages(show) {
    if (!show) return [];
    const images = [];
    const seen = new Set();
    const addImage = (url, label) => {
        const clean = String(url || '').trim();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        images.push({ url: clean, label });
    };
    const primaryImage =
        show.imageUrl ||
        show.image?.url ||
        show.image?.src ||
        show.image?.imageUrl ||
        show.image ||
        show.heroImageUrl ||
        show.mainImageUrl;
    addImage(primaryImage, 'Main image');
    const additionalImages = Array.isArray(show.additionalImages)
        ? show.additionalImages
        : Array.isArray(show.additionalImageUrls)
            ? show.additionalImageUrls
            : [];
    additionalImages.forEach((entry, index) => {
        if (typeof entry === 'string') {
            addImage(entry, `Supporting image ${index + 1}`);
        } else if (entry && typeof entry === 'object') {
            addImage(entry.url || entry.src || entry.imageUrl, `Supporting image ${index + 1}`);
        }
    });
    const galleryImages = Array.isArray(show.galleryImages) ? show.galleryImages : [];
    galleryImages.forEach((entry, index) => {
        if (typeof entry === 'string') {
            addImage(entry, `Gallery image ${index + 1}`);
        } else if (entry && typeof entry === 'object') {
            addImage(entry.url || entry.src || entry.imageUrl, `Gallery image ${index + 1}`);
        }
    });
    const nestedImages = Array.isArray(show.images) ? show.images : [];
    nestedImages.forEach((entry, index) => {
        if (typeof entry === 'string') {
            addImage(entry, `Supporting image ${index + 1}`);
        } else if (entry && typeof entry === 'object') {
            addImage(entry.url || entry.src || entry.imageUrl, `Supporting image ${index + 1}`);
        }
    });
    return images;
}

function normalizeVideoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const candidate = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        return parsed.toString();
    } catch (error) {
        return '';
    }
}

function getVideoEmbedInfo(rawUrl) {
    const url = normalizeVideoUrl(rawUrl);
    if (!url) return null;
    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        return null;
    }
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;
    if (hostname === 'youtu.be') {
        const id = path.split('/').filter(Boolean)[0];
        if (id) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (hostname.endsWith('youtube.com')) {
        const id = parsed.searchParams.get('v') || path.split('/').filter(Boolean).pop();
        if (id) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (hostname.endsWith('vimeo.com')) {
        const id = path.split('/').filter(Boolean).pop();
        if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(path)) {
        return { type: 'video', src: url };
    }
    return { type: 'iframe', src: url };
}

function renderVideoEmbedMarkup(rawUrl, title = 'Video preview') {
    const info = getVideoEmbedInfo(rawUrl);
    if (!info) {
        return '<div class="ms-video-placeholder">Add a video link to preview.</div>';
    }
    if (info.type === 'video') {
        return `
            <div class="ms-video-embed">
                <video controls src="${escapeHtml(info.src)}" aria-label="${escapeHtml(title)}"></video>
            </div>
        `;
    }
    return `
        <div class="ms-video-embed">
            <iframe
                src="${escapeHtml(info.src)}"
                title="${escapeHtml(title)}"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    `;
}

function getShowVideoOptions(show) {
    if (!show) return [];
    const options = [];
    const videoOne = normalizeVideoUrl(show.videoUrlOne);
    const videoTwo = normalizeVideoUrl(show.videoUrlTwo);
    if (videoOne) options.push({ key: 'videoUrlOne', label: 'Video one', url: videoOne });
    if (videoTwo) options.push({ key: 'videoUrlTwo', label: 'Video two', url: videoTwo });
    return options;
}

function resolveShowVideoUrl(show, key) {
    const options = getShowVideoOptions(show);
    if (!options.length) return '';
    const selected = options.find((option) => option.key === key) || options[0];
    return selected ? selected.url : '';
}

function ensureShowImages(showId) {
    if (!showId) return Promise.resolve(null);
    const existing = appState.shows.find((show) => show.id === showId);
    if (existing && existing._imagesLoaded) {
        return Promise.resolve(existing);
    }
    return fetchJson(`/admin/shows/${showId}`)
        .then((data) => {
            const item = data?.item || data;
            if (!item) return existing || null;
            const merged = existing ? Object.assign(existing, item) : { ...item };
            merged._imagesLoaded = true;
            if (!existing) appState.shows.push(merged);
            return merged;
        })
        .catch((error) => {
            console.warn('[marketing-suite] show image fetch failed', error);
            if (existing) existing._imagesLoaded = true;
            return existing || null;
        });
}

function renderShowImageGrid(show, selectedUrl) {
    const images = collectShowImages(show);
    if (!images.length) {
        return '<div class="ms-muted">No show images available yet.</div>';
    }
    const safeSelected = selectedUrl || '';
    return `
        <div class="ms-image-grid">
            ${images
                .map((image) => {
                    const selected = image.url === safeSelected ? 'is-selected' : '';
                    return `
                        <button type="button" class="ms-image-tile ${selected}" data-image-url="${escapeHtml(image.url)}">
                            <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.label)}" />
                            <span>${escapeHtml(image.label)}</span>
                        </button>
                    `;
                })
                .join('')}
        </div>
    `;
}

function readImageFile(file, callback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.readAsDataURL(file);
}

function getImageGroupDefaultTextStyle(style = {}) {
    return {
        fontFamily: style.fontFamily || 'Inter',
        fontSize: Number.isFinite(Number.parseInt(style.fontSize, 10)) ? Number.parseInt(style.fontSize, 10) : 14,
        fontWeight: Number.isFinite(Number.parseInt(style.fontWeight, 10)) ? Number.parseInt(style.fontWeight, 10) : 400,
        textAlign: style.textAlign || 'left',
        color: style.color || '#0f172a',
    };
}

function createImageGroupImage() {
    return {
        src: getPlaceholderImage(300, 200),
        alt: '',
        link: '',
        showId: '',
        showImageUrl: '',
        linkShowId: '',
        text: '',
    };
}

function normalizeImageGroupImage(image = {}) {
    return {
        src: image.src || getPlaceholderImage(300, 200),
        alt: image.alt || '',
        link: image.link || '',
        showId: image.showId || '',
        showImageUrl: image.showImageUrl || '',
        linkShowId: image.linkShowId || '',
        text: image.text || '',
    };
}

function ensureImageGroupContent(block) {
    if (!block.content) block.content = {};
    const images = Array.isArray(block.content.images) ? block.content.images : [];
    block.content.images = images.map((image) => {
        const normalized = normalizeImageGroupImage(image);
        if (image && typeof image === 'object') {
            Object.assign(image, normalized);
            return image;
        }
        return normalized;
    });
    if (!block.content.images.length) {
        block.content.images = [createImageGroupImage(), createImageGroupImage()];
    }
    block.content.textStyle = getImageGroupDefaultTextStyle(block.content.textStyle || {});
}

function buildImageGroupTextStyle(style) {
    const resolved = getImageGroupDefaultTextStyle(style || {});
    const fontFamily = FONT_FAMILY_MAP[resolved.fontFamily] || resolved.fontFamily || '"Inter", "Helvetica Neue", Arial, sans-serif';
    return `font-family:${fontFamily}; font-size:${resolved.fontSize}px; font-weight:${resolved.fontWeight}; text-align:${resolved.textAlign}; color:${resolved.color};`;
}

function applyImageGroupTextStyleToEditors(container, style) {
    if (!container) return;
    const resolved = getImageGroupDefaultTextStyle(style || {});
    const fontFamily = FONT_FAMILY_MAP[resolved.fontFamily] || resolved.fontFamily || '"Inter", "Helvetica Neue", Arial, sans-serif';
    container.querySelectorAll('[data-image-text-editor-input]').forEach((editor) => {
        editor.style.fontFamily = fontFamily;
        editor.style.fontSize = `${resolved.fontSize}px`;
        editor.style.fontWeight = resolved.fontWeight;
        editor.style.textAlign = resolved.textAlign;
        editor.style.color = resolved.color;
    });
}

/**
 * REFACTORED: Renders blocks and their children recursively
 */
function renderBuilderCanvas() {
    const canvas = document.getElementById('ms-builder-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    // 1. Render Draggable Blocks
    window.editorBlocks.forEach((block, index) => {
        const blockEl = createBlockElement(block, index, window.editorBlocks);
        canvas.appendChild(blockEl);
    });

    // 2. Render Static Footer
    renderStaticFooter(canvas);
}

function serializeEditorState() {
    return {
        blocks: JSON.parse(JSON.stringify(window.editorBlocks || [])),
        footer: JSON.parse(JSON.stringify(window.emailFooterState || {})),
        styles: JSON.parse(JSON.stringify(window.currentTemplateStyles || {})),
    };
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('ms-editor-undo');
    const redoBtn = document.getElementById('ms-editor-redo');
    if (undoBtn) undoBtn.disabled = editorHistory.past.length < 2;
    if (redoBtn) redoBtn.disabled = editorHistory.future.length === 0;
}

function initializeEditorHistory() {
    if (editorHistory.past.length) return;
    const state = serializeEditorState();
    editorHistory.past = [{ state, serialized: JSON.stringify(state) }];
    editorHistory.future = [];
    updateUndoRedoButtons();
}

function recordEditorHistory({ immediate = true } = {}) {
    initializeEditorHistory();
    if (editorHistory.restoring) return;
    const record = () => {
        const state = serializeEditorState();
        const serialized = JSON.stringify(state);
        const last = editorHistory.past[editorHistory.past.length - 1];
        if (last && last.serialized === serialized) return;
        editorHistory.past.push({ state, serialized });
        if (editorHistory.past.length > EDITOR_HISTORY_LIMIT) {
            editorHistory.past.shift();
        }
        editorHistory.future = [];
        updateUndoRedoButtons();
    };

    if (immediate) {
        record();
    } else {
        clearTimeout(historyDebounce);
        historyDebounce = setTimeout(record, 200);
    }
}

function resetEditorSelection() {
    window.activeBlockId = null;
    document.querySelectorAll('.ms-builder-block').forEach((block) => {
        block.classList.remove('is-selected');
    });
    const editorPanel = document.getElementById('ms-block-editor');
    const blocksPanel = document.getElementById('ms-sidebar-blocks');
    if (editorPanel && blocksPanel) {
        editorPanel.classList.add('hidden');
        editorPanel.classList.remove('active');
        editorPanel.style.display = 'none';
        blocksPanel.classList.add('active');
        blocksPanel.style.display = 'block';
    }
}

function applyEditorState(state) {
    editorHistory.restoring = true;
    window.editorBlocks = JSON.parse(JSON.stringify(state.blocks || []));
    window.emailFooterState = { ...window.emailFooterState, ...(state.footer || {}) };
    window.currentTemplateStyles = state.styles || window.currentTemplateStyles;
    renderBuilderCanvas();
    resetEditorSelection();
    editorHistory.restoring = false;
    updateUndoRedoButtons();
}

function undoEditorChange() {
    if (editorHistory.past.length < 2) return;
    const current = editorHistory.past.pop();
    editorHistory.future.push(current);
    const previous = editorHistory.past[editorHistory.past.length - 1];
    if (previous) applyEditorState(previous.state);
}

function redoEditorChange() {
    if (editorHistory.future.length === 0) return;
    const next = editorHistory.future.pop();
    editorHistory.past.push(next);
    applyEditorState(next.state);
}

/**
 * NEW HELPER: Creates a block element with all listeners attached.
 * This function calls itself if it finds a "strip" with children.
 */
/**
 * NEW HELPER: Creates a block element with all listeners attached.
 * This function calls itself if it finds a "strip" with children.
 */
function createBlockElement(block, index, parentArray) {
    const iconEdit = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const iconTrash = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    const iconDuplicate = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    const el = document.createElement('div');
    el.className = 'ms-builder-block';
    el.setAttribute('draggable', 'true');
    el.dataset.id = block.id;

    if (block.type === 'boxedtext') {
        el.classList.add('is-boxedtext');
        if (block.content.fullWidth) {
            el.classList.add('is-fullwidth');
        }
    }
    
    // --- STRIP SPECIAL HANDLING ---
    if (block.type === 'strip') {
        el.classList.add('is-strip');
        if (block.content.fullWidth) {
            el.classList.add('is-fullwidth');
        }
        const isTransparent = Boolean(block.content.isTransparent);
        const gradientData = block.content.gradient || null;
        // Get styles with defaults
        const padValue = Number.parseInt(block.content.padding, 10);
        const radiusValue = Number.parseInt(block.content.borderRadius, 10);
        const marginValue = Number.parseInt(block.content.margin, 10);
        const pad = Number.isFinite(padValue) ? padValue : 20;
        const radius = Number.isFinite(radiusValue) ? radiusValue : 0;
        const margin = Number.isFinite(marginValue) ? Math.max(marginValue, 0) : 0;
        const backgroundColor = isTransparent
            ? 'transparent'
            : (gradientData?.start || block.content.bgColor || '#ffffff');
        const backgroundImage = !isTransparent && gradientData?.css ? gradientData.css : 'none';
        
        el.innerHTML = `
        <div class="ms-strip-wrapper" style="padding: 0 ${margin}px;">
            <div class="ms-strip${isTransparent ? ' is-transparent' : ''}" style="background-color: ${backgroundColor}; background-image: ${backgroundImage}; padding: ${pad}px; border-radius: ${radius}px;">
                <div class="ms-strip-inner"></div>
            </div>
        </div>
        <div class="block-actions">
            <span title="Delete" onclick="window.deleteBlock('${block.id}')">${iconTrash}</span>
        </div>
        `;

        const innerContainer = el.querySelector('.ms-strip-inner');
        // Recursively render children into this strip
        if (block.content.blocks) {
            block.content.blocks.forEach((child, childIdx) => {
                innerContainer.appendChild(createBlockElement(child, childIdx, block.content.blocks));
            });
        }
    } else {
        // --- STANDARD BLOCK HANDLING ---
        el.innerHTML = `
            ${getPreviewHtml(block)}
            <div class="block-actions">
                <span title="Edit" onclick="window.openEditorFromIcon('${block.id}')">${iconEdit}</span>
                <span title="Duplicate" onclick="window.duplicateBlockById('${block.id}')">${iconDuplicate}</span>
                <span title="Delete" onclick="window.deleteBlock('${block.id}')">${iconTrash}</span>
            </div>
        `;
    }

    // CLICK: Select the block (stopPropagation prevents parent strips from being selected instead)
    el.addEventListener('click', (e) => {
        e.stopPropagation(); 
        document.querySelectorAll('.ms-builder-block').forEach(b => b.classList.remove('is-selected'));
        el.classList.add('is-selected');
        openBlockEditor(block);
    });

    // DRAG START: Set data for the drop listener
    el.addEventListener('dragstart', (e) => {
        e.stopPropagation(); 
        draggedSource = 'canvas';
        e.dataTransfer.setData('blockId', block.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => el.classList.add('dragging'), 0);
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        const ind = document.querySelector('.ms-drop-indicator');
        if(ind) ind.remove();
    });

    return el;
}
/**
 * Helper to render the footer
 */
function renderStaticFooter(canvas) {
    const iconEdit = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    const footerEl = document.createElement('div');
    footerEl.className = 'ms-builder-block ms-static-footer';
    footerEl.style.borderTop = '2px solid #e5e7eb';
    footerEl.style.marginTop = 'auto';
    footerEl.style.backgroundColor = window.emailFooterState.bgColor;
    footerEl.style.padding = '20px';
    
    footerEl.innerHTML = `
        ${window.emailFooterState.text}
        <div class="block-actions" style="top:-15px; right: 10px;">
            <span style="font-size:12px; pointer-events:none;">Footer Area</span>
             <span title="Edit">${iconEdit}</span>
        </div>
    `;
    
    footerEl.addEventListener('click', () => openFooterEditor());
    canvas.appendChild(footerEl);
}

function renderSocialBlock(content = {}) {
    const legacyItems = [];
    if (content.fb) legacyItems.push({ type: 'facebook', url: content.fb });
    if (content.ig) legacyItems.push({ type: 'instagram', url: content.ig });
    if (content.tw) legacyItems.push({ type: 'x', url: content.tw });
    if (content.tiktok) legacyItems.push({ type: 'tiktok', url: content.tiktok });
    const items = Array.isArray(content.items)
        ? normalizeSocialLinks(content.items)
        : legacyItems.length
            ? normalizeSocialLinks(legacyItems, { includeDefaults: true })
            : buildDefaultSocialItems();
    const displayItems = items.length ? items : buildDefaultSocialItems();
    return `
        <div class="ms-social-block">
            ${displayItems
                .map((item) => {
                    const icon = renderSocialIcon(item.type);
                    if (!icon) return '';
                    const label = SOCIAL_ICON_LIBRARY[normalizeSocialType(item.type)]?.label || 'Social link';
                    const url = String(item.url || '').trim();
                    if (url) {
                        return `<a class="ms-social-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">${icon}</a>`;
                    }
                    return `<span class="ms-social-link is-empty" aria-label="${escapeHtml(label)}">${icon}</span>`;
                })
                .join('')}
        </div>
    `;
}

function renderEventGrid(block) {
    const content = block.content || {};
    const shows = getEventBlockShows(block);
    if (!shows.length) {
        return `<div class="ms-muted">Select events to populate this block.</div>`;
    }
    const layoutClass = content.layout === 'full' ? 'is-full' : 'is-grid';
    const columns = content.layout === 'full' ? 1 : 2;
    const fontFamily = FONT_FAMILY_MAP[content.fontFamily] || content.fontFamily || '"Inter", "Helvetica Neue", Arial, sans-serif';
    const cardStyle = `
        background:${content.cardBackground || '#ffffff'};
        border:1px solid ${content.cardBorder || '#e2e8f0'};
        border-radius:16px;
        overflow:hidden;
        text-decoration:none;
        display:flex;
        flex-direction:column;
        font-family:${fontFamily};
    `;
    const titleStyle = `color:${content.titleColor || '#0f172a'}; font-size:16px; font-weight:600; margin:0 0 6px;`;
    const metaStyle = `color:${content.metaColor || '#64748b'}; font-size:12px; margin:0;`;
    const priceStyle = `color:${content.priceColor || '#0f172a'}; font-size:14px; font-weight:600; margin:10px 0 0;`;
    return `
        <div class="ms-event-grid ${layoutClass}" style="grid-template-columns:repeat(${columns}, minmax(0, 1fr));">
            ${shows
                .map((show) => {
                    const title = escapeHtml(show.title || 'Untitled event');
                    const imageUrl = getShowPrimaryImage(show);
                    const dateTime = formatShowDateTime(show);
                    const venue = getShowVenue(show);
                    const town = getShowTown(show);
                    const county = getShowCounty(show);
                    const locationText = [venue, town, county].filter(Boolean).join(' • ');
                    const price = show.priceFrom || show.price || '';
                    const link = getShowLink(show);
                    return `
                        <a class="ms-event-card" href="${escapeHtml(link)}" style="${cardStyle}" target="_blank" rel="noopener noreferrer">
                            <div class="ms-event-card-media">
                                <img src="${escapeHtml(imageUrl)}" alt="${title}" style="width:100%; height:180px; object-fit:cover; display:block;">
                            </div>
                            <div class="ms-event-card-body" style="padding:14px;">
                                <h3 class="ms-event-title" style="${titleStyle}">${title}</h3>
                                ${dateTime ? `<p class="ms-event-meta" style="${metaStyle}">${escapeHtml(dateTime)}</p>` : ''}
                                ${locationText ? `<p class="ms-event-meta" style="${metaStyle}">${escapeHtml(locationText)}</p>` : ''}
                                ${price ? `<p class="ms-event-price" style="${priceStyle}">From ${escapeHtml(price)}</p>` : ''}
                            </div>
                        </a>
                    `;
                })
                .join('')}
        </div>
    `;
}

/**
 * Re-added the core getPreviewHtml for the basic blocks
 */
function getPreviewHtml(block) {
    const c = block.content;
    switch(block.type) {
        case 'text': return `<div>${c.text}</div>`;
        case 'boxedtext': {
            const isTransparent = Boolean(c.isTransparent);
            const gradientData = c.gradient || null;
            const padValue = Number.parseInt(c.padding, 10);
            const radiusValue = Number.parseInt(c.borderRadius, 10);
            const marginValue = Number.parseInt(c.margin, 10);
            const pad = Number.isFinite(padValue) ? padValue : 20;
            const radius = Number.isFinite(radiusValue) ? radiusValue : 6;
            const margin = Number.isFinite(marginValue) ? Math.max(marginValue, 0) : 0;
            const backgroundColor = isTransparent
                ? 'transparent'
                : (gradientData?.start || c.bgColor || '#f1f5f9');
            const backgroundImage = !isTransparent && gradientData?.css ? gradientData.css : 'none';
            return `
                <div class="ms-boxed-text${isTransparent ? ' is-transparent' : ''}" style="margin: 0 ${margin}px; padding:${pad}px; border-radius:${radius}px; background-color:${backgroundColor}; background-image:${backgroundImage};">
                    ${c.text}
                </div>
            `;
        }
        case 'image': {
            const imageHtml = `<img src="${escapeHtml(c.src)}" alt="${escapeHtml(c.alt || '')}" style="width:100%; display:block;">`;
            if (c.link) {
                return `<a href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer">${imageHtml}</a>`;
            }
            return imageHtml;
        }
        case 'imagegroup': {
            ensureImageGroupContent(block);
            const columns = Math.min(2, c.images.length || 1);
            const textStyle = buildImageGroupTextStyle(c.textStyle || {});
            return `<div style="display:grid; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); gap:12px;">
                ${c.images
                    .map((img) => {
                        const imageHtml = `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" style="width:100%; display:block;">`;
                        const linkedImage = img.link
                            ? `<a href="${escapeHtml(img.link)}" target="_blank" rel="noopener noreferrer">${imageHtml}</a>`
                            : imageHtml;
                        const textHtml = img.text
                            ? `<div style="margin-top:8px; ${textStyle}">${img.text}</div>`
                            : '';
                        return `<div>${linkedImage}${textHtml}</div>`;
                    })
                    .join('')}
            </div>`; 
        }
        case 'imagecard': 
            return `<div style="border:1px solid #eee;"><img src="${c.src}" style="width:100%; display:block;"><div style="padding:15px;">${c.caption}</div></div>`; 
        case 'button': {
            const radiusValue = Number.parseInt(c.borderRadius, 10);
            const radius = Number.isFinite(radiusValue) ? radiusValue : 6;
            const fontSizeValue = Number.parseInt(c.fontSize, 10);
            const fontSize = Number.isFinite(fontSizeValue) ? fontSizeValue : 16;
            const fontWeightValue = Number.parseInt(c.fontWeight, 10);
            const fontWeight = Number.isFinite(fontWeightValue) ? fontWeightValue : 600;
            const widthValue = Number.parseInt(c.width, 10);
            const heightValue = Number.parseInt(c.height, 10);
            const width = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : null;
            const height = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : null;
            const fontFamily = FONT_FAMILY_MAP[c.fontFamily] || c.fontFamily || '"Inter", "Helvetica Neue", Arial, sans-serif';
            const styleParts = [
                `background:${c.color || '#4f46e5'};`,
                `color:${c.textColor || '#ffffff'};`,
                `border-radius:${radius}px;`,
                `font-weight:${fontWeight};`,
                `font-size:${fontSize}px;`,
                `font-family:${fontFamily};`,
                'text-decoration:none;',
                'display:inline-flex;',
                'align-items:center;',
                'justify-content:center;',
                'padding:12px 22px;',
                'max-width:100%;',
            ];
            if (width) styleParts.push(`width:${width}px;`);
            if (height) styleParts.push(`height:${height}px;`);
            return `<div style="text-align:${c.align || 'center'};"><a class="ms-primary" style="${styleParts.join('')}">${c.label}</a></div>`;
        }
        case 'divider': {
            const thicknessValue = Number.parseInt(c.thickness, 10);
            const thickness = Number.isFinite(thicknessValue) ? thicknessValue : 1;
            const paddingTopValue = Number.parseInt(c.paddingTop, 10);
            const paddingTop = Number.isFinite(paddingTopValue) ? paddingTopValue : 18;
            const paddingBottomValue = Number.parseInt(c.paddingBottom, 10);
            const paddingBottom = Number.isFinite(paddingBottomValue) ? paddingBottomValue : 18;
            const lineStyle = c.lineStyle || 'solid';
            const lineColor = c.color || '#e2e8f0';
            return `
                <div style="padding-top:${paddingTop}px; padding-bottom:${paddingBottom}px;">
                    <hr style="border:0; border-top:${thickness}px ${lineStyle} ${lineColor}; margin:0;">
                </div>
            `;
        }
        case 'space': {
            const heightValue = Number.parseInt(c.height, 10);
            const height = Number.isFinite(heightValue) ? heightValue : 24;
            return `<div class="ms-space-block" style="height:${height}px;"></div>`;
        }
        case 'social': return renderSocialBlock(c);
        case 'video': return renderVideoEmbedMarkup(c.url);
        case 'code': return `<div style="background:#f1f5f9; padding:10px; font-family:monospace; font-size:12px; text-align:center;">&lt;HTML Code /&gt;</div>`;
        case 'event': return renderEventGrid(block);
        default: return `<div class="ms-muted">[${block.type.toUpperCase()} BLOCK]</div>`;
    }
}

window.deleteBlock = function(id) {
    if(!confirm('Delete this block?')) return;
    function removeBlockById(blocks, targetId) {
        const idx = blocks.findIndex(b => b.id === targetId);
        if (idx > -1) {
            blocks.splice(idx, 1);
            return true;
        }
        for (const block of blocks) {
            if (block.type === 'strip' && block.content.blocks) {
                const removed = removeBlockById(block.content.blocks, targetId);
                if (removed) return true;
            }
        }
        return false;
    }
    removeBlockById(window.editorBlocks, id);
    renderBuilderCanvas();
    if (window.activeBlockId === id) {
        window.activeBlockId = null;
    }
    const editorPanel = document.getElementById('ms-block-editor');
    const blocksPanel = document.getElementById('ms-sidebar-blocks');
    if (editorPanel) {
        editorPanel.classList.add('hidden');
        editorPanel.classList.remove('active');
        editorPanel.style.display = 'none';
    }
    if (blocksPanel) {
        blocksPanel.classList.add('active');
        blocksPanel.style.display = 'block';
    }
    recordEditorHistory();
}

function getBlockTypeLabel(type) {
    const labels = {
        boxedtext: 'Boxed Text',
        imagegroup: 'Image Group',
        imagecard: 'Image Card',
        space: 'Space',
        event: 'Event',
    };
    if (!type) return 'Block';
    return labels[type] || `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function updateBlockEditorTitle(title) {
    const titleEl = document.getElementById('ms-block-editor-title');
    if (titleEl) titleEl.textContent = title;
}

function getRichTextEditorMarkup(block) {
    const textColor = block.content.color || '#0f172a';
    const highlightColor = block.content.highlightColor || '#ffffff';
    return `
        <div class="ms-field">
            <label>Content</label>
            <div class="ms-rte-toolbar">
                <button class="ms-rte-btn" type="button" data-rte-command="bold" title="Bold"><strong>B</strong></button>
                <button class="ms-rte-btn" type="button" data-rte-command="italic" title="Italic"><em>I</em></button>
                <button class="ms-rte-btn" type="button" data-rte-command="underline" title="Underline"><span style="text-decoration:underline;">U</span></button>
                <button class="ms-rte-btn" type="button" data-rte-command="strikeThrough" title="Strikethrough"><span style="text-decoration:line-through;">S</span></button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-rte-command="insertUnorderedList" title="Bulleted list">• List</button>
                <button class="ms-rte-btn" type="button" data-rte-command="insertOrderedList" title="Numbered list">1. List</button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-rte-command="justifyLeft" title="Align left">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h12M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <button class="ms-rte-btn" type="button" data-rte-command="justifyCenter" title="Align center">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12M4 12h16M6 18h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <button class="ms-rte-btn" type="button" data-rte-command="justifyRight" title="Align right">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M4 12h16M10 18h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-rte-command="createLink" title="Insert link">🔗</button>
                <button class="ms-rte-btn" type="button" data-rte-command="removeFormat" title="Clear formatting">✕</button>
                <select class="ms-rte-select" data-rte-command="textStyle" aria-label="Text style">
                    ${TEXT_STYLE_PRESETS.map((preset) => `<option value="${preset.value}">${preset.label}</option>`).join('')}
                </select>
                <select class="ms-rte-select" data-rte-command="fontName" aria-label="Font family">
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Inter">Inter</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Manrope">Manrope</option>
                    <option value="Rubik">Rubik</option>
                    <option value="Quicksand">Quicksand</option>
                    <option value="Karla">Karla</option>
                    <option value="Libre Franklin">Libre Franklin</option>
                    <option value="Libre Baskerville">Libre Baskerville</option>
                    <option value="Lora">Lora</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Raleway">Raleway</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Merriweather">Merriweather</option>
                    <option value="Source Sans 3">Source Sans 3</option>
                    <option value="Nunito">Nunito</option>
                    <option value="Ubuntu">Ubuntu</option>
                    <option value="Oswald">Oswald</option>
                    <option value="PT Sans">PT Sans</option>
                    <option value="Work Sans">Work Sans</option>
                    <option value="Fira Sans">Fira Sans</option>
                </select>
                <select class="ms-rte-select" data-rte-command="fontSize" aria-label="Font size">
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16" selected>16px</option>
                    <option value="18">18px</option>
                    <option value="24">24px</option>
                    <option value="32">32px</option>
                </select>
                <div class="ms-rte-line-spacing" role="group" aria-label="Line spacing">
                    <button class="ms-rte-btn ms-rte-line-spacing-trigger" type="button" data-rte-command="lineSpacing" aria-expanded="false">
                        Line spacing
                    </button>
                    <div class="ms-rte-line-spacing-popover" data-line-spacing-popover>
                        <div class="ms-rte-line-spacing-header">
                            <span>Line spacing</span>
                            <span class="ms-rte-line-spacing-value" data-line-spacing-value>1.50x</span>
                        </div>
                        <input
                            class="ms-rte-line-spacing-range"
                            type="range"
                            min="1"
                            max="3"
                            step="0.05"
                            value="1.5"
                            data-line-spacing-range
                        />
                    </div>
                </div>
            </div>
            <div id="ms-text-editor" class="ms-rte-editor" contenteditable="true">${block.content.text || ''}</div>
        </div>
        <div class="ms-rte-color-row">
            ${renderModernColorPicker('Text Color', 'text-color', textColor, 'updateActiveTextColor')}
            ${renderModernColorPicker('Highlight Color', 'text-highlight', highlightColor, 'updateActiveTextHighlight')}
        </div>
    `;
}

function getImageGroupTextEditorMarkup(image, index) {
    return `
        <div class="ms-image-group-text-editor ${image.text ? '' : 'is-hidden'}" data-image-text-editor data-image-index="${index}">
            <div class="ms-rte-toolbar is-compact">
                <button class="ms-rte-btn" type="button" data-image-text-command="bold" title="Bold"><strong>B</strong></button>
                <button class="ms-rte-btn" type="button" data-image-text-command="italic" title="Italic"><em>I</em></button>
                <button class="ms-rte-btn" type="button" data-image-text-command="underline" title="Underline"><span style="text-decoration:underline;">U</span></button>
                <button class="ms-rte-btn" type="button" data-image-text-command="strikeThrough" title="Strikethrough"><span style="text-decoration:line-through;">S</span></button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-image-text-command="insertUnorderedList" title="Bulleted list">• List</button>
                <button class="ms-rte-btn" type="button" data-image-text-command="insertOrderedList" title="Numbered list">1. List</button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-image-text-command="justifyLeft" title="Align left">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h12M4 12h16M4 18h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <button class="ms-rte-btn" type="button" data-image-text-command="justifyCenter" title="Align center">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12M4 12h16M6 18h12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <button class="ms-rte-btn" type="button" data-image-text-command="justifyRight" title="Align right">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M4 12h16M10 18h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                </button>
                <span class="ms-rte-divider"></span>
                <button class="ms-rte-btn" type="button" data-image-text-command="createLink" title="Insert link">🔗</button>
                <button class="ms-rte-btn" type="button" data-image-text-command="removeFormat" title="Clear formatting">✕</button>
            </div>
            <div class="ms-rte-editor" contenteditable="true" data-image-text-editor-input>${image.text || ''}</div>
        </div>
    `;
}

function setupRichTextEditor(container, block) {
    const editor = container.querySelector('#ms-text-editor');
    if (!editor) return;
    window.activeTextEditor = editor;
    const colorPickers = Array.from(container.querySelectorAll('.ms-color-picker-wrapper'));
    const setColorPickerState = (enabled) => {
        rteSelectionActive = Boolean(enabled);
        colorPickers.forEach((picker) => {
            picker.classList.toggle('is-disabled', !enabled);
            picker.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        });
    };
    const updateSelectionState = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setColorPickerState(Boolean(savedRteSelection));
            return;
        }
        const range = selection.getRangeAt(0);
        const isInEditor = editor.contains(range.startContainer) && editor.contains(range.endContainer);
        const hasSavedSelection =
            savedRteSelection &&
            editor.contains(savedRteSelection.startContainer) &&
            editor.contains(savedRteSelection.endContainer);
        if (isInEditor && !selection.isCollapsed) {
            savedRteSelection = range.cloneRange();
            setColorPickerState(true);
            return;
        }
        if (hasSavedSelection) {
            setColorPickerState(true);
            return;
        }
        if (!isInEditor) {
            setColorPickerState(false);
        }
    };
    if (typeof rteCleanupHandler === 'function') {
        rteCleanupHandler();
        rteCleanupHandler = null;
    }
    const saveSelection = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;
        savedRteSelection = range.cloneRange();
    };
    const handleSelectionChange = () => {
        updateSelectionState();
    };
    const handleOutsideClick = (event) => {
        if (!container.contains(event.target)) {
            savedRteSelection = null;
            setColorPickerState(false);
        }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleOutsideClick);
    rteCleanupHandler = () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        document.removeEventListener('mousedown', handleOutsideClick);
        window.activeTextEditor = null;
    };
    setColorPickerState(false);
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('focus', saveSelection);
    editor.addEventListener('focus', updateSelectionState);
    editor.addEventListener('input', () => {
        block.content.text = editor.innerHTML;
        recordEditorHistory({ immediate: false });
        renderBuilderCanvas();
    });
    const lineSpacingWrapper = container.querySelector('.ms-rte-line-spacing');
    const lineSpacingButton = container.querySelector('[data-rte-command="lineSpacing"]');
    const lineSpacingPopover = container.querySelector('[data-line-spacing-popover]');
    const lineSpacingRange = container.querySelector('[data-line-spacing-range]');
    const lineSpacingValue = container.querySelector('[data-line-spacing-value]');
    const updateLineSpacingValue = (ratio) => {
        const safeRatio = Math.min(3, Math.max(1, Number.parseFloat(ratio) || 1.5));
        if (lineSpacingRange) lineSpacingRange.value = safeRatio;
        if (lineSpacingValue) lineSpacingValue.textContent = `${safeRatio.toFixed(2)}x`;
    };
    const setLineSpacingOpen = (open) => {
        if (!lineSpacingWrapper || !lineSpacingButton || !lineSpacingPopover) return;
        lineSpacingWrapper.classList.toggle('is-open', open);
        lineSpacingButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            const ratio = getLineHeightRatioFromSelection(editor);
            updateLineSpacingValue(ratio);
        }
    };
    if (lineSpacingButton) {
        lineSpacingButton.addEventListener('click', () => {
            saveSelection();
            const isOpen = lineSpacingWrapper?.classList.contains('is-open');
            setLineSpacingOpen(!isOpen);
        });
    }
    if (lineSpacingRange) {
        lineSpacingRange.addEventListener('input', () => {
            restoreRteSelection(editor);
            const ratio = Number.parseFloat(lineSpacingRange.value);
            applyLineHeightRatio(editor, ratio);
            updateLineSpacingValue(ratio);
            block.content.text = editor.innerHTML;
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
            saveSelection();
        });
        lineSpacingRange.addEventListener('change', () => {
            recordEditorHistory();
        });
    }
    const handleLineSpacingOutsideClick = (event) => {
        if (!lineSpacingWrapper) return;
        if (!lineSpacingWrapper.contains(event.target)) {
            setLineSpacingOpen(false);
        }
    };
    document.addEventListener('mousedown', handleLineSpacingOutsideClick);
    const previousCleanup = rteCleanupHandler;
    rteCleanupHandler = () => {
        if (typeof previousCleanup === 'function') previousCleanup();
        document.removeEventListener('mousedown', handleLineSpacingOutsideClick);
        window.activeTextEditor = null;
    };
    container.querySelectorAll('button[data-rte-command]').forEach((button) => {
        button.addEventListener('click', () => {
            const command = button.getAttribute('data-rte-command');
            if (command === 'lineSpacing') return;
            restoreRteSelection(editor);
            if (command === 'createLink') {
                const url = prompt('Enter a URL');
                if (url) document.execCommand('createLink', false, url);
            } else if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
                const alignmentMap = {
                    justifyLeft: 'left',
                    justifyCenter: 'center',
                    justifyRight: 'right',
                };
                applyAlignment(editor, alignmentMap[command]);
            } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
                const currentAlignment = getAlignmentFromSelection(editor);
                document.execCommand(command, false, null);
                applyAlignment(editor, currentAlignment, { applyToAllOnCollapse: false });
            } else {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand(command, false, null);
            }
            block.content.text = editor.innerHTML;
            recordEditorHistory();
            renderBuilderCanvas();
            saveSelection();
        });
    });
    container.querySelectorAll('select[data-rte-command]').forEach((select) => {
        select.addEventListener('change', (event) => {
            const command = select.getAttribute('data-rte-command');
            restoreRteSelection(editor);
            if (command === 'textStyle') {
                applyTextStyle(editor, event.target.value);
            } else if (command === 'fontSize') {
                const value = Number.parseInt(event.target.value, 10);
                const sizeMap = { 12: 2, 14: 3, 16: 3, 18: 4, 24: 5, 32: 6 };
                document.execCommand('fontSize', false, sizeMap[value] || 3);
            } else {
                const fontKey = event.target.value;
                const fontFamily = FONT_FAMILY_MAP[fontKey] || fontKey;
                applyFontFamily(editor, fontFamily);
            }
            block.content.text = editor.innerHTML;
            recordEditorHistory();
            renderBuilderCanvas();
            saveSelection();
            updateSelectionState();
        });
    });
}

function openBlockEditor(block) {
    updateBlockEditorTitle(getBlockTypeLabel(block.type));
    const stylesTabActive = document.querySelector('[data-sidebar-tab="styles"]')?.classList.contains('active');
    if (stylesTabActive) {
        window.activeBlockId = block.id;
        return;
    }
    const panels = Array.from(document.querySelectorAll('.ms-sidebar-panel'));
    panels.forEach((panel) => {
        const isTarget = panel.id === 'ms-block-editor';
        panel.classList.toggle('active', isTarget);
        panel.classList.toggle('hidden', !isTarget);
        panel.style.display = isTarget ? 'block' : 'none';
    });
    const editorPanel = document.getElementById('ms-block-editor');
    editorPanel.classList.remove('hidden');
    editorPanel.classList.add('active');
    editorPanel.style.display = 'block';

    // Store active ID for the global color updater
    window.activeBlockId = block.id;

    const container = document.getElementById('ms-active-block-settings');
    container.innerHTML = '';

    // --- STRIP EDITOR (Corrected & Merged) ---
    if (block.type === 'strip') {
        const stripGradient = block.content.gradient || {};
        const stripGradientStart = stripGradient.start || '#111827';
        const stripGradientEnd = stripGradient.end || '#f9fafb';
        container.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Strip Settings</div>
                
                ${renderModernColorPicker('Background Color', 'strip-bg', block.content.bgColor || '#ffffff', 'updateActiveBlockBg')}

                <div class="ms-field" style="margin-top:12px;">
                    <label>Gradient presets</label>
                    <div class="ms-gradient-grid" id="ms-strip-gradient-presets"></div>
                </div>
                <div class="ms-gradient-custom">
                    <div class="ms-sidebar-section-title">Custom gradient</div>
                    <div class="ms-gradient-picker">
                        ${renderModernColorPicker('Start color', 'strip-gradient-start', stripGradientStart, 'updateStripGradientStart')}
                        ${renderModernColorPicker('End color', 'strip-gradient-end', stripGradientEnd, 'updateStripGradientEnd')}
                    </div>
                    <div class="ms-field" style="margin-top:12px;">
                        <label>Gradient direction</label>
                        <select id="ms-strip-gradient-direction">
                            <option value="to bottom">Vertical</option>
                            <option value="to right">Horizontal</option>
                            <option value="135deg">Diagonal</option>
                        </select>
                    </div>
                </div>
                
                <div class="ms-field" style="display:flex; align-items:center; gap:8px; margin-top:12px; background:white; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                    <input type="checkbox" id="input-fullWidth" ${block.content.fullWidth ? 'checked' : ''} onchange="window.updateBlockProp('fullWidth', this.checked)" style="width:auto; margin:0;">
                    <label style="margin:0; font-size:13px; cursor:pointer;" for="input-fullWidth">Full Width Background</label>
                </div>
                <div class="ms-field" style="display:flex; align-items:center; gap:8px; margin-top:10px; background:white; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                    <input type="checkbox" id="input-strip-transparent" ${block.content.isTransparent ? 'checked' : ''} onchange="window.updateStripTransparency(this.checked)" style="width:auto; margin:0;">
                    <label style="margin:0; font-size:13px; cursor:pointer;" for="input-strip-transparent">Transparent background</label>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
                    <div class="ms-field">
                        <label>Padding (px)</label>
                        <input type="number" id="input-padding" value="${parseInt(block.content.padding) || 20}" oninput="window.updateBlockProp('padding', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Side gap (px)</label>
                        <input type="number" id="input-margin" value="${parseInt(block.content.margin) || 0}" oninput="window.updateBlockProp('margin', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Corner Radius</label>
                        <input type="number" id="input-borderRadius" value="${parseInt(block.content.borderRadius) || 0}" oninput="window.updateBlockProp('borderRadius', this.value)">
                    </div>
                </div>
                
                <div class="ms-muted" style="margin-top:12px; font-size:12px; border-top:1px solid #e2e8f0; padding-top:8px;">
                    Adjust corner radius to create card-like designs or floating sections.
                </div>
            </div>
        `;
        setupStripGradientControls(block);
    }
    else if (block.type === 'divider') {
        const paddingTop = Number.isFinite(Number.parseInt(block.content.paddingTop, 10))
            ? Number.parseInt(block.content.paddingTop, 10)
            : 18;
        const paddingBottom = Number.isFinite(Number.parseInt(block.content.paddingBottom, 10))
            ? Number.parseInt(block.content.paddingBottom, 10)
            : 18;
        const thickness = Number.isFinite(Number.parseInt(block.content.thickness, 10))
            ? Number.parseInt(block.content.thickness, 10)
            : 1;
        const lineStyle = block.content.lineStyle || 'solid';

        container.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Divider Settings</div>

                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div class="ms-field">
                        <label>Padding top (px)</label>
                        <input type="number" id="input-paddingTop" value="${paddingTop}" oninput="window.updateBlockProp('paddingTop', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Padding bottom (px)</label>
                        <input type="number" id="input-paddingBottom" value="${paddingBottom}" oninput="window.updateBlockProp('paddingBottom', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Line style</label>
                        <select id="input-lineStyle" onchange="window.updateBlockProp('lineStyle', this.value)">
                            <option value="solid" ${lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                            <option value="dashed" ${lineStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                            <option value="dotted" ${lineStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                        </select>
                    </div>
                    <div class="ms-field">
                        <label>Line thickness (px)</label>
                        <input type="number" id="input-thickness" value="${thickness}" min="1" oninput="window.updateBlockProp('thickness', this.value)">
                    </div>
                </div>

                ${renderModernColorPicker('Line Color', 'divider-line', block.content.color || '#e2e8f0', 'updateActiveBlockColor')}
            </div>
        `;
    }
    else if (block.type === 'space') {
        const heightValue = Number.parseInt(block.content.height, 10);
        const height = Number.isFinite(heightValue) ? heightValue : 24;
        container.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Space Settings</div>
                <div class="ms-field">
                    <label>Height (px)</label>
                    <input type="range" id="slider-height" min="4" max="120" step="2" value="${height}" oninput="window.updateBlockProp('height', this.value)">
                    <input type="number" id="input-height" min="4" max="120" value="${height}" oninput="window.updateBlockProp('height', this.value)">
                </div>
                <div class="ms-muted" style="margin-top:8px;">Increase or decrease the spacer height to adjust layout gaps.</div>
            </div>
        `;
    }
    // --- TEXT EDITOR ---
    else if (block.type === 'text') {
        container.innerHTML = getRichTextEditorMarkup(block);
        setupRichTextEditor(container, block);
    }
    // --- BOXED TEXT EDITOR ---
    else if (block.type === 'boxedtext') {
        const boxedGradient = block.content.gradient || {};
        const boxedGradientStart = boxedGradient.start || '#111827';
        const boxedGradientEnd = boxedGradient.end || '#f9fafb';
        container.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Boxed Text Settings</div>

                ${renderModernColorPicker('Background Color', 'boxedtext-bg', block.content.bgColor || '#f1f5f9', 'updateActiveBlockBg')}

                <div class="ms-field" style="margin-top:12px;">
                    <label>Gradient presets</label>
                    <div class="ms-gradient-grid" id="ms-boxedtext-gradient-presets"></div>
                </div>
                <div class="ms-gradient-custom">
                    <div class="ms-sidebar-section-title">Custom gradient</div>
                    <div class="ms-gradient-picker">
                        ${renderModernColorPicker('Start color', 'boxedtext-gradient-start', boxedGradientStart, 'updateBoxedTextGradientStart')}
                        ${renderModernColorPicker('End color', 'boxedtext-gradient-end', boxedGradientEnd, 'updateBoxedTextGradientEnd')}
                    </div>
                    <div class="ms-field" style="margin-top:12px;">
                        <label>Gradient direction</label>
                        <select id="ms-boxedtext-gradient-direction">
                            <option value="to bottom">Vertical</option>
                            <option value="to right">Horizontal</option>
                            <option value="135deg">Diagonal</option>
                        </select>
                    </div>
                </div>

                <div class="ms-field" style="display:flex; align-items:center; gap:8px; margin-top:12px; background:white; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                    <input type="checkbox" id="input-fullWidth" ${block.content.fullWidth ? 'checked' : ''} onchange="window.updateBlockProp('fullWidth', this.checked)" style="width:auto; margin:0;">
                    <label style="margin:0; font-size:13px; cursor:pointer;" for="input-fullWidth">Full Width Background</label>
                </div>
                <div class="ms-field" style="display:flex; align-items:center; gap:8px; margin-top:10px; background:white; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                    <input type="checkbox" id="input-boxedtext-transparent" ${block.content.isTransparent ? 'checked' : ''} onchange="window.updateBoxedTextTransparency(this.checked)" style="width:auto; margin:0;">
                    <label style="margin:0; font-size:13px; cursor:pointer;" for="input-boxedtext-transparent">Transparent background</label>
                </div>

                <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
                    <div class="ms-field">
                        <label>Padding (px)</label>
                        <input type="number" id="input-padding" value="${parseInt(block.content.padding) || 20}" oninput="window.updateBlockProp('padding', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Side gap (px)</label>
                        <input type="number" id="input-margin" value="${parseInt(block.content.margin) || 0}" oninput="window.updateBlockProp('margin', this.value)">
                    </div>
                    <div class="ms-field">
                        <label>Corner Radius</label>
                        <input type="number" id="input-borderRadius" value="${parseInt(block.content.borderRadius) || 6}" oninput="window.updateBlockProp('borderRadius', this.value)">
                    </div>
                </div>

                <div class="ms-muted" style="margin-top:12px; font-size:12px; border-top:1px solid #e2e8f0; padding-top:8px;">
                    Combine background styling with rich text for card-like callouts.
                </div>
            </div>
            ${getRichTextEditorMarkup(block)}
        `;
        setupRichTextEditor(container, block);
        setupBoxedTextGradientControls(block);
    }
    // --- BUTTON EDITOR ---
    else if (block.type === 'button') {
        const showOptions = appState.shows
            .map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`)
            .join('');
        const linkShowId = block.content.linkShowId || '';
        const selectedShow = appState.shows.find((show) => show.id === linkShowId);
        const selectedShowLink = selectedShow ? getShowLink(selectedShow) : '';
        const fontFamily = block.content.fontFamily || 'Inter';
        const fontSize = Number.isFinite(Number.parseInt(block.content.fontSize, 10))
            ? Number.parseInt(block.content.fontSize, 10)
            : 16;
        const fontWeight = Number.isFinite(Number.parseInt(block.content.fontWeight, 10))
            ? Number.parseInt(block.content.fontWeight, 10)
            : 600;
        const borderRadius = Number.isFinite(Number.parseInt(block.content.borderRadius, 10))
            ? Number.parseInt(block.content.borderRadius, 10)
            : 6;
        const width = Number.parseInt(block.content.width, 10);
        const height = Number.parseInt(block.content.height, 10);
        const widthValue = Number.isFinite(width) ? width : '';
        const heightValue = Number.isFinite(height) ? height : '';
        const align = block.content.align || 'center';
        const maxButtonWidth = 600;

        container.innerHTML = `
            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:16px;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Button Settings</div>
                <div class="ms-field"><label>Button Label</label><input id="edit-btn-label" value="${escapeHtml(block.content.label || '')}"></div>
                <div class="ms-field"><label>Link URL</label><input id="edit-btn-url" value="${escapeHtml(block.content.url || '')}" placeholder="https://example.com"></div>
                <div class="ms-field">
                    <label>Link to show</label>
                    <select id="ms-button-link-show">
                        <option value="">No show link</option>
                        ${showOptions}
                    </select>
                    <div class="ms-muted">Choose a show to auto-fill the button URL.</div>
                </div>

                <div class="ms-field">
                    <label>Alignment</label>
                    <select id="edit-btn-align">
                        <option value="left" ${align === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${align === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${align === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>

                <div class="ms-field">
                    <label>Font family</label>
                    <select id="edit-btn-font">
                        ${renderFontFamilyOptions(fontFamily)}
                    </select>
                </div>
                <div class="ms-field">
                    <label>Font size (px)</label>
                    <input type="number" id="edit-btn-font-size" min="10" max="48" value="${fontSize}">
                </div>
                <div class="ms-field">
                    <label>Font weight</label>
                    <select id="edit-btn-font-weight">
                        <option value="400" ${fontWeight === 400 ? 'selected' : ''}>Regular</option>
                        <option value="500" ${fontWeight === 500 ? 'selected' : ''}>Medium</option>
                        <option value="600" ${fontWeight === 600 ? 'selected' : ''}>Semibold</option>
                        <option value="700" ${fontWeight === 700 ? 'selected' : ''}>Bold</option>
                    </select>
                </div>

                ${renderModernColorPicker('Button color', 'button-bg', block.content.color || '#4f46e5', 'updateActiveButtonBg')}
                ${renderModernColorPicker('Text color', 'button-text', block.content.textColor || '#ffffff', 'updateActiveButtonText')}

                <div class="ms-field" style="margin-top:12px;">
                    <label>Corner radius (px)</label>
                    <input type="number" id="edit-btn-radius" min="0" max="40" value="${borderRadius}">
                </div>
                <div class="ms-field">
                    <label>Button width (px)</label>
                    <input type="number" id="edit-btn-width" min="0" max="${maxButtonWidth}" value="${widthValue}" placeholder="Auto">
                    <div class="ms-muted">Max width ${maxButtonWidth}px (email width).</div>
                </div>
                <div class="ms-field">
                    <label>Button height (px)</label>
                    <input type="number" id="edit-btn-height" min="0" value="${heightValue}" placeholder="Auto">
                </div>
            </div>
        `;

        const labelInput = container.querySelector('#edit-btn-label');
        const urlInput = container.querySelector('#edit-btn-url');
        const showSelect = container.querySelector('#ms-button-link-show');
        const alignSelect = container.querySelector('#edit-btn-align');
        const fontSelect = container.querySelector('#edit-btn-font');
        const fontSizeInput = container.querySelector('#edit-btn-font-size');
        const fontWeightSelect = container.querySelector('#edit-btn-font-weight');
        const radiusInput = container.querySelector('#edit-btn-radius');
        const widthInput = container.querySelector('#edit-btn-width');
        const heightInput = container.querySelector('#edit-btn-height');

        if (showSelect) showSelect.value = linkShowId;
        if (selectedShowLink && urlInput && !block.content.url) {
            urlInput.value = selectedShowLink;
            block.content.url = selectedShowLink;
        }

        const updateButtonContent = () => {
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        };

        const clampButtonWidth = (value) => {
            if (!value) return '';
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return '';
            return Math.max(0, Math.min(parsed, maxButtonWidth));
        };

        if (labelInput) {
            labelInput.addEventListener('input', (e) => {
                block.content.label = e.target.value;
                updateButtonContent();
            });
        }

        if (urlInput) {
            urlInput.addEventListener('input', (e) => {
                block.content.url = e.target.value;
                const currentShow = appState.shows.find((show) => show.id === block.content.linkShowId);
                if (currentShow && getShowLink(currentShow) !== block.content.url) {
                    block.content.linkShowId = '';
                    if (showSelect) showSelect.value = '';
                }
                updateButtonContent();
            });
        }

        if (showSelect) {
            showSelect.addEventListener('change', () => {
                const show = appState.shows.find((item) => item.id === showSelect.value);
                if (show) {
                    const showLink = getShowLink(show);
                    block.content.url = showLink;
                    block.content.linkShowId = show.id;
                    if (urlInput) urlInput.value = showLink;
                } else {
                    block.content.linkShowId = '';
                }
                updateButtonContent();
            });
        }

        if (alignSelect) {
            alignSelect.addEventListener('change', (e) => {
                block.content.align = e.target.value;
                updateButtonContent();
            });
        }

        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => {
                block.content.fontFamily = e.target.value;
                updateButtonContent();
            });
        }

        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (e) => {
                block.content.fontSize = e.target.value;
                updateButtonContent();
            });
        }

        if (fontWeightSelect) {
            fontWeightSelect.addEventListener('change', (e) => {
                block.content.fontWeight = e.target.value;
                updateButtonContent();
            });
        }

        if (radiusInput) {
            radiusInput.addEventListener('input', (e) => {
                block.content.borderRadius = e.target.value;
                updateButtonContent();
            });
        }

        if (widthInput) {
            widthInput.addEventListener('input', (e) => {
                const nextWidth = clampButtonWidth(e.target.value);
                block.content.width = nextWidth;
                if (String(nextWidth) !== e.target.value) {
                    e.target.value = nextWidth;
                }
                updateButtonContent();
            });
        }

        if (heightInput) {
            heightInput.addEventListener('input', (e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                block.content.height = Number.isFinite(parsed) ? Math.max(0, parsed) : '';
                updateButtonContent();
            });
        }
    }
    // --- SOCIAL EDITOR ---
    else if (block.type === 'social') {
        ensureSocialBlockContent(block);
        const items = Array.isArray(block.content.items) ? block.content.items : buildDefaultSocialItems();
        const options = Object.keys(SOCIAL_ICON_LIBRARY)
            .map((type) => `<option value="${type}">${escapeHtml(SOCIAL_ICON_LIBRARY[type].label)}</option>`)
            .join('');
        container.innerHTML = `
            <div class="ms-social-editor">
                <div class="ms-sidebar-section-title">Social media links</div>
                <div class="ms-social-list">
                    ${items
                        .map((item, index) => {
                            const label = SOCIAL_ICON_LIBRARY[normalizeSocialType(item.type)]?.label || item.type;
                            return `
                                <div class="ms-social-row" data-social-index="${index}">
                                    <span class="ms-social-icon">${renderSocialIcon(item.type)}</span>
                                    <div class="ms-social-field">
                                        <div class="ms-social-label">${escapeHtml(label)}</div>
                                        <input type="url" value="${escapeHtml(item.url || '')}" placeholder="https://example.com" data-social-url />
                                    </div>
                                    <button type="button" class="ms-social-remove" data-social-remove aria-label="Remove">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                            `;
                        })
                        .join('')}
                </div>
                <div class="ms-social-actions">
                    <select class="ms-social-select" data-social-add-select>${options}</select>
                    <button type="button" class="ms-secondary" data-social-add>Add icon</button>
                </div>
                <div class="ms-muted">Links auto-save as you type.</div>
            </div>
        `;

        container.querySelectorAll('[data-social-index]').forEach((row) => {
            const index = Number.parseInt(row.dataset.socialIndex, 10);
            const urlInput = row.querySelector('[data-social-url]');
            const removeBtn = row.querySelector('[data-social-remove]');
            if (urlInput) {
                urlInput.addEventListener('input', () => {
                    block.content.items[index].url = urlInput.value;
                    recordEditorHistory({ immediate: false });
                    renderBuilderCanvas();
                });
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    block.content.items.splice(index, 1);
                    recordEditorHistory();
                    renderBuilderCanvas();
                    openBlockEditor(block);
                });
            }
        });

        const addSelect = container.querySelector('[data-social-add-select]');
        const addBtn = container.querySelector('[data-social-add]');
        if (addBtn && addSelect) {
            addBtn.addEventListener('click', () => {
                const type = addSelect.value;
                if (!SOCIAL_ICON_LIBRARY[type]) return;
                if (block.content.items.some((item) => item.type === type)) {
                    toast('That icon is already included.', 'warning');
                    return;
                }
                block.content.items.push({ type, url: '' });
                recordEditorHistory();
                renderBuilderCanvas();
                openBlockEditor(block);
            });
        }
    }
    // --- IMAGE EDITOR ---
    else if (block.type === 'imagegroup') {
        ensureImageGroupContent(block);
        const showOptions = appState.shows
            .map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`)
            .join('');
        const textStyle = getImageGroupDefaultTextStyle(block.content.textStyle || {});

        container.innerHTML = `
            <div class="ms-image-group-style-card">
                <div class="ms-sidebar-section-title">Image group settings</div>
                <div class="ms-field">
                    <label>Number of images</label>
                    <input type="number" min="1" max="20" value="${block.content.images.length}" data-image-group-count>
                    <div class="ms-muted">Increase or decrease the number of shows in the grid.</div>
                </div>
            </div>
            <div class="ms-image-group-style-card">
                <div class="ms-sidebar-section-title">Text style (applies to all images)</div>
                <div class="ms-field">
                    <label>Font family</label>
                    <select data-image-group-text-style="fontFamily">
                        ${renderFontFamilyOptions(textStyle.fontFamily)}
                    </select>
                </div>
                <div class="ms-field">
                    <label>Font size (px)</label>
                    <input type="number" min="10" max="48" value="${textStyle.fontSize}" data-image-group-text-style="fontSize">
                </div>
                <div class="ms-field">
                    <label>Font weight</label>
                    <select data-image-group-text-style="fontWeight">
                        <option value="400" ${textStyle.fontWeight === 400 ? 'selected' : ''}>Regular</option>
                        <option value="500" ${textStyle.fontWeight === 500 ? 'selected' : ''}>Medium</option>
                        <option value="600" ${textStyle.fontWeight === 600 ? 'selected' : ''}>Semibold</option>
                        <option value="700" ${textStyle.fontWeight === 700 ? 'selected' : ''}>Bold</option>
                    </select>
                </div>
                <div class="ms-field">
                    <label>Alignment</label>
                    <select data-image-group-text-style="textAlign">
                        <option value="left" ${textStyle.textAlign === 'left' ? 'selected' : ''}>Left</option>
                        <option value="center" ${textStyle.textAlign === 'center' ? 'selected' : ''}>Center</option>
                        <option value="right" ${textStyle.textAlign === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                </div>
                <div class="ms-field">
                    <label>Text color</label>
                    <div class="ms-image-group-color-row">
                        <input type="color" value="${textStyle.color}" data-image-group-text-style="color-picker">
                        <input type="text" value="${textStyle.color}" data-image-group-text-style="color" maxlength="7">
                    </div>
                </div>
            </div>
            <div class="ms-image-group-list">
                ${block.content.images
                    .map((image, index) => {
                        const selectedShow = appState.shows.find((show) => show.id === image.showId);
                        const showImageGrid = selectedShow
                            ? renderShowImageGrid(selectedShow, image.showImageUrl || image.src)
                            : '<div class="ms-muted">Select a show to browse its images.</div>';
                        const preview = image.src
                            ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || '')}" />`
                            : '<span class="ms-image-group-preview-placeholder"></span>';
                        return `
                            <details class="ms-image-group-item" data-image-group-item data-image-index="${index}" ${index === 0 ? 'open' : ''}>
                                <summary>
                                    <span>Image ${index + 1}</span>
                                    <span class="ms-image-group-preview" data-image-summary-preview>${preview}</span>
                                </summary>
                                <div class="ms-image-group-body">
                                    <div class="ms-field">
                                        <label>Upload image</label>
                                        <div class="ms-image-upload">
                                            <input type="file" accept="image/*" data-image-upload-input />
                                            <div class="ms-image-upload-drop" data-image-upload-drop>
                                                <strong>Drop image here</strong>
                                                <span>or click to upload</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="ms-field">
                                        <label>Image URL</label>
                                        <input value="${escapeHtml(image.src)}" data-image-field="src">
                                    </div>
                                    <div class="ms-field">
                                        <label>Alt text</label>
                                        <input value="${escapeHtml(image.alt)}" data-image-field="alt">
                                    </div>
                                    <div class="ms-field">
                                        <label>Show images</label>
                                        <select data-image-show-select>
                                            <option value="">Select show</option>
                                            ${showOptions}
                                        </select>
                                        <div class="ms-image-grid-wrapper" data-image-show-grid>${showImageGrid}</div>
                                        <label class="ms-checkbox-row">
                                            <input type="checkbox" data-image-link-selected-show ${image.showId && image.linkShowId === image.showId ? 'checked' : ''}>
                                            Link image to selected show
                                        </label>
                                    </div>
                                    <div class="ms-field">
                                        <label>Link URL</label>
                                        <input value="${escapeHtml(image.link || '')}" data-image-field="link" placeholder="https://example.com">
                                    </div>
                                    <div class="ms-field">
                                        <label>Link to show</label>
                                        <select data-image-link-show>
                                            <option value="">No show link</option>
                                            ${showOptions}
                                        </select>
                                        <div class="ms-muted">Select a show to auto-fill the link URL.</div>
                                    </div>
                                    <button class="ms-secondary ms-image-group-text-toggle" type="button" data-image-text-toggle>
                                        ${image.text ? 'Edit text beneath image' : 'Add text beneath image'}
                                    </button>
                                    ${getImageGroupTextEditorMarkup(image, index)}
                                </div>
                            </details>
                        `;
                    })
                    .join('')}
            </div>
        `;

        const countInput = container.querySelector('[data-image-group-count]');
        if (countInput) {
            countInput.addEventListener('change', () => {
                const nextValue = Math.max(1, Number.parseInt(countInput.value, 10) || 1);
                const currentCount = block.content.images.length;
                if (nextValue > currentCount) {
                    const additions = Array.from({ length: nextValue - currentCount }, () => createImageGroupImage());
                    block.content.images = block.content.images.concat(additions);
                } else if (nextValue < currentCount) {
                    block.content.images = block.content.images.slice(0, nextValue);
                }
                recordEditorHistory();
                renderBuilderCanvas();
                openBlockEditor(block);
            });
        }

        const applyTextStyleUpdates = () => {
            block.content.textStyle = getImageGroupDefaultTextStyle(block.content.textStyle || {});
            applyImageGroupTextStyleToEditors(container, block.content.textStyle);
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        };

        const fontSelect = container.querySelector('[data-image-group-text-style="fontFamily"]');
        const fontSizeInput = container.querySelector('[data-image-group-text-style="fontSize"]');
        const fontWeightSelect = container.querySelector('[data-image-group-text-style="fontWeight"]');
        const alignSelect = container.querySelector('[data-image-group-text-style="textAlign"]');
        const colorPickerInput = container.querySelector('[data-image-group-text-style="color-picker"]');
        const colorTextInput = container.querySelector('[data-image-group-text-style="color"]');

        if (fontSelect) {
            fontSelect.addEventListener('change', (event) => {
                block.content.textStyle.fontFamily = event.target.value;
                applyTextStyleUpdates();
            });
        }

        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', (event) => {
                block.content.textStyle.fontSize = Math.max(10, Number.parseInt(event.target.value, 10) || 14);
                applyTextStyleUpdates();
            });
        }

        if (fontWeightSelect) {
            fontWeightSelect.addEventListener('change', (event) => {
                block.content.textStyle.fontWeight = Number.parseInt(event.target.value, 10) || 400;
                applyTextStyleUpdates();
            });
        }

        if (alignSelect) {
            alignSelect.addEventListener('change', (event) => {
                block.content.textStyle.textAlign = event.target.value;
                applyTextStyleUpdates();
            });
        }

        const syncColorInputs = (color) => {
            if (colorPickerInput) colorPickerInput.value = color;
            if (colorTextInput) colorTextInput.value = color;
        };

        if (colorPickerInput) {
            colorPickerInput.addEventListener('input', (event) => {
                const color = event.target.value;
                block.content.textStyle.color = color;
                syncColorInputs(color);
                applyTextStyleUpdates();
            });
        }

        if (colorTextInput) {
            colorTextInput.addEventListener('change', (event) => {
                const value = String(event.target.value || '').trim();
                const isValid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
                if (!isValid) {
                    syncColorInputs(block.content.textStyle.color);
                    return;
                }
                block.content.textStyle.color = value;
                syncColorInputs(value);
                applyTextStyleUpdates();
            });
        }

        applyImageGroupTextStyleToEditors(container, block.content.textStyle);

        const syncImageGroupPreview = () => {
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        };

        container.querySelectorAll('[data-image-group-item]').forEach((itemEl) => {
            const index = Number.parseInt(itemEl.dataset.imageIndex, 10);
            const image = block.content.images[index];
            if (!image) return;

            const imageSrcInput = itemEl.querySelector('[data-image-field="src"]');
            const imageAltInput = itemEl.querySelector('[data-image-field="alt"]');
            const linkInput = itemEl.querySelector('[data-image-field="link"]');
            const showSelect = itemEl.querySelector('[data-image-show-select]');
            const showGrid = itemEl.querySelector('[data-image-show-grid]');
            const linkShowSelect = itemEl.querySelector('[data-image-link-show]');
            const linkSelectedShowCheckbox = itemEl.querySelector('[data-image-link-selected-show]');
            const uploadInput = itemEl.querySelector('[data-image-upload-input]');
            const uploadDrop = itemEl.querySelector('[data-image-upload-drop]');
            const summaryPreview = itemEl.querySelector('[data-image-summary-preview]');
            const textToggle = itemEl.querySelector('[data-image-text-toggle]');
            const textEditor = itemEl.querySelector('[data-image-text-editor-input]');

            if (showSelect) showSelect.value = image.showId || '';
            if (linkShowSelect) linkShowSelect.value = image.linkShowId || '';

            const updateSummaryPreview = () => {
                if (!summaryPreview) return;
                summaryPreview.innerHTML = image.src
                    ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || '')}" />`
                    : '<span class="ms-image-group-preview-placeholder"></span>';
            };

            const refreshShowGrid = (show) => {
                if (!showGrid) return;
                showGrid.innerHTML = show
                    ? renderShowImageGrid(show, image.showImageUrl || image.src)
                    : '<div class="ms-muted">Select a show to browse its images.</div>';
                bindShowImageTiles(show);
            };

            const handleImageSelection = (url, { fromShow = false } = {}) => {
                image.src = url;
                if (fromShow) {
                    image.showImageUrl = url;
                } else {
                    image.showId = '';
                    image.showImageUrl = '';
                    if (showSelect) showSelect.value = '';
                }
                if (!image.alt) {
                    image.alt = 'Email image';
                    if (imageAltInput) imageAltInput.value = image.alt;
                }
                if (imageSrcInput) imageSrcInput.value = url;
                updateSummaryPreview();
                syncImageGroupPreview();
            };

            const bindShowImageTiles = (show) => {
                if (!showGrid) return;
                showGrid.querySelectorAll('[data-image-url]').forEach((button) => {
                    button.addEventListener('click', () => {
                        const url = button.getAttribute('data-image-url');
                        if (!url) return;
                        handleImageSelection(url, { fromShow: true });
                        image.showId = showSelect ? showSelect.value : '';
                        if (show && !image.alt) {
                            image.alt = show.title || 'Show image';
                            if (imageAltInput) imageAltInput.value = image.alt;
                        }
                        if (linkSelectedShowCheckbox?.checked && show) {
                            const showLink = getShowLink(show);
                            image.link = showLink;
                            image.linkShowId = show.id;
                            if (linkInput) linkInput.value = showLink;
                            if (linkShowSelect) linkShowSelect.value = show.id;
                        }
                        updateSummaryPreview();
                        syncImageGroupPreview();
                    });
                });
            };

            if (uploadDrop && uploadInput) {
                uploadDrop.addEventListener('click', () => uploadInput.click());
                uploadDrop.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    uploadDrop.classList.add('is-dragover');
                });
                uploadDrop.addEventListener('dragleave', () => {
                    uploadDrop.classList.remove('is-dragover');
                });
                uploadDrop.addEventListener('drop', (event) => {
                    event.preventDefault();
                    uploadDrop.classList.remove('is-dragover');
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                        readImageFile(file, (result) => {
                            if (typeof result === 'string') handleImageSelection(result);
                        });
                    }
                });
                uploadInput.addEventListener('change', (event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        readImageFile(file, (result) => {
                            if (typeof result === 'string') handleImageSelection(result);
                        });
                    }
                });
            }

            if (imageSrcInput) {
                imageSrcInput.addEventListener('input', (event) => {
                    image.src = event.target.value;
                    image.showImageUrl = '';
                    updateSummaryPreview();
                    syncImageGroupPreview();
                });
            }

            if (imageAltInput) {
                imageAltInput.addEventListener('input', (event) => {
                    image.alt = event.target.value;
                    updateSummaryPreview();
                    syncImageGroupPreview();
                });
            }

            if (showSelect) {
                showSelect.addEventListener('change', () => {
                    image.showId = showSelect.value || '';
                    image.showImageUrl = '';
                    const show = appState.shows.find((item) => item.id === image.showId);
                    if (linkSelectedShowCheckbox) {
                        linkSelectedShowCheckbox.checked = Boolean(show && image.linkShowId === show.id);
                    }
                    if (!image.showId) {
                        refreshShowGrid(null);
                        return;
                    }
                    ensureShowImages(image.showId).then((loadedShow) => {
                        refreshShowGrid(loadedShow || show);
                    });
                });
            }

            if (linkInput) {
                linkInput.addEventListener('input', (event) => {
                    image.link = event.target.value;
                    const currentLinkShow = appState.shows.find((item) => item.id === image.linkShowId);
                    if (currentLinkShow && getShowLink(currentLinkShow) !== image.link) {
                        image.linkShowId = '';
                        if (linkShowSelect) linkShowSelect.value = '';
                        if (linkSelectedShowCheckbox) linkSelectedShowCheckbox.checked = false;
                    }
                    syncImageGroupPreview();
                });
            }

            if (linkShowSelect) {
                linkShowSelect.addEventListener('change', () => {
                    const show = appState.shows.find((item) => item.id === linkShowSelect.value);
                    if (show) {
                        const showLink = getShowLink(show);
                        image.link = showLink;
                        image.linkShowId = show.id;
                        if (linkInput) linkInput.value = showLink;
                    } else {
                        image.linkShowId = '';
                    }
                    if (linkSelectedShowCheckbox) {
                        linkSelectedShowCheckbox.checked = Boolean(show && show.id === image.showId);
                    }
                    syncImageGroupPreview();
                });
            }

            if (linkSelectedShowCheckbox) {
                linkSelectedShowCheckbox.addEventListener('change', () => {
                    const show = appState.shows.find((item) => item.id === (showSelect ? showSelect.value : ''));
                    if (!show) {
                        linkSelectedShowCheckbox.checked = false;
                        return;
                    }
                    if (linkSelectedShowCheckbox.checked) {
                        const showLink = getShowLink(show);
                        image.link = showLink;
                        image.linkShowId = show.id;
                        if (linkInput) linkInput.value = showLink;
                        if (linkShowSelect) linkShowSelect.value = show.id;
                    } else if (image.linkShowId === show.id) {
                        image.linkShowId = '';
                    }
                    syncImageGroupPreview();
                });
            }

            if (textToggle) {
                textToggle.addEventListener('click', () => {
                    if (!image.text) {
                        image.text = '<p>Add your text here.</p>';
                        if (textEditor) textEditor.innerHTML = image.text;
                    }
                    const editorWrapper = itemEl.querySelector('[data-image-text-editor]');
                    if (editorWrapper) editorWrapper.classList.remove('is-hidden');
                    textToggle.textContent = 'Edit text beneath image';
                    applyImageGroupTextStyleToEditors(container, block.content.textStyle);
                    syncImageGroupPreview();
                });
            }

            if (textEditor) {
                textEditor.addEventListener('input', () => {
                    image.text = textEditor.innerHTML;
                    syncImageGroupPreview();
                });
            }

            itemEl.querySelectorAll('[data-image-text-command]').forEach((button) => {
                button.addEventListener('click', () => {
                    const command = button.getAttribute('data-image-text-command');
                    if (!textEditor) return;
                    textEditor.focus();
                    if (command === 'createLink') {
                        const url = prompt('Enter a URL');
                        if (url) document.execCommand('createLink', false, url);
                    } else if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
                        const alignmentMap = {
                            justifyLeft: 'left',
                            justifyCenter: 'center',
                            justifyRight: 'right',
                        };
                        const alignment = alignmentMap[command];
                        applyAlignment(textEditor, alignment);
                        block.content.textStyle.textAlign = alignment;
                        applyTextStyleUpdates();
                    } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
                        const currentAlignment = block.content.textStyle.textAlign || 'left';
                        document.execCommand(command, false, null);
                        applyAlignment(textEditor, currentAlignment, { applyToAllOnCollapse: false });
                    } else {
                        document.execCommand('styleWithCSS', false, true);
                        document.execCommand(command, false, null);
                    }
                    image.text = textEditor.innerHTML;
                    syncImageGroupPreview();
                });
            });

            if (image.showId) {
                ensureShowImages(image.showId).then((loadedShow) => {
                    if (!loadedShow) return;
                    refreshShowGrid(loadedShow);
                });
            }
        });
    }
    // --- IMAGE EDITOR ---
    else if (block.type === 'image') {
        const showOptions = appState.shows
            .map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`)
            .join('');
        const selectedShowId = block.content.showId || '';
        const selectedShow = appState.shows.find((show) => show.id === selectedShowId);
        const linkShowId = block.content.linkShowId || '';
        const linkShow = appState.shows.find((show) => show.id === linkShowId);
        const selectedShowLink = selectedShow ? getShowLink(selectedShow) : '';
        const linkShowLink = linkShow ? getShowLink(linkShow) : '';
        const showImageGrid = selectedShow
            ? renderShowImageGrid(selectedShow, block.content.showImageUrl || block.content.src)
            : '<div class="ms-muted">Select a show to browse its images.</div>';

        container.innerHTML = `
            <div class="ms-field">
                <label>Upload image</label>
                <div class="ms-image-upload">
                    <input type="file" id="ms-image-upload-input" accept="image/*" />
                    <div class="ms-image-upload-drop" id="ms-image-upload-drop">
                        <strong>Drop image here</strong>
                        <span>or click to upload</span>
                    </div>
                </div>
            </div>
            <div class="ms-field">
                <label>Image URL</label>
                <input id="edit-img-src" value="${escapeHtml(block.content.src)}">
                <div class="ms-muted">Paste a public image URL, or upload above.</div>
            </div>
            <div class="ms-field"><label>Alt Text</label><input id="edit-img-alt" value="${escapeHtml(block.content.alt)}"></div>
            <div class="ms-field">
                <label>Show images</label>
                <select id="ms-image-show-select">
                    <option value="">Select show</option>
                    ${showOptions}
                </select>
                <div id="ms-image-show-grid" class="ms-image-grid-wrapper">${showImageGrid}</div>
                <label class="ms-checkbox-row">
                    <input type="checkbox" id="ms-image-link-selected-show" ${selectedShowId && block.content.linkShowId === selectedShowId ? 'checked' : ''}>
                    Link image to selected show
                </label>
            </div>
            <div class="ms-field">
                <label>Link URL</label>
                <input id="edit-img-link" value="${escapeHtml(block.content.link || '')}" placeholder="https://example.com">
            </div>
            <div class="ms-field">
                <label>Link to show</label>
                <select id="ms-image-link-show">
                    <option value="">No show link</option>
                    ${showOptions}
                </select>
                <div class="ms-muted">Select a show to auto-fill the link URL.</div>
            </div>
        `;

        const uploadInput = container.querySelector('#ms-image-upload-input');
        const uploadDrop = container.querySelector('#ms-image-upload-drop');
        const imageSrcInput = container.querySelector('#edit-img-src');
        const imageAltInput = container.querySelector('#edit-img-alt');
        const showSelect = container.querySelector('#ms-image-show-select');
        const showGrid = container.querySelector('#ms-image-show-grid');
        const linkInput = container.querySelector('#edit-img-link');
        const linkShowSelect = container.querySelector('#ms-image-link-show');
        const linkSelectedShowCheckbox = container.querySelector('#ms-image-link-selected-show');

        const refreshShowGrid = (show, selectedUrl) => {
            if (!showGrid) return;
            showGrid.innerHTML = show
                ? renderShowImageGrid(show, selectedUrl || block.content.showImageUrl || block.content.src)
                : '<div class="ms-muted">Select a show to browse its images.</div>';
            bindShowImageTiles();
        };

        if (selectedShowId) {
            ensureShowImages(selectedShowId).then((loadedShow) => {
                if (!loadedShow) return;
                refreshShowGrid(loadedShow, block.content.showImageUrl || block.content.src);
            });
        }

        if (showSelect) showSelect.value = selectedShowId;
        if (linkShowSelect) linkShowSelect.value = linkShowId;
        if (linkInput && linkShowLink && !block.content.link) {
            linkInput.value = linkShowLink;
            block.content.link = linkShowLink;
        }

        const syncImagePreview = () => {
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        };

        const handleImageSelection = (url, { fromShow = false } = {}) => {
            block.content.src = url;
            if (fromShow) {
                block.content.showImageUrl = url;
            } else {
                block.content.showId = '';
                block.content.showImageUrl = '';
                if (showSelect) showSelect.value = '';
            }
            if (!block.content.alt) {
                block.content.alt = 'Email image';
                if (imageAltInput) imageAltInput.value = block.content.alt;
            }
            if (imageSrcInput) imageSrcInput.value = url;
            syncImagePreview();
        };

        const bindShowImageTiles = () => {
            if (!showGrid) return;
            showGrid.querySelectorAll('[data-image-url]').forEach((button) => {
                button.addEventListener('click', () => {
                    const url = button.getAttribute('data-image-url');
                    if (!url) return;
                    handleImageSelection(url, { fromShow: true });
                    block.content.showId = showSelect ? showSelect.value : '';
                    const show = appState.shows.find((item) => item.id === block.content.showId);
                    if (show && !block.content.alt) {
                        block.content.alt = show.title || 'Show image';
                        if (imageAltInput) imageAltInput.value = block.content.alt;
                    }
                    if (linkSelectedShowCheckbox?.checked && show) {
                        const showLink = getShowLink(show);
                        block.content.link = showLink;
                        block.content.linkShowId = show.id;
                        if (linkInput) linkInput.value = showLink;
                        if (linkShowSelect) linkShowSelect.value = show.id;
                    }
                    syncImagePreview();
                });
            });
        };

        if (uploadDrop && uploadInput) {
            uploadDrop.addEventListener('click', () => uploadInput.click());
            uploadDrop.addEventListener('dragover', (event) => {
                event.preventDefault();
                uploadDrop.classList.add('is-dragover');
            });
            uploadDrop.addEventListener('dragleave', () => {
                uploadDrop.classList.remove('is-dragover');
            });
            uploadDrop.addEventListener('drop', (event) => {
                event.preventDefault();
                uploadDrop.classList.remove('is-dragover');
                const file = event.dataTransfer.files?.[0];
                if (file) {
                    readImageFile(file, (result) => {
                        if (typeof result === 'string') handleImageSelection(result);
                    });
                }
            });
            uploadInput.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    readImageFile(file, (result) => {
                        if (typeof result === 'string') handleImageSelection(result);
                    });
                }
            });
        }

        if (imageSrcInput) {
            imageSrcInput.addEventListener('input', (e) => {
                block.content.src = e.target.value;
                block.content.showImageUrl = '';
                syncImagePreview();
            });
        }

        if (imageAltInput) {
            imageAltInput.addEventListener('input', (e) => {
                block.content.alt = e.target.value;
                syncImagePreview();
            });
        }

        if (showSelect) {
            showSelect.addEventListener('change', () => {
                block.content.showId = showSelect.value || '';
                block.content.showImageUrl = '';
                const showId = block.content.showId;
                const show = appState.shows.find((item) => item.id === showId);
                if (linkSelectedShowCheckbox) {
                    linkSelectedShowCheckbox.checked = Boolean(show && block.content.linkShowId === show.id);
                }
                if (!showId) {
                    refreshShowGrid(null);
                    return;
                }
                ensureShowImages(showId).then((loadedShow) => {
                    refreshShowGrid(loadedShow || show, block.content.src);
                });
            });
        }

        if (linkInput) {
            linkInput.addEventListener('input', (e) => {
                block.content.link = e.target.value;
                const currentLinkShow = appState.shows.find((item) => item.id === block.content.linkShowId);
                if (currentLinkShow && getShowLink(currentLinkShow) !== block.content.link) {
                    block.content.linkShowId = '';
                    if (linkShowSelect) linkShowSelect.value = '';
                    if (linkSelectedShowCheckbox) linkSelectedShowCheckbox.checked = false;
                }
                syncImagePreview();
            });
        }

        if (linkShowSelect) {
            linkShowSelect.addEventListener('change', () => {
                const show = appState.shows.find((item) => item.id === linkShowSelect.value);
                if (show) {
                    const showLink = getShowLink(show);
                    block.content.link = showLink;
                    block.content.linkShowId = show.id;
                    if (linkInput) linkInput.value = showLink;
                } else {
                    block.content.linkShowId = '';
                }
                if (linkSelectedShowCheckbox) {
                    linkSelectedShowCheckbox.checked = Boolean(show && show.id === block.content.showId);
                }
                syncImagePreview();
            });
        }

        if (linkSelectedShowCheckbox) {
            linkSelectedShowCheckbox.addEventListener('change', () => {
                const show = appState.shows.find((item) => item.id === (showSelect ? showSelect.value : ''));
                if (!show) {
                    linkSelectedShowCheckbox.checked = false;
                    return;
                }
                if (linkSelectedShowCheckbox.checked) {
                    const showLink = getShowLink(show);
                    block.content.link = showLink;
                    block.content.linkShowId = show.id;
                    if (linkInput) linkInput.value = showLink;
                    if (linkShowSelect) linkShowSelect.value = show.id;
                } else if (block.content.linkShowId === show.id) {
                    block.content.linkShowId = '';
                }
                syncImagePreview();
            });
        }

        bindShowImageTiles();
        if (selectedShowId) {
            ensureShowImages(selectedShowId).then((loadedShow) => {
                if (loadedShow && showGrid) {
                    refreshShowGrid(loadedShow, block.content.showImageUrl || block.content.src);
                }
            });
        }
    }
    else if (block.type === 'video') {
        const availableShows = (appState.shows || []).filter((show) => getShowVideoOptions(show).length);
        const showOptions = availableShows
            .map((show) => `<option value="${show.id}">${escapeHtml(show.title)}</option>`)
            .join('');
        const selectedShowId = block.content.showId || '';
        const selectedShow = availableShows.find((show) => show.id === selectedShowId);
        const showVideoOptions = selectedShow ? getShowVideoOptions(selectedShow) : [];
        const existingVideoKey = block.content.showVideoKey || '';
        const resolvedVideoKey = showVideoOptions.some((option) => option.key === existingVideoKey)
            ? existingVideoKey
            : (showVideoOptions[0]?.key || '');
        const resolvedShowUrl = selectedShow ? resolveShowVideoUrl(selectedShow, resolvedVideoKey) : '';
        if (!block.content.url && resolvedShowUrl) {
            block.content.url = resolvedShowUrl;
            block.content.showVideoKey = resolvedVideoKey;
        }

        container.innerHTML = `
            <div class="ms-card ms-video-settings">
                <div class="ms-sidebar-section-title">Video settings</div>
                <div class="ms-field">
                    <label>Video URL</label>
                    <input id="ms-video-url" value="${escapeHtml(block.content.url || '')}" placeholder="https://youtube.com/watch?v=..." />
                    <div class="ms-muted">Paste a YouTube, Vimeo, or direct video URL.</div>
                </div>
                <div class="ms-field">
                    <label>Link to show</label>
                    <select id="ms-video-show-select">
                        <option value="">No show</option>
                        ${showOptions || '<option value="" disabled>No shows with videos yet</option>'}
                    </select>
                    <div class="ms-muted">Pick a show to pull its video links.</div>
                </div>
                ${showVideoOptions.length ? `
                    <div class="ms-field">
                        <label>Show video</label>
                        <select id="ms-video-source-select">
                            ${showVideoOptions
                                .map(
                                    (option) =>
                                        `<option value="${option.key}" ${option.key === resolvedVideoKey ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
                                )
                                .join('')}
                        </select>
                    </div>
                ` : ''}
                <div class="ms-field">
                    <label>Preview</label>
                    <div class="ms-video-preview" data-video-preview>${renderVideoEmbedMarkup(block.content.url)}</div>
                </div>
            </div>
        `;

        const urlInput = container.querySelector('#ms-video-url');
        const showSelect = container.querySelector('#ms-video-show-select');
        const sourceSelect = container.querySelector('#ms-video-source-select');
        const preview = container.querySelector('[data-video-preview]');

        const syncPreview = () => {
            if (preview) preview.innerHTML = renderVideoEmbedMarkup(block.content.url);
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        };

        if (showSelect) showSelect.value = selectedShowId;

        if (urlInput) {
            urlInput.addEventListener('input', (event) => {
                block.content.url = event.target.value;
                if (block.content.showId) {
                    block.content.showId = '';
                    block.content.showVideoKey = '';
                    if (showSelect) showSelect.value = '';
                }
                syncPreview();
            });
        }

        if (showSelect) {
            showSelect.addEventListener('change', () => {
                block.content.showId = showSelect.value || '';
                const show = availableShows.find((item) => item.id === block.content.showId);
                const options = show ? getShowVideoOptions(show) : [];
                block.content.showVideoKey = options[0]?.key || '';
                block.content.url = options[0]?.url || '';
                if (urlInput) urlInput.value = block.content.url;
                recordEditorHistory();
                renderBuilderCanvas();
                openBlockEditor(block);
            });
        }

        if (sourceSelect) {
            sourceSelect.addEventListener('change', () => {
                const show = availableShows.find((item) => item.id === (showSelect ? showSelect.value : ''));
                if (!show) return;
                block.content.showVideoKey = sourceSelect.value;
                block.content.url = resolveShowVideoUrl(show, sourceSelect.value);
                if (urlInput) urlInput.value = block.content.url;
                syncPreview();
            });
        }
    }
    else if (block.type === 'event') {
        const selectionMode = block.content.selectionMode || 'shows';
        const showsSorted = (appState.shows || []).slice().sort((a, b) => {
            return String(a.title || '').localeCompare(String(b.title || ''));
        });
        const towns = Array.from(
            new Set(
                showsSorted
                    .map((show) => getShowTown(show))
                    .filter((value) => value && String(value).trim())
            )
        ).sort((a, b) => String(a).localeCompare(String(b)));
        const counties = Array.from(
            new Set(
                showsSorted
                    .map((show) => getShowCounty(show))
                    .filter((value) => value && String(value).trim())
            )
        ).sort((a, b) => String(a).localeCompare(String(b)));

        container.innerHTML = `
            <div class="ms-card ms-event-settings-card">
                <div class="ms-sidebar-section-title">Event selection</div>
                <div class="ms-field">
                    <label>Choose events by</label>
                    <div class="ms-event-selection-row">
                        <label class="ms-checkbox-row">
                            <input type="radio" name="event-selection-mode" value="shows" ${selectionMode === 'shows' ? 'checked' : ''}>
                            Individual shows
                        </label>
                        <label class="ms-checkbox-row">
                            <input type="radio" name="event-selection-mode" value="town" ${selectionMode === 'town' ? 'checked' : ''}>
                            Town
                        </label>
                        <label class="ms-checkbox-row">
                            <input type="radio" name="event-selection-mode" value="county" ${selectionMode === 'county' ? 'checked' : ''}>
                            County
                        </label>
                    </div>
                </div>
                <div class="ms-event-selection-panel" data-event-selection-panel="shows">
                    <div class="ms-field">
                        <label>Select shows</label>
                        <div class="ms-event-selection-list">
                            ${showsSorted
                                .map(
                                    (show) => `
                                        <label class="ms-checkbox-row">
                                            <input type="checkbox" data-event-show-id="${show.id}" ${block.content.showIds?.includes(show.id) ? 'checked' : ''}>
                                            ${escapeHtml(show.title || 'Untitled show')}
                                        </label>
                                    `
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div class="ms-event-selection-panel" data-event-selection-panel="town">
                    <div class="ms-field">
                        <label>Town</label>
                        <select id="ms-event-town-select">
                            <option value="">Select town</option>
                            ${towns.map((town) => `<option value="${escapeHtml(town)}">${escapeHtml(town)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="ms-event-selection-panel" data-event-selection-panel="county">
                    <div class="ms-field">
                        <label>County</label>
                        <select id="ms-event-county-select">
                            <option value="">Select county</option>
                            ${counties.map((county) => `<option value="${escapeHtml(county)}">${escapeHtml(county)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div class="ms-card ms-event-settings-card">
                <div class="ms-sidebar-section-title">Layout</div>
                <div class="ms-field">
                    <label>Grid style</label>
                    <select id="ms-event-layout">
                        <option value="grid" ${block.content.layout === 'grid' ? 'selected' : ''}>Two-column grid</option>
                        <option value="full" ${block.content.layout === 'full' ? 'selected' : ''}>Full width (stacked)</option>
                    </select>
                </div>
            </div>
            <div class="ms-card ms-event-settings-card">
                <div class="ms-sidebar-section-title">Tile styling</div>
                ${renderModernColorPicker('Tile background', 'event-card-bg', block.content.cardBackground || '#ffffff', 'updateActiveEventCardBg')}
                ${renderModernColorPicker('Tile border', 'event-card-border', block.content.cardBorder || '#e2e8f0', 'updateActiveEventCardBorder')}
                ${renderModernColorPicker('Title color', 'event-title-color', block.content.titleColor || '#0f172a', 'updateActiveEventTitleColor')}
                ${renderModernColorPicker('Meta text color', 'event-meta-color', block.content.metaColor || '#64748b', 'updateActiveEventMetaColor')}
                ${renderModernColorPicker('Price color', 'event-price-color', block.content.priceColor || '#0f172a', 'updateActiveEventPriceColor')}
                <div class="ms-field">
                    <label>Font family</label>
                    <select id="ms-event-font-family">
                        ${renderFontFamilyOptions(block.content.fontFamily || 'Inter')}
                    </select>
                </div>
            </div>
        `;

        const panels = Array.from(container.querySelectorAll('[data-event-selection-panel]'));
        const setSelectionMode = (mode) => {
            panels.forEach((panel) => {
                panel.style.display = panel.dataset.eventSelectionPanel === mode ? 'block' : 'none';
            });
        };
        setSelectionMode(selectionMode);

        container.querySelectorAll('input[name="event-selection-mode"]').forEach((input) => {
            input.addEventListener('change', (event) => {
                block.content.selectionMode = event.target.value;
                setSelectionMode(event.target.value);
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        });

        const showCheckboxes = Array.from(container.querySelectorAll('[data-event-show-id]'));
        showCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const selectedIds = showCheckboxes
                    .filter((input) => input.checked)
                    .map((input) => input.getAttribute('data-event-show-id'))
                    .filter(Boolean);
                block.content.showIds = selectedIds;
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        });

        const townSelect = container.querySelector('#ms-event-town-select');
        if (townSelect) {
            townSelect.value = block.content.town || '';
            townSelect.addEventListener('change', () => {
                block.content.town = townSelect.value;
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        }

        const countySelect = container.querySelector('#ms-event-county-select');
        if (countySelect) {
            countySelect.value = block.content.county || '';
            countySelect.addEventListener('change', () => {
                block.content.county = countySelect.value;
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        }

        const layoutSelect = container.querySelector('#ms-event-layout');
        if (layoutSelect) {
            layoutSelect.addEventListener('change', () => {
                block.content.layout = layoutSelect.value;
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        }

        const fontSelect = container.querySelector('#ms-event-font-family');
        if (fontSelect) {
            fontSelect.addEventListener('change', () => {
                block.content.fontFamily = fontSelect.value;
                recordEditorHistory({ immediate: false });
                renderBuilderCanvas();
            });
        }
    }
    else {
        container.innerHTML = `<div class="ms-muted">No settings available for this block type yet.</div>`;
    }
}

function setupStripGradientControls(block) {
    const directionSelect = document.getElementById('ms-strip-gradient-direction');
    const gradientPresets = document.getElementById('ms-strip-gradient-presets');
    const gradientData = block.content.gradient || {};

    window.currentStripGradientStart = gradientData.start || '#111827';
    window.currentStripGradientEnd = gradientData.end || '#f9fafb';
    window.currentStripGradientDirection = gradientData.direction || 'to bottom';

    if (directionSelect) {
        directionSelect.value = window.currentStripGradientDirection;
        directionSelect.addEventListener('change', (event) => {
            window.currentStripGradientDirection = event.target.value;
            const gradient = getGradientCss(
                window.currentStripGradientDirection,
                window.currentStripGradientStart || '#111827',
                window.currentStripGradientEnd || '#f9fafb'
            );
            window.updateActiveStripGradient(gradient, {
                start: window.currentStripGradientStart || '#111827',
                end: window.currentStripGradientEnd || '#f9fafb',
                direction: window.currentStripGradientDirection,
            });
        });
    }

    if (gradientPresets) {
        gradientPresets.innerHTML = GRADIENT_PRESETS.map((preset, index) => {
            const gradient = getGradientCss(preset.direction, preset.start, preset.end);
            return `
                <button class="ms-gradient-swatch" type="button" data-strip-gradient-index="${index}" style="background:${gradient}">
                    <span>${preset.name}</span>
                </button>
            `;
        }).join('');
        gradientPresets.querySelectorAll('[data-strip-gradient-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number.parseInt(button.dataset.stripGradientIndex, 10);
                const preset = GRADIENT_PRESETS[index];
                if (!preset) return;
                window.currentStripGradientStart = preset.start;
                window.currentStripGradientEnd = preset.end;
                window.currentStripGradientDirection = preset.direction;
                const gradient = getGradientCss(preset.direction, preset.start, preset.end);
                window.updateActiveStripGradient(gradient, {
                    start: preset.start,
                    end: preset.end,
                    direction: preset.direction,
                });
                const startInput = document.getElementById('input-strip-gradient-start');
                const endInput = document.getElementById('input-strip-gradient-end');
                const startPreview = document.getElementById('preview-strip-gradient-start');
                const endPreview = document.getElementById('preview-strip-gradient-end');
                if (startInput) startInput.value = preset.start;
                if (endInput) endInput.value = preset.end;
                if (startPreview) startPreview.style.backgroundColor = preset.start;
                if (endPreview) endPreview.style.backgroundColor = preset.end;
                if (directionSelect) directionSelect.value = preset.direction;
            });
        });
    }
}

function setupBoxedTextGradientControls(block) {
    const directionSelect = document.getElementById('ms-boxedtext-gradient-direction');
    const gradientPresets = document.getElementById('ms-boxedtext-gradient-presets');
    const gradientData = block.content.gradient || {};
    window.currentBoxedTextGradientStart = gradientData.start || '#111827';
    window.currentBoxedTextGradientEnd = gradientData.end || '#f9fafb';
    window.currentBoxedTextGradientDirection = gradientData.direction || 'to bottom';

    if (directionSelect) {
        directionSelect.value = window.currentBoxedTextGradientDirection;
        directionSelect.addEventListener('change', (event) => {
            window.currentBoxedTextGradientDirection = event.target.value;
            const gradient = getGradientCss(
                window.currentBoxedTextGradientDirection,
                window.currentBoxedTextGradientStart || '#111827',
                window.currentBoxedTextGradientEnd || '#f9fafb'
            );
            window.updateActiveBoxedTextGradient(gradient, {
                start: window.currentBoxedTextGradientStart || '#111827',
                end: window.currentBoxedTextGradientEnd || '#f9fafb',
                direction: window.currentBoxedTextGradientDirection,
            });
        });
    }

    if (gradientPresets) {
        gradientPresets.innerHTML = GRADIENT_PRESETS.map((preset, index) => {
            const gradient = getGradientCss(preset.direction, preset.start, preset.end);
            return `
                <button class="ms-gradient-swatch" type="button" data-boxedtext-gradient-index="${index}" style="background:${gradient}">
                    <span>${preset.name}</span>
                </button>
            `;
        }).join('');

        gradientPresets.querySelectorAll('[data-boxedtext-gradient-index]').forEach((button) => {
            button.addEventListener('click', () => {
                const index = Number.parseInt(button.dataset.boxedtextGradientIndex, 10);
                const preset = GRADIENT_PRESETS[index];
                if (!preset) return;
                window.currentBoxedTextGradientStart = preset.start;
                window.currentBoxedTextGradientEnd = preset.end;
                window.currentBoxedTextGradientDirection = preset.direction;
                const gradient = getGradientCss(preset.direction, preset.start, preset.end);
                window.updateActiveBoxedTextGradient(gradient, {
                    start: preset.start,
                    end: preset.end,
                    direction: preset.direction,
                });
                const startInput = document.getElementById('input-boxedtext-gradient-start');
                const endInput = document.getElementById('input-boxedtext-gradient-end');
                const startPreview = document.getElementById('preview-boxedtext-gradient-start');
                const endPreview = document.getElementById('preview-boxedtext-gradient-end');
                if (startInput) startInput.value = preset.start;
                if (endInput) endInput.value = preset.end;
                if (startPreview) startPreview.style.backgroundColor = preset.start;
                if (endPreview) endPreview.style.backgroundColor = preset.end;
                if (directionSelect) directionSelect.value = preset.direction;
            });
        });
    }
}

/* Opens the editor for the static footer */
function openFooterEditor() {
    document.querySelectorAll('.ms-sidebar-panel').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
        p.style.display = 'none';
    });
    const editorPanel = document.getElementById('ms-block-editor');
    editorPanel.classList.remove('hidden');
    editorPanel.classList.add('active');
    editorPanel.style.display = 'block';
    updateBlockEditorTitle('Footer');

    const container = document.getElementById('ms-active-block-settings');
    container.innerHTML = `
        <div class="ms-toolbar" style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <strong>Edit Footer</strong>
            <p class="ms-muted" style="font-size:12px;">This section appears at the bottom of every email.</p>
        </div>
        <div class="ms-field">
            <label>Footer Content (HTML)</label>
            <textarea id="edit-footer-text" rows="8" style="width:100%; font-family:monospace; font-size:12px;">${window.emailFooterState.text}</textarea>
            <div class="ms-muted">Required merge tags: {{links.unsubscribeLink}}</div>
        </div>
        <div class="ms-field">
            <label>Background Color</label>
            <input type="color" id="edit-footer-bg" value="${window.emailFooterState.bgColor}">
        </div>
    `;

    container.querySelector('#edit-footer-text').addEventListener('input', (e) => {
        window.emailFooterState.text = e.target.value;
        recordEditorHistory({ immediate: false });
        renderBuilderCanvas();
    });
    container.querySelector('#edit-footer-bg').addEventListener('input', (e) => {
        window.emailFooterState.bgColor = e.target.value;
        recordEditorHistory({ immediate: false });
        renderBuilderCanvas();
    });
}

// --- NEW: Modern Color Picker Logic ---
const COLOR_PALETTE = [
    ['#000000', '#333333', '#555555', '#777777', '#999999', '#bbbbbb', '#ffffff'],
    ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#fff1f2', '#fff5f5'], // Reds
    ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed', '#fffaf0'], // Oranges
    ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7', '#fffbeb', '#fffdf0'], // Ambers
    ['#84cc16', '#a3e635', '#bef264', '#d9f99d', '#ecfccb', '#f7fee7', '#fafff0'], // Limes
    ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5', '#f0fdf4'], // Emeralds
    ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe', '#ecfeff', '#f0faff'], // Cyans
    ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#f0f7ff'], // Blues
    ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#eef2ff', '#f5f7ff'], // Indigos
    ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#fafaff'], // Violets
    ['#d946ef', '#e879f9', '#f0abfc', '#f5d0fe', '#fae8ff', '#fdf4ff', '#fffaff'], // Fuchsias
];

function renderInlinePalette(id, updateFunctionGlobalName) {
    const paletteHtml = COLOR_PALETTE.map(row =>
        row
            .map(
                (color) =>
                    `<button class="ms-color-swatch ms-color-swatch-button" type="button" aria-label="${color}" style="background:${color}" onclick="window.pickColor('${id}', '${color}', '${updateFunctionGlobalName}')"></button>`
            )
            .join('')
    ).join('');

    return `<div class="ms-palette-grid ms-palette-grid-inline">${paletteHtml}</div>`;
}

function renderModernColorPicker(label, id, value, updateFunctionGlobalName) {
    const safeValue = value || '#ffffff';
    // Generate Palette HTML
    const paletteHtml = COLOR_PALETTE.map(row => 
        row.map(color => 
            `<div class="ms-color-swatch" style="background:${color}" onclick="window.pickColor('${id}', '${color}', '${updateFunctionGlobalName}')"></div>`
        ).join('')
    ).join('');

    return `
    <div class="ms-field ms-color-picker-wrapper" id="cp-${id}">
        <label>${label}</label>
        <div class="ms-color-input-group">
            <div class="ms-color-preview" id="preview-${id}" style="background-color: ${safeValue};" onclick="window.toggleColorPopover('${id}')"></div>
            <input type="text" class="ms-hex-input" id="input-${id}" value="${safeValue}" onchange="window.manualHexUpdate('${id}', this.value, '${updateFunctionGlobalName}')" maxlength="7">
        </div>
        <div class="ms-color-popover" id="popover-${id}">
            <div class="ms-palette-grid">
                ${paletteHtml}
            </div>
        </div>
    </div>`;
}

const GRADIENT_PRESETS = [
    { name: 'Ink fade', start: '#0f172a', end: '#f8fafc', direction: 'to bottom' },
    { name: 'Graphite mist', start: '#111827', end: '#e2e8f0', direction: 'to bottom' },
    { name: 'Warm stone', start: '#1f2937', end: '#e5e7eb', direction: 'to bottom' },
    { name: 'Silver wash', start: '#334155', end: '#f1f5f9', direction: 'to bottom' },
    { name: 'Misty blue', start: '#0ea5e9', end: '#e0f2fe', direction: 'to bottom' },
    { name: 'Lavender haze', start: '#6366f1', end: '#e0e7ff', direction: 'to bottom' },
    { name: 'Sea glass', start: '#14b8a6', end: '#ccfbf1', direction: 'to bottom' },
    { name: 'Sunset', start: '#f97316', end: '#fde68a', direction: 'to right' },
    { name: 'Rose glow', start: '#f43f5e', end: '#fecdd3', direction: 'to right' },
    { name: 'Citrus pop', start: '#84cc16', end: '#facc15', direction: 'to right' },
    { name: 'Vibrant purple', start: '#9333ea', end: '#f472b6', direction: '135deg' },
    { name: 'Electric blue', start: '#2563eb', end: '#22d3ee', direction: '135deg' },
];

const ALIGN_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, div, blockquote';
const TEXT_STYLE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, div, blockquote';

function getGradientCss(direction, start, end) {
    return `linear-gradient(${direction}, ${start}, ${end})`;
}

function setAllBlocksAlignment(editor, alignment) {
    const blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
    if (blocks.length) {
        blocks.forEach((block) => {
            block.style.textAlign = alignment;
            alignListItem(block, alignment);
        });
    } else {
        editor.style.textAlign = alignment;
    }
}

function getBlockElementsInRange(editor, range) {
    const blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
    const selectedBlocks = blocks.filter((block) => range.intersectsNode(block));
    if (selectedBlocks.length) return selectedBlocks;
    const startContainer = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const closestBlock = startContainer?.closest?.(ALIGN_BLOCK_SELECTOR);
    return closestBlock ? [closestBlock] : [];
}

function getTextStyleBlocksInRange(editor, range) {
    const blocks = Array.from(editor.querySelectorAll(TEXT_STYLE_BLOCK_SELECTOR));
    const selectedBlocks = blocks.filter((block) => range.intersectsNode(block));
    if (selectedBlocks.length) return selectedBlocks;
    const startContainer = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const closestBlock = startContainer?.closest?.(TEXT_STYLE_BLOCK_SELECTOR);
    return closestBlock ? [closestBlock] : [];
}

function applyAlignment(editor, alignment, options = {}) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        setAllBlocksAlignment(editor, alignment);
        return;
    }

    const range = selection.getRangeAt(0);
    const applyToAllOnCollapse = options.applyToAllOnCollapse !== false;
    if (selection.isCollapsed && applyToAllOnCollapse) {
        setAllBlocksAlignment(editor, alignment);
        return;
    }

    const blocks = getBlockElementsInRange(editor, range);
    if (blocks.length) {
        blocks.forEach((block) => {
            block.style.textAlign = alignment;
            alignListItem(block, alignment);
        });
    }
}

function replaceBlockTag(block, tagName) {
    const replacement = document.createElement(tagName);
    replacement.innerHTML = block.innerHTML;
    replacement.className = block.className;
    replacement.style.cssText = block.style.cssText;
    Array.from(block.attributes).forEach((attr) => {
        if (attr.name === 'class' || attr.name === 'style') return;
        replacement.setAttribute(attr.name, attr.value);
    });
    block.replaceWith(replacement);
    return replacement;
}

function applyTextStyle(editor, styleKey, options = {}) {
    const preset = TEXT_STYLE_PRESETS.find((item) => item.value === styleKey);
    if (!preset) return;
    const selection = window.getSelection();
    const applyToAllOnCollapse = options.applyToAllOnCollapse !== false;
    let blocks = [];
    if (!selection || selection.rangeCount === 0) {
        blocks = Array.from(editor.querySelectorAll(TEXT_STYLE_BLOCK_SELECTOR));
    } else {
        const range = selection.getRangeAt(0);
        if (selection.isCollapsed && applyToAllOnCollapse) {
            blocks = Array.from(editor.querySelectorAll(TEXT_STYLE_BLOCK_SELECTOR));
        } else {
            blocks = getTextStyleBlocksInRange(editor, range);
        }
    }

    blocks.forEach((block) => {
        const tag = block.tagName.toLowerCase();
        if (tag === 'li' || tag === 'ul' || tag === 'ol') return;
        const target = tag === preset.tag ? block : replaceBlockTag(block, preset.tag);
        if (preset.fontSize) target.style.fontSize = preset.fontSize;
        if (preset.fontWeight) target.style.fontWeight = preset.fontWeight;
        if (preset.lineHeight) target.style.lineHeight = preset.lineHeight;
    });
}

function getLineHeightRatioFromSelection(editor, options = {}) {
    const selection = window.getSelection();
    const applyToAllOnCollapse = options.applyToAllOnCollapse !== false;
    let blocks = [];
    if (!selection || selection.rangeCount === 0) {
        blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
    } else {
        let range = selection.getRangeAt(0);
        if (
            (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) &&
            savedRteSelection &&
            editor.contains(savedRteSelection.startContainer) &&
            editor.contains(savedRteSelection.endContainer)
        ) {
            range = savedRteSelection;
        }
        const isCollapsed = range.collapsed;
        if (isCollapsed && applyToAllOnCollapse) {
            blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
        } else {
            blocks = getBlockElementsInRange(editor, range);
        }
    }
    const target = blocks[0] || editor;
    const computed = window.getComputedStyle(target);
    const fontSize = Number.parseFloat(computed.fontSize) || 16;
    const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.5;
    const ratio = lineHeight / fontSize;
    return Math.min(3, Math.max(1, ratio));
}

function applyLineHeightRatio(editor, ratio, options = {}) {
    const selection = window.getSelection();
    const applyToAllOnCollapse = options.applyToAllOnCollapse !== false;
    let blocks = [];
    if (!selection || selection.rangeCount === 0) {
        blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
    } else {
        const range = selection.getRangeAt(0);
        if (selection.isCollapsed && applyToAllOnCollapse) {
            blocks = Array.from(editor.querySelectorAll(ALIGN_BLOCK_SELECTOR));
        } else {
            blocks = getBlockElementsInRange(editor, range);
        }
    }
    const targetRatio = Math.min(3, Math.max(1, Number.parseFloat(ratio) || 1.5));
    if (!blocks.length) {
        editor.style.lineHeight = targetRatio.toFixed(2);
        return;
    }
    blocks.forEach((block) => {
        block.style.lineHeight = targetRatio.toFixed(2);
    });
}

function getAlignmentFromSelection(editor) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 'left';
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const block = startContainer?.closest?.(ALIGN_BLOCK_SELECTOR);
    if (block && block.style.textAlign) return block.style.textAlign;
    if (block) return window.getComputedStyle(block).textAlign || 'left';
    return window.getComputedStyle(editor).textAlign || 'left';
}

function alignListItem(block, alignment) {
    if (!block || !block.tagName) return;
    const tag = block.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
        normalizeListAlignment(block, alignment);
        return;
    }
    if (tag === 'li') {
        const list = block.closest('ul, ol');
        if (list) normalizeListAlignment(list, alignment);
    }
}

function normalizeListAlignment(list, alignment) {
    list.style.textAlign = alignment;
    if (alignment === 'left') {
        list.style.listStylePosition = '';
        list.style.paddingLeft = '';
        list.style.paddingInlineStart = '';
        list.style.marginLeft = '';
        list.style.marginRight = '';
        list.style.display = '';
        list.style.width = '';
        list.style.maxWidth = '';
    } else {
        list.style.listStylePosition = 'inside';
        list.style.paddingLeft = '0';
        list.style.paddingInlineStart = '0';
        list.style.marginLeft = 'auto';
        list.style.marginRight = alignment === 'right' ? '0' : 'auto';
        list.style.display = 'block';
        list.style.width = 'fit-content';
        list.style.maxWidth = '100%';
    }
    list.querySelectorAll('li').forEach((item) => {
        item.style.textAlign = alignment;
        if (alignment === 'left') {
            item.style.listStylePosition = '';
            item.style.paddingLeft = '';
            item.style.marginLeft = '';
            item.style.marginRight = '';
            item.style.width = '';
        } else {
            item.style.listStylePosition = 'inside';
            item.style.paddingLeft = '0';
            item.style.marginLeft = '0';
            item.style.marginRight = '0';
            item.style.width = 'fit-content';
        }
    });
}

function restoreRteSelection(editor) {
    if (!editor) return;
    if (!savedRteSelection) {
        editor.focus();
        return;
    }
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRteSelection);
    editor.focus();
}

function getPrimaryFontFamily(fontFamily) {
    if (!fontFamily) return '';
    const primary = fontFamily.split(',')[0]?.trim() || fontFamily;
    return primary.replace(/^['"]|['"]$/g, '');
}

function applyFontFamilyToAll(editor, fontFamily) {
    if (!editor) return;
    editor.style.fontFamily = fontFamily;
    editor.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = fontFamily;
    });
}

function applyFontFamilyToBlock(block, fontFamily) {
    if (!block) return;
    block.style.fontFamily = fontFamily;
    block.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = fontFamily;
    });
}

function applyFontFamilyToSelection(range, fontFamily) {
    if (!range) return;
    const fragment = range.extractContents();
    const span = document.createElement('span');
    span.style.fontFamily = fontFamily;
    span.appendChild(fragment);
    range.insertNode(span);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
    savedRteSelection = newRange.cloneRange();
}

function applyFontFamily(editor, fontFamily) {
    const selection = window.getSelection();
    const primaryFont = getPrimaryFontFamily(fontFamily);
    if (!selection || selection.rangeCount === 0) {
        applyFontFamilyToAll(editor, fontFamily);
        editor.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('fontName', false, primaryFont || fontFamily);
        return;
    }
    const range = selection.getRangeAt(0);
    const activeRange =
        editor.contains(range.startContainer) && editor.contains(range.endContainer)
            ? range
            : savedRteSelection;
    if (!activeRange) {
        applyFontFamilyToAll(editor, fontFamily);
        editor.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('fontName', false, primaryFont || fontFamily);
        return;
    }
    if (activeRange.collapsed) {
        applyFontFamilyToAll(editor, fontFamily);
        editor.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('fontName', false, primaryFont || fontFamily);
        return;
    }
    const blocks = getBlockElementsInRange(editor, activeRange);
    if (blocks.length > 1) {
        blocks.forEach((block) => applyFontFamilyToBlock(block, fontFamily));
        return;
    }
    selection.removeAllRanges();
    selection.addRange(activeRange);
    applyFontFamilyToSelection(activeRange, fontFamily);
}

// Global handlers for the color picker
window.toggleColorPopover = function(id) {
    // Close all others first
    document.querySelectorAll('.ms-color-popover').forEach(el => {
        if (el.id !== `popover-${id}`) el.classList.remove('open');
    });
    if (id && id.startsWith('text-') && window.activeTextEditor && (rteSelectionActive || savedRteSelection)) {
        restoreRteSelection(window.activeTextEditor);
    }
    const popover = document.getElementById(`popover-${id}`);
    if (popover) popover.classList.toggle('open');
};

window.pickColor = function(id, color, updateFnName) {
    if (id && id.startsWith('text-') && window.activeTextEditor && (rteSelectionActive || savedRteSelection)) {
        restoreRteSelection(window.activeTextEditor);
    }
    const input = document.getElementById(`input-${id}`);
    const preview = document.getElementById(`preview-${id}`);
    const popover = document.getElementById(`popover-${id}`);
    
    if (input) input.value = color;
    if (preview) preview.style.backgroundColor = color;
    if (popover) popover.classList.remove('open');

    // Call the specific update function (e.g., 'updateCanvasBg' or 'updateBlockBg')
    if (typeof window[updateFnName] === 'function') {
        window[updateFnName](color);
    }
};

window.manualHexUpdate = function(id, color, updateFnName) {
    if (!color.startsWith('#')) color = '#' + color;
    const preview = document.getElementById(`preview-${id}`);
    if (preview) preview.style.backgroundColor = color;
    if (id && id.startsWith('text-') && window.activeTextEditor && (rteSelectionActive || savedRteSelection)) {
        restoreRteSelection(window.activeTextEditor);
    }
    
    if (typeof window[updateFnName] === 'function') {
        window[updateFnName](color);
    }
};

function setupColorPickerListeners() {
    // Close popovers when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ms-color-picker-wrapper')) {
            document.querySelectorAll('.ms-color-popover').forEach(el => el.classList.remove('open'));
        }
    });
}

// Specific Updaters for the Builder
window.updateCanvasBg = function(color) {
    const canvas = document.getElementById('ms-builder-canvas');
    if (canvas) {
        canvas.style.setProperty('--canvas-bg', color);
        canvas.style.setProperty('--canvas-bg-image', 'none');
        window.currentTemplateStyles = window.currentTemplateStyles || {};
        window.currentTemplateStyles.canvasBg = color;
        window.currentTemplateStyles.canvasGradient = null;
    }
};

window.updateCanvasGradient = function(gradient, payload = {}) {
    const canvas = document.getElementById('ms-builder-canvas');
    if (canvas) {
        canvas.style.setProperty('--canvas-bg-image', gradient);
        window.currentTemplateStyles = window.currentTemplateStyles || {};
        window.currentTemplateStyles.canvasGradient = {
            css: gradient,
            ...payload,
        };
    }
};

window.updateGradientStart = function(color) {
    window.currentGradientStart = color;
    const gradient = getGradientCss(
        window.currentGradientDirection || 'to bottom',
        window.currentGradientStart || '#111827',
        window.currentGradientEnd || '#f9fafb'
    );
    window.updateCanvasGradient(gradient, {
        start: window.currentGradientStart,
        end: window.currentGradientEnd,
        direction: window.currentGradientDirection || 'to bottom',
    });
};

window.updateGradientEnd = function(color) {
    window.currentGradientEnd = color;
    const gradient = getGradientCss(
        window.currentGradientDirection || 'to bottom',
        window.currentGradientStart || '#111827',
        window.currentGradientEnd || '#f9fafb'
    );
    window.updateCanvasGradient(gradient, {
        start: window.currentGradientStart,
        end: window.currentGradientEnd,
        direction: window.currentGradientDirection || 'to bottom',
    });
};
