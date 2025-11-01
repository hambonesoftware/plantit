// frontend/parsers/plantMarkdown.js
// Parse an "individual plant file" Markdown into a normalized plant object.
// Handles top "Key: Value" fields and timeline entries ("Month DD, YYYY ...").

function toISODate(maybeDate) {
  if (!maybeDate) return null;
  const d = new Date(maybeDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function clean(s) {
  return (s ?? '').toString().trim();
}

function inferActivityType(note) {
  const n = (note || '').toLowerCase();
  if (/(repot|new pot|repotted)/.test(n)) return 'repot';
  if (/(fert|feed|fertil)/.test(n)) return 'fertilize';
  if (/(water|hose|cup|cups|ml|ltr|liter)/.test(n)) return 'water';
  if (/(trim|prune|cut)/.test(n)) return 'trim';
  if (/(shower|rinse)/.test(n)) return 'shower';
  if (/(move|moved|relocat)/.test(n)) return 'move';
  return 'note';
}

function extractAmountAndMethod(note) {
  // Example: "watered 2 cups (hose)" -> amount="2 cups", method="hose"
  const result = { amount: undefined, method: undefined };
  if (!note) return result;

  const methodMatch = note.match(/\(([^)]+)\)/);
  if (methodMatch) {
    result.method = methodMatch[1].trim();
  }

  const amountMatch = note.match(/(\d+(\.\d+)?)\s*(cup|cups|ml|ltr|liter|liters|oz)/i);
  if (amountMatch) {
    result.amount = `${amountMatch[1]} ${amountMatch[3]}`;
  } else {
    const hosey = note.toLowerCase().match(/\b(hose|soak|bottom[-\s]?water|flush)\b/);
    if (hosey) result.amount = hosey[1];
  }

  return result;
}

function parseTopKeys(md) {
  const lines = md.split(/\r?\n/);
  const out = {};
  const keyMap = new Map([
    [/^family$/i, 'family'],
    [/^plant origin$/i, 'plantOrigin'],
    [/^natural habitat$/i, 'naturalHabitat'],
    [/^room$/i, 'room'],
    [/^sunlight$/i, 'sunlight'],
    [/^pot size$/i, 'potSize'],
    [/^purchased on$/i, 'purchasedOn'],
    [/^last watered$/i, 'lastWatered'],
    [/^last repotted$/i, 'lastRepotted'],
    [/^dormancy$/i, 'dormancy'],
    [/^water average$/i, 'waterAverage'],
    [/^amount$/i, 'amount'],
    [/^days since watered$/i, '_daysSinceWatered_ignored'],
  ]);

  for (let i = 0; i < Math.min(60, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9 _-]{0,40}):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    for (const [rx, target] of keyMap.entries()) {
      if (rx.test(key)) {
        out[target] = val;
        break;
      }
    }
  }

  out.purchasedOn = toISODate(out.purchasedOn);
  out.lastWatered = toISODate(out.lastWatered);
  out.lastRepotted = toISODate(out.lastRepotted);
  return out;
}

function parseTimeline(md) {
  const lines = md.split(/\r?\n/);
  const entries = [];
  const dateRe = /^([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s*(.*)$/;

  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.match(dateRe);
    if (!m) continue;
    const dateISO = toISODate(m[1]);
    const note = (m[2] || '').trim();
    const type = inferActivityType(note);
    const { amount, method } = extractAmountAndMethod(note);
    entries.push({ date: dateISO, type, note, ...(amount ? { amount } : {}), ...(method ? { method } : {}) });
  }
  return entries;
}

export function parsePlantMarkdown(md, fallbackName = null) {
  const top = parseTopKeys(md);
  const activityLog = parseTimeline(md);

  const now = new Date();
  const lastWatered = top.lastWatered ? new Date(top.lastWatered) : null;
  const daysSinceWatered = lastWatered
    ? Math.max(0, Math.floor((now - lastWatered) / (24 * 3600 * 1000)))
    : null;

  return {
    family: clean(top.family),
    plantOrigin: clean(top.plantOrigin),
    naturalHabitat: clean(top.naturalHabitat),
    room: clean(top.room),
    sunlight: clean(top.sunlight),
    potSize: clean(top.potSize),
    purchasedOn: top.purchasedOn || null,
    lastWatered: top.lastWatered || null,
    lastRepotted: top.lastRepotted || null,
    dormancy: clean(top.dormancy),
    waterAverage: clean(top.waterAverage),
    amount: clean(top.amount),
    daysSinceWatered,
    activityLog,
    _sourceTitle: fallbackName || null,
  };
}
