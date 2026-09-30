import { mountMap } from './map.js';

const $ = (selector, root = document) => root.querySelector(selector);
const APP_KEY = 'denbanquiz-session-v1';
const THEME_KEY = 'denbanquiz-theme';
const initialStats = { correct: 0, answered: 0, streak: 0, bestStreak: 0 };

const savedStats = (() => { try { return { ...initialStats, ...JSON.parse(localStorage.getItem(APP_KEY) || '{}') }; } catch { return { ...initialStats }; } })();
const state = {
  areas: [], current: null, feedback: null, calibration: null, hintLevel: 0, isBusy: false, mode: 'quiz', studySelection: null, stats: savedStats,
  theme: localStorage.getItem(THEME_KEY) || 'dark', map: null
};

document.documentElement.dataset.theme = state.theme;

function saveStats() { localStorage.setItem(APP_KEY, JSON.stringify(state.stats)); }
function pickQuestion() {
  if (!state.areas.length) return null;
  const choices = state.areas.filter(area => area.code !== state.current?.code);
  return choices[Math.floor(Math.random() * choices.length)] || state.areas[0];
}
function accuracy() { return state.stats.answered ? Math.round((state.stats.correct / state.stats.answered) * 100) : 0; }
function questionText() { return state.mode === 'study' ? '地図帳モード' : `${state.current?.code || '---'} はどこ？`; }

function shell() {
  $('#app').innerHTML = `
    <main class="app-shell">
      <div class="workspace">
        <aside class="control-column">
          <header class="topbar">
            <div class="brand"><div class="brand-mark" aria-hidden="true">◎</div><div class="brand-copy"><div class="brand-name">日本市外局番クイズ</div><div class="brand-kicker">SIGNAL ATLAS / MAP MEMORY LAB</div></div></div>
            <div class="top-actions"><button class="icon-button" id="theme-toggle" aria-label="テーマを切り替える">☼</button><button class="soft-button" id="reset-stats">統計をリセット</button></div>
          </header>
          <div class="mode-row mode-row-top"><span class="micro-label">PLAY MODE</span><div class="mode-switch"><button id="mode-quiz" class="active">クイズモード</button><button id="mode-study">学習モード</button></div></div>
          <article class="question-card" aria-label="出題情報">
            <div class="question-head"><span class="eyebrow">CURRENT CHALLENGE</span></div>
            <div><h1 class="question-title" id="question-title"></h1><p class="question-subtitle" id="question-subtitle">地図上の正しい電話番号区域をクリックしてください。</p><p class="feedback" id="feedback" aria-live="polite"></p></div>
            <div class="study-detail-card" id="study-detail-card">
              <div class="micro-label">SELECTED AREA</div><div class="study-placeholder" id="study-placeholder">地図上のエリアをクリックすると、市外局番と地域名が表示されます</div>
              <div class="study-detail-content" id="study-detail-content"></div>
            </div>
          </article>
          <aside class="side-card quiz-tools" data-quiz-only aria-label="段階ヒント">
            <h2>段階ヒント</h2>
            <div class="hint-box"><div class="micro-label">REGION BLOCK</div><div class="hint-value" id="hint-region">未使用</div></div>
            <div class="hint-box"><div class="micro-label">REPRESENTATIVE AREA</div><div class="hint-value" id="hint-city">未使用</div></div>
            <div class="hint-actions"><button class="soft-button" id="hint-1">地方を表示</button><button class="soft-button" id="hint-2">都市を表示</button></div>
          </aside>
          <section class="stat-strip" aria-label="プレイ統計">
            <div class="stat"><span class="stat-label">SCORE</span><span class="stat-value green" id="stat-score">0 / 0</span></div>
            <div class="stat"><span class="stat-label">STREAK</span><span class="stat-value" id="stat-streak">0</span></div>
            <div class="stat"><span class="stat-label">BEST</span><span class="stat-value" id="stat-best">0</span></div>
            <div class="stat"><span class="stat-label">ACCURACY</span><span class="stat-value" id="stat-accuracy">0%</span></div>
            <div class="stat"><span class="stat-label">POOL</span><span class="stat-value" id="stat-pool">—</span></div>
          </section>
          <div class="sidebar-map-help"><kbd>DRAG</kbd> 移動 <kbd>WHEEL</kbd> ズーム</div>
          <p class="footer-note">SOURCE / SVG · Wikimedia Commons / CC0<br />問題プールは元データの区画数から動的に生成</p>
        </aside>
        <section class="map-card" aria-label="市外局番地図">
          <div class="map-toolbar"><div class="map-toolbar-copy"><span class="source-label">MAP</span><span class="map-toolbar-title">日本の電話番号区域</span><span class="map-source">Wikimedia Commons / CC0</span></div><div class="map-controls"><button id="zoom-out" aria-label="縮小">−</button><button id="zoom-reset" aria-label="表示をリセット">◎</button><button id="zoom-in" aria-label="拡大">＋</button></div></div>
          <div class="map-viewport" id="map-viewport"><div class="map-help"><kbd>DRAG</kbd> 移動 <kbd>WHEEL</kbd> ズーム</div><div class="study-panel" id="study-panel"></div><aside class="calibration-panel" id="calibration-panel" aria-live="polite"></aside></div>
        </section>
      </div>
    </main>`;
}

