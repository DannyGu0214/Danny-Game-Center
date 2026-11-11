// 프롤로그 이야기 데이터(PLAN.md 8.3절 "이야기 초안 2"를 그대로 옮김).
// 인물 이름·생김새·대사는 대니님이 아직 확인하지 않은 가안이다. 문장을 바꿀 때는 이 파일만 고친다.
// art: 게임 폴더(games/ocean-world-3d/) 기준 경로. docs/asset-manifest.yaml의 파일명과 같아야 한다.
// who: speakers의 키. null이면 해설(이름표 없이 기울임 글씨).

export const PROLOGUE = {
  title: '젤리에 담은 바다',
  nextLabel: '다음 →',
  finishLabel: '바다 가꾸러 가기 →',
  skipLabel: '건너뛰기',
  speakers: {
    director: { name: '윤슬 소장', tag: '#2f8f8a' },
    rookie: { name: '파랑', tag: '#c9543e' },
  },
  pages: [
    {
      art: 'assets/story/institute.webp',
      alt: '환초 모래섬 위의 연구소 전경. 아침 빛 속 수상 데크에 두 사람이 서 있다.',
      lines: [
        { who: null, text: '열대 바다 한가운데 작은 모래섬, 해양생태계 연구소.' },
        { who: 'director', text: '오늘도 산호가 잘 자랐네요. 파랑 씨, 이 풍경을 우리만 보는 게 아깝지 않아요?' },
      ],
    },
    {
      art: 'assets/story/surface.webp',
      alt: '수면을 경계로 나뉜 장면. 위에는 바다를 바라보는 두 사람, 아래에는 화려한 산호초.',
      lines: [
        { who: 'director', text: '바다는 지구 겉면의 3분의 2가 넘는데, 사람들 대부분은 물속을 들여다본 적이 없어요. 본 적 없는 걸 아껴 달라고 하기는 어렵죠.' },
        { who: 'rookie', text: '보고서를 아무리 써도 읽는 사람은 우리뿐이고요.' },
      ],
    },
    {
      art: 'assets/story/idea.webp',
      alt: '밤의 연구실. 노트북 빛을 받으며 설명하는 파랑과 찻잔을 든 채 고개를 갸웃하는 소장.',
      lines: [
        { who: 'rookie', text: '소장님, 제가 요즘 AI 공부에 푹 빠져 있잖아요. 그걸로 바다 한 조각을 통째로 옮겨 보면 어때요? 누구나 손끝으로 돌려 보고 들여다볼 수 있게요.' },
        { who: 'director', text: '바다를… 옮긴다고요?' },
      ],
    },
    {
      art: 'assets/story/jelly.webp',
      alt: '탁자 위에서 은은히 빛나는 투명한 젤리 블록. 그 안의 작은 바다를 두 사람이 들여다본다.',
      lines: [
        { who: 'rookie', text: '투명한 젤리 블록에 담는 거예요. 건드리면 말랑하게 출렁이고, 안에서는 생물들이 어울려 살아요.' },
        { who: 'director', text: '해파리가 제일 좋아하겠네요. 좋아요, 우리가 아는 바다를 다 담아 봅시다.' },
      ],
    },
    {
      art: 'assets/story/invite.webp',
      alt: '젤리 블록을 이쪽으로 내미는 두 사람. 블록의 빛이 얼굴에 비친다.',
      lines: [
        { who: 'director', text: '이제 이 작은 바다를 당신에게 맡길게요. 생물을 들이고, 살 곳을 가꿔 주세요.' },
        { who: 'rookie', text: '알게 될수록 더 아끼게 될 거예요. 자, 들어가 볼까요?' },
      ],
    },
  ],
};
