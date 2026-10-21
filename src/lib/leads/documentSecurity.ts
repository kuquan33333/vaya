export function hasAllowedSignature(contentType: string, bytes: Uint8Array): boolean {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === "image/webp") {
    return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!hasAllowedSignature("image/jpeg", bytes)) return null;
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const markerStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) {
      parts.push(bytes.slice(markerStart));
      return concatBytes(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.slice(markerStart, offset));
      continue;
    }
    if (offset + 2 > bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const segmentEnd = offset + segmentLength;
    // APP1 is where EXIF/XMP metadata is normally stored. COM is also free
    // text and can contain names, comments or other identifying information.
    if (marker !== 0xe1 && marker !== 0xfe) {
      parts.push(bytes.slice(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }
  return null;
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!hasAllowedSignature("image/png", bytes)) return null;
  const parts: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  let foundEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32Be(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    const kind = text(bytes.slice(offset + 4, offset + 8));
    if (!(kind === "eXIf" || kind === "iTXt" || kind === "tEXt" || kind === "zTXt" || kind === "tIME")) {
      parts.push(bytes.slice(offset, end));
    }
    offset = end;
    if (kind === "IEND") {
      foundEnd = true;
      break;
    }
  }
  return foundEnd && offset === bytes.length ? concatBytes(parts) : null;
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000;
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function stripWebpMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || text(bytes.slice(0, 4)) !== "RIFF" || text(bytes.slice(8, 12)) !== "WEBP") return null;
  const parts: Uint8Array[] = [bytes.slice(0, 12)];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = readUint32Le(bytes, offset + 4);
    const paddedSize = size + (size % 2);
    const end = offset + 8 + paddedSize;
    if (end > bytes.length) return null;
    const kind = text(bytes.slice(offset, offset + 4));
    if (!(kind === "EXIF" || kind === "XMP " || kind === "ICCP")) {
      parts.push(bytes.slice(offset, end));
    }
    offset = end;
  }
  if (offset !== bytes.length) return null;
  const result = concatBytes(parts);
  writeUint32Le(result, 4, result.length - 8);
  return result;
}

/** Optional metadata sanitizer retained for callers that explicitly need it. */
export function stripImageMetadata(contentType: string, bytes: Uint8Array): Uint8Array | null {
  if (contentType === "image/jpeg") return stripJpegMetadata(bytes);
  if (contentType === "image/png") return stripPngMetadata(bytes);
  if (contentType === "image/webp") return stripWebpMetadata(bytes);
  return null;
}
