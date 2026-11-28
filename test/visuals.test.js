const test = require('node:test');
const assert = require('node:assert/strict');
const { clockAngles, renderVisual, shapes } = require('../visuals.js');

// visuals.js가 쓰는 DOM 기능만 흉내 낸다.
class Node {
  constructor(tag) { Object.assign(this, { tagName: tag, children: [], attributes: {} }); }
  append(...items) { this.children.push(...items); }
  setAttribute(name, value) { this.attributes[name] = value; }
  get textContent() { return this.children.map((c) => (c instanceof Node ? c.textContent : c)).join(''); }
  all(tag) { return this.children.filter((c) => c instanceof Node).flatMap((c) => [...(c.tagName === tag ? [c] : []), ...c.all(tag)]); }
}
const doc = { createElement: (tag) => new Node(tag), createElementNS: (ns, tag) => new Node(tag) };
const draw = (visual) => renderVisual(visual, doc);

// 바늘 끝을 실제 좌표로 옮김 (y는 아래쪽이 +)
function tip(clock, name) {
  const line = clock.all('line').find((l) => l.attributes.class.includes(`${name}-hand`));
  const angle = (Number(line.attributes.transform.match(/rotate\((.+)\)/)[1]) * Math.PI) / 180;
  const length = -Number(line.attributes.y2);
  return { x: length * Math.sin(angle), y: -length * Math.cos(angle), length };
}
// 12시 방향부터 시계 방향으로 잰 눈금(0~60)
const tickAt = ({ x, y }) => ((Math.atan2(x, -y) / (2 * Math.PI)) * 60 + 60) % 60;
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);

// [시, 분, 짧은바늘이 가리키는 눈금]
const TIMES = [[3, 15, 16.25], [7, 40, 38 + 1 / 3], [2, 37, 13 + 1 / 12], [10, 5, 50 + 5 / 12], [11, 52, 59 + 1 / 3], [12, 0, 0], [12, 30, 2.5], [4, 25, 22 + 1 / 12]];

test('긴바늘은 분의 눈금을, 짧은바늘은 분만큼 더 간 곳을 가리킨다', () => {
  for (const [hour, minute, hourTick] of TIMES) {
    const clock = draw({ type: 'clock', hour, minute });
    const label = `${hour}시 ${minute}분`;
    close(tickAt(tip(clock, 'minute')) % 60, minute, `${label} 긴바늘`);
    close(tickAt(tip(clock, 'hour')) % 60, hourTick, `${label} 짧은바늘`);
    assert.ok(tip(clock, 'hour').length < tip(clock, 'minute').length);
  }
});

test('각도 계산: 15분은 오른쪽, 40분은 8, 37분은 7에서 2칸 뒤', () => {
  assert.deepEqual(clockAngles(3, 15), { hour: 97.5, minute: 90 });
  assert.deepEqual(clockAngles(7, 40), { hour: 230, minute: 240 });
  assert.deepEqual(clockAngles(2, 37), { hour: 78.5, minute: 222 });
});

test('시계에는 눈금 60개와 제자리에 놓인 숫자 1~12가 있다', () => {
  const clock = draw({ type: 'clock', hour: 1, minute: 0 });
  const ticks = clock.all('line').filter((l) => l.attributes.class.startsWith('tick'));
  assert.equal(ticks.length, 60);
  assert.equal(ticks.filter((l) => l.attributes.class.includes('major')).length, 12);
  assert.equal(new Set(ticks.map((l) => l.attributes.transform)).size, 60);
  const numbers = clock.all('text');
  assert.deepEqual(numbers.map((n) => n.textContent), Array.from({ length: 12 }, (_, i) => String(i + 1)));
  for (const n of numbers) {
    const at = tickAt({ x: Number(n.attributes.x), y: Number(n.attributes.y) });
    assert.ok(Math.abs((at % 60) - ((Number(n.textContent) * 5) % 60)) < 0.01, n.textContent);
  }
});

test('시계 설명에 시각이 드러나지 않는다', () => {
  const [svg] = draw({ type: 'clock', hour: 3, minute: 15 }).children;
  assert.equal(svg.attributes['aria-label'], '시계 그림');
});

test('표는 제목, 머리글, 값을 순서대로 보여 준다', () => {
  const table = draw({ type: 'table', title: '과일', headers: ['과일', '사과', '합계'], rows: [['학생 수', 5, 5]] });
  assert.equal(table.all('caption')[0].textContent, '과일');
  assert.deepEqual(table.all('th').map((c) => c.textContent), ['과일', '사과', '합계', '학생 수']);
  assert.deepEqual(table.all('td').map((c) => c.textContent), ['5', '5']);
});

test('그래프는 아래에서부터 값만큼 ○를 쌓는다', () => {
  const graph = draw({ type: 'graph', title: '운동', categories: ['축구', '수영', '야구'], values: [2, 3, 0], mark: '○' });
  const rows = graph.all('tbody')[0].all('tr').map((tr) => tr.children.map((c) => c.textContent));
  assert.deepEqual(rows, [['3', '', '○', ''], ['2', '○', '○', ''], ['1', '○', '○', '']]);
  assert.deepEqual(graph.all('tfoot')[0].all('th').map((c) => c.textContent), ['축구', '수영', '야구']);
});

test('도형은 이름에 맞는 수의 꼭짓점을 가지고, 설명에 이름이 드러나지 않는다', () => {
  const corners = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 };
  assert.deepEqual([...shapes].sort(), Object.keys(corners).sort());
  for (const [shape, count] of Object.entries(corners)) {
    const [svg] = draw({ type: 'shape', shape }).children;
    assert.equal(svg.all('polygon')[0].attributes.points.split(' ').length, count, shape);
    assert.equal(svg.attributes['aria-label'], '도형 그림');
  }
});

test('정사각형은 가로와 세로가 같고 직사각형은 다르다', () => {
  const size = (shape) => {
    const points = draw({ type: 'shape', shape }).all('polygon')[0].attributes.points.split(' ').map((p) => p.split(',').map(Number));
    return [0, 1].map((axis) => Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis])));
  };
  assert.equal(size('square')[0], size('square')[1]);
  assert.ok(size('rectangle')[0] > size('rectangle')[1]);
});

test('모르는 도형이면 그림 없이 빈 칸만 만든다', () => {
  assert.equal(draw({ type: 'shape', shape: 'star' }).children.length, 0);
});

test('자는 0~15cm이고 막대는 from 눈금부터 to 눈금까지 놓인다', () => {
  const ruler = draw({ type: 'ruler', from: 3, to: 11 });
  const numbers = ruler.all('text');
  assert.deepEqual(numbers.map((n) => n.textContent), Array.from({ length: 16 }, (_, i) => String(i)));
  const bar = ruler.all('rect').find((r) => r.attributes.class === 'bar').attributes;
  assert.equal(bar.x, numbers[3].attributes.x);
  assert.equal(Number(bar.x) + Number(bar.width), Number(numbers[11].attributes.x));
});

test('묶음 그림은 item을 size개씩 groups묶음 보여 준다', () => {
  const [box] = draw({ type: 'groups', groups: 4, size: 2, item: '🍎' }).children;
  assert.equal(box.children.length, 4);
  for (const group of box.children) assert.deepEqual(group.children.map((c) => c.textContent), ['🍎', '🍎']);
});
