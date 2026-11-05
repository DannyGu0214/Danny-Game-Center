// 이미지 모델로 만든 그림(assets/*.webp)을 불러오고 고른다. 인물은 표정별 파일, 배경은 카페·날씨별 파일이다.
const cache = new Map();

export function img(name) {
  let e = cache.get(name);
  if (!e) {
    e = new Image();
    e.decoding = 'async';
    e.src = `assets/${name}.webp`;
    cache.set(name, e);
  }
  return e.complete && e.naturalWidth > 0 ? e : null;
}
export function preload(names) {
  return Promise.all(names.map((n) => new Promise((done) => {
    img(n);
    const e = cache.get(n);
    if (e.complete) { done(); return; }
    e.addEventListener('load', done, { once: true });
    e.addEventListener('error', done, { once: true });
  })));
}

// 게임의 기분(mood)을 파일 표정으로 옮긴다. look: 'suit'(회사 옷), 'casual'(주말 옷)
export function portraitOf(id, choices, mood = 'calm', look = '') {
  if (id === 'hero') {
    const h = `hero${choices.hero}`;
    if (look === 'suit') return `${h}-${mood === 'tired' || mood === 'sad' ? 'suittired' : 'suit'}`;
    if (look === 'casual') return `${h}-casual`;
    return `${h}-${mood === 'smile' || mood === 'closed' ? 'smile' : mood === 'surprised' ? 'surprised' : 'calm'}`;
  }
  if (id === 'owner') {
    const o = `owner${choices.owner}`;
    return `${o}-${mood === 'surprised' ? 'surprised' : mood === 'scold' ? 'scold' : mood === 'sad' || mood === 'tired' ? 'sad' : 'smile'}`;
  }
  if (id === 'junior') return `junior-${mood === 'smile' || mood === 'closed' ? 'smile' : 'tired'}`;
  return `${id}-${mood === 'surprised' ? 'surprised' : 'smile'}`;
}
export function storyAssets(choices) {
  const { hero: h, owner: o, place } = choices;
  const names = ['st-bench', 'sp-grinder', 'sp-machine', 'sp-portafilter', 'sp-tamper', 'sp-kettle', 'sp-dripper', 'sp-roaster', 'sp-key', 'sp-cup', 'sp-pitcher', 'sp-latte-base', 'sp-latte-heart', 'sp-nozzle', 'sp-dripper-side', `room-${place}`];
  for (const w of ['sun', 'cloud', 'rain']) names.push(`bar-${place}-${w}`);
  for (const f of ['day', 'night']) names.push(`front-${place}-${f}`);
  names.push('cut-night', 'cut-sketch', 'cut-notice');
  for (const m of ['calm', 'smile', 'surprised', 'suit', 'suittired', 'casual']) names.push(`hero${h}-${m}`);
  for (const m of ['smile', 'surprised', 'scold', 'sad']) names.push(`owner${o}-${m}`);
  return names;
}
