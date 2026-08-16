function $(id) {
  return document.getElementById(id);
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function setError(el, message) {
  if (!message) {
    hide(el);
    el.textContent = '';
    return;
  }
  el.textContent = message;
  show(el);
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'history') refreshHistory();
  });
});

// ---------- Account ----------
async function refreshAccountStatus() {
  const status = await window.duckmail.whoami();
  const statusEl = $('account-status');
  if (status.loggedIn) {
    statusEl.textContent = `Logged in as ${status.duckUsername}@duck.com`;
    hide($('logged-out-view'));
    show($('logged-in-view'));
    $('whoami-username').textContent = `${status.duckUsername}@duck.com`;
    $('whoami-address').textContent = status.mainAddress ? `${status.mainAddress}@duck.com` : '(unavailable)';
  } else {
    statusEl.textContent = 'Not logged in';
    show($('logged-out-view'));
    hide($('logged-in-view'));
  }
  return status.loggedIn;
}

$('btn-request-code').addEventListener('click', async () => {
  const username = $('login-username').value.trim();
  setError($('account-error'), null);
  if (!username) {
    setError($('account-error'), 'Enter your duck.com address first.');
    return;
  }
  $('btn-request-code').disabled = true;
  const result = await window.duckmail.requestCode(username);
  $('btn-request-code').disabled = false;
  if (!result.ok) {
    setError($('account-error'), result.error);
    return;
  }
  show($('otp-section'));
});

$('btn-verify-code').addEventListener('click', async () => {
  const username = $('login-username').value.trim();
  const code = $('login-otp').value.trim();
  setError($('account-error'), null);
  if (!code) {
    setError($('account-error'), 'Paste the code or link from your email first.');
    return;
  }
  $('btn-verify-code').disabled = true;
  const result = await window.duckmail.verifyCode(username, code);
  $('btn-verify-code').disabled = false;
  if (!result.ok) {
    setError($('account-error'), result.error);
    return;
  }
  $('login-otp').value = '';
  await refreshAccountStatus();
});

$('btn-logout').addEventListener('click', async () => {
  await window.duckmail.logout();
  await refreshAccountStatus();
});

// ---------- Single generate ----------
$('btn-generate-one').addEventListener('click', async () => {
  setError($('gen-one-error'), null);
  hide($('gen-one-result'));
  $('btn-generate-one').disabled = true;
  const note = $('gen-note').value.trim();
  const result = await window.duckmail.generateOne(note);
  $('btn-generate-one').disabled = false;
  if (!result.ok) {
    setError($('gen-one-error'), result.error);
    return;
  }
  $('gen-one-address').textContent = result.address;
  show($('gen-one-result'));
});

$('btn-copy-one').addEventListener('click', () => {
  window.duckmail.copyToClipboard($('gen-one-address').textContent);
});

// ---------- Batch generate ----------
let batchRunning = false;

function renderBatchResults(results) {
  const list = $('batch-results');
  list.innerHTML = '';
  results.forEach((r) => {
    const li = document.createElement('li');
    if (r.address) {
      li.innerHTML = `<div class="addr-main"><code>${r.address}</code></div>`;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'secondary small';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => window.duckmail.copyToClipboard(r.address));
      li.appendChild(copyBtn);
    } else {
      li.innerHTML = `<div class="addr-main addr-error">Failed: ${r.error}</div>`;
    }
    list.appendChild(li);
  });
}

$('btn-batch-start').addEventListener('click', async () => {
  if (batchRunning) return;
  setError($('batch-error'), null);
  const count = parseInt($('batch-count').value, 10) || 0;
  const note = $('batch-note').value.trim();
  if (count < 1) {
    setError($('batch-error'), 'Enter how many aliases to generate (1-25).');
    return;
  }

  batchRunning = true;
  $('btn-batch-start').disabled = true;
  show($('btn-batch-cancel'));
  show($('batch-progress-wrap'));
  $('batch-progress-fill').style.width = '0%';
  $('batch-progress-label').textContent = `Starting… (0 / ${count})`;
  $('batch-results').innerHTML = '';

  const unsubscribe = window.duckmail.onBatchProgress(({ done, total, cancelled }) => {
    const pct = Math.round((done / total) * 100);
    $('batch-progress-fill').style.width = `${pct}%`;
    $('batch-progress-label').textContent = cancelled
      ? `Cancelled after ${done} / ${total}`
      : `Generated ${done} / ${total}`;
  });

  const result = await window.duckmail.generateBatch(count, note);

  unsubscribe();
  batchRunning = false;
  $('btn-batch-start').disabled = false;
  hide($('btn-batch-cancel'));

  if (!result.ok) {
    setError($('batch-error'), result.error);
  }
  renderBatchResults(result.results || []);
});

$('btn-batch-cancel').addEventListener('click', () => {
  window.duckmail.cancelBatch();
});

// ---------- History ----------
async function refreshHistory() {
  const entries = await window.duckmail.history();
  const list = $('history-list');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<li>No aliases generated yet.</li>';
    return;
  }
  entries
    .slice()
    .reverse()
    .forEach((entry) => {
      const li = document.createElement('li');
      const when = new Date(entry.createdAt).toLocaleString();
      li.innerHTML = `
        <div class="addr-main">
          <code>${entry.address}</code>
          <span class="meta">${when}${entry.note ? ' · ' + entry.note : ''}</span>
        </div>
      `;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'secondary small';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => window.duckmail.copyToClipboard(entry.address));
      li.appendChild(copyBtn);
      list.appendChild(li);
    });
}

// ---------- Init ----------
refreshAccountStatus();
