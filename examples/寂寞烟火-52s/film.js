const W = 480, H = 270, SCALE = 4, FPS = 30, DUR = 52;
window.FPS = FPS; window.DUR = DUR;
const T0 = 110.0;                  // 歌曲截取起点（本地 t = 歌曲秒 - T0）

const C = {
  ink:   '#07090d',
  night: '#0b1018',
  dusk:  '#111826',
  far:   '#16202e',
  mid:   '#1b2635',
  road:  '#14171f',
  curb:  '#2a303c',
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

let g, out, buf;

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

function r(x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function dot(x, y, col) { r(x, y, 1, 1, col); }

// ---- 点状光晕（比 dither 圆更干净）：三圈稀点
function halo(cx, cy, r, col) {
  for (let ring = 1; ring <= 3; ring++) {
    const rr = r * ring / 3;
    const n = 6 + ring * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.4;
      dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, ring === 1 ? col : '#4a3c22');
    }
  }
}

// ---- 抖动光：靠点位密度，不用透明度
function glow(cx, cy, rad, col, dense) {
  g.fillStyle = col;
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > rad) continue;
      const keep = d < rad * 0.3 ? true
        : d < rad * 0.6 ? ((x + y) % 2 === 0)
        : ((x * y) % 3 === 0);
      if (keep || (dense && d < rad * 0.8)) r(cx + x, cy + y, 1, 1, col);
    }
  }
}

// ---- 二值中文：2 倍超采样后 2×2 块降采样
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
  TC[k] = w;
  return w;
}
function btext(str, x, y, size, col, align) {
  if (!str) return 0;
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
        g.fillRect(run, yy, xx - run, 1);
        run = -1;
      }
    }
  }
  return w;
}

// ---- 逐字上幕的字卡：擦开 + 打字 + 呼吸 + 退出
function card(x, y, w, h, text, size, t0, t1, opt) {
  opt = opt || {};
  opt.size = opt.size || size;
  if (opt.fit) w = Math.ceil(tw(text, opt.size) + 26);
  const lt = opt.t - t0;
  if (lt < 0) return;
  const inD = 0.14, outD = 0.22;
  if (lt > (t1 - t0) + outD) return;
  const bob = (Math.floor((opt.t || 0) * 8) % 2) ? 1 : 0;
  const bg = opt.bg || C.cream, fg = opt.fg || C.ink;

  // 擦开：宽度从 0 长到 w（8fps 步进）
  const openK = Math.min(1, Math.floor(lt / 0.035) / 4);
  const ww = Math.round(w * (openK === 0 ? 0.08 : openK));
  const hide = lt > (t1 - t0) ? Math.min(1, (lt - (t1 - t0)) / outD) : 0;
  const wOut = Math.round(ww * (1 - hide));
  if (wOut <= 0) return;

  r(x - 3, y - 3 + bob, w + 6, h + 6, opt.frame || '#2b2118');
  r(x, y + bob, wOut, h, bg);
  r(x + 1, y + 1 + bob, wOut - 2, 1, opt.hi || '#ffffff');

  // 打字：每字 3 帧（10 字/秒）
  const chars = Array.from(text);
  const nShow = Math.min(chars.length, Math.max(0, Math.floor((lt - 0.16) / 0.10)));
  const show = chars.slice(0, nShow).join('');
  if (show && wOut >= w - 2) {
    btext(show, x + w / 2, y + (h - opt.size) / 2 + bob + (opt.dy || 0),
      opt.size, fg, 'center');
  }
  if (nShow > 0 && nShow < chars.length && wOut >= w - 2) {
    const tw2 = tw(chars.slice(0, nShow).join(''), opt.size || 14);
    const cx2 = Math.round(x + w / 2 + tw2 / 2) + 3;
    r(cx2, y + (h - (opt.size || 14)) / 2 + bob, 3, opt.size || 14, fg);
  }
}

