/**
 * generate-icon.js — 순수 Buffer 조작으로 32x32 ICO 생성
 * 의존성 없음. 보라색(#8b5cf6) 배경에 흰색 대시보드 바 3개.
 *
 * 실행: node generate-icon.js
 * 출력: dashboard.ico (동일 폴더)
 */

const fs = require('fs');
const path = require('path');

const W = 32;
const H = 32;

// ── 픽셀 버퍼 (BGRA, bottom-up 저장) ──────────────────────────────
const pixels = Buffer.alloc(W * H * 4);

// 좌표 → 픽셀 버퍼 인덱스 (ICO BMP는 bottom-up)
function idx(x, y) {
  return ((H - 1 - y) * W + x) * 4;
}

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = idx(x, y);
  pixels[i + 0] = b; // B
  pixels[i + 1] = g; // G
  pixels[i + 2] = r; // R
  pixels[i + 3] = a; // A
}

// 배경: 보라색 (#8b5cf6 = R139, G92, B246)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // 라운드 코너 (반지름 4px)
    const dx = Math.min(x, W - 1 - x);
    const dy = Math.min(y, H - 1 - y);
    const r = 4;
    if (dx < r && dy < r) {
      const dist = Math.sqrt((r - dx) ** 2 + (r - dy) ** 2);
      if (dist > r) {
        setPixel(x, y, 0, 0, 0, 0); // 투명
        continue;
      }
    }
    setPixel(x, y, 139, 92, 246);
  }
}

// 흰색 대시보드 바 3개 그리기
// 왼쪽 작은 사각형 + 오른쪽 바 패턴
function drawBar(x1, x2, y1, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(x, y, 255, 255, 255);
    }
  }
}

// 상단 바: 작은 원 + 긴 바
drawBar(5, 9, 8, 11);   // 왼쪽 작은 사각형
drawBar(12, 26, 8, 11); // 오른쪽 긴 바

// 중간 바
drawBar(5, 9, 14, 17);
drawBar(12, 26, 14, 17);

// 하단 바 (짧게)
drawBar(5, 9, 20, 23);
drawBar(12, 22, 20, 23);

// ── BMP 헤더 (BITMAPINFOHEADER, 40 bytes) ──────────────────────────
const bih = Buffer.alloc(40);
bih.writeUInt32LE(40, 0);       // biSize
bih.writeInt32LE(W, 4);         // biWidth
bih.writeInt32LE(H * 2, 8);     // biHeight (ICO는 AND 마스크 포함해서 2배)
bih.writeUInt16LE(1, 12);       // biPlanes
bih.writeUInt16LE(32, 14);      // biBitCount (32bpp = BGRA)
bih.writeUInt32LE(0, 16);       // biCompression = BI_RGB
bih.writeUInt32LE(W * H * 4, 20); // biSizeImage
// 나머지 필드는 0 (XPelsPerMeter, YPelsPerMeter, ClrUsed, ClrImportant)

// AND 마스크 (32px → 4바이트/행, 32행 = 128 bytes, 모두 0 = 전체 표시)
const andMask = Buffer.alloc(4 * H, 0);

const bmpData = Buffer.concat([bih, pixels, andMask]);

// ── ICO 헤더 (6 bytes) ─────────────────────────────────────────────
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type = 1 (ICO)
icoHeader.writeUInt16LE(1, 4); // Count = 1 image

// ── 디렉토리 엔트리 (16 bytes) ────────────────────────────────────
const dir = Buffer.alloc(16);
dir.writeUInt8(W, 0);              // bWidth
dir.writeUInt8(H, 1);              // bHeight
dir.writeUInt8(0, 2);              // bColorCount (0 = 256 이상 or true color)
dir.writeUInt8(0, 3);              // bReserved
dir.writeUInt16LE(1, 4);           // wPlanes
dir.writeUInt16LE(32, 6);          // wBitCount
dir.writeUInt32LE(bmpData.length, 8); // dwBytesInRes
dir.writeUInt32LE(22, 12);         // dwImageOffset (6 + 16 = 22)

// ── ICO 파일 조합 및 저장 ─────────────────────────────────────────
const icoData = Buffer.concat([icoHeader, dir, bmpData]);
const outPath = path.join(__dirname, 'dashboard.ico');
fs.writeFileSync(outPath, icoData);

console.log(`✅ dashboard.ico 생성 완료: ${outPath} (${icoData.length} bytes)`);
