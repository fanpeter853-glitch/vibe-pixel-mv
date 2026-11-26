const W = 480, H = 270, SCALE = 4, FPS = 30, DUR = 52;
window.FPS = FPS; window.DUR = DUR;

const C = {
  ink:'#07090d', night:'#0b1018', dusk:'#111826', far:'#16202e', mid:'#1b2635',
  road:'#14171f', curb:'#2a303c', warm:'#f2c66d', ember:'#d9822b', cream:'#efe6d6',
  red:'#b23a48', green:'#4a7a5c', coat:'#e2a33c', skin:'#ecc196', steel:'#6d7683',
  snow:'#dfe7f2',
};

let g, out, buf;
let OX = 0, OY = 0;
let SHOT = 0;
let CUT = -1;

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
}

// 世界坐标（受相机影响）
function r(x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x + OX), Math.round(y + OY), Math.round(w), Math.round(h));
}
function dot(x, y, col) { r(x, y, 1, 1, col); }
// 屏幕坐标（字幕、UI、胶片层）
function sr(x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function sdot(x, y, col) { sr(x, y, 1, 1, col); }

function halo(cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d > rad) continue;
    if (d > rad * 0.72 && ((x + y) & 1)) continue;
    if (d > rad * 0.9) continue;
    dot(cx + x, cy + y, col);
  }
}
function haloS(cx, cy, rad, col) { halo(cx + OX, cy + OY, rad, col); }function glow(cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d > rad) continue;
    const keep = d < rad * 0.3 ? true : d < rad * 0.6 ? ((x + y) % 2 === 0) : ((x * y) % 3 === 0);
    if (keep) dot(cx + x, cy + y, col);
  }
}

// ---------------- 二值中文 ----------------
const TC = {};
function tw(str, size) {
  const k = size + '|' + str;
  if (TC[k] != null) return TC[k];
  if (!btext.cv) {
    btext.cv = document.createElement('canvas');
    btext.cv.width = W * 2; btext.cv.height = H * 2;
    btext.cx = btext.cv.getContext('2d');
  }
  const cx = btext.cx;
  cx.font = (size * 2) + 'px "SimHei","Microsoft YaHei",sans-serif';
  const w = Math.round(cx.measureText(str).width / 2);
  TC[k] = w; return w;
}
function btext(str, x, y, size, col, align, screen) {
  if (!str) return 0;
  const S = 2, WW = W * 2, HH = H * 2;
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
  const X = Math.round(sx + (screen ? 0 : OX)), Y = Math.round(y + (screen ? 0 : OY));
  cx.fillStyle = '#fff';
  cx.fillText(str, Math.round(sx) * S, Math.round(y) * S);

  const bx0 = Math.max(0, Math.round(sx) - 1), by0 = Math.max(0, Math.round(y) - 1);
  const bx1 = Math.min(W, Math.ceil(sx + w) + 1), by1 = Math.min(H, Math.round(y) + size + 3);
  if (bx1 <= bx0 || by1 <= by0) return w;
  const bw = (bx1 - bx0) * S;
  const d = cx.getImageData(bx0 * S, by0 * S, bw, (by1 - by0) * S).data;
  g.fillStyle = col;
  for (let yy = by0; yy < by1; yy++) {
    let run = -1;
    for (let xx = bx0; xx <= bx1; xx++) {
      let on = false;
      if (xx < bx1) {
        let cnt = 0;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          if (d[((((yy - by0) * S + dy) * bw) + ((xx - bx0) * S + dx)) * 4 + 3] > 110) cnt++;
        }
        on = cnt >= 2;
      }
      if (on && run < 0) run = xx;
      if ((!on || xx === bx1) && run >= 0) {
        g.fillRect(X + (run - Math.round(sx)), Y + (yy - Math.round(y)), xx - run, 1);
        run = -1;
      }
    }
  }
  return w;
}

// ---------------- 字卡：屏幕空间，擦开 + 逐字抖动 ----------------
function card(x, y, w, h, text, size, t0, t1, opt) {
  opt = opt || {};
  const lt = opt.t - t0;
  if (lt < 0.14) return;
  if (lt > (t1 - t0)) return;
  const lt2 = lt - 0.14;
  const bob = (Math.floor(opt.t * 8) % 2) ? 1 : 0;
  const openK = Math.min(1, Math.floor(lt2 / 0.03) / 4);
  const ww = Math.round(w * (openK === 0 ? 0.1 : openK));
  const hide = lt > (t1 - t0) ? Math.min(1, (lt - (t1 - t0)) / 0.2) : 0;
  const wOut = Math.round(ww * (1 - hide));
  if (wOut <= 0) return;
  const bg = opt.bg || C.cream, fg = opt.fg || C.ink;
  const glitch = (Math.floor(opt.t * 30) % 97 === 0) ? 3 : 0;

  sr(x - 3 + glitch, y - 3 + bob, w + 6, h + 6, '#2b2118');
  sr(x + glitch, y + bob, wOut, h, bg);
  sr(x + 1 + glitch, y + 1 + bob, wOut - 2, 1, '#fffdf4');

  const chars = Array.from(text);
  const nShow = Math.min(chars.length, Math.max(0, Math.floor(lt2 / 0.10)));
  if (nShow > 0 && wOut >= w - 2) {
    let cx2 = x + w / 2 - tw(chars.slice(0, nShow).join(''), size) / 2;
    const st = Math.floor(opt.t * 8);
    for (let i = 0; i < nShow; i++) {
      const ch = chars[i];
      const jx = ((i + st) % 3 === 0) ? 1 : 0;
      const jy = ((i + st) % 5 === 0) ? 1 : 0;
      btext(ch, cx2 + jx + glitch, y + (h - size) / 2 + bob + jy, size, fg, 'left', true);
      cx2 += tw(ch, size);
    }
    if (nShow < chars.length) {
      sr(Math.round(cx2) + 2 + glitch, y + (h - size) / 2 + bob, 3, size, fg);
    }
  }
}

