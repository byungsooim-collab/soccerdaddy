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
  <nav class="nav">${[['home', base, '홈'], ['contents', `${base}contents/`, '목차'], ...(journey ? [['journey', `${base}journey/`, '성장 연대기']] : []), ['about', `${base}about/`, '주니어 소개']].map(([k, href, label]) => `<a href="${href}"${nav === k ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
</div></header>
${body}
<footer class="site-footer"><div class="wrap footer-grid">
  <div><p class="footer-brand">⚽ ${esc(config.title)} <small>${esc(config.titleEn)}</small></p><p>${esc(config.tagline)}</p><p class="footer-note">${esc(player.note)}</p></div>
  <nav class="footer-links" aria-label="바로가기"><b>둘러보기</b><a href="${base}">홈</a>${journey ? `<a href="${base}journey/">성장 연대기</a>` : ''}<a href="${base}about/">주니어 소개</a><a href="${base}feed.xml">RSS 구독</a></nav>
  <nav class="footer-links" aria-label="목차"><b>목차</b>${liveParts().map((b) => `<a href="${base}contents/#${b.id}">${esc(b.label)} · ${esc(b.title)}</a>`).join('')}</nav>
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

const widgetJourney = (base) => journey ? `<a class="widget widget-journey" href="${base}journey/"><small>한눈에 보는</small><b>${esc(journey.title)}</b><span>지나온 길 ${journey.past.length}걸음 · 지금 · 앞으로의 길</span><em>연대기 보기 →</em></a>` : '';
const widgetSubscribe = (base) => `<section class="widget widget-sub"><h3 class="widget-title">새 글 받아보기</h3><p>매일 아침 9시, 저녁 7시에 새 글이 올라옵니다.</p><a class="btn small" href="${base}feed.xml">RSS 구독하기</a></section>`;

const postCard = (p, base, feature = false) => `<article class="card${feature ? ' feature' : ''}">
  <a href="${base}posts/${p.slug}/" class="card-link">
    <div class="card-cover">${coverTag(p, base)}<span class="card-series">${esc(p.part.label)} · ${esc(p.part.title)}</span></div>
    <div class="card-body">
      <div class="meta"><span class="cat">📖 ${esc(partTag(p))}</span><time datetime="${p.date.toISOString()}">${fmtDate(p.date)}</time></div>
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
// ---------- 책처럼 읽기: 프롤로그 → 1부 → 2부 → 3부 → 번외 ----------
// 부(part)는 blog.config.json 의 book 에서 series/category 로 정한다. 부 안에서는 날짜순.
const bookDef = config.book || [];
const partOf = (p) => {
  const i = bookDef.findIndex((b) => b.match && ((b.match.series || []).includes(p.series) || (b.match.category || []).includes(p.category)));
  return i >= 0 ? i : bookDef.length - 1;
};
const book = bookDef.map((b, i) => ({ ...b, id: `part-${i}`, posts: all.filter((p) => partOf(p) === i) }));
for (const part of book) part.posts.forEach((p, j) => { p.part = part; p.chapter = j + 1; });
const readable = book.flatMap((b) => b.posts).filter((p) => posts.includes(p)); // 공개된 글만, 책 순서
const liveParts = () => book.filter((b) => b.posts.some((p) => posts.includes(p)));
const partTag = (p) => `${p.part.label} · ${p.chapter}화`;
const chapterList = (part, base, cur = null, showSoon = true) => `<ol class="toc-list">${part.posts.map((x) => {
  const live = posts.includes(x);
  if (!live && !showSoon) return '';
  return live
    ? `<li${x === cur ? ' aria-current="page"' : ''}><a href="${base}posts/${x.slug}/"><span class="toc-no">${x.chapter}</span><span class="toc-t">${esc(x.title)}</span><small>${x.readMin}분</small></a></li>`
    : `<li class="soon"><span class="toc-no">${x.chapter}</span><span class="toc-t">${esc(x.title)}</span><small>${shortDate(x.date)} 공개</small></li>`;
}).join('')}</ol>`;
const bookSection = (base, compact = false) => `<section class="book${compact ? ' compact' : ''}" aria-label="목차">${liveParts().map((b) => `<div class="book-part" id="${b.id}"><div class="book-part-head"><span class="part-label">${esc(b.label)}</span><h3>${esc(b.title)}</h3><p>${esc(b.desc)}</p></div>${chapterList(b, base)}</div>`).join('')}</section>`;
const widgetToc = (base, cur) => `<nav class="widget widget-toc" aria-label="전체 목차"><h3 class="widget-title">전체 목차</h3>${liveParts().map((b) => `<div class="wt-part${b === cur.part ? ' open' : ''}"><b><span>${esc(b.label)}</span> ${esc(b.title)}</b>${chapterList(b, base, cur, false)}</div>`).join('')}<a class="status-more" href="${base}contents/">목차 페이지로 <span aria-hidden="true">→</span></a></nav>`;
const seriesMap = new Map();
for (const p of posts) if (p.series) { if (!seriesMap.has(p.series)) seriesMap.set(p.series, []); seriesMap.get(p.series).push(p); }
const activeSeries = () => liveParts().filter((b) => b.posts.filter((p) => posts.includes(p)).length >= 2);
const firstRead = readable[0];
const firstChronicle = book[1]?.posts.find((p) => posts.includes(p));
const heroPost = posts.find((p) => p.category === '공지' && p.cover) || firstChronicle || newest[0];

const listBody = (list, base, heading = '') => `<main class="wrap layout">
<div class="main-col">
${heading}
${!heading ? '<div class="section-head"><h2>최근 올라온 글</h2><a class="head-link" href="contents/">전체 목차 보기 →</a></div>' : ''}
${list.length ? `<div class="grid">${list.map((p, i) => postCard(p, base, !heading && i === 0)).join('\n')}</div>` : '<p class="empty">아직 올라온 글이 없습니다.</p>'}
</div>
<div class="side-col">${statusCard(base)}${widgetJourney(base)}${widgetSubscribe(base)}</div>
</main>`;

out.set('index.html', page({
  title: `${config.title} - ${config.tagline}`, description: config.description, canonical: '/', base: '', nav: 'home',
  ld: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: config.title, alternateName: config.titleEn, url: abs('/'), inLanguage: 'ko-KR', description: config.description },
    { '@type': 'Blog', name: config.title, url: abs('/'), author: authorLd, blogPost: newest.slice(0, 10).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(`/posts/${p.slug}/`), datePublished: p.date.toISOString() })) },
  ] },
  body: `<section class="hero"><div class="wrap hero-grid"><div class="hero-text"><p class="hero-kicker"><span>⚽</span> ${esc(config.titleEn)} · 아빠의 육성 노트</p><h1>${esc(config.tagline)}</h1><p>${esc(config.description)}</p><div class="hero-cta">${firstRead ? `<a class="btn primary" href="posts/${firstRead.slug}/">처음부터 차례로 읽기 →</a>` : ''}<a class="btn ghost" href="contents/">목차 보기</a></div><dl class="hero-stats"><div><dt>기록한 글</dt><dd>${posts.length}<small>편</small></dd></div><div><dt>이야기</dt><dd>${liveParts().length}<small>부</small></dd></div><div><dt>주인공</dt><dd>#${player.backNumber}<small>${esc(player.position)}</small></dd></div></dl></div>${heroPost ? `<a class="hero-art" href="posts/${heroPost.slug}/"><img src="${esc(coverOf(heroPost, ''))}" alt="${esc(heroPost.coverAlt)}" width="1200" height="670"><span class="hero-art-tag"><small>첫 이야기</small>${esc(heroPost.title)}</span></a>` : ''}</div></section>\n<section class="wrap book-wrap"><div class="section-head"><h2>책처럼 읽기</h2><p>프롤로그부터 차례로 읽으면 한 권의 이야기가 됩니다</p></div>${bookSection('')}</section>\n${listBody(newest.slice(0, 6), '')}`,
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
  const k = readable.indexOf(p);
  const prev = readable[k - 1], next = readable[k + 1];
  const changes = p.changes.length ? `<section class="levelup"><h2>📈 상태창 변화</h2><ul>${p.changes.map((c) => `<li><span>${esc(c.label)}</span><span class="from">${c.before ?? '측정 전'}${c.before != null ? esc(c.unit) : ''}</span><span class="arrow">→</span><b>${esc(c.after)}${esc(c.unit)}</b>${c.diff ? `<em class="${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</em>` : ''}</li>`).join('')}</ul></section>` : '';
  out.set(`posts/${p.slug}/index.html`, page({
    title: `${p.title} - ${config.title}`, description: p.summary || config.description, canonical: `/posts/${p.slug}/`, base, type: 'article',
    image: ogImageOf(p), article: p,
    ld: { '@context': 'https://schema.org', '@graph': [{
      '@type': 'BlogPosting', headline: p.title, description: p.summary, url: abs(`/posts/${p.slug}/`), mainEntityOfPage: abs(`/posts/${p.slug}/`),
      datePublished: p.date.toISOString(), dateModified: p.date.toISOString(), inLanguage: 'ko-KR', articleSection: p.category, keywords: p.tags.join(', '),
      image: p.cover ? abs('/' + ogImageOf(p)) : undefined, author: authorLd, publisher: { '@type': 'Organization', name: config.title, logo: { '@type': 'ImageObject', url: abs('/favicon.svg') } },
      isPartOf: { '@type': 'CreativeWorkSeries', name: p.part.title, url: abs('/contents/') },
    }, crumbs([[config.title, '/'], [`${p.part.label} ${p.part.title}`, '/contents/'], [p.title, `/posts/${p.slug}/`]])] },
    body: `<main class="wrap post-wrap">
<article class="post">
  <header class="post-head">
    <div class="meta"><a class="cat" href="${base}contents/#${p.part.id}">📖 ${esc(p.part.label)} ${esc(p.part.title)} · ${p.chapter}화</a><time datetime="${p.date.toISOString()}">${fmtDate(p.date)}</time><span>${p.readMin}분 읽기</span>${p.mood ? `<span class="mood">오늘의 기분 · ${esc(p.mood)}</span>` : ''}</div>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ''}
  </header>
  <figure class="post-cover">${coverTag(p, base)}</figure>
  <div class="prose">${p.html}</div>
  ${changes}
  ${p.tags.length ? `<p class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</p>` : ''}
  ${next ? `<a class="next-read" href="${base}posts/${next.slug}/"><img src="${esc(coverOf(next, base))}" alt="" loading="lazy" width="1200" height="630"><span><small>다음 이야기 · ${esc(partTag(next))}${next.part !== p.part ? ` · ${esc(next.part.title)} 시작` : ''}</small><b>${esc(next.title)}</b><em>이어서 읽기 →</em></span></a>` : `<div class="next-read end"><span><small>마지막 이야기까지 읽으셨어요</small><b>다음 글은 매일 아침 9시·저녁 7시에 올라옵니다</b><em><a href="${base}feed.xml">RSS로 새 글 받기 →</a></em></span></div>`}
  <nav class="pager">${prev ? `<a href="${base}posts/${prev.slug}/"><small>← 이전 이야기 · ${esc(partTag(prev))}</small>${esc(prev.title)}</a>` : '<span></span>'}<a class="next" href="${base}contents/#${p.part.id}"><small>목차</small>${esc(p.part.label)} ${esc(p.part.title)}</a></nav>
</article>
<div class="side-col">${widgetToc(base, p)}${statusCard(base)}</div>
</main>`,
  }));
});

