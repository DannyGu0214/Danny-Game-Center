// 테스트·봇 대전용 샘플 문항(시범 60개, 출처 대조 전). 형식은 설계 10.9절.
// 실제 문제은행은 bank/ 이고 g-quiz-bank 칸(claude/quiz-quiz-bank)이 맡는다. 게임은 bank/index.js가 없으면 이 샘플로 돈다.
import science from './science.js';
import history from './history.js';
import geo from './geo.js';
import art from './art.js';
import general from './general.js';
import nonsense from './nonsense.js';
export const BANK = [...science, ...history, ...geo, ...art, ...general, ...nonsense];
export { default as SOURCES } from './sources.js';
