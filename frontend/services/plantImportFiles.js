// Browser-only plant file reader. Supports loose Markdown/text and ordinary ZIP exports.
// ZIP extraction uses the native DecompressionStream API; no network or server upload.
const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_PLANT_BYTES = 2 * 1024 * 1024;
const MAX_PLANT_FILES = 500;
const MAX_ARCHIVE_ENTRIES = 2000;
const decoder = new TextDecoder('utf-8', { fatal: true });

const isPlantText = name => /\.(?:md|markdown|txt)$/i.test(name);
const isZip = name => /\.zip$/i.test(name);

function readString(bytes) {
  try { return decoder.decode(bytes).replace(/^\uFEFF/, ''); }
  catch { throw new Error('An import file is not valid UTF-8 text.'); }
}

function crc32(bytes) {
  let crc = -1;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function readNumber(view, offset, width, limit) {
  if (offset < 0 || offset + width > limit) throw new Error('The ZIP file is incomplete or damaged.');
  return width === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true);
}

async function inflateEntry(compressed, method, expectedSize) {
  if (method === 0) return compressed;
  if (method !== 8) throw new Error('This ZIP uses an unsupported compression method.');
  if (typeof DecompressionStream === 'undefined') throw new Error('ZIP decompression is unavailable in this browser. Update iOS or import extracted plant files.');
  let result;
  try {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    result = new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { throw new Error('Could not decompress a plant entry. The ZIP may be damaged or unsupported.'); }
  if (result.length !== expectedSize) throw new Error('A ZIP entry has an incorrect uncompressed size.');
  return result;
}

async function readZip(file) {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Choose a ZIP smaller than 50 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65557); pos--) {
    if (readNumber(view, pos, 4, bytes.length) === 0x06054B50 &&
        pos + 22 + readNumber(view, pos + 20, 2, bytes.length) === bytes.length) {
      end = pos;
      break;
    }
  }
  if (end < 0) throw new Error('This is not a supported ZIP archive.');
  const disk = readNumber(view, end + 4, 2, bytes.length);
  const centralDisk = readNumber(view, end + 6, 2, bytes.length);
  const count = readNumber(view, end + 10, 2, bytes.length);
  const total = readNumber(view, end + 12, 4, bytes.length);
  let offset = readNumber(view, end + 16, 4, bytes.length);
  if (disk || centralDisk || count === 0xffff || total === 0xffffffff) throw new Error('Multi-disk or ZIP64 archives are not supported.');
  if (count > MAX_ARCHIVE_ENTRIES) throw new Error('The ZIP contains too many entries.');
  if (offset + total > end) throw new Error('The ZIP central directory is damaged.');
  const plants = [];
  let textTotal = 0;
  let skippedImages = 0;

  for (let index = 0; index < count; index++) {
    if (readNumber(view, offset, 4, bytes.length) !== 0x02014B50) throw new Error('The ZIP file list is damaged.');
    const flags = readNumber(view, offset + 8, 2, bytes.length);
    const method = readNumber(view, offset + 10, 2, bytes.length);
    const expectedCrc = readNumber(view, offset + 16, 4, bytes.length);
    const compressedSize = readNumber(view, offset + 20, 4, bytes.length);
    const expectedSize = readNumber(view, offset + 24, 4, bytes.length);
    const nameLength = readNumber(view, offset + 28, 2, bytes.length);
    const extraLength = readNumber(view, offset + 30, 2, bytes.length);
    const commentLength = readNumber(view, offset + 32, 2, bytes.length);
    const localOffset = readNumber(view, offset + 42, 4, bytes.length);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) throw new Error('The ZIP filename is damaged.');
    const name = readString(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset = next;
    if (!name || name.endsWith('/') || name.split('/').includes('..') || name.startsWith('/')) continue;
    if (/\.(?:jpg|jpeg|png|webp|gif)$/i.test(name)) skippedImages++;
    if (!isPlantText(name) || name.split('/').some(part => part.startsWith('__MACOSX') || part.startsWith('.')) ||
        /(?:^|\/)(?:readme|instructions?|manifest)(?:[-_.][^/]*)?\.txt$/i.test(name)) continue;
    if (flags & 1) throw new Error('Password-protected ZIP files cannot be imported.');
    if (expectedSize > MAX_PLANT_BYTES) throw new Error(`${name} exceeds the 2 MB limit for a plant page.`);
    textTotal += expectedSize;
    if (textTotal > 50 * 1024 * 1024) throw new Error('There is too much plant text in this ZIP.');
    if (plants.length >= MAX_PLANT_FILES) throw new Error('Import at most 500 plants at a time.');
    if (readNumber(view, localOffset, 4, bytes.length) !== 0x04034B50) throw new Error('A ZIP entry header is damaged.');
    const localName = readNumber(view, localOffset + 26, 2, bytes.length);
    const localExtra = readNumber(view, localOffset + 28, 2, bytes.length);
    const dataOffset = localOffset + 30 + localName + localExtra;
    if (dataOffset + compressedSize > bytes.length) throw new Error('A ZIP entry is incomplete.');
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const data = await inflateEntry(compressed, method, expectedSize);
    if (data.length !== expectedSize || crc32(data) !== expectedCrc) throw new Error(`${name} did not pass ZIP integrity checks.`);
    plants.push({ name, contents: readString(data) });
  }
  if (!plants.length) throw new Error('The ZIP contains no .md, .markdown, or .txt plant files.');
  return { plants, skippedImages };
}

export async function collectPlantFiles(files) {
  const selected = Array.from(files || []);
  if (!selected.length) throw new Error('Choose a ZIP, Markdown, or text file containing plants.');
  const plants = [];
  let skippedImages = 0;
  for (const file of selected) {
    if (isZip(file.name)) {
      const result = await readZip(file);
      plants.push(...result.plants);
      skippedImages += result.skippedImages;
    } else if (isPlantText(file.name)) {
      if (file.size > MAX_PLANT_BYTES) throw new Error(`${file.name} exceeds the 2 MB limit.`);
      plants.push({ name: file.name, contents: readString(new Uint8Array(await file.arrayBuffer())) });
    } else {
      throw new Error(`${file.name} is not a .zip, .md, .markdown, or .txt file.`);
    }
    if (plants.length > MAX_PLANT_FILES) throw new Error('Import at most 500 plants at a time.');
  }
  if (plants.some(entry => !entry.contents.trim())) throw new Error('One of the selected plant files is empty.');
  return { plants, skippedImages };
}
