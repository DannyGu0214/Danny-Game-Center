// 수면 파동: 격자 파동방정식(이웃 4칸 라플라시안 + 감쇠). 육지 칸은 반사 경계.
// 좌표는 격자(칸) 기준. 높이 h는 수면(0)에서의 변위(칸).
export class Heightfield {
  /**
   * @param {{x0,y0,x1,y1}} bounds
   * @param {(x:number,y:number)=>number} heightAt 지형 높이(칸)
   * @param {number} dx 칸 간격(칸)
   */
  constructor(bounds, heightAt, dx = 0.5) {
    this.b = bounds; this.dx = dx;
    this.nx = Math.round((bounds.x1 - bounds.x0) / dx) + 1;
    this.ny = Math.round((bounds.y1 - bounds.y0) / dx) + 1;
    const n = this.nx * this.ny;
    this.h = new Float32Array(n); this.v = new Float32Array(n);
    this.wall = new Uint8Array(n); this.ground = new Float32Array(n); this.shore = new Float32Array(n);
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const g = heightAt(bounds.x0 + i * dx, bounds.y0 + j * dx);
      const k = j * this.nx + i;
      this.ground[k] = g;
      this.wall[k] = g > -0.05 ? 1 : 0;
      this.shore[k] = Math.max(0, 1 - Math.abs(g + 0.25) / 0.6); // 물가(얕은 곳) 정도
    }
    this.c = 3.2;          // 파속(칸/초)
    this.damp = 0.9;       // 감쇠(1/초)
    this.limit = 0.7;
    this.wind = 0.25;      // 무작위 미세 충격 세기
    this._seed = 12345;
  }
  _rand() { this._seed = (this._seed * 1664525 + 1013904223) >>> 0; return this._seed / 4294967296; }

  step(dt) {
    dt = Math.min(dt, 1 / 30);
    const sub = 2, h = dt / sub;
    const { nx, ny } = this;
    const kk = this.c * this.c * h / (this.dx * this.dx);
    const H = this.h, V = this.v, W = this.wall;
    const damp = 1 - this.damp * h;
    for (let s = 0; s < sub; s++) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (W[k]) continue;
        const c0 = H[k];
        const l = i > 0 && !W[k - 1] ? H[k - 1] : c0;
        const r = i < nx - 1 && !W[k + 1] ? H[k + 1] : c0;
        const d = j > 0 && !W[k - nx] ? H[k - nx] : c0;
        const u = j < ny - 1 && !W[k + nx] ? H[k + nx] : c0;
        V[k] = (V[k] + kk * (l + r + u + d - 4 * c0)) * damp;
      }
      const lim = this.limit;
      for (let k = 0; k < H.length; k++) {
        if (W[k]) { H[k] = 0; continue; }
        const nh = H[k] + V[k] * h;
        H[k] = nh > lim ? lim : nh < -lim ? -lim : nh;
      }
    }
    // 바람: 무작위 칸에 아주 작은 충격
    const m = Math.round(12 * this.wind);
    for (let q = 0; q < m; q++) {
      const k = Math.floor(this._rand() * H.length);
      if (!W[k]) V[k] += (this._rand() - 0.5) * 0.35;
    }
  }

  /** 가우스 교란: 격자 (x, y) 둘레 반경 r(칸)에 amt만큼 */
  disturb(x, y, r, amt) {
    const { nx, ny, dx } = this;
    const ci = (x - this.b.x0) / dx, cj = (y - this.b.y0) / dx, rr = r / dx;
    const i0 = Math.max(0, Math.floor(ci - 2 * rr)), i1 = Math.min(nx - 1, Math.ceil(ci + 2 * rr));
    const j0 = Math.max(0, Math.floor(cj - 2 * rr)), j1 = Math.min(ny - 1, Math.ceil(cj + 2 * rr));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i;
      if (this.wall[k]) continue;
      const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (rr * rr);
      this.v[k] += amt * Math.exp(-d2);
    }
  }

  /** 블록 가속도에 따른 쏠림: 수면 전체에 선형 기울기 속도를 더한다(ax, ay: 격자 방향 가속도). */
  slosh(ax, ay, dt) {
    const { nx, ny, dx } = this;
    const cx = (nx - 1) / 2, cy = (ny - 1) / 2;
    const s = 0.02 * dt;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (this.wall[k]) continue;
      this.v[k] -= s * (ax * (i - cx) * dx + ay * (j - cy) * dx);
    }
  }

  /** 쌍선형 표본(칸 좌표) */
  sample(x, y) {
    const fi = Math.max(0, Math.min(this.nx - 1.001, (x - this.b.x0) / this.dx));
    const fj = Math.max(0, Math.min(this.ny - 1.001, (y - this.b.y0) / this.dx));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const k = j * this.nx + i, H = this.h;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + this.nx] * (1 - u) + H[k + this.nx + 1] * u) * v;
  }
  /** 중앙 차분 기울기(격자 방향) */
  gradient(x, y, out) {
    const e = this.dx;
    out.x = (this.sample(x + e, y) - this.sample(x - e, y)) / (2 * e);
    out.y = (this.sample(x, y + e) - this.sample(x, y - e)) / (2 * e);
    return out;
  }
  energy() { let s = 0; for (let k = 0; k < this.h.length; k += 7) s += Math.abs(this.h[k]); return s; }
}