// ---------------- 主角 ----------------
function guy(x, y, t, o) {
  o = o || {};
  const K = 2;
  g.save();
  g.translate(Math.round(x + OX) - 11, Math.round(y + OY) - 32);
  g.scale(K, K);
  const L = (lx, ly, lw, lh, col) => { g.fillStyle = col; g.fillRect(Math.round(lx), Math.round(ly), Math.round(lw), Math.round(lh)); };
  const st = Math.floor(t * 8);
  const walking = !!o.walk;
  const legK = walking ? (st % 4) : 0;
  const bob = walking ? (st % 2 ? 1 : 0) : (st % 8 === 0 ? 1 : 0);
  const dir = o.dir || 1;
  L(-1, 15, 13, 1, '#0a0d13');
  if (!walking) {
    L(2, 10, 2, 6, '#22252e');
    L(6, 10, 2, 6, '#1a1d25');
  } else {
    const legs = [[0, 2], [1, 1], [2, 0], [1, 1]][legK];
    L(2 - legs[0], 10, 2, 5 + legs[0], '#22252e');
    L(6 + legs[1], 10, 2, 5 + legs[1], '#1a1d25');
    L(2 - legs[0], 15, 3, 1, '#181a22');
    L(6 + legs[1], 15, 3, 1, '#181a22');
  }
  L(1, 1 - bob, 8, 10, o.coat || C.coat);
  L(1, 10 - bob, 8, 1, '#b97c22');
  L(5, 2 - bob, 1, 8, '#c98c2a');
  const fl = (st % 4 < 2) ? 0 : 1;
  if (dir === -1) L(-1, 1 - bob, 2, 1 + fl, C.red);
  else L(9, 1 - bob, 2, 1 + fl, C.red);
  if (o.armUp) {
    const ax = dir > 0 ? 8 : -1;
    L(ax, -4 - bob, 2, 6, o.coat || C.coat);
    L(ax, -6 - bob, 2, 2, C.skin);
  } else if (walking) {
    const sw = [0, 1, 0, -1][legK];
    L(dir > 0 ? 8 : -1, 2 - bob + sw, 2, 6, '#c98c2a');
  } else {
    L(dir > 0 ? 8 : -1, 2 - bob, 2, 7, '#c98c2a');
  }
  L(2, -4 - bob, 5, 5, C.skin);
  const blink = (Math.floor(t * 4) % 22 === 0);
  if (!blink) L(3, -2 - bob, 1, 1, '#2b2118');
  L(1, 1 - bob, 7, 1, C.red);
  L(1, -6 - bob, 7, 2, C.green);
  L(2, -7 - bob, 5, 1, '#3d6650');
  g.restore();
}// ---------------- 粒子 ----------------
function snow(t, layers, wind) {
  const conf = layers || [[34, 0.9, 1], [20, 1.8, 1], [11, 3.1, 2]];
  for (let li = 0; li < conf.length; li++) {
    const [n, sp, sz] = conf[li];
    for (let i = 0; i < n; i++) {
      const seed = li * 97 + i * 41;
      const y = ((seed * 7 + t * sp * 6) % (H + 8)) - 4;
      const gust = Math.sin(t * 0.9 + li) * 6;
      const x = ((seed * 13) % W) + Math.sin((t * 0.7 + i) * 0.9) * (wind == null ? 2 : wind) + gust;
      if (sz === 1) dot(x, y, C.snow);
      else r(x, y, 2, 2, C.snow);
    }
  }
}
function starsBG(t, n) {
  for (let i = 0; i < (n || 40); i++) {
    const x = (i * 137 + 11) % W, y = (i * 61 + 9) % 96;
    const tw = Math.floor(t * 4);
    if ((i + tw) % 5 === 0) r(x, y, 1, 1, C.steel);
    else if ((i + tw) % 3 === 0) dot(x, y, '#9aa6b6');
    else dot(x, y, '#55606f');
  }
}

// ================= 场景 =================
function scTitle(t) {
  r(-40, -20, W + 80, H + 40, C.ink);
  r(28, 34, 180, 96, '#0f1520');
  r(26, 32, 184, 2, '#1d2634');
  for (let i = 0; i < 4; i++) r(28 + i * 45, 34, 2, 96, '#161e2a');
  r(28, 74, 180, 2, '#161e2a');
  glow(64, 56, 8, C.warm);
  glow(150, 50, 6, C.warm);
  snow(t, [[12, 1.2, 1]]);
}

