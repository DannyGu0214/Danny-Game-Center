// 프롤로그 화면: 그림 화면 가득 + 아래 종이 한 장(제목·이름표+대사·쪽 점·[다음]), [건너뛰기].
// Sailing Master의 이야기 화면(#story)을 노트북 가로 화면에 맞춘 것. 외부 라이브러리 없음.
// 이 파일이 쓰는 것은 같은 폴더의 prologue-story.js(데이터)와 prologue.css(스타일)뿐이다.
//
// 약속(P2가 게임 흐름에 끼울 때 쓰는 면):
//   showPrologue({ root, onDone }) → Promise
//   - root: 화면을 붙일 요소(없으면 document.body). 화면은 position:fixed로 뷰포트 전체를 덮는다.
//   - onDone({ skipped }): 끝날 때 한 번 불린다. 건너뛰기와 마지막 쪽 단추 모두 끝으로 처리한다.
//   - 반환한 Promise도 같은 때 { skipped }로 풀린다. 화면이 사라진(페이드아웃 후 제거) 다음이다.
//   - 그림이 없거나 못 읽으면 반투명 바다색 바탕 위에 글만 보인다. root 뒤에 실제 게임 장면을 두면 흐리게 비친다.
//   - 입력: 클릭·터치(화면 어디든 또는 [다음]), →·Enter 다음, Esc 건너뛰기.

import { PROLOGUE } from './prologue-story.js';

const CSS_ID = 'ow-prologue-css';
const INPUT_GUARD_MS = 350; // 열리자마자 들어온 클릭·키(타이틀을 누른 손가락 등)로 1쪽이 넘어가지 않게
const FADE_MS = 450;

function ensureCss() {
  if (document.getElementById(CSS_ID)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.id = CSS_ID; link.rel = 'stylesheet';
    link.href = new URL('./prologue.css', import.meta.url).href;
    const t = setTimeout(resolve, 2000);
    link.onload = link.onerror = () => { clearTimeout(t); resolve(); };
    document.head.appendChild(link);
  });
}

// 그림 미리 읽기: url → Promise<boolean>(읽었으면 true)
const artCache = new Map();
function loadArt(url) {
  if (!artCache.has(url)) {
    artCache.set(url, new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im.naturalWidth > 0);
      im.onerror = () => resolve(false);
      im.src = url;
    }));
  }
  return artCache.get(url);
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/**
 * @param {{ root?: HTMLElement, onDone?: (r: { skipped: boolean }) => void }} [o]
 * @returns {Promise<{ skipped: boolean }>}
 */
export function showPrologue({ root, onDone } = {}) {
  const host = root || document.body;
  const S = PROLOGUE;
  const pages = S.pages;
  const urls = pages.map((p) => new URL('../' + p.art, import.meta.url).href);
  urls.forEach(loadArt);

  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const wrap = el('div', 'owp');
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', `프롤로그: ${S.title}`);
  const sea = el('div', 'owp-sea');
  const art = el('img', 'owp-art');
  art.alt = '';
  const skip = el('button', 'owp-skip', S.skipLabel);
  skip.type = 'button';
  const paper = el('div', 'owp-paper');
  const kick = el('div', 'owp-kick');
  const title = el('h2', 'owp-title', S.title);
  const lines = el('div', 'owp-lines');
  lines.setAttribute('aria-live', 'polite');
  const foot = el('div', 'owp-foot');
  const dots = el('div', 'owp-dots');
  dots.setAttribute('aria-hidden', 'true');
  const hint = el('span', 'owp-hint', '→ · Enter 다음   Esc 건너뛰기');
  const next = el('button', 'owp-next');
  next.type = 'button';
  for (let i = 0; i < pages.length; i++) dots.appendChild(el('i'));
  foot.append(dots, hint, next);
  paper.append(kick, title, lines, foot);
  wrap.append(sea, art, skip, paper);

  let page = -1;
  let finished = false;
  let readyAt = Infinity;

  function show(i) {
    page = i;
    const P = pages[i];
    const last = i === pages.length - 1;
    kick.textContent = `프롤로그 · ${i + 1} / ${pages.length}`;
    lines.replaceChildren(...P.lines.map((L) => {
      const sp = L.who ? S.speakers[L.who] : null;
      const row = el('p', sp ? 'owp-line' : 'owp-line narr');
      if (sp) {
        const who = el('span', 'owp-who', sp.name);
        who.style.background = sp.tag;
        row.append(who);
      }
      row.append(el('span', 'owp-say', L.text));
      return row;
    }));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = last ? S.finishLabel : S.nextLabel;
    skip.style.display = last ? 'none' : '';
    wrap.dataset.page = String(i + 1);

    // 그림: 읽었으면 보이고, 못 읽었으면 바다색 바탕(.owp-sea)만 남긴다.
    art.classList.remove('on');
    art.alt = P.alt || '';
    loadArt(urls[i]).then((ok) => {
      if (page !== i || finished) return;
      wrap.dataset.art = ok ? 'ok' : 'none';
      if (!ok) { art.removeAttribute('src'); return; }
      art.src = urls[i];
      void art.offsetWidth; // 애니메이션을 처음부터 다시
      art.classList.add('on');
    });
  }

  function finish(skipped) {
    if (finished) return;
    finished = true;
    window.removeEventListener('keydown', onKey, true);
    wrap.classList.add('out');
    setTimeout(() => {
      wrap.remove();
      const r = { skipped };
      try { onDone?.(r); } finally { resolveDone(r); }
    }, FADE_MS);
  }

  function advance() {
    if (finished || performance.now() < readyAt) return;
    if (page < pages.length - 1) show(page + 1);
    else finish(false);
  }

  function onKey(e) {
    if (finished) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) advance(); }
    else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (performance.now() >= readyAt) finish(page < pages.length - 1);
    }
  }

  next.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
  skip.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() >= readyAt) finish(true); });
  wrap.addEventListener('click', (e) => { if (!paper.contains(e.target)) advance(); });

  ensureCss().then(() => {
    show(0);
    host.appendChild(wrap);
    window.addEventListener('keydown', onKey, true);
    readyAt = performance.now() + INPUT_GUARD_MS;
    void wrap.offsetWidth; // 붙인 상태를 한 번 그리게 해서 페이드인이 일어나게(rAF는 숨은 탭에서 멈출 수 있어 쓰지 않음)
    wrap.classList.add('on');
    next.focus({ preventScroll: true });
  });

  return done;
}
