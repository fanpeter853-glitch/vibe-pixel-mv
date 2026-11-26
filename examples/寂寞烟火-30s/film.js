const W = 480, H = 270, SCALE = 4, FPS = 30, DUR = 30;
window.FPS = FPS; window.DUR = DUR;

const B = 0.41796;                 // 143.55 BPM 的一拍
const T1 = 5 * B;                  // 2.09  片名卡结束
const T2 = T1 + 22 * B;            // 11.29 街景结束
const T3 = T2 + 24 * B;            // 21.31 天台结束
const T4 = 27.95;                  // 静场起点

const C = {
  ink:   '#080a0e',
  night: '#0d1119',
  dusk:  '#121824',
  far:   '#151c28',
  wall:  '#2a2029',
  wallHi:'#352a33',
  mortar:'#1d151d',
  road:  '#191b22',
  curb:  '#2b2f39',
  warm:  '#f2c66d',
  ember: '#d9822b',
  cream: '#efe6d6',
  red:   '#b23a48',
  green: '#4a7a5c',
  coat:  '#e2a33c',
  skin:  '#ecc196',
  steel: '#6d7683',
  snow:  '#dfe7f2',
};

let g, out, tmp, tg, buf;

function init() {
  const c = document.getElementById('stage');
  c.width = W * SCALE; c.height = H * SCALE;
  out = c.getContext('2d');
  out.imageSmoothingEnabled = false;
  buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  g = buf.getContext('2d');
  g.imageSmoothingEnabled = false;
  window.__buf = buf;
  tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  tg = tmp.getContext('2d');
}

