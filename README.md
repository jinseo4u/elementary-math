# 곱셈구구 학습 페이지

2학년 2학기 곱셈구구 단원의 설명, 예제, 문제를 웹에서 풀어 봅니다.

## 실행

```bash
npm run dev
```

브라우저에서 http://localhost:8000 에 접속합니다. `index.html`을 직접 열면 문제 데이터를 불러올 수 없습니다.

## 구성

- `index.html`, `style.css`, `app.js`: 화면과 동작
- `data/units-grade2-gugudan.json`: 단원 데이터

맞힌 문제는 해당 브라우저에만 저장됩니다.

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 GitHub Pages에 배포합니다. 저장소의 Settings → Pages → Source는 `GitHub Actions`로 설정합니다.

배포 주소: https://jinseo4u.github.io/elementary-math/

화면에 필요한 파일을 새로 추가하면 워크플로의 `Collect site files` 단계에도 추가해야 합니다.
