import { defineConfig } from 'vite';

// base './': 산출물이 상대경로만 쓰므로 GitHub Pages의 /Danny-Game-Center/games/proto-3d/dist/ 처럼
// 어느 하위 경로에 놓여도 열려요. 산출물 위치(dist/)는 docs/game-dev/pipeline.md의 배포 A안을 따라요.
// 포트는 작업 폴더끼리 겹치지 않게 고정해요.
export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 4183, strictPort: true },
});
