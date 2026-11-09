// ─── Populate dropdown ───
const methodSel = document.getElementById('method');
let lastCat = '';
let optgroup;
METHODS.forEach((m, i) => {
  if (m.cat !== lastCat) {
    optgroup = document.createElement('optgroup');
    optgroup.label = m.cat;
    methodSel.appendChild(optgroup);
    lastCat = m.cat;
  }
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = m.name;
  optgroup.appendChild(opt);
});

function getMethod() { return METHODS[parseInt(methodSel.value)]; }

function onMethodChange() {
  const m = getMethod();
  document.getElementById('params').value = JSON.stringify(m.params, null, 2);
  let desc = m.desc;
  if (m.coinsetOnly) desc += ' <span class="coinset-note">⚡ Coinset-only — not available on local nodes</span>';
  document.getElementById('method-desc').innerHTML = desc;
}
methodSel.addEventListener('change', onMethodChange);
onMethodChange();

function resetParams() { onMethodChange(); }

// ─── Network selector ───
const networkSel = document.getElementById('network');
const networkBadge = document.getElementById('network-badge');
networkSel.addEventListener('change', () => {
  const isMain = networkSel.value.includes('api.coinset.org/') && !networkSel.value.includes('testnet');
  networkBadge.textContent = isMain ? 'MAINNET' : 'TESTNET11';
  networkBadge.style.background = isMain ? 'var(--accent)' : '#ffcc00';
  networkBadge.style.color = '#1a1a2e';
});

// ─── Rate limiting ───
let lastReqTime = 0;
let countdownInterval = null;
const RATE_LIMIT_MS = 1000;

function canRequest(countdownId) {
  const now = Date.now();
  const elapsed = now - lastReqTime;
  if (elapsed < RATE_LIMIT_MS) {
    showCountdown(RATE_LIMIT_MS - elapsed, countdownId);
    return false;
  }
  return true;
}

function showCountdown(ms, elementId) {
  const cd = document.getElementById(elementId || 'countdown');
  const end = Date.now() + ms;
  if (countdownInterval) clearInterval(countdownInterval);
  const tick = () => {
    const left = end - Date.now();
    if (left <= 0) { cd.textContent = ''; clearInterval(countdownInterval); countdownInterval = null; return; }
    cd.textContent = `Rate limit: ${(left/1000).toFixed(1)}s`;
  };
  tick();
  countdownInterval = setInterval(tick, 100);
}

// ─── Last response storage ───
let lastResponseText = '';
let lastCurlCmd = '';

// ─── RPC execution (shared) ───
async function executeRpc(method, params) {
  const base = networkSel.value;
  const url = base + method;
  const body = JSON.stringify(params);
  const curlCmd = `curl -s -X POST ${url} -H "Content-Type: application/json" -d '${body}'`;

  const startTime = performance.now();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: body
  });
  const elapsed = Math.round(performance.now() - startTime);
  const text = await resp.text();
  const sizeKB = (new TextEncoder().encode(text).length / 1024).toFixed(1);

  return { resp, text, elapsed, sizeKB, curlCmd, ok: resp.ok, status: resp.status, statusText: resp.statusText };
}

function displayResponse(result, title) {
  const statusEl = document.getElementById('resp-status');
  statusEl.textContent = `${result.status} ${result.statusText} · ${result.elapsed}ms · ${result.sizeKB} KB`;
  statusEl.className = 'resp-status ' + (result.ok ? 'ok' : 'err');
  if (title) document.getElementById('resp-title').textContent = title;

  const MAX_SIZE = 100 * 1024;
  let display = result.text;
  if (result.text.length > MAX_SIZE) {
    display = result.text.substring(0, MAX_SIZE);
    document.getElementById('resp-truncated').textContent = `⚠️ Response truncated to 100KB (full response was ${result.sizeKB} KB)`;
  } else {
    document.getElementById('resp-truncated').textContent = '';
  }

  try {
    lastResponseText = JSON.stringify(JSON.parse(display), null, 2);
  } catch {
    lastResponseText = display;
  }
  document.getElementById('resp-body').textContent = lastResponseText;
  lastCurlCmd = result.curlCmd;
  document.getElementById('curl-box').style.display = 'none';
}

