const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'http://api:8000';

async function fetchJson(path) {
  const token = localStorage.getItem('api_token');
  if (!token) {
    localStorage.setItem('api_token', 'change-me');
  }
  const headers = { 'Authorization': `Bearer ${localStorage.getItem('api_token') || 'change-me'}` };
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderCalls(items) {
  const tbody = document.querySelector('#calls-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const c of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="/calls/${c.id}">${c.id.slice(0, 8)}...</a></td>
      <td>${c.status}</td>
      <td>${c.direction}</td>
      <td>${c.to_number}</td>
      <td>${c.from_number}</td>
      <td>${new Date(c.created_at).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadCalls() {
  const status = document.getElementById('status-filter')?.value || '';
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await fetchJson(`/v1/calls${query}`);
  renderCalls(data.items || []);
}

function renderCallSummary(call) {
  const node = document.getElementById('call-summary');
  if (!node) return;
  node.innerHTML = `
    <div><strong>Status:</strong> ${call.status}</div>
    <div><strong>Direction:</strong> ${call.direction}</div>
    <div><strong>To:</strong> ${call.to_number}</div>
    <div><strong>From:</strong> ${call.from_number}</div>
    <div><strong>Room:</strong> ${call.room_name}</div>
    <div><strong>Created:</strong> ${new Date(call.created_at).toLocaleString()}</div>
  `;
}

function renderTranscript(turns) {
  const list = document.getElementById('transcript-list');
  if (!list) return;
  list.innerHTML = '';
  for (const t of turns) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div><strong>${t.speaker}</strong> <span class="meta">${t.start_ms}ms-${t.end_ms}ms</span></div>
      <div>${t.text}</div>
    `;
    list.appendChild(li);
  }
}

async function loadCallDetail(callId) {
  const [call, transcript] = await Promise.all([
    fetchJson(`/v1/calls/${callId}`),
    fetchJson(`/v1/calls/${callId}/transcript`),
  ]);
  renderCallSummary(call);
  renderTranscript(transcript);
}

window.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadCalls);
    document.getElementById('status-filter')?.addEventListener('change', loadCalls);
    loadCalls().catch(console.error);
    setInterval(() => loadCalls().catch(console.error), 10000);
  }

  if (window.CALL_ID) {
    loadCallDetail(window.CALL_ID).catch(console.error);
    setInterval(() => loadCallDetail(window.CALL_ID).catch(console.error), 5000);
  }
});
