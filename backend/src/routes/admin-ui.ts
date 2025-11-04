// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/ui', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1080px;margin:0 auto;padding:16px}
  h1{font-size:22px;margin:0 0 12px}
  h2{font-size:18px;margin:14px 0 8px;color:#c9d1ff}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px;margin-bottom:14px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  label{font-size:12px;color:#9aa0b5}
  input[type=text], input[type=datetime-local]{width:100%;max-width:360px;padding:10px 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:14px}
  button{appearance:none;border:0;border-radius:10px;padding:10px 12px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  button.ghost{background:transparent;border:1px solid #2a2f46}
  .grid{display:grid;gap:10px}
  .grid.cols-2{grid-template-columns:1fr 1fr}
  .grid.cols-3{grid-template-columns:1fr 1fr 1fr}
  .list{display:grid;gap:10px}
  .item{background:#0f1220;border:1px solid #22263a;border-radius:12px;padding:12px}
  .muted{color:#9aa0b5;font-size:12px}
  .pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#22263a;color:#cfd6ff;font-size:12px;margin-left:6px}
  .right{margin-left:auto}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600;display:none}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0}
  .spacer{height:8px}
  .badge{background:#22263a;color:#cfd6ff;border-radius:8px;padding:4px 8px;font-size:12px}
  .inline{display:inline-flex;gap:8px;align-items:center}
  .align-end{align-items:flex-end}
  .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin Dashboard</h1>
      <div class="toolbar">
        <div>
          <label>Admin Key</label><br/>
          <input id="adminkey" type="text" placeholder="enter x-admin-key"/>
        </div>
        <button id="saveKeyBtn" class="secondary">Save Key</button>
        <button id="copyKeyBtn" class="ghost">Copy Key</button>
        <span class="badge">Health: <span id="health">checking…</span></span>
      </div>
    </div>

    <!-- Shows & Filters -->
    <div class="card">
      <h2>Shows</h2>
      <div class="toolbar">
        <div>
          <label>Search</label><br/>
          <input id="search" type="text" placeholder="filter by title / venue…"/>
        </div>
        <div>
          <label>From date</label><br/>
          <input id="fromDate" type="datetime-local"/>
        </div>
        <div>
          <label>&nbsp;</label><br/>
          <button id="loadShowsBtn">Load latest shows</button>
          <button id="clearFiltersBtn" class="secondary">Clear filters</button>
        </div>
        <span class="right muted">Tip: set your Admin Key once, it persists in this browser.</span>
      </div>

      <div id="showList" class="list"></div>
    </div>

    <!-- Global Scan Stats -->
    <div class="card">
      <h2>Scan Stats (Global)</h2>
      <div class="toolbar">
        <button id="refreshStatsBtn">Refresh</button>
        <span class="muted">Reads from <code class="mono">/scan/stats</code> with your Admin Key.</span>
      </div>
      <div class="grid cols-3">
        <div class="item">
          <div class="muted">Checked-in</div>
          <div id="statChecked" style="font-size:20px;font-weight:700">–</div>
        </div>
        <div class="item">
          <div class="muted">Remaining</div>
          <div id="statRemaining" style="font-size:20px;font-weight:700">–</div>
        </div>
        <div class="item">
          <div class="muted">Total</div>
          <div id="statTotal" style="font-size:20px;font-weight:700">–</div>
        </div>
      </div>
    </div>

    <!-- Brand Emails -->
    <div class="card">
      <h2>Emails</h2>
      <div class="grid cols-2">
        <div class="item">
          <div class="row align-end">
            <div>
              <label>Send Test Email (via /admin/email/test)</label><br/>
              <input id="testEmailTo" type="text" placeholder="name@domain.com"/>
            </div>
            <button id="sendTestBtn" class="right">Send Test</button>
          </div>
          <div class="spacer"></div>
          <div class="muted">Uses Resend / SMTP / console depending on your server config.</div>
        </div>

        <div class="item">
          <div class="row align-end">
            <div>
              <label>Resend Order Email</label><br/>
              <input id="orderId" type="text" placeholder="Order ID (e.g. cmh099ci3…)" />
            </div>
            <button id="resendOrderBtn" class="right">Resend</button>
          </div>
          <div class="spacer"></div>
          <div class="muted">Calls <code class="mono">/admin/order/:id/resend</code> — your existing endpoint.</div>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="card">
      <h2>Quick Links</h2>
      <div class="row">
        <button id="openScannerBtn">Open Scanner</button>
        <span class="muted">Opens <code class="mono">/scan</code> with your Admin Key prefilled.</span>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const $ = (sel)=> document.querySelector(sel);
    const adminkeyEl = $('#adminkey');
    const healthEl = $('#health');
    const toast = $('#toast');

    const searchEl = $('#search');
    const fromDateEl = $('#fromDate');
    const showList = $('#showList');

    const statChecked = $('#statChecked');
    const statRemaining = $('#statRemaining');
    const statTotal = $('#statTotal');

    const loadShowsBtn = $('#loadShowsBtn');
    const clearFiltersBtn = $('#clearFiltersBtn');
    const refreshStatsBtn = $('#refreshStatsBtn');
    const sendTestBtn = $('#sendTestBtn');
    const resendOrderBtn = $('#resendOrderBtn');
    const openScannerBtn = $('#openScannerBtn');
    const saveKeyBtn = $('#saveKeyBtn');
    const copyKeyBtn = $('#copyKeyBtn');

    const testEmailTo = $('#testEmailTo');
    const orderIdEl = $('#orderId');

    function showToast(msg, ok=true, ms=5000){
      toast.textContent = msg;
      toast.className = 'toast ' + (ok?'ok':'err');
      toast.style.display = 'block';
      setTimeout(()=> toast.style.display = 'none', ms);
    }

    function getKey(){
      return (adminkeyEl.value || '').trim();
    }
    function ensureKey(){
      const k = getKey();
      if(!k){ showToast('Enter your Admin Key first', false); }
      return !!k;
    }
    function saveKey(){
      const k = getKey();
      if(!k){ showToast('Nothing to save – enter a key', false); return; }
      localStorage.setItem('chuckl_admin_key', k);
      showToast('Admin Key saved');
    }
    function restoreKey(){
      const k = localStorage.getItem('chuckl_admin_key') || '';
      if(k){ adminkeyEl.value = k; }
    }
    async function copyKey(){
      try{
        await navigator.clipboard.writeText(getKey());
        showToast('Key copied to clipboard');
      }catch(e){
        showToast('Could not copy key', false);
      }
    }

    async function checkHealth(){
      try{
        const r = await fetch('/health');
        healthEl.textContent = r.ok ? 'ok' : 'down';
      }catch(e){
        healthEl.textContent = 'down';
      }
    }

    function fmtWhen(isoOrDate){
      const d = new Date(isoOrDate);
      return d.toLocaleString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    }

    function venueLine(v){
      if(!v) return '';
      const bits = [v.name, v.address, v.city, v.postcode].filter(Boolean).join(', ');
      return bits;
    }

    function renderShows(shows){
      showList.innerHTML = '';
      if(!Array.isArray(shows) || shows.length === 0){
        showList.innerHTML = '<div class="muted">No shows found.</div>';
        return;
      }
      for(const s of shows){
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = \`
          <div class="row">
            <div>
              <div style="font-weight:700">\${s.title}</div>
              <div class="muted">\${fmtWhen(s.date)}\${s.venue ? ' — ' + venueLine(s.venue) : ''}</div>
            </div>
            <span class="right inline">
              <button class="secondary" data-open-scanner>Open Scanner</button>
            </span>
          </div>
        \`;
        // open scanner with key prefill
        div.querySelector('[data-open-scanner]').addEventListener('click', ()=>{
          const k = getKey();
          if(!k){ showToast('Enter Admin Key first', false); return; }
          const url = new URL('/scan', window.location.origin);
          // we persist key in localStorage; scanner UI will read it if coded to
          localStorage.setItem('chuckl_admin_key', k);
          window.open(url.toString(), '_blank');
        });
        showList.appendChild(div);
      }
    }

    async function loadShows(){
      if(!ensureKey()) return;
      try{
        const k = getKey();
        const params = new URLSearchParams();
        const q = searchEl.value.trim();
        if(q) params.set('q', q);
        const fd = fromDateEl.value.trim();
        if(fd) params.set('from', new Date(fd).toISOString());

        const url = '/admin/shows' + (params.toString()? ('?' + params.toString()) : '');
        const r = await fetch(url, { headers: { 'x-admin-key': k }});
        const data = await r.json();
        if(!r.ok || data.error){ throw new Error(data.message || 'Failed to load shows'); }
        renderShows(data.shows || []);
      }catch(e){
        showToast(e.message || 'Error loading shows', false);
      }
    }

    async function refreshScanStats(){
      if(!ensureKey()) return;
      try{
        const k = getKey();
        const r = await fetch('/scan/stats', { headers: { 'x-admin-key': k }});
        const data = await r.json();
        if(!r.ok || data.error){ throw new Error(data.message || 'Failed to load stats'); }
        statChecked.textContent = data.checkedIn ?? '0';
        statRemaining.textContent = data.remaining ?? '0';
        statTotal.textContent = data.total ?? '0';
      }catch(e){
        showToast(e.message || 'Error loading stats', false);
      }
    }

    async function sendTestEmail(){
      if(!ensureKey()) return;
      const to = (testEmailTo.value || '').trim();
      if(!to){ showToast('Enter a recipient email', false); return; }
      try{
        const k = getKey();
        const r = await fetch('/admin/email/test', {
          method:'POST',
          headers: { 'Content-Type':'application/json', 'x-admin-key': k },
          body: JSON.stringify({ to })
        });
        const data = await r.json();
        if(!r.ok || data.error){ throw new Error(data.message || 'Failed to send'); }
        showToast('Test email sent via ' + (data.provider || 'provider'));
      }catch(e){
        showToast(e.message || 'Email error', false);
      }
    }

    async function resendOrder(){
      if(!ensureKey()) return;
      const orderId = (orderIdEl.value || '').trim();
      if(!orderId){ showToast('Enter an Order ID', false); return; }
      try{
        const k = getKey();
        const r = await fetch('/admin/order/' + encodeURIComponent(orderId) + '/resend', {
          method:'POST',
          headers: { 'Content-Type':'application/json', 'x-admin-key': k }
        });
        const data = await r.json();
        if(!r.ok || data.error){ throw new Error(data.message || 'Failed to resend'); }
        showToast('Resent order email' + (data.to ? (' to ' + data.to) : ''));
      }catch(e){
        showToast(e.message || 'Resend error', false);
      }
    }

    // Events
    saveKeyBtn.addEventListener('click', saveKey);
    copyKeyBtn.addEventListener('click', copyKey);
    loadShowsBtn.addEventListener('click', loadShows);
    clearFiltersBtn.addEventListener('click', ()=>{ searchEl.value=''; fromDateEl.value=''; loadShows(); });
    refreshStatsBtn.addEventListener('click', refreshScanStats);
    sendTestBtn.addEventListener('click', sendTestEmail);
    resendOrderBtn.addEventListener('click', resendOrder);
    openScannerBtn.addEventListener('click', ()=>{
      const k = getKey();
      if(!k){ showToast('Enter Admin Key first', false); return; }
      localStorage.setItem('chuckl_admin_key', k);
      window.open('/scan', '_blank');
    });

    // Init
    restoreKey();
    checkHealth();
    loadShows();
    refreshScanStats();
    setInterval(refreshScanStats, 10000);
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
