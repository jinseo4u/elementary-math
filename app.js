const CURRICULUM_URL = 'data/curriculum-grade2.json';
const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

let curriculum;
let unit;
let current = 0;
let solved = new Set();
// 새로 만든 문제와 푼 기록은 화면에만 두고 저장하지 않음 (새로고침하면 처음 문제로 돌아감)
const practice = new Map(); // lesson.id → { problems, solved }

const storageKey = () => `solved:${unit.unitId}`;
function load() {
  try { solved = new Set(JSON.parse(localStorage.getItem(storageKey())) || []); } catch { solved = new Set(); }
}
function save() {
  try { localStorage.setItem(storageKey(), JSON.stringify([...solved])); } catch { /* 저장할 수 없어도 문제는 풀 수 있음 */ }
}

const countSolved = (lesson) => lesson.problems.filter((p) => solved.has(p.id)).length;

function renderProgress() {
  const total = unit.lessons.reduce((n, l) => n + l.problems.length, 0);
  const done = unit.lessons.reduce((n, l) => n + countSolved(l), 0);
  $('progress').textContent = done === total
    ? `🎉 ${total}문제를 모두 맞혔어요!`
    : `⭐ ${total}문제 중 ${done}문제를 맞혔어요.`;
  $('tabs').replaceChildren(...unit.lessons.map((lesson, i) => {
    const button = el('button', { type: 'button' },
      `${i + 1}. ${lesson.title} (${countSolved(lesson)}/${lesson.problems.length})`);
    button.setAttribute('aria-current', String(i === current));
    button.onclick = () => { current = i; render(); $('tabs').children[i].focus(); };
    return button;
  }));
}

const visualOf = ({ visual }) => (visual ? [Visuals.renderVisual(visual)] : []);

function renderExample(example) {
  const list = el('ol');
  const answer = el('p', { className: 'note', hidden: true }, `정답: ${example.answerText}`);
  const button = el('button', { type: 'button', className: 'secondary' }, '풀이 한 단계 보기');
  let shown = 0;
  button.onclick = () => {
    list.append(el('li', {}, example.steps[shown++]));
    if (shown === example.steps.length) { answer.hidden = false; button.hidden = true; }
  };
  return el('section', {}, el('h2', {}, '예제'), ...visualOf(example),
    el('p', { className: 'question' }, example.question), list, button, answer);
}

// 답을 쓰는 입력칸. check는 답을 채점하는 함수
function inputAnswer(problem, number, check, say) {
  const input = el('input', { id: `input-${problem.id}`, type: 'text', inputMode: 'numeric', autocomplete: 'off', maxLength: 4 });
  input.setAttribute('aria-label', `${number}번 답`);
  const submit = el('button', { type: 'submit' }, '확인');
  input.oninput = () => say('');
  return {
    controls: [input, ...(problem.unit ? [el('span', {}, problem.unit)] : []), submit],
    onSubmit: () => {
      const value = input.value.trim();
      if (!/^\d+$/.test(value)) { say('숫자로 답을 써 주세요.', 'wrong'); return; }
      if (!check(Number(value))) input.select();
    },
    markSolved: () => {
      input.value = problem.answer;
      input.readOnly = true;
      submit.disabled = true;
    },
  };
}

// 보기를 누르면 바로 채점함
function choiceAnswer(problem, number, check) {
  const buttons = problem.choices.map((choice) => {
    const button = el('button', { type: 'button', className: 'secondary' }, String(choice));
    button.onclick = () => check(choice);
    return button;
  });
  const group = el('div', { className: 'choices' }, ...buttons);
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', `${number}번 보기`);
  return {
    group,
    controls: problem.unit ? [el('span', {}, `단위: ${problem.unit}`)] : [],
    markSolved: () => buttons.forEach((button, i) => {
      button.disabled = true;
      if (problem.choices[i] === problem.answer) button.className = 'secondary answer';
    }),
  };
}

// record: 맞힌 문제를 기록할 Set, onSolved: 새로 맞혔을 때 할 일
function renderProblem(problem, number, record, onSolved = () => {}) {
  const hintButton = el('button', { type: 'button', className: 'secondary' }, '힌트');
  const solutionButton = el('button', { type: 'button', className: 'secondary', hidden: true }, '풀이 보기');
  const feedback = el('p', { className: 'feedback' });
  feedback.setAttribute('aria-live', 'polite');
  const hint = el('p', { className: 'note', hidden: true }, `💡 ${problem.hint}`);
  const solution = el('p', { className: 'note', hidden: true }, `📝 ${problem.solution}`);
  const say = (text, kind = '') => { feedback.textContent = text; feedback.className = `feedback ${kind}`; };

  const markSolved = () => {
    card.classList.add('solved');
    answer.markSolved();
    solutionButton.hidden = false;
    say('⭕ 정답이에요!', 'correct');
  };
  // 맞았는지 돌려줌
  const check = (value) => {
    if (record.has(problem.id)) return true;
    if (value === problem.answer) {
      record.add(problem.id);
      markSolved();
      onSolved();
      return true;
    }
    // 한 번 틀린 뒤에는 힌트와 풀이를 볼 수 있게 함
    say('다시 한 번 생각해 볼까요?', 'wrong');
    hint.hidden = false;
    solutionButton.hidden = false;
    return false;
  };

  const answer = problem.type === 'choice'
    ? choiceAnswer(problem, number, check)
    : inputAnswer(problem, number, check, say);
  const form = el('form', { className: 'row' }, ...answer.controls, hintButton, solutionButton);
  const card = el('section', {}, ...visualOf(problem),
    el('p', { className: 'question' }, `${number}. ${problem.question}`),
    ...(answer.group ? [answer.group] : []), form, feedback, hint, solution);

  hintButton.onclick = () => { hint.hidden = !hint.hidden; };
  solutionButton.onclick = () => { solution.hidden = !solution.hidden; };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!record.has(problem.id)) answer.onSubmit?.();
  };

  if (record.has(problem.id)) markSolved();
  return card;
}

