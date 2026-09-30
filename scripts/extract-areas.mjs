import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'svgson';
import { svgPathProperties } from 'svg-path-properties';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const sourcePath = path.join(rootDir, 'source-map.svg');
const outputPath = path.join(rootDir, 'public', 'data', 'areaData.json');
const isCheck = process.argv.includes('--check');

const areaMeta = {
  '011': ['北海道', '札幌圏', '札幌市・江別市'], '012': ['北海道', '道央', '岩見沢市・滝川市'], '013': ['北海道', '道南', '函館市・小樽市'],
  '014': ['北海道', '道央南部', '苫小牧市・室蘭市'], '015': ['北海道', '道東', '釧路市・帯広市'], '016': ['北海道', '道北', '旭川市・稚内市'],
  '017': ['東北', '青森・秋田北部', '青森市・鹿角市'], '018': ['東北', '秋田', '秋田市・横手市'], '019': ['東北', '岩手', '盛岡市・一関市'],
  '022': ['東北', '宮城', '仙台市・石巻市'], '023': ['東北', '山形', '山形市・酒田市'], '024': ['東北', '福島・宮城南部', '福島市・郡山市'],
  '025': ['甲信越', '新潟', '新潟市・長岡市'], '026': ['甲信越', '長野', '長野市・松本市'], '027': ['北関東', '群馬', '前橋市・高崎市'],
  '028': ['北関東', '栃木', '宇都宮市・小山市'], '029': ['北関東', '茨城北部', '水戸市・土浦市'],
  '03': ['関東', '東京', '東京都23区・狛江市'], '042': ['関東', '多摩・相模原', '八王子市・相模原市'], '043': ['関東', '千葉北西部', '千葉市・佐倉市'],
  '044': ['関東', '川崎', '川崎市'], '045': ['関東', '横浜', '横浜市'], '046': ['関東', '神奈川西部', '厚木市・小田原市'],
  '047': ['関東', '千葉西部', '船橋市・市川市'], '048': ['関東', '埼玉南東部', 'さいたま市・川口市'], '049': ['関東', '埼玉西部', '川越市・飯能市'],
  '052': ['東海', '名古屋', '名古屋市・春日井市'], '053': ['東海', '静岡西部', '浜松市・湖西市'], '054': ['東海', '静岡中部', '静岡市・焼津市'],
  '055': ['東海', '静岡東部・山梨東部', '沼津市・富士市'], '056': ['東海', '愛知東部', '豊橋市・岡崎市'], '057': ['東海', '岐阜', '岐阜市・高山市'],
  '058': ['東海', '岐阜南部', '岐阜市・大垣市'], '059': ['東海', '三重', '津市・四日市市'],
  '06': ['近畿', '大阪', '大阪市・尼崎市'], '072': ['近畿', '大阪南東部', '堺市・東大阪市'], '073': ['近畿', '和歌山', '和歌山市・田辺市'],
  '074': ['近畿', '奈良', '奈良市・橿原市'], '075': ['近畿', '京都', '京都市・大津市'], '076': ['北陸', '富山・石川', '富山市・金沢市'],
  '077': ['近畿', '滋賀', '大津市・彦根市'], '078': ['近畿', '神戸', '神戸市・明石市'], '079': ['近畿', '兵庫西部', '姫路市・加古川市'],
  '082': ['中国', '広島', '広島市・呉市'], '083': ['中国', '山口', '山口市・下関市'], '084': ['中国', '福山・備後', '福山市・尾道市'],
  '085': ['中国', '鳥取・島根東部', '鳥取市・米子市'], '086': ['中国', '岡山', '岡山市・倉敷市'],
  '087': ['四国', '香川', '高松市・丸亀市'], '088': ['四国', '徳島・高知東部', '徳島市・高知市'], '089': ['四国', '愛媛', '松山市・今治市'],
  '092': ['九州', '福岡', '福岡市・糸島市'], '093': ['九州', '北九州', '北九州市・行橋市'], '094': ['九州', '筑豊・久留米', '久留米市・飯塚市'],
  '095': ['九州', '長崎', '長崎市・佐世保市'], '096': ['九州', '熊本', '熊本市・八代市'], '097': ['九州', '大分', '大分市・別府市'],
  '098': ['九州・沖縄', '沖縄', '那覇市・沖縄市'], '099': ['九州', '鹿児島', '鹿児島市・霧島市']
};