function scRoad(t) {
  r(-40, -20, W + 80, H + 40, C.night);
  r(-40, 60, W + 80, 40, C.dusk);
  starsBG(t, 30);
  halo(410, 40, 8, C.cream);
  r(406, 36, 7, 7, C.cream);
  const f1 = t * 6;
  for (let x = -40; x < W + 40; x++) {
    const hh = 26 + Math.round(10 * Math.sin((x + f1) * 0.035) + 6 * Math.sin((x + f1) * 0.011 + 1.4));
    r(x, 132 - hh, 1, hh, C.far);
    r(x, 132 - hh, 1, 1, '#243244');
  }
  r(-40, 132, W + 80, 22, '#0c1a24');
  for (let i = 0; i < 70; i++) {
    const wx = ((i * 19 + t * 12) % (W + 80)) - 40;
    r(wx, 134 + (i % 5) * 4, 3 + (i % 3), 1, '#16303d');
  }
  const lhx = 268 - t * 2.2;
  r(lhx, 50, 10, 82, '#242c38');
  r(lhx + 3, 44, 4, 7, '#2e3642');
  r(lhx - 2, 80, 14, 2, '#1a222c');
  if (t > 4.4) {
    halo(lhx + 5, 48, 5, C.warm);
    r(lhx + 4, 47, 3, 3, C.cream);
    const sweep = Math.floor(t * 4) % 2;
    r(lhx + 8 + sweep * 8, 47, 10, 1, '#6a5530');
  }
  r(-40, 154, W + 80, 116, '#101923');
  r(-40, 154, W + 80, 2, '#1d2937');
  for (let i = -2; i < 14; i++) {
    const bx = i * 56 + (t * 12) % 56 - 56;
    r(bx, 176, 34, 6, '#16212d');
    r(bx + 6, 171, 20, 5, '#1b2836');
  }
  r(-40, 196, W + 80, 74, C.road);
  r(-40, 196, W + 80, 2, C.curb);
  r(-40, 160, W + 80, 3, '#1a2431');
  r(56, 166, 182, 30, '#1a222d');
  r(56, 166, 182, 2, '#232e3b');
  for (let i = 0; i < 6; i++) r(58 + i * 30, 190, 26, 2, '#243040');
  for (let i = -2; i < 14; i++) {
    const dx = i * 48 + (t * 12) % 48 - 48;
    r(dx, 236, 22, 1, '#2e3642');
  }
  r(60, 122, 172, 50, '#241a14');
  r(64, 126, 164, 42, '#3a2a18');
  for (let i = 0; i < 4; i++) {
    const wx = 66 + i * 41;
    r(wx, 128, 37, 38, '#8d6f3e');
    r(wx + 1, 129, 35, 36, '#c79c58');
    r(wx + 3, 133, 31, 2, '#e3bd7c');
    // 柜台上摆的东西
    r(wx + 4, 148, 29, 2, '#6a512e');
    if (i % 2 === 0) { r(wx + 8, 138, 6, 10, '#7d5f36'); r(wx + 20, 140, 5, 8, '#8a6a3d'); }
    else { r(wx + 12, 142, 13, 6, '#7a5c34'); }
    if (i === 1) { r(wx + 12, 146, 15, 20, '#402e1c'); }
  }
  r(60, 160, 172, 4, '#6a512e');
  r(60, 162, 172, 2, '#dfe7f2');
  r(60, 166, 172, 6, '#2a1e14');
  r(60, 160, 168, 1, '#e6ecf6');
  r(60, 118, 172, 6, '#3f2c1c');
  r(60, 118, 172, 2, '#54402b');
  for (let i = 0; i < 14; i++) r(64 + i * 12, 120, 6, 3, '#8a4638');
  for (let x = -40; x < W + 40; x++) {
    const hh = 54 + Math.round(12 * Math.sin(x * 0.021 + 0.6) + 7 * Math.sin(x * 0.057 + 2));
    r(x, 132 - hh, 1, hh, '#0e1622');
  }
  for (let i = 0; i < 40; i++) {
    const wx = (i * 47 + 9) % W, wy = 40 + (i * 29) % 84;
    if (((i + Math.floor(t * 0.5)) % 7) < 2) dot(wx, wy, '#7d6231');
  }
  const gx = 190 - (t * 1.0) % 4;
  guy(gx, 219, t, { walk: true, dir: 1 });
  snow(t);
  const bp = Math.floor(t * 8) % 5;
  if (bp < 3) r(gx + 8 + bp * 2, 192 - bp, 2, 1, '#7d8a9b');
}

function scLamp(t) {
  r(-40, -20, W + 80, H + 40, C.ink);
  r(-40, 150, W + 80, 120, '#0c1119');
  r(-40, 150, W + 80, 2, '#151e2a');
  starsBG(t, 22);
  const bl = [[-44, 92, 72, 58], [64, 104, 62, 46], [140, 86, 76, 64], [224, 100, 64, 50],
              [296, 88, 72, 62], [372, 108, 60, 44], [440, 94, 62, 56]];
  for (const b of bl) {
    r(b[0], b[1], b[2], b[3], '#121a26');
    for (let wy = b[1] + 10; wy < b[1] + b[3] - 8; wy += 16) {
      for (let wx = b[0] + 10; wx < b[0] + b[2] - 8; wx += 18) {
        const lit = ((wx * 7 + wy * 3 + Math.floor(t * 0.4)) % 13) < 3;
        r(wx, wy, 3, 4, lit ? '#8a6734' : '#0c1119');
      }
    }
  }
  r(196, 78, 4, 100, '#232d3b');
  r(190, 74, 16, 5, '#2b3a4b');
  const on = t > 9.4;
  const flick = (t < 9.75 && Math.floor(t * 8) % 2 === 0) ? 0 : 1;
  if (on && flick) {
    halo(198, 88, 12, C.warm);
    r(192, 84, 12, 9, C.warm);
    r(195, 87, 6, 3, '#fff6df');
    r(197, 93, 2, 24, '#5a4726');
    for (let i = 0; i < 10; i++) {
      const yy = 192 + i * 5, wid = 22 + i * 5;
      for (let xx = 0; xx < wid; xx += 4) r(198 - wid / 2 + xx, yy, 2, 1, '#332a1a');
    }
    for (let i = 0; i < 14; i++) {
      const seed = i * 53;
      const y = ((seed * 9 + t * 26) % 120) + 150;
      const x = ((seed * 21) % 90) + 152 + Math.sin(t * 1.4 + i) * 4;
      dot(x, y, '#f7e6bc');
    }
  }
  guy(146, 194, t, { dir: 1, armUp: t > 12.2 });
  snow(t, [[18, 1.0, 1], [10, 1.9, 1]]);
}