// ---- 主角：绿帽黄外套，四帧走路，8fps 步进
function guy(x, y, t, o) {
  o = o || {};
  const st = Math.floor(t * 8);
  const walking = !!o.walk;
  const legK = walking ? (st % 4) : 0;
  const bob = walking ? (st % 2 ? 1 : 0) : 0;
  const dir = o.dir || 1;
  const bodyC = o.coat || C.coat;

  // 影子
  r(x - 3, y + 15, 12, 1, '#0a0d13');
  // 腿
  if (!walking) {
    r(x + 2, y + 10, 2, 6, '#22252e');
    r(x + 6, y + 10, 2, 6, '#1a1d25');
  } else {
    const legs = [[0, 2], [1, 1], [2, 0], [1, 1]][legK];
    r(x + 2 - legs[0], y + 10, 2, 5 + legs[0], '#22252e');
    r(x + 6 + legs[1], y + 10, 2, 5 + legs[1], '#1a1d25');
    r(x + 2 - legs[0], y + 15, 3, 1, '#181a22');
    r(x + 6 + legs[1], y + 15, 3, 1, '#181a22');
  }
  // 风衣
  r(x + 1, y + 1 - bob, 8, 10, bodyC);
  r(x + 1, y + 10 - bob, 8, 1, '#b97c22');
  r(x + 5, y + 2 - bob, 1, 8, '#c98c2a');
  // 手：走路摆动 / 抬手
  if (o.armUp) {
    r(x + 8 * dir + (dir > 0 ? 0 : -1), y - 4 - bob, 2, 6, bodyC);
    r(x + 8 * dir + (dir > 0 ? 0 : -1), y - 6 - bob, 2, 2, C.skin);
  } else if (walking) {
    const sw = [0, 1, 0, -1][legK];
    r(x + (dir > 0 ? 8 : -1), y + 2 - bob + sw, 2, 6, '#c98c2a');
  } else {
    r(x + (dir > 0 ? 8 : -1), y + 2 - bob, 2, 7, '#c98c2a');
  }
  // 头 + 围巾 + 绿帽
  r(x + 2, y - 4 - bob, 5, 5, C.skin);
  r(x + 3, y - 2 - bob, 1, 1, '#2b2118');
  r(x + 1, y + 1 - bob, 7, 1, C.red);
  r(x + 1, y - 6 - bob, 7, 2, C.green);
  r(x + 2, y - 7 - bob, 5, 1, '#3d6650');
}

// ---- 雪：三层视差，横向随风摆动
function snow(t, layers, wind) {
  const conf = layers || [[30, 1.0, 1], [18, 1.9, 1], [10, 3.0, 2]];
  for (let li = 0; li < conf.length; li++) {
    const [n, sp, sz] = conf[li];
    for (let i = 0; i < n; i++) {
      const seed = li * 97 + i * 41;
      const y0 = (seed * 7) % H;
      const y = ((y0 + t * sp * 6) % (H + 8)) - 4;
      let x = (seed * 13) % W;
      x += Math.sin((t * 0.7 + i) * 0.9) * (wind == null ? 2 : wind);
      if (sz === 1) dot(x, y, C.snow);
      else r(x, y, 2, 2, C.snow);
    }
  }
}

function starsBG(t, density) {
  const n = density || 40;
  for (let i = 0; i < n; i++) {
    const x = (i * 137 + 11) % W, y = (i * 61 + 9) % 96;
    const tw = Math.floor(t * 4);
    if ((i + tw) % 5 === 0) r(x, y, 1, 1, C.steel);
    else if ((i + tw) % 3 === 0) dot(x, y, '#9aa6b6');
    else dot(x, y, '#55606f');
  }
}

