const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function matrixAttr(matrix) {
  return Array.isArray(matrix) && matrix.length === 6 ? `matrix(${matrix.join(' ')})` : '';
}

export function mountMap({ container, areas, onSelect, onCalibrate }) {
  // 既存のSVGマップのみを削除（オーバーレイHTMLは温存）
  container.querySelectorAll('.map-svg').forEach((oldMap) => oldMap.remove());
  const svg = svgEl('svg', {
    class: 'map-svg', viewBox: '0 0 1200 900', role: 'img',
    'aria-label': '日本の市外局番エリア地図。ドラッグとホイールで移動・拡大できます.'
  });
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const defs = svgEl('defs');
  const shadow = svgEl('filter', { id: 'map-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  shadow.append(svgEl('feDropShadow', { dx: 0, dy: 8, stdDeviation: 9, 'flood-color': '#020617', 'flood-opacity': '.32' }));
  defs.append(shadow);
  svg.append(defs);

  const canvas = svgEl('g', { class: 'map-canvas' });
  const base = svgEl('rect', { x: 0, y: 0, width: 1200, height: 900, rx: 26, class: 'map-ocean' });
  const grid = svgEl('path', { class: 'map-grid', d: 'M80 180 C240 140 390 180 560 160 S900 130 1120 170 M100 520 C280 500 430 540 620 510 S930 470 1130 515 M300 90 C270 250 290 390 270 540 S300 780 360 860 M760 70 C720 250 760 390 735 530 S770 750 820 860' });
  canvas.append(base, grid);

  const groupMap = new Map();
  let pathIndex = 0;
  const colors = ['#7dd3fc', '#67e8f9', '#a5b4fc', '#93c5fd', '#c4b5fd', '#86efac', '#fcd34d', '#f9a8d4', '#fdba74', '#94a3b8'];
  areas.forEach((area, index) => {
    const group = svgEl('g', { class: 'area-group', 'data-code': area.code, tabindex: '0', role: 'button', 'aria-label': `${area.code} ${area.prefecture}` });
    group.style.setProperty('--area-color', colors[index % colors.length]);
    (area.paths || []).forEach((part) => {
      const currentPathIndex = pathIndex++;
      const attrs = {
        class: 'area-shape', d: part.d, fill: 'currentColor',
        'data-source-id': part.id || `path-${currentPathIndex}`,
        'data-path-index': currentPathIndex
      };
      const transform = matrixAttr(part.matrix);
      if (transform) attrs.transform = transform;
      const shape = svgEl('path', attrs);
      group.append(shape);
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(area.code); }
    });
    canvas.append(group);
    groupMap.set(area.code, group);
  });
  svg.append(canvas);
  container.append(svg);

  let zoom = { x: 0, y: 0, scale: 0.86 };
  let drag = null;
  let suppressClick = false;
  const pointers = new Map();
  let pinchStartDistance = null;
  let pinchStartScale = null;
  let pinchCenter = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const applyZoom = (next, animate = false) => {
    zoom = next;
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
    if (animate) canvas.classList.add('map-transforming');
    window.setTimeout(() => canvas.classList.remove('map-transforming'), 180);
  };

  const zoomAt = (clientX, clientY, factor) => {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * 1200;
    const py = ((clientY - rect.top) / rect.height) * 900;
    const nextScale = clamp(zoom.scale * factor, 0.55, 3.5);
    const ratio = nextScale / zoom.scale;
    applyZoom({ scale: nextScale, x: px - (px - zoom.x) * ratio, y: py - (py - zoom.y) * ratio }, true);
  };

  // PCマウスホイールズーム
  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 0.89);
  }, { passive: false });

  // ポインター押下
  svg.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tx: zoom.x,
        ty: zoom.y
      };
    } else if (pointers.size === 2) {
      // 2本指検知：ピンチモードへ移行
      drag = null;
      suppressClick = true;
      const pts = Array.from(pointers.values());
      pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale = zoom.scale;
      
      const rect = svg.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchCenter = {
        px: ((midX - rect.left) / rect.width) * 1200,
        py: ((midY - rect.top) / rect.height) * 900
      };
    }
  });

  // ポインター移動（1本指ドラッグ または 2本指ピンチズーム）
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 2本指ピンチズームの処理
    if (pointers.size === 2 && pinchStartDistance && pinchStartScale && pinchCenter) {
      suppressClick = true;
      const pts = Array.from(pointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = currentDist / pinchStartDistance;
      const nextScale = clamp(pinchStartScale * factor, 0.55, 3.5);
      const ratio = nextScale / zoom.scale;

      applyZoom({
        scale: nextScale,
        x: pinchCenter.px - (pinchCenter.px - zoom.x) * ratio,
        y: pinchCenter.py - (pinchCenter.py - zoom.y) * ratio
      });
      return;
    }

    // 1本指ドラッグ移動の処理
    if (drag && drag.pointerId === event.pointerId && pointers.size === 1) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) {
        suppressClick = true;
      }
      applyZoom({
        ...zoom,
        x: drag.tx + (event.clientX - drag.startX),
        y: drag.ty + (event.clientY - drag.startY)
      });
    }
  });

  // ポインター終了
  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStartDistance = null;
      pinchStartScale = null;
      pinchCenter = null;
    }
    if (drag?.pointerId === event.pointerId) {
      drag = null;
    }
    // 指を離した直後の誤クリック発火を防止
    window.setTimeout(() => {
      if (pointers.size === 0) suppressClick = false;
    }, 50);
  };

  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  const reportCalibration = (group, shape) => {
    if (!onCalibrate || !group || !shape) return;
    const area = areas.find((item) => item.code === group.dataset.code);
    const box = shape.getBBox();
    const ctm = shape.getCTM();
    const localCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const center = ctm ? {
      x: ctm.a * localCenter.x + ctm.c * localCenter.y + ctm.e,
      y: ctm.b * localCenter.x + ctm.d * localCenter.y + ctm.f
    } : localCenter;
    onCalibrate({
      sourceId: shape.dataset.sourceId,
      pathIndex: shape.dataset.pathIndex,
      code: area?.code || group.dataset.code,
      prefecture: area?.prefecture || '',
      region: area?.region || '',
      center: { x: Number(center.x.toFixed(2)), y: Number(center.y.toFixed(2)) }
    });
  };

  svg.addEventListener('click', (event) => {
    if (suppressClick) {
      event.stopPropagation();
      return;
    }
    const group = event.target.closest?.('.area-group');
    const shape = event.target.closest?.('.area-shape');
    if (group?.dataset.code) {
      reportCalibration(group, shape);
      onSelect(group.dataset.code);
    }
  });

  applyZoom(zoom);

  return {
    resetZoom() { applyZoom({ x: 0, y: 0, scale: 0.86 }, true); },
    zoomIn() { zoomAt(container.getBoundingClientRect().left + container.clientWidth / 2, container.getBoundingClientRect().top + container.clientHeight / 2, 1.22); },
    zoomOut() { zoomAt(container.getBoundingClientRect().left + container.clientWidth / 2, container.getBoundingClientRect().top + container.clientHeight / 2, 0.82); },
    highlight({ selected, answer, result }) {
      groupMap.forEach((group, code) => {
        group.classList.toggle('is-selected', code === selected);
        group.classList.toggle('is-answer', code === answer);
        group.classList.toggle('is-correct', result === 'correct' && code === answer);
        group.classList.toggle('is-wrong', result === 'wrong' && code === selected);
      });
    },
    clearHighlight() {
      groupMap.forEach((group) => group.classList.remove('is-selected', 'is-answer', 'is-correct', 'is-wrong'));
    }
  };
}
