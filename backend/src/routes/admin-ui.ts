// backend/src/routes/admin-ui.ts
import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";

const router = Router();

/**
 * Single-page organiser console at /admin/ui*
 * NOTE: This file intentionally inlines HTML+JS in one template string.
 * Do not add extra backticks or ${...} inside the HTML.
 */
router.get(
  ["/ui", "/ui/", "/ui/home", "/ui/*"],
  requireAdminOrOrganiser,
  (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("html").send(
      "<!doctype html>" +
        '<html lang="en">' +
        "<head>" +
        '<meta charset="utf-8" />' +
        '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
        "<title>Organiser Console</title>" +
        "<style>" +
        ":root{--bg:#f7f8fb;--panel:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--ink:#111827;--seat-bg:#10b981;--seat-border:#022c22}" +
        "html,body{margin:0;padding:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg)}" +
        ".wrap{display:flex;min-height:100vh}" +
        ".sidebar{width:220px;background:#fff;border-right:1px solid var(--border);padding:16px 12px;position:sticky;top:0;height:100vh;box-sizing:border-box}" +
        ".sb-group{font-size:12px;letter-spacing:.04em;color:var(--muted);margin:14px 8px 6px;text-transform:uppercase}" +
        ".sb-link{display:block;padding:10px 12px;margin:4px 4px;border-radius:8px;color:#111827;text-decoration:none}" +
        ".sb-link.active,.sb-link:hover{background:#f1f5f9}" +
        ".sb-sub{margin-left:10px}" +
        ".content{flex:1;padding:20px}" +
        ".card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}" +
        ".header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}" +
        ".title{font-weight:600}" +
        ".muted{color:var(--muted)}" +
        ".btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}" +
        ".btn:hover{background:#f9fafb}" +
        ".btn.p{background:#111827;color:#fff;border-color:#111827}" +
        ".grid{display:grid;gap:8px}" +
        ".grid-2{grid-template-columns:repeat(2,1fr)}" +
        ".grid-3{grid-template-columns:repeat(3,1fr)}" +
        ".grid-4{grid-template-columns:repeat(4,1fr)}" +
        "input,select,textarea{border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fff;outline:none;font:inherit}" +
        "table{width:100%;border-collapse:collapse;font-size:14px}" +
        "th,td{text-align:left;padding:10px;border-bottom:1px solid var(--border)}" +
        "th{font-weight:600;color:#334155;background:#f8fafc}" +
        ".error{color:#b91c1c}" +
        ".drop{border:2px dashed #cbd5e1;border-radius:12px;padding:16px;text-align:center;color:#64748b;cursor:pointer}" +
        ".drop.drag{background:#f8fafc;border-color:#94a3b8}" +
        ".imgprev{max-height:140px;border:1px solid var(--border);border-radius:8px;display:none}" +
        ".progress{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden}" +
        ".bar{height:8px;background:#111827;width:0%}" +
        ".row{display:flex;gap:8px;align-items:center}" +
        ".row-between{display:flex;justify-content:space-between;align-items:center;gap:8px}" +
        ".kbd{font:12px/1 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}" +
        ".kebab{position:relative}" +
        ".menu{position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);display:none;min-width:160px;z-index:20}" +
        ".menu.open{display:block}" +
        ".menu a{display:block;padding:8px 10px;text-decoration:none;color:#111827}" +
        ".menu a:hover{background:#f8fafc}" +
        ".tip{font-size:12px;color:#64748b;margin-top:4px}" +
        ".pop{position:absolute;z-index:30;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);min-width:260px;display:none}" +
        ".pop.open{display:block}" +
        ".opt{padding:8px 10px;cursor:pointer}" +
        ".opt:hover{background:#f8fafc}" +
        ".pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid var(--border);background:#f9fafb}" +
        ".seat-layout-wrap{background:#020617;border-radius:12px;padding:16px;color:#e5e7eb;min-height:220px;display:flex;flex-direction:column;gap:12px}" +
        ".seat-stage{font-size:12px;text-align:center;letter-spacing:.12em;text-transform:uppercase;color:#e5e7eb}" +
        ".seat-stage-bar{margin-top:4px;height:6px;border-radius:999px;background:rgba(148,163,184,.35)}" +
        ".seat-grid{display:inline-grid;gap:4px;margin-top:4px}" +
        ".seat-row-label{align-self:center;margin-right:8px;font-size:12px;color:#e5e7eb}" +
        ".seat{width:18px;height:18px;border-radius:4px;background:var(--seat-bg);border:1px solid var(--seat-border);display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:transform .05s ease-out,box-shadow .05s ease-out}" +
        ".seat:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(0,0,0,.45)}" +
        ".seat-blocked{background:#0f172a;border-color:#0b1120}" +
        ".seat-held{background:#f59e0b;border-color:#92400e}" +
        ".seat-sold{background:#9ca3af;border-color:#4b5563;cursor:not-allowed}" +
        ".seat-selected{outline:2px solid #f97316;outline-offset:1px}" +
        ".seat-number-hidden span{opacity:0}" +
        ".seat-legend{font-size:12px;color:#e5e7eb;display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}" +
        ".seat-legend span{display:inline-flex;align-items:center;gap:4px}" +
        ".seat-dot{width:12px;height:12px;border-radius:3px;background:var(--seat-bg);border:1px solid var(--seat-border)}" +
        ".seat-dot.block{background:#0f172a;border-color:#0b1120}" +
        ".seat-dot.held{background:#f59e0b;border-color:#92400e}" +
        ".seat-dot.sold{background:#9ca3af;border-color:#4b5563}" +
        ".badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;background:#0f172a;color:#e5e7eb;border:1px solid #1e293b}" +
        "</style>" +
        "</head>" +
        "<body>" +
        '<div class="wrap">' +
        '<aside class="sidebar">' +
        '<div class="sb-group">Dashboard</div>' +
        '<a class="sb-link" href="/admin/ui/home" data-view="/admin/ui/home">Home</a>' +
        '<div class="sb-group">Manage</div>' +
        "<div>" +
        '<a class="sb-link" href="#" id="showsToggle">Shows ▾</a>' +
        '<div id="showsSub" class="sb-sub" style="display:none">' +
        '<a class="sb-link" href="/admin/ui/shows/create" data-view="/admin/ui/shows/create">Create show</a>' +
        '<a class="sb-link" href="/admin/ui/shows/current" data-view="/admin/ui/shows/current">All events</a>' +
        "</div>" +
        "</div>" +
        '<a class="sb-link" href="/admin/ui/orders" data-view="/admin/ui/orders">Orders</a>' +
        '<a class="sb-link" href="/admin/ui/venues" data-view="/admin/ui/venues">Venues</a>' +
        '<div class="sb-group">Insights</div>' +
        '<a class="sb-link" href="/admin/ui/analytics" data-view="/admin/ui/analytics">Analytics</a>' +
        '<div class="sb-group">Marketing</div>' +
        '<a class="sb-link" href="/admin/ui/audiences" data-view="/admin/ui/audiences">Audiences</a>' +
        '<a class="sb-link" href="/admin/ui/email" data-view="/admin/ui/email">Email Campaigns</a>' +
        '<div class="sb-group">Settings</div>' +
        '<a class="sb-link" href="/admin/ui/account" data-view="/admin/ui/account">Account</a>' +
        '<a class="sb-link" href="/auth/logout">Log out</a>' +
        "</aside>" +
        '<main class="content" id="main"><div class="card"><div class="title">Loading…</div></div></main>' +
        "</div>" +
        "<script>" +
        "(function(){" +
        "var $=function(s,r){return (r||document).querySelector(s);};" +
        "var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};" +
        "var main=$('#main');" +

        // sidebar
        "var showsToggle=$('#showsToggle');" +
        "var showsSub=$('#showsSub');" +
        "if(showsToggle&&showsSub){" +
        "showsToggle.addEventListener('click',function(e){e.preventDefault();showsSub.style.display=showsSub.style.display==='none'?'block':'none';});" +
        "}" +

        "function setActive(path){" +
        "$$('.sb-link').forEach(function(a){" +
        "a.classList.toggle('active',a.getAttribute('data-view')===path);" +
        "});" +
        "}" +

        "async function j(url,opts){" +
        "var r=await fetch(url,Object.assign({credentials:'include'},opts||{}));" +
        "var bodyText='';" +
        "try{bodyText=await r.text();}catch(e){}" +
        "if(!r.ok){throw new Error(bodyText||('HTTP '+r.status));}" +
        "try{return bodyText?JSON.parse(bodyText):{};}catch(e){return {};}" +
        "}" +

        "function go(path){history.pushState(null,'',path);route();}" +

        "document.addEventListener('click',function(e){" +
        "var t=e.target;" +
        "var a=t&&t.closest?t.closest('a.sb-link'):null;" +
        "if(a&&a.getAttribute('data-view')){" +
        "e.preventDefault();" +
        "go(a.getAttribute('data-view'));" +
        "}" +
        "});" +

        "window.addEventListener('popstate',route);" +

        "function route(){" +
        "var path=location.pathname.replace(/\\/$/,'');" +
        "setActive(path);" +
        "if(path==='/admin/ui'||path==='/admin/ui/home'||path==='/admin/ui/index.html'){home();return;}" +
        "if(path==='/admin/ui/shows/create'){createShow();return;}" +
        "if(path==='/admin/ui/shows/current'){listShows();return;}" +
        "if(path==='/admin/ui/orders'){orders();return;}" +
        "if(path==='/admin/ui/venues'){venues();return;}" +
        "if(path.indexOf('/admin/ui/shows/')===0&&path.slice(-7)==='/edit'){editShow(path.split('/')[4]);return;}" +
        "if(path.indexOf('/admin/ui/shows/')===0&&path.slice(-8)==='/tickets'){ticketsPage(path.split('/')[4]);return;}" +
        "if(path.indexOf('/admin/ui/shows/')===0&&path.slice(-8)==='/seating'){seatingPage(path.split('/')[4]);return;}" +
        "home();" +
        "}" +

        "function home(){" +
        "main.innerHTML='<div class=\"card\"><div class=\"title\">Welcome</div><div class=\"muted\">Use the menu to manage shows, venues and orders.</div></div>';}" +

        // VENUE SEARCH
        "async function searchVenues(q){" +
        "if(!q)return[];" +
        "try{var out=await j('/admin/venues?q='+encodeURIComponent(q));return out.items||[];}catch(e){return[];}" +
        "}" +

        "function mountVenuePicker(input){" +
        "if(!input)return;" +
        "var container=document.createElement('div');" +
        "container.style.position='relative';" +
        "input.parentNode.insertBefore(container,input);" +
        "container.appendChild(input);" +
        "var pop=document.createElement('div');" +
        "pop.className='pop';" +
        "container.appendChild(pop);" +
        "function close(){pop.classList.remove('open');}" +
        "function render(list,q){" +
        "pop.innerHTML='';" +
        "if(list.length){" +
        "list.forEach(function(v){" +
        "var el=document.createElement('div');" +
        "el.className='opt';" +
        "el.textContent=v.name+(v.city?' — '+v.city:'');" +
        "el.addEventListener('click',function(){" +
        "input.value=v.name;" +
        "input.dataset.venueId=v.id;" +
        "close();" +
        "});" +
        "pop.appendChild(el);" +
        "});" +
        "}" +
        "if(q&&!list.some(function(v){return(v.name||'').toLowerCase()===q.toLowerCase();})){" +
        "var add=document.createElement('div');" +
        "add.className='opt';" +
        "add.innerHTML='➕ Create venue “'+q+'”';" +
        "add.addEventListener('click',async function(){" +
        "try{" +
        "var created=await j('/admin/venues',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:q})});" +
        "if(created&&created.ok&&created.venue){" +
        "input.value=created.venue.name;" +
        "input.dataset.venueId=created.venue.id;" +
        "}else{alert('Failed to create venue');}" +
        "}catch(err){alert('Create failed: '+(err.message||err));}" +
        "close();" +
        "});" +
        "pop.appendChild(add);" +
        "}" +
        "if(pop.children.length){pop.classList.add('open');}else{close();}" +
        "}" +
        "input.addEventListener('input',async function(){" +
        "input.dataset.venueId='';" +
        "var q=input.value.trim();" +
        "if(!q){close();return;}" +
        "render(await searchVenues(q),q);" +
        "});" +
        "input.addEventListener('focus',async function(){" +
        "var q=input.value.trim();" +
        "if(!q)return;" +
        "render(await searchVenues(q),q);" +
        "});" +
        "document.addEventListener('click',function(e){" +
        "if(!pop.contains(e.target)&&e.target!==input)close();" +
        "});" +
        "}" +

        // upload helper
        "async function uploadPoster(file){" +
        "var form=new FormData();" +
        "form.append('file',file);" +
        "var res=await fetch('/admin/uploads',{method:'POST',body:form,credentials:'include'});" +
        "var txt=await res.text();" +
        "if(!res.ok)throw new Error(txt||('HTTP '+res.status));" +
        "var data=txt?JSON.parse(txt):{};" +
        "if(!data.ok||!data.url)throw new Error('Unexpected upload response');" +
        "return data;" +
        "}" +

        "function editorToolbarHtml(){" +
        "return '<div class=\"row\" style=\"gap:6px;margin-bottom:6px\"'+" +
        "'><button type=\"button\" class=\"btn\" data-cmd=\"bold\">B</button>'+" +
        "'<button type=\"button\" class=\"btn\" data-cmd=\"italic\"><span style=\"font-style:italic\">I</span></button>'+" +
        "'<button type=\"button\" class=\"btn\" data-cmd=\"underline\"><span style=\"text-decoration:underline\">U</span></button>'+" +
        "'<button type=\"button\" class=\"btn\" data-cmd=\"insertUnorderedList\">• List</button>'+" +
        "'<button type=\"button\" class=\"btn\" data-cmd=\"insertOrderedList\">1. List</button>'+" +
        "'</div>';}" +

        "function bindWysiwyg(container){" +
        "$$('[data-cmd]',container).forEach(function(b){" +
        "b.addEventListener('click',function(){" +
        "document.execCommand(b.getAttribute('data-cmd'));" +
        "});" +
        "});" +
        "}" +

        // CREATE SHOW
        "async function createShow(){" +
        "main.innerHTML=" +
        "'<div class=\"card\"'+" +
        "'><div class=\"header\"><div class=\"title\">Create show</div></div>'+" +
        "'<div class=\"grid grid-2\"'+" +
        "'><div class=\"grid\"><label>Title</label><input id=\"sh_title\" placeholder=\"e.g. Chuckl. Comedy Club\"/></div>'+" +
        "'<div class=\"grid\"><label>Date & time</label><input id=\"sh_dt\" type=\"datetime-local\"/></div>'+" +
        "'<div class=\"grid\"><label>Venue</label><input id=\"venue_input\" placeholder=\"Start typing a venue…\"/><div class=\"tip\">Pick an existing venue or just type a new one.</div></div>'+" +
        "'<div class=\"grid\"><label>Poster image</label><div id=\"drop\" class=\"drop\">Drop image here or click to choose</div><input id=\"file\" type=\"file\" accept=\"image/*\" style=\"display:none\"/><div class=\"progress\" style=\"margin-top:8px\"><div id=\"bar\" class=\"bar\"></div></div><div class=\"row\" style=\"margin-top:8px;gap:8px;align-items:center\"><img id=\"prev\" class=\"imgprev\" alt=\"\"/></div></div>'+" +
        "'</div>'+" +
        "'<div class=\"grid\" style=\"margin-top:10px\"><label>Description</label>'+editorToolbarHtml()+'<div id=\"desc\" data-editor contenteditable=\"true\" style=\"min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px\"></div><div class=\"muted\">Event description (required). Use the toolbar to format.</div></div>'+" +
        "'<div class=\"row\" style=\"margin-top:10px\"><button id=\"save\" class=\"btn p\">Save show and add tickets</button><div id=\"err\" class=\"error\"></div></div>'+" +
        "'</div>';"+
        "bindWysiwyg(main);" +
        "mountVenuePicker($('#venue_input'));" +
        "var drop=$('#drop'),file=$('#file'),bar=$('#bar'),prev=$('#prev');" +
        "if(drop&&file&&bar&&prev){" +
        "drop.addEventListener('click',function(){file.click();});" +
        "drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('drag');});" +
        "drop.addEventListener('dragleave',function(){drop.classList.remove('drag');});" +
        "drop.addEventListener('drop',async function(e){e.preventDefault();drop.classList.remove('drag');var f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)await doUpload(f);});" +
        "file.addEventListener('change',async function(){var f=file.files&&file.files[0];if(f)await doUpload(f);});" +
        "}" +

        "async function doUpload(f){" +
        "$('#err').textContent='';" +
        "bar.style.width='15%';" +
        "try{" +
        "var out=await uploadPoster(f);" +
        "prev.src=out.url;" +
        "prev.style.display='block';" +
        "bar.style.width='100%';" +
        "setTimeout(function(){bar.style.width='0%';},800);" +
        "}catch(e){bar.style.width='0%';$('#err').textContent='Upload failed: '+(e.message||e);}" +
        "}" +

        "$('#save').addEventListener('click',async function(){" +
        "$('#err').textContent='';" +
        "try{" +
        "var payload={" +
        "title:$('#sh_title').value.trim()," +
        "date:$('#sh_dt').value?new Date($('#sh_dt').value).toISOString():null," +
        "venueText:$('#venue_input').value.trim()," +
        "venueId:$('#venue_input').dataset.venueId||null," +
        "imageUrl:$('#prev').src||null," +
        "descriptionHtml:$('#desc').innerHTML.trim()" +
        "};" +
        "if(!payload.title||!payload.date||!payload.venueText||!payload.descriptionHtml){" +
        "throw new Error('Title, date/time, venue and description are required');" +
        "}" +
        "var r=await j('/admin/shows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});" +
        "if(r&&r.ok&&r.id){go('/admin/ui/shows/'+r.id+'/tickets');}else{throw new Error((r&&r.error)||'Failed to create show');}" +
        "}catch(e){$('#err').textContent=e.message||String(e);}" +
        "});" +
        "}" +

        // LIST SHOWS
        "async function listShows(){" +
        "main.innerHTML=" +
        "'<div class=\"card\"><div class=\"header\"><div class=\"title\">All events</div><button id=\"refresh\" class=\"btn\">Refresh</button></div><table><thead><tr><th>Title</th><th>When</th><th>Venue</th><th>Total allocation</th><th>Gross face</th><th>Status</th><th></th></tr></thead><tbody id=\"tbody\"></tbody></table></div>';"+
        "var tbody=$('#tbody');" +
        "async function load(){" +
        "tbody.innerHTML='<tr><td colspan=\"7\" class=\"muted\">Loading…</td></tr>';" +
        "try{" +
        "var jn=await j('/admin/shows');" +
        "var items=jn.items||[];" +
        "if(!items.length){tbody.innerHTML='<tr><td colspan=\"7\" class=\"muted\">No shows yet</td></tr>';return;}" +
        "tbody.innerHTML=items.map(function(s){" +
        "var when=s.date?new Date(s.date).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'}):'';" +
        "var total=(s._alloc&&s._alloc.total)||0;" +
        "var sold=(s._alloc&&s._alloc.sold)||0;" +
        "var hold=(s._alloc&&s._alloc.hold)||0;" +
        "var avail=Math.max(total-sold-hold,0);" +
        "var pct=total?Math.round((sold/total)*100):0;" +
        "var bar='<div style=\"background:#e5e7eb;height:6px;border-radius:999px;overflow:hidden;width:140px\"><div style=\"background:#111827;height:6px;width:'+pct+'%\"></div></div>';"+
        "return '<tr>'+" +
        "'<td>'+(s.title||'')+'</td>'+" +
        "'<td>'+when+'</td>'+" +
        "'<td>'+(s.venue?(s.venue.name+(s.venue.city?' – '+s.venue.city:'')):'')+'</td>'+" +
        "'<td><span class=\"muted\">Sold '+sold+' · Hold '+hold+' · Avail '+avail+'</span> '+bar+'</td>'+" +
        "'<td>£'+(((s._revenue&&s._revenue.grossFace)||0).toFixed(2))+'</td>'+" +
        "'<td>'+(s.status||'DRAFT')+'</td>'+" +
        "'<td><div class=\"kebab\"><button class=\"btn\" data-kebab=\"'+s.id+'\">⋮</button><div class=\"menu\" id=\"m-'+s.id+'\">'+" +
        "'<a href=\"#\" data-edit=\"'+s.id+'\">Edit</a>'+" +
        "'<a href=\"#\" data-seating=\"'+s.id+'\">Seating map</a>'+" +
        "'<a href=\"#\" data-tickets=\"'+s.id+'\">Tickets</a>'+" +
        "'<a href=\"#\" data-dup=\"'+s.id+'\">Duplicate</a>'+" +
        "'</div></div></td>'+" +
        "'</tr>';"+
        "}).join('');" +
        "$$('[data-kebab]').forEach(function(b){" +
        "b.addEventListener('click',function(e){e.preventDefault();var id=b.getAttribute('data-kebab');var m=$('#m-'+id);$$('.menu').forEach(function(x){x.classList.remove('open');});if(m)m.classList.add('open');});" +
        "});" +
        "document.addEventListener('click',function(e){if(!e.target.closest||!e.target.closest('.kebab')){$$('.menu').forEach(function(x){x.classList.remove('open');});}});" +
        "$$('[data-edit]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();go('/admin/ui/shows/'+a.getAttribute('data-edit')+'/edit');});});" +
        "$$('[data-seating]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();go('/admin/ui/shows/'+a.getAttribute('data-seating')+'/seating');});});" +
        "$$('[data-tickets]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();go('/admin/ui/shows/'+a.getAttribute('data-tickets')+'/tickets');});});" +
        "$$('[data-dup]').forEach(function(a){" +
        "a.addEventListener('click',async function(e){" +
        "e.preventDefault();" +
        "try{var id=a.getAttribute('data-dup');var r=await j('/admin/shows/'+id+'/duplicate',{method:'POST'});if(r.ok&&r.newId){go('/admin/ui/shows/'+r.newId+'/edit');}}" +
        "catch(err){alert('Duplicate failed: '+(err.message||err));}" +
        "});" +
        "});" +
        "}catch(e){" +
        "tbody.innerHTML='<tr><td colspan=\"7\" class=\"error\">Failed to load shows: '+(e.message||e)+'</td></tr>';}" +
        "}" +
        "$('#refresh').addEventListener('click',load);" +
        "load();" +
        "}" +

        // EDIT SHOW
        "async function editShow(id){" +
        "var s=null;" +
        "try{s=await j('/admin/shows/'+id);}catch(e){main.innerHTML='<div class=\"card\"><div class=\"error\">Failed to load show: '+(e.message||e)+'</div></div>';return;}" +
        "var item=s.item||{};" +
        "main.innerHTML=" +
        "'<div class=\"card\"><div class=\"header\"><div class=\"title\">Edit show</div></div>'+" +
        "'<div class=\"grid grid-2\">'+" +
        "'<div class=\"grid\"><label>Title</label><input id=\"sh_title\"/></div>'+" +
        "'<div class=\"grid\"><label>Date & time</label><input id=\"sh_dt\" type=\"datetime-local\"/></div>'+" +
        "'<div class=\"grid\"><label>Venue</label><input id=\"venue_input\"/></div>'+" +
        "'<div class=\"grid\"><label>Poster image</label><div class=\"drop\" id=\"drop\">Drop image here or click to choose</div><input id=\"file\" type=\"file\" accept=\"image/*\" style=\"display:none\"/><div class=\"progress\" style=\"margin-top:8px\"><div id=\"bar\" class=\"bar\"></div></div><img id=\"prev\" class=\"imgprev\"/></div>'+" +
        "'</div>'+" +
        "'<div class=\"grid\" style=\"margin-top:10px\"><label>Description</label>'+editorToolbarHtml()+'<div id=\"desc\" data-editor contenteditable=\"true\" style=\"min-height:120px;border:1px solid var(--border);border-radius:8px;padding:10px\"></div><div class=\"muted\">Event description (required). Use the toolbar to format.</div></div>'+" +
        "'<div class=\"row\" style=\"margin-top:10px\"><button id=\"save\" class=\"btn p\">Save changes</button><a class=\"btn\" href=\"#\" id=\"goSeating\">Seating map</a><a class=\"btn\" href=\"#\" id=\"goTickets\">Tickets</a><div id=\"err\" class=\"error\"></div></div>'+" +
        "'</div>';"+
        "bindWysiwyg(main);" +
        "mountVenuePicker($('#venue_input'));" +
        "$('#sh_title').value=item.title||'';" +
        "$('#venue_input').value=(item.venue&&item.venue.name)||item.venueText||'';" +
        "if(item.date){var dt=new Date(item.date);$('#sh_dt').value=dt.toISOString().slice(0,16);}" +
        "$('#desc').innerHTML=item.description||'';" +
        "if(item.imageUrl){$('#prev').src=item.imageUrl;$('#prev').style.display='block';}" +
        "var drop=$('#drop'),file=$('#file'),bar=$('#bar'),prev=$('#prev');" +
        "drop.addEventListener('click',function(){file.click();});" +
        "drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('drag');});" +
        "drop.addEventListener('dragleave',function(){drop.classList.remove('drag');});" +
        "drop.addEventListener('drop',async function(e){e.preventDefault();drop.classList.remove('drag');var f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f)await doUpload(f);});" +
        "file.addEventListener('change',async function(){var f=file.files&&file.files[0];if(f)await doUpload(f);});" +
        "async function doUpload(f){" +
        "$('#err').textContent='';bar.style.width='15%';" +
        "try{var out=await uploadPoster(f);prev.src=out.url;prev.style.display='block';bar.style.width='100%';setTimeout(function(){bar.style.width='0%';},800);}catch(e){bar.style.width='0%';$('#err').textContent='Upload failed: '+(e.message||e);}" +
        "}" +
        "$('#goSeating').addEventListener('click',function(e){e.preventDefault();go('/admin/ui/shows/'+id+'/seating');});" +
        "$('#goTickets').addEventListener('click',function(e){e.preventDefault();go('/admin/ui/shows/'+id+'/tickets');});" +
        "$('#save').addEventListener('click',async function(){" +
        "$('#err').textContent='';" +
        "try{" +
        "var payload={" +
        "title:$('#sh_title').value.trim()," +
        "date:$('#sh_dt').value?new Date($('#sh_dt').value).toISOString():null," +
        "venueText:$('#venue_input').value.trim()," +
        "venueId:$('#venue_input').dataset.venueId||null," +
        "imageUrl:$('#prev').src||null," +
        "descriptionHtml:$('#desc').innerHTML.trim()" +
        "};" +
        "if(!payload.title||!payload.date||!payload.venueText||!payload.descriptionHtml)throw new Error('Title, date/time, venue and description are required');" +
        "var r=await j('/admin/shows/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});" +
        "if(r&&r.ok){alert('Saved');}else{throw new Error((r&&r.error)||'Failed to save');}" +
        "}catch(e){$('#err').textContent=e.message||String(e);}" +
        "});" +
        "}" +

        // TICKETS PAGE
        "async function ticketsPage(id){" +
        "main.innerHTML='<div class=\"card\"><div class=\"title\">Loading tickets…</div></div>';"+
        "var showResp;" +
        "try{showResp=await j('/admin/shows/'+id);}catch(e){main.innerHTML='<div class=\"card\"><div class=\"error\">Failed to load show: '+(e.message||e)+'</div></div>';return;}" +
        "var show=showResp.item||{};" +
        "var when=show.date?new Date(show.date).toLocaleString('en-GB',{dateStyle:'full',timeStyle:'short'}):'';" +
        "var venueName=show.venue?(show.venue.name+(show.venue.city?' – '+show.venue.city:'')):(show.venueText||'');" +
        "main.innerHTML=" +
        "'<div class=\"card\">'+" +
        "'<div class=\"header\"><div><div class=\"title\">Tickets for '+(show.title||'Untitled show')+'</div><div class=\"muted\">'+(when?(when+' · '):'')+venueName+'</div></div><div class=\"row\"><button class=\"btn\" id=\"backToShows\">Back to all events</button><button class=\"btn\" id=\"editShowBtn\">Edit show</button></div></div>'+" +
        "'<div class=\"grid grid-2\" style=\"margin-bottom:16px\">'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Ticket structure</div><div class=\"muted\" style=\"margin-bottom:8px\">Tickets can be free (price £0) or paid, and can be sold as general admission or allocated seating.</div><div class=\"row\" style=\"margin-bottom:8px\"><span class=\"pill\" id=\"structureGeneral\">General admission</span><span class=\"pill\" id=\"structureAllocated\">Allocated seating</span></div><div class=\"muted\" style=\"font-size:12px\">Allocated seating uses a seating map for this venue. You can reuse an existing map or create a new one just for this show.</div></div>'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Seat maps for this show</div><div class=\"muted\" id=\"seatMapsSummary\">Loading seat maps…</div><div id=\"seatMapsList\" style=\"margin-top:8px\"></div><div class=\"row\" style=\"margin-top:8px\"><button class=\"btn\" id=\"refreshSeatMaps\">Refresh seat maps</button><button class=\"btn\" id=\"editSeatMaps\">Create / edit seat map</button></div></div>'+" +
        "'</div>'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"header\"><div class=\"title\">Ticket types</div><button class=\"btn\" id=\"addTypeBtn\">Add ticket type</button></div><div class=\"muted\" style=\"margin-bottom:8px\">Set up the tickets you want to sell for this show. A £0 price will be treated as a free ticket.</div><div id=\"ticketTypesEmpty\" class=\"muted\" style=\"display:none\">No ticket types yet. Use “Add ticket type” to create one.</div><table><thead><tr><th>Name</th><th>Price</th><th>Available</th><th></th></tr></thead><tbody id=\"ticketTypesBody\"><tr><td colspan=\"4\" class=\"muted\">Loading…</td></tr></tbody></table><div id=\"addTypeForm\" style=\"margin-top:12px;display:none\"><div class=\"grid grid-3\"><div class=\"grid\"><label>Name</label><input id=\"tt_name\" placeholder=\"e.g. Standard\"/></div><div class=\"grid\"><label>Price (£)</label><input id=\"tt_price\" type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"e.g. 15\"/></div><div class=\"grid\"><label>Available (optional)</label><input id=\"tt_available\" type=\"number\" min=\"0\" step=\"1\" placeholder=\"Leave blank for unlimited\"/></div></div><div class=\"row\" style=\"margin-top:8px\"><button class=\"btn p\" id=\"tt_save\">Save ticket type</button><button class=\"btn\" id=\"tt_cancel\">Cancel</button><div id=\"tt_err\" class=\"error\"></div></div></div></div>'+" +
        "'</div>';"+
        "$('#backToShows').addEventListener('click',function(){go('/admin/ui/shows/current');});" +
        "$('#editShowBtn').addEventListener('click',function(){go('/admin/ui/shows/'+id+'/edit');});" +
        "var addTypeForm=$('#addTypeForm');" +
        "var ticketTypesBody=$('#ticketTypesBody');" +
        "var ticketTypesEmpty=$('#ticketTypesEmpty');" +
        "$('#addTypeBtn').addEventListener('click',function(){addTypeForm.style.display='block';$('#tt_name').focus();});" +
        "$('#tt_cancel').addEventListener('click',function(){addTypeForm.style.display='none';$('#tt_err').textContent='';});" +
        "async function loadTicketTypes(){" +
        "try{" +
        "var res=await j('/admin/shows/'+id+'/ticket-types');" +
        "var items=res.ticketTypes||[];" +
        "if(!items.length){ticketTypesBody.innerHTML='<tr><td colspan=\"4\" class=\"muted\">No ticket types yet.</td></tr>';ticketTypesEmpty.style.display='block';}else{" +
        "ticketTypesEmpty.style.display='none';" +
        "ticketTypesBody.innerHTML=items.map(function(tt){" +
        "var price=(tt.pricePence||0)/100;" +
        "var priceLabel=price===0?'Free':'£'+price.toFixed(2);" +
        "var availLabel=tt.available==null?'Unlimited':String(tt.available);" +
        "return '<tr><td>'+(tt.name||'')+'</td><td>'+priceLabel+'</td><td>'+availLabel+'</td><td><button class=\"btn\" data-del=\"'+tt.id+'\">Delete</button></td></tr>';"+
        "}).join('');" +
        "$$('[data-del]',ticketTypesBody).forEach(function(btn){" +
        "btn.addEventListener('click',async function(e){" +
        "e.preventDefault();" +
        "var idToDel=btn.getAttribute('data-del');" +
        "if(!idToDel)return;" +
        "if(!confirm('Delete this ticket type?'))return;" +
        "try{await j('/admin/ticket-types/'+idToDel,{method:'DELETE'});loadTicketTypes();}catch(err){alert('Failed to delete: '+(err.message||err));}" +
        "});" +
        "});" +
        "}" +
        "}catch(e){ticketTypesBody.innerHTML='<tr><td colspan=\"4\" class=\"error\">Failed to load ticket types: '+(e.message||e)+'</td></tr>';}" +
        "}" +
        "$('#tt_save').addEventListener('click',async function(){" +
        "$('#tt_err').textContent='';" +
        "var name=$('#tt_name').value.trim();" +
        "var priceStr=$('#tt_price').value.trim();" +
        "var availStr=$('#tt_available').value.trim();" +
        "if(!name){$('#tt_err').textContent='Name is required';return;}" +
        "var pricePence=0;" +
        "if(priceStr){var p=Number(priceStr);if(!Number.isFinite(p)||p<0){$('#tt_err').textContent='Price must be a non-negative number';return;}pricePence=Math.round(p*100);}" +
        "var available=null;" +
        "if(availStr){var a=Number(availStr);if(!Number.isFinite(a)||a<0){$('#tt_err').textContent='Available must be a non-negative number';return;}available=a;}" +
        "try{" +
        "await j('/admin/shows/'+id+'/ticket-types',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,pricePence:pricePence,available:available})});" +
        "$('#tt_name').value='';$('#tt_price').value='';$('#tt_available').value='';addTypeForm.style.display='none';loadTicketTypes();" +
        "}catch(err){$('#tt_err').textContent=err.message||String(err);}" +
        "});" +
        "loadTicketTypes();" +

        // seat maps summary on tickets page
        "var seatMapsSummary=$('#seatMapsSummary');" +
        "var seatMapsList=$('#seatMapsList');" +
        "var venueId=(show.venue&&show.venue.id)||null;" +
        "async function loadSeatMaps(){" +
        "seatMapsSummary.textContent='Loading seat maps…';" +
        "seatMapsList.innerHTML='';" +
        "try{" +
        "var url='/admin/seatmaps?showId='+encodeURIComponent(id);" +
        "if(venueId)url+='&venueId='+encodeURIComponent(venueId);" +
        "var maps=await j(url);" +
        "if(!Array.isArray(maps)||!maps.length){" +
        "seatMapsSummary.textContent='No seat maps yet for this show/venue.';" +
        "seatMapsList.innerHTML='<div class=\"muted\" style=\"font-size:13px\">You can create a seat map using the “Create / edit seat map” button.</div>';return;" +
        "}" +
        "seatMapsSummary.textContent=maps.length+' seat map'+(maps.length>1?'s':'')+' found.';" +
        "seatMapsList.innerHTML=maps.map(function(m){" +
        "var def=m.isDefault?' · <strong>Default</strong>':'';" +
        "return '<div class=\"row\" style=\"margin-bottom:4px;justify-content:space-between\"><div><strong>'+m.name+'</strong> <span class=\"muted\">v'+(m.version||1)+'</span>'+def+'</div><div class=\"row\" style=\"gap:4px\">'+(!m.isDefault?'<button class=\"btn\" data-make-default=\"'+m.id+'\">Make default</button>':'')+'</div></div>';"+
        "}).join('');" +
        "$$('[data-make-default]',seatMapsList).forEach(function(btn){" +
        "btn.addEventListener('click',async function(e){" +
        "e.preventDefault();" +
        "var mapId=btn.getAttribute('data-make-default');" +
        "if(!mapId)return;" +
        "try{" +
        "await j('/admin/seatmaps/'+mapId+'/default',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isDefault:true})});" +
        "loadSeatMaps();" +
        "}catch(err){alert('Failed to update default: '+(err.message||err));}" +
        "});" +
        "});" +
        "}catch(e){seatMapsSummary.textContent='Failed to load seat maps.';seatMapsList.innerHTML='<div class=\"error\" style=\"font-size:13px\">'+(e.message||e)+'</div>';}" +
        "}" +
        "$('#refreshSeatMaps').addEventListener('click',loadSeatMaps);" +
        "$('#editSeatMaps').addEventListener('click',function(){go('/admin/ui/shows/'+id+'/seating');});" +
        "loadSeatMaps();" +
        "}" +

        // SEATING PAGE (with inspector + quick generator)
        "async function seatingPage(showId){" +
        "main.innerHTML='<div class=\"card\"><div class=\"title\">Loading seating…</div></div>';"+
        "var showResp;" +
        "try{showResp=await j('/admin/shows/'+showId);}catch(e){main.innerHTML='<div class=\"card\"><div class=\"error\">Failed to load show: '+(e.message||e)+'</div></div>';return;}" +
        "var show=showResp.item||{};" +
        "var when=show.date?new Date(show.date).toLocaleString('en-GB',{dateStyle:'full',timeStyle:'short'}):'';" +
        "var venueName=show.venue?(show.venue.name+(show.venue.city?' – '+show.venue.city:'')):(show.venueText||'');" +
        "var venueId=(show.venue&&show.venue.id)||null;" +
        "main.innerHTML=" +
        "'<div class=\"card\">'+" +
        "'<div class=\"header\"><div><div class=\"title\">Seating map for '+(show.title||'Untitled show')+'</div><div class=\"muted\">'+(when?(when+' · '):'')+venueName+'</div></div><div class=\"row\"><button class=\"btn\" id=\"backToTickets\">Back to tickets</button><button class=\"btn\" id=\"editShowBtn\">Edit show</button></div></div>'+" +
        "'<div class=\"grid grid-2\">'+" +
        "'<div class=\"grid\" style=\"align-content:start;gap:12px\">'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Seat maps for this show</div><div class=\"muted\" id=\"sm_status\">Loading seat maps…</div><select id=\"sm_select\" style=\"margin-top:8px;width:100%\"></select><div class=\"tip\" id=\"sm_tip\" style=\"margin-top:8px;font-size:12px\">Seat maps are stored per show and can optionally be linked to a venue.</div></div>'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Create new seat map</div><input id=\"sm_name\" placeholder=\"e.g. Stalls layout\"/><button class=\"btn p\" id=\"sm_create\" style=\"margin-top:8px;width:100%\">Create seat map</button><div class=\"error\" id=\"sm_err\" style=\"margin-top:4px\"></div></div>'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Quick seat generator</div><div class=\"muted\" style=\"font-size:12px;margin-bottom:6px\">Generate a basic rectangular layout. You can tweak individual seats afterwards.</div><div class=\"grid grid-2\" style=\"margin-bottom:6px\"><div class=\"grid\"><label>Rows</label><input id=\"q_rows\" type=\"number\" min=\"1\" max=\"50\" value=\"5\"/></div><div class=\"grid\"><label>Seats per row</label><input id=\"q_cols\" type=\"number\" min=\"1\" max=\"80\" value=\"10\"/></div></div><div class=\"grid grid-2\" style=\"margin-bottom:6px\"><div class=\"grid\"><label>Row labels</label><select id=\"q_rowMode\"><option value=\"letters\">A, B, C…</option><option value=\"numbers\">1, 2, 3…</option></select></div><div class=\"grid\"><label>First row label</label><input id=\"q_rowStart\" value=\"A\"/></div></div><button class=\"btn p\" id=\"q_generate\" style=\"margin-top:6px;width:100%\">Generate seats into selected map</button><div class=\"tip\" style=\"margin-top:4px;font-size:12px\">This will create seats only where they do not already exist (based on row / seat number).</div><div class=\"error\" id=\"q_err\" style=\"margin-top:4px\"></div></div>'+" +
        "'</div>'+" +
        "'<div class=\"grid\" style=\"align-content:start;gap:12px\">'+" +
        "'<div class=\"seat-layout-wrap\"><div><div class=\"seat-stage\">STAGE</div><div class=\"seat-stage-bar\"></div></div><div id=\"seatGridContainer\" style=\"margin-top:8px\"></div><div class=\"seat-legend\"><span><span class=\"seat-dot\"></span> Available</span><span><span class=\"seat-dot held\"></span> Held</span><span><span class=\"seat-dot sold\"></span> Sold</span><span><span class=\"seat-dot block\"></span> Blocked</span></div><div class=\"row-between\" style=\"margin-top:4px\"><div class=\"muted\" id=\"seatSummary\" style=\"font-size:12px\">No seats loaded.</div><label style=\"font-size:12px;display:flex;align-items:center;gap:4px\"><input type=\"checkbox\" id=\"toggleSeatNumbers\"/> Hide numbers</label></div></div>'+" +
        "'<div class=\"card\" style=\"margin:0\"><div class=\"title\" style=\"margin-bottom:4px\">Seat inspector</div><div class=\"muted\" id=\"seatInspectorHint\" style=\"font-size:12px;margin-bottom:6px\">Click a seat in the map to edit its details.</div><div id=\"seatMeta\" style=\"display:none\"><div class=\"grid grid-2\" style=\"margin-bottom:6px\"><div class=\"grid\"><label>Row label</label><input id=\"meta_rowLabel\"/></div><div class=\"grid\"><label>Seat number</label><input id=\"meta_seatNumber\" type=\"number\" min=\"0\"/></div></div><div class=\"grid grid-2\" style=\"margin-bottom:6px\"><div class=\"grid\"><label>Level / area</label><input id=\"meta_level\"/></div><div class=\"grid\"><label>Zone</label><input id=\"meta_zoneId\"/></div></div><div class=\"grid\" style=\"margin-bottom:6px\"><label>Label (full)</label><input id=\"meta_label\" placeholder=\"e.g. Stalls A12\"/></div><div class=\"row\" style=\"margin-bottom:6px\"><button class=\"btn p\" id=\"metaSave\">Save details</button><button class=\"btn\" id=\"metaToggleBlocked\">Toggle blocked</button><button class=\"btn\" id=\"metaToggleHeld\">Toggle held</button></div><div class=\"muted\" id=\"metaStatus\" style=\"font-size:12px\"></div></div></div>'+" +
        "'</div>'+" +
        "'</div>'+" +
        "'</div>';"+
        "$('#backToTickets').addEventListener('click',function(){go('/admin/ui/shows/'+showId+'/tickets');});" +
        "$('#editShowBtn').addEventListener('click',function(){go('/admin/ui/shows/'+showId+'/edit');});" +
        "var smStatus=$('#sm_status');" +
        "var smSelect=$('#sm_select');" +
        "var smName=$('#sm_name');" +
        "var smErr=$('#sm_err');" +
        "var qRows=$('#q_rows');" +
        "var qCols=$('#q_cols');" +
        "var qRowMode=$('#q_rowMode');" +
        "var qRowStart=$('#q_rowStart');" +
        "var qGenerate=$('#q_generate');" +
        "var qErr=$('#q_err');" +
        "var seatGridContainer=$('#seatGridContainer');" +
        "var seatSummary=$('#seatSummary');" +
        "var toggleSeatNumbers=$('#toggleSeatNumbers');" +
        "var seatMeta=$('#seatMeta');" +
        "var seatInspectorHint=$('#seatInspectorHint');" +
        "var metaRowLabel=$('#meta_rowLabel');" +
        "var metaSeatNumber=$('#meta_seatNumber');" +
        "var metaLevel=$('#meta_level');" +
        "var metaZoneId=$('#meta_zoneId');" +
        "var metaLabel=$('#meta_label');" +
        "var metaSave=$('#metaSave');" +
        "var metaToggleBlocked=$('#metaToggleBlocked');" +
        "var metaToggleHeld=$('#metaToggleHeld');" +
        "var metaStatus=$('#metaStatus');" +
        "var activeSeatMapId=null;" +
        "var seatsCache=[];" +
        "var selectedSeatId=null;" +
        "function setInspectorVisible(hasSelection){" +
        "seatMeta.style.display=hasSelection?'block':'none';" +
        "seatInspectorHint.style.display=hasSelection?'none':'block';" +
        "if(!hasSelection)metaStatus.textContent='';" +
        "}" +
        "async function loadSeatMaps(){" +
        "smStatus.textContent='Loading seat maps…';" +
        "smSelect.innerHTML='';activeSeatMapId=null;seatsCache=[];seatGridContainer.innerHTML='';seatSummary.textContent='No seats loaded.';" +
        "try{" +
        "var url='/admin/seatmaps?showId='+encodeURIComponent(showId);" +
        "if(venueId)url+='&venueId='+encodeURIComponent(venueId);" +
        "var maps=await j(url);" +
        "if(!Array.isArray(maps)||!maps.length){" +
        "smStatus.textContent='No seat maps yet for this show/venue.';smSelect.innerHTML='<option value=\"\">No maps</option>';return;}" +
        "smStatus.textContent=maps.length+' seat map'+(maps.length>1?'s':'')+' found.';" +
        "smSelect.innerHTML=maps.map(function(m){var label=m.name||'Untitled';if(m.isDefault)label+=' (default)';return '<option value=\"'+m.id+'\">'+label+'</option>';}).join('');" +
        "var def=maps.find(function(m){return m.isDefault;})||maps[0];activeSeatMapId=def.id;smSelect.value=activeSeatMapId;loadSeats();" +
        "}catch(e){smStatus.textContent='Failed to load seat maps.';}" +
        "}" +
        "smSelect.addEventListener('change',function(){var v=smSelect.value||'';activeSeatMapId=v||null;if(activeSeatMapId){loadSeats();}else{seatGridContainer.innerHTML='';seatSummary.textContent='No seats loaded.';}});" +
        "$('#sm_create').addEventListener('click',async function(){" +
        "smErr.textContent='';" +
        "var name=(smName.value||'').trim();" +
        "if(!name){smErr.textContent='Name is required';return;}" +
        "try{" +
        "var payload={name:name,showId:showId};" +
        "if(venueId)payload.venueId=venueId;" +
        "var created=await j('/admin/seatmaps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});" +
        "if(created&&created.ok&&created.id){smName.value='';await loadSeatMaps();activeSeatMapId=created.id;smSelect.value=created.id;loadSeats();}else{smErr.textContent=(created&&created.error)||'Failed to create seat map';}" +
        "}catch(e){smErr.textContent=e.message||String(e);}" +
        "});" +
        "function computeRowLabel(index,mode,start){" +
        "if(mode==='numbers'){var base=parseInt(start,10);if(isNaN(base))base=1;return String(base+index);}" +
        "var s=(start||'A').toUpperCase();var baseCode=s.charCodeAt(0);if(isNaN(baseCode))baseCode=65;return String.fromCharCode(baseCode+index);" +
        "}" +
        "qGenerate.addEventListener('click',async function(){" +
        "qErr.textContent='';" +
        "if(!activeSeatMapId){qErr.textContent='Select or create a seat map first.';return;}" +
        "var rows=Number(qRows.value||'0');" +
        "var cols=Number(qCols.value||'0');" +
        "if(!Number.isFinite(rows)||rows<=0||!Number.isFinite(cols)||cols<=0){qErr.textContent='Rows and seats per row must be positive numbers.';return;}" +
        "var mode=qRowMode.value||'letters';" +
        "var start=qRowStart.value||(mode==='numbers'?'1':'A');" +
        "var seats=[];" +
        "for(var r=0;r<rows;r++){" +
        "var rowLabel=computeRowLabel(r,mode,start);" +
        "for(var c=1;c<=cols;c++){" +
        "seats.push({row:rowLabel,number:c,rowLabel:rowLabel,seatNumber:c,label:rowLabel+String(c)});" +
        "}" +
        "}" +
        "try{" +
        "await j('/seatmaps/'+encodeURIComponent(activeSeatMapId)+'/seats/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seats:seats})});" +
        "loadSeats();" +
        "}catch(e){qErr.textContent=e.message||String(e);}" +
        "});" +
        "function renderSeats(){" +
        "seatGridContainer.innerHTML='';setInspectorVisible(false);" +
        "if(!seatsCache.length){seatSummary.textContent='No seats in this map yet.';return;}" +
        "var byRow={};" +
        "seatsCache.forEach(function(s){var r=s.row||s.rowLabel||'';if(!byRow[r])byRow[r]=[];byRow[r].push(s);});" +
        "var rows=Object.keys(byRow).sort();" +
        "var total=seatsCache.length;" +
        "var blocked=seatsCache.filter(function(s){return s.status==='BLOCKED';}).length;" +
        "var held=seatsCache.filter(function(s){return s.status==='HELD';}).length;" +
        "var sold=seatsCache.filter(function(s){return s.status==='SOLD';}).length;" +
        "var available=total-blocked-held-sold;" +
        "seatSummary.textContent=total+' seats · '+available+' available · '+held+' held · '+sold+' sold · '+blocked+' blocked';" +
        "var hideNumbers=!!toggleSeatNumbers.checked;" +
        "rows.forEach(function(rowKey){" +
        "var rowSeats=byRow[rowKey].slice().sort(function(a,b){var na=a.number||a.seatNumber||0;var nb=b.number||b.seatNumber||0;return na-nb;});" +
        "var rowDiv=document.createElement('div');rowDiv.style.display='flex';rowDiv.style.alignItems='center';rowDiv.style.marginBottom='2px';" +
        "var labelSpan=document.createElement('div');labelSpan.className='seat-row-label';labelSpan.textContent=rowSeats[0].rowLabel||rowKey||'';rowDiv.appendChild(labelSpan);" +
        "var grid=document.createElement('div');grid.className='seat-grid';grid.style.gridTemplateColumns='repeat('+rowSeats.length+', 1fr)';" +
        "rowSeats.forEach(function(s){" +
        "var btn=document.createElement('div');" +
        "var cls='seat';" +
        "if(s.status==='BLOCKED')cls+=' seat-blocked';else if(s.status==='HELD')cls+=' seat-held';else if(s.status==='SOLD')cls+=' seat-sold';" +
        "btn.className=cls;if(hideNumbers)btn.classList.add('seat-number-hidden');btn.dataset.seatId=s.id;" +
        "var span=document.createElement('span');span.textContent=String(s.seatNumber||s.number||'');btn.appendChild(span);" +
        "btn.addEventListener('click',function(){selectSeat(s.id);});" +
        "grid.appendChild(btn);" +
        "});" +
        "rowDiv.appendChild(grid);seatGridContainer.appendChild(rowDiv);" +
        "});" +
        "}" +
        "function selectSeat(seatId){" +
        "selectedSeatId=seatId;" +
        "$$('.seat',seatGridContainer).forEach(function(el){el.classList.toggle('seat-selected',el.dataset.seatId===seatId);});" +
        "var seat=seatsCache.find(function(s){return s.id===seatId;});" +
        "if(!seat){setInspectorVisible(false);return;}" +
        "setInspectorVisible(true);" +
        "metaRowLabel.value=seat.rowLabel||seat.row||'';" +
        "metaSeatNumber.value=seat.seatNumber!=null?String(seat.seatNumber):(seat.number!=null?String(seat.number):'');" +
        "metaLevel.value=seat.level||'';" +
        "metaZoneId.value=seat.zoneId||'';" +
        "metaLabel.value=seat.label||'';" +
        "metaStatus.textContent='Current status: '+(seat.status||'UNKNOWN');" +
        "}" +
        "async function loadSeats(){" +
        "seatsCache=[];selectedSeatId=null;setInspectorVisible(false);seatGridContainer.innerHTML='<div class=\"muted\" style=\"font-size:12px\">Loading seats…</div>';" +
        "if(!activeSeatMapId){seatGridContainer.innerHTML='<div class=\"muted\" style=\"font-size:12px\">Select a seat map to view seats.</div>';return;}" +
        "try{" +
        "var data=await j('/seatmaps/'+encodeURIComponent(activeSeatMapId)+'/seats');" +
        "seatsCache=Array.isArray(data)?data:[];renderSeats();" +
        "}catch(e){seatGridContainer.innerHTML='<div class=\"error\" style=\"font-size:12px\">Failed to load seats: '+(e.message||e)+'</div>';}" +
        "}" +
        "toggleSeatNumbers.addEventListener('change',function(){" +
        "$$('.seat',seatGridContainer).forEach(function(el){el.classList.toggle('seat-number-hidden',toggleSeatNumbers.checked);});" +
        "});" +
        "metaSave.addEventListener('click',async function(){" +
        "metaStatus.textContent='';" +
        "if(!selectedSeatId){metaStatus.textContent='No seat selected.';return;}" +
        "var body={" +
        "rowLabel:metaRowLabel.value.trim()||null," +
        "seatNumber:metaSeatNumber.value?Number(metaSeatNumber.value):null," +
        "level:metaLevel.value.trim()||null," +
        "zoneId:metaZoneId.value.trim()||null," +
        "label:metaLabel.value.trim()||null" +
        "};" +
        "try{" +
        "await j('/seatmaps/seat/'+encodeURIComponent(selectedSeatId)+'/meta',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});" +
        "metaStatus.textContent='Saved.';loadSeats();" +
        "}catch(e){metaStatus.textContent='Failed to save: '+(e.message||e);}" +
        "});" +
        "async function updateSeatStatus(targetStatus){" +
        "if(!selectedSeatId)return;" +
        "try{await j('/seatmaps/seat/'+encodeURIComponent(selectedSeatId)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:targetStatus})});loadSeats();}catch(e){metaStatus.textContent='Failed to update status: '+(e.message||e);}" +
        "}" +
        "metaToggleBlocked.addEventListener('click',function(){" +
        "var seat=seatsCache.find(function(s){return s.id===selectedSeatId;});if(!seat)return;var next=seat.status==='BLOCKED'?'AVAILABLE':'BLOCKED';updateSeatStatus(next);" +
        "});" +
        "metaToggleHeld.addEventListener('click',function(){" +
        "var seat=seatsCache.find(function(s){return s.id===selectedSeatId;});if(!seat)return;var next=seat.status==='HELD'?'AVAILABLE':'HELD';updateSeatStatus(next);" +
        "});" +
        "loadSeatMaps();" +
        "}" +

        // stub pages
        "function orders(){main.innerHTML='<div class=\"card\"><div class=\"title\">Orders</div><div class=\"muted\">Orders view coming soon.</div></div>';}" +
        "function venues(){main.innerHTML='<div class=\"card\"><div class=\"title\">Venues</div><div class=\"muted\">Venues management coming soon.</div></div>';}" +

        "document.addEventListener('DOMContentLoaded',route);" +
        "})();" +
        "</script>" +
        "</body>" +
        "</html>"
    );
  }
);

export default router;