function shutter(t, t0) {
  // 场景切换：竖条快门擦过 + 2 帧黑
  const lt = t - t0;
  if (lt < 0 || lt > 0.42) return false;
  for (let x = 0; x < W; x += 8) {
    const k = Math.floor(lt / 0.07) * 3;
    const hh = Math.max(0, H - Math.abs(x - k * 8) * 3);
    r(x, 0, 8, H, C.ink);
    if (hh > 0) r(x, H / 2 - hh / 2, 8, hh, C.dusk);
  }
  return true;
}

// ===================== 场景 =====================

// 0–2.4 片名卡：雪夜窗
function scTitle(t) {
  r(0, 0, W, H, C.ink);
  r(28, 34, 180, 96, '#0f1520');
  r(26, 32, 184, 2, '#1d2634');
  r(26, 32, 2, 100, '#1d2634');
  for (let i = 0; i < 4; i++) r(28 + i * 45, 34, 2, 96, '#161e2a');
  r(28, 74, 180, 2, '#161e2a');
  glow(64, 56, 9, C.warm);
  glow(150, 50, 7, C.warm);
  snow(t, [[10, 1.2, 1]]);
  card(96, 132, 290, 44, '寂 寞 烟 火', 26, 0.25, 1.7, { bg: C.cream, t: t });
  card(160, 190, 168, 22, '像素 MV 样片', 12, 0.8, 1.9, { t: t });
  if (t > 1.9) { r(0, 0, W, H, C.ink); }
}

// 2.4–9.04 长路与海
function scRoad(t) {
  const lt = t;
  r(0, 0, W, 96, C.night);
  r(0, 96, W, 38, C.dusk);
  starsBG(t, 30);
  // 月：实心 7px 盘 + 小晕
  halo(409, 40, 9, C.cream);
  r(406, 36, 7, 7, C.cream);
  r(408, 38, 3, 3, '#fffaf0');
  // 远山：按列画雪脊，视差 0.6
  const f1 = lt * 6 * 0.6;
  g.fillStyle = C.far;
  for (let x = 0; x < W; x++) {
    const hh = 26 + Math.round(10 * Math.sin((x + f1) * 0.035) + 6 * Math.sin((x + f1) * 0.011 + 1.4));
    g.fillRect(x, 132 - hh, 1, hh);
  }
  g.fillStyle = '#22303f';
  for (let x = 0; x < W; x++) {
    const hh = 26 + Math.round(10 * Math.sin((x + f1) * 0.035) + 6 * Math.sin((x + f1) * 0.011 + 1.4));
    g.fillRect(x, 132 - hh, 1, 1);
  }
  // 海面
  r(0, 132, W, 22, '#0c1a24');
  const f2 = lt * 6 * 0.25;
  for (let i = 0; i < 60; i++) {
    const wx = ((i * 19 + f2) % (W + 20)) - 10;
    const yy = 134 + (i % 5) * 4;
    r(wx, yy, 3 + (i % 3), 1, '#16303d');
  }
  // 灯塔
  const lhx = 262 - lt * 3.6;
  r(lhx, 46, 10, 86, '#242c38');
  r(lhx + 3, 40, 4, 7, '#2e3642');
  r(lhx - 2, 78, 14, 2, '#1a222c');
  if (t > 5.6) {
    glow(lhx + 5, 44, 5, C.warm);
    r(lhx + 4, 43, 3, 3, C.cream);
    const sweep = Math.floor(t * 4) % 2;
    r(lhx + 8 + sweep * 6, 43, 8, 1, '#5c4a2a');
  }
  // 雪地
  r(0, 154, W, 116, '#101923');
  r(0, 154, W, 2, '#1d2937');
  // 雪堆视差
  const f3 = lt * 6 * 2.0;
  for (let i = -1; i < 12; i++) {
    const bx = i * 56 + (f3 % 56) - 56;
    r(bx, 176, 34, 6, '#16212d');
    r(bx + 6, 171, 20, 5, '#1b2836');
  }
  // 路面
  r(0, 196, W, 74, C.road);
  r(0, 196, W, 2, C.curb);
  for (let i = -1; i < 12; i++) {
    const dx = i * 48 + (f3 % 48) - 48;
    r(dx, 236, 26, 2, '#39404d');
  }
  // 里程碑
  const sx = 132 - lt * 2.4;
  r(sx, 158, 6, 38, '#3a2b20');
  card(sx - 44, 124, 154, 28, '我曾经走过多遥远的路', 14, 2.4, 5.86, { t: t, bg: '#e8dcc2', fit: true });
  // 第二句：灯塔横幅
  card(lhx - 46, 58, 146, 24, '跨越过多少海洋去看你', 14, 5.92, 9.0, { t: t, bg: '#e8dcc2', fit: true });
  // 主角走路
  const gx = 156 + (Math.floor(lt * 8) % 2);
  guy(gx, 202, t, { walk: true, dir: 1 });
  snow(t);
  // 呵气
  const bp = Math.floor(t * 8) % 5;
  if (bp < 3) r(gx + 8 + bp * 2, 190 - bp, 2, 1, '#7d8a9b');
}