function r(x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function dot(x, y, col) { r(x, y, 1, 1, col); }

function glow(cx, cy, rad, col, mode) {
  g.fillStyle = col;
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > rad) continue;
      const keep = d < rad * 0.3 ? true
        : d < rad * 0.65 ? ((x + y) % 2 === 0)
        : ((x * y) % 3 === 0);
      if (keep) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

// 二值中文字：2 倍超采样绘制后按 2×2 块降采样，笔画才不糊
function btext(str, x, y, size, col, align) {
  const S = 2, WW = W * S, HH = H * S;
  if (!btext.cv) {
    btext.cv = document.createElement('canvas');
    btext.cv.width = WW; btext.cv.height = HH;
    btext.cx = btext.cv.getContext('2d');
  }
  const cx = btext.cx;
  cx.clearRect(0, 0, WW, HH);
  cx.font = (size * S) + 'px "SimHei","Microsoft YaHei",sans-serif';
  cx.textBaseline = 'top';
  const w = cx.measureText(str).width / S;
  let sx = x;
  if (align === 'center') sx = x - w / 2;
  if (align === 'right') sx = x - w;
  sx = Math.round(sx);
  cx.fillStyle = '#fff';
  cx.fillText(str, sx * S, Math.round(y) * S);

  const bx0 = Math.max(0, sx - 1), by0 = Math.max(0, Math.round(y) - 1);
  const bx1 = Math.min(W, Math.ceil(sx + w) + 1), by1 = Math.min(H, Math.round(y) + size + 3);
  const d = cx.getImageData(bx0 * S, by0 * S, (bx1 - bx0) * S, (by1 - by0) * S).data;
  const bw = (bx1 - bx0) * S;
  g.fillStyle = col;
  for (let yy = by0; yy < by1; yy++) {
    let run = -1;
    for (let xx = bx0; xx <= bx1; xx++) {
      let on = false;
      if (xx < bx1) {
        let cnt = 0;
        for (let dy = 0; dy < S; dy++) {
          for (let dx = 0; dx < S; dx++) {
            const px = (xx - bx0) * S + dx, py = (yy - by0) * S + dy;
            if (d[(py * bw + px) * 4 + 3] > 80) cnt++;
          }
        }
        on = cnt >= 2;
      }
      if (on && run < 0) run = xx;
      if (!on && run >= 0) { g.fillRect(run, yy, xx - run, 1); run = -1; }
    }
  }
}

function sticker(x, y, w, h, text, size, tone) {
  r(x + 1, y + 1, w, h, '#05060a');
  r(x, y, w, h, tone || C.cream);
  r(x, y + h - 1, w, 1, '#c8bca8');
  r(x + w - 1, y, 1, h, '#c8bca8');
  if (text) btext(text, x + w / 2, y + (h - size) / 2 - 1, size, C.ink, 'center');
}

// 主角：绿帽 + 黄外套，22 单位高
function guy(x, y, h, dir, frame, seated) {
  const s = h / 22;
  const q = (a, b, w2, h2, col) => r(x + a * s, y + b * s, Math.max(1, w2 * s), Math.max(1, h2 * s), col);
  q(4, 0, 8, 2, C.green);
  q(2.5, 2, 11, 1, C.green);         // 帽檐
  q(4.5, 3, 7, 4, C.skin);
  q(dir > 0 ? 9.5 : 5.5, 4.6, 1, 1, C.ink);
  q(3.5, 7, 9, 7, C.coat);
  q(3.5, 10.5, 9, 1, C.ember);
  if (seated) {
    q(3, 13.5, 10, 1.5, C.ink);
    q(4, 15, 3.4, 5, C.ink);
    q(9, 15, 3.4, 5, C.ink);
  } else {
    const sw = frame ? 0.8 : 0;
    q(4, 14, 3.4, 5.5 + sw, C.ink);
    q(9, 14, 3.4, 5.5 - sw, C.ink);
  }
}

const FLAKES = [];
for (let i = 0; i < 52; i++) {
  FLAKES.push({ x: (i * 97 + 13) % W, y: (i * 61 + 7) % H, sp: 5 + (i % 5) * 2, ph: i % 7 });
}

function burst(cx, cy, t0, t, seed, col) {
  const age = t - t0;
  if (age < 0 || age > 1.05) return;
  const q = Math.floor(age / 0.066) * 0.066;
  const rad = 20 * (1 - Math.exp(-3.4 * q)) + 1.5;
  for (let k = 0; k < 30; k++) {
    const a = k * 0.2094 + seed * 0.9;
    const sp = rad * (0.6 + ((k * seed) % 6) / 10);
    const x = cx + Math.cos(a) * sp, y = cy + Math.sin(a) * sp + q * q * 3;
    if (sp > 2) { dot(x, y, col); dot(x - Math.cos(a) * 2, y - Math.sin(a) * 2, C.ember); }
  }
  if (q < 0.25) { r(cx - 2, cy - 2, 5, 5, C.cream); glow(cx, cy, 9, col); }
}

function sceneTitle(t) {
  r(0, 0, W, H, C.ink);
  const k = Math.min(1, t / 0.45);
  sticker(142, 98, 196, 60, null, 0, C.cream);
  if (k >= 1) btext('寂 寞 烟 火', 240, 110, 26, C.ink, 'center');
  else r(142, 98, 196, 60, C.ink);
  if (t > 1.2) btext('DJ 零二', 240, 166, 12, '#d8cdb6', 'center');
  dot(240, 190, C.warm);
  if (t > 1.6) { dot(234, 194, C.ember); dot(247, 196, C.warm); }
}

function sceneStreet(t) {
  r(0, 0, W, H, C.night);
  for (let i = 0; i < 34; i++) dot((i * 79 + 17) % W, (i * 41 + 9) % 150, '#39414f');

  // 远处楼群，制造纵深
  const FAR = [[6, 34, 96], [40, 26, 84], [70, 44, 104], [116, 30, 90],
               [356, 38, 100], [392, 24, 86], [424, 34, 96], [452, 20, 88]];
  for (const b of FAR) {
    r(b[0], 150 - b[2], b[1], b[2] + 56, C.far);
    for (let wy = 152 - b[2]; wy < 148; wy += 5) {
      for (let wx = b[0] + 2; wx < b[0] + b[1] - 3; wx += 5) {
        if ((wx * 3 + wy) % 7 === 0) dot(wx, wy, C.ember);
      }
    }
  }

  // 左楼：砖墙 + 小窗
  const lx = 0, ly = 62, lw = 152, lh = 148;
  r(lx, ly, lw, lh, C.wall);
  r(lx, ly - 4, lw + 2, 4, C.wallHi);
  for (let y = ly + 4; y < ly + lh; y += 4) r(lx, y, lw, 1, C.mortar);
  for (let wy = ly + 8; wy < ly + 88; wy += 18) {
    for (let wx = lx + 6; wx < lx + lw - 12; wx += 22) {
      const lit = (wx + wy) % 3 === 0;
      r(wx, wy, 8, 7, lit ? C.warm : '#191320');
      if (lit) { r(wx + 1, wy + 1, 6, 4, C.ember); dot(wx + 4, wy + 5, '#f7e0a8'); }
      r(wx + 3, wy + 7, 2, 2, C.mortar);
    }
  }
  r(lx + 22, ly - 12, 10, 8, C.mortar);
  r(lx + 20, ly - 14, 14, 3, C.wallHi);

  // 右楼
  const rx = 330, ry = 76, rw = 150, rh = 134;
  r(rx, ry, rw, rh, C.wallHi);
  r(rx, ry - 4, rw, 4, C.wall);
  for (let y = ry + 4; y < ry + rh; y += 4) r(rx, y, rw, 1, '#241b24');
  for (let wy = ry + 10; wy < ry + 84; wy += 18) {
    for (let wx = rx + 8; wx < rx + rw - 12; wx += 22) {
      const lit = (wx - wy) % 4 === 0;
      r(wx, wy, 8, 7, lit ? C.warm : '#1d1724');
      if (lit) r(wx + 1, wy + 1, 6, 4, '#c98f3c');
    }
  }

  // 巷口远景：把中间的空挡填出纵深
  r(196, 138, 104, 74, '#111823');
  r(196, 138, 104, 1, '#26313f'); r(196, 138, 1, 74, '#26313f');
  for (let wy = 146; wy < 204; wy += 9) {
    for (let wx = 204; wx < 292; wx += 11) {
      if ((wx + wy * 3) % 5 === 0) dot(wx, wy, '#a8712c');
    }
  }
  // 电线和横跨的招牌
  for (let x = 0; x < 196; x++) dot(x, 132 + Math.round(Math.sin(x / 40) * 2), '#3a4150');
  for (let x = 200; x < 330; x++) dot(x, 136 + Math.round(Math.sin(x / 34) * 2), '#3a4150');

  // 店面：雨棚 + 柜台光
  for (let x = 2; x < lw; x += 8) r(x, 186, 8, 4, x % 16 === 0 ? C.red : '#e3d8c4');
  for (let x = rx; x < rx + rw; x += 8) r(x, 190, 8, 4, x % 16 === 0 ? C.green : '#d9cfbc');
  r(0, 190, lw, 22, '#120e15');
  r(rx, 194, rw, 18, '#120e16');
  for (let x = 6; x < lw - 6; x += 14) { r(x, 194, 9, 14, '#3a2a22'); r(x + 1, 195, 7, 8, C.ember); }
  for (let x = rx + 6; x < rx + rw - 8; x += 14) { r(x, 198, 9, 10, '#33261f'); r(x + 1, 199, 7, 6, '#a8712c'); }

  r(14, 150, 14, 26, '#1a1118'); btext('24', 21, 154, 12, C.ember, 'center'); r(14, 150, 14, 1, C.red);
  sticker(352, 132, 54, 18, '面包', 12, '#d8cdb6');

  // 路灯
  r(250, 118, 2, 74, C.steel);
  r(246, 116, 10, 2, C.steel);
  r(244, 114, 5, 3, C.cream);
  glow(246, 116, 12, C.warm);
  for (let yy = 0; yy < 40; yy++) { const wid = 4 + yy * 0.7; for (let xx = 0; xx < wid; xx += 2) g.fillStyle = '#4a3a22', g.fillRect(246 - wid / 2 + xx, 132 + yy, 1, 1); }

  // 路面
  r(0, 212, W, 58, C.road);
  r(0, 212, W, 2, C.curb);
  for (let x = 10; x < W; x += 34) r(x, 240, 16, 2, '#2c3038');

  // 主角从右往左走
  const p = Math.min(1, (t - T1) / (T2 - T1));
  const gx = 344 - 196 * p;
  guy(gx, 214, 40, -1, Math.floor(t * 9) % 2, false);

  r(0, 246, W, 24, '#14161c');
  for (const f of FLAKES) {
    const y = (f.y + t * f.sp) % H;
    const x = (f.x + Math.sin(t * 0.7 + f.ph) * 3 + W) % W;
    if (y > 56) dot(x, y, C.snow);
  }
}

function sceneRoof(t) {
  r(0, 0, W, H, C.night);
  r(0, 60, W, 60, C.dusk);
  for (let i = 0; i < 44; i++) dot((i * 71 + 9) % W, (i * 43 + 5) % 120, '#39414f');

  // 月亮
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) if (x * x + y * y <= 64) dot(398 + x, 44 + y, C.cream);
  }
  r(396, 41, 2, 2, '#cfc5b4'); r(401, 47, 2, 1, '#cfc5b4');

  // 城市剪影
  const BL = [[0, 40, 26], [44, 20, 36], [66, 30, 20], [98, 22, 30], [124, 14, 24],
              [292, 18, 30], [314, 26, 20], [342, 16, 34], [362, 24, 24], [390, 18, 30], [412, 30, 22], [446, 24, 28]];
  for (const b of BL) {
    r(b[0], 172 - b[2], b[1], b[2] + 14, '#111722');
    r(b[0], 172 - b[2], b[1], 1, '#1c2534');
    for (let wy = 172 - b[2] + 4; wy < 168; wy += 5) {
      for (let wx = b[0] + 3; wx < b[0] + b[1] - 3; wx += 5) {
        if ((wx + wy * 2) % 6 === 0) dot(wx, wy, C.ember);
      }
    }
  }

  burst(120, 62, T2 + 1.4, t, 3, C.warm);
  burst(332, 78, T2 + 4.2, t, 5, C.red);
  burst(238, 48, T2 + 7.2, t, 7, C.cream);

  // 天台地面
  r(0, 172, W, 98, '#0f141c');
  for (let y = 176; y < H; y += 6) r(0, y, W, 1, '#0b1017');
  for (let y = 176; y < H; y += 6) {
    const off = ((y / 6) % 2) * 8;
    for (let x = off; x < W; x += 16) r(x, y, 1, 6, '#0b1017');
  }

  // 栏杆 + 坐着的主角
  r(0, 176, W, 2, C.steel);
  for (let x = 8; x < W; x += 26) r(x, 170, 2, 8, '#4e5561');
  guy(146, 150, 38, 1, 0, true);
  r(146, 176, 16, 2, C.ink);

  if (t > T2 + 6.6) {
    sticker(44, 206, 214, 28, '我曾经走过多遥远的路', 15, C.cream);
  }
}