function renderProblems(lesson) {
  const container = el('div');
  const makeButton = el('button', { type: 'button' }, '새 문제 만들기');
  const backButton = el('button', { type: 'button', className: 'secondary' }, '처음 문제 보기');

  const show = () => {
    const set = practice.get(lesson.id);
    const onSolved = () => { save(); renderProgress(); };
    container.replaceChildren(...(set
      ? [el('p', {}, '새로 만든 문제예요. 이 문제들은 푼 기록에 저장되지 않아요.'),
        ...set.problems.map((p, i) => renderProblem(p, i + 1, set.solved))]
      : lesson.problems.map((p, i) => renderProblem(p, i + 1, solved, onSolved))));
    backButton.hidden = !set;
  };

  makeButton.onclick = () => {
    practice.set(lesson.id, { problems: ProblemGenerator.generateProblems(lesson), solved: new Set() });
    show();
    container.querySelector('input').focus();
  };
  backButton.onclick = () => {
    practice.delete(lesson.id);
    show();
    makeButton.focus();
  };

  show();
  // generator 설정이 없는 차시는 새 문제를 만들 수 없음
  if (!lesson.generator) return container;
  return el('div', {}, container, el('div', { className: 'row' }, makeButton, backButton));
}

function render() {
  const lesson = unit.lessons[current];
  renderProgress();
  $('lesson').replaceChildren(
    el('section', {}, el('h2', {}, lesson.title), el('p', {}, lesson.explanation)),
    ...(lesson.example ? [renderExample(lesson.example)] : []),
    renderProblems(lesson),
  );
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

const LOAD_HELP = '파일을 직접 열지 말고, 프로젝트 폴더에서 "npm run dev"를 실행한 뒤 http://localhost:8000 으로 접속해 주세요.';

// 주소 뒤의 #단원번호로 화면을 정함. 휴대폰의 뒤로 가기도 그대로 동작함
const findUnit = (unitId) => curriculum.semesters
  .flatMap((s) => s.units)
  .find((u) => u.unitId === unitId && u.active);

function renderMenu() {
  $('menu-title').textContent = curriculum.title;
  $('menu-message').hidden = true;
  $('semesters').replaceChildren(...curriculum.semesters.map(({ semester, units }) =>
    el('section', {}, el('h2', {}, `${semester}학기`),
      el('div', { className: 'units' }, ...units.map((entry) => {
        const button = el('button', { type: 'button', disabled: !entry.active },
          el('span', {}, `${entry.number}. ${entry.title}`));
        if (entry.active) button.onclick = () => { location.hash = entry.unitId; };
        else button.append(el('span', { className: 'badge' }, '준비 중'));
        return button;
      })))));
}

// 늦게 도착한 단원 데이터가 지금 화면을 덮지 않도록 이동할 때마다 번호를 올림
let visit = 0;
const lastLesson = new Map(); // unitId → 마지막으로 본 차시

function showView(id) {
  $('menu').hidden = id !== 'menu';
  $('unit').hidden = id !== 'unit';
}

function showMenu() {
  showView('menu');
  document.title = curriculum.title;
}

async function showUnit(entry) {
  const thisVisit = visit;
  showView('unit');
  unit = undefined;
  document.title = `${entry.title} - ${curriculum.title}`;
  $('grade').textContent = '';
  $('title').textContent = '불러오는 중…';
  $('description').textContent = '';
  $('progress').textContent = '';
  $('tabs').replaceChildren();
  $('lesson').replaceChildren();
  $('reset').hidden = true;
  try {
    const data = await fetchJson(entry.data);
    if (thisVisit !== visit) return;
    unit = data;
    current = lastLesson.get(unit.unitId) || 0;
    if (!unit.lessons[current]) current = 0;
    load();
    $('grade').textContent = `${unit.grade}학년 ${unit.semester}학기`;
    $('title').textContent = unit.unitTitle;
    $('description').textContent = unit.unitDescription;
    render();
    $('reset').hidden = false;
  } catch (error) {
    if (thisVisit !== visit) return;
    console.error(error);
    $('title').textContent = '문제를 불러오지 못했어요';
    $('description').textContent = LOAD_HELP;
  }
}

function route() {
  visit++;
  if (unit) lastLesson.set(unit.unitId, current);
  const entry = findUnit(location.hash.slice(1));
  if (entry) return showUnit(entry);
  unit = undefined;
  showMenu();
}

// 화면을 옮긴 뒤에는 맨 위 제목부터 보이고 읽히게 함
function navigate() {
  route();
  window.scrollTo(0, 0);
  $($('unit').hidden ? 'menu-title' : 'title').focus({ preventScroll: true });
}

$('home').onclick = () => { location.hash = ''; };
$('reset').onclick = () => {
  if (!confirm('푼 기록을 모두 지울까요?')) return;
  solved.clear();
  for (const lesson of unit.lessons) practice.delete(lesson.id);
  save();
  render();
};

async function start() {
  try {
    curriculum = await fetchJson(CURRICULUM_URL);
    renderMenu();
    window.addEventListener('hashchange', navigate);
    route();
  } catch (error) {
    console.error(error);
    $('menu-message').textContent = `메뉴를 불러오지 못했어요. ${LOAD_HELP}`;
  }
}

start();