// 9.04–15.68 夜路灯火
function scLamp(t) {
  r(0, 0, W, H, C.ink);
  r(0, 150, W, 120, '#0c1119');
  r(0, 150, W, 3, '#161f2b');
  starsBG(t, 22);
  // 楼影
  const bl = [[-4, 96, 70, 60], [72, 108, 60, 48], [138, 88, 74, 68], [216, 104, 62, 52],
              [284, 92, 70, 64], [360, 112, 58, 44], [424, 98, 60, 58]];
  for (const b of bl) {
    r(b[0], b[1], b[2], b[3], '#121a26');
    for (let wy = b[1] + 10; wy < b[1] + b[3] - 8; wy += 16) {
      for (let wx = b[0] + 10; wx < b[0] + b[2] - 8; wx += 18) {
        const lit = ((wx * 7 + wy * 3 + Math.floor(t * 0.5)) % 13) < 3;
        r(wx, wy, 3, 4, lit ? '#8a6734' : '#0c1119');
      }
    }
  }
  // 灯柱
  r(196, 78, 4, 100, '#232d3b');
  r(190, 74, 16, 5, '#2b3a4b');
  // 灯：先熄后亮，亮起时闪两下
  const on = t > 9.4;
  const flick = (t < 9.6 && Math.floor(t * 8) % 2 === 0) ? 0 : 1;
  if (on && flick) {
    halo(198, 88, 13, C.warm);
    r(192, 84, 12, 9, C.warm);
    r(195, 87, 6, 3, '#fff6df');
    // 灯柱受光
    r(197, 92, 2, 26, '#5a4726');
  }
  // 灯下光斑
  if (on && flick) for (let i = 0; i < 22; i++) {
    const yy = 194 + i * 2, wid = 18 + i * 2;
    for (let xx = 0; xx < wid; xx += 3) r(198 - wid / 2 + xx, yy, 1, 1, '#332a1a');
  }
  // 三张便签歌词
  card(28, 40, 170, 26, '孤单的黑夜途中', 14, 9.04, 11.06, { t: t, bg: '#efe6d6', fit: true });
  card(28, 76, 138, 24, '只要想着你', 14, 11.12, 12.72, { t: t, bg: '#e8dcc2', fit: true });
  card(250, 128, 150, 24, '我就不会惶恐', 14, 12.76, 15.62, { t: t, bg: '#efe6d6', fit: true });
  // 主角仰头
  guy(150, 176, t, { armUp: false, dir: 1 });
  r(150 + 2, 168, 5, 2, C.skin);
  snow(t, [[18, 1.1, 2], [10, 2.0, 1]]);
  // 飘动的雪被灯光照亮
  for (let i = 0; i < 12; i++) {
    const seed = i * 53;
    const y = ((seed * 9 + t * 22) % 120) + 150;
    const x = ((seed * 21) % 120) + 138;
    dot(x, y, '#f7e6bc');
  }
}

