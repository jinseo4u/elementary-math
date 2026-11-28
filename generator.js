// 소단원의 generator 설정으로 새 문제를 만든다. 브라우저와 Node 테스트에서 함께 쓴다.
(function (exports) {
  const TYPES = ['calc', 'fill', 'word'];
  const ONE_TO_NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // each: 한 묶음의 수(단), count: 묶음의 수. 문장에는 이 두 숫자만 아라비아 숫자로 쓴다.
  // zero: 0개씩이어도 어색하지 않은 문장
  const WORD_TEMPLATES = [
    { zero: true, unit: '개', subject: '사과는',
      text: (each, count) => `접시 ${count}개에 사과가 ${each}개씩 놓여 있습니다. 사과는 모두 몇 개일까요?` },
    { zero: true, unit: '개', subject: '공은',
      text: (each, count) => `상자 ${count}개에 공이 ${each}개씩 들어 있습니다. 공은 모두 몇 개일까요?` },
    { unit: '개', subject: '사탕은',
      text: (each, count) => `한 봉지에 사탕이 ${each}개씩 들어 있습니다. ${count}봉지에 들어 있는 사탕은 모두 몇 개일까요?` },
    { unit: '자루', subject: '연필은',
      text: (each, count) => `필통 한 개에 연필이 ${each}자루씩 들어 있습니다. 필통 ${count}개에 들어 있는 연필은 모두 몇 자루일까요?` },
    { unit: '명', subject: '학생은',
      text: (each, count) => `긴 의자 한 개에 학생이 ${each}명씩 앉아 있습니다. 긴 의자 ${count}개에 앉아 있는 학생은 모두 몇 명일까요?` },
  ];

  const pick = (list, random) => list[Math.floor(random() * list.length)];

  function shuffle(list, random) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // 비율대로 count개를 나눈다. 남는 자리는 소수 부분이 큰 유형부터 채운다.
  function typeCounts(mix, count) {
    const total = TYPES.reduce((sum, type) => sum + (mix[type] || 0), 0);
    if (!(total > 0)) throw new Error('mix에 출제 비율이 없습니다.');
    const shares = TYPES.map((type) => ({ type, share: (count * (mix[type] || 0)) / total }));
    const counts = Object.fromEntries(shares.map(({ type, share }) => [type, Math.floor(share)]));
    let left = count - Object.values(counts).reduce((a, b) => a + b, 0);
    shares.sort((a, b) => (b.share % 1) - (a.share % 1));
    for (const { type } of shares) {
      if (left === 0) break;
      counts[type]++;
      left--;
    }
    return counts;
  }

  // 숫자를 읽었을 때 받침이 있는지(영, 일, 삼, 육, 칠, 팔, 십)에 따라 조사를 고른다.
  const josa = (number, withFinal, without) => `${number}${[0, 1, 3, 6, 7, 8].includes(number % 10) ? withFinal : without}`;

  const skipCount = (a, n) => Array.from({ length: n }, (_, i) => a * (i + 1)).join(', ');

  // a × b의 힌트와 풀이
  function explain(a, b) {
    const answer = a * b;
    const result = `${a} × ${b} = ${answer}`;
    if (a === 0) return { hint: '0에 어떤 수를 곱하면 항상 0이에요.', solution: `0은 여러 번 더해도 0이에요. 그러므로 ${result}입니다.` };
    if (b === 0) return { hint: '어떤 수에 0을 곱하면 항상 0이에요.', solution: `${a}씩 0묶음이면 아무것도 없어요. 그러므로 ${result}입니다.` };
    if (a === 1) return { hint: '1에 어떤 수를 곱하면 그 수가 그대로 나와요.', solution: `1을 ${b}번 더한 수는 ${answer}입니다. 그러므로 ${result}입니다.` };
    if (b === 1) return { hint: '어떤 수에 1을 곱하면 그 수가 그대로 나와요.', solution: `${a}씩 1묶음은 ${a}입니다. 그러므로 ${result}입니다.` };
    if (a === 6 || a === 8) {
      const half = (a / 2) * b;
      return {
        hint: `${a}단은 ${a / 2}단의 두 배예요. ${a / 2} × ${b}부터 구해 보세요.`,
        solution: `${a / 2} × ${b} = ${half}이고 그 두 배는 ${half} + ${half} = ${answer}입니다. 그러므로 ${result}입니다.`,
      };
    }
    return {
      hint: `${a} × ${b - 1} = ${josa(a * (b - 1), '이에요', '예요')}. 여기에 ${a}만큼 더해 보세요.`,
      solution: `${a}씩 ${b}번 세면 ${skipCount(a, b)}입니다. 그러므로 ${result}입니다.`,
    };
  }

  // 0단과 1단은 "어떤 수 × 0"처럼 순서를 바꾼 식도 낸다.
  function makeCalc(table, n, random) {
    const [a, b] = table <= 1 && random() < 0.5 ? [n, table] : [table, n];
    return { question: `${a} × ${b} = □`, answer: a * b, ...explain(a, b) };
  }

  function makeFill(table, n, random) {
    if (table === 0) {
      // "0 × □ = 0"은 답이 여러 개이므로 □가 0인 식만 낸다.
      const question = random() < 0.5 ? `${n} × □ = 0` : `□ × ${n} = 0`;
      return {
        question,
        answer: 0,
        hint: `${n}에 어떤 수를 곱해야 0이 될지 생각해 보세요.`,
        solution: `${n}에 곱해서 0이 되는 수는 0뿐이므로 □ = 0입니다.`,
      };
    }
    if (table === 1) {
      const blankIsOne = random() < 0.5;
      const answer = blankIsOne ? 1 : n;
      return {
        question: blankIsOne ? `□ × ${n} = ${n}` : `1 × □ = ${n}`,
        answer,
        hint: '1과 어떤 수를 곱하면 그 어떤 수가 그대로 나와요.',
        solution: `1 × ${n} = ${n}이므로 □ = ${answer}입니다.`,
      };
    }
    const product = table * n;
    return {
      question: `${table} × □ = ${product}`,
      answer: n,
      hint: `${table}단을 차례로 외워 보세요. ${josa(product, '은', '는')} 몇 번째에 나오나요?`,
      solution: `${skipCount(table, n)}에서 ${josa(product, '은', '는')} ${n}번째 수이므로 □ = ${n}입니다.`,
    };
  }

  // 곱셈표: 두 수의 순서 바꾸기
  function makeSwap(a, b) {
    return {
      question: `${a} × ${b} = ${b} × □`,
      answer: a,
      hint: '곱하는 두 수의 순서를 바꾸어도 곱은 같아요.',
      solution: `${a} × ${b}와 ${b} × ${a}는 모두 ${a * b}이므로 □ = ${a}입니다.`,
    };
  }

  function makeWord(table, n, random) {
    const template = pick(WORD_TEMPLATES.filter((t) => table > 0 || t.zero), random);
    const { hint, solution } = explain(table, n);
    return {
      question: template.text(table, n),
      answer: table * n,
      unit: template.unit,
      hint: `${table}${template.unit}씩 ${n}묶음이므로 ${table} × ${josa(n, '을', '를')} 구해요. ${hint}`,
      solution: `${solution} ${template.subject} 모두 ${table * n}${template.unit}입니다.`,
    };
  }

  // 곱하는 두 수가 같으면(순서만 바뀌어도) 같은 문제로 본다.
  const factKey = (a, b) => [a, b].sort((x, y) => x - y).join('x');

  const MAKERS = { calc: makeCalc, fill: makeFill, word: makeWord };

  function candidates(type, table) {
    // 문장제는 "1봉지"처럼 한 묶음인 경우를 뺀다.
    return ONE_TO_NINE
      .filter((n) => type !== 'word' || n > 1)
      .map((n) => ({ key: factKey(table, n), make: (random) => MAKERS[type](table, n, random) }));
  }

  function swapCandidates(tables) {
    return tables.flatMap((a) => tables.filter((b) => b !== a)
      .map((b) => ({ key: factKey(a, b), make: () => makeSwap(a, b) })));
  }

  function generateProblems(lesson, { count = 5, random = Math.random } = {}) {
    const config = lesson.generator;
    if (!config) throw new Error(`${lesson.id}: generator 설정이 없습니다.`);
    const counts = typeCounts(config.mix, count);
    const types = shuffle(TYPES.flatMap((type) => Array(counts[type]).fill(type)), random);
    // 여러 단이 고르게 나오도록 섞은 순서대로 돌아가며 쓴다.
    const tables = shuffle(config.tables, random);
    const used = new Set();
    let turn = 0;
    let swapNext = random() < 0.5;

    return types.map((type, i) => {
      // swapTables가 있으면 빈칸 문제를 번갈아 순서 바꾸기 문제로 낸다.
      let useSwap = false;
      if (type === 'fill' && config.swapTables) {
        useSwap = swapNext;
        swapNext = !swapNext;
      }
      for (let tried = 0; tried < tables.length; tried++) {
        const pool = useSwap
          ? swapCandidates(config.swapTables)
          : candidates(type, tables[turn++ % tables.length]);
        const fresh = pool.filter((c) => !used.has(c.key));
        if (fresh.length === 0) continue;
        const chosen = pick(fresh, random);
        used.add(chosen.key);
        return { id: `${lesson.id}-new-p${i + 1}`, type, ...chosen.make(random) };
      }
      throw new Error(`${lesson.id}: 겹치지 않는 문제를 더 만들 수 없습니다.`);
    });
  }

  exports.generateProblems = generateProblems;
  exports.typeCounts = typeCounts;
})(typeof module === 'object' ? module.exports : (window.ProblemGenerator = {}));
