const test = require('node:test');
const assert = require('node:assert/strict');
const { generateProblems, typeCounts } = require('../generator.js');
const unit = require('../data/units-grade2-gugudan.json');

const RUNS = 3000;

// 실패를 다시 재현할 수 있는 난수 (mulberry32)
function seeded(seed) {
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 생성기의 계산을 믿지 않고, 문제 문장만 읽어서 곱한 두 수와 정답을 다시 구한다.
function solve({ type, question }) {
  if (type === 'word') {
    const numbers = question.match(/\d+/g).map(Number);
    assert.equal(numbers.length, 2, `문장제의 숫자는 2개여야 함: ${question}`);
    // "○개씩" 앞의 수(한 묶음의 수)를 첫 번째 인수로 둔다.
    const each = Number(question.match(/(\d+)(?:개|자루|명)씩/)[1]);
    if (numbers[0] !== each) numbers.reverse();
    return { factors: numbers, answers: [numbers[0] * numbers[1]] };
  }
  const side = '(\\d+|□)';
  const match = question.match(new RegExp(`^${side} × ${side} = ${side}(?: × ${side})?$`));
  assert.ok(match, `알 수 없는 식: ${question}`);
  assert.equal(question.split('□').length, 2, `□는 하나여야 함: ${question}`);
  const holds = (x) => {
    const [a, b, c, d] = match.slice(1).map((s) => (s === undefined ? s : s === '□' ? x : Number(s)));
    return a * b === (d === undefined ? c : c * d);
  };
  const answers = Array.from({ length: 101 }, (_, x) => x).filter(holds);
  const filled = match.slice(1, 3).map((s) => (s === '□' ? answers[0] : Number(s)));
  return { factors: filled, answers };
}

function forEachSet(check) {
  for (const lesson of unit.lessons) {
    for (let seed = 1; seed <= RUNS; seed++) {
      check(generateProblems(lesson, { random: seeded(seed) }), lesson, `${lesson.id} seed=${seed}`);
    }
  }
}

test('정답은 하나뿐이고 문제를 다시 풀어 구한 값과 같다', () => {
  forEachSet((problems, lesson, where) => {
    for (const p of problems) {
      assert.deepEqual(solve(p).answers, [p.answer], `${where}: ${p.question}`);
    }
  });
});

test('소단원의 단과 곱셈구구 범위 안에서 출제한다', () => {
  forEachSet((problems, lesson, where) => {
    const { tables, swapTables = [] } = lesson.generator;
    for (const p of problems) {
      const { factors } = solve(p);
      const isSwap = p.question.split('×').length === 3;
      assert.ok(factors.every((f) => f >= 0 && f <= 9), `${where}: ${p.question}`);
      const ok = isSwap
        ? factors.every((f) => swapTables.includes(f))
        // 0단, 1단은 순서를 바꾼 식도 허용
        : tables.includes(factors[0]) || factors.some((f) => f <= 1 && tables.includes(f));
      assert.ok(ok, `${where}: ${p.question}`);
    }
  });
});

test('5문제를 설정한 유형 비율대로 만든다', () => {
  forEachSet((problems, lesson, where) => {
    assert.equal(problems.length, 5, where);
    for (const type of ['calc', 'fill', 'word']) {
      assert.equal(problems.filter((p) => p.type === type).length, lesson.generator.mix[type], `${where} ${type}`);
    }
  });
});

test('한 세트에서 같은 곱셈이 두 번 나오지 않는다', () => {
  forEachSet((problems, lesson, where) => {
    const facts = problems.map((p) => solve(p).factors.sort((a, b) => a - b).join('x'));
    assert.equal(new Set(facts).size, problems.length, `${where}: ${problems.map((p) => p.question).join(' / ')}`);
    assert.equal(new Set(problems.map((p) => p.id)).size, problems.length, where);
  });
});

test('힌트와 해설이 있고, 해설에 정답이 나온다', () => {
  forEachSet((problems, lesson, where) => {
    for (const p of problems) {
      for (const text of [p.question, p.hint, p.solution]) {
        assert.ok(text && !/undefined|NaN/.test(text), `${where}: ${text}`);
      }
      assert.ok(p.solution.match(/\d+/g).map(Number).includes(p.answer), `${where}: ${p.solution}`);
      // 해설 속 모든 곱셈식과 덧셈식도 맞아야 함
      for (const [, a, op, b, c] of `${p.hint} ${p.solution}`.matchAll(/(\d+) ([×+]) (\d+) = (\d+)(?! ×)/g)) {
        assert.equal(op === '×' ? a * b : Number(a) + Number(b), Number(c), `${where}: ${p.solution}`);
      }
      if (p.type === 'word') assert.ok(p.unit, where);
    }
  });
});

test('비율이 나누어떨어지지 않아도 합이 문제 수와 같다', () => {
  assert.deepEqual(typeCounts({ calc: 1, fill: 1, word: 1 }, 5), { calc: 2, fill: 2, word: 1 });
  assert.deepEqual(typeCounts({ calc: 1 }, 5), { calc: 5, fill: 0, word: 0 });
  assert.throws(() => typeCounts({}, 5));
});

test('처음 화면의 직접 쓴 문제는 차시마다 5개이다', () => {
  for (const lesson of unit.lessons) assert.equal(lesson.problems.length, 5);
});
