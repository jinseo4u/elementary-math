// 문제와 예제의 visual 데이터를 그림으로 그린다. 브라우저와 Node 테스트에서 함께 쓴다.
(function (exports) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // 12시 방향에서 시계 방향으로 잰 각도. 짧은바늘은 1분에 0.5도씩 움직인다.
  function clockAngles(hour, minute) {
    return { hour: (hour % 12) * 30 + minute * 0.5, minute: minute * 6 };
  }

  function drawClock({ hour, minute }, doc) {
    const svg = (tag, attrs, ...children) => {
      const node = doc.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      node.append(...children);
      return node;
    };
    const angles = clockAngles(hour, minute);
    // 바늘은 12시 방향으로 그린 뒤 가운데를 중심으로 돌린다.
    const hand = (name, length) => svg('line', {
      class: `hand ${name}-hand`, x1: 0, y1: 0, x2: 0, y2: -length, transform: `rotate(${angles[name]})`,
    });

    const ticks = Array.from({ length: 60 }, (_, i) => svg('line', {
      class: i % 5 === 0 ? 'tick major' : 'tick',
      x1: 0, y1: i % 5 === 0 ? -86 : -91, x2: 0, y2: -96, transform: `rotate(${i * 6})`,
    }));
    const numbers = Array.from({ length: 12 }, (_, i) => {
      const radian = ((i + 1) * Math.PI) / 6;
      return svg('text', {
        class: 'number', x: (73 * Math.sin(radian)).toFixed(2), y: (-73 * Math.cos(radian)).toFixed(2),
        'text-anchor': 'middle', dy: '0.35em',
      }, String(i + 1));
    });

    // 설명에 시각을 넣으면 정답이 드러나므로 "시계 그림"이라고만 함
    return svg('svg', { class: 'clock', viewBox: '-102 -102 204 204', role: 'img', 'aria-label': '시계 그림' },
      svg('circle', { class: 'face', r: 99 }),
      ...ticks, ...numbers,
      hand('hour', 46), hand('minute', 86),
      svg('circle', { class: 'pin', r: 5 }));
  }

  function maker(doc) {
    return (tag, props = {}, ...children) => {
      const node = Object.assign(doc.createElement(tag), props);
      node.append(...children);
      return node;
    };
  }

  function drawTable({ title, headers, rows }, doc) {
    const el = maker(doc);
    const heading = (text, scope) => el('th', { scope }, String(text));
    return el('table', { className: 'data-table' },
      el('caption', {}, title),
      el('thead', {}, el('tr', {}, ...headers.map((text) => heading(text, 'col')))),
      el('tbody', {}, ...rows.map(([first, ...rest]) => el('tr', {},
        heading(first, 'row'), ...rest.map((value) => el('td', {}, String(value)))))));
  }

  // 맨 아래 줄이 1이 되도록 위에서부터 큰 수의 줄을 만든다. 항목 이름은 맨 아래에 둔다.
  function drawGraph({ title, categories, values, mark }, doc) {
    const el = maker(doc);
    const height = Math.max(...values);
    const levels = Array.from({ length: height }, (_, i) => height - i);
    return el('table', { className: 'data-table graph' },
      el('caption', {}, title),
      el('tbody', {}, ...levels.map((level) => el('tr', {},
        el('th', { scope: 'row' }, String(level)),
        ...values.map((value) => el('td', {}, value >= level ? mark : ''))))),
      el('tfoot', {}, el('tr', {}, el('td'),
        ...categories.map((name) => el('th', { scope: 'col' }, name)))));
  }

  const DRAWERS = { clock: drawClock, table: drawTable, graph: drawGraph };

  function renderVisual(visual, doc = document) {
    const wrapper = maker(doc)('div', { className: 'visual' });
    const draw = DRAWERS[visual.type];
    // 모르는 그림이 있어도 문제는 보이게 함
    if (draw) wrapper.append(draw(visual, doc));
    return wrapper;
  }

  exports.clockAngles = clockAngles;
  exports.renderVisual = renderVisual;
  exports.types = Object.keys(DRAWERS);
})(typeof module === 'object' ? module.exports : (window.Visuals = {}));