// 15.68–22.4 岸边站台
function scPlatform(t) {
  r(0, 0, W, 100, C.night);
  starsBG(t, 20);
  halo(70, 34, 10, C.cream);
  r(67, 30, 7, 7, C.cream);
  // 海
  r(0, 100, W, 34, '#0c1a24');
  for (let i = 0; i < 50; i++) {
    const x = (i * 21 + Math.floor(t * 20)) % W;
    r(x, 102 + (i % 6) * 5, 3, 1, '#152c38');
  }
  // 栏杆
  r(0, 134, W, 2, '#2c3a4a');
  for (let x = 10; x < W; x += 26) r(x, 128, 2, 8, '#2c3a4a');
  // 站台地面
  r(0, 150, W, 120, '#0e141c');
  r(0, 150, W, 2, '#243040');
  for (let i = 0; i < 5; i++) r(0, 176 + i * 20, W, 1, '#131a24');
  // 站台灯
  r(60, 108, 3, 44, '#243040');
  halo(61, 106, 12, C.warm);
  r(56, 101, 12, 6, C.warm);
  r(59, 103, 6, 3, '#fff3d6');
  for (let i = 0; i < 16; i++) {
    const wid = 16 + i * 2;
    for (let xx = 0; xx < wid; xx += 3) r(61 - wid / 2 + xx, 152 + i * 3, 1, 1, '#2f2716');
  }
  // 长椅（靠背 + 坐面 + 腿）
  r(268, 136, 4, 30, '#3a2a1e');
  r(268, 136, 4, 9, '#4a3728');
  r(268, 142, 62, 3, '#3a2a1e');
  r(268, 152, 62, 4, '#4a3728');
  r(270, 156, 4, 14, '#2d2118');
  r(324, 156, 4, 14, '#2d2118');
  // 坐着的他
  r(300, 138, 8, 10, C.coat);
  r(300, 136, 8, 2, C.coat);
  r(301, 132, 6, 5, C.skin);
  r(302, 134, 1, 1, '#2b2118');
  r(300, 135, 8, 1, C.red);
  r(300, 129, 8, 2, C.green);
  r(301, 128, 6, 1, '#3d6650');
  r(302, 148, 3, 5, '#23262f');       // 腿
  r(308, 148, 3, 5, '#1c1f27');
  r(300, 152, 4, 2, '#181a22');       // 鞋
  r(308, 152, 4, 2, '#181a22');
  // 走过的人影
  for (const p of [[16.2, 0.8], [18.5, 1.1], [20.7, 0.6]]) {
    const dt = t - p[0];
    if (dt < 0) continue;
    const x = -30 + dt * 24 * p[1];
    if (x > W + 20) continue;
    silhouette(x, 140, Math.floor(t * 8), '#05070b');
  }
  // 歌词
  card(240, 34, 250, 26, '离开时你不用说我都懂', 14, 19.04, 22.3, { t: t, bg: '#e8dcc2', fit: true });
  card(120, 62, 210, 26, '时光的岸上人来了又走', 14, 15.68, 18.98, { t: t, bg: '#efe6d6', fit: true });
  snow(t, [[14, 1.0, 1], [8, 1.8, 1]]);
}

function silhouette(x, y, st, col) {
  const k = st % 4;
  r(x + 1, y - 12, 5, 6, col);
  r(x - 1, y - 6, 9, 12, col);
  r(x - 2, y + 6 - (k === 0 ? 0 : 1), 3, 7, col);
  r(x + 5, y + 6 - (k === 2 ? 0 : 1), 3, 7, col);
  r(x + 9, y - 5, 2, 8, col);
}

