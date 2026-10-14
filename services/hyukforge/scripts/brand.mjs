/**
 * 브랜드 에셋 생성기
 *
 * 원본 로고(public/brand/lockup.png)는 1254x1254에 여백이 크고 검정 배경이 박혀 있다.
 * 이 스크립트가 원본을 분석해서 웹에 쓸 크기로 잘라낸다.
 * 외부 이미지 라이브러리 없이 zlib만으로 PNG를 직접 디코딩·인코딩한다.
 *
 *   node scripts/brand.mjs analyze   원본 분석 (색상·경계 확인)
 *   node scripts/brand.mjs build     잘라낸 에셋 생성
 */

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SRC = "public/brand/lockup.png";

/* ── PNG 디코딩 ───────────────────────────────────────── */

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG가 아닙니다");

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const depth = buf[24];
  const colorType = buf[25];
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`지원하지 않는 형식: depth=${depth} colorType=${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;

  // IDAT 청크를 모아 하나로 잇는다
  const parts = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") parts.push(buf.subarray(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += len + 12;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const px = Buffer.alloc(height * stride);

  // 스캔라인 필터 해제 (PNG 스펙 9장)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 0xff;
    }
  }

  return { width, height, channels, px };
}

/* ── PNG 인코딩 ───────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng({ width, height, channels, px }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;

  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // 필터 없음
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── 도우미 ───────────────────────────────────────────── */

const at = (img, x, y) => {
  const i = (y * img.width + x) * img.channels;
  return [img.px[i], img.px[i + 1], img.px[i + 2]];
};

const hex = ([r, g, b]) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/**
 * 배경(#060606 단색)을 알파로 뺀다. 라이트 테마 위에 로고를 올리려면
 * 로고 PNG에 박힌 배경색부터 걷어내야 한다 (지금까지는 페이지 bg와
 * 색을 맞춰서 안 보이게 숨기는 식이었다 — 라이트에서는 그 트릭이 안 통한다).
 *
 * 그냥 "배경색과 같으면 투명"이 아니라, 안티에일리어싱된 가장자리까지 고려한다.
 * 밝기 차이로 알파를 매끄럽게 깔고(0~40 대비를 0~255 알파로), 배경과 섞인
 * 가장자리 색은 역산해서 되돌린다(observed = a·F + (1-a)·bg → F 를 구한다).
 * 이걸 안 하면 밝은 바탕에 올렸을 때 글자 테두리에 검은 띠가 남는다.
 */
function matte(region, bg) {
  const { width, height, px } = region;
  const out = Buffer.alloc(width * height * 4);
  const bgLum = lum(bg);
  const T = 40;
  for (let i = 0; i < width * height; i++) {
    const r = px[i * 3];
    const g = px[i * 3 + 1];
    const b = px[i * 3 + 2];
    const a = Math.min(1, Math.max(0, lum([r, g, b]) - bgLum) / T);
    if (a > 0.06) {
      out[i * 4] = clamp8(bg[0] + (r - bg[0]) / a);
      out[i * 4 + 1] = clamp8(bg[1] + (g - bg[1]) / a);
      out[i * 4 + 2] = clamp8(bg[2] + (b - bg[2]) / a);
    } else {
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
    }
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return { width, height, channels: 4, px: out };
}

/**
 * 라이트 테마용 색 반전.
 *
 * matte()로 배경을 걷어내도 글자 자체가 밝은 잉크색(다크 배경 기준으로 골랐던
 * 흰색 계열)이라 밝은 바탕 위에서는 그대로 안 보인다. 앰버 사선은 그대로 두고
 * (로고라 대비 규정 예외), 앰버가 아닌 획만 라이트 테마 잉크색으로 다시 칠한다.
 * 앰버 판정은 scripts 전체에서 쓰는 것과 같은 기준이다(R이 B보다 70 이상 높고
 * R>140).
 */
function recolorForLight(matted, srcPx, ink) {
  const { width, height, px } = matted;
  const out = Buffer.from(px);
  for (let i = 0; i < width * height; i++) {
    if (px[i * 4 + 3] === 0) continue; // 완전 투명은 건드릴 필요 없다
    const r = srcPx[i * 3];
    const b = srcPx[i * 3 + 2];
    const isAmber = r - b > 70 && r > 140;
    if (!isAmber) {
      out[i * 4] = ink[0];
      out[i * 4 + 1] = ink[1];
      out[i * 4 + 2] = ink[2];
    }
  }
  return { width, height, channels: 4, px: out };
}

/** 배경보다 밝은 픽셀이 차지하는 사각 영역 */
function contentBox(img, threshold = 26) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (lum(at(img, x, y)) > threshold) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * img.channels);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * img.width + x0) * img.channels;
    img.px.copy(out, y * w * img.channels, from, from + w * img.channels);
  }
  return { width: w, height: h, channels: img.channels, px: out };
}

/* ── 명령 ─────────────────────────────────────────────── */

const img = decodePng(readFileSync(SRC));
const cmd = process.argv[2] ?? "analyze";

if (cmd === "analyze") {
  console.log(`원본       ${img.width}x${img.height}, ${img.channels}채널`);
  console.log(`배경(모서리) ${hex(at(img, 4, 4))}`);

  // 앰버 영역의 대표색 — 하이라이트 한 점이 아니라 중앙값을 쓴다
  const amber = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const p = at(img, x, y);
      if (p[0] - p[2] > 70 && p[0] > 140) amber.push(p); // R이 B보다 확실히 높은 픽셀
    }
  }
  amber.sort((a, b) => lum(a) - lum(b));
  console.log(
    `앰버       중앙값 ${hex(amber[amber.length >> 1])} · ` +
      `어두운쪽 ${hex(amber[Math.floor(amber.length * 0.15)])} · ` +
      `밝은쪽 ${hex(amber[Math.floor(amber.length * 0.85)])}   (현재 토큰 #E8A33D)`,
  );

  const box = contentBox(img);
  console.log(`내용 영역   x ${box.x0}–${box.x1}, y ${box.y0}–${box.y1}  (${box.w}x${box.h})`);
  console.log(`여백       상 ${box.y0}  하 ${img.height - 1 - box.y1}  좌 ${box.x0}  우 ${img.width - 1 - box.x1}`);

  // HF 마크와 글자를 가르는 가로줄을 찾는다 (빈 스캔라인)
  const gaps = [];
  let run = null;
  for (let y = box.y0; y <= box.y1; y++) {
    let bright = 0;
    for (let x = box.x0; x <= box.x1; x++) if (lum(at(img, x, y)) > 26) bright++;
    if (bright === 0) {
      run = run ?? y;
    } else if (run !== null) {
      if (y - run > 4) gaps.push([run, y - 1]);
      run = null;
    }
  }
  console.log(`가로 여백줄 ${gaps.map(([a, b]) => `${a}–${b}`).join(", ") || "없음"}`);
} else if (cmd === "build") {
  const box = contentBox(img);

  /** 주어진 y 구간에서 실제 내용이 있는 x 범위 */
  function xRange(yTop, yBottom) {
    let x0 = img.width, x1 = -1;
    for (let y = yTop; y <= yBottom; y++) {
      for (let x = 0; x < img.width; x++) {
        if (lum(at(img, x, y)) > 26) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    return [x0, x1];
  }

  const write = (name, yTop, yBottom, padRatio = 0.08) => {
    const [x0, x1] = xRange(yTop, yBottom);
    const pad = Math.round((yBottom - yTop) * padRatio);
    const cx = Math.max(0, x0 - pad);
    const cy = Math.max(0, yTop - pad);
    const region = crop(
      img,
      cx,
      cy,
      Math.min(img.width - cx, x1 - x0 + 1 + pad * 2),
      Math.min(img.height - cy, yBottom - yTop + 1 + pad * 2),
    );
    // 파일로는 배경을 걷어낸 투명 버전을 낸다. 반환값은 원본(불투명) —
    // 아래 파비콘 합성은 자기 배경 위에 다시 칠할 거라 알파가 필요 없다.
    const matted = matte(region, at(img, 4, 4));
    const buf = encodePng(matted);
    writeFileSync(`public/brand/${name}`, buf);
    console.log(
      `${name.padEnd(20)} ${String(region.width).padStart(4)}x${String(region.height).padEnd(4)}  ${(buf.length / 1024).toFixed(0).padStart(4)}KB`,
    );

    // 라이트 테마용 — 글자만 어두운 잉크로, 앰버 사선은 그대로.
    const lightName = name.replace(/\.png$/, ".light.png");
    const lightBuf = encodePng(recolorForLight(matted, region.px, [0x17, 0x14, 0x0f]));
    writeFileSync(`public/brand/${lightName}`, lightBuf);
    console.log(`${lightName.padEnd(20)} ${String(region.width).padStart(4)}x${String(region.height).padEnd(4)}  ${(lightBuf.length / 1024).toFixed(0).padStart(4)}KB`);

    return region;
  };

  // analyze가 찾은 가로 여백줄 기준으로 세 조각을 낸다
  write("lockup.trim.png", box.y0, box.y1, 0.04); // 전체 (히어로·OG 이미지)
  const mark = write("mark.png", box.y0, 648); // HF 마크만 (작은 자리)
  write("wordmark.png", 700, 775); // HYUKFORGE 글자만

  // 파비콘 — 마크를 정사각 캔버스 가운데 두고 배경색으로 채운다.
  // 크기를 줄이지 않고 여백만 더한다 (재표본화 없이 선명하게 유지).
  const bg = at(img, 4, 4);
  const side = Math.max(mark.width, mark.height);
  const px = Buffer.alloc(side * side * 3);
  for (let i = 0; i < side * side; i++) {
    px[i * 3] = bg[0];
    px[i * 3 + 1] = bg[1];
    px[i * 3 + 2] = bg[2];
  }
  const ox = (side - mark.width) >> 1;
  const oy = (side - mark.height) >> 1;
  for (let y = 0; y < mark.height; y++) {
    mark.px.copy(
      px,
      ((oy + y) * side + ox) * 3,
      y * mark.width * 3,
      (y + 1) * mark.width * 3,
    );
  }
  const icon = encodePng({ width: side, height: side, channels: 3, px });
  writeFileSync("app/icon.png", icon);
  console.log(`app/icon.png         ${side}x${side}  ${(icon.length / 1024).toFixed(0).padStart(4)}KB`);
}
