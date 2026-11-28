const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { types: VISUAL_TYPES, shapes: SHAPES, rulerLength } = require('../visuals.js');

const dataDir = path.join(__dirname, '..', 'data');
const units = fs.readdirSync(dataDir)
  .filter((file) => /^units-.*\.json$/.test(file))
  .map((file) => ({ file, ...JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }));
const lessons = units.flatMap((u) => u.lessons);
const problems = lessons.flatMap((l) => l.problems);

test('1·2학기 12개 단원의 데이터가 있다', () => {
  assert.deepEqual(units.map((u) => u.unitId).sort(),
    [1, 2].flatMap((s) => [1, 2, 3, 4, 5, 6].map((n) => `g2-${s}-u${n}`)));
});

test('소단원마다 문제가 5개이다', () => {
  for (const lesson of lessons) assert.equal(lesson.problems.length, 5, lesson.id);
});

test('차시와 문제의 id는 겹치지 않는다', () => {
  for (const list of [lessons, problems]) assert.equal(new Set(list.map((x) => x.id)).size, list.length);
});

test('choice 문제의 정답은 choices 안에 하나만 있다', () => {
  for (const p of problems.filter((p) => p.type === 'choice')) {
    assert.ok(Array.isArray(p.choices) && p.choices.length >= 2, p.id);
    assert.equal(new Set(p.choices.map(String)).size, p.choices.length, p.id);
    // 숫자 4873과 글자 "4873"은 다른 값으로 봄
    assert.equal(p.choices.filter((c) => c === p.answer).length, 1, p.id);
  }
});

test('입력하는 문제의 정답은 0 이상 9999 이하의 정수이다', () => {
  for (const p of problems.filter((p) => p.type !== 'choice')) {
    assert.ok(['calc', 'fill', 'word'].includes(p.type), `${p.id}: ${p.type}`);
    assert.ok(Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= 9999, `${p.id}: ${p.answer}`);
  }
});

test('그림 데이터가 올바르다', () => {
  const items = [...problems, ...lessons.filter((l) => l.example).map((l) => ({ ...l.example, id: `${l.id} 예제` }))];
  for (const { id, visual } of items.filter((x) => x.visual)) {
    assert.ok(VISUAL_TYPES.includes(visual.type), id);
    if (visual.type === 'clock') {
      assert.ok(Number.isInteger(visual.hour) && visual.hour >= 1 && visual.hour <= 12, id);
      assert.ok(Number.isInteger(visual.minute) && visual.minute >= 0 && visual.minute < 60, id);
    } else if (visual.type === 'table') {
      for (const row of visual.rows) assert.equal(row.length, visual.headers.length, id);
    } else if (visual.type === 'shape') {
      assert.ok(SHAPES.includes(visual.shape), id);
    } else if (visual.type === 'ruler') {
      const { from, to } = visual;
      assert.ok(Number.isInteger(from) && Number.isInteger(to) && from >= 0 && from < to && to <= rulerLength, id);
    } else if (visual.type === 'groups') {
      assert.ok([visual.groups, visual.size].every((n) => Number.isInteger(n) && n > 0) && visual.item, id);
    } else {
      assert.equal(visual.values.length, visual.categories.length, id);
      assert.ok(visual.values.every((v) => Number.isInteger(v) && v >= 0) && visual.mark, id);
    }
  }
});

test('자 그림 문제의 정답(길이)은 to − from이다', () => {
  const items = lessons.flatMap((l) => [...l.problems, ...(l.example ? [{ ...l.example, id: `${l.id} 예제` }] : [])])
    .filter((x) => x.visual?.type === 'ruler');
  assert.ok(items.length > 0);
  for (const { id, answer, visual } of items) assert.equal(answer, visual.to - visual.from, id);
});

test('표의 합계는 각 칸을 더한 값이다', () => {
  for (const { visual } of problems.filter((p) => p.visual?.type === 'table')) {
    if (visual.headers.at(-1) !== '합계') continue;
    for (const [, ...values] of visual.rows) {
      const total = values.pop();
      assert.equal(values.reduce((a, b) => a + b, 0), total, visual.title);
    }
  }
});
