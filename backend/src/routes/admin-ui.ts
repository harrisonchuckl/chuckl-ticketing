      +   '<div id="ps_error_panel" class="card" style="margin-top:12px;display:none;border:1px solid #f5c2c7;background:#fff5f5;">'
      +     '<div class="title">Unable to load product store</div>'
      +     '<div class="muted" style="margin-top:6px;" id="ps_error_message">We hit an error loading product store data.</div>'
      +     '<button class="btn" id="ps_retry" style="margin-top:10px;">Retry</button>'
      +   '</div>'
    var errorPanel = $('#ps_error_panel');
    var errorMessage = $('#ps_error_message');
    var retryBtn = $('#ps_retry');
      searchBtn.addEventListener('click', function(){ loadProducts(null, { guard: true, handleError: true }); });
    }

    var loadState = {
      inFlight: false,
      hasLoaded: false,
      controller: null,
      loggedError: false,
    };

    var productsState = {
      inFlight: false,
      controller: null,
    };

    function formatErrorMessage(payload, status){
      var parts = [];
      if (payload && payload.error) parts.push(payload.error);
      if (payload && payload.code) parts.push('Code: ' + payload.code);
      if (payload && payload.errorId) parts.push('Error ID: ' + payload.errorId);
      if (!parts.length && status) parts.push('HTTP ' + status);
      return parts.length ? parts.join(' · ') : 'We hit an unexpected error.';
    }

    function showErrorPanel(response){
      if (!errorPanel || !errorMessage) return;
      var payload = response && response.data ? response.data : null;
      var status = response && response.status ? response.status : null;
      errorMessage.textContent = formatErrorMessage(payload, status);
      errorPanel.style.display = 'block';
    }

    function hideErrorPanel(){
      if (!errorPanel) return;
      errorPanel.style.display = 'none';
    }

    async function requestJson(url, opts, signal){
      var res = await fetch(url, Object.assign({ credentials:'include' }, (opts || {}), signal ? { signal: signal } : {}));
      var text = '';
      try{ text = await res.text(); }catch(e){}
      var data = {};
      if (text){
        try{
          data = JSON.parse(text);
        }catch(e){
          data = { error: text };
        }
      }
      var ok = res.ok && (!data || data.ok !== false);
      return { ok: ok, status: res.status, data: data };
    }

    function handleLoadError(err){
      var response = err && err.response ? err.response : err;
      if (!loadState.loggedError && response && response.data){
        console.log('product store load failed', response.data);
        loadState.loggedError = true;
      }
      showErrorPanel(response);
    async function loadSummary(signal){
        var response = await requestJson('/admin/api/product-store/summary', null, signal);
        if (!response.ok) throw { response: response };
        var data = response.data || {};
        throw err;
    async function loadProducts(signal, options){
      var guard = options && options.guard;
      if (guard && productsState.inFlight) return;
      if (guard){
        productsState.inFlight = true;
        if (productsState.controller) productsState.controller.abort();
        productsState.controller = new AbortController();
        signal = productsState.controller.signal;
      }
        var response = await requestJson(url, null, signal);
        if (!response.ok) throw { response: response };
        var data = response.data || {};
        if (options && options.handleError){
          handleLoadError(err);
          return;
        }
        throw err;
      }finally{
        if (guard) productsState.inFlight = false;
    async function loadOptions(signal){
      try{
        var response = await requestJson('/admin/api/product-store/options', null, signal);
        if (!response.ok) throw { response: response };
        return response.data || {};
      }catch(err){
        throw err;
      }
    }

    async function loadAll(){
      if (loadState.inFlight || loadState.hasLoaded) return;
      loadState.inFlight = true;
      loadState.loggedError = false;
      if (loadState.controller) loadState.controller.abort();
      loadState.controller = new AbortController();
      hideErrorPanel();
      try{
        await Promise.all([
          loadSummary(loadState.controller.signal),
          loadProducts(loadState.controller.signal),
          loadOptions(loadState.controller.signal),
        ]);
        loadState.hasLoaded = true;
      }catch(err){
        handleLoadError(err);
      }finally{
        loadState.inFlight = false;
      }
    }

    if (retryBtn){
      retryBtn.addEventListener('click', function(){
        loadState.hasLoaded = false;
        loadAll();
      });
    }

    loadAll();
