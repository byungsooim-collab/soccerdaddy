// posts/*.md + player.json + blog.config.json → dist/ (GitHub Pages 에 올릴 정적 블로그)
// 날짜가 아직 오지 않은 글은 빼고 만든다. 미리보기: node src/build.js --drafts
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { coverSvg } from './cover.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const config = JSON.parse(await fs.readFile(path.join(root, 'blog.config.json'), 'utf8'));
const player = JSON.parse(await fs.readFile(path.join(root, 'player.json'), 'utf8'));
const journey = JSON.parse(await fs.readFile(path.join(root, 'journey.json'), 'utf8').catch(() => 'null'));
const showDrafts = process.argv.includes('--drafts');
const now = Date.now();
const siteUrl = config.siteUrl.replace(/\/$/, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KST = 'Asia/Seoul';
const fmtDate = (d) => new Date(d).toLocaleDateString('ko-KR', { timeZone: KST, year: 'numeric', month: 'long', day: 'numeric' });
const shortDate = (d) => new Date(d).toLocaleDateString('ko-KR', { timeZone: KST, month: 'numeric', day: 'numeric' });

// ---------- 글 읽기 ----------
const files = (await fs.readdir(path.join(root, 'posts'))).filter((f) => f.endsWith('.md')).sort();
const all = [];
for (const file of files) {
  const { data, content } = matter(await fs.readFile(path.join(root, 'posts', file), 'utf8'));
  const slug = file.replace(/\.md$/, '');
  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) throw new Error(`${file}: date 가 올바르지 않습니다`);
  if (!data.title) throw new Error(`${file}: title 이 없습니다`);
  const words = content.replace(/\s+/g, '').length;
  all.push({
    slug, file, date, title: data.title, summary: data.summary || '', category: data.category || '일기', series: data.series || '',
    tags: data.tags || [], cover: data.cover || '', coverAlt: data.coverAlt || data.title, mood: data.mood || '',
    stats: data.stats || {}, html: marked.parse(content), readMin: Math.max(1, Math.round(words / 500)),
  });
}
all.sort((a, b) => a.date - b.date);
const posts = all.filter((p) => showDrafts || p.date.getTime() <= now);
const scheduled = all.length - posts.length;

// ---------- 상태창: 글 순서대로 값을 덮어쓰며 변화량을 계산 ----------
const fields = [...player.profile, ...player.stats, player.condition ? { key: 'condition', ...player.condition } : null].filter(Boolean);
const current = Object.fromEntries(fields.map((f) => [f.key, f.value ?? null]));
for (const p of posts) {
  p.changes = [];
  for (const [key, value] of Object.entries(p.stats)) {
    const field = fields.find((f) => f.key === key);
    if (!field) throw new Error(`${p.file}: stats 의 '${key}' 는 player.json 에 없는 항목입니다`);
    const before = current[key];
    current[key] = value;
    p.changes.push({ label: field.label, unit: field.unit || '', before, after: value, diff: typeof value === 'number' && typeof before === 'number' ? Number((value - before).toFixed(1)) : null });
  }
}

// ---------- 공통 틀 ----------
const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">`;

