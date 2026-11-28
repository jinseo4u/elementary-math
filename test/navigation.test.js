// 브라우저 없이 app.js를 실행해 메뉴 이동을 검사한다. app.js가 쓰는 DOM 기능만 흉내 낸다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ProblemGenerator = require('../generator.js');
const Visuals = require('../visuals.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const curriculum = JSON.parse(read('data/curriculum-grade2.json'));
const units = curriculum.semesters.flatMap((s) => s.units.map((u) => ({ ...u, semester: s.semester })));
const GUGUDAN = 'g2-2-u2';

class Node {
  constructor(tag) { Object.assign(this, { tagName: tag, children: [], attributes: {}, hidden: false, disabled: false, value: '', className: '' }); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = value; }
  get textContent() { return this.children.map((c) => (c instanceof Node ? c.textContent : String(c))).join(''); }
  set textContent(text) { this.children = [text]; }
  get classList() { return { add: (name) => { this.className += ` ${name}`; } }; }
  all(tag) { return this.children.filter((c) => c instanceof Node).flatMap((c) => [...(c.tagName === tag ? [c] : []), ...c.all(tag)]); }
  querySelector(tag) { return this.all(tag)[0]; }
  focus() {}
  select() {}
  click() { if (!this.disabled) this.onclick?.(); }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

// files: 파일 내용을 바꿔 끼움, hold: 응답을 늦출 파일
async function openApp({ hash = '', storage = new Map(), files = {}, hold } = {}) {
  const ids = new Map();
  // index.html의 id와 처음 hidden 상태를 그대로 가져옴
  for (const [, tag, attrs] of read('index.html').matchAll(/<(\w+)([^>]*\sid="[^>]*)>/g)) {
    const node = new Node(tag);
    node.hidden = /\shidden\b/.test(attrs);
    ids.set(attrs.match(/id="([^"]+)"/)[1], node);
  }
  const listeners = [];
  let currentHash = hash;
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const requested = [];
  const context = {
    document: { title: '', getElementById: (id) => ids.get(id), createElement: (tag) => new Node(tag), createElementNS: (ns, tag) => new Node(tag) },
    location: {
      get hash() { return currentHash; },
      set hash(value) {
        const next = value ? `#${value.replace(/^#/, '')}` : '';
        if (next === currentHash) return;
        currentHash = next;
        listeners.forEach((listener) => listener());
      },
    },
    window: { addEventListener: (type, listener) => type === 'hashchange' && listeners.push(listener), scrollTo() {} },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async (url) => {
      requested.push(url);
      if (url === hold) await held;
      const body = files[url] ?? (fs.existsSync(path.join(root, url)) ? read(url) : null);
      return { ok: body !== null, status: body === null ? 404 : 200, json: async () => JSON.parse(body) };
    },
    confirm: () => true,
    console: { error() {} },
    ProblemGenerator,
  };
  context.Visuals = { renderVisual: (visual) => Visuals.renderVisual(visual, context.document) };
  vm.runInNewContext(read('app.js'), context);
  await tick();

  const $ = (id) => ids.get(id);
  const app = {
    $, storage, requested, context,
    release: async () => { release(); await tick(); },
    unitButtons: () => $('semesters').all('button'),
    unitButton: (title) => app.unitButtons().find((b) => b.textContent.includes(title)),
    go: async (button) => { button.click(); await tick(); },
    setHash: async (value) => { context.location.hash = value; await tick(); },
    solveFirst: () => {
      const form = $('lesson').querySelector('form');
      const answer = JSON.parse(read('data/units-grade2-gugudan.json')).lessons[0].problems[0].answer;
      form.querySelector('input').value = String(answer);
      form.onsubmit({ preventDefault() {} });
    },
  };
  return app;
}

const onMenu = (app) => !app.$('menu').hidden && app.$('unit').hidden;
const onUnit = (app) => app.$('menu').hidden && !app.$('unit').hidden;

test('메인 메뉴에 제목과 학기별 단원이 순서대로 나온다', async () => {
  const app = await openApp();
  assert.ok(onMenu(app));
  assert.equal(app.$('menu-title').textContent, '2학년 수학');
  assert.deepEqual(app.$('semesters').all('h2').map((h) => h.textContent), ['1학기', '2학기']);
  assert.deepEqual(app.unitButtons().map((b) => b.children[0].textContent), [
    '1. 세 자리 수', '2. 여러 가지 도형', '3. 덧셈과 뺄셈', '4. 길이 재기', '5. 분류하기', '6. 곱셈',
    '1. 네 자리 수', '2. 곱셈구구', '3. 길이 재기', '4. 시각과 시간', '5. 표와 그래프', '6. 규칙 찾기',
  ]);
});

test('2학기 단원만 누를 수 있고 1학기는 준비 중이다', async () => {
  const app = await openApp();
  for (const [i, button] of app.unitButtons().entries()) {
    const ready = units[i].semester === 2;
    assert.equal(button.disabled, !ready, button.textContent);
    assert.equal(button.textContent.includes('준비 중'), !ready, button.textContent);
    if (!ready) await app.go(button);
  }
  assert.ok(onMenu(app));
  assert.equal(app.context.location.hash, '');
});

test('단원에 들어갔다가 메인 메뉴로 돌아온다', async () => {
  const app = await openApp();
  await app.go(app.unitButton('곱셈구구'));
  assert.ok(onUnit(app));
  assert.equal(app.context.location.hash, `#${GUGUDAN}`);
  assert.equal(app.$('title').textContent, '곱셈구구');
  assert.equal(app.$('tabs').children.length, 3);

  await app.go(app.$('home'));
  assert.ok(onMenu(app));
  assert.equal(app.context.document.title, '2학년 수학');
});

test('나갔다가 다시 들어와도, 새로 열어도 푼 기록이 남는다', async () => {
  const app = await openApp();
  await app.go(app.unitButton('곱셈구구'));
  app.solveFirst();
  await app.go(app.$('home'));
  await app.go(app.unitButton('곱셈구구'));
  assert.match(app.$('progress').textContent, /1문제를 맞혔어요/);

  const reopened = await openApp({ storage: app.storage, hash: `#${GUGUDAN}` });
  assert.ok(onUnit(reopened));
  assert.match(reopened.$('progress').textContent, /1문제를 맞혔어요/);
});

test('보던 차시와 새로 만든 문제는 메뉴에 다녀와도 그대로다', async () => {
  const app = await openApp({ hash: `#${GUGUDAN}` });
  await app.go(app.$('tabs').children[1]);
  const make = () => app.$('lesson').all('button').find((b) => b.textContent === '새 문제 만들기');
  await app.go(make());
  const before = app.$('lesson').textContent;
  await app.go(app.$('home'));
  await app.go(app.unitButton('곱셈구구'));
  assert.equal(app.$('lesson').textContent, before);
});

test('뒤로 가기처럼 주소가 바뀌면 화면도 바뀐다', async () => {
  const app = await openApp();
  await app.setHash(GUGUDAN);
  assert.ok(onUnit(app));
  await app.setHash('');
  assert.ok(onMenu(app));
});

test('준비 중이거나 없는 단원 주소는 메인 메뉴를 보여 준다', async () => {
  for (const hash of ['#g2-1-u1', '#없는단원']) {
    const app = await openApp({ hash });
    assert.ok(onMenu(app), hash);
    assert.deepEqual(app.requested, ['data/curriculum-grade2.json'], hash);
  }
});

test('불러오는 중에 메뉴로 나가면 늦게 온 단원이 화면을 덮지 않는다', async () => {
  const app = await openApp({ hold: 'data/units-grade2-gugudan.json' });
  await app.go(app.unitButton('곱셈구구'));
  await app.go(app.$('home'));
  await app.release();
  assert.ok(onMenu(app));
  assert.equal(app.context.document.title, '2학년 수학');
  assert.equal(app.$('lesson').children.length, 0);
});

test('JSON을 추가하고 활성화하면 새 단원이 열린다 (예제, generator 없이도)', async () => {
  const changed = structuredClone(curriculum);
  const entry = changed.semesters[0].units[0];
  entry.active = true;
  const unit = {
    grade: 2, semester: 1, unitId: entry.unitId, unitTitle: entry.title, unitDescription: '설명',
    lessons: [{ id: 'g2-1-u1-l1', title: '백', explanation: '설명',
      problems: [{ id: 'g2-1-u1-l1-p1', question: '99보다 1 큰 수', answer: 100, hint: '힌트', solution: '100' }] }],
  };
  const app = await openApp({ files: { 'data/curriculum-grade2.json': JSON.stringify(changed), [entry.data]: JSON.stringify(unit) } });
  await app.go(app.unitButton(entry.title));
  assert.ok(onUnit(app));
  assert.equal(app.$('title').textContent, '세 자리 수');
  assert.ok(!app.$('lesson').textContent.includes('새 문제 만들기'));
});

test('단원 파일이 없으면 안내하고 메뉴로 돌아갈 수 있다', async () => {
  const changed = structuredClone(curriculum);
  changed.semesters[0].units[0].active = true;
  const app = await openApp({ files: { 'data/curriculum-grade2.json': JSON.stringify(changed) } });
  await app.go(app.unitButton('세 자리 수'));
  assert.equal(app.$('title').textContent, '문제를 불러오지 못했어요');
  await app.go(app.$('home'));
  assert.ok(onMenu(app));
});

test('활성 단원의 데이터 파일은 메뉴 정보와 일치한다', () => {
  assert.equal(new Set(units.map((u) => u.unitId)).size, units.length);
  assert.equal(new Set(units.map((u) => u.data)).size, units.length);
  for (const entry of units) {
    // GitHub Pages의 /elementary-math/ 아래에서도 열리도록 상대 경로만 씀
    assert.match(entry.data, /^data\/[\w-]+\.json$/);
    if (!entry.active) continue;
    const unit = JSON.parse(read(entry.data));
    assert.deepEqual([unit.grade, unit.semester, unit.unitId, unit.unitTitle],
      [curriculum.grade, entry.semester, entry.unitId, entry.title]);
  }
});

const buttonOf = (card, text) => card.all('button').find((b) => b.textContent === text);
const submit = (card, value) => {
  card.querySelector('input').value = value;
  card.querySelector('form').onsubmit({ preventDefault() {} });
};

test('모든 활성 단원의 모든 문제를 정답으로 풀 수 있다', async () => {
  for (const entry of units.filter((u) => u.active)) {
    const app = await openApp({ hash: `#${entry.unitId}` });
    const { lessons } = JSON.parse(read(entry.data));
    for (const [i, lesson] of lessons.entries()) {
      await app.go(app.$('tabs').children[i]);
      const cards = app.$('lesson').all('section').filter((s) => s.querySelector('form'));
      assert.equal(cards.length, lesson.problems.length, lesson.id);
      for (const [j, p] of lesson.problems.entries()) {
        if (p.type === 'choice') await app.go(buttonOf(cards[j], String(p.answer)));
        else submit(cards[j], String(p.answer));
        assert.match(cards[j].className, /solved/, p.id);
      }
    }
    assert.match(app.$('progress').textContent, /모두 맞혔어요/, entry.unitId);
  }
});

test('choice 문제는 틀리면 힌트를 보여 주고 맞히면 보기를 잠근다', async () => {
  const app = await openApp({ hash: '#g2-2-u1' });
  await app.go(app.$('tabs').children[2]);
  const card = app.$('lesson').all('section').filter((s) => s.querySelector('form'))[3];
  assert.equal(card.querySelector('input'), undefined);

  await app.go(buttonOf(card, '4837'));
  assert.match(card.textContent, /다시 한 번/);
  assert.doesNotMatch(card.className, /solved/);

  await app.go(buttonOf(card, '4873'));
  assert.match(card.className, /solved/);
  assert.ok(buttonOf(card, '4873').disabled && buttonOf(card, '4837').disabled);
  assert.match(app.$('progress').textContent, /1문제를 맞혔어요/);
});

test('그림은 문제 위에, 단위는 입력칸 옆에 나온다', async () => {
  const app = await openApp({ hash: '#g2-2-u5' });
  const sections = app.$('lesson').all('section');
  const example = sections.find((s) => s.textContent.startsWith('예제'));
  assert.deepEqual(example.children.slice(0, 3).map((c) => c.tagName), ['h2', 'div', 'p']);

  const cards = sections.filter((s) => s.querySelector('form'));
  assert.equal(cards[0].children[0].className, 'visual');
  assert.equal(cards[0].children[0].all('table').length, 1);
  const form = cards[4].querySelector('form');
  assert.deepEqual(form.children.slice(0, 2).map((c) => c.tagName), ['input', 'span']);
  assert.equal(form.children[1].textContent, '명');
});
