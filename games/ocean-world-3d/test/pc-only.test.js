// PC 전용 판정(ui/pc-only.js isMobileDevice). 브라우저 없이 환경 값을 넣어 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMobileDevice } from '../ui/pc-only.js';

const pc = { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/157.0 Safari/537.36', uaMobile: false, platform: 'MacIntel', touchPoints: 0, coarseOnly: false };

test('데스크톱·노트북은 PC', () => {
  assert.equal(isMobileDevice(pc), false);
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0', platform: 'Win32' }), false);
  // 터치스크린 노트북: 터치 지점은 있지만 터치패드(정밀 포인터)도 있음
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/157.0', platform: 'Win32', touchPoints: 10 }), false);
});

test('휴대폰·태블릿은 모바일', () => {
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148', platform: 'iPhone', touchPoints: 5 }), true);
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (Linux; Android 15; SM-S928N) Chrome/157.0 Mobile', platform: 'Linux armv8l', uaMobile: true }), true);
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (Linux; Android 15; SM-X910) Chrome/157.0', platform: 'Linux armv8l' }), true); // 안드로이드 태블릿
  assert.equal(isMobileDevice({ ...pc, touchPoints: 5 }), true); // iPadOS 데스크톱 모드(Mac UA + 터치)
  assert.equal(isMobileDevice({ ...pc, ua: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64', coarseOnly: true }), true); // 손가락만
});