function sceneSpark(t) {
  r(0, 0, W, H, C.ink);
  const tipx = 300, tipy = 118;

  // 背景散焦光斑：远处烟花的虚焦，靠点位密度做柔
  const spots = [[70, 66, 9, '#b23a48'], [148, 40, 6, '#d9822b'], [214, 84, 7, '#efe6d6'],
                 [92, 128, 5, '#d9822b'], [176, 150, 7, '#b23a48'], [240, 46, 5, '#efe6d6']];
  for (const s of spots) {
    for (let y = -s[2]; y <= s[2]; y++) {
      for (let x = -s[2]; x <= s[2]; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > s[2]) continue;
        if (d < s[2] * 0.4 || (x + y) % 2 === 0) dot(s[0] + x, s[1] + y, s[3]);
      }
    }
  }

  // 前一幕的余韵：远处楼影
  r(0, 236, W, 34, '#0b0e14');
  for (let x = 0; x < W; x += 26) {
    const hh = 6 + (x % 5) * 2;
    r(x, 236 - hh, 18, hh, '#0d1119');
    if (x % 3 === 0) dot(x + 6, 236 - hh + 2, '#7a5324');
  }

  // 手臂：从右下伸进来的斜前臂 + 握拳
  for (let i = 0; i < 120; i++) {
    const x = 400 + i * 0.72, y = 188 + i * 0.62;
    r(x, y, 26, 22, '#10131a');
  }
  r(372, 176, 30, 26, '#10131a');
  r(368, 168, 12, 12, '#171b24');
  r(366, 164, 5, 5, C.skin);
  r(392, 186, 2, 30, '#33261f');

  // 棒身：从拳心斜向左上，停在火头
  const dx = (tipx - 380) / 60, dy = (tipy - 178) / 60;
  for (let i = 0; i <= 60; i++) {
    r(380 + dx * i, 178 + dy * i, 2, 2, i % 6 === 0 ? '#8b93a0' : C.steel);
  }

  // 火花：0.1 秒换一批，步进闪烁
  const step = Math.floor(t / 0.1);
  for (let k = 0; k < 46; k++) {
    const a = (k * 2.397 + step * 1.7) % (Math.PI * 2);
    const sp = 4 + ((k * 7 + step * 3) % 16);
    const x = tipx + Math.cos(a) * sp;
    const y = tipy + Math.sin(a) * sp * 0.85 + sp * 0.1;
    dot(x, y, (k + step) % 3 === 0 ? C.ember : C.cream);
    if (sp > 12) { dot(x - Math.cos(a) * 2.2, y - Math.sin(a) * 2.2, '#8a5a2a'); }
  }
  glow(tipx, tipy, 10, C.warm, 1);
  r(tipx - 1, tipy - 1, 3, 3, C.cream);

  sticker(24, 30, 168, 30, '寂 寞 烟 火', 16, C.cream);
  if (t > T3 + 3.4) {
    dot(28, 74, C.cream);
    btext('烧完了，就灭了', 36, 70, 10, '#7b8290');
  }
}

