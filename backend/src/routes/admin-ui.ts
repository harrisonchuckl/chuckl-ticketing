// backend/src/routes/admin-ui.ts
import { Router, Request, Response } from "express";

const router = Router();

router.get("/ui", (_req: Request, res: Response) => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chuckl. Admin</title>
<style>
  :root { color-scheme: dark; }
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:#0b0b10;color:#e8ebf7}
  .wrap{max-width:1100px;margin:0 auto;padding:16px}
  .card{background:#141724;border:1px solid #22263a;border-radius:14px;padding:16px;margin-bottom:14px}
  h1{font-size:22px;margin:0 0 12px}
  h2{font-size:18px;margin:0 0 8px}
  label{display:block;font-size:12px;color:#9aa0b5;margin:10px 0 6px}
  input,select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2a2f46;background:#0f1220;color:#e8ebf7;font-size:15px}
  .row{display:flex;gap:10px;flex-wrap:wrap}
  .col{flex:1 1 260px}
  button{appearance:none;border:0;border-radius:10px;padding:10px 12px;background:#4053ff;color:#fff;font-weight:600;cursor:pointer}
  button.secondary{background:#2a2f46}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{border-bottom:1px solid #22263a;padding:8px 6px;text-align:left;font-size:14px}
  .muted{color:#9aa0b5}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #2a2f46;background:#0f1220}
  details{margin-top:10px}
  summary{cursor:pointer;list-style:none}
  summary::-webkit-details-marker{display:none}
  .toast{position:fixed;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:10px;font-weight:600}
  .toast.ok{background:#0f5132;color:#d1f7e3;border:1px solid #115e3a}
  .toast.err{background:#511f20;color:#ffd7d9;border:1px solid #6a2a2c}
  .hidden{display:none}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Chuckl. Admin</h1>
      <div class="row">
        <div class="col">
          <label>Admin Key</label>
          <input id="adminkey" type="text" placeholder="enter your admin key"/>
        </div>
        <div class="col" style="align-self:flex-end">
          <button id="loadShowsBtn">Load latest shows</button>
        </div>
      </div>
      <p class="muted" id="hint">Shows load from /admin/shows/latest (limit 20). Use your admin key to authenticate requests.</p>
    </div>

    <div class="card">
      <h2>Shows</h2>
      <div id="shows"></div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script>
    const toast = document.getElementById('toast');
    function showToast(msg, ok=true, ms=2200){
      toast.textContent = msg;
      toast.className = 'toast ' + (ok ? 'ok' : 'err');
      toast.classList.remove('hidden');
      setTimeout(()=> toast.classList.add('hidden'), ms);
    }

    const adminkeyEl = document.getElementById('adminkey');
    const loadBtn = document.getElementById('loadShowsBtn');
    const showsEl = document.getElementById('shows');

    async function api(path, opts={}){
      const key = adminkeyEl.value.trim();
      const headers = Object.assign({ 'Content-Type':'application/json' }, opts.headers || {});
      if (key) headers['x-admin-key'] = key;
      const r = await fetch(path, { ...opts, headers });
      const j = await r.json().catch(()=>({error:true,message:'Invalid JSON'}));
      if (!r.ok || j.error) throw new Error(j.message || ('HTTP ' + r.status));
      return j;
    }

    function el(tag, attrs={}, children=[]){
      const n = document.createElement(tag);
      for (const [k,v] of Object.entries(attrs)){
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else n.setAttribute(k, v);
      }
      for (const c of children){
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else if (c) n.appendChild(c);
      }
      return n;
    }

    function money(pence){
      return '£' + (Number(pence || 0)/100).toFixed(2);
    }

    async function loadShows(){
      showsEl.innerHTML = '<p class="muted">Loading…</p>';
      try {
        // Uses your existing admin list endpoint. If your route differs, adjust here:
        // e.g. '/admin/shows/latest?limit=20'
        const data = await api('/admin/shows/latest?limit=20', { method: 'GET' });

        const wrap = el('div');
        (data.shows || data.items || []).forEach((s) => {
          wrap.appendChild(renderShowCard(s));
        });
        showsEl.innerHTML = '';
        showsEl.appendChild(wrap);
      } catch (e){
        showsEl.innerHTML = '<p class="muted">Failed to load shows. Check your admin key and endpoint.</p>';
      }
    }

    function renderShowCard(show){
      const card = el('div', { class: 'card' });

      const title = el('div', { class: 'row' }, [
        el('div', { class: 'col' }, [
          el('div', { html: '<strong>' + (show.title || '(Untitled)') + '</strong>' }),
          el('div', { class: 'muted' }, [
            (new Date(show.date)).toLocaleString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
          ])
        ]),
        el('div', { class: 'col' }, [
          el('div', { class: 'muted' }, [
            'Venue: ' + (show.venue?.name || '—')
          ])
        ])
      ]);

      const details = el('details');
      const sum = el('summary', {}, [ 'Ticket Types' ]);
      const body = el('div');

      details.appendChild(sum);
      details.appendChild(body);

      // Load ticket types when expanded
      details.addEventListener('toggle', async () => {
        if (!details.open) return;
        body.innerHTML = '<p class="muted">Loading ticket types…</p>';
        try {
          const data = await api('/admin/shows/' + show.id + '/tickets', { method: 'GET' });
          body.innerHTML = '';
          body.appendChild(renderTicketsTable(data.show.ticketTypes || []));
          body.appendChild(renderTicketCreateForm(show.id, () => details.dispatchEvent(new Event('toggle'))));
        } catch (e){
          body.innerHTML = '<p class="muted">Failed to load ticket types.</p>';
        }
      }, { once: true });

      card.appendChild(title);
      card.appendChild(details);
      return card;
    }

    function renderTicketsTable(items){
      const table = el('table');
      const thead = el('thead');
      thead.appendChild(el('tr', {}, [
        el('th', {}, ['Name']),
        el('th', {}, ['Price']),
        el('th', {}, ['Available']),
        el('th', {}, ['Actions'])
      ]));
      const tbody = el('tbody');

      items.forEach((t) => {
        const tr = el('tr');
        const name = el('input', { value: t.name || '' });
        const price = el('input', { value: String(t.pricePence || 0), type: 'number', min: '0', step: '1' });
        const avail = el('input', { value: t.available === null || t.available === undefined ? '' : String(t.available), type: 'number', min: '0', step: '1', placeholder: 'null = unlimited' });

        tr.appendChild(el('td', {}, [ name ]));
        tr.appendChild(el('td', {}, [ price ]));
        tr.appendChild(el('td', {}, [ avail ]));

        const actions = el('td');
        const saveBtn = el('button', {}, ['Save']);
        const delBtn = el('button', { class: 'secondary', style: 'margin-left:6px' }, ['Delete']);

        saveBtn.addEventListener('click', async () => {
          try {
            await api('/admin/tickets/' + t.id, {
              method: 'PUT',
              body: JSON.stringify({
                name: name.value,
                pricePence: Number(price.value || 0),
                available: avail.value === '' ? null : Number(avail.value || 0)
              })
            });
            showToast('Ticket type updated');
          } catch (e){
            showToast('Failed to update: ' + e.message, false);
          }
        });

        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete this ticket type?')) return;
          try {
            await api('/admin/tickets/' + t.id, { method: 'DELETE' });
            showToast('Ticket type deleted');
            tr.remove();
          } catch (e){
            showToast('Failed to delete: ' + e.message, false);
          }
        });

        actions.appendChild(saveBtn);
        actions.appendChild(delBtn);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });

      table.appendChild(thead);
      table.appendChild(tbody);
      return table;
    }

    function renderTicketCreateForm(showId, onReload){
      const box = el('div', { class: 'card' });
      box.appendChild(el('h2', {}, ['Add Ticket Type']));

      const name = el('input', { placeholder: 'Name (e.g. General Admission)' });
      const price = el('input', { placeholder: 'Price in pence (e.g. 2500 = £25.00)', type: 'number', min: '0', step: '1' });
      const avail = el('input', { placeholder: 'Available qty (leave blank for unlimited)', type: 'number', min: '0', step: '1' });

      const row = el('div', { class: 'row' }, [
        el('div', { class: 'col' }, [ el('label', {}, ['Name']), name ]),
        el('div', { class: 'col' }, [ el('label', {}, ['Price (pence)']), price ]),
        el('div', { class: 'col' }, [ el('label', {}, ['Available (optional)']), avail ]),
      ]);

      const add = el('button', {}, ['Add Ticket Type']);
      add.addEventListener('click', async () => {
        try {
          await api('/admin/shows/' + showId + '/tickets', {
            method: 'POST',
            body: JSON.stringify({
              name: name.value,
              pricePence: Number(price.value || 0),
              available: avail.value === '' ? null : Number(avail.value || 0)
            })
          });
          showToast('Ticket type added');
          if (typeof onReload === 'function') onReload();
        } catch (e){
          showToast('Failed to add: ' + e.message, false);
        }
      });

      box.appendChild(row);
      box.appendChild(el('div', { style: 'margin-top:8px' }, [ add ]));
      return box;
    }

    // Wire up
    loadBtn.addEventListener('click', loadShows);
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
