// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:14px}
  h1{font-size:22px;margin:0 0 12px}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  input[type=text],input[type=datetime-local]{flex:1;min-width:220px;height:40px;padding:0 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  button{height:40px;padding:0 12px;border-radius:10px;border:0;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  .tabs{display:flex;gap:8px;margin:12px 0}
  .tab{padding:8px 12px;border-radius:10px;border:1px solid #22263a;background:#0f1220;cursor:pointer}
  .tab.active{background:#4053ff;border-color:#4053ff}
  .muted{color:#9aa0b5}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{padding:10px;border-bottom:1px solid #22263a;text-align:left;vertical-align:top}
  th{color:#9aa0b5;font-weight:600}
  .right{text-align:right}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #2a2f46;background:#0f1220}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
  .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .stat{background:#0f1220;border:1px solid #22263a;border-radius:10px;padding:10px}
  .stat small{display:block;color:#9aa0b5;font-size:12px;margin-bottom:4px}
  .bar{display:flex;gap:8px;align-items:center;justify-content:space-between}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="bar">
        <h1>Chuckl. Admin</h1>
        <div class="muted" id="status">ready</div>
      </div>

      <div class="row" style="margin-top:6px">
        <input id="adminkey" type="text" placeholder="x-admin-key (required)"/>
        <button id="saveKey" class="secondary">Save key</button>
        <a href="/scan" target="_blank"><button>Open scanner</button></a>
      </div>

      <div class="tabs">
        <div class="tab active" data-tab="shows">Shows</div>
        <div class="tab" data-tab="orders">Orders</div>
        <div class="tab" data-tab="tools">Tools</div>
      </div>

      <!-- Shows -->
      <div id="tab-shows">
        <div class="row">
          <button id="loadShows">Load latest shows</button>
        </div>
        <div id="showsArea" class="muted" style="margin-top:10px">No data yet.</div>
      </div>

      <!-- Orders -->
      <div id="tab-orders" class="hidden">
        <div class="row">
          <button id="loadOrders">Load latest orders</button>
          <input id="filterEmail" type="text" placeholder="filter by email (optional)"/>
        </div>
        <div id="ordersArea" class="muted" style="margin-top:10px">No data yet.</div>
      </div>

      <!-- Tools -->
      <div id="tab-tools" class="hidden">
        <div class="grid">
          <div class="stat"><small>Checked-in</small><div id="checked">–</div></div>
          <div class="stat"><small>Remaining</small><div id="remaining">–</div></div>
          <div class="stat"><small>Total</small><div id="total">–</div></div>
        </div>
        <div class="row" style="margin-top:10px">
          <button id="refreshStats" class="secondary">Refresh stats</button>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script>
    // --- Helpers ---
    const $ = (sel)=> document.querySelector(sel);
    const $$ = (sel)=> Array.from(document.querySelectorAll(sel));
    const statusEl = $('#status');
    const toast = $('#toast');
    const adminEl = $('#adminkey');
    const savedKey = localStorage.getItem('x-admin-key') || '';
    if (savedKey) adminEl.value = savedKey;

    function showToast(msg, ok=true, ms=3000){
      toast.textContent = msg;
      toast.className = 'toast ' + (ok ? 'ok' : 'err');
      toast.classList.remove('hidden');
      setTimeout(()=> toast.classList.add('hidden'), ms);
    }

    async function getJSON(url, opts={}){
      const key = adminEl.value.trim();
      const headers = Object.assign({'x-admin-key': key}, opts.headers||{});
      const r = await fetch(url, Object.assign({}, opts, { headers }));
      if (!r.ok) return { ok:false, error:'http_'+r.status };
      try { return await r.json(); } catch { return { ok:false, error:'bad_json' }; }
    }

    function money(pence){
      const v = (Number(pence||0)/100).toFixed(2);
      return '£'+v;
    }

    function prettyDate(iso){
      try { return new Date(iso).toLocaleString(); } catch { return iso || ''; }
    }

    // --- Tabs ---
    $$('.tab').forEach(t=>{
      t.addEventListener('click', ()=>{
        $$('.tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        const tab = t.getAttribute('data-tab');
        $('#tab-shows').classList.add('hidden');
        $('#tab-orders').classList.add('hidden');
        $('#tab-tools').classList.add('hidden');
        $('#tab-'+tab).classList.remove('hidden');
      });
    });

    // --- Save key ---
    $('#saveKey').addEventListener('click', ()=>{
      localStorage.setItem('x-admin-key', adminEl.value.trim());
      showToast('Admin key saved', true);
    });

    // --- Shows panel ---
    $('#loadShows').addEventListener('click', async ()=>{
      const r = await getJSON('/admin/bootstrap/ping'); // cheap auth check + router ping
      if (!r || r.ok !== true){ showToast('Auth failed', false); return; }

      // We don't have a shows list endpoint in admin router, so reuse the user-facing one:
      const events = await fetch('/events').then(x=>x.json()).catch(()=>null);
      const area = $('#showsArea');
      if (!events || !Array.isArray(events) || events.length===0){
        area.innerHTML = '<span class="muted">No shows found.</span>';
        return;
      }
      area.innerHTML = \`
        <table>
          <thead><tr>
            <th>Show</th><th>Date</th><th>Venue</th><th class="right">Actions</th>
          </tr></thead>
          <tbody>
            \${events.map(ev => \`
              <tr>
                <td>\${ev.title||'-'}</td>
                <td>\${prettyDate(ev.date)}</td>
                <td>\${ev.venue?.name||'-'}</td>
                <td class="right">
                  <button class="secondary" data-showid="\${ev.id}" data-act="stats">Load check-ins</button>
                  <a href="/scan" target="_blank"><button>Open scanner</button></a>
                </td>
              </tr>\`).join('')}
          </tbody>
        </table>\`;

      area.querySelectorAll('button[data-act="stats"]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const s = await getJSON('/scan/stats', { method:'GET' });
          if (s && s.ok){
            showToast(\`Checked-in \${s.checkedIn} / \${s.total}\`);
            // also update Tools tab cards
            document.getElementById('checked').textContent = s.checkedIn ?? '0';
            document.getElementById('remaining').textContent = s.remaining ?? '0';
            document.getElementById('total').textContent = s.total ?? '0';
          } else {
            showToast('Could not fetch stats', false);
          }
        });
      });
    });

    // --- Orders panel ---
    async function loadOrders(){
      const filterEmail = (document.getElementById('filterEmail').value||'').trim().toLowerCase();
      const area = document.getElementById('ordersArea');
      const r = await getJSON('/admin/orders?limit=50', { method:'GET' });
      if (!r || !r.orders || !Array.isArray(r.orders)){
        area.innerHTML = '<span class="muted">No orders.</span>';
        return;
      }
      let rows = r.orders;
      if (filterEmail) rows = rows.filter(o => (o.email||'').toLowerCase().includes(filterEmail));

      area.innerHTML = \`
        <table>
          <thead><tr>
            <th>When</th><th>Email</th><th>Show</th><th>Qty</th><th>Amount</th><th>Status</th><th class="right">Actions</th>
          </tr></thead>
          <tbody>
            \${rows.map(o => \`
              <tr>
                <td>\${prettyDate(o.createdAt)}</td>
                <td>\${o.email}</td>
                <td>\${o.show?.title||'-'}</td>
                <td>\${o.quantity}</td>
                <td>\${money(o.amountPence)}</td>
                <td><span class="pill">\${o.status}</span></td>
                <td class="right">
                  <button data-oid="\${o.id}" data-mail="\${o.email}" class="resend">Resend</button>
                </td>
              </tr>\`).join('')}
          </tbody>
        </table>\`;

      area.querySelectorAll('.resend').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-oid');
          const to = btn.getAttribute('data-mail') || '';
          if (!id) return;
          const rr = await getJSON(\`/admin/order/\${id}/resend\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to })
          });
          if (rr && rr.ok) showToast('Resent to ' + (rr.to||to));
          else showToast('Resend failed', false);
        });
      });
    }

    document.getElementById('loadOrders').addEventListener('click', loadOrders);
    document.getElementById('filterEmail').addEventListener('input', ()=> {
      // re-render quickly by calling loadOrders again (simple for now)
      loadOrders();
    });

    // --- Tools tab ---
    document.getElementById('refreshStats').addEventListener('click', async ()=>{
      const s = await getJSON('/scan/stats', { method:'GET' });
      if (s && s.ok){
        document.getElementById('checked').textContent = s.checkedIn ?? '0';
        document.getElementById('remaining').textContent = s.remaining ?? '0';
        document.getElementById('total').textContent = s.total ?? '0';
        showToast('Stats refreshed');
      } else {
        showToast('Could not fetch stats', false);
      }
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
