// 본게임 이벤트(DESIGN 5.9절): 찾아오는 사람들과의 대화, 박람회, 해금. 조건 판단은 business.js의 eventDue다.
// 말투 규칙: '합니다'체 금지. 주인공은 가족과 오랜 친구, 후배에게 반말, 그 밖에는 존댓말. 혼잣말(narr)은 편한 말.
//
// 대본 한 줄의 종류
//  { who, text, mood }  대사. mood는 찾아온 사람의 표정이다
//  { brew: { menu, do, title }, good: [...], other: [...] }  한 잔을 내리고, 맛에 따라 대사만 달라진다. 점수에 넣지 않는다
//  { ask, options: [[고르는 말, [대본]], ...] }  대답을 고른다. 대사만 달라진다
//  { note: id }  커피 노트에 적는다
//  { unlock: id }  해금한다
const say = (who, text, mood) => ({ who, text, mood });
const N = 'narr', H = 'hero', Y = 'sys';

export const FAIR_ID = 'fair';

export const EVENTS = [
  {
    id: 'fair-news', phase: 'close', minStars: 100, maxDay: 19, kind: 'fair-news',
    visitor: { office: 'oh', home: 'park' },
    script: {
      office: [
        say('oh', '사장님, 커피·티 박람회라고 아세요? 내일 전시장에서 열린대요.'),
        say(H, '박람회요? 그런 것도 있어요?'),
        say('oh', '원두 파는 사람, 기계 파는 사람, 차 우리는 사람까지 다 모여요. 은퇴하면 뭐라도 배워 볼까 해서 알아봤거든요.'),
        say('oh', '사장님처럼 막 시작한 분은 한 번 보면 좋을 거예요. 세상에 커피가 이렇게 많구나 싶을걸요.'),
      ],
      home: [
        say('park', '사장님, 동네 소식지에서 봤는데, 내일 큰 전시장에서 커피·티 박람회를 한대요.'),
        say(H, '박람회요? 그런 것도 있어요?'),
        say('park', '나는 이제 다리가 아파서 못 가지만, 젊을 땐 그런 데 다니는 게 참 좋았어요. 찻잎 냄새만 맡아도 즐겁거든요.'),
        say('park', '사장님은 꼭 한번 가 봐요. 커피 세상이 생각보다 넓어요.'),
      ],
    },
  },
  {
    id: 'baker', phase: 'close', after: FAIR_ID, gap: 2, minStars: 250, visitor: 'baker',
    script: [
      say('baker', '계세요? 문 닫을 시간에 미안해요. 근처에서 제과점 하는 윤이에요.'),
      say(H, '아, 네. 어서 오세요.'),
      say('baker', '박람회에서 서 매니저가 사장님 얘기를 하더라고요. 혼자서 열심히 하는 집이 있다고요.'),
      say(H, '저희요? 아직 별것도 없는데요.'),
      say('baker', '우리 쿠키랑 구움과자를 여기에 좀 놓아 보면 어떨까 해서요. 아침에 필요한 만큼만 받아 가면 돼요.'),
      say(H, '일단 커피부터 한 잔 드세요.'),
      {
        brew: { menu: 'espresso', do: ['extract'], title: '윤 사장님께 내리는 한 잔' },
        good: [say('baker', '이거 큰일이네. 우리 빵이 커피한테 밀리겠어요.', 'surprised')],
        other: [say('baker', '아직 손이 덜 풀렸네요. 괜찮아요, 내가 처음 구운 빵은 돌덩이였어요.')],
      },
      say('baker', '남으면 저녁에 버려야 하니까 처음엔 조금씩만 받아요. 나도 그게 제일 아까워요.'),
      { unlock: 'dessert' },
      say(Y, '이제 아침마다 디저트를 들일 수 있어요.'),
    ],
  },
  {
    id: 'friend', phase: 'morning', minDay: 5, visitor: 'friend',
    script: [
      say('friend', '야, 진짜네. 진짜 앞치마 입고 있네.'),
      say(H, '일찍도 왔다. 아직 문 열기 전인데.'),
      say('friend', '문 열면 바쁠 거 아냐. 자, 이거 화분. 죽이지만 마라.'),
      say(H, '이름이 뭔데?'),
      say('friend', '몰라. 꽃집 아저씨가 잘 안 죽는 거래.'),
      {
        brew: { menu: 'latte', do: ['steam'], title: '수현이에게 내리는 한 잔' },
        good: [say('friend', '뭐야, 맛있네? 네가 이런 걸 한다는 게 아직도 웃겨.')],
        other: [say('friend', '맛은 잘 모르겠고, 네가 타 줬다는 게 웃겨.')],
      },
      say('friend', '솔직히 좀 부러워. 나는 아직 거기 그대로거든.', 'sad'),
      say(H, '부러울 거 없어. 어제도 손님 한 명 그냥 갔어. 그거 때문에 잠 못 잤어.'),
      say('friend', '그거 봐. 잠 못 자는 이유가 바뀌었잖아.'),
      say('friend', '또 올게. 화분 살아 있나 보러.'),
    ],
  },
  {
    id: 'mom', phase: 'close', minDay: 11, visitor: 'mom',
    script: [
      say('mom', '가게가 생각보다 작네.'),
      say(H, '오신다고 말을 하지.'),
      say('mom', '말하면 치우고 꾸밀 거잖아. 그냥 어떻게 사나 보고 싶었어.'),
      {
        brew: { menu: 'americano', do: ['extract', 'water'], title: '엄마에게 내리는 한 잔' },
        good: [say('mom', '쓰긴 쓰다. 근데 향은 좋네. 다 마실게.')],
        other: [say('mom', '쓰긴 쓰다. 그래도 네가 타 준 거니까 다 마실게.')],
      },
      say(H, '아빠는 뭐래?'),
      say('mom', '말은 안 해. 근데 네 가게 이름은 찾아보더라.', 'sad'),
      say('mom', '밥은 먹고 하니?'),
      {
        ask: '뭐라고 할까요?',
        options: [
          ['손님 없을 때 먹어', [say(H, '손님 없을 때 먹어.'), say('mom', '손님이 없으면 안 되지.')]],
          ['잘 먹고 있어', [say(H, '잘 먹고 있어.'), say('mom', '얼굴은 안 그런데.', 'sad')]],
        ],
      },
      say('mom', '반찬은 냉장고에 넣어 놔.'),
      say(N, '엄마가 가고 반찬통을 열어 봤어. 멸치볶음이네. 어릴 땐 제일 싫어했는데.'),
      say(N, '그날 밥 한 공기를 다 먹었어.'),
    ],
  },
  {
    id: 'junior', phase: 'close', minDay: 14, visitor: 'junior',
    script: [
      say('junior', '선배, 아직 안 닫으셨죠? 야근 빼고 도망 왔어요.', 'smile'),
      say(H, '지수야, 이 시간에 회사는 어쩌고?'),
      say('junior', '선배가 쓰던 그 보고서요. 이번 달부터 제가 써요. 왜 밤마다 불이 켜져 있었는지 이제 알겠어요.', 'tired'),
      say(H, '그거 미안하다. 내가 남기고 왔네.'),
      {
        brew: { menu: 'americano', do: ['extract', 'water'], title: '지수에게 내리는 한 잔' },
        good: [say('junior', '저번보다 더 맛있어졌어요. 손이 달라졌네요, 사장님.', 'smile')],
        other: [say('junior', '괜찮아요. 오늘은 쓴 게 당겨요.', 'tired')],
      },
      {
        ask: '지수가 컵만 보고 있어요.',
        options: [
          ['너도 그만두고 싶어?', [say(H, '너도 그만두고 싶어?'), say('junior', '아뇨, 아직은요. 그냥 여기 오면 그 말을 안 해도 될 것 같아서요.', 'tired')]],
          ['밥은 먹었어?', [say(H, '밥은 먹었어?'), say('junior', '선배까지 우리 엄마 같은 소리 하세요. 아직요.', 'smile'), say(H, '나도 그때 못 먹었어. 먹고 해.')]],
        ],
      },
      say('junior', '또 올게요. 여기 오면 숨이 좀 쉬어져요.', 'smile'),
      say(N, '그 말, 내가 예전에 이 가게에 올 때 하던 생각이야.'),
    ],
  },
];

