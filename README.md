# 2학년 수학 학습 페이지

메인 메뉴에서 단원을 골라 설명, 예제, 문제를 웹에서 풀어 봅니다. 1·2학기 12개 단원을 모두 쓸 수 있습니다.

## 실행

```bash
npm run dev
```

브라우저에서 http://localhost:8000 에 접속합니다. `index.html`을 직접 열면 문제 데이터를 불러올 수 없습니다.

## 단원 추가

1. `data/`에 단원 JSON을 넣습니다. 파일 이름은 `data/curriculum-grade2.json`의 해당 단원 `data` 경로와 맞춥니다.
2. 같은 항목의 `active`를 `true`로 바꿉니다.
3. `npm test`로 확인합니다.

단원 JSON은 `data/units-grade2-gugudan.json`과 같은 형식으로 만듭니다.

- `grade`, `semester`, `unitId`, `unitTitle`은 메뉴 항목과 같아야 합니다. 차시와 문제의 `id`는 다른 단원과 겹치지 않게 합니다.
- 문제의 `type`이 `choice`이면 `choices`의 보기를 버튼으로 보여 줍니다. `answer`는 보기 중 하나(숫자 또는 글자)여야 합니다.
- 그 밖의 문제의 `answer`는 0 이상 9999 이하의 정수만 쓸 수 있습니다. `unit`을 넣으면 입력칸 옆에 단위를 보여 줍니다.
- 문제와 예제의 `visual`은 위쪽에 그림으로 나옵니다.
  - `{"type": "clock", "hour": 3, "minute": 15}`
  - `{"type": "table", "title": "…", "headers": [], "rows": [[]]}`
  - `{"type": "graph", "title": "…", "categories": [], "values": [], "mark": "○"}`
  - `{"type": "shape", "shape": "triangle"}` (`triangle`, `square`, `rectangle`, `pentagon`, `hexagon`)
  - `{"type": "ruler", "from": 2, "to": 7}` (0~15cm, 문제의 정답은 `to − from`)
  - `{"type": "groups", "groups": 4, "size": 2, "item": "●"}`
- 소단원마다 문제는 5개입니다.
- `example`과 `generator`는 없어도 됩니다. `generator`는 곱셈 문제만 만들 수 있으므로 다른 단원에는 넣지 않습니다.

## 새 문제 만들기

각 차시의 "새 문제 만들기" 버튼을 누르면 문제 5개를 무작위로 만듭니다. 새 문제의 풀이 기록은 저장하지 않으며 진행률에도 넣지 않습니다.

출제 규칙은 단원 데이터의 각 lesson에 있는 `generator`로 정합니다.

- `tables`: 출제할 단
- `mix`: 문제 유형 비율 (`calc` 계산, `fill` 빈칸, `word` 문장제)
- `swapTables` (선택): `a × b = b × □` 꼴의 빈칸 문제에 쓸 수. 빈칸 문제의 일부가 이 꼴로 나옵니다.

## 테스트

```bash
npm test
```

## 구성

- `index.html`, `style.css`, `app.js`: 화면과 동작
- `generator.js`: 새 문제, 힌트, 해설 생성
- `visuals.js`: 시계, 표, 그래프, 도형, 자, 묶음 그림
- `test/`: 생성한 문제, 메뉴 이동, 단원 데이터 검사
- `data/curriculum-grade2.json`: 메뉴의 단원 목록
- `data/units-grade2-*.json`: 단원 데이터

맞힌 문제는 해당 브라우저에만 저장됩니다.

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages에 배포합니다. 저장소의 Settings → Pages → Source는 `GitHub Actions`로 설정합니다.

배포 주소: https://jinseo4u.github.io/elementary-math/

화면에 필요한 파일을 새로 추가하면 워크플로의 `Collect site files` 단계에도 추가해야 합니다.