function scPlatform(t) {
  r(-40, -20, W + 80, 130, C.night);
  starsBG(t, 20);
  halo(70, 34, 8, C.cream);
  r(67, 30, 7, 7, C.cream);
  r(-40, 100, W + 80, 34, '#0c1a24');
  for (let i = 0; i < 60; i++) {
    const x = (i * 21 + Math.floor(t * 14)) % W;
    r(x, 102 + (i % 6) * 5, 3, 1, '#152c38');
  }
  r(-40, 134, W + 80, 2, '#2c3a4a');
  for (let x = -30; x < W + 40; x += 26) r(x, 128, 2, 8, '#2c3a4a');
  r(-40, 150, W + 80, 120, '#0e141c');
  r(-40, 150, W + 80, 2, '#243040');
  for (let i = 0; i < 5; i++) r(-40, 176 + i * 20, W + 80, 1, '#131a24');
  r(60, 108, 3, 44, '#243040');
  halo(61, 106, 10, C.warm);
  r(56, 101, 12, 6, C.warm);
  r(59, 103, 6, 3, '#fff3d6');
  for (let i = 0; i < 9; i++) {
    const yy = 154 + i * 7, wid = 20 + i * 5;
    for (let xx = 0; xx < wid; xx += 4) r(61 - wid / 2 + xx, yy, 2, 1, '#2f2716');
  }
  r(268, 132, 4, 34, '#3a2a1e');
  r(268, 132, 4, 9, '#4a3728');
  r(268, 142, 62, 3, '#3a2a1e');
  r(268, 152, 62, 4, '#4a3728');
  r(270, 156, 4, 14, '#2d2118');
  r(324, 156, 4, 14, '#2d2118');
  const br = (Math.floor(t * 4) % 6 === 0) ? 1 : 0;
  r(300, 138 + br, 8, 10 - br, C.coat);
  r(301, 132 + br, 6, 5, C.skin);
  const look = (Math.floor(t * 3) % 9 === 0);
  if (!look) r(302, 134 + br, 1, 1, '#2b2118');
  r(300, 135, 8, 1, C.red);
  r(300, 129 + br, 8, 2, C.green);
  r(300, 128 + br, 6, 1, '#3d6650');
  r(302, 148, 3, 5, '#23262f');
  r(308, 148, 3, 5, '#1c1f27');
  r(300, 152, 4, 2, '#181a22');
  r(308, 152, 4, 2, '#181a22');
  for (const p of [[15.9, 0.55], [17.9, 0.85], [19.9, 0.42], [21.3, 0.7]]) {
    const dt = t - p[0];
    if (dt < 0) continue;
    const x = -40 + dt * 26 * p[1];
    if (x > W + 30) continue;
    silhouette(x, 140, Math.floor(t * 8), '#05070b');
  }
  snow(t, [[16, 1.0, 1], [9, 1.8, 1]]);
}
function silhouette(x, y, st, col) {
  const k = st % 4;
  r(x + 1, y - 13, 5, 6, col);
  r(x - 1, y - 7, 9, 13, col);
  r(x - 2, y + 6 - (k === 0 ? 0 : 1), 3, 8, col);
  r(x + 5, y + 6 - (k === 2 ? 0 : 1), 3, 8, col);
  r(x + 9, y - 6, 2, 9, col);
}

function scPhotos(t) {
  r(-40, -20, W + 80, H + 40, '#0d0b0f');
  for (let i = 0; i < 16; i++) {
    const x = 6 + i * 31;
    const y = 24 + Math.round(Math.sin(i * 0.8) * 6);
    if ((i + Math.floor(t * 4)) % 4 === 0) dot(x, y, '#6b5326');
    else dot(x, y, C.warm);
    r(x, y - 2, 1, 2, '#241c14');
  }
  const P = [[52, 48, 0], [186, 40, 1], [320, 50, 2]];
  const sw = Math.floor(t * 8) % 4;
  const tilt = [0, 1, 0, -1][sw];
  for (let i = 0; i < P.length; i++) {
    const [x, y, kind] = P[i];
    const dy = (i % 2 ? -tilt : tilt);
    r(x - 6, y - 6 + dy, 82, 76, C.cream);
    r(x - 6, y - 6 + dy, 82, 1, '#fffaf0');
    r(x, y + dy, 70, 56, '#16202e');
    if (kind === 0) {
      r(x, y + 40 + dy, 70, 16, '#1d2836');
      r(x + 34, y + 18 + dy, 3, 22, '#2c3a4a');
      halo(x + 35, y + 16 + dy, 4, C.warm);
      r(x + 10, y + 44 + dy, 3, 6, '#c98c2a');
    } else if (kind === 1) {
      r(x, y + 40 + dy, 70, 16, '#1d2836');
      r(x + 20, y + 36 + dy, 22, 3, '#4a3728');
      r(x + 20, y + 39 + dy, 2, 8, '#3a2a1e');
      r(x + 40, y + 39 + dy, 2, 8, '#3a2a1e');
      dot(x + 56, y + 18 + dy, C.cream);
    } else {
      r(x, y + 44 + dy, 70, 12, '#101b26');
      const ph = Math.floor(t * 8) % 4;
      for (let k = 0; k < 14; k++) {
        const a = k * 0.45 + 1;
        dot(x + 34 + Math.cos(a) * (8 + ph), y + 20 + Math.sin(a) * (7 + ph) + dy, k % 3 ? C.ember : C.cream);
      }
    }
    r(x + 4, y + 60 + dy, 26, 1, '#8a8272');
    r(x + 4, y + 63 + dy, 38, 1, '#6f6858');
    r(x + 32, y - 10 + dy, 6, 4, '#4a4a52');
  }
  for (let i = 0; i < 24; i++) {
    const st = Math.floor(t * 8);
    dot((i * 73 + st * 17) % W, (i * 41 + st * 29) % H, '#221c22');
  }
}