// ─── Explore mode RPC execution ───
async function runRpc() {
  if (!canRequest('countdown')) return;
  const m = getMethod();
  let params;
  try {
    params = JSON.parse(document.getElementById('params').value);
  } catch(e) {
    showError('Invalid JSON: ' + e.message);
    return;
  }

  const runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  runBtn.textContent = '⏳ Running...';
  document.getElementById('resp-body').textContent = 'Loading...';
  document.getElementById('resp-status').textContent = '';
  document.getElementById('resp-truncated').textContent = '';
  document.getElementById('curl-box').style.display = 'none';
  document.getElementById('resp-title').textContent = 'Response';

  lastReqTime = Date.now();

  try {
    const result = await executeRpc(m.name, params);
    displayResponse(result);
  } catch(err) {
    const statusEl = document.getElementById('resp-status');
    statusEl.textContent = 'Error';
    statusEl.className = 'resp-status err';
    lastResponseText = '';
    const base = networkSel.value;
    const body = JSON.stringify(params);
    lastCurlCmd = `curl -s -X POST ${base}${m.name} -H "Content-Type: application/json" -d '${body}'`;
    document.getElementById('resp-body').innerHTML =
      `<span style="color:var(--danger)">Direct API access unavailable. Use this curl command instead:</span>\n\n` +
      `<code>${escHtml(lastCurlCmd)}</code>`;
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run';
  }
}

function showError(msg) {
  document.getElementById('resp-body').innerHTML = `<span style="color:var(--danger)">${escHtml(msg)}</span>`;
  document.getElementById('resp-status').textContent = '';
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function copyResponse() {
  if (!lastResponseText) return;
  navigator.clipboard.writeText(lastResponseText).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

function showCurl() {
  if (currentMode === 'explore') {
    const m = getMethod();
    const base = networkSel.value;
    const url = base + m.name;
    let params;
    try { params = JSON.parse(document.getElementById('params').value); } catch { params = {}; }
    lastCurlCmd = `curl -s -X POST ${url} -H "Content-Type: application/json" -d '${JSON.stringify(params)}'`;
  }
  const box = document.getElementById('curl-box');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
  box.textContent = lastCurlCmd;
}

// ─── Utilities ───
function showUtil(id, tab) {
  document.querySelectorAll('.util-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.util-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('util-' + id).classList.add('active');
  tab.classList.add('active');
}


// ─── Mode switching ───
let currentMode = 'explore';

function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-explore').classList.toggle('active', mode === 'explore');
  document.getElementById('mode-walkthroughs').classList.toggle('active', mode === 'walkthroughs');
  document.getElementById('explore-panel').classList.toggle('wt-hidden', mode !== 'explore');
  document.getElementById('wt-panel').classList.toggle('wt-hidden', mode !== 'walkthroughs');

  if (mode === 'walkthroughs') {
    renderWtPicker();
    document.getElementById('resp-body').textContent = 'Select a walkthrough to begin.';
    document.getElementById('resp-status').textContent = '';
    document.getElementById('resp-title').textContent = 'Response';
    document.getElementById('resp-truncated').textContent = '';
    document.getElementById('curl-box').style.display = 'none';
  } else {
    document.getElementById('resp-title').textContent = 'Response';
  }
}

// ─── Walkthrough Engine ───
let wtState = null; // { walkthrough, currentStep, extractedValues, stepResults }

function renderWtPicker() {
  const picker = document.getElementById('wt-picker');
  picker.innerHTML = '';
  picker.classList.remove('wt-hidden');
  document.getElementById('wt-active').classList.add('wt-hidden');

  WALKTHROUGHS.forEach(wt => {
    const card = document.createElement('div');
    card.className = 'wt-card';
    card.innerHTML = `<h4>${escHtml(wt.title)}</h4><p>${escHtml(wt.description)}</p>`;
    card.onclick = () => startWalkthrough(wt);
    picker.appendChild(card);
  });
}

function startWalkthrough(wt) {
  wtState = {
    walkthrough: wt,
    currentStep: 0,
    extractedValues: {},
    stepResults: new Array(wt.steps.length).fill(null),
    stepResultIsHtml: new Array(wt.steps.length).fill(false)
  };

  document.getElementById('wt-picker').classList.add('wt-hidden');
  document.getElementById('wt-active').classList.remove('wt-hidden');
  document.getElementById('wt-summary').innerHTML = '';

  renderWtStepper();
  activateWtStep(0);
}

function exitWalkthrough() {
  wtState = null;
  renderWtPicker();
  document.getElementById('resp-body').textContent = 'Select a walkthrough to begin.';
  document.getElementById('resp-status').textContent = '';
  document.getElementById('resp-title').textContent = 'Response';
  document.getElementById('resp-truncated').textContent = '';
  document.getElementById('curl-box').style.display = 'none';
}

function renderWtStepper() {
  const stepper = document.getElementById('wt-stepper');
  stepper.innerHTML = '';
  const wt = wtState.walkthrough;

  wt.steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'wt-step' + (i === wtState.currentStep ? ' active' : '') + (wtState.stepResults[i] !== null ? ' done' : '');
    div.innerHTML = `
      <div class="wt-step-num">${wtState.stepResults[i] !== null ? '✓' : (i + 1)}</div>
      <div class="wt-step-label">${escHtml(step.label)}</div>
      <div class="wt-step-type">${step.type === 'rpc' ? '🌐 RPC' : step.type === 'utility' ? '🔧 Local' : '📊 Compute'}</div>
    `;
    div.onclick = () => activateWtStep(i);
    stepper.appendChild(div);
  });
}

