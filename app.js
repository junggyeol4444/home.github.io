/* Creator Hub - SPA (Hash Router) */
const state = {
  config: null,
  creators: [],
  schedule: [],
  vods: [],
  teams: [],
  support: null,
  notices: [],
  locale: (window.__LOCALE__ || 'ko'),
  featureFlags: {},
  demo: true,
  eventBus: new EventTarget(),
};

// --- i18n (ko/en) ---
const i18n = {
  t(key) {
    const l = state.locale;
    const dict = i18nDict[l] || {};
    return key.split('.').reduce((o,k)=> o && o[k]!==undefined ? o[k] : null, dict) ?? key;
  }
};

const i18nDict = {
  ko: { home: { title: "홈" }, schedule: { title: "편성표/일정" }, live: { title: "라이브 허브" } },
  en: { home: { title: "Home" }, schedule: { title: "Schedule" }, live: { title: "Live Hub" } }
};

// --- theme (light/dark) ---
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
}
function getTheme() { return localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function setTheme(t) { localStorage.setItem('theme', t); applyTheme(t); }

// --- utilities ---
const $ = (sel, el=document)=> el.querySelector(sel);
const $$ = (sel, el=document)=> Array.from(el.querySelectorAll(sel));
const html = (strings, ...values)=> strings.map((s,i)=> s + (values[i]??'')).join('');

function fmtDate(dt, tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false, timeZone: tz
    }).format(new Date(dt));
  } catch { return dt; }
}