function scStars(t) {
  r(-40, -20, W + 80, 210, '#080c14');
  r(-40, 196, W + 80, 94, '#070a10');
  for (let i = 0; i < 110; i++) {
    const x = (i * 89 + 17) % W, y = (i * 37 + 11) % 158 + 4;
    const tw = (i + Math.floor(t * 4)) % 7 === 0;
    r(x, y, 1, 1, tw ? '#dfe7f2' : '#4d5868');
    if (i % 17 === 0) r(x - 1, y, 3, 1, '#2c3848');
  }
  if (Math.floor(t * 8) % 40 === 0) {
    const sx = (Math.floor(t * 8) * 13) % W, sy = 20 + (Math.floor(t * 8) * 7) % 90;
    for (let k = 0; k < 8; k++) dot(sx - k * 3, sy + k * 2, k < 3 ? '#e8f0fb' : '#5d6878');
  }
  const lit = t < 39.48 ? Math.round((t - 29.08) * 9) : Math.round((t - 39.48) * 60) + 108;
  for (let i = 0; i < 130; i++) {
    const x = (i * 89 + 17) % W, y = (i * 37 + 11) % 160 + 6;
    if (i >= lit) continue;
    r(x, y, 1, 1, '#c9d5e6');
    if (i % 13 === 0) r(x - 1, y - 1, 3, 3, '#5c6878');
  }
  if (t > 39.9) {
    const pts = [[64, 42], [108, 28], [152, 46], [198, 32], [240, 54], [288, 36], [332, 52]];
    const n = Math.min(pts.length - 1, Math.floor((t - 39.9) / 0.35));
    for (let i = 0; i < n; i++) linePx(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#44546a');
  }
  for (let x = -40; x < W + 40; x++) {
    const hh = 30 + Math.round(9 * Math.sin(x * 0.02 + 1) + 5 * Math.sin(x * 0.051));
    r(x, 196 - hh, 1, hh, '#0e1622');
  }
  for (let x = -40; x < W + 40; x++) {
    const hh = 14 + Math.round(7 * Math.sin(x * 0.033 + 2.4));
    r(x, 196 - hh, 1, hh, '#16212e');
  }
  r(-40, 196, W + 80, 2, '#1b2734');
  for (let x = -40; x < W + 40; x++) {
    const hh = 8 + Math.round(6 * Math.sin(x * 0.045 + 1) + 3 * Math.sin(x * 0.11));
    r(x, 198 + hh, 1, 1, '#22303f');
  }
  for (let i = 0; i < 70; i++) {
    const x = (i * 71 + 13) % W, y = 206 + (i * 43) % 60;
    if ((i + Math.floor(t * 6)) % 5 === 0) dot(x, y, '#3c4c5f');
    else dot(x, y, '#1c2836');
  }
  for (const px of [78, 96, 132, 336, 352]) {
    const hh = 22 + (px % 4) * 3;
    r(px, 196 - hh, 3, hh, '#0a1520');
    for (let k = 0; k < 4; k++) r(px - 4 - k * 3, 178 + k * 5 - (px % 3), 5 + k * 6, 2, '#0a1520');
  }
  guy(198, 197, t, { armUp: true, dir: 1 });
  if (t > 39.6) {
    const k = Math.min(1, (t - 39.6) / 1.4);
    halo(208, 172, 5 + Math.round(k * 14), C.warm);
    r(206, 170, 3, 3, C.cream);
  }
  snow(t, [[10, 0.8, 1]]);
}
function linePx(x0, y0, x1, y1, col) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) dot(x0 + dx * i / n, y0 + dy * i / n, col);
}

