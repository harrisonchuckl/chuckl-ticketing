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

const API_BASE = '/admin/marketing/api';

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

function fetchJson(url, opts = {}) {
  console.log('[marketing-suite] fetch', url, opts.body || null);
  return fetch(url, { credentials: 'include', ...opts }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
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
        const data = await fetchJson(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
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
}

async function renderCampaignCreate() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaign builder...</div>';

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
}

async function renderCampaignDetail(campaignId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaign...</div>';
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
}

async function renderTemplateEditor(templateId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading editor...</div>';

  const [templateData, versionsData, showsData] = await Promise.all([
    fetchJson(`${API_BASE}/templates/${templateId}`),
    fetchJson(`${API_BASE}/templates/${templateId}/versions`),
    fetchJson('/admin/shows'),
  ]);
  const template = templateData.template;
  const versions = versionsData.versions || [];
  appState.shows = showsData.items || [];

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
      <div class="ms-grid cols-2" style="margin-top:16px;">
        ${renderFormRow('Name', `<input id="ms-template-name" value="${escapeHtml(template.name)}" />`)}
        ${renderFormRow('Subject', `<input id="ms-template-subject" value="${escapeHtml(template.subject)}" />`)}
        ${renderFormRow('Preview text', `<input id="ms-template-preview-text" value="${escapeHtml(template.previewText || '')}" />`)}
        ${renderFormRow('From name', `<input id="ms-template-from-name" value="${escapeHtml(template.fromName || '')}" />`)}
        ${renderFormRow('From email', `<input id="ms-template-from-email" value="${escapeHtml(template.fromEmail || '')}" />`)}
        ${renderFormRow('Reply-to', `<input id="ms-template-reply-to" value="${escapeHtml(template.replyTo || '')}" />`)}
      </div>
      <div id="ms-template-tabs" style="margin-top:16px;">
        ${renderTabs([
          {
            id: 'edit',
            label: 'Edit MJML',
            content: `
              <div class="ms-grid cols-3">
                <div class="ms-card" style="grid-column:span 2;">
                  <textarea id="ms-template-mjml" style="width:100%;min-height:320px;">${escapeHtml(
                    template.mjmlBody || '<mjml><mj-body></mj-body></mjml>'
                  )}</textarea>
                </div>
                <div class="ms-card">
                  <h3>Merge tags</h3>
                  <div class="ms-muted">Click to insert into the editor.</div>
                  <div class="ms-merge-tags">
                    ${mergeTags
                      .map((tag) => `<button class="ms-secondary" data-tag="${tag.value}">${tag.group}: ${tag.label}</button>`)
                      .join('')}
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

  document.querySelectorAll('[data-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      const tag = button.getAttribute('data-tag');
      const textarea = document.getElementById('ms-template-mjml');
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      textarea.value = `${text.substring(0, start)}${tag}${text.substring(end)}`;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    });
  });

  async function saveTemplate() {
    const payload = {
      name: document.getElementById('ms-template-name').value,
      subject: document.getElementById('ms-template-subject').value,
      previewText: document.getElementById('ms-template-preview-text').value,
      fromName: document.getElementById('ms-template-from-name').value,
      fromEmail: document.getElementById('ms-template-from-email').value,
      replyTo: document.getElementById('ms-template-reply-to').value,
      mjmlBody: document.getElementById('ms-template-mjml').value,
    };
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
}

async function renderSegments() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading segments...</div>';
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
}

async function renderSegmentDetail(segmentId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading segment...</div>';
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
}

async function renderContacts() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading contacts...</div>';
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
}

async function renderContactDetail(contactId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading contact...</div>';
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
}

async function renderAutomations() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading automations...</div>';
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
      main.innerHTML = `
        <div class="ms-card">
          <h2>Deliverability</h2>
          <div class="ms-banner">You don’t have access to Deliverability settings. Ask an Admin.</div>
        </div>
      `;
      return;
    }
    main.innerHTML = `<div class="ms-card">${renderEmptyState('Deliverability data unavailable', 'Check your permissions or try again later.', '', '')}</div>`;
  }
}

async function renderSettings() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading settings...</div>';
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

function getRoute() {
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const initialPath = String(window.__MS_PATH__ || '').replace(/\/$/, '');
  return currentPath || initialPath || '/admin/marketing';
}

async function renderRoute() {
  const path = getRoute();
  const highlight =
    path.startsWith('/admin/marketing/campaigns')
      ? '/admin/marketing/campaigns'
      : path.startsWith('/admin/marketing/templates/')
        ? '/admin/marketing/templates'
        : path.startsWith('/admin/marketing/automations/')
          ? '/admin/marketing/automations'
          : path;
  renderShell(highlight);
  loadStatus();

  try {
    if (path === '/admin/marketing') return renderHome();
    if (path === '/admin/marketing/campaigns') return renderCampaigns();
    if (path === '/admin/marketing/campaigns/new') return renderCampaignCreate();
    if (path === '/admin/marketing/templates') return renderTemplates();
    if (path === '/admin/marketing/segments') return renderSegments();
    if (path === '/admin/marketing/contacts') return renderContacts();
    if (path === '/admin/marketing/automations') return renderAutomations();
    if (path === '/admin/marketing/analytics') return renderAnalytics();
    if (path === '/admin/marketing/deliverability') return renderDeliverability();
    if (path === '/admin/marketing/settings') return renderSettings();

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
      const message = error?.message || 'Unable to load this page.';
      main.innerHTML = `
        <div class="ms-card">
          <h2>Unable to load</h2>
          <div class="ms-muted">${escapeHtml(message)}</div>
        </div>
      `;
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

renderRoute();