out.set('contents/index.html', page({
  title: `목차 - ${config.title}`, description: `${config.title}를 처음부터 차례로 읽는 목차. ${liveParts().map((b) => `${b.label} ${b.title}`).join(', ')}.`, canonical: '/contents/', base: '../', nav: 'contents',
  ld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: `목차 - ${config.title}`, url: abs('/contents/') }, crumbs([[config.title, '/'], ['목차', '/contents/']])] },
  body: `<main class="wrap contents"><header class="journey-head"><p class="hero-kicker">${esc(config.titleEn)} · 목차</p><h1>처음부터 차례로 읽기</h1><p>흩어진 글이 아니라 한 권의 이야기로 읽히도록 묶었습니다. 프롤로그에서 시작해 1부부터 순서대로 읽으면 됩니다.</p>${firstRead ? `<div class="hero-cta"><a class="btn primary" href="../posts/${firstRead.slug}/">프롤로그부터 읽기 →</a></div>` : ''}</header>${bookSection('../')}</main>`,
}));

out.set('about/index.html', page({
  title: `주니어 소개 - ${config.title}`, description: `${config.title}의 주인공, ${player.age}살 ${player.position} 주니어를 소개합니다.`, canonical: '/about/', base: '../', nav: 'about',
  body: `<main class="wrap post-wrap"><article class="post"><header class="post-head"><h1>주니어를 소개합니다</h1><p class="lead">${player.age}살, 등번호 ${player.backNumber}번 ${esc(player.position)}. 이 블로그의 주인공입니다.</p></header>
<div class="prose"><p>${esc(config.description)}</p>
<h2>이 블로그의 구성</h2><ul>${liveParts().map((b) => `<li><a href="../contents/#${b.id}"><b>${esc(b.label)} ${esc(b.title)}</b></a>: ${esc(b.desc)}</li>`).join('')}</ul>
<h2>블로그 규칙</h2><ul><li>${esc(player.note)}</li><li>상태창 점수는 프로 선수와 비교한 점수가 아니라, 첫 측정을 기준으로 한 우리 아이만의 성장 지표입니다.</li><li>글은 아빠의 관찰과 기록이며, 의학·전문 코칭 조언이 아닙니다.</li></ul></div></article>
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
const smap = [['/', lastPost, '1.0'], ['/contents/', lastPost, '0.9'], ['/about/', lastPost, '0.5'], ...(journey ? [['/journey/', lastPost, '0.7']] : []),
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
