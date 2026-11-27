const DATA_URL = 'data/units-grade2-gugudan.json';
const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

let unit;
let current = 0;
let solved = new Set();

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

function renderExample(example) {
  const list = el('ol');
  const answer = el('p', { className: 'note', hidden: true }, `정답: ${example.answerText}`);
  const button = el('button', { type: 'button', className: 'secondary' }, '풀이 한 단계 보기');
  let shown = 0;
  button.onclick = () => {
    list.append(el('li', {}, example.steps[shown++]));
    if (shown === example.steps.length) { answer.hidden = false; button.hidden = true; }
  };
  return el('section', {}, el('h2', {}, '예제'),
    el('p', { className: 'question' }, example.question), list, button, answer);
}

function renderProblem(problem, number) {
  const inputId = `input-${problem.id}`;
  const input = el('input', { id: inputId, type: 'text', inputMode: 'numeric', autocomplete: 'off', maxLength: 4 });
  input.setAttribute('aria-label', `${number}번 답`);
  const submit = el('button', { type: 'submit' }, '확인');
  const hintButton = el('button', { type: 'button', className: 'secondary' }, '힌트');
  const solutionButton = el('button', { type: 'button', className: 'secondary', hidden: true }, '풀이 보기');
  const feedback = el('p', { className: 'feedback' });
  feedback.setAttribute('aria-live', 'polite');
  const hint = el('p', { className: 'note', hidden: true }, `💡 ${problem.hint}`);
  const solution = el('p', { className: 'note', hidden: true }, `📝 ${problem.solution}`);
  const form = el('form', { className: 'row' }, input, problem.unit || '', submit, hintButton, solutionButton);
  const card = el('section', {}, el('p', { className: 'question' }, `${number}. ${problem.question}`),
    form, feedback, hint, solution);

  const say = (text, kind = '') => { feedback.textContent = text; feedback.className = `feedback ${kind}`; };
  const markSolved = () => {
    card.classList.add('solved');
    input.value = problem.answer;
    input.readOnly = true;
    submit.disabled = true;
    solutionButton.hidden = false;
    say('⭕ 정답이에요!', 'correct');
  };

  hintButton.onclick = () => { hint.hidden = !hint.hidden; };
  solutionButton.onclick = () => { solution.hidden = !solution.hidden; };
  input.oninput = () => say('');
  form.onsubmit = (event) => {
    event.preventDefault();
    if (solved.has(problem.id)) return;
    const value = input.value.trim();
    if (!/^\d+$/.test(value)) { say('숫자로 답을 써 주세요.', 'wrong'); return; }
    if (Number(value) === problem.answer) {
      solved.add(problem.id);
      save();
      markSolved();
      renderProgress();
    } else {
      // 한 번 틀린 뒤에는 힌트와 풀이를 볼 수 있게 함
      say('다시 한 번 생각해 볼까요?', 'wrong');
      hint.hidden = false;
      solutionButton.hidden = false;
      input.select();
    }
  };

  if (solved.has(problem.id)) markSolved();
  return card;
}

function render() {
  const lesson = unit.lessons[current];
  renderProgress();
  $('lesson').replaceChildren(
    el('section', {}, el('h2', {}, lesson.title), el('p', {}, lesson.explanation)),
    renderExample(lesson.example),
    ...lesson.problems.map((p, i) => renderProblem(p, i + 1)),
  );
}

async function start() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    unit = await response.json();
    load();
    $('grade').textContent = `${unit.grade}학년 ${unit.semester}학기`;
    $('title').textContent = unit.unitTitle;
    $('description').textContent = unit.unitDescription;
    $('reset').hidden = false;
    $('reset').onclick = () => {
      if (!confirm('푼 기록을 모두 지울까요?')) return;
      solved.clear();
      save();
      render();
    };
    render();
  } catch (error) {
    console.error(error);
    $('title').textContent = '문제를 불러오지 못했어요';
    $('description').textContent = '파일을 직접 열지 말고, 프로젝트 폴더에서 "npm run dev"를 실행한 뒤 http://localhost:8000 으로 접속해 주세요.';
  }
}

start();