const page = ({ title, description, canonical, body, base, image = config.ogImage || '', type = 'website', nav = '', ld = null, article = null, noindex = false }) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(siteUrl + canonical)}">`}
${config.keywords?.length ? `<meta name="keywords" content="${esc(config.keywords.join(', '))}">` : ''}
<meta name="author" content="${esc(config.author)}">
${config.verification?.google ? `<meta name="google-site-verification" content="${esc(config.verification.google)}">` : ''}
${config.verification?.naver ? `<meta name="naver-site-verification" content="${esc(config.verification.naver)}">` : ''}
<meta property="og:locale" content="ko_KR">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(config.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(siteUrl + canonical)}">
${image ? `<meta property="og:image" content="${esc(siteUrl + '/' + image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="670"><meta property="og:image:alt" content="${esc(title)}">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${image ? `<meta name="twitter:image" content="${esc(siteUrl + '/' + image)}">` : ''}
${article ? `<meta property="article:published_time" content="${article.date.toISOString()}"><meta property="article:section" content="${esc(article.category)}">${article.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('')}` : ''}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
<meta name="theme-color" content="#2f9e5b">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.title)}" href="${base}feed.xml">
${fontLinks}
<link rel="stylesheet" href="${base}style.css">
</head>
<body>
${type === 'article' ? '<div class="progress" aria-hidden="true"><i></i></div>' : ''}
<header class="site-header"><div class="wrap">
  <a class="brand" href="${base}"><span class="brand-badge" aria-hidden="true">⚽</span><span class="brand-text"><b>${esc(config.title)}</b><small>${esc(config.titleEn)}</small></span></a>
  <nav class="nav">${[['home', base, '홈'], ...(journey ? [['journey', `${base}journey/`, '성장 연대기']] : []), ['about', `${base}about/`, '주니어 소개']].map(([k, href, label]) => `<a href="${href}"${nav === k ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
</div></header>
${body}
<footer class="site-footer"><div class="wrap footer-grid">
  <div><p class="footer-brand">⚽ ${esc(config.title)} <small>${esc(config.titleEn)}</small></p><p>${esc(config.tagline)}</p><p class="footer-note">${esc(player.note)}</p></div>
  <nav class="footer-links" aria-label="바로가기"><b>둘러보기</b><a href="${base}">홈</a>${journey ? `<a href="${base}journey/">성장 연대기</a>` : ''}<a href="${base}about/">주니어 소개</a><a href="${base}feed.xml">RSS 구독</a></nav>
  <nav class="footer-links" aria-label="카테고리"><b>주제</b>${categories.filter((c) => c !== '공지').map((c) => `<a href="${base}category/${encodeURIComponent(c)}/">${esc(c)}</a>`).join('')}</nav>
</div><div class="wrap footer-copy">© ${new Date().getFullYear()} ${esc(config.title)}. 아빠의 관찰 기록이며 의학·전문 코칭 조언이 아닙니다.</div></footer>
${type === 'article' ? `<script>(()=>{const b=document.querySelector('.progress i');const f=()=>{const h=document.documentElement;const m=h.scrollHeight-h.clientHeight;b.style.width=(m>0?h.scrollTop/m*100:0)+'%'};addEventListener('scroll',f,{passive:true});f()})();</script>` : ''}
</body>
</html>
`;

const ogImageOf = (p) => {
  if (!p.cover) return config.ogImage || '';
  const jpg = `images/og/${path.basename(p.cover).replace(/\.\w+$/, '.jpg')}`;
  return existsSync(path.join(root, jpg)) ? jpg : p.cover;
};
const coverOf = (p, base) => (p.cover ? `${base}${p.cover}` : `${base}covers/${p.slug}.svg`);
const coverTag = (p, base, cls = '') => `<img class="${cls}" src="${esc(coverOf(p, base))}" alt="${esc(p.cover ? p.coverAlt : '')}" loading="lazy" width="1200" height="630">`;

function statusCard(base) {
  const measured = (v) => v !== null && v !== undefined && v !== '';
  const vals = player.stats.map((f) => current[f.key]).filter((v) => typeof v === 'number');
  const ovr = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const profileRows = player.profile.map((f) => `<div class="prof"><span>${esc(f.label)}</span><b>${measured(current[f.key]) ? esc(current[f.key]) + esc(f.unit || '') : '—'}</b></div>`).join('');
  const bars = player.stats.map((f) => {
    const v = current[f.key];
    return `<li><span class="stat-label">${esc(f.label)}</span><span class="bar"><i style="width:${measured(v) ? Math.max(0, Math.min(100, v)) : 0}%"></i></span><b class="stat-val">${measured(v) ? esc(v) : '–'}</b></li>`;
  }).join('');
  const cond = current.condition;
  const last = [...posts].reverse().find((p) => p.changes.length);
  return `<aside class="pcard" aria-label="선수 상태창">
  <div class="pcard-top">
    <div class="pcard-ovr"><b>${ovr ?? '??'}</b><span>OVR</span><small>${esc(player.position === '미드필더' ? 'MF' : player.position)}</small></div>
    <div class="pcard-num" aria-hidden="true">${player.backNumber}</div>
    <div class="pcard-id"><span class="pcard-label">PLAYER STATUS</span><b>${esc(player.nickname)}</b><small>${player.age}살 · ${esc(player.position)}${player.team ? ` · ${esc(player.team)}` : ''}</small></div>
  </div>
  <div class="pcard-body">
    <div class="profile">${profileRows}</div>
    <div class="pcard-cond"><span>${esc(player.condition?.label || '컨디션')}</span><b>${measured(cond) ? esc(cond) : '측정 전'}</b></div>
    <ul class="stats">${bars}</ul>
    <p class="status-note">${last ? `최근 업데이트 · ${esc(shortDate(last.date))}` : '첫 측정 후 능력치가 채워집니다.'}</p>
    <a class="status-more" href="${base}about/">주니어 프로필 보기 <span aria-hidden="true">→</span></a>
  </div>
</aside>`;
}

const widgetRecent = (base, except) => {
  const list = newest.filter((p) => p !== except).slice(0, 4);
  return list.length ? `<section class="widget"><h3 class="widget-title">최근 글</h3><ul class="mini-list">${list.map((p) => `<li><a href="${base}posts/${p.slug}/"><img src="${esc(coverOf(p, base))}" alt="" loading="lazy" width="96" height="54"><span><b>${esc(p.title)}</b><small>${esc(p.category)} · ${shortDate(p.date)}</small></span></a></li>`).join('')}</ul></section>` : '';
};
const widgetCats = (base) => `<nav class="widget" aria-label="카테고리"><h3 class="widget-title">주제별로 보기</h3><div class="cat-list">${categories.map((c) => `<a href="${base}category/${encodeURIComponent(c)}/"><span aria-hidden="true">${esc(pillarOf(c)?.emoji || '⚽')}</span>${esc(c)}<small>${newest.filter((p) => p.category === c).length}</small></a>`).join('')}</div></nav>`;
const widgetJourney = (base) => journey ? `<a class="widget widget-journey" href="${base}journey/"><small>한눈에 보는</small><b>${esc(journey.title)}</b><span>지나온 길 ${journey.past.length}걸음 · 지금 · 앞으로의 길</span><em>연대기 보기 →</em></a>` : '';
const widgetSubscribe = (base) => `<section class="widget widget-sub"><h3 class="widget-title">새 글 받아보기</h3><p>매일 아침 9시, 저녁 7시에 새 글이 올라옵니다.</p><a class="btn small" href="${base}feed.xml">RSS 구독하기</a></section>`;

const postCard = (p, base, feature = false) => `<article class="card${feature ? ' feature' : ''}">
  <a href="${base}posts/${p.slug}/" class="card-link">
    <div class="card-cover">${coverTag(p, base)}${p.series ? `<span class="card-series">${esc(p.series)}</span>` : ''}</div>
    <div class="card-body">
      <div class="meta"><span class="cat">${esc(pillarOf(p.category)?.emoji || '')} ${esc(p.category)}</span><time datetime="${p.date.toISOString()}">${fmtDate(p.date)}</time></div>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.summary)}</p>
      <span class="card-foot">${p.readMin}분 읽기${p.mood ? ` · 오늘의 기분 ${esc(p.mood)}` : ''}<em>읽기 →</em></span>
    </div>
  </a>