function render() {
  $('#question-title').innerHTML = state.mode === 'study' ? '<span class="code-highlight">探索・学習</span>モード' : `<span class="code-highlight">${state.current?.code || '---'}</span> はどこ？`;
  $('#question-subtitle').textContent = state.mode === 'study' ? '地図上の区画をクリックして、市外局番と地域情報を確認できます。' : '地図上の正しい電話番号区域をクリックしてください。';
  const feedback = $('#feedback');
  feedback.textContent = state.feedback?.message || '';
  feedback.className = `feedback ${state.feedback?.result || ''}`;
  $('#hint-region').textContent = state.hintLevel >= 1 && state.current ? state.current.region : '未使用';
  $('#hint-city').textContent = state.hintLevel >= 2 && state.current ? `${state.current.prefecture} / ${state.current.representative}` : '未使用';
  $('#hint-1').disabled = state.mode === 'study' || state.hintLevel >= 1 || state.isBusy;
  $('#hint-2').disabled = state.mode === 'study' || state.hintLevel >= 2 || state.isBusy;
  $('#stat-score').textContent = `${state.stats.correct} / ${state.stats.answered}`;
  $('#stat-streak').textContent = state.stats.streak;
  $('#stat-best').textContent = state.stats.bestStreak;
  $('#stat-accuracy').textContent = `${accuracy()}%`;
  $('#stat-pool').textContent = `${state.areas.length} 区画`;
  $('#mode-quiz').classList.toggle('active', state.mode === 'quiz');
  $('#mode-study').classList.toggle('active', state.mode === 'study');
  document.querySelectorAll('[data-quiz-only]').forEach((element) => element.hidden = state.mode !== 'quiz');
  $('#study-detail-card').hidden = state.mode !== 'study';
  const detail = state.studySelection;
  $('#study-placeholder').hidden = Boolean(detail);
  $('#study-detail-content').innerHTML = detail ? `<div class="study-code">${detail.code}</div><div class="study-meta"><strong>${detail.prefecture} / ${detail.representative}</strong><br /><span>${detail.region}ブロック</span></div>` : '';
  document.documentElement.dataset.theme = state.theme;
  $('#theme-toggle').textContent = state.theme === 'dark' ? '☼' : '☾';
  $('#theme-toggle').setAttribute('aria-label', state.theme === 'dark' ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える');
  const calibration = state.calibration;
  $('#calibration-panel').innerHTML = calibration ? `<div class="calibration-title">CALIBRATION / PATH DEBUG</div><div class="calibration-code">${calibration.code}</div><div class="calibration-row"><span>地域名</span><strong>${calibration.prefecture}</strong></div><div class="calibration-row"><span>元のSVG ID</span><code>${calibration.sourceId}</code></div><div class="calibration-row"><span>DOM path index</span><code>path-index: ${calibration.pathIndex}</code></div><div class="calibration-row"><span>bbox center</span><code>(${calibration.center.x}, ${calibration.center.y})</code></div>` : '<div class="calibration-title">CALIBRATION / PATH DEBUG</div><div class="calibration-empty">ポリゴンをクリックすると、SVGパスの対応情報を表示します。</div>';
}

function selectArea(code) {
  const area = state.areas.find(item => item.code === code);
  if (!area) return;
  if (state.mode === 'study') {
    state.studySelection = area;
    const panel = $('#study-panel');
    panel.classList.add('visible');
    panel.innerHTML = `<div class="micro-label">AREA DETAIL</div><div class="study-code">${area.code}</div><div class="study-meta"><strong>${area.prefecture}</strong><br />${area.representative}<br /><span>${area.region}</span></div>`;
    state.map.highlight({ selected: code, answer: code, result: 'correct' });
    render();
    return;
  }
  if (state.isBusy || !state.current) return;
  const correct = code === state.current.code;
  state.isBusy = true;
  state.stats.answered += 1;
  if (correct) { state.stats.correct += 1; state.stats.streak += 1; state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak); }
  else state.stats.streak = 0;
  state.feedback = { result: correct ? 'correct' : 'wrong', message: correct ? `正解！ ${state.current.prefecture}` : `惜しい。正解は ${state.current.code}（${state.current.prefecture}）` };
  state.map.highlight({ selected: code, answer: state.current.code, result: correct ? 'correct' : 'wrong' });
  saveStats(); render();
  window.setTimeout(() => { state.current = pickQuestion(); state.hintLevel = 0; state.feedback = null; state.isBusy = false; state.map.clearHighlight(); render(); }, 1500);
}