function interpolate(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = vars[key];
      return v !== undefined ? v : `{{${key}}}`;
    });
  }
  if (Array.isArray(value)) return value.map(v => interpolate(v, vars));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = interpolate(v, vars);
    }
    return result;
  }
  return value;
}

function activateWtStep(index) {
  wtState.currentStep = index;
  const step = wtState.walkthrough.steps[index];

  renderWtStepper();

  // Context
  const ctx = document.getElementById('wt-context');
  ctx.innerHTML = `<strong>Step ${index + 1} of ${wtState.walkthrough.steps.length}:</strong> ${escHtml(step.description)}`;

  // Step title
  document.getElementById('wt-step-title').textContent = step.label;

  // Params
  const paramsEl = document.getElementById('wt-params');
  const runBtn = document.getElementById('wt-run-btn');

  if (step.type === 'compute') {
    paramsEl.value = '(computed from previous steps — click Run Step)';
    paramsEl.disabled = true;
    runBtn.textContent = '▶ Run Step';
  } else if (step.type === 'utility') {
    const prefill = interpolate(step.prefill, wtState.extractedValues);
    paramsEl.value = JSON.stringify(prefill, null, 2);
    paramsEl.disabled = false;
    runBtn.textContent = '▶ Run Step';
  } else {
    const prefill = interpolate(step.prefill, wtState.extractedValues);
    paramsEl.value = JSON.stringify(prefill, null, 2);
    paramsEl.disabled = false;
    runBtn.textContent = '▶ Run Step';
  }

  // Nav buttons
  document.getElementById('wt-prev-btn').disabled = index === 0;
  const isLast = index === wtState.walkthrough.steps.length - 1;
  const nextBtn = document.getElementById('wt-next-btn');
  nextBtn.disabled = wtState.stepResults[index] === null && step.type !== 'compute';
  nextBtn.textContent = isLast ? 'Finish' : 'Next Step →';

  // Show previous result if step already run
  if (wtState.stepResults[index] !== null) {
    document.getElementById('resp-title').textContent = `Step ${index + 1}: ${step.label}`;
    if (wtState.stepResultIsHtml[index]) {
      document.getElementById('resp-body').innerHTML = wtState.stepResults[index];
    } else {
      document.getElementById('resp-body').textContent = wtState.stepResults[index];
    }
  }
}

