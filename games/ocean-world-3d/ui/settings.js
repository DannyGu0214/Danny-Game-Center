// 설정 창(P4 W1): 화면 오른쪽 위 작은 단추 하나로 여는 창. 지금은 "출렁임: 보통 / 약하게 / 끄기" 하나(DESIGN 4.3절).
// 고른 값은 localStorage에 저장한다(사생활 모드 등에서 막혀도 게임은 그대로 돌게 try/catch).
// ui/react.js의 attachReact가 만들고, 고른 값을 jelly에 넘긴다. render/main.js는 고치지 않는다.

const KEY = 'ow3d.jellyLevel';
export const JELLY_LEVELS = [
  ['normal', '보통'],
  ['weak', '약하게'],
  ['off', '끄기'],
];
const VALID = new Set(JELLY_LEVELS.map(([k]) => k));

export function loadLevel() {
  try { const v = localStorage.getItem(KEY); return VALID.has(v) ? v : null; } catch { return null; }
}
export function saveLevel(level) {
  try { localStorage.setItem(KEY, level); } catch { /* 저장 못 해도 이번 판에는 적용됨 */ }
}

const CSS = `
#ow-set-btn { position: fixed; top: 12px; right: 364px; z-index: 12; width: 34px; height: 34px; border-radius: 10px;
  border: 1px solid rgba(23,50,63,.14); background: rgba(255,255,255,.86); backdrop-filter: blur(6px);
  font: 17px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 2px 8px rgba(10,40,60,.12); }
#ow-set { position: fixed; top: 52px; right: 364px; z-index: 12; min-width: 200px; padding: 10px 12px 12px; border-radius: 12px;
  background: rgba(255,255,255,.94); border: 1px solid rgba(23,50,63,.14); box-shadow: 0 6px 20px rgba(10,40,60,.18);
  font: 13px/1.4 system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #17323f; }
#ow-set[hidden] { display: none; }
#ow-set h3 { margin: 0 0 8px; font-size: 14px; }
#ow-set .row { display: flex; gap: 6px; align-items: center; }
#ow-set .lab { min-width: 46px; opacity: .72; }
#ow-set button { font: inherit; color: inherit; background: #fff; border: 1px solid rgba(23,50,63,.18); border-radius: 8px; padding: 4px 9px; cursor: pointer; }
#ow-set button.on { background: #2a8fb8; border-color: #2a8fb8; color: #fff; }
#ow-set .hint { margin-top: 8px; font-size: 12px; opacity: .65; }
body.intro #ow-set-btn, body.intro #ow-set, body.capture #ow-set-btn, body.capture #ow-set { display: none; }
@media (max-width: 899px) { #ow-set-btn { right: 12px; } #ow-set { right: 12px; } }
`;

/**
 * @param {{ level: string, onChange: (level: string) => void }} o
 * @returns {{ set(level: string): void, el: HTMLElement }}
 */
export function createSettings(o) {
  if (typeof document === 'undefined') return { set() {}, el: null };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'ow-set-btn';
  btn.type = 'button';
  btn.title = '설정';
  btn.setAttribute('aria-label', '설정');
  btn.textContent = '⚙️';

  const box = document.createElement('div');
  box.id = 'ow-set';
  box.hidden = true;
  box.innerHTML = '<h3>설정</h3><div class="row"><span class="lab">출렁임</span><span class="row" data-k="lv"></span></div>' +
    '<div class="hint">멀미가 나면 약하게나 끄기로 바꿔 보세요</div>';
  const row = box.querySelector('[data-k=lv]');
  const buttons = new Map();
  for (const [k, label] of JELLY_LEVELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = () => { set(k); saveLevel(k); o.onChange(k); };
    buttons.set(k, b);
    row.appendChild(b);
  }
  function set(level) { for (const [k, b] of buttons) b.classList.toggle('on', k === level); }
  set(o.level);

  btn.onclick = (e) => { e.stopPropagation(); box.hidden = !box.hidden; };
  // 창 밖을 누르면 닫음(게임 누르기는 그대로 전달)
  document.addEventListener('pointerdown', (e) => {
    if (!box.hidden && !box.contains(e.target) && e.target !== btn) box.hidden = true;
  }, true);
  for (const el of [btn, box]) el.addEventListener('pointerdown', (e) => e.stopPropagation());

  document.body.append(btn, box);
  return { set, el: box };
}