function bind() {
  $('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, state.theme); render(); });
  $('#reset-stats').addEventListener('click', () => { state.stats = { ...initialStats }; saveStats(); render(); });
  $('#hint-1').addEventListener('click', () => { state.hintLevel = Math.max(state.hintLevel, 1); render(); });
  $('#hint-2').addEventListener('click', () => { state.hintLevel = Math.max(state.hintLevel, 2); render(); });
  $('#mode-quiz').addEventListener('click', () => { state.mode = 'quiz'; state.studySelection = null; state.map.clearHighlight(); $('#study-panel').classList.remove('visible'); state.current = pickQuestion(); state.hintLevel = 0; render(); });
  $('#mode-study').addEventListener('click', () => { state.mode = 'study'; state.studySelection = null; state.isBusy = false; state.feedback = null; state.map.clearHighlight(); render(); });
  $('#zoom-in').addEventListener('click', () => state.map.zoomIn());
  $('#zoom-out').addEventListener('click', () => state.map.zoomOut());
  $('#zoom-reset').addEventListener('click', () => state.map.resetZoom());
}

async function init() {
  try {
    const response = await fetch('./data/areaData.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`areaData.json: HTTP ${response.status}`);
    const data = await response.json();
    const codes = new Set();
    if (!Array.isArray(data.areas) || data.areas.length === 0) throw new Error('区画データが空です。');
    data.areas.forEach(area => { if (!area.code || codes.has(area.code) || !area.paths?.length) throw new Error(`区画データの紐付けが不正です: ${area.code || 'unknown'}`); codes.add(area.code); });
    state.areas = data.areas;
    shell();
    state.current = pickQuestion();
    state.map = mountMap({ container: $('#map-viewport'), areas: state.areas, onSelect: selectArea, onCalibrate: (detail) => { state.calibration = detail; render(); } });
    bind(); render();
  } catch (error) {
    $('#app').innerHTML = `<main class="app-shell"><div class="error-card"><strong>地図データを読み込めませんでした。</strong><br /><span>${error.message}</span><br /><small>areaData.jsonの抽出結果とサーバーの起動状態を確認してください。</small></div></main>`;
  }
}
init();
