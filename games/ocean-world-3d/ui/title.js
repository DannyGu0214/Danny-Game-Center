// 타이틀 화면: 실제 게임 장면(젤리 블록 디오라마) 위에 얹는 얇은 덮개(Sailing Master 타이틀과 같은 방식).
// 따로 그린 그림·외부 글꼴 없이 DOM + CSS만 쓴다. 3D 쪽(카메라 궤도·출렁임)은 onStart를 받은 쪽이 한다.
// P2(2026-11-12): 저장 유무에 따른 문구(prompt)와 [새로 시작] 단추(저장이 있을 때만, 두 번 눌러 확인 — 4초 안에 다시 안 누르면 돌아감).
// 프롤로그는 부르는 쪽(render/main.js)이 onStart·onNew 뒤에 띄운다.

const CSS = /* css */`
#title { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center;
  padding-top: calc(8vh + env(safe-area-inset-top, 0px)); text-align: center; color: #f3fbff; cursor: pointer;
  user-select: none; -webkit-user-select: none; touch-action: none;
  background: linear-gradient(to bottom, rgba(6,48,72,.74), rgba(6,48,72,0) 32%, rgba(6,48,72,0) 62%, rgba(4,36,58,.84));
  transition: opacity .7s ease; }
#title.out { opacity: 0; pointer-events: none; }
#title h1 { margin: 0; font-size: clamp(34px, 6.4vw, 64px); font-weight: 800; letter-spacing: .01em; white-space: nowrap;
  text-shadow: 0 3px 18px rgba(0,30,50,.45), 0 1px 0 rgba(255,255,255,.25); }
#title h1 span { display: inline-block; transform-origin: 50% 90%; animation: owJelly 3.2s cubic-bezier(.3,1.6,.5,1) infinite; }
#title h1 span.sp { width: .3em; }
@keyframes owJelly {
  0%, 62%, 100% { transform: translateY(0) scale(1, 1); }
  70% { transform: translateY(-.06em) scale(.93, 1.08); }
  78% { transform: translateY(0) scale(1.07, .93); }
  86% { transform: translateY(-.015em) scale(.98, 1.02); }
}
#title .go { position: absolute; bottom: calc(118px + env(safe-area-inset-bottom, 0px)); left: 0; right: 0; font-size: 17px; font-weight: 700;
  color: #ffe08a; text-shadow: 0 1px 3px rgba(0,24,40,.85), 0 0 14px rgba(0,24,40,.6); animation: owBlink 1.8s infinite; }
@keyframes owBlink { 50% { opacity: .35; } }
#title .new { position: absolute; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); font: 600 13px system-ui, sans-serif; color: #e8f6ff;
  background: rgba(4,36,58,.45); border: 1px solid rgba(232,246,255,.45); border-radius: 18px; padding: 5px 14px; cursor: pointer; }
#title .new.arm { background: #c8553a; border-color: #ffb09a; color: #fff; }
#title .tag { position: absolute; bottom: calc(22px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; align-items: center; gap: 7px; }
#title .logoMark { width: 54px; height: 54px; display: block; filter: drop-shadow(0 3px 8px rgba(0,0,0,.45)); }
#title .logoWord { display: flex; align-items: center; gap: 10px; }
#title .logoWord b { font-family: Georgia, "Times New Roman", serif; font-size: 15px; font-weight: 700; letter-spacing: .3em; margin-right: -.3em;
  background: linear-gradient(to bottom, #fbeec2, #d9b265 60%, #a9833f); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
#title .logoWord i { display: block; width: 26px; height: 1px; background: linear-gradient(to right, rgba(217,178,101,0), #d9b265); }
#title .logoWord i:last-child { transform: scaleX(-1); }
body.intro #ui, body.intro #perf { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { #title h1 span, #title .go { animation: none; } }
`;

// Danny Soft 로고: Sailing Master(games/sailing-master/index.html)의 마크와 글자를 그대로 옮김
const LOGO = `
<svg class="logoMark" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="logoBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbeec2"/><stop offset=".5" stop-color="#d9b265"/><stop offset="1" stop-color="#8f6d33"/></linearGradient></defs>
  <circle cx="32" cy="32" r="29.5" fill="rgba(8,30,42,.72)" stroke="url(#logoBrass)" stroke-width="2.2"/>
  <circle cx="32" cy="32" r="25.5" fill="none" stroke="url(#logoBrass)" stroke-width=".7" stroke-dasharray="1 3.1"/>
  <path d="M32 8l3.6 20.4L56 32l-20.4 3.6L32 56l-3.6-20.4L8 32l20.4-3.6z" fill="url(#logoBrass)" opacity=".26"/>
  <path d="M34 15.5v27.2h13.4C45.6 31.6 41 21.6 34 15.5z" fill="url(#logoBrass)"/>
  <path d="M30.6 21.5v21.2H19.4c1.4-8.6 5.4-16 11.2-21.2z" fill="#f6f1e2"/>
  <path d="M15 45.6h34l-4.6 6.8H19.6z" fill="url(#logoBrass)"/>
</svg>
<div class="logoWord"><i></i><b>DANNY SOFT</b><i></i></div>`;

/**
 * @param {{ title?: string, prompt?: string, onStart: () => void, onNew?: () => void }} o
 *   onStart: 화면을 처음 누를 때 한 번 불린다(3D 쪽 시작 동작). 덮개 숨기기는 이 모듈이 한다.
 *   onNew: 주면 [새로 시작] 단추가 보인다(저장이 있을 때만 주기). 두 번 눌러 확인하면 onStart 대신 불린다.
 */
export function createTitle(o) {
  if (!document.getElementById('ow-title-css')) {
    const st = document.createElement('style'); st.id = 'ow-title-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.id = 'title';
  const letters = [...(o.title || 'Ocean World 3D')].map((ch, i) =>
    ch === ' ' ? '<span class="sp"> </span>' : `<span style="animation-delay:${(i * 0.07).toFixed(2)}s">${ch}</span>`).join('');
  el.innerHTML = `<h1 aria-label="${o.title || 'Ocean World 3D'}">${letters}</h1>
    <div class="go">${o.prompt || '눌러서 바다로 들어가요!'}</div>
    ${o.onNew ? '<button class="new" type="button">새로 시작</button>' : ''}
    <div class="tag" aria-label="Danny Soft">${LOGO}</div>`;
  document.body.appendChild(el);
  document.body.classList.add('intro');
  let started = false;
  const start = (e, fn = o.onStart) => {
    if (started) return;
    started = true;
    if (e) { e.preventDefault(); e.stopPropagation(); }
    el.classList.add('out');
    document.body.classList.remove('intro');
    setTimeout(() => el.remove(), 800);
    fn();
  };
  const nb = el.querySelector('.new');
  if (nb) {
    let armed = null;
    nb.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!armed) {
        nb.classList.add('arm'); nb.textContent = '한 번 더 누르면 처음부터예요';
        armed = setTimeout(() => { armed = null; nb.classList.remove('arm'); nb.textContent = '새로 시작'; }, 4000);
        return;
      }
      clearTimeout(armed);
      window.removeEventListener('keydown', onKey);
      start(null, o.onNew);
    });
  }
  el.addEventListener('pointerdown', start);
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { window.removeEventListener('keydown', onKey); start(e); } };
  window.addEventListener('keydown', onKey);
  return {
    el,
    get started() { return started; },
    start: () => start(null),
    startNew: () => start(null, o.onNew || o.onStart),
    setPrompt(text) { el.querySelector('.go').textContent = text; },
  };
}