function wtPrevStep() {
  if (wtState.currentStep > 0) activateWtStep(wtState.currentStep - 1);
}

function wtNextStep() {
  const next = wtState.currentStep + 1;
  if (next < wtState.walkthrough.steps.length) {
    activateWtStep(next);
  }
  // If at last step, do nothing (they can exit or review)
}

async function runWtStep() {
  if (wtState.walkthrough.steps[wtState.currentStep].type === 'rpc' && !canRequest('wt-countdown')) return;

  const step = wtState.walkthrough.steps[wtState.currentStep];
  const runBtn = document.getElementById('wt-run-btn');
  runBtn.disabled = true;
  runBtn.textContent = '⏳ Running...';

  try {
    if (step.type === 'rpc') {
      let params;
      try {
        params = JSON.parse(document.getElementById('wt-params').value);
      } catch(e) {
        showError('Invalid JSON: ' + e.message);
        return;
      }

      lastReqTime = Date.now();
      const result = await executeRpc(step.method, params);
      displayResponse(result, `Step ${wtState.currentStep + 1}: ${step.label}`);

      // Extract values
      if (step.extract && result.ok) {
        const data = JSON.parse(result.text);
        for (const [varName, path] of Object.entries(step.extract)) {
          if (path.startsWith('_input_')) {
            // Extract from the user's input params, not the response
            wtState.extractedValues[varName] = params[path.substring(7)];
          } else {
            wtState.extractedValues[varName] = extractPath(data, path);
          }
        }
      }

      wtState.stepResults[wtState.currentStep] = lastResponseText;
      wtState.stepResultIsHtml[wtState.currentStep] = false;

    } else if (step.type === 'utility') {
      let input;
      try {
        input = JSON.parse(document.getElementById('wt-params').value);
      } catch(e) {
        showError('Invalid JSON: ' + e.message);
        return;
      }

      let resultText = '';
      if (step.tool === 'address_decode') {
        const { hrp, puzzleHash } = addressToPuzzleHash(input.address);
        resultText = JSON.stringify({ prefix: hrp, puzzle_hash: puzzleHash }, null, 2);
        if (step.extract) {
          for (const [varName, path] of Object.entries(step.extract)) {
            if (path === 'puzzle_hash') wtState.extractedValues[varName] = puzzleHash;
          }
        }
      } else if (step.tool === 'coin_id') {
        const parent = String(input.parent || '');
        const ph = String(input.puzzle_hash || '');
        const amount = String(input.amount || '0');
        const coinId = await computeCoinId(parent, ph, amount);
        resultText = JSON.stringify({ coin_id: coinId, components: { parent_coin_info: parent, puzzle_hash: ph, amount: amount }, algorithm: 'SHA256(parent + puzzle_hash + int_to_bytes(amount))' }, null, 2);
        if (step.extract) {
          for (const [varName, path] of Object.entries(step.extract)) {
            if (path === 'coin_id') wtState.extractedValues[varName] = coinId;
          }
        }
      }

      lastResponseText = resultText;
      document.getElementById('resp-body').textContent = resultText;
      document.getElementById('resp-status').textContent = 'Local · 0ms';
      document.getElementById('resp-status').className = 'resp-status ok';
      document.getElementById('resp-title').textContent = `Step ${wtState.currentStep + 1}: ${step.label}`;
      document.getElementById('resp-truncated').textContent = '';

      wtState.stepResults[wtState.currentStep] = resultText;
      wtState.stepResultIsHtml[wtState.currentStep] = false;

    } else if (step.type === 'compute') {
      const resultText = runCompute(step.fn);
      lastResponseText = resultText;
      document.getElementById('resp-body').innerHTML = resultText;
      document.getElementById('resp-status').textContent = 'Computed · 0ms';
      document.getElementById('resp-status').className = 'resp-status ok';
      document.getElementById('resp-title').textContent = `Step ${wtState.currentStep + 1}: ${step.label}`;
      document.getElementById('resp-truncated').textContent = '';

      wtState.stepResults[wtState.currentStep] = resultText;
      wtState.stepResultIsHtml[wtState.currentStep] = true;
    }

    // Update stepper and nav
    renderWtStepper();
    document.getElementById('wt-next-btn').disabled = false;

    // Show summary if this was the last step
    if (wtState.currentStep === wtState.walkthrough.steps.length - 1) {
      renderWtSummary();
    }

  } catch(err) {
    // Build CORS fallback with curl command for RPC steps
    if (step.type === 'rpc') {
      let params;
      try { params = JSON.parse(document.getElementById('wt-params').value); } catch { params = {}; }
      const base = networkSel.value;
      const url = base + step.method;
      lastCurlCmd = `curl -s -X POST ${url} -H "Content-Type: application/json" -d '${JSON.stringify(params)}'`;
      lastResponseText = '';
      document.getElementById('resp-body').innerHTML =
        `<span style="color:var(--danger)">Direct API access unavailable. Use this curl command instead:</span>\n\n` +
        `<code>${escHtml(lastCurlCmd)}</code>`;
      document.getElementById('resp-status').textContent = 'Error';
      document.getElementById('resp-status').className = 'resp-status err';
      document.getElementById('resp-title').textContent = `Step ${wtState.currentStep + 1}: ${step.label}`;
    } else {
      showError(err.message);
    }
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run Step';
  }
}

function extractPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// ─── Compute Functions ───
function runCompute(fn) {
  const v = wtState.extractedValues;

  if (fn === 'sum_balance') {
    const coins = v.coins;
    if (!coins || !Array.isArray(coins)) return '<span style="color:var(--danger)">No coins found — run Step 2 first.</span>';

    let total = 0n;
    for (const rec of coins) {
      total += BigInt(rec.coin.amount);
    }
    const xch = Number(total) / 1e12;
    const coinCount = coins.length;

    return `<div class="wt-summary">
      <h3>💰 Balance Summary</h3>
      <div class="value">${xch.toFixed(6)} XCH</div>
      <div class="detail">${total.toLocaleString()} mojos across ${coinCount} coin${coinCount !== 1 ? 's' : ''}</div>
      <div class="detail" style="margin-top:8px;color:var(--text-dim)">Each unspent coin is an independent UTXO. To spend XCH, one or more coins are consumed and new coins are created.</div>
    </div>`;
  }

  if (fn === 'show_lineage') {
    const rows = [];
    // Grandparent
    if (v.grandparentHeight) {
      rows.push({ label: 'Grandparent', id: v.grandparentId || '?', height: v.grandparentHeight, amount: v.grandparentAmount });
    }
    // Parent
    if (v.parentHeight) {
      rows.push({ label: 'Parent', id: v.parentId || '?', height: v.parentHeight, amount: v.parentAmount });
    }
    // Original coin
    if (v.coinHeight) {
      rows.push({ label: 'Coin', id: document.getElementById('wt-params') ? '(original query)' : '?', height: v.coinHeight, amount: v.coinAmount, spent: v.coinSpent });
    }

    if (rows.length === 0) return '<span style="color:var(--danger)">No lineage data — run the previous steps first.</span>';

    let html = `<div class="wt-summary"><h3>🔗 Coin Lineage</h3>
      <table class="wt-lineage-table">
        <tr><th>Level</th><th>Height</th><th>Amount</th><th>Amount (XCH)</th></tr>`;
    for (const row of rows) {
      const xch = row.amount ? (Number(row.amount) / 1e12).toFixed(6) : '—';
      html += `<tr><td>${escHtml(row.label)}</td><td>${row.height}</td><td>${Number(row.amount).toLocaleString()} mojos</td><td>${xch}</td></tr>`;
    }
    html += `</table>
      <div class="detail" style="margin-top:8px;color:var(--text-dim)">Each coin is created by spending its parent. You can keep tracing upward until you reach a coinbase (farming reward) coin.</div>
    </div>`;
    return html;
  }

  if (fn === 'summarize_block') {
    const additions = v.additions;
    const removals = v.removals;
    const blockHash = v.blockHash;
    const fees = v.blockFees;

    if (!additions && !removals) return '<span style="color:var(--danger)">No block data — run the previous steps first.</span>';

    const addCount = additions ? additions.length : 0;
    const remCount = removals ? removals.length : 0;

    let totalCreated = 0n;
    let totalDestroyed = 0n;
    if (additions) for (const r of additions) totalCreated += BigInt(r.coin.amount);
    if (removals) for (const r of removals) totalDestroyed += BigInt(r.coin.amount);

    let html = `<div class="wt-summary"><h3>🧱 Block Summary</h3>
      <div class="detail">Header: ${blockHash ? escHtml(String(blockHash).substring(0, 20)) + '...' : '?'}</div>
      <div class="detail">Fees: ${fees !== null && fees !== undefined ? fees + ' mojos' : 'None (non-transaction block or zero fees)'}</div>
      <div class="value" style="margin-top:8px">${addCount} coin${addCount !== 1 ? 's' : ''} created · ${remCount} coin${remCount !== 1 ? 's' : ''} spent</div>
      <div class="detail">${(Number(totalCreated) / 1e12).toFixed(6)} XCH created · ${(Number(totalDestroyed) / 1e12).toFixed(6)} XCH spent</div>
      <div class="detail" style="margin-top:8px;color:var(--text-dim)">Additions include farming rewards (block reward + fees) and any transaction outputs. Removals are the coins that were spent.</div>
    </div>`;
    return html;
  }

  if (fn === 'verify_match') {
    const originalId = v.originalCoinId;
    const computedId = v.computedId;

    if (!computedId) return '<span style="color:var(--danger)">No computed ID — run Step 2 first.</span>';
    if (!originalId) return '<span style="color:var(--danger)">No original coin ID — run Step 1 first.</span>';

    const match = computedId.toLowerCase() === originalId.toLowerCase();

    return `<div class="wt-summary">
      <h3>🔐 Verification Result</h3>
      <div class="value" style="color:${match ? 'var(--success)' : 'var(--danger)'}">${match ? '✓ MATCH' : '✗ MISMATCH'}</div>
      <div class="detail" style="margin-top:8px">
        <div>Original ID: <span style="color:var(--text)">${escHtml(originalId)}</span></div>
        <div>Computed ID: <span style="color:var(--text)">${escHtml(computedId)}</span></div>
      </div>
      <div class="detail" style="margin-top:8px;color:var(--text-dim)">${match
        ? 'The coin ID is a deterministic hash of its three components. This means coin data cannot be tampered with — any change to parent, puzzle hash, or amount would produce a different ID.'
        : 'The IDs don\'t match. This could mean the coin data was modified or the wrong coin was fetched.'
      }</div>
    </div>`;
  }

  return '<span style="color:var(--danger)">Unknown compute function: ' + escHtml(fn) + '</span>';
}

function renderWtSummary() {
  // Summary is rendered inline by the compute step — nothing extra needed
}

// ─── Initialize walkthrough picker ───
function initWtPicker() {
  renderWtPicker();
}

// ─── On load ───
initWtPicker();