function toICS(events) {
  // Minimal ICS generator
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CreatorHub//Schedule//EN'
  ];
  events.forEach(ev => {
    const dtStart = new Date(ev.start).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    const dtEnd = new Date(ev.end).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    const uid = `${(ev.id||Math.random().toString(36).slice(2))}@creatorhub`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStart}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${(ev.note||'').replace(/\n/g,'\\n')}`,
      `LOCATION:${ev.platform||''}`,
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function download(filename, text) {
  const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function setRouteActive() {
  const route = location.hash.slice(2).split('/')[0] || '';
  $$('nav a[data-route]').forEach(a => a.classList.toggle('route-active', a.dataset.route === (route || 'home')));
}

function setLocaleButton() {
  const btn = document.getElementById('locale-toggle');
  btn.textContent = state.locale === 'ko' ? 'EN' : 'KO';
  btn.onclick = () => {
    state.locale = state.locale === 'ko' ? 'en' : 'ko';
    localStorage.setItem('locale', state.locale);
    router();
  };
}

function setNotifyButton() {
  const btn = document.getElementById('notify-toggle');
  btn.onclick = async () => {
    if (!('Notification' in window)) return alert('이 브라우저는 알림을 지원하지 않습니다.');
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('알림이 활성화되었습니다', { body: '방송 시작 알림을 브라우저로 전송합니다(데모).' });
      localStorage.setItem('notifications', 'on');
    }
  };
}

// --- data loading ---
async function loadJSON(path, fallback = null) {
  try {
    const res = await fetch(path, {cache: 'no-cache'});
    if (!res.ok) throw new Error('fetch failed');
    return await res.json();
  } catch (e) {
    console.warn('Failed to load', path, e);
    return fallback;
  }
}

async function bootstrap() {
  setLocaleButton(); setThemeButton(); setNotifyButton(); setRouteActive();
  applyTheme(getTheme());
  state.config = await loadJSON('config.json', { demoMode: true });
  state.demo = !!state.config.demoMode;
  state.featureFlags = await loadJSON('data/feature_flags.json', {});
  [state.creators, state.schedule, state.vods, state.teams, state.support, state.notices] = await Promise.all([
    loadJSON('data/creators.json', []),
    loadJSON('data/schedule.json', []),
    loadJSON('data/vods.json', []),
    loadJSON('data/teams.json', []),
    loadJSON('data/support.json', {}),
    loadJSON('data/notices.json', []),
  ]);
  renderLiveBanner();
  router();
}

function renderLiveBanner() {
  // Show "LIVE" if any creator has liveStatus.on === true
  const anyLive = state.creators.some(c => (c.liveStatus && c.liveStatus.on));
  const badge = document.getElementById('live-now-badge');
  const text = document.getElementById('live-now-text');
  if (anyLive) {
    badge.classList.remove('hidden');
    const liveNames = state.creators.filter(c=>c.liveStatus?.on).map(c=>c.name).join(', ');
    text.textContent = `지금 생방송: ${liveNames}`;
  } else {
    badge.classList.add('hidden');
  }
}

// --- Router & Views ---
async function router() {
  setRouteActive();
  const app = document.getElementById('app');
  const [route, ...rest] = (location.hash.slice(2) || '/').split('/');
  switch(route) {
    case 'live': return renderLiveHub(app);
    case 'schedule': return renderSchedule(app);
    case 'vod': return renderVOD(app);
    case 'team': return renderTeam(app);
    case 'support': return renderSupport(app);
    case 'notices': return renderNotices(app);
    case 'creator': return renderCreator(app, rest[0]);
    case 'admin': return renderAdmin(app);
    case 'privacy': return renderPrivacy(app);
    case '': case '/': default: return renderHome(app);
  }
}
window.addEventListener('hashchange', router);

// Home
function renderHome(app) {
  const upcoming = state.schedule
    .filter(e => new Date(e.start) > new Date())
    .sort((a,b)=> new Date(a.start)-new Date(b.start))
    .slice(0,6);
  const newVods = [...state.vods].sort((a,b)=> new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,6);
  app.innerHTML = html`
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">추천 라이브/다음 방송</h2>
        <a class="text-sm text-indigo-600 hover:underline" href="#/schedule">전체 보기</a>
      </div>
      <div class="grid-cards">
        ${upcoming.map(ev => html`
          <article class="card">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">${ev.title}</h3>
              <span class="badge ring-indigo-200 bg-indigo-50 text-indigo-700">${ev.platform}</span>
            </div>
            <p class="mt-1 text-sm text-gray-600">${fmtDate(ev.start, 'Asia/Seoul')} (KST)</p>
            <p class="mt-1 text-xs text-gray-500">${(ev.participants||[]).join(', ')}</p>
            <div class="mt-3 flex gap-2">
              <a class="text-sm underline" href="#/creator/${encodeURIComponent(ev.creatorId)}">크리에이터</a>
              ${ev.streamUrl? `<a class="text-sm underline" target="_blank" href="${ev.streamUrl}">시청하기</a>`: ''}
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">신규 VOD</h2>
        <a class="text-sm text-indigo-600 hover:underline" href="#/vod">전체 보기</a>
      </div>
      <div class="grid-cards">
        ${newVods.map(v => html`
          <article class="card">
            <img class="w-full aspect-video object-cover rounded-xl" src="${v.thumbnail}" alt="${v.title}" />
            <div class="mt-3">
              <div class="flex items-center justify-between">
                <h3 class="font-semibold line-clamp-2">${v.title}</h3>
                <span class="badge ring-gray-200 bg-gray-50">${v.platform}</span>
              </div>
              <p class="mt-1 text-sm text-gray-600">${fmtDate(v.publishedAt, 'Asia/Seoul')}</p>
              <a class="text-sm text-indigo-600 underline" target="_blank" href="${v.url}">시청하기</a>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">공지</h2>
      <ul class="list-disc pl-6">
        ${state.notices.slice(0,5).map(n => html`<li><a class="underline" href="#/notices">${n.title}</a> <span class="text-xs text-gray-500">${fmtDate(n.date)}</span></li>`).join('')}
      </ul>
    </section>
  `;
}

// Live Hub
function renderLiveHub(app) {
  const liveCreators = state.creators.filter(c => c.liveStatus?.on);
  const others = state.creators.filter(c => !c.liveStatus?.on);
  app.innerHTML = html`
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">지금 방송 중</h2>
        <div class="text-sm text-gray-600">플랫폼 필터:
          <select id="platform-filter" class="border rounded px-2 py-1">
            <option value="">전체</option>
            <option>Youtube</option><option>Twitch</option><option>CHZZK</option><option>SOOP</option>
          </select>
        </div>
      </div>
      <div class="grid-cards" id="live-grid"></div>

      <h3 class="text-lg font-semibold mt-6">오프라인</h3>
      <div class="grid-cards">
        ${others.map(cardCreator).join('')}
      </div>
    </section>
  `;

  function cardCreator(c) {
    return html`
      <article class="card">
        <div class="flex items-center gap-3">
          <img src="${c.thumbnail}" class="w-10 h-10 rounded-full" alt="${c.name}" />
          <div>
            <h3 class="font-semibold"><a class="hover:underline" href="#/creator/${encodeURIComponent(c.id)}">${c.name}</a></h3>
            <p class="text-sm text-gray-600">${c.bio||''}</p>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          ${(c.platformLinks||[]).map(pl=> `<a class="badge ring-gray-200 bg-gray-50" target="_blank" href="${pl.url}">${pl.type}</a>`).join('')}
        </div>
      </article>`;
  }

  const grid = $('#live-grid', app);
  const renderGrid = () => {
    const pf = $('#platform-filter').value;
    const cards = liveCreators.filter(c => !pf || c.liveStatus.platform === pf)
      .map(c => html`
        <article class="card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="${c.thumbnail}" class="w-10 h-10 rounded-full" alt="${c.name}" />
              <div>
                <h3 class="font-semibold"><a class="hover:underline" href="#/creator/${encodeURIComponent(c.id)}">${c.name}</a></h3>
                <p class="text-sm text-gray-600">${c.liveStatus.title||'라이브'}</p>
              </div>
            </div>
            <span class="badge ring-red-200 bg-red-50 text-red-700">${c.liveStatus.platform} • ${c.liveStatus.viewers||0}명</span>
          </div>
          <div class="mt-3 aspect-video rounded-xl overflow-hidden bg-gray-100">
            ${embedPlayer(c.liveStatus)}
          </div>
        </article>
      `).join('');
    grid.innerHTML = cards || `<p class="text-gray-600">현재 생방송 중인 채널이 없습니다.</p>`;
  };
  $('#platform-filter').onchange = renderGrid;
  renderGrid();
}

function embedPlayer(ls) {
  if (!ls) return '';
  if (ls.platform === 'Youtube' && ls.videoId) {
    return `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${ls.videoId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  }
  if (ls.platform === 'Twitch' && ls.channel) {
    return `<iframe class="w-full h-full" src="https://player.twitch.tv/?channel=${ls.channel}&parent=${location.hostname}&muted=true" frameborder="0" allowfullscreen></iframe>`;
  }
  if (ls.platform === 'CHZZK' && ls.channel) {
    return `<iframe class="w-full h-full" src="https://chzzk.naver.com/live/${ls.channel}" frameborder="0"></iframe>`;
  }
  if (ls.platform === 'SOOP' && ls.channel) {
    return `<iframe class="w-full h-full" src="https://sooplive.co.kr/${ls.channel}" frameborder="0"></iframe>`;
  }
  return `<div class="w-full h-full grid place-items-center text-gray-500 text-sm">플레이어를 불러올 수 없습니다.</div>`;
}

// Schedule
function renderSchedule(app) {
  const byDay = {};
  state.schedule.forEach(ev => {
    const d = new Date(ev.start).toISOString().slice(0,10);
    byDay[d] = byDay[d] || []; byDay[d].push(ev);
  });
  const days = Object.keys(byDay).sort();
  app.innerHTML = html`
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">주간 스케줄</h2>
        <div class="flex items-center gap-2">
          <button id="btn-ical" class="text-sm underline">iCal 구독 파일 받기</button>
          <a class="text-sm underline" href="data/schedule.ics" download>기본 .ics</a>
        </div>
      </div>
      ${days.map(d => html`
        <div>
          <h3 class="text-lg font-semibold">${d}</h3>
          <div class="mt-2 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead><tr class="text-left text-gray-600">
                <th class="py-2 pr-4">시간(KST)</th>
                <th class="py-2 pr-4">제목</th>
                <th class="py-2 pr-4">참여자</th>
                <th class="py-2 pr-4">플랫폼</th>
                <th class="py-2 pr-4">바로가기</th>
              </tr></thead>
              <tbody>
                ${byDay[d].sort((a,b)=> new Date(a.start)-new Date(b.start)).map(ev => html`
                  <tr class="border-t">
                    <td class="py-2 pr-4">${fmtDate(ev.start, 'Asia/Seoul')}</td>
                    <td class="py-2 pr-4">${ev.title}</td>
                    <td class="py-2 pr-4">${(ev.participants||[]).join(', ')}</td>
                    <td class="py-2 pr-4">${ev.platform}</td>
                    <td class="py-2 pr-4">${ev.streamUrl? `<a class="underline" target="_blank" href="${ev.streamUrl}">시청</a>`:''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </section>
  `;
  $('#btn-ical').onclick = () => download('creatorhub-schedule.ics', toICS(state.schedule));
}

// VOD/Clips
function renderVOD(app) {
  app.innerHTML = html`
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">VOD/클립</h2>
        <input id="vod-search" class="border rounded px-3 py-2 w-64" placeholder="제목/태그 검색" />
      </div>
      <div class="grid-cards" id="vod-grid"></div>
    </section>
  `;
  const grid = $('#vod-grid');
  const render = () => {
    const q = ($('#vod-search').value || '').toLowerCase();
    const list = state.vods.filter(v => !q || v.title.toLowerCase().includes(q) || (v.tags||[]).join(' ').toLowerCase().includes(q));
    grid.innerHTML = list.map(v => html`
      <article class="card">
        <img class="w-full aspect-video object-cover rounded-xl" src="${v.thumbnail}" alt="${v.title}" />
        <div class="mt-3">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold line-clamp-2">${v.title}</h3>
            <span class="badge ring-gray-200 bg-gray-50">${v.platform}</span>
          </div>
          <p class="mt-1 text-sm text-gray-600">${fmtDate(v.publishedAt, 'Asia/Seoul')}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${(v.tags||[]).map(t=> `<span class="badge ring-gray-200 bg-gray-50">${t}</span>`).join('')}
          </div>
          <a class="text-sm text-indigo-600 underline mt-2 inline-block" target="_blank" href="${v.url}">시청하기</a>
        </div>
      </article>
    `).join('');
  };
  $('#vod-search').oninput = render;
  render();
}

// Team/Crew
function renderTeam(app) {
  app.innerHTML = html`
    <section class="space-y-4">
      <h2 class="text-xl font-semibold">팀/크루</h2>
      <div class="grid-cards">
        ${state.teams.map(team => html`
          <article class="card">
            <h3 class="font-semibold">${team.name}</h3>
            <div class="mt-2 flex flex-wrap gap-2">
              ${team.members.map(id => {
                const c = state.creators.find(x=>x.id===id);
                return c ? `<a href="#/creator/${id}" class="badge ring-gray-200 bg-gray-50">${c.name}</a>` : '';
              }).join('')}
            </div>
            <div class="mt-4 text-sm">
              <h4 class="font-semibold">합동 방송 일정</h4>
              <ul class="list-disc pl-6">
              ${state.schedule.filter(s => (s.participants||[]).some(p => team.members.includes(p)))
                .slice(0,5).map(s=> `<li>${fmtDate(s.start,'Asia/Seoul')} - ${s.title}</li>`).join('')}
              </ul>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

// Support/Merch Tabs
function renderSupport(app) {
  const tab = new URLSearchParams(location.hash.split('?')[1]||'').get('tab') || 'support';
  app.innerHTML = html`
    <section class="space-y-4">
      <h2 class="text-xl font-semibold">후원/굿즈</h2>
      <div class="flex gap-4 border-b">
        <a href="#/support?tab=support" class="py-2 ${tab==='support'?'border-b-2 border-indigo-600':''}">후원</a>
        <a href="#/support?tab=merch" class="py-2 ${tab==='merch'?'border-b-2 border-indigo-600':''}">굿즈</a>
      </div>
      ${tab==='support' ? renderSupportTab() : renderMerchTab()}
    </section>
  `;

  function renderSupportTab() {
    const links = state.support?.links || [];
    return html`
      <div class="grid-cards">
        ${links.map(l => html`
          <article class="card">
            <h3 class="font-semibold">${l.label}</h3>
            <p class="text-sm text-gray-600">${l.desc||''}</p>
            <a target="_blank" class="underline text-indigo-600 mt-2 inline-block" href="${l.url}">이동</a>
          </article>
        `).join('')}
      </div>
    `;
  }
  function renderMerchTab() {
    const merch = state.support?.merch || [];
    return html`
      <div class="grid-cards">
        ${merch.map(m => html`
          <article class="card">
            <img class="w-full aspect-square object-cover rounded-xl" src="${m.image}" alt="${m.name}" />
            <div class="mt-3">
              <h3 class="font-semibold">${m.name}</h3>
              <p class="text-sm text-gray-600">${m.desc||''}</p>
              <div class="text-sm mt-1">재고: ${m.stock}</div>
              ${m.drop_at? `<div class="text-sm">드롭: ${fmtDate(m.drop_at, 'Asia/Seoul')}</div>`:''}
              <a target="_blank" class="underline text-indigo-600 mt-2 inline-block" href="${m.url}">구매하기</a>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }
}

// Notices
function renderNotices(app) {
  app.innerHTML = html`
    <section class="space-y-4">
      <h2 class="text-xl font-semibold">공지/이벤트</h2>
      <div class="space-y-4">
        ${state.notices.map(n=> html`
          <article class="card">
            <h3 class="font-semibold">${n.title}</h3>
            <p class="text-sm text-gray-600">${fmtDate(n.date,'Asia/Seoul')}</p>
            <p class="mt-2">${n.body}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

// Creator Profile
function renderCreator(app, id) {
  const c = state.creators.find(x=> String(x.id) === String(id));
  if (!c) return app.innerHTML = `<p class="text-gray-600">크리에이터를 찾을 수 없습니다.</p>`;
  app.innerHTML = html`
    <section class="space-y-4">
      <div class="flex items-center gap-4">
        <img src="${c.thumbnail}" class="w-20 h-20 rounded-full" alt="${c.name}" />
        <div>
          <h2 class="text-xl font-semibold">${c.name}</h2>
          <p class="text-gray-700">${c.bio||''}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${(c.platformLinks||[]).map(pl => `<a class="badge ring-gray-200 bg-gray-50" target="_blank" href="${pl.url}">${pl.type}</a>`).join('')}
          </div>
        </div>
      </div>
      ${c.representativeVideo ? html`
        <div class="aspect-video rounded-xl overflow-hidden bg-gray-100">
          <iframe class="w-full h-full" src="https://www.youtube.com/embed/${c.representativeVideo}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>` : ''}
      <div>
        <h3 class="font-semibold">협업 문의</h3>
        <p class="text-sm">메일: <a class="underline" href="mailto:${c.contact||''}">${c.contact||'-'}</a></p>
      </div>
    </section>
  `;
}

// Admin / Docs
function renderAdmin(app) {
  app.innerHTML = html`
    <section class="space-y-6">
      <h2 class="text-xl font-semibold">관리 & 통합 체크리스트</h2>
      <div class="card space-y-2 text-sm">
        <h3 class="font-semibold">멀티 플랫폼 연동 체크리스트</h3>
        <ul class="list-disc pl-6 space-y-1">
          <li>YouTube: search.list(eventType=live + channelId) → videos.list(liveStreamingDetails)</li>
          <li>Twitch: Helix API(Streams/Users/Videos) + EventSub</li>
          <li>SOOP: 개발자센터 SDK/API 확인, 토큰/레이트리밋 확인</li>
          <li>CHZZK: 공식 API(라이브/방송설정/채팅)</li>
          <li>임베드: 플랫폼 별 iframe, parent 도메인/TOS 준수</li>
        </ul>
        <p class="text-gray-600">GitHub Pages에서는 서버리스 없이 데모/클라이언트 측 폴링만 동작합니다. 실제 키는 <code>config.json</code>에 넣어 사용하세요.</p>
      </div>
      <div class="card space-y-2 text-sm">
        <h3 class="font-semibold">알림/구독 (브라우저 로컬)</h3>
        <p>서비스워커 기반 푸시는 서버 키가 필요합니다. 데모로 브라우저 알림/조용시간을 제공합니다.</p>
        <button id="btn-test-noti" class="px-3 py-2 bg-indigo-600 text-white rounded-lg">테스트 알림</button>
      </div>
      <div class="card space-y-2 text-sm">
        <h3 class="font-semibold">데이터 파일</h3>
        <ul class="list-disc pl-6">
          <li><code>data/creators.json</code>, <code>data/schedule.json</code>, <code>data/vods.json</code>, <code>data/teams.json</code>, <code>data/support.json</code></li>
        </ul>
      </div>
    </section>
  `;
  $('#btn-test-noti').onclick = () => {
    if (Notification.permission === 'granted') new Notification('테스트', { body: '테스트 알림입니다.' });
    else alert('상단에서 알림을 먼저 허용하세요.');
  };
}

function renderPrivacy(app) {
  app.innerHTML = html`
    <section class="space-y-4">
      <h2 class="text-xl font-semibold">개인정보/청소년 보호·광고 표기</h2>
      <p class="text-sm text-gray-700">본 사이트는 GitHub Pages에서 정적 호스팅됩니다. 쿠키는 최소화되며, 구독/알림은 브라우저 로컬 저장소만 사용합니다.</p>
    </section>
  `;
}

// Boot
bootstrap();