</article>`;

// ---------- 구조화 데이터 (JSON-LD) ----------
const abs = (u) => siteUrl + u;
const authorLd = { '@type': 'Person', name: config.author, url: abs('/about/') };
const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(u) })) });

// ---------- 페이지 생성 ----------
const out = new Map(); // 경로 → 내용
const newest = [...posts].reverse();

const pillars = config.pillars || [];
const pillarOf = (c) => pillars.find((x) => x.category === c);
const categories = [...new Set([...pillars.map((x) => x.category).filter((c) => newest.some((p) => p.category === c)), ...newest.map((p) => p.category)])];
const pillarSection = (base) => pillars.length ? `<section class="pillars-wrap wrap" aria-label="블로그 주제"><div class="section-head"><h2>이 블로그에서 다루는 이야기</h2><p>일곱 개의 기둥으로 기록합니다</p></div><div class="pillars">${pillars.map((x) => {
  const n = newest.filter((p) => p.category === x.category).length;
  const inner = `<span class="pillar-emoji" aria-hidden="true">${x.emoji || '⚽'}</span><b>${esc(x.category)}</b><span class="pillar-desc">${esc(x.desc)}</span><small>${n ? `글 ${n}편` : '곧 연재'}</small>`;
  return n ? `<a class="pillar" href="${base}category/${encodeURIComponent(x.category)}/">${inner}</a>` : `<div class="pillar soon">${inner}</div>`;
}).join('')}</div></section>` : '';
const seriesMap = new Map();
for (const p of posts) if (p.series) { if (!seriesMap.has(p.series)) seriesMap.set(p.series, []); seriesMap.get(p.series).push(p); }
const seriesBox = (p, base) => {
  const list = seriesMap.get(p.series);
  if (!list || list.length < 2) return '';
  const idx = list.indexOf(p);
  return `<nav class="series-box" aria-label="연재 목차"><div class="series-head"><span>연재</span><b>${esc(p.series)}</b><small>${idx + 1} / ${list.length}화</small></div><ol>${list.map((x) => `<li${x === p ? ' aria-current="page"' : ''}><a href="${base}posts/${x.slug}/">${esc(x.title)}</a></li>`).join('')}</ol></nav>`;
};
const activeSeries = () => [...seriesMap].filter(([, list]) => list.length >= 2);
const seriesSection = (base) => activeSeries().length ? `<section class="series-strip wrap" aria-label="연재"><div class="section-head"><h2>연재 중</h2><p>처음부터 차례로 읽으면 더 재밌는 이야기</p></div><div class="series-cards">${activeSeries().map(([name, list]) => `<a class="series-card" href="${base}posts/${list[0].slug}/"><img src="${esc(coverOf(list[0], base))}" alt="" loading="lazy" width="1200" height="630"><span class="series-card-in"><small>연재 · ${list.length}편</small><b>${esc(name)}</b><span>최신화: ${esc(list[list.length - 1].title)}</span><em>1화부터 읽기 →</em></span></a>`).join('')}</div></section>` : '';
const firstChronicle = seriesMap.get(journey?.title)?.[0];
const heroPost = posts.find((p) => p.category === '공지' && p.cover) || firstChronicle || newest[0];

const listBody = (list, base, heading = '') => `<main class="wrap layout">
<div class="main-col">
${heading}
${!heading ? '<div class="section-head"><h2>최신 글</h2><p>가장 최근에 올라온 기록부터</p></div>' : ''}
${list.length ? `<div class="grid">${list.map((p, i) => postCard(p, base, !heading && i === 0)).join('\n')}</div>` : '<p class="empty">아직 올라온 글이 없습니다.</p>'}
</div>
<div class="side-col">${statusCard(base)}${widgetJourney(base)}${widgetCats(base)}${widgetSubscribe(base)}</div>
</main>`;

out.set('index.html', page({
  title: `${config.title} - ${config.tagline}`, description: config.description, canonical: '/', base: '', nav: 'home',
  ld: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: config.title, alternateName: config.titleEn, url: abs('/'), inLanguage: 'ko-KR', description: config.description },
    { '@type': 'Blog', name: config.title, url: abs('/'), author: authorLd, blogPost: newest.slice(0, 10).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(`/posts/${p.slug}/`), datePublished: p.date.toISOString() })) },
  ] },
  body: `<section class="hero"><div class="wrap hero-grid"><div class="hero-text"><p class="hero-kicker"><span>⚽</span> ${esc(config.titleEn)} · 아빠의 육성 노트</p><h1>${esc(config.tagline)}</h1><p>${esc(config.description)}</p><div class="hero-cta">${firstChronicle ? `<a class="btn primary" href="posts/${firstChronicle.slug}/">처음이라면, 연대기 1화부터 →</a>` : ''}${journey ? '<a class="btn ghost" href="journey/">성장 연대기 보기</a>' : ''}</div><dl class="hero-stats"><div><dt>기록한 글</dt><dd>${posts.length}<small>편</small></dd></div><div><dt>연재</dt><dd>${activeSeries().length}<small>개</small></dd></div><div><dt>주인공</dt><dd>#${player.backNumber}<small>${esc(player.position)}</small></dd></div></dl></div>${heroPost ? `<a class="hero-art" href="posts/${heroPost.slug}/"><img src="${esc(coverOf(heroPost, ''))}" alt="${esc(heroPost.coverAlt)}" width="1200" height="670"><span class="hero-art-tag"><small>첫 이야기</small>${esc(heroPost.title)}</span></a>` : ''}</div></section>\n${seriesSection('')}\n${pillarSection('')}\n${listBody(newest, '')}`,
}));

