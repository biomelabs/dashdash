export const SVC_RSC = 0x1814;
export const CHR_MEAS = 0x2a53;

export interface ParsedRSC {
  speed: number;
  cadence: number;
  strideLen: number | null;
  totalDist: number | null;
  isRunning: boolean;
}

export function parseRSC(dv: DataView): ParsedRSC {
  const flags = dv.getUint8(0);
  const hasStride = (flags & 0x01) !== 0;
  const hasDist = (flags & 0x02) !== 0;
  const isRunning = (flags & 0x04) !== 0;

  const speed = dv.getUint16(1, true) / 256.0;
  const cadence = dv.getUint8(3);

  let strideLen: number | null = null;
  let totalDist: number | null = null;
  let offset = 4;

  if (hasStride) {
    strideLen = dv.getUint16(offset, true) / 100.0;
    offset += 2;
  }

  if (hasDist) {
    totalDist = dv.getUint32(offset, true) / 10.0;
  }

  return { speed, cadence, strideLen, totalDist, isRunning };
}

export function hexStr(dv: DataView): string {
  const out: string[] = [];
  for (let i = 0; i < dv.byteLength; i += 1) {
    out.push(dv.getUint8(i).toString(16).padStart(2, "0").toUpperCase());
  }
  return out.join(" ");
}
