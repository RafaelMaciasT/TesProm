// Generador QR SVG puro (ISO/IEC 18004, Nivel L, Versiones 1 a 10) sin dependencias externas
constVERSION_CAPACITIES_L = [
  0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
];

const EC_CODEWORDS_L = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const NUM_BLOCKS_L = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];

const ALIGNMENT_PATTERNS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function getGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(data, ecLen) {
  const gen = getGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    for (let j = 0; j < ecLen; j += 1) {
      rem[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return rem;
}

function getTotalModules(version) {
  const size = version * 4 + 17;
  let total = size * size - 3 * 64 - 2 * (size - 16) - 31;
  const align = ALIGNMENT_PATTERNS[version];
  if (align.length > 0) {
    const count = align.length * align.length - 3;
    total -= count * 25;
    if (align.length > 2) {
      total += (align.length - 2) * 10;
    }
  }
  if (version >= 7) total -= 36;
  return Math.floor(total / 8);
}

export function generateQrMatrix(text) {
  const utf8 = new TextEncoder().encode(String(text || ''));
  let version = 1;
  while (
    version <= 10 &&
    utf8.length > constVERSION_CAPACITIES_L[version]
  ) {
    version += 1;
  }
  if (version > 10) {
    version = 10;
  }

  const payload = utf8.slice(0, constVERSION_CAPACITIES_L[version]);
  const totalCodewords = getTotalModules(version);
  const ecPerBlock = EC_CODEWORDS_L[version];
  const numBlocks = NUM_BLOCKS_L[version];
  const dataCodewordsLen = totalCodewords - ecPerBlock * numBlocks;

  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(payload.length, version >= 10 ? 16 : 8);
  for (let i = 0; i < payload.length; i += 1) {
    pushBits(payload[i], 8);
  }

  const maxBits = dataCodewordsLen * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(dataCodewordsLen);
  for (let i = 0; i < bits.length / 8; i += 1) {
    let b = 0;
    for (let j = 0; j < 8; j += 1) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }
  let padIdx = 0;
  for (let i = bits.length / 8; i < dataCodewordsLen; i += 1) {
    dataBytes[i] = padIdx % 2 === 0 ? 0xec : 0x11;
    padIdx += 1;
  }

  const blocksData = [];
  const blocksEc = [];
  const baseBlockSize = Math.floor(dataCodewordsLen / numBlocks);
  const extraBlocks = dataCodewordsLen % numBlocks;
  let offset = 0;
  for (let b = 0; b < numBlocks; b += 1) {
    const bLen = baseBlockSize + (b >= numBlocks - extraBlocks ? 1 : 0);
    const slice = dataBytes.slice(offset, offset + bLen);
    offset += bLen;
    blocksData.push(slice);
    blocksEc.push(computeReedSolomon(slice, ecPerBlock));
  }

  const finalCodewords = [];
  const maxBlockLen = baseBlockSize + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      if (i < blocksData[b].length) finalCodewords.push(blocksData[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (let b = 0; b < numBlocks; b += 1) {
      finalCodewords.push(blocksEc[b][i]);
    }
  }

  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setFunctionModule = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = dark ? 1 : 0;
      reserved[r][c] = 1;
    }
  };

  const placeFinder = (row, col) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const isBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const isOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const isInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(row + dr, col + dc, !isBorder && (isOuter || isInner));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  const alignCoords = ALIGNMENT_PATTERNS[version];
  for (let i = 0; i < alignCoords.length; i += 1) {
    for (let j = 0; j < alignCoords.length; j += 1) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === alignCoords.length - 1) ||
        (i === alignCoords.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = alignCoords[i];
      const cc = alignCoords[j];
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) === 2 || (dr === 0 && dc === 0);
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  setFunctionModule(size - 8, 8, true);

  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const c = right - j;
        if (!reserved[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byte = finalCodewords[bitIdx >> 3];
            dark = ((byte >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx += 1;
          }
          if ((r + c) % 2 === 0) dark = !dark;
          matrix[r][c] = dark ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  // Format bits for Level L (01) and Mask 0 (000) -> 0x77c4 (111011111000100)
  const formatBits = 0x77c4;
  const getFmtBit = (i) => ((formatBits >> i) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) matrix[8][i] = getFmtBit(i) ? 1 : 0;
  matrix[8][7] = getFmtBit(6) ? 1 : 0;
  matrix[8][8] = getFmtBit(7) ? 1 : 0;
  matrix[7][8] = getFmtBit(8) ? 1 : 0;
  for (let i = 9; i < 15; i += 1) matrix[14 - i][8] = getFmtBit(i) ? 1 : 0;

  for (let i = 0; i < 8; i += 1) matrix[8][size - 1 - i] = getFmtBit(i) ? 1 : 0;
  for (let i = 8; i < 15; i += 1) matrix[size - 15 + i][8] = getFmtBit(i) ? 1 : 0;

  return matrix;
}

export default function QrCodeSvg({ value, size = 192 }) {
  const matrix = generateQrMatrix(value || 'TESPROM');
  const count = matrix.length;
  const margin = 2;
  const viewBoxSize = count + margin * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      className="mx-auto rounded-xl bg-white"
      role="img"
      aria-label={`Código QR para ${value}`}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" />
      {matrix.map((row, rIdx) =>
        Array.from(row).map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + margin}
              y={rIdx + margin}
              width={1}
              height={1}
              fill="#1C1917"
            />
          ) : null
        )
      )}
    </svg>
  );
}
