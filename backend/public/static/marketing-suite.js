const navItems = [
  { label: 'Marketing Home', path: '/admin/marketing' },
  { label: 'Campaigns', path: '/admin/marketing/campaigns' },
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
    const [templateData, versionsData, showsData] = await Promise.all([
      fetchJson(`${API_BASE}/templates/${templateId}`),
      fetchJson(`${API_BASE}/templates/${templateId}/versions`),
      fetchJson('/admin/shows'),
    ]);
    const template = templateData.template;
    const versions = versionsData.versions || [];
    appState.shows = showsData.items || [];

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
            if (block.type === 'strip') {
                block.content.gradient = null;
            }
            block.content.isTransparent = false;
            const transparentToggle = document.getElementById('input-strip-transparent');
            if (transparentToggle && transparentToggle.checked) {
                transparentToggle.checked = false;
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
        case 'boxedtext': return { text: '<p>This is text inside a colored box.</p>', bgColor: '#f1f5f9' };
        case 'image':
            return {
                src: placeholderLarge,
                alt: 'Image',
                link: '',
                showId: '',
                showImageUrl: '',
                linkShowId: '',
            };
        case 'imagegroup': return { images: [{src:placeholderSmall}, {src:placeholderSmall}] };
        case 'imagecard': return { src: placeholderLarge, caption: '<p style="margin-top:10px;">Image caption goes here.</p>' };
        case 'button': return { label: 'Click Here', url: 'https://', color: '#4f46e5', align: 'center' };
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
        case 'social': return { fb: '#', ig: '#', tw: '#' };
        case 'video': return { url: '', thumbnail: placeholderLarge };
        case 'code': return { html: '' };
        case 'product': return { productId: null, title: 'Product Name', price: '£0.00' };
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

/**
 * Re-added the core getPreviewHtml for the basic blocks
 */
function getPreviewHtml(block) {
    const c = block.content;
    switch(block.type) {
        case 'text': return `<div>${c.text}</div>`;
        case 'boxedtext': return `<div style="background:${c.bgColor}; padding:20px; border-radius:4px;">${c.text}</div>`;
        case 'image': {
            const imageHtml = `<img src="${escapeHtml(c.src)}" alt="${escapeHtml(c.alt || '')}" style="width:100%; display:block;">`;
            if (c.link) {
                return `<a href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer">${imageHtml}</a>`;
            }
            return imageHtml;
        }
        case 'imagegroup': 
            return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                ${c.images.map(img => `<img src="${img.src}" style="width:100%;">`).join('')}
            </div>`; 
        case 'imagecard': 
            return `<div style="border:1px solid #eee;"><img src="${c.src}" style="width:100%; display:block;"><div style="padding:15px;">${c.caption}</div></div>`; 
        case 'button': return `<div style="text-align:${c.align};"><a class="ms-primary" style="background:${c.color};">${c.label}</a></div>`;
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
        case 'social': return `<div style="text-align:center; display:flex; justify-content:center; gap:10px;">Social Icons Placeholder</div>`;
        case 'video': return `<div style="position:relative;"><img src="${c.thumbnail}" style="width:100%;"><div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.5); color:white; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;">▶</div></div>`;
        case 'code': return `<div style="background:#f1f5f9; padding:10px; font-family:monospace; font-size:12px; text-align:center;">&lt;HTML Code /&gt;</div>`;
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
    };
    if (!type) return 'Block';
    return labels[type] || `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function updateBlockEditorTitle(title) {
    const titleEl = document.getElementById('ms-block-editor-title');
    if (titleEl) titleEl.textContent = title;
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
        const textColor = block.content.color || '#0f172a';
        const highlightColor = block.content.highlightColor || '#ffffff';
        container.innerHTML = `
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
        const editor = container.querySelector('#ms-text-editor');
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
    // --- BUTTON EDITOR ---
    else if (block.type === 'button') {
        container.innerHTML = `
            <div class="ms-field"><label>Button Label</label><input id="edit-btn-label" value="${block.content.label}"></div>
            <div class="ms-field"><label>Link URL</label><input id="edit-btn-url" value="${block.content.url}"></div>
            <div class="ms-field"><label>Color</label><input type="color" id="edit-btn-color" value="${block.content.color}"></div>
        `;
        container.querySelector('#edit-btn-label').addEventListener('input', (e) => {
            block.content.label = e.target.value;
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
        });
        container.querySelector('#edit-btn-color').addEventListener('input', (e) => {
            block.content.color = e.target.value;
            recordEditorHistory({ immediate: false });
            renderBuilderCanvas();
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