function sceneEnd(t) {
  r(0, 0, W, H, C.ink);
  const k = 1 - (t - T4) / (DUR - T4);
  if (k > 0.06) {
    dot(240, 134, C.cream);
    if (k > 0.5) { dot(237, 139, C.ember); dot(243, 141, C.warm); }
  }
  if (t > T4 + 0.8) btext('好评学弟爱折腾', 240, 238, 10, '#464b56', 'center');
}

function seek(t) {
  t = Math.max(0, Math.min(DUR - 0.001, t));
  g.clearRect(0, 0, W, H);

  const cuts = [T1, T2, T3, T4];
  const nearCut = cuts.some(c => Math.abs(t - c) < 0.034);

  if (t < T1) sceneTitle(t);
  else if (t < T2) sceneStreet(t);
  else if (t < T3) sceneRoof(t);
  else if (t < T4) sceneSpark(t);
  else sceneEnd(t);

  if (nearCut) r(0, 0, W, H, C.ink);

  out.clearRect(0, 0, W * SCALE, H * SCALE);
  out.drawImage(buf, 0, 0, W * SCALE, H * SCALE);
  window.__t = t;
}

function boot() {
  init();
  seek(0);
  window.seek = seek;
  window.READY = true;
}
window.addEventListener('load', boot);




