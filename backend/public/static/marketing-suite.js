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

const appState = {
  status: null,
  templates: [],
  segments: [],
  automations: [],
  campaigns: [],
  contacts: [],
  shows: [],
};

function fetchJson(url, opts = {}) {
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

function navigateTo(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  renderRoute();
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
          <div class="ms-search"><input type="search" placeholder="Search campaigns, templates, contacts..." /></div>
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
}

async function loadStatus() {
  const statusEl = document.getElementById('ms-status');
  if (!statusEl) return;
  try {
    const data = await fetchJson('/admin/api/marketing/status');
    const verified = data.verifiedStatus || 'UNVERIFIED';
    const sender = data.senderConfigured ? 'Ready' : 'Sender missing';
    statusEl.textContent = `${sender} • ${verified}`;
  } catch (error) {
    statusEl.textContent = 'Status unavailable';
  }
}

function renderCard(title, body) {
  return `<div class="ms-card"><h2>${title}</h2><div class="ms-muted">${body}</div></div>`;
}

async function renderHome() {
  const main = document.getElementById('ms-main');
  main.innerHTML = `
    <div class="ms-grid cols-3">
      ${renderCard('Campaigns', 'Create campaign journeys, schedule, and send.')}
      ${renderCard('Templates', 'Design email templates with the visual editor.')}
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

function emptyState(message) {
  return `<div class="ms-empty">${message}</div>`;
}

async function renderCampaigns() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading campaigns...</div>';
  const data = await fetchJson('/admin/api/marketing/campaigns');
  appState.campaigns = data.items || [];
  if (!appState.campaigns.length) {
    main.innerHTML = `<div class="ms-card">${emptyState('No campaigns yet. Use Create to start a campaign.')}</div>`;
    return;
  }
  const rows = appState.campaigns
    .map((item) => {
      const status = item.status || 'DRAFT';
      const schedule = item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : '—';
      const sentAt = item.sentAt ? new Date(item.sentAt).toLocaleString() : '—';
      return `
        <tr>
          <td>${item.name}</td>
          <td><span class="ms-pill">${status}</span></td>
          <td>${item.segment?.name || '—'}</td>
          <td>${item.template?.name || '—'}</td>
          <td>${schedule}</td>
          <td>${sentAt}</td>
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

async function renderTemplates() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading templates...</div>';
  const data = await fetchJson('/admin/api/marketing/templates');
  appState.templates = data.items || [];
  if (!appState.templates.length) {
    main.innerHTML = `<div class="ms-card">${emptyState('No templates yet. Use Create to add a template.')}</div>`;
    return;
  }
  const rows = appState.templates
    .map((item) => {
      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.subject}</td>
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
          <div class="ms-muted">Design and manage email templates.</div>
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

async function renderSegments() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading segments...</div>';
  const data = await fetchJson('/admin/api/marketing/segments');
  appState.segments = data.items || [];
  if (!appState.segments.length) {
    main.innerHTML = `<div class="ms-card">${emptyState('No segments yet.')}</div>`;
    return;
  }
  const rows = appState.segments
    .map((item) => {
      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.description || '—'}</td>
          <td>${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
        </tr>
      `;
    })
    .join('');
  main.innerHTML = `
    <div class="ms-card">
      <h2>Segments</h2>
      <div class="ms-muted">Audience slices for targeted campaigns.</div>
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
}

async function renderContacts() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading contacts...</div>';
  const data = await fetchJson('/admin/api/marketing/contacts');
  appState.contacts = data.items || [];
  if (!appState.contacts.length) {
    main.innerHTML = `<div class="ms-card">${emptyState('No contacts found.')}</div>`;
    return;
  }
  const rows = appState.contacts
    .slice(0, 50)
    .map((item) => {
      return `
        <tr>
          <td>${item.email}</td>
          <td>${item.firstName || '—'} ${item.lastName || ''}</td>
          <td>${item.status || '—'}</td>
        </tr>
      `;
    })
    .join('');
  main.innerHTML = `
    <div class="ms-card">
      <h2>Contacts</h2>
      <div class="ms-muted">Audience records and subscriptions.</div>
      <table class="ms-table" style="margin-top:16px;">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function renderAutomations() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading automations...</div>';
  const data = await fetchJson('/admin/api/marketing/automations');
  appState.automations = data.items || [];
  if (!appState.automations.length) {
    main.innerHTML = `<div class="ms-card">${emptyState('No automations yet. Use Create to build one.')}</div>`;
    return;
  }
  const rows = appState.automations
    .map((item) => {
      return `
        <tr>
          <td>${item.name}</td>
          <td>${item.triggerType}</td>
          <td>${item.isEnabled ? 'Enabled' : 'Paused'}</td>
          <td><a class="ms-secondary" href="/admin/marketing/automations/${item.id}/builder">Open builder</a></td>
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
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  const createBtn = document.getElementById('ms-create-automation');
  if (createBtn) createBtn.addEventListener('click', openAutomationCreator);
}

async function renderAnalytics() {
  const main = document.getElementById('ms-main');
  main.innerHTML = `
    <div class="ms-card">
      <h2>Analytics</h2>
      <div class="ms-muted">Dashboards are on the way. Use legacy analytics for now.</div>
      <a class="ms-secondary" href="/admin/ui/marketing" style="margin-top:12px;display:inline-block;">Open legacy analytics</a>
    </div>
  `;
}

async function renderDeliverability() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading deliverability...</div>';
  try {
    const data = await fetchJson('/admin/api/marketing/deliverability/summary?days=30');
    main.innerHTML = `
      <div class="ms-card">
        <h2>Deliverability</h2>
        <div class="ms-muted">30-day summary</div>
        <div class="ms-grid cols-3" style="margin-top:16px;">
          ${renderCard('Sent', data.sent || 0)}
          ${renderCard('Opened', data.opened || 0)}
          ${renderCard('Clicked', data.clicked || 0)}
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
    main.innerHTML = `<div class="ms-card">${emptyState('Deliverability data unavailable.')}</div>`;
  }
}

async function renderSettings() {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading settings...</div>';
  const data = await fetchJson('/admin/api/marketing/brand-settings');
  const brand = data.brand || {};

  main.innerHTML = `
    <div class="ms-card">
      <h2>Brand settings</h2>
      <div class="ms-muted">Defaults applied to the email editor.</div>
      <div class="ms-field"><label>Logo URL</label><input id="ms-brand-logo" value="${brand.logoUrl || ''}" /></div>
      <div class="ms-field"><label>Default font</label><input id="ms-brand-font" value="${brand.defaultFont || ''}" /></div>
      <div class="ms-field"><label>Primary colour</label><input id="ms-brand-color" value="${brand.primaryColor || ''}" /></div>
      <div class="ms-field"><label>Button radius</label><input id="ms-brand-radius" type="number" value="${brand.buttonRadius || ''}" /></div>
      <div class="ms-toolbar">
        <button class="ms-primary" id="ms-save-brand">Save brand settings</button>
        <a class="ms-secondary" href="/admin/ui/email?legacy=1">Open legacy Email Campaigns</a>
      </div>
    </div>
  `;

  const saveBtn = document.getElementById('ms-save-brand');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await fetchJson('/admin/api/marketing/brand-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: document.getElementById('ms-brand-logo').value,
          defaultFont: document.getElementById('ms-brand-font').value,
          primaryColor: document.getElementById('ms-brand-color').value,
          buttonRadius: document.getElementById('ms-brand-radius').value,
        }),
      });
      alert('Brand settings saved.');
    });
  }
}

function openModal(contentHtml) {
  const modal = document.createElement('div');
  modal.className = 'ms-modal';
  modal.innerHTML = `<div class="ms-card">${contentHtml}</div>`;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
  return modal;
}

async function openTemplateCreator() {
  const modal = openModal(`
    <h2>Create template</h2>
    <div class="ms-field"><label>Name</label><input id="ms-template-name" /></div>
    <div class="ms-field"><label>Subject</label><input id="ms-template-subject" /></div>
    <div class="ms-field"><label>From name</label><input id="ms-template-from-name" /></div>
    <div class="ms-field"><label>From email</label><input id="ms-template-from-email" /></div>
    <div class="ms-toolbar">
      <button class="ms-primary" id="ms-template-create">Create</button>
      <button class="ms-secondary" id="ms-template-cancel">Cancel</button>
    </div>
  `);

  modal.querySelector('#ms-template-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#ms-template-create').addEventListener('click', async () => {
    const name = modal.querySelector('#ms-template-name').value;
    const subject = modal.querySelector('#ms-template-subject').value;
    const fromName = modal.querySelector('#ms-template-from-name').value;
    const fromEmail = modal.querySelector('#ms-template-from-email').value;

    const response = await fetchJson('/admin/api/marketing/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        subject,
        fromName,
        fromEmail,
        editorType: 'GRAPESJS',
        mjmlBody: '<mjml><mj-body></mj-body></mjml>',
      }),
    });
    modal.remove();
    window.location.href = `/admin/marketing/templates/${response.template.id}/edit`;
  });
}

async function openSegmentCreator() {
  const modal = openModal(`
    <h2>Create segment</h2>
    <div class="ms-field"><label>Name</label><input id="ms-segment-name" /></div>
    <div class="ms-field"><label>Description</label><textarea id="ms-segment-description"></textarea></div>
    <div class="ms-toolbar">
      <button class="ms-primary" id="ms-segment-create">Create</button>
      <button class="ms-secondary" id="ms-segment-cancel">Cancel</button>
    </div>
  `);

  modal.querySelector('#ms-segment-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#ms-segment-create').addEventListener('click', async () => {
    await fetchJson('/admin/api/marketing/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modal.querySelector('#ms-segment-name').value,
        description: modal.querySelector('#ms-segment-description').value,
        rules: { rules: [] },
      }),
    });
    modal.remove();
    renderSegments();
  });
}

async function openAutomationCreator() {
  const modal = openModal(`
    <h2>Create automation</h2>
    <div class="ms-field"><label>Name</label><input id="ms-automation-name" /></div>
    <div class="ms-field">
      <label>Trigger type</label>
      <select id="ms-automation-trigger">
        <option value="AFTER_PURCHASE">After purchase</option>
        <option value="DAYS_BEFORE_SHOW">Days before show</option>
        <option value="VIEWED_NO_PURCHASE">Viewed but no purchase</option>
        <option value="MONTHLY_ROUNDUP">Monthly roundup</option>
        <option value="LOW_SALES_VELOCITY">Low sales velocity</option>
      </select>
    </div>
    <div class="ms-toolbar">
      <button class="ms-primary" id="ms-automation-create">Create</button>
      <button class="ms-secondary" id="ms-automation-cancel">Cancel</button>
    </div>
  `);

  modal.querySelector('#ms-automation-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#ms-automation-create').addEventListener('click', async () => {
    const response = await fetchJson('/admin/api/marketing/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: modal.querySelector('#ms-automation-name').value,
        triggerType: modal.querySelector('#ms-automation-trigger').value,
      }),
    });
    modal.remove();
    window.location.href = `/admin/marketing/automations/${response.automation.id}/builder`;
  });
}

async function openCampaignWizard() {
  const segments = (await fetchJson('/admin/api/marketing/segments')).items || [];
  const templates = (await fetchJson('/admin/api/marketing/templates')).items || [];
  const shows = (await fetchJson('/admin/shows')).items || [];

  const state = {
    step: 0,
    name: '',
    type: 'ONE_OFF',
    showId: '',
    segmentId: segments[0]?.id || '',
    templateId: templates[0]?.id || '',
    sendNow: true,
    scheduledFor: '',
  };

  const modal = openModal('');

  function renderStep() {
    const steps = [
      `
        <h2>Campaign basics</h2>
        <div class="ms-field"><label>Campaign name</label><input id="ms-campaign-name" value="${state.name}" /></div>
        <div class="ms-field">
          <label>Type</label>
          <select id="ms-campaign-type">
            <option value="ONE_OFF" ${state.type === 'ONE_OFF' ? 'selected' : ''}>One-off</option>
            <option value="SHOW_REMINDER" ${state.type === 'SHOW_REMINDER' ? 'selected' : ''}>Show reminder</option>
            <option value="ROUNDUP" ${state.type === 'ROUNDUP' ? 'selected' : ''}>Roundup</option>
            <option value="ANNOUNCEMENT" ${state.type === 'ANNOUNCEMENT' ? 'selected' : ''}>Announcement</option>
          </select>
        </div>
      `,
      `
        <h2>Select show (optional)</h2>
        <div class="ms-field">
          <label>Show</label>
          <select id="ms-campaign-show">
            <option value="">No show</option>
            ${shows.map((show) => `<option value="${show.id}" ${state.showId === show.id ? 'selected' : ''}>${show.title}</option>`).join('')}
          </select>
        </div>
      `,
      `
        <h2>Select segment</h2>
        <div class="ms-field">
          <label>Segment</label>
          <select id="ms-campaign-segment">
            ${segments.map((segment) => `<option value="${segment.id}" ${state.segmentId === segment.id ? 'selected' : ''}>${segment.name}</option>`).join('')}
          </select>
        </div>
      `,
      `
        <h2>Select template</h2>
        <div class="ms-field">
          <label>Template</label>
          <select id="ms-campaign-template">
            ${templates.map((template) => `<option value="${template.id}" ${state.templateId === template.id ? 'selected' : ''}>${template.name}</option>`).join('')}
          </select>
        </div>
      `,
      `
        <h2>Schedule</h2>
        <div class="ms-field">
          <label><input type="checkbox" id="ms-campaign-send-now" ${state.sendNow ? 'checked' : ''} /> Send now</label>
        </div>
        <div class="ms-field"><label>Schedule time</label><input id="ms-campaign-scheduled" type="datetime-local" value="${state.scheduledFor}" /></div>
      `,
    ];

    modal.querySelector('.ms-card').innerHTML = `
      ${steps[state.step]}
      <div class="ms-toolbar" style="margin-top:16px;justify-content:space-between;">
        <button class="ms-secondary" id="ms-campaign-back" ${state.step === 0 ? 'disabled' : ''}>Back</button>
        <div>
          <button class="ms-secondary" id="ms-campaign-cancel">Cancel</button>
          <button class="ms-primary" id="ms-campaign-next">${state.step === steps.length - 1 ? 'Create' : 'Next'}</button>
        </div>
      </div>
    `;

    modal.querySelector('#ms-campaign-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#ms-campaign-back').addEventListener('click', () => {
      state.step = Math.max(0, state.step - 1);
      captureInputs();
      renderStep();
    });
    modal.querySelector('#ms-campaign-next').addEventListener('click', async () => {
      captureInputs();
      if (state.step < steps.length - 1) {
        state.step += 1;
        renderStep();
        return;
      }
      const campaign = await fetchJson('/admin/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name || 'New campaign',
          type: state.type,
          showId: state.showId || null,
          segmentId: state.segmentId,
          templateId: state.templateId,
        }),
      });
      await fetchJson(`/admin/api/marketing/campaigns/${campaign.campaign.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendNow: state.sendNow,
          scheduledFor: state.sendNow ? null : state.scheduledFor,
        }),
      });
      modal.remove();
      renderCampaigns();
    });
  }

  function captureInputs() {
    const nameInput = modal.querySelector('#ms-campaign-name');
    const typeInput = modal.querySelector('#ms-campaign-type');
    const showInput = modal.querySelector('#ms-campaign-show');
    const segmentInput = modal.querySelector('#ms-campaign-segment');
    const templateInput = modal.querySelector('#ms-campaign-template');
    const sendNowInput = modal.querySelector('#ms-campaign-send-now');
    const scheduledInput = modal.querySelector('#ms-campaign-scheduled');

    if (nameInput) state.name = nameInput.value;
    if (typeInput) state.type = typeInput.value;
    if (showInput) state.showId = showInput.value;
    if (segmentInput) state.segmentId = segmentInput.value;
    if (templateInput) state.templateId = templateInput.value;
    if (sendNowInput) state.sendNow = sendNowInput.checked;
    if (scheduledInput) state.scheduledFor = scheduledInput.value;
  }

  renderStep();
}