// 22.4–29.08 照片墙
function scPhotos(t) {
  r(0, 0, W, H, '#0d0b0f');
  // 灯串
  for (let i = 0; i < 15; i++) {
    const x = 10 + i * 33;
    const y = 24 + Math.round(Math.sin(i * 0.8) * 6);
    if ((i + Math.floor(t * 4)) % 4 === 0) dot(x, y, '#6b5326');
    else dot(x, y, C.warm);
    r(x, y - 2, 1, 2, '#241c14');
  }
  // 三张拍立得：白边 + 内容 + 手写行
  const P = [
    [52, 48, { sky: '#16202e', kind: 0 }],
    [186, 40, { sky: '#141d29', kind: 1 }],
    [320, 50, { sky: '#16202e', kind: 2 }],
  ];
  const sw = Math.floor(t * 8) % 4;
  const tilt = [0, 1, 0, -1][sw];
  for (let i = 0; i < P.length; i++) {
    const [x, y, o] = P[i];
    const dy = (i % 2 ? -tilt : tilt);
    r(x - 6, y - 6 + dy, 82, 76, C.cream);
    r(x - 6, y - 6 + dy, 82, 1, '#fffaf0');
    r(x, y + dy, 70, 56, o.sky);
    // 各自的小画面
    if (o.kind === 0) {                       // 雪夜街
      r(x, y + 40 + dy, 70, 16, '#1d2836');
      r(x + 34, y + 18 + dy, 3, 22, '#2c3a4a');
      dot(x + 35, y + 16 + dy, C.warm);
      r(x + 10, y + 44 + dy, 3, 6, '#c98c2a');
      glow(x + 35, y + 17 + dy, 3, C.warm);
    } else if (o.kind === 1) {                // 长椅
      r(x, y + 40 + dy, 70, 16, '#1d2836');
      r(x + 20, y + 36 + dy, 22, 3, '#4a3728');
      r(x + 20, y + 39 + dy, 2, 8, '#3a2a1e');
      r(x + 40, y + 39 + dy, 2, 8, '#3a2a1e');
      dot(x + 56, y + 18 + dy, C.cream);
    } else {                                  // 烟火
      r(x, y + 44 + dy, 70, 12, '#101b26');
      glow(x + 34, y + 20 + dy, 9, C.ember);
      for (let k = 0; k < 12; k++) {
        const a = k * 0.52 + 1;
        dot(x + 34 + Math.cos(a) * 9, y + 20 + Math.sin(a) * 8 + dy, k % 3 ? C.ember : C.cream);
      }
    }
    // 手写行
    r(x + 4, y + 60 + dy, 26, 1, '#8a8272');
    r(x + 4, y + 63 + dy, 38, 1, '#6f6858');
    // 夹子
    r(x + 32, y - 10 + dy, 6, 4, '#4a4a52');
  }
  // 歌词
  card(50, 150, 196, 28, '感谢你曾让我', 15, 22.4, 24.86, { t: t, bg: '#efe6d6', fit: true });
  card(216, 194, 200, 30, '留在你眼中', 16, 24.92, 27.74, { t: t, bg: '#efe6d6', fit: true });
  // 颗粒
  for (let i = 0; i < 24; i++) {
    const st = Math.floor(t * 8);
    const x = (i * 73 + st * 17) % W, y = (i * 41 + st * 29) % H;
    dot(x, y, '#221c22');
  }
}