for (const c of categories) {
  const base = '../../';
  out.set(`category/${c}/index.html`, page({
    title: `${c} - ${config.title}`, description: pillarOf(c)?.desc || `${config.title}의 ${c} 글 모음`, canonical: `/category/${encodeURIComponent(c)}/`, base,
    ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: `${c} - ${config.title}`, url: abs(`/category/${encodeURIComponent(c)}/`) }, crumbs([[config.title, '/'], [c, `/category/${encodeURIComponent(c)}/`]])] },
    body: listBody(newest.filter((p) => p.category === c), base, `<h1 class="list-title">${esc(pillarOf(c)?.emoji ? pillarOf(c).emoji + ' ' : '')}${esc(c)}</h1>${pillarOf(c) ? `<p class="list-desc">${esc(pillarOf(c).desc)}</p>` : ''}`),
  }));
}

posts.forEach((p, i) => {
  const base = '../../';
  const prev = posts[i - 1], next = posts[i + 1];
  const changes = p.changes.length ? `<section class="levelup"><h2>📈 상태창 변화</h2><ul>${p.changes.map((c) => `<li><span>${esc(c.label)}</span><span class="from">${c.before ?? '측정 전'}${c.before != null ? esc(c.unit) : ''}</span><span class="arrow">→</span><b>${esc(c.after)}${esc(c.unit)}</b>${c.diff ? `<em class="${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</em>` : ''}</li>`).join('')}</ul></section>` : '';
  out.set(`posts/${p.slug}/index.html`, page({
    title: `${p.title} - ${config.title}`, description: p.summary || config.description, canonical: `/posts/${p.slug}/`, base, type: 'article',
    image: ogImageOf(p), article: p,
    ld: { '@context': 'https://schema.org', '@graph': [{
      '@type': 'BlogPosting', headline: p.title, description: p.summary, url: abs(`/posts/${p.slug}/`), mainEntityOfPage: abs(`/posts/${p.slug}/`),
      datePublished: p.date.toISOString(), dateModified: p.date.toISOString(), inLanguage: 'ko-KR', articleSection: p.category, keywords: p.tags.join(', '),
      image: p.cover ? abs('/' + ogImageOf(p)) : undefined, author: authorLd, publisher: { '@type': 'Organization', name: config.title, logo: { '@type': 'ImageObject', url: abs('/favicon.svg') } },
      ...(p.series ? { isPartOf: { '@type': 'CreativeWorkSeries', name: p.series } } : {}),
    }, crumbs([[config.title, '/'], [p.category, `/category/${encodeURIComponent(p.category)}/`], [p.title, `/posts/${p.slug}/`]])] },
    body: `<main class="wrap post-wrap">
<article class="post">
  <header class="post-head">
    <div class="meta"><a class="cat" href="${base}category/${encodeURIComponent(p.category)}/">${esc(pillarOf(p.category)?.emoji || '')} ${esc(p.category)}</a>${p.series ? `<span class="meta-series">${esc(p.series)}</span>` : ''}<time datetime="${p.date.toISOString()}">${fmtDate(p.date)}</time><span>${p.readMin}분 읽기</span>${p.mood ? `<span class="mood">오늘의 기분 · ${esc(p.mood)}</span>` : ''}</div>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ''}
  </header>
  <figure class="post-cover">${coverTag(p, base)}</figure>
  <div class="prose">${p.html}</div>
  ${seriesBox(p, base)}
  ${changes}
  ${p.tags.length ? `<p class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</p>` : ''}
  <nav class="pager">${prev ? `<a href="${base}posts/${prev.slug}/"><small>← 이전 글</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="${base}posts/${next.slug}/"><small>다음 글 →</small>${esc(next.title)}</a>` : '<span></span>'}</nav>
</article>
<div class="side-col">${statusCard(base)}${widgetRecent(base, p)}${widgetCats(base)}</div>
</main>`,
  }));
});