function scFire(t) {
  r(-40, -20, W + 80, 176, '#070b12');
  for (let i = 0; i < 90; i++) {
    const x = (i * 97 + 13) % W, y = (i * 41 + 7) % 150;
    const tw = (i + Math.floor(t * 4)) % 6 === 0;
    r(x, y, 1, 1, tw ? '#cfd9e8' : '#34404f');
  }
  // 远景：海面尽头的城市与一层暖雾
  r(-40, 132, W + 80, 44, '#0b1319');
  for (let i = 0; i < 26; i++) {
    const bx = (i * 39 + 11) % W, bh = 6 + (i % 5) * 5;
    r(bx, 176 - bh, 12 + (i % 4) * 6, bh, '#0d161d');
    if ((i + Math.floor(t)) % 3 === 0) dot(bx + 4, 172 - bh, '#7d6231');
  }
  for (let i = 0; i < 7; i++) {
    const ww = 70 + i * 22;
    r(120 - ww / 2, 174 - i, ww, 1, i < 3 ? '#5c4524' : '#3a2a18');
  }
  for (let i = 0; i < 5; i++) {
    const ww = 46 + i * 18;
    r(330 - ww / 2, 174 - i, ww, 1, i < 2 ? '#54401f' : '#33240f');
  }
  // 海面
  r(-40, 176, W + 80, 3, '#122030');
  r(-40, 179, W + 80, 91, '#09131c');
  for (let i = 0; i < 52; i++) {
    const x = (i * 23 + Math.floor(t * 10)) % W;
    r(x, 182 + (i % 7) * 9, 5, 1, '#122636');
    r(x + 11, 186 + (i % 9) * 7, 3, 1, '#0f1f2c');
  }
  const bursts = [[42.3, 150, 60, C.ember, 6], [44.6, 320, 52, C.red, 5], [46.9, 236, 74, C.warm, 5], [49.2, 130, 48, C.ember, 6]];
  for (const b of bursts) {
    const [bt, bx, by, col, dk] = b;
    const dt = t - bt;
    if (dt < -1.4) continue;
    if (dt < 0) {
      // 升空的弹道
      const k = 1 + dt / 1.4;
      const sy = 176 + (by - 176) * k;
      r(bx, sy, 1, 3, '#f0d8a8');
      dot(bx, sy + 3, '#8a6633');
      continue;
    }
    const rad = Math.min(6 + dt * 34, 54);
    const st = Math.floor(t * 8);
    // 核心闪光
    if (dt < 0.28) {
      glow(bx, by, 5 + Math.round(dt * 14), '#fff2cf');
      r(bx - 2, by - 2, 5, 5, '#fffaf0');
    }
    // 主环 + 内层星点
    for (let k = 0; k < 96; k++) {
      const a = k * 0.0654 + bt;
      const rr = rad * (1 - 0.12 * ((k + st) % 4)) * (k % 3 ? 1 : 0.94);
      const x = bx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * 0.93;
      if (y > 174) continue;
      const hot = k % 7 === 0;
      dot(x, y, hot ? '#fff6df' : (k % 5 ? col : '#8a5a2a'));
      if (k % 11 === 0) dot(x + 1, y, col);
    }
    // 拖尾
    if (dt > 0.3) {
      for (let k = 0; k < 40; k++) {
        const a = k * 0.157 + bt;
        const fx = bx + Math.cos(a) * rad * 1.05;
        const fy = by + Math.sin(a) * rad * 0.95 + Math.pow(dt - 0.3, 1.6) * 22;
        if (fy < 176) dot(fx + (dt - 0.3) * 2, fy, k % 4 ? '#6d4a24' : '#a87a3a');
      }
    }
    // 海面倒影：竖直的一道光柱 + 碎光
    if (dt < 1.4) {
      for (let i = 0; i < 14; i++) {
        const iy = 180 + i * 6;
        const ix = bx + Math.sin(t * 2 + i * 0.7) * (2 + i * 0.3);
        dot(ix, iy, i % 3 ? '#4a3418' : col);
        if (i % 4 === 0) dot(ix + 3, iy + 1, '#7d5a28');
      }
    }
  }
  // 纸船（放大 1.9 倍）
  const bx2 = 118 + Math.sin(t * 0.55) * 4;
  const by2 = 208 + Math.round(Math.sin(t * 1.1));
  g.save();
  g.translate(Math.round(bx2 + OX) - 26, Math.round(by2 + OY) - 26);
  g.scale(1.9, 1.9);
  const B = (lx, ly, lw, lh, col) => { g.fillStyle = col; g.fillRect(Math.round(lx), Math.round(ly), Math.round(lw), Math.round(lh)); };
  B(-2, 12, 26, 1, '#6a7484');
  B(0, 9, 22, 3, '#d9cfb8');
  B(3, 8, 16, 2, '#efe8d8');
  B(6, 6, 10, 2, '#d9cfb8');
  const sail = [2, 4, 6, 8, 8, 6, 4, 2];
  for (let i = 0; i < sail.length; i++) B(12 - sail[i] / 2, 5 - i, sail[i], 1, i < 3 ? '#f7f2e4' : '#ded4bc');
  B(11, -3, 1, 8, '#cbbfa4');
  for (let i = 0; i < 9; i++) B(1 + i * 2, 13 + (i % 3), 1, 1, '#8f9aa8');
  g.restore();
  // 近景一张拍立得漂在水面（参考片里歌词贴在实物上的做法）
  const px3 = 268 + Math.sin(t * 0.5) * 3, py3 = 226 + Math.round(Math.sin(t * 1.2) * 2);
  r(px3 - 34, py3 - 26, 68, 52, '#efe6d6');
  r(px3 - 34, py3 - 26, 68, 1, '#fffaf0');
  r(px3 - 30, py3 - 22, 60, 40, '#16202e');
  r(px3 - 30, py3 + 8, 60, 10, '#1d2836');
  dot(px3 - 12, py3 - 14, '#7d6231');
  dot(px3 + 2, py3 - 10, '#7d6231');
  r(px3 - 6, py3 + 12, 12, 1, '#8a8272');
  r(px3 - 14, py3 + 15, 28, 1, '#6f6858');
}function insBoots(t) {
  r(-40, -20, W + 80, H + 40, '#0f1822');
  r(-40, 168, W + 80, 122, '#16212d');
  r(-40, 168, W + 80, 2, '#1f2c3b');
  // 身后留下的一串脚印
  for (let i = 0; i < 6; i++) {
    const px = 30 + i * 74 - (t - 4.2) * 26;
    r(px, 206 + (i % 2) * 10, 20, 10, '#0b1220');
    r(px + 3, 208 + (i % 2) * 10, 14, 5, '#111a28');
  }
  // 两条裤腿从上边缘伸下来
  const st = Math.floor(t * 8) % 4;
  const l1 = [0, -3, 0, 4][st], l2 = [0, 4, 0, -3][st];
  r(150 + l1, -20, 30, 164, '#22252e');
  r(150 + l1, 134, 30, 14, '#1b1e26');
  r(214 + l2, -20, 30, 152, '#1c1f27');
  r(214 + l2, 124, 30, 14, '#161920');
  // 靴子：鞋头 + 鞋底 + 鞋带
  r(146 + l1, 146, 36, 16, '#2b2f38');
  r(142 + l1, 160, 44, 8, '#171a21');
  r(146 + l1, 146, 36, 2, '#3a3f4a');
  for (let i = 0; i < 3; i++) r(154 + l1 + i * 8, 150, 4, 1, '#141821');
  r(210 + l2, 136, 36, 14, '#22262f');
  r(206 + l2, 148, 44, 8, '#12151c');
  for (let i = 0; i < 3; i++) r(218 + l2 + i * 8, 140, 4, 1, '#141821');
  // 雪灌进画面
  snow(t, [[30, 2.6, 2], [16, 3.4, 2]], 1);
  for (let i = 0; i < 8; i++) {
    const y = 150 + ((i * 31 + t * 40) % 80);
    r(120 + i * 30, y, 6, 1, '#24313f');
  }
}
function insBulb(t) {
  r(-40, -20, W + 80, H + 40, '#0a0e14');
  // 背景里的一截灯柱与墙面
  r(-40, 176, W + 80, 114, '#0d1219');
  r(300, 150, 26, 120, '#1a2029');
  r(292, 150, 42, 6, '#222a35');
  const cx = 210, cy = 106;
  // 光锥
  halo(cx, cy + 6, 40, '#6a5524');
  // 灯泡：按行宽度做圆肚
  const bw = [6, 10, 14, 16, 18, 18, 16, 14, 10, 6];
  for (let i = 0; i < bw.length; i++) {
    const wd = bw[i], y = cy - 20 + i * 3;
    r(cx - wd / 2, y, wd, 3, C.warm);
    if (i === 2 || i === 6) r(cx - wd / 2 + 2, y + 1, wd - 4, 1, '#fff6df');
  }
  // 灯丝
  for (let i = 0; i < 5; i++) r(cx - 6 + i * 3, cy - 2 + (i % 2 ? 2 : 0), 2, 3, '#f3b45c');
  // 灯座
  r(cx - 5, cy + 10, 10, 6, '#4a3c26');
  r(cx - 4, cy + 16, 8, 2, '#2a2318');
  // 电压不稳：整体亮度跳
  const fl = Math.floor(t * 8) % 9;
  if (fl === 0) r(cx - 10, cy - 8, 20, 20, '#f2c66d');
  if (fl === 4) { r(cx - 9, cy - 8, 18, 18, '#d9822b'); }
  // 绕灯飞的小虫
  for (let i = 0; i < 6; i++) {
    const a = t * 2.6 + i * 1.3;
    sdot(cx + Math.cos(a) * (22 + i * 4), cy + 18 + Math.sin(a * 1.4) * 10, '#ffe9b8');
  }
  snow(t, [[12, 3.2, 1]]);
}
function insBench(t) {
  r(-40, -20, W + 80, H + 40, '#0c1219');
  // 背景：路灯光斑与雪幕
  halo(96, 40, 16, '#4a3c22');
  r(90, 30, 12, 9, '#3a3020');
  // 经过的路人：只看到腿
  const p1 = (t - 19.55) * 210 - 120;
  const k = Math.floor(t * 8) % 4;
  r(p1, -20, 16, 172, '#05070b');
  r(p1 + 34, -20 + (k === 1 ? -12 : 0), 15, 172, '#05070b');
  r(p1 - 4, 146, 26, 8, '#05070b');
  r(p1 + 30, 146 + (k === 1 ? -12 : 0), 26, 8, '#05070b');
  // 长椅：近景木板 + 椅背上落的雪
  r(-40, 196, W + 80, 26, '#4a3728');
  r(-40, 196, W + 80, 2, '#604734');
  r(-40, 214, W + 80, 8, '#2f2318');
  for (let i = 0; i < 22; i++) r(i * 24 + 6, 202, 14, 1, '#3a2a1e');
  r(-40, 188, W + 80, 9, '#c7d2e2');
  r(-40, 186, W + 80, 3, '#e6ecf6');
  for (let x = -40; x < W + 40; x += 7) r(x, 185 + (x % 3), 5, 2, '#dfe7f2');
  // 椅背
  r(-40, 236, W + 80, 34, '#3f2f22');
  r(-40, 232, W + 80, 6, '#c7d2e2');
  snow(t, [[26, 3.0, 2], [14, 3.8, 2]], 1);
  // 雪在风里斜扫
  for (let i = 0; i < 10; i++) {
    const y = 60 + ((i * 37 + t * 60) % 140);
    r(30 + i * 44, y, 8, 1, '#26333f');
  }
}
function insHand(t) {
  r(-40, -20, W + 80, H + 40, '#0a1018');
  for (let i = 0; i < 40; i++) {
    const x = (i * 91 + 13) % W, y = (i * 47 + 9) % 150;
    const tw = (i + Math.floor(t * 4)) % 6 === 0;
    r(x, y, 1, 1, tw ? '#dbe5f2' : '#3d4757');
  }
  // 远处的雪山剪影，让手有背景可辨
  for (let x = -40; x < W + 40; x++) {
    const hh = 22 + Math.round(9 * Math.sin(x * 0.018 + 2) + 5 * Math.sin(x * 0.049));
    r(x, 200 - hh, 1, hh, '#101a26');
  }
  r(-40, 200, W + 80, 90, '#0b141d');
  // 手：从右下伸入，掌心向上
  const lift = Math.min(6, Math.max(0, (t - 36.2) * 12));
  const hx = 214, hy = 196 - lift;
  r(hx - 6, hy + 8, 78, 46, '#05070b');
  r(hx + 4, hy + 2, 62, 12, '#05070b');
  // 四根手指
  const fw = [9, 9, 9, 8];
  for (let i = 0; i < 4; i++) {
    const fx = hx + 8 + i * 15;
    const fh = 26 - Math.abs(i - 1.5) * 3;
    r(fx, hy - fh + 6, fw[i], fh + 16, '#05070b');
    r(fx + fw[i] - 2, hy - fh + 6, 2, fh + 16, '#0b0f16');
  }
  // 拇指
  r(hx - 10, hy + 2, 10, 26, '#05070b');
  // 掌心那颗亮起来的星
  const k = Math.min(1, (t - 36.2) / 0.8);
  const cx = hx + 38, cy = hy - 8;
  halo(cx, cy, 3 + Math.round(k * 13), C.warm);
  r(cx - 1, cy - 1, 3, 3, '#fff8e6');
  if (t > 36.8) {
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + t * 0.6;
      sdot(cx + Math.cos(a) * (7 + k * 8), cy + Math.sin(a) * (6 + k * 7), '#ffe2a8');
    }
  }
  snow(t, [[10, 1.6, 1]]);
}function insPhoto(t) {
  r(-40, -20, W + 80, H + 40, '#0d0b0f');
  const x = 60, y = 36, w = 300, h = 204;
  // 拍立得白边 + 相纸压痕
  r(x - 8, y - 8, w + 16, h + 16, '#efe6d6');
  r(x - 8, y - 8, w + 16, 1, '#fffaf0');
  r(x - 8, y + h + 6, w + 16, 2, '#b8ae98');
  r(x, y, w, h, '#16202e');
  // 相片内容：雪夜街道
  r(x, y + 148, w, 56, '#1d2836');
  r(x, y + 148, w, 2, '#283748');
  for (let i = 0; i < 6; i++) {
    r(x + 8 + i * 52, y + 56, 40, 92, '#1a2430');
    for (let j = 0; j < 3; j++) dot(x + 18 + i * 52 + j * 10, y + 70, '#7d6231');
    r(x + 8 + i * 52, y + 56, 40, 1, '#243040');
  }
  // 路灯光
  r(x + 132, y + 48, 5, 104, '#2c3a4a');
  halo(x + 134, y + 44, 11, C.warm);
  r(x + 130, y + 40, 9, 6, C.warm);
  r(x + 132, y + 42, 5, 3, '#fff3d6');
  // 雪地上的脚印
  for (let i = 0; i < 9; i++) r(x + 40 + i * 26, y + 168 + (i % 2) * 6, 9, 3, '#111c28');
  // 相片里的主角
  guy(x + 158, y + 107, t, { armUp: true, dir: 1 });
  snow(t, [[14, 2.0, 2]]);
  // 扫描高光横扫相纸
  const gx = ((t - 26.0) / 0.7) * (w + 140) - 70;
  sr(x + gx, y - 8, 2, h + 16, '#0f1722');
  sr(x + gx + 2, y - 8, 1, h + 16, '#e8f0fb');

}
// ================= 镜头表 =================
const SHOTS = [
  [0.00, 2.40, scTitle, 0, 0],
  [2.40, 4.20, scRoad, -2.0, 1],
  [4.20, 5.20, insBoots, 0, 1],
  [5.20, 9.04, scRoad, -2.0, 1],
  [9.04, 12.40, scLamp, 0.6, 1],
  [12.40, 13.20, insBulb, 0, 0],
  [13.20, 15.68, scLamp, 0.6, 1],
  [15.68, 19.60, scPlatform, -1.2, 1],
  [19.60, 20.40, insBench, 0, 1],
  [20.40, 22.40, scPlatform, -1.2, 1],
  [22.40, 26.00, scPhotos, 1.4, 1],
  [26.00, 26.80, insPhoto, 0, 0],
  [26.80, 29.08, scPhotos, 1.4, 1],
  [29.08, 36.20, scStars, 0, 2],
  [36.20, 37.00, insHand, 0, 1],
  [37.00, 42.36, scStars, 0, 2],
  [42.36, 52.00, scFire, -0.8, 1],
];