// 29.08–42.14 山顶星空
function scStars(t) {
  r(0, 0, W, 196, '#080c14');
  r(0, 196, W, 74, '#070a10');
  // 常亮底星
  for (let i = 0; i < 58; i++) {
    const x = (i * 89 + 17) % W, y = (i * 37 + 11) % 150 + 6;
    const tw = (i + Math.floor(t * 4)) % 7 === 0;
    r(x, y, 1, 1, tw ? '#dfe7f2' : '#4d5868');
  }
  // 逐颗点亮，唱到"就点亮了星空"时级联
  const lit = t < 39.48 ? Math.round((t - 29.08) * 9) : Math.round((t - 39.48) * 60) + 108;
  for (let i = 0; i < 130; i++) {
    const x = (i * 89 + 17) % W, y = (i * 37 + 11) % 150 + 6;
    if (i >= lit) continue;
    r(x, y, 1, 1, '#c9d5e6');
    if (i % 13 === 0) r(x - 1, y - 1, 3, 3, '#5c6878');
  }
  if (t > 39.9) {
    const pts = [[64, 42], [108, 28], [152, 46], [198, 32], [240, 54], [288, 36], [332, 52]];
    const n = Math.min(pts.length - 1, Math.floor((t - 39.9) / 0.35));
    for (let i = 0; i < n; i++) linePx(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#44546a');
  }
  // 山脊两层
  g.fillStyle = '#0e1622';
  for (let x = 0; x < W; x++) {
    const hh = 30 + Math.round(9 * Math.sin(x * 0.02 + 1) + 5 * Math.sin(x * 0.051));
    g.fillRect(x, 196 - hh, 1, hh);
  }
  g.fillStyle = '#16212e';
  for (let x = 0; x < W; x++) {
    const hh = 14 + Math.round(7 * Math.sin(x * 0.033 + 2.4));
    g.fillRect(x, 196 - hh, 1, hh);
  }
  r(0, 196, W, 2, '#1b2734');
  guy(198, 182, t, { armUp: true, dir: 1 });
  if (t > 39.6) {
    const k = Math.min(1, (t - 39.6) / 1.4);
    halo(208, 172, 5 + Math.round(k * 14), C.warm);
    r(206, 170, 3, 3, C.cream);
  }
  card(30, 44, 220, 28, '我曾经走过最遥远的路', 14, 29.08, 32.3, { t: t, bg: '#e2dac6', fit: true });
  card(250, 84, 210, 28, '想要去拥抱未成真的梦', 14, 32.36, 35.65, { t: t, bg: '#e2dac6', fit: true });
  card(60, 116, 180, 26, '迷失在黑夜途中', 14, 35.72, 37.72, { t: t, bg: '#e2dac6', fit: true });
  card(300, 116, 150, 26, '只要想起你', 14, 37.8, 39.45, { t: t, bg: '#e2dac6', fit: true });
  card(240, 30, 180, 26, '就点亮了星空', 15, 39.48, 42.3, { t: t, bg: C.cream, fit: true });
  snow(t, [[10, 0.8, 1]]);
}

function linePx(x0, y0, x1, y1, col) {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) dot(x0 + dx * i / n, y0 + dy * i / n, col);
}