out.set('about/index.html', page({
  title: `주니어 소개 - ${config.title}`, description: `${config.title}의 주인공, ${player.age}살 ${player.position} 주니어를 소개합니다.`, canonical: '/about/', base: '../', nav: 'about',
  body: `<main class="wrap post-wrap"><article class="post"><header class="post-head"><h1>주니어를 소개합니다</h1><p class="lead">${player.age}살, 등번호 ${player.backNumber}번 ${esc(player.position)}. 이 블로그의 주인공입니다.</p></header>
<div class="prose"><p>${esc(config.description)}</p>
<h2>이 블로그에서 다루는 이야기</h2><ul>${pillars.map((x) => `<li><b>${esc(x.category)}</b>: ${esc(x.desc)}</li>`).join('')}</ul>
<h2>블로그 규칙</h2><ul><li>${esc(player.note)}</li><li>상태창 점수는 프로 선수와 비교한 점수가 아니라, 첫 측정을 기준으로 한 우리 아이만의 성장 지표입니다.</li><li>글은 아빠의 관찰과 기록이며, 의학·전문 코칭 조언이 아닙니다.</li></ul>
<h2>지금까지의 기록</h2><ul>${newest.map((p) => `<li><a href="../posts/${p.slug}/">${esc(p.title)}</a> <small>${shortDate(p.date)}</small></li>`).join('')}</ul></div></article>
<div class="side-col">${statusCard('../')}${widgetJourney('../')}</div></main>`,
}));