// 커피·티 박람회: 가게를 하루 쉬고 참가한다
export const FAIR = {
  name: '커피·티 박람회',
  open: [
    say(N, '문에 "오늘 하루 쉬어요" 종이를 붙이고 나왔어. 사장 되고 처음 쉬는 날이네.'),
    say(N, '전시장에 들어서자마자 커피 향이 확 밀려와. 원두, 기계, 찻잎… 통로 끝이 안 보여.'),
    say(N, '닷새 배우고 제법 안다고 생각했는데, 나 아직 아무것도 모르네.'),
  ],
  question: '어디로 가 볼까요?',
  booths: [
    {
      id: 'origin', label: '산지 원두 부스',
      script: [
        say('booth', '한 모금 드셔 보세요. 에티오피아 원두예요. 꽃향이 나죠?'),
        say(H, '커피에서 꽃향이요? 어, 정말 나네요.'),
        say('booth', '커피는 어디서 자랐는지에 따라 이렇게 달라요. 그걸 산지라고 불러요.'),
        { note: 'fairOrigin' },
      ],
    },
    {
      id: 'roast', label: '로스터리 부스',
      script: [
        say('booth', '같은 원두예요. 이쪽은 짧게, 이쪽은 오래 볶았어요. 비교해 보세요.'),
        say(H, '같은 원두인데 이렇게 달라요?'),
        say('booth', '짧게 볶으면 산뜻하고, 오래 볶으면 진하고 쌉쌀해져요. 볶는 사람 마음이 다 들어가죠.'),
        { note: 'fairRoast' },
      ],
    },
    {
      id: 'tea', label: '차 부스',
      script: [
        say('booth', '커피만 드시다 오셨죠? 잠깐 쉬어 가세요. 우롱차예요.'),
        say(H, '아, 속이 편해지네요.'),
        say('booth', '같은 찻잎도 어떻게 만드느냐에 따라 녹차, 우롱차, 홍차가 돼요. 커피처럼 세계가 넓어요.'),
        { note: 'fairTea' },
      ],
    },
  ],
  consultLabel: '장비 상담 받기',
  consult: [
    say('staff', '어서 오세요. 가게를 막 시작하셨군요. 하루에 몇 잔쯤 나가요?'),
    say(H, '스무 잔 남짓이요. 아직 혼자 해요.'),
    say('staff', '혼자면 손이 제일 귀하죠. 어떤 때가 제일 바쁘세요?'),
  ],
  consultAsk: '어떤 때가 제일 바쁜가요?',
  needs: [
    { equip: 'pitcher', label: '라떼 스팀이 오래 걸려요', reply: '그럼 자동 스팀 피처를 보세요. 라떼도 자동으로 만들 수 있어요. 직접 치면 맛은 더 좋지만요.' },
    { equip: 'grinder', label: '가루 담는 게 손이 많이 가요', reply: '그럼 자동 도징 그라인더가 좋아요. 직접 만들 때 가루 담기를 맡길 수 있어요.' },
  ],
  close: [
    say('staff', '무리해서 한꺼번에 들이실 필요 없어요. 상담 내용 적어 드릴 테니까, 돈이 모이면 하나씩 들이세요.'),
    { unlock: 'equip' },
    say(Y, '이제 마감 화면에서 장비를 들일 수 있어요.'),
    say(N, '돌아오는 길, 가방이 팸플릿으로 묵직해. 내일도 아메리카노부터 뽑겠지만, 기분이 이상하게 좋아.'),
  ],
};

// 대본의 모든 글을 모은다(말투 검사에 쓴다)
export function textsOf(script) {
  const out = [];
  for (const s of script) {
    if (s.text) out.push(s.text);
    if (s.ask) out.push(s.ask);
    if (s.good) out.push(...textsOf(s.good));
    if (s.other) out.push(...textsOf(s.other));
    if (s.options) for (const [label, lines] of s.options) out.push(label, ...textsOf(lines));
  }
  return out;
}