// 42.36–52 烟火与纸船
function scFire(t) {
  r(0, 0, W, 176, C.ink);
  starsBG(t, 30);
  // 远岸线
  r(0, 176, W, 3, '#122030');
  // 海面
  r(0, 179, W, 91, '#0a141d');
  for (let i = 0; i < 44; i++) {
    const x = (i * 23 + Math.floor(t * 10)) % W;
    const y = 182 + (i % 7) * 9;
    r(x, y, 4, 1, '#14293a');
  }
  // 烟花：三次，扩散 + 余烬下落 + 水面倒影
  const bursts = [[42.9, 152, 62, C.ember], [45.3, 330, 54, C.red], [47.6, 238, 76, C.warm]];
  for (const b of bursts) {
    const [bt, bx, by, col] = b;
    const dt = t - bt;
    if (dt < 0) continue;
    const rad = Math.min(10 + dt * 30, 52);
    const st = Math.floor(t * 8);
    for (let k = 0; k < 44; k++) {
      const a = k * 0.1428 + bt;
      const rr = rad * (1 - 0.16 * ((k + st) % 3));
      const x = bx + Math.cos(a) * rr, y = by + Math.sin(a) * rr * 0.92;
      if (y > 176) continue;
      dot(x, y, k % 5 === 0 ? C.cream : col);
      if (k % 6 === 0) dot(x + Math.cos(a) * 2, y + Math.sin(a) * 2, C.cream);
    }
    r(bx - 1, by - 1, 3, 3, C.cream);
    if (dt < 0.5) halo(bx, by, 10, col);
    // 余烬
    if (dt > 0.5) {
      for (let k = 0; k < 22; k++) {
        const a = k * 0.28 + bt;
        const fy = by + Math.sin(a) * rad * 0.92 + (dt - 0.5) * 16;
        const fx = bx + Math.cos(a) * rad + (dt - 0.5) * 1.5;
        if (fy < 176) dot(fx, fy, k % 3 ? '#8a5a2a' : C.ember);
      }
    }
    // 倒影
    for (let k = 0; k < 16; k++) {
      const rx = bx + (k - 8) * 3;
      if (rx < 0 || rx > W) continue;
      const ry = 182 + ((k * 5 + st) % 26);
      if ((k + st) % 2) dot(rx, ry, '#3a2a18');
    }
  }
  // 纸船：折纸船形，浮在水面随波起伏
  const bx2 = 132 + Math.sin(t * 0.6) * 3;
  const by2 = 198 + Math.round(Math.sin(t * 1.1));
  r(bx2 + 4, by2 + 5, 22, 1, '#8e8674');
  r(bx2 + 2, by2 + 3, 26, 2, '#e2d8c0');
  r(bx2 + 6, by2 + 1, 18, 2, '#f2ecdd');
  r(bx2 + 9, by2 - 1, 12, 2, '#e2d8c0');
  // 帆（三角）
  const sail = [2, 4, 6, 8, 8, 6, 4, 2];
  for (let i = 0; i < sail.length; i++) {
    r(bx2 + 15 - sail[i] / 2, by2 - 4 - i, sail[i], 1, i < 3 ? '#f7f2e4' : '#ded4bc');
  }
  r(bx2 + 15, by2 - 4, 1, 5, '#b8ad96');
  for (let i = 0; i < 9; i++) dot(bx2 + 4 + i * 2, by2 + 8 + (i % 3), '#4a5463');
  // 歌词
  card(26, 112, 216, 26, '流浪的纸船忘不掉港口', 14, 42.36, 45.7, { t: t, bg: '#e2dac6', fit: true });
  card(250, 118, 208, 26, '渐灭的花火割不断彩虹', 14, 45.76, 49.0, { t: t, bg: '#e2dac6', fit: true });
  card(96, 142, 288, 32, '你就是我心中永恒的天空', 15, 49.04, 52.0, { t: t, bg: C.cream, fit: true });
  // 收尾：只剩一片雪花
  if (t > 50.6) {
    const k = Math.min(1, (t - 50.6) / 1.2);
    r(0, 0, W, H, C.ink);
    r(239, 120 + Math.round(k * 40), 2, 2, C.snow);
    if (t > 51.3) { r(0, 0, W, H, C.ink); r(239, 140, 2, 2, C.snow); }
  }
}
// ===================== 时间轴 =====================
const SEG = [
  [0.00, 2.40, scTitle],
  [2.40, 9.04, scRoad],
  [9.04, 15.68, scLamp],
  [15.68, 22.40, scPlatform],
  [22.40, 29.08, scPhotos],
  [29.08, 42.36, scStars],
  [42.36, 52.00, scFire],
];

function seek(t) {
  window.__t = t;
  g.clearRect(0, 0, W, H);
  for (const [a, b, fn] of SEG) {
    if (t >= a && t < b) { fn(t); break; }
  }
  // 场景接缝：两帧黑 + 竖条快门
  for (const [a] of SEG) {
    if (a > 0 && Math.abs(t - a) < 0.05) { r(0, 0, W, H, C.ink); break; }
  }
  out.imageSmoothingEnabled = false;
  out.clearRect(0, 0, W * SCALE, H * SCALE);
  out.drawImage(buf, 0, 0, W * SCALE, H * SCALE);
}

init();
seek(0);
window.READY = true;








