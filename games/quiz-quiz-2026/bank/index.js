// 문제은행 묶음. 분야 파일 6개를 한 배열로 모아요. 게임은 BANK를 읽어요(설계 10.9절 형식).
import science from './science.js';
import history from './history.js';
import geo from './geo.js';
import art from './art.js';
import general from './general.js';
import nonsense from './nonsense.js';
export const BANK = [...science, ...history, ...geo, ...art, ...general, ...nonsense];
export { default as SOURCES } from './sources.js';