// 歌词：起, 止, 文本, 字号, 中心x, y
const LYRIC = [
  [2.40, 5.86, '我曾经走过多遥远的路', 14, 240, 38],
  [5.92, 9.00, '跨越过多少海洋去看你', 14, 240, 70],
  [9.04, 11.06, '孤单的黑夜途中', 14, 130, 40],
  [11.12, 12.72, '只要想着你', 14, 128, 78],
  [12.76, 15.62, '我就不会惶恐', 14, 330, 120],
  [15.68, 18.98, '时光的岸上人来了又走', 14, 220, 42],
  [19.04, 22.30, '离开时你不用说我都懂', 14, 250, 78],
  [22.40, 24.86, '感谢你曾让我', 15, 150, 186],
  [24.92, 27.74, '留在你眼中', 16, 300, 210],
  [29.08, 32.30, '我曾经走过最遥远的路', 14, 160, 38],
  [32.36, 35.65, '想要去拥抱未成真的梦', 14, 270, 64],
  [35.72, 37.72, '迷失在黑夜途中', 14, 160, 90],
  [37.80, 39.45, '只要想起你', 14, 330, 90],
  [39.48, 42.30, '就点亮了星空', 15, 300, 32],
  [42.36, 45.70, '流浪的纸船忘不掉港口', 14, 150, 116],
  [45.76, 49.00, '渐灭的花火割不断彩虹', 14, 330, 144],
  [49.04, 51.40, '你就是我心中永恒的天空', 15, 240, 60],
];