if (journey) {
  const base = '../';
  const linkOf = (slug) => posts.find((p) => p.slug === slug);
  const item = (e, kind) => {
    const post = linkOf(e.post);
    return `<li class="tl-item ${kind}"><span class="tl-dot" aria-hidden="true"></span><div class="tl-card"><small>${esc(e.when)}</small><b>${esc(e.title)}</b><p>${esc(e.text)}</p>${post ? `<a href="${base}posts/${post.slug}/">이야기 읽기 →</a>` : e.post ? '<span class="tl-soon">글 공개 예정</span>' : ''}</div></li>`;
  };
  out.set('journey/index.html', page({
    title: `성장 연대기 - ${config.title}`, description: journey.intro, canonical: '/journey/', base, nav: 'journey',
    body: `<main class="wrap journey"><header class="journey-head"><p class="hero-kicker">${esc(config.titleEn)}</p><h1>${esc(journey.title)}</h1><p>${esc(journey.intro)}</p></header>
<ol class="timeline">
<li class="tl-label">지나온 길</li>
${journey.past.map((e) => item(e, 'past')).join('\n')}
<li class="tl-label now-label">지금</li>
${item(journey.now, 'now')}
<li class="tl-label">앞으로 가고 싶은 길</li>
${journey.future.map((e) => item(e, 'future')).join('\n')}
</ol></main>`,
  }));
}

out.set('404.html', page({ title: `페이지를 찾을 수 없어요 - ${config.title}`, description: '', canonical: '/404.html', base: '/', noindex: true, body: '<main class="wrap"><p class="empty">공이 골대를 벗어났어요. 없는 페이지입니다.<br><a href="./">처음으로</a></p></main>' }));

const rssItems = newest.slice(0, 30).map((p) => `<item><title>${esc(p.title)}</title><link>${esc(`${siteUrl}/posts/${p.slug}/`)}</link><guid>${esc(`${siteUrl}/posts/${p.slug}/`)}</guid><pubDate>${p.date.toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.summary)}</description><content:encoded><![CDATA[${p.html.replace(/]]>/g, ']]&gt;')}]]></content:encoded></item>`).join('\n');
out.set('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><atom:link href="${esc(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/><title>${esc(config.title)}</title><link>${esc(siteUrl)}/</link><description>${esc(config.description)}</description><language>ko</language>\n${rssItems}\n</channel></rss>\n`);
const today = new Date().toISOString().slice(0, 10);
const lastPost = newest[0]?.date.toISOString().slice(0, 10) || today;
const smap = [['/', lastPost, '1.0'], ['/about/', lastPost, '0.5'], ...(journey ? [['/journey/', lastPost, '0.7']] : []),
  ...categories.map((c) => [`/category/${encodeURIComponent(c)}/`, newest.find((p) => p.category === c).date.toISOString().slice(0, 10), '0.6']),
  ...newest.map((p) => [`/posts/${p.slug}/`, p.date.toISOString().slice(0, 10), '0.8'])];
out.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${smap.map(([u, d, pr]) => `<url><loc>${esc(siteUrl + u)}</loc><lastmod>${d}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
out.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
out.set('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2f9e5b"/><text x="32" y="44" font-size="34" text-anchor="middle">⚽</text></svg>`);
out.set('.nojekyll', '');
for (const p of posts) if (!p.cover) out.set(`covers/${p.slug}.svg`, coverSvg(p, pillarOf(p.category)?.emoji));

// ---------- 쓰기 ----------
await fs.rm(dist, { recursive: true, force: true });
for (const [rel, content] of out) {
  const file = path.join(dist, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}
await fs.copyFile(path.join(root, 'src', 'style.css'), path.join(dist, 'style.css'));
await fs.cp(path.join(root, 'images'), path.join(dist, 'images'), { recursive: true });
for (const p of posts) if (p.cover) await fs.access(path.join(root, p.cover)).catch(() => { throw new Error(`${p.file}: cover 파일 ${p.cover} 이 없습니다`); });
console.log(`dist/ 생성: 공개 글 ${posts.length}편${scheduled ? `, 예약 ${scheduled}편` : ''}${showDrafts ? ' (예약 글 포함 미리보기)' : ''}`);
