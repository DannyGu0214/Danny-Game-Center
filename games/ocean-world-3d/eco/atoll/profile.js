// 열대 환초(몰디브형) 빛·물빛 값 묶음. 순수 데이터(Three.js·DOM 없음).
// 렌더는 이 값을 uniform으로만 넣는다. 생태계를 바꾸면 이 파일만 바뀐다(조사 문서 3.4절).
// 색은 sRGB 16진수. 흡수·산란 계수는 "칸당"(1칸 ≈ 실제 0.4m 가안) 값이다.

export const ENV = {
  background: 0xeaf3f4,      // 탁자 위 디오라마 느낌의 옅은 하늘빛 회백색
  hemiSky: 0xfff6e8,
  hemiGround: 0xc9d7cf,
  hemiIntensity: 1.05,
  sunColor: 0xfff1dc,
  sunIntensity: 2.1,
  sunDir: [0.45, 1.0, 0.55],  // Three 좌표(위 +Y). 높은 열대 태양
  envIntensity: 0.55,
  exposure: 1.0,
};

// 2026-11-11 대니님 방향 "바다색은 조금 더 연하고 밝게": 깊은 쪽 산란색과 초록·파랑 흡수를 한 단계 밝게.
// 빨강 흡수(청록 기운)는 그대로 두어 얕은 곳이 희게 날아가지 않게 했다. 되돌리려면 각 줄의 '전' 값.
export const WATER = {
  // 물속 안개(3.2.2) + 열대 물빛(3.3.5): 빨강을 강하게, 초록 중간, 파랑을 약하게 흡수
  absorption: [0.24, 0.075, 0.037],   // σ(칸당). 2026-11-11 전: [0.24, 0.085, 0.042]
  scatter: 0x3594ba,                   // 긴 경로 끝의 물색(산란광). 바깥 바다·칸두의 파랑. 전: 0x1f7fa6
  scatterDeep: 0x1d5f8f,               // 깊은 곳 산란광(수심에 따라 섞음). 전: 0x0d3f6e
  lightAbsorb: 0.52,                  // 위에서 내려온 빛이 깊이에 따라 줄어드는 정도(σ 배율). 전: 0.6
  shallowTint: 0x7fe0d6,               // 얕은 바닥 위 청록 보정
  causticGain: 0.75,
  causticScale: 0.55,                  // 칸당 무늬 밀도
  surfaceColor: 0x8fdcd8,              // 수면·물 벽 광택층의 바탕색
  surfaceOpacity: [0.05, 0.55],        // 수직으로 볼 때 / 비스듬히 볼 때(프레넬)
  waterline: 0xffffff,
  waveAmp: 0.08,                       // 잔물결(셰이더) 세기
  foam: 0.6,
  particleDensity: 1.0,
  shaftCount: 7,
  // 참고 사례 방식(투과) 비교용 값
  transmission: { attenuationColor: 0x1d6f9c, attenuationDistance: 9, thickness: 6, ior: 1.33 },
};

// 지형 꼭짓점 색(지형 종류·높이로 고름)
export const TERRAIN_COLORS = {
  veg: 0x6fae4f, vegDark: 0x4f8f3c,
  drySand: 0xf3e6c4, wetSand: 0xd9c79c,
  lagoonSand: 0xf5efdc, reefFlat: 0xd8c29a, coralPink: 0xe59a8c, coralOchre: 0xd7a85a,
  thilaRock: 0xa9907a, thilaCoral: 0xd77f9b,
  kanduSand: 0xb8b2a2, slope: 0xc7b48f, dropoff: 0x8e8070,
};

// 블록 옆면 지층(아래에서 위로). top: 이 층의 위 끝 높이(칸)
export const STRATA = [
  { top: -11.0, color: 0x6c6a66 },   // 오래된 현무암 기반
  { top: -8.2, color: 0x9c8f7d },    // 오래된 석회암
  { top: -5.6, color: 0xc9b48e },    // 산호 석회암
  { top: -3.4, color: 0xe1d0a8 },    // 산호 조각 퇴적층
  { top: -1.6, color: 0xd7c39a },    // 산호 바위
  { top: 99, color: 0xf1e7cc },      // 흰 모래
];
export const STRATA_BOTTOM = 0x55534f;