// ================= 胶片层 =================
function filmLayer(t) {
  const st = Math.floor(t * 30);
  for (let i = 0; i < 60; i++) {
    const x = (i * 131 + st * 37) % W, y = (i * 71 + st * 53) % H;
    sr(x, y, 1, 1, i % 9 ? '#0d1117' : '#2b3444');
  }

  const recOn = (Math.floor(t * 2) % 2) === 0;
  if (recOn) sr(14, 14, 3, 3, '#d93838');
  btext('REC', 21, 11, 8, '#e9e4d8', 'left', true);
  const ff = Math.floor((t % 1) * 24), ss = Math.floor(t) % 60, mm = Math.floor(t / 60);
  btext('00:' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + ':' + String(ff).padStart(2, '0'),
    22, 19, 8, '#a8aeb8', 'left', true);
  btext('SC ' + String(Math.floor(SHOT / 2) + 1).padStart(2, '0') + ' TAKE 02',
    W - 14, 12, 9, '#a8aeb8', 'right', true);
  if (t - CUT < 1 / 30 && t > CUT) {
    for (let i = 0; i < 14; i++) {
      const y = (i * 19 + 7) % H;
      sr(0, y, W, 2, '#05070b');
      sr((i * 37) % W, y, 44, 1, '#c8d0dc');
    }
  }
}

function seek(t) {
  window.__t = t;
  SHOT = 0;
  for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0] && t < SHOTS[i][1]) { SHOT = i; break; }
  const sh = SHOTS[SHOT];
  CUT = sh[0];
  const lt = t - sh[0];
  OX = Math.round(sh[3] * lt);
  const st = Math.floor(t * 8);
  OY = sh[4] ? [0, 0, 1, 0, -1, 0][st % 6] : 0;
  if (sh[4]) OX += [0, 1, 0, -1][st % 4];

  g.clearRect(0, 0, W, H);
  sh[2](t);

  for (const L of LYRIC) {
    const [t0, t1, txt, size, cx, cy] = L;
    const w = Math.ceil(tw(txt, size) + 22);
    card(cx - w / 2, cy, w, size + 12, txt, size, t0, t1, { t });
  }
  filmLayer(t);

  out.imageSmoothingEnabled = false;
  out.clearRect(0, 0, W * SCALE, H * SCALE);
  out.drawImage(buf, 0, 0, W * SCALE, H * SCALE);
}

init();
seek(0);
window.READY = true;
















