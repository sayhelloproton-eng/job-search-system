const app = document.querySelector('#app');
const title = document.querySelector('#page-title');
const badge = document.querySelector('#count-badge');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));
const fmtTime = (value) => value
  ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';
const fmtPublishedTime = (value) => value ? fmtTime(value) : '发布时间未知 · BOSS CLI 未提供';
const STATUS_LABELS = {
  NEW: '新发现', LISTED: '仍在列表', LIVE_CONFIRMED: '确认在招', RECRUITER_CONFIRMED: '招聘者确认',
  UNKNOWN: '未知', BLOCKED: '验证受阻', STALE: '信息过期', CLOSED: '已关闭'
};
const RISK_LABELS = { LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险', VERY_HIGH: '很高风险' };
const labelFor = (kind, value) => (kind === 'status' ? STATUS_LABELS[value] : RISK_LABELS[value]) ?? value ?? '未知';
const tag = (kind, value) => `<span class="tag ${kind}-${esc(value)}">${esc(labelFor(kind, value))}</span>`;
const activeLabel = (value) => value === 1 ? '最近活跃' : value === 0 ? '近期未活跃' : '未知';
const safeUrl = (value) => {
  try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error((await response.json()).error || response.statusText);
  return response.json();
}
function nav(view) {
  document.querySelectorAll('.nav').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}
function sourceAction(job) {
  const href = safeUrl(job.source_url);
  return href
    ? `<a class="source-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">BOSS 原始详情</a>`
    : '<span class="company">BOSS 原始详情不可用 · CLI 未提供链接</span>';
}
function jobRow(job) {
  return `<tr data-id="${esc(job.id)}">
    <td><div class="job-title">${esc(job.title)}</div><div class="company">${esc(job.company)}</div></td>
    <td>${esc(job.city || '—')} · ${esc(job.district || '—')}</td>
    <td>${esc(job.salary_text || '—')}</td>
    <td>${esc(job.experience_text || '—')}<div class="company">${esc(job.education_text || '—')}</div></td>
    <td class="score">${esc(job.final_score)}</td>
    <td>${tag('status', job.current_verification_status)}</td>
    <td>${fmtPublishedTime(job.published_at)}</td>
    <td>${esc(job.recruiter_activity || activeLabel(job.recruiter_recently_active))}</td>
    <td>${sourceAction(job)}</td>
    <td>${tag('risk', job.education_risk)}</td>
    <td>${esc(job.provider_name)}</td>
    <td>${fmtTime(job.last_verified_at)}</td>
    <td>${fmtTime(job.first_seen_at)}</td>
  </tr>`;
}
function matchExplanation(match) {
  try { return JSON.parse(match?.explanation_json || '{}').summary || '暂无解释'; }
  catch { return '暂无解释'; }
}
function renderDetail(data) {
  const job = data.job;
  return `<div class="detail inline-detail">
    <div class="panel card detail-head"><div><h2>${esc(job.title)}</h2>
      <div class="sub">${esc(job.company)} · ${esc(job.city)} ${esc(job.district || '')} · ${esc(job.provider_name)}</div>
      <div class="meta"><span class="pill">${esc(job.salary_text || '薪资未知')}</span>
        <span class="pill">${esc(job.experience_text || '经验不限')}</span>
        <span class="pill">${esc(job.education_text || '学历不限')}</span>
        ${tag('risk', job.education_risk)}${tag('status', job.current_verification_status)}</div>
      <div class="meta"><span class="pill">发布时间 · ${fmtPublishedTime(job.published_at)}</span>
        <span class="pill">招聘者活跃 · ${esc(job.recruiter_activity || activeLabel(job.recruiter_recently_active))}</span>
        ${sourceAction(job)}</div></div>
      <div><div class="score">${data.match?.final_score ?? '—'}</div><div class="company">匹配分</div></div></div>
    <div class="detail-grid"><div>
      <div class="card"><div class="section-title">原始 JD</div><div class="jd-text">${esc(job.jd_text || '完整 JD 未采集 · 当前仅有搜索列表信息')}</div></div>
      <div class="card" style="margin-top:14px"><div class="section-title">规范化信息</div>
        <p><b>方向：</b>${esc(job.role_family || '—')}　<b>级别：</b>${esc(job.seniority || '—')}</p>
        <p><b>经验：</b>${esc(job.experience_text || '—')}　<b>学历：</b>${esc(job.education_text || '—')}</p></div>
      <div class="card" style="margin-top:14px"><div class="section-title">匹配解释</div>
        <p><b>学历风险：</b>${esc(job.education_risk_reason || '—')}</p>
        <p><b>评估器：</b>${esc(data.match?.evaluator_version || '—')}</p><p>${esc(matchExplanation(data.match))}</p></div>
    </div><div>
      <div class="card"><div class="section-title">招聘真实性</div><div class="timeline">${data.verifications.map((v) => `<div class="timeline-item"><b>${tag('status', v.status)}</b><p>${fmtTime(v.verified_at)} · ${esc(v.method || '')}</p><p>${esc(v.evidence_summary || '')}</p></div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><div class="section-title">JD 快照</div>${data.snapshots.map((s) => `<p><b>${fmtTime(s.captured_at)}</b><br><span class="company">${esc(s.content_hash)}</span></p>`).join('') || '<p>暂无快照</p>'}</div>
    </div></div></div>`;
}
async function toggleDetail(row, id) {
  const next = row.nextElementSibling;
  if (next?.classList.contains('detail-row')) { next.remove(); return; }
  document.querySelector('.detail-row')?.remove();
  const detailRow = document.createElement('tr');
  detailRow.className = 'detail-row';
  detailRow.innerHTML = '<td colspan="13"><div class="loading">读取 JD 详情…</div></td>';
  row.after(detailRow);
  try {
    const data = await api('/api/jobs/' + encodeURIComponent(id));
    detailRow.firstElementChild.innerHTML = renderDetail(data);
    detailRow.querySelectorAll('.source-link').forEach((link) => link.addEventListener('click', (event) => event.stopPropagation()));
  } catch (error) {
    detailRow.firstElementChild.innerHTML = `<div class="card"><p>${esc(error.message)}</p></div>`;
  }
}
async function showJobs() {
  nav('jobs'); title.textContent = 'JD 列表';
  app.innerHTML = `<div class="toolbar"><input id="q" placeholder="搜索岗位、公司、技能…">
    <select id="provider"><option value="">全部来源</option><option value="boss">BOSS直聘</option></select>
    <select id="risk"><option value="">全部学历风险</option>${Object.entries(RISK_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <select id="status"><option value="">全部招聘状态</option>${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="panel table-wrap"><div class="loading">读取 JD…</div></div>`;
  const load = async () => {
    const params = new URLSearchParams();
    ['q', 'provider', 'risk', 'status'].forEach((key) => { const value = document.querySelector('#' + key).value; if (value) params.set(key, value); });
    const data = await api('/api/jobs?' + params);
    badge.textContent = `${data.items.length} 个 JD`;
    const wrap = document.querySelector('.table-wrap');
    wrap.innerHTML = data.items.length ? `<table class="job-table"><thead><tr>
      <th>岗位 / 公司</th><th>地点</th><th>薪资</th><th>经验 / 学历</th><th>匹配</th><th>招聘状态</th>
      <th>发布时间</th><th>招聘者活跃</th><th>BOSS 原始详情</th><th>学历风险</th><th>来源</th><th>最后验证</th><th>首次发现</th>
      </tr></thead><tbody>${data.items.map(jobRow).join('')}</tbody></table>` : '<div class="empty">没有符合条件的 JD</div>';
    wrap.querySelectorAll('tr[data-id]').forEach((row) => row.addEventListener('click', () => toggleDetail(row, row.dataset.id)));
    wrap.querySelectorAll('.source-link').forEach((link) => link.addEventListener('click', (event) => event.stopPropagation()));
  };
  document.querySelectorAll('.toolbar input,.toolbar select').forEach((input) => input.addEventListener('input', load));
  await load();
}
async function showResumes() {
  nav('resumes'); title.textContent = '简历列表'; const data = await api('/api/resumes');
  badge.textContent = `${data.items.length} 个版本`;
  app.innerHTML = `<div class="grid">${data.items.map((resume) => `<div class="card"><h3>${esc(resume.name)}</h3>
    <div class="meta"><span class="pill">${esc(resume.direction)}</span><span class="pill">${esc(resume.version_label)}</span></div>
    <p>${esc(resume.content || '')}</p><p><b>Source</b><br>${esc(resume.source_path || '—')}</p>
    <p class="company">hash · ${esc(resume.content_hash)}</p></div>`).join('')}</div>`;
}
async function showPersonalInfo() {
  nav('personal-info'); title.textContent = '个人信息';
  const [data, profile] = await Promise.all([api('/api/personal-info'), api('/api/personal-profile')]);
  badge.textContent = `${data.sources.length} 个事实源 · ${profile.directions.length} 个方向`;
  app.innerHTML = `<div class="detail-grid"><div>${data.sources.map((source) => `<div class="card" style="margin-bottom:14px"><h3>${source.available ? '已连接' : '不可用'} · 职业事实源</h3>
    <p class="company">${esc(source.path)}</p><div class="jd-text">${esc(source.content || '未读取到内容')}</div></div>`).join('')}</div>
    <div><div class="card"><div class="section-title">个人画像 / 目标方向</div>${profile.directions.map((item) => `<div style="margin-bottom:14px"><h3>${esc(item.name)}</h3><p>${esc(item.description || '')}</p><div class="meta"><span class="pill">${esc(item.direction)}</span></div></div>`).join('') || '—'}</div>
    <div class="card" style="margin-top:14px"><div class="section-title">能力 / 偏好信号</div><div class="terms">${profile.positive_signals.map((term) => `<span class="term ${esc(term.match_type)}">${esc(term.term)} · ${esc(term.category)}</span>`).join('') || '—'}</div></div>
    <div class="card" style="margin-top:14px"><div class="section-title">风险 / 排除信号</div><div class="terms">${profile.risk_signals.map((term) => `<span class="term ${esc(term.match_type)}">${esc(term.term)} · ${esc(term.category)}</span>`).join('') || '—'}</div></div></div></div>
    <div style="margin-top:14px">${data.baselines.map((baseline) => `<div class="card" style="margin-bottom:14px"><h3>${esc(baseline.name)}</h3><p>${esc(baseline.description || '')}</p><div class="meta"><span class="pill">方向 · ${esc(baseline.direction)}</span><span class="pill">${baseline.is_active ? '启用' : '停用'}</span></div><div class="terms">${baseline.terms.map((term) => `<span class="term ${esc(term.match_type)}">${esc(term.term)} · ${esc(term.match_type)} ${term.weight ? `(${term.weight})` : ''}</span>`).join('')}</div></div>`).join('')}</div>`;
}
document.querySelectorAll('.nav').forEach((button) => {
  button.addEventListener('click', () => ({
    jobs: showJobs,
    resumes: showResumes,
    'personal-info': showPersonalInfo
  }[button.dataset.view])());
});
showJobs().catch((error) => { app.innerHTML = `<div class="card"><h3>启动失败</h3><p>${esc(error.message)}</p></div>`; });
