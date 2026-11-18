// PC 전용 관문(P5 게임 센터 등록). 휴대폰·태블릿으로 열면 게임(three.js)을 불러오지 않고 안내만 보여 준다.
// 판정(화면 폭은 쓰지 않음: 노트북 창을 좁혀도 PC로 본다):
//   1) UA-CH navigator.userAgentData.mobile
//   2) UA 문자열의 Android·iPhone·iPad·iPod·Mobile 등
//   3) iPadOS 데스크톱 모드(platform MacIntel + 터치 지점 2개 이상)
//   4) 정밀 포인터(마우스·터치패드)가 하나도 없고 거친 포인터(손가락)만 있음
// 터치스크린 노트북은 터치패드가 있어 4)에 걸리지 않는다.
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile|webOS|BlackBerry/i;

export function isMobileDevice(env) {
  const e = env || {
    ua: navigator.userAgent || '',
    uaMobile: navigator.userAgentData ? navigator.userAgentData.mobile : undefined,
    platform: navigator.platform || '',
    touchPoints: navigator.maxTouchPoints || 0,
    coarseOnly: !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches),
  };
  if (e.uaMobile === true) return true;
  if (MOBILE_UA.test(e.ua)) return true;
  if (e.platform === 'MacIntel' && e.touchPoints > 1) return true;
  return !!e.coarseOnly;
}

export function showPcOnly() {
  document.title = 'Ocean World 3D · PC에서 플레이해 주세요';
  const s = document.createElement('style');
  s.textContent = `
    html, body { margin: 0; height: 100%; background: linear-gradient(#bfe6f2, #5fb4cf); }
    body > *:not(#pc-only) { display: none !important; }
    #pc-only { box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; padding: 32px 20px; text-align: center; color: #17323f;
      font: 16px/1.55 system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
    #pc-only img { width: 112px; height: 112px; border-radius: 26px; box-shadow: 0 8px 24px rgba(10,40,60,.25); }
    #pc-only h1 { margin: 6px 0 0; font-size: 24px; }
    #pc-only .card { max-width: 340px; background: rgba(255,255,255,.88); border-radius: 16px; padding: 16px 18px; box-shadow: 0 6px 20px rgba(10,40,60,.15); }
    #pc-only b { color: #1f6f8b; }
    #pc-only a { display: inline-block; margin-top: 4px; padding: 10px 18px; border-radius: 12px; background: #1f8fb0; color: #fff; text-decoration: none; font-weight: 600; }
    #pc-only .url { word-break: break-all; font-size: 13px; opacity: .75; margin-top: 8px; }`;
  document.head.appendChild(s);
  const box = document.createElement('main');
  box.id = 'pc-only';
  box.innerHTML = `
    <img src="icons/icon-192.png" alt="">
    <h1>Ocean World 3D</h1>
    <div class="card">
      이 게임은 <b>PC·노트북 전용</b>이에요.<br>
      휴대폰·태블릿에서는 플레이할 수 없어요.<br>
      컴퓨터 브라우저로 아래 주소를 열어 주세요.
      <div class="url"></div>
    </div>
    <a href="../../">게임 센터로 돌아가기</a>`;
  box.querySelector('.url').textContent = location.origin + location.pathname;
  document.body.appendChild(box);
}