// Human-audited source-path overrides. Keys are the original SVG path IDs and
// values are the intended three-digit area codes. Keep this table explicit so
// visual calibration can correct a single path without changing area metadata
// or relying on the nearest-label heuristic.
const manualOverrides = {
  'path7070-5': '019', 'path6946-7': '017', 'path7076-8': '018',
  'path7082-1': '025', 'path6880-9': '025', 'path7120-7': '026',
  'path7104-2': '027', 'path7092-9': '028', 'path7098-8': '029',
  'path4900': '044', 'path7117-1': '046', 'path7111-5': '049',
  'path7128-2': '058', 'path3507': '075', 'path7139-2': '077',
  'path6924-0': '087', 'path6896-6': '078', 'path3499': '078',
  'path7171-9': '085', 'path6886-1': '087', 'path6884-6': '087', 'path6882-5': '087'
};

const svg = parseSync(fs.readFileSync(sourcePath, 'utf8'));
const svgNS = 'http://www.w3.org/2000/svg';
const inkNS = 'inkscape:label';
const identity = [1, 0, 0, 1, 0, 0];

function mul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}
function transformMatrix(value = '') {
  let out = identity;
  const re = /(translate|scale|matrix)\s*\(([^)]+)\)/g;
  let match;
  while ((match = re.exec(value))) {
    const nums = match[2].split(/[ ,]+/).filter(Boolean).map(Number);
    let next = identity;
    if (match[1] === 'translate') next = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
    if (match[1] === 'scale') next = [nums[0] ?? 1, 0, 0, nums[1] ?? nums[0] ?? 1, 0, 0];
    if (match[1] === 'matrix') next = nums.slice(0, 6);
    out = mul(out, next);
  }
  return out;
}
function apply(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
function styleValue(style, attr, fallback = '') {
  const matches = [...String(style || '').matchAll(new RegExp(`${attr}\\s*:\\s*([^;]+)`, 'g'))];
  return matches.length ? matches.at(-1)[1].trim() : fallback;
}
function textContent(node) {
  return (node.children || []).map(child => child.type === 'text' ? child.value : textContent(child)).join('').trim();
}
function* walk(node, parentMatrix = identity, inheritedStyle = '') {
  const ownMatrix = mul(parentMatrix, transformMatrix(node.attributes?.transform));
  const ownStyle = [inheritedStyle, node.attributes?.style || ''].filter(Boolean).join(';');
  yield* [{ node, matrix: ownMatrix, style: ownStyle }];
  for (const child of node.children || []) yield* walk(child, ownMatrix, ownStyle);
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    const intersects = ((yi > point[1]) !== (yj > point[1])) && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
function flattenPath(d, matrix) {
  try {
    const props = new svgPathProperties(d);
    const length = props.getTotalLength();
    if (!Number.isFinite(length) || length < 1) return [];
    const samples = Math.max(48, Math.min(1800, Math.ceil(length / 3)));
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const point = props.getPointAtLength((length * i) / samples);
      points.push(apply(matrix, [point.x, point.y]));
    }
    return points;
  } catch { return []; }
}
function bbox(points) {
  return points.reduce((b, [x, y]) => ({ minX: Math.min(b.minX, x), minY: Math.min(b.minY, y), maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}
function contains(points, p) {
  const b = bbox(points);
  if (!(p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minY && p[1] <= b.maxY)) return false;
  return pointInPolygon(p, points);
}

const labels = [];
for (const item of walk(svg)) {
  if (item.node.name !== 'text') continue;
  const code = textContent(item.node).replace(/\s+/g, '');
  if (!/^0\d{1,4}$/.test(code)) continue;
  const x = Number(item.node.attributes?.x); const y = Number(item.node.attributes?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
  const labelMatrix = item.matrix;
  labels.push({ code: code.length > 3 ? code.slice(0, 3) : code, sourceCode: code, point: apply(labelMatrix, [x, y]), x, y });
}
const uniqueLabels = [...new Map(labels.map(x => [x.code, x])).values()];
const kuiki = [...walk(svg)].find(item => item.node.name === 'g' && item.node.attributes?.[inkNS] === 'kuiki');
if (!kuiki) throw new Error('kuiki layer not found');

const shapes = [];
for (const [unitIndex, child] of kuiki.node.children.entries()) {
  const unitId = child.attributes?.id || `unit-${unitIndex + 1}`;
  for (const item of walk(child, kuiki.matrix, kuiki.style)) {
  if (item.node.name !== 'path' || !item.node.attributes?.d) continue;
  const fill = item.node.attributes.fill || styleValue(item.style, 'fill');
  if (!fill || fill === 'none') continue;
  const points = flattenPath(item.node.attributes.d, item.matrix);
  if (points.length < 10) continue;
  shapes.push({ id: item.node.attributes.id || `path-${shapes.length + 1}`, unitId, d: item.node.attributes.d, transform: item.node.attributes.transform || '', matrix: item.matrix, fill, points });
  }
}

function distanceToShape(shape, point) {
  return shape.points.reduce((best, candidate) => Math.min(best, Math.hypot(candidate[0] - point[0], candidate[1] - point[1])), Infinity);
}
const units = [...new Map(shapes.map(shape => [shape.unitId, []])).entries()].map(([unitId]) => ({
  unitId,
  shapes: shapes.filter(shape => shape.unitId === unitId)
}));
const rankedLabels = uniqueLabels.map(label => ({
  label,
  ranked: units.map(unit => ({
    unit,
    // Point-in-polygon is retained as a source-geometry signal; labels in the
    // original artwork are often placed just outside narrow regions.
    inside: unit.shapes.some(shape => contains(shape.points, label.point)),
    distance: Math.min(...unit.shapes.map(shape => distanceToShape(shape, label.point)))
  })).sort((a, b) => (a.distance - b.distance) || (Number(b.inside) - Number(a.inside)))
})).sort((a, b) => a.ranked[0].distance - b.ranked[0].distance);
const matched = new Map();
const unmatched = [];
const usedUnits = new Set();
const associationDistances = [];
for (const entry of rankedLabels) {
  const chosen = entry.ranked.find(candidate => !usedUnits.has(candidate.unit.unitId));
  if (!chosen || !Number.isFinite(chosen.distance) || chosen.distance > 180) {
    unmatched.push({ ...entry.label, reason: chosen ? `label-to-path distance ${chosen.distance.toFixed(1)} exceeds 180` : 'no unused source unit' });
    continue;
  }
  usedUnits.add(chosen.unit.unitId);
  associationDistances.push({ code: entry.label.code, unitId: chosen.unit.unitId, distance: Number(chosen.distance.toFixed(2)), inside: chosen.inside });
  matched.set(entry.label.code, chosen.unit.shapes);
}

// Several metropolitan labels are outside the dense map and use leader lines.
// The nearest-coordinate heuristic can therefore select an adjacent area.
// These source-verified anchors keep the metropolitan polygons exact:
// path4896 = Tokyo 03, path3503 = Osaka 06, path7135-1 = Aichi east 056,
// path7108-4 = 042, path7111-5-8 = 048, and path7098-8 = 029.
const tokyoPath = shapes.find(shape => shape.id === 'path4896');
const osakaPath = shapes.find(shape => shape.id === 'path3503');
const aichiEastPath = shapes.find(shape => shape.id === 'path7135-1');
const area042Path = shapes.find(shape => shape.id === 'path7108-4');
const area048Path = shapes.find(shape => shape.id === 'path7111-5-8');
const area029Path = shapes.find(shape => shape.id === 'path7098-8');
const oldTokyoParts = matched.get('03') || [];
const oldOsakaParts = matched.get('06') || [];
const old042Parts = matched.get('042') || [];
const old048Parts = matched.get('048') || [];
const old056Parts = matched.get('056') || [];
const old099Parts = matched.get('099') || [];
const kantoOverrideErrors = [];
if (!tokyoPath || !osakaPath || !aichiEastPath || !area042Path || !area048Path || !area029Path || !matched.has('049') || !matched.has('056') || !matched.has('079')) {
  kantoOverrideErrors.push('Tokyo/Osaka source anchor or destination area is missing');
} else {
  const tokyoUnit = units.find(unit => unit.unitId === tokyoPath.unitId);
  const osakaUnit = units.find(unit => unit.unitId === osakaPath.unitId);
  const aichiEastUnit = units.find(unit => unit.unitId === aichiEastPath.unitId);
  const area042Unit = units.find(unit => unit.unitId === area042Path.unitId);
  const area048Unit = units.find(unit => unit.unitId === area048Path.unitId);
  const area029Unit = units.find(unit => unit.unitId === area029Path.unitId);
  matched.set('03', tokyoUnit?.shapes || [tokyoPath]);
  matched.set('049', [...matched.get('049'), ...oldTokyoParts]);
  matched.set('06', osakaUnit?.shapes || [osakaPath]);
  matched.set('056', aichiEastUnit?.shapes || [aichiEastPath]);
  matched.set('042', area042Unit?.shapes || [area042Path]);
  matched.set('048', area048Unit?.shapes || [area048Path]);
  matched.set('029', [...matched.get('029'), ...(area029Unit?.shapes || [area029Path])]);
  matched.set('079', [...matched.get('079'), ...oldOsakaParts]);
  matched.set('098', [...matched.get('098'), ...old099Parts.filter(part => part.id !== 'path7201-0')]);
  matched.set('099', old099Parts.filter(part => part.id === 'path7201-0'));
  usedUnits.clear();
  for (const parts of matched.values()) for (const part of parts) usedUnits.add(part.unitId);
}

// Source-verified Hokkaido correction: the Wikimedia inset places 011
// (札幌) on the green western polygon and 012 (道央) on the blue central
// polygon. The label callout ordering is ambiguous, so the nearest-label
// heuristic reverses these two units unless they are explicitly exchanged.
const hokkaido011Parts = matched.get('011') || [];
const hokkaido012Parts = matched.get('012') || [];
if (hokkaido011Parts.length && hokkaido012Parts.length) {
  matched.set('011', hokkaido012Parts);
  matched.set('012', hokkaido011Parts);
}

// Path-level endpoint audit: several narrow callout areas share a source unit
// with a neighboring label, so moving the whole unit would be incorrect. The
// assignments below follow the Wikimedia leader-line endpoints and preserve
// each individual source path as the clickable geometry.
function movePath(pathId, targetCode) {
  let found = null;
  for (const [code, parts] of matched.entries()) {
    const index = parts.findIndex(part => part.id === pathId);
    if (index >= 0) {
      found = parts.splice(index, 1)[0];
      break;
    }
  }
  if (found) matched.set(targetCode, [...(matched.get(targetCode) || []), found]);
}

// 072 is the Osaka-south unit; the baseline label heuristic had placed its
// detached Okinawa/island shapes here. The source map groups those shapes in
// the 098 block, while the mainland callout lands on path7164-1.
const detached072 = [...(matched.get('072') || [])];
matched.set('072', []);
for (const part of detached072) matched.set('098', [...(matched.get('098') || []), part]);
movePath('path7164-1', '072');

// Confirmed path-only ownership corrections from the map audit. Area metadata
// (code, region, prefecture and representative city) is intentionally kept
// unchanged; only the SVG path membership is rotated.
function rotateCodes(codes) {
  const old = new Map(codes.map(code => [code, [...(matched.get(code) || [])]]));
  for (let i = 0; i < codes.length; i++) {
    matched.set(codes[i], old.get(codes[(i + 1) % codes.length]) || []);
  }
}

// Hokkaido northeastern blocks: the source shapes were assigned one label
// forward (017→019, 018→017, 019→018 when read from the map).
rotateCodes(['017', '018', '019']);

// Kanto blocks: 028 was absorbed into 029 by the previous unit-level match.
// Keep the true 029 path in 029 and move only the 028 path back out.
const old025 = [...(matched.get('025') || [])];
const old029 = [...(matched.get('029') || [])];
matched.set('049', [...(matched.get('049') || []), ...old025]);
matched.set('025', [...(matched.get('026') || [])]);
matched.set('026', [...(matched.get('027') || [])]);
matched.set('027', [...(matched.get('028') || [])]);
matched.set('028', old029.filter(part => part.id === 'path7098-8'));
matched.set('029', old029.filter(part => part.id !== 'path7098-8'));

// Remaining source-map ordering corrections.
rotateCodes(['044', '046']);
rotateCodes(['058', '077', '075']);
rotateCodes(['078', '085', '087']);

function applyManualOverrides(overrides) {
  for (const [pathId, targetCode] of Object.entries(overrides)) {
    movePath(pathId, targetCode);
  }
}
applyManualOverrides(manualOverrides);


const areas = [...matched.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([code, parts]) => {
  const meta = areaMeta[code] || ['国内', '未分類', ''];
  return {
    id: `area-${code}`,
    code,
    region: meta[0],
    prefecture: meta[1],
    representative: meta[2],
    label: labels.find(x => x.code === code)?.point || null,
    paths: [...new Map(parts.map(part => [part.id, { id: part.id, d: part.d, transform: part.transform, matrix: part.matrix, fill: part.fill }])).values()]
  };
});

const allCodes = uniqueLabels.map(x => x.code).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const duplicateCodes = allCodes.filter((code, index) => index && code === allCodes[index - 1]);
const missingCodes = allCodes.filter(code => !matched.has(code));
const invalidPaths = areas.filter(area => !area.paths.length).map(area => area.code);
const report = {
  source: 'Wikimedia Commons / File:Japan telephone code areas.svg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Japan_telephone_code_areas.svg',
  license: 'CC0 1.0',
  viewBox: svg.attributes?.viewBox || '0 0 1200 900',
  generatedAt: 'source-derived',
  areaCount: areas.length,
  labelCount: uniqueLabels.length,
  shapeCount: shapes.length,
  unmatchedLabels: unmatched.map(x => ({ code: x.code, sourceCode: x.sourceCode, point: x.point, reason: x.reason })),
  duplicateCodes,
  missingCodes,
  invalidPaths,
  associationDistances,
  assignedUnitCount: usedUnits.size,
  kantoOverrideErrors,
  areas
};

const emittedPathIds = areas.flatMap(area => area.paths.map(part => part.id));
const duplicateEmittedPathIds = emittedPathIds.filter((id, index) => emittedPathIds.indexOf(id) !== index);
const missingMatrices = areas.flatMap(area => area.paths.filter(part => !Array.isArray(part.matrix) || part.matrix.length !== 6).map(part => `${area.code}:${part.id}`));
const unitOwners = new Map();
for (const [code, parts] of matched) for (const part of parts) {
  if (!unitOwners.has(part.unitId)) unitOwners.set(part.unitId, new Set());
  unitOwners.get(part.unitId).add(code);
}
// g4611 is the source's southern-Kyushu group. The SVG places its Kagoshima
// and Miyazaki geometry in separate output paths; 098/099 must split those
// paths while retaining the original source geometry. The same exception is
// granted only to source units touched by an explicit manual override, so an
// accidental automatic duplicate still fails validation.
const manualOverridePathIds = new Set(Object.keys(manualOverrides));
const manualSplitUnitIds = new Set(shapes.filter(shape => manualOverridePathIds.has(shape.id)).map(shape => shape.unitId));
const allowedSharedUnitIds = new Set(['g4611', ...manualSplitUnitIds]);
const duplicateUnitAssignments = [...unitOwners.entries()].filter(([unitId, owners]) => owners.size > 1 && !allowedSharedUnitIds.has(unitId)).map(([unitId, owners]) => ({ unitId, owners: [...owners] }));
if (unmatched.length || duplicateCodes.length || missingCodes.length || invalidPaths.length || kantoOverrideErrors.length || areas.length === 0 || usedUnits.size < areas.length || duplicateUnitAssignments.length || duplicateEmittedPathIds.length || missingMatrices.length) {
  console.error(JSON.stringify({ areaCount: areas.length, labelCount: uniqueLabels.length, unmatched: report.unmatchedLabels, duplicateCodes, missingCodes, invalidPaths, assignedUnitCount: usedUnits.size, duplicateUnitAssignments, duplicateEmittedPathIds, missingMatrices }, null, 2));
  if (isCheck) process.exit(1);
}
if (!isCheck) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Generated ${outputPath}: ${areas.length} areas, ${shapes.length} filled source paths, ${unmatched.length} unmatched labels.`);
} else {
  const data = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : null;
  if (!data || data.areaCount !== areas.length || data.areas.length !== areas.length || data.assignedUnitCount !== usedUnits.size || data.areas.some(area => area.paths.some(part => !Array.isArray(part.matrix) || part.matrix.length !== 6))) throw new Error('areaData.json is stale or inconsistent with the source SVG');
  console.log(`Validated dynamic area data: ${areas.length} areas, ${shapes.length} filled source paths, all labels matched.`);
}
