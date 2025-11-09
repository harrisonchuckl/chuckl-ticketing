<!-- Replace ONLY the views.venues() function body in backend/src/routes/admin-ui.ts -->
<script>
// ... keep everything else in the file ...

    venues(){
      $('#viewTitle').textContent = 'Venues';
      $('#toolbarActions').innerHTML = '';
      $('#viewContent').innerHTML =
        '<div class="grid two">'
        + '<div class="card"><h4>Create / edit venue</h4><div class="grid">'
        +   '<div><label>Name</label><input id="v_name"/></div>'
        +   '<div><label>Address</label><input id="v_address"/></div>'
        +   '<div><label>City</label><input id="v_city"/></div>'
        +   '<div><label>Postcode</label><input id="v_postcode"/></div>'
        +   '<div><label>Capacity</label><input id="v_capacity" type="number" min="0"/></div>'
        +   '<hr/>'
        +   '<div><label>Fee % (bps)</label><input id="v_feePercentBps" type="number" min="0" max="10000" placeholder="e.g. 1000 = 10.00%"/></div>'
        +   '<div><label>Per-ticket fee (pence)</label><input id="v_perTicketFeePence" type="number" min="0" placeholder="e.g. 50"/></div>'
        +   '<div><label>Basket fee (pence)</label><input id="v_basketFeePence" type="number" min="0" placeholder="e.g. 99"/></div>'
        +   '<div><label>Organiser split (bps)</label><input id="v_organiserSplitBps" type="number" min="0" max="10000" placeholder="5000 = 50/50"/></div>'
        +   '<div class="row"><button class="btn primary" id="btnCreateVenue">Save venue</button></div>'
        +   '<div class="note" id="venueMsg"></div></div></div>'
        + '<div class="card"><h4>Find venues</h4>'
        +   '<div class="row"><input id="q" placeholder="Search by name/city/postcode"/><button class="btn ghost" id="btnFind">Search</button></div>'
        +   '<div id="venuesList" class="grid" style="margin-top:8px"></div></div>'
        + '</div>';

      $('#viewContent').onclick = async e => {
        if (e.target && e.target.id === 'btnCreateVenue') {
          const body = {
            name: $('#v_name').value,
            address: $('#v_address').value,
            city: $('#v_city').value,
            postcode: $('#v_postcode').value,
            capacity: Number($('#v_capacity').value || 0),

            feePercentBps: Number($('#v_feePercentBps').value || 0),
            perTicketFeePence: Number($('#v_perTicketFeePence').value || 0),
            basketFeePence: Number($('#v_basketFeePence').value || 0),
            organiserSplitBps: Number($('#v_organiserSplitBps').value || 5000),
          };
          const r = await API('/admin/venues', { method:'POST', body: JSON.stringify(body) });
          const j = await r.json();
          $('#venueMsg').textContent = j.ok ? 'Saved.' : (j.message || 'Failed');
        }
        if (e.target && e.target.id === 'btnFind') {
          const q = $('#q').value || '';
          const r = await API('/admin/venues?q=' + encodeURIComponent(q));
          const j = await r.json();
          const wrap = $('#venuesList');
          if(!j.ok){ wrap.innerHTML = '<p class="danger">Failed.</p>'; return; }
          wrap.innerHTML = (j.venues||[]).map(v => {
            const meta = [v.address, v.city, v.postcode].filter(Boolean).join(', ') || '—';
            const cap = (v.capacity != null) ? v.capacity : '—';
            const fees = [
              (v.feePercentBps||0) ? ('%' + (v.feePercentBps/100).toFixed(2)) : null,
              (v.perTicketFeePence||0) ? ('+' + v.perTicketFeePence + 'p/tkt') : null,
              (v.basketFeePence||0) ? ('+' + v.basketFeePence + 'p basket') : null,
              'org split ' + ((v.organiserSplitBps||5000)/100).toFixed(2) + '%'
            ].filter(Boolean).join(' · ');
            return '<div class="card"><b>'+v.name+'</b>'
              + '<div class="note">'+meta+'</div>'
              + '<div class="note">Capacity: '+cap+'</div>'
              + '<div class="note">Fees: '+(fees || 'none')+'</div>'
              + '</div>';
          }).join('');
        }
      };
    },

// ... keep everything else in the file ...
</script>