async function renderTemplateEditor(templateId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading editor...</div>';

  const data = await fetchJson(`/admin/api/marketing/templates/${templateId}`);
  const template = data.template;
  const brand = (await fetchJson('/admin/api/marketing/brand-settings')).brand || {};
  const primaryColor = brand.primaryColor || '#4f46e5';
  const buttonRadius = brand.buttonRadius || 8;

  main.innerHTML = `
    <div class="ms-editor-shell">
      <div class="ms-editor-toolbar">
        <a class="ms-secondary" href="/admin/marketing/templates">Back to Templates</a>
        <button class="ms-primary" id="ms-save-template">Save</button>
        <button class="ms-secondary" id="ms-preview-desktop">Desktop</button>
        <button class="ms-secondary" id="ms-preview-mobile">Mobile</button>
        <button class="ms-secondary" id="ms-compile-template">Compile</button>
        <button class="ms-secondary" id="ms-test-template">Send Test</button>
        <select id="ms-merge-tags" class="ms-secondary">
          <option value="">Insert merge tag</option>
          ${mergeTags
            .map((tag) => `<option value="${tag.value}">${tag.group}: ${tag.label}</option>`)
            .join('')}
        </select>
      </div>
      <div id="ms-editor"></div>
    </div>
  `;

  const editor = window.grapesjs.init({
    container: '#ms-editor',
    height: '100%',
    fromElement: false,
    storageManager: false,
    selectorManager: { componentFirst: true },
  });

  editor.BlockManager.add('text', {
    label: 'Text',
    content: '<p>Write your copy here</p>',
  });
  editor.BlockManager.add('heading', {
    label: 'Heading',
    content: '<h1>Headline</h1>',
  });
  editor.BlockManager.add('image', {
    label: 'Image',
    content: '<img src="https://via.placeholder.com/600x300" alt="" />',
  });
  editor.BlockManager.add('button', {
    label: 'Button',
    content: `<a style="display:inline-block;padding:12px 18px;background:${primaryColor};color:#fff;border-radius:${buttonRadius}px;text-decoration:none;">Button</a>`,
  });
  editor.BlockManager.add('divider', {
    label: 'Divider',
    content: '<hr style="border:none;border-top:1px solid #e2e8f0;" />',
  });
  editor.BlockManager.add('spacer', {
    label: 'Spacer',
    content: '<div style="height:24px"></div>',
  });
  editor.BlockManager.add('social', {
    label: 'Social',
    content: '<div>Follow us: <a href="#">Instagram</a> • <a href="#">TikTok</a></div>',
  });
  editor.BlockManager.add('footer', {
    label: 'Footer',
    content: '<div style="font-size:12px;color:#64748b;">Thanks for staying in touch.</div>',
  });

  if (template.editorStateJson?.projectData) {
    editor.loadProjectData(template.editorStateJson.projectData);
  } else if (template.editorStateJson?.html) {
    editor.setComponents(template.editorStateJson.html);
    editor.setStyle(template.editorStateJson.css || '');
  }

  if (!template.editorStateJson) {
    editor.setComponents('<div style="padding:24px;font-family:system-ui;">Start designing your email template.</div>');
  }

  if (brand.defaultFont) {
    editor.getWrapper().setStyle({ 'font-family': brand.defaultFont });
  }

  function buildEditorState() {
    return {
      projectData: editor.getProjectData(),
      html: editor.getHtml(),
      css: editor.getCss(),
    };
  }

  async function saveTemplate() {
    const editorState = buildEditorState();
    await fetchJson(`/admin/api/marketing/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editorType: 'GRAPESJS',
        editorStateJson: editorState,
      }),
    });
    return editorState;
  }

  document.getElementById('ms-save-template').addEventListener('click', async () => {
    await saveTemplate();
    alert('Template saved.');
  });

  document.getElementById('ms-preview-desktop').addEventListener('click', () => {
    editor.setDevice('Desktop');
  });

  document.getElementById('ms-preview-mobile').addEventListener('click', () => {
    editor.setDevice('Mobile');
  });

  document.getElementById('ms-merge-tags').addEventListener('change', (event) => {
    const value = event.target.value;
    event.target.value = '';
    if (!value) return;
    const selected = editor.getSelected();
    if (selected) {
      selected.append(value);
    } else {
      editor.addComponents(`<span>${value}</span>`);
    }
  });

  document.getElementById('ms-compile-template').addEventListener('click', async () => {
    const editorState = await saveTemplate();
    await fetchJson(`/admin/api/marketing/templates/${templateId}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editorStateJson: editorState }),
    });
    alert('Compiled HTML saved.');
  });

  document.getElementById('ms-test-template').addEventListener('click', async () => {
    const email = prompt('Send test to email address:');
    if (!email) return;
    await fetchJson(`/admin/api/marketing/templates/${templateId}/test-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    alert('Test email sent.');
  });

  setInterval(() => {
    saveTemplate().catch(() => {});
  }, 30000);
}

async function renderAutomationBuilder(automationId) {
  const main = document.getElementById('ms-main');
  main.innerHTML = '<div class="ms-card">Loading builder...</div>';
  const [automationData, templateData] = await Promise.all([
    fetchJson(`/admin/api/marketing/automations/${automationId}`),
    fetchJson('/admin/api/marketing/templates'),
  ]);
  const automation = automationData.automation;
  const templates = templateData.items || [];

  main.innerHTML = `
    <div class="ms-card">
      <div class="ms-toolbar" style="justify-content:space-between;">
        <div>
          <h2>${automation.name}</h2>
          <div class="ms-muted">Automation flow builder</div>
        </div>
        <div class="ms-toolbar">
          <button class="ms-secondary" id="ms-flow-save">Save</button>
          <button class="ms-secondary" id="ms-flow-validate">Validate</button>
          <button class="ms-secondary" id="ms-flow-generate">Generate steps</button>
          <button class="ms-primary" id="ms-flow-simulate">Simulate today</button>
        </div>
      </div>
      <div id="ms-flow-root" style="height:70vh;margin-top:16px;border:1px solid var(--ms-border);border-radius:16px;overflow:hidden;"></div>
      <div id="ms-flow-errors" class="ms-muted" style="margin-top:12px;"></div>
    </div>
  `;

  const React = await import('https://esm.sh/react@18');
  const ReactDOM = await import('https://esm.sh/react-dom@18/client');
  const ReactFlow = await import('https://esm.sh/reactflow@11');

  const { useState, useCallback } = React;
  const { ReactFlow: Flow, Background, Controls, MiniMap, addEdge } = ReactFlow;

  const initialNodes = automation.flowJson?.nodes || [
    { id: 'trigger', type: 'trigger', position: { x: 100, y: 80 }, data: { triggerType: automation.triggerType } },
  ];
  const initialEdges = automation.flowJson?.edges || [];

  function Builder() {
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [selected, setSelected] = useState(null);

    const onNodesChange = useCallback((changes) => setNodes((nds) => ReactFlow.applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes) => setEdges((eds) => ReactFlow.applyEdgeChanges(changes, eds)), []);
    const onConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), []);

    const addNode = (type) => {
      const id = `${type}_${Date.now()}`;
      setNodes((nds) => nds.concat({ id, type, position: { x: 150, y: nds.length * 120 + 80 }, data: {} }));
    };

    const updateSelected = (field, value) => {
      if (!selected) return;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== selected.id) return node;
          return { ...node, data: { ...node.data, [field]: value } };
        })
      );
    };

    window.__flowState = { nodes, edges };

    return React.createElement(
      'div',
      { style: { display: 'flex', gap: '16px' } },
      React.createElement(
        'div',
        { style: { flex: 1, height: '70vh' } },
        React.createElement(
          Flow,
          {
            nodes,
            edges,
            onNodesChange,
            onEdgesChange,
            onConnect,
            onNodeClick: (_evt, node) => setSelected(node),
            fitView: true,
          },
          React.createElement(Background, null),
          React.createElement(Controls, null),
          React.createElement(MiniMap, null)
        )
      ),
      React.createElement(
        'div',
        { style: { width: '280px' } },
        React.createElement('h3', null, 'Node settings'),
        selected
          ? React.createElement(
              'div',
              null,
              React.createElement('div', { className: 'ms-field' },
                React.createElement('label', null, 'Type'),
                React.createElement('input', { value: selected.type || '', disabled: true })
              ),
              selected.type === 'trigger' &&
                React.createElement('div', { className: 'ms-field' },
                  React.createElement('label', null, 'Trigger type'),
                  React.createElement(
                    'select',
                    {
                      value: selected.data?.triggerType || automation.triggerType,
                      onChange: (e) => updateSelected('triggerType', e.target.value),
                    },
                    ['AFTER_PURCHASE', 'DAYS_BEFORE_SHOW', 'VIEWED_NO_PURCHASE', 'MONTHLY_ROUNDUP', 'LOW_SALES_VELOCITY'].map((type) =>
                      React.createElement('option', { value: type, key: type }, type)
                    )
                  )
                ),
              selected.type === 'delay' &&
                React.createElement('div', { className: 'ms-field' },
                  React.createElement('label', null, 'Delay (minutes)'),
                  React.createElement('input', {
                    type: 'number',
                    value: selected.data?.delayMinutes || 0,
                    onChange: (e) => updateSelected('delayMinutes', e.target.value),
                  })
                ),
              selected.type === 'sendEmail' &&
                React.createElement('div', { className: 'ms-field' },
                  React.createElement('label', null, 'Template'),
                  React.createElement(
                    'select',
                    {
                      value: selected.data?.templateId || '',
                      onChange: (e) => updateSelected('templateId', e.target.value),
                    },
                    React.createElement('option', { value: '' }, 'Select template'),
                    templates.map((template) => React.createElement('option', { value: template.id, key: template.id }, template.name))
                  )
                ),
              selected.type === 'tag' &&
                React.createElement('div', { className: 'ms-field' },
                  React.createElement('label', null, 'Tag name'),
                  React.createElement('input', {
                    value: selected.data?.tagName || '',
                    onChange: (e) => updateSelected('tagName', e.target.value),
                  })
                )
            )
          : React.createElement('div', { className: 'ms-muted' }, 'Select a node to configure it.'),
        React.createElement(
          'div',
          { className: 'ms-toolbar', style: { marginTop: '16px', flexWrap: 'wrap' } },
          ['trigger', 'delay', 'sendEmail', 'branch', 'tag', 'notify', 'stop'].map((type) =>
            React.createElement(
              'button',
              {
                key: type,
                className: 'ms-secondary',
                onClick: () => addNode(type),
              },
              `Add ${type}`
            )
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('ms-flow-root'));
  root.render(React.createElement(Builder));

  document.getElementById('ms-flow-save').addEventListener('click', async () => {
    await fetchJson(`/admin/api/marketing/automations/${automationId}/flow`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.__flowState),
    });
    alert('Flow saved.');
  });

  document.getElementById('ms-flow-validate').addEventListener('click', async () => {
    const response = await fetchJson(`/admin/api/marketing/automations/${automationId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.__flowState),
    });
    const errors = response.errors || [];
    document.getElementById('ms-flow-errors').textContent =
      errors.length ? errors.map((err) => err.message).join(' | ') : 'Flow looks valid.';
  });

  document.getElementById('ms-flow-generate').addEventListener('click', async () => {
    await fetchJson(`/admin/api/marketing/automations/${automationId}/flow/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(window.__flowState),
    });
    alert('Steps generated from flow.');
  });

  document.getElementById('ms-flow-simulate').addEventListener('click', async () => {
    const response = await fetchJson(`/admin/api/marketing/automations/${automationId}/simulate`, {
      method: 'POST',
    });
    const sample = response.sample || [];
    document.getElementById('ms-flow-errors').textContent = `Simulation: ${response.total} contacts. Sample: ${sample
      .map((c) => c.email)
      .join(', ')}`;
  });
}

function getRoute() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path || '/admin/marketing';
}

async function renderRoute() {
  const path = getRoute();
  renderShell(path.startsWith('/admin/marketing/templates/') ? '/admin/marketing/templates' : path.startsWith('/admin/marketing/automations/') ? '/admin/marketing/automations' : path);
  await loadStatus();

  if (path === '/admin/marketing') return renderHome();
  if (path === '/admin/marketing/campaigns') return renderCampaigns();
  if (path === '/admin/marketing/templates') return renderTemplates();
  if (path === '/admin/marketing/segments') return renderSegments();
  if (path === '/admin/marketing/contacts') return renderContacts();
  if (path === '/admin/marketing/automations') return renderAutomations();
  if (path === '/admin/marketing/analytics') return renderAnalytics();
  if (path === '/admin/marketing/deliverability') return renderDeliverability();
  if (path === '/admin/marketing/settings') return renderSettings();

  const templateMatch = path.match(/\/admin\/marketing\/templates\/([^/]+)\/edit/);
  if (templateMatch) return renderTemplateEditor(templateMatch[1]);

  const automationMatch = path.match(/\/admin\/marketing\/automations\/([^/]+)\/builder/);
  if (automationMatch) return renderAutomationBuilder(automationMatch[1]);

  return renderHome();
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
