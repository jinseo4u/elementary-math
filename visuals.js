// 문제와 예제의 visual 데이터를 그림으로 그린다. 브라우저와 Node 테스트에서 함께 쓴다.
(function (exports) {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // 12시 방향에서 시계 방향으로 잰 각도. 짧은바늘은 1분에 0.5도씩 움직인다.
  function clockAngles(hour, minute) {
    return { hour: (hour % 12) * 30 + minute * 0.5, minute: minute * 6 };
  }

  function svgMaker(doc) {
    return (tag, attrs, ...children) => {
      const node = doc.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
      node.append(...children);
      return node;
    };
  }

  function drawClock({ hour, minute }, doc) {
    const svg = svgMaker(doc);
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

  // 꼭짓점 좌표. 오각형과 육각형은 정다각형
  const SHAPES = {
    triangle: [[0, -70], [78, 62], [-78, 62]],
    square: [[-65, -65], [65, -65], [65, 65], [-65, 65]],
    rectangle: [[-90, -52], [90, -52], [90, 52], [-90, 52]],
    pentagon: regularPolygon(5, -90),
    hexagon: regularPolygon(6, 0),
  };

  // start: 첫 꼭짓점의 각도(도). 0은 오른쪽, -90은 위쪽
  function regularPolygon(sides, start) {
    return Array.from({ length: sides }, (_, i) => {
      const radian = ((start + (360 / sides) * i) * Math.PI) / 180;
      return [Number((75 * Math.cos(radian)).toFixed(2)), Number((75 * Math.sin(radian)).toFixed(2))];
    });
  }

  function drawShape({ shape }, doc) {
    if (!SHAPES[shape]) return undefined;
    const svg = svgMaker(doc);
    // 설명에 도형 이름을 넣으면 정답이 드러남
    return svg('svg', { class: 'shape', viewBox: '-100 -85 200 170', role: 'img', 'aria-label': '도형 그림' },
      svg('polygon', { points: SHAPES[shape].map((point) => point.join(',')).join(' ') }));
  }

  const RULER_CM = 15;
  const CM = 20; // 1cm의 그림 속 길이
  const rulerX = (cm) => 15 + cm * CM;

  function drawRuler({ from, to }, doc) {
    const svg = svgMaker(doc);
    const marks = Array.from({ length: RULER_CM + 1 }, (_, cm) => [
      svg('line', { class: 'tick', x1: rulerX(cm), y1: 40, x2: rulerX(cm), y2: 54 }),
      svg('text', { class: 'number', x: rulerX(cm), y: 71, 'text-anchor': 'middle' }, String(cm)),
    ]).flat();
    // 막대의 양 끝이 어느 눈금인지 보이도록 점선을 내림
    const guides = [from, to].map((cm) => svg('line', {
      class: 'guide', x1: rulerX(cm), y1: 8, x2: rulerX(cm), y2: 40,
    }));
    return svg('svg', { class: 'ruler', viewBox: `0 0 ${rulerX(RULER_CM) + 15} 86`, role: 'img', 'aria-label': '자와 막대 그림' },
      svg('rect', { class: 'body', x: 4, y: 40, width: rulerX(RULER_CM) + 7, height: 42, rx: 4 }),
      ...marks,
      svg('rect', { class: 'bar', x: rulerX(from), y: 10, width: (to - from) * CM, height: 18 }),
      ...guides);
  }

  // item은 글자나 그림 문자라서 SVG 대신 HTML로 그려 좁은 화면에서 줄이 바뀌게 함
  function drawGroups({ groups, size, item }, doc) {
    const el = maker(doc);
    return el('div', { className: 'groups' }, ...Array.from({ length: groups }, () =>
      el('div', { className: 'group' }, ...Array.from({ length: size }, () => el('span', {}, item)))));
  }

  const DRAWERS = {
    clock: drawClock, table: drawTable, graph: drawGraph,
    shape: drawShape, ruler: drawRuler, groups: drawGroups,
  };

  function renderVisual(visual, doc = document) {
    const wrapper = maker(doc)('div', { className: 'visual' });
    const draw = DRAWERS[visual.type];
    // 모르는 그림이나 도형이 있어도 문제는 보이게 함
    const picture = draw?.(visual, doc);
    if (picture) wrapper.append(picture);
    return wrapper;
  }

  exports.clockAngles = clockAngles;
  exports.renderVisual = renderVisual;
  exports.types = Object.keys(DRAWERS);
  exports.shapes = Object.keys(SHAPES);
  exports.rulerLength = RULER_CM;
})(typeof module === 'object' ? module.exports : (window.Visuals = {}));
