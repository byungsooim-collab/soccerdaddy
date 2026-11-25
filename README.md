# 사커대디 (Soccer Daddy)

13살 미드필더 아들을 다마고치처럼 키우는 축구 성장 블로그. 마크다운 글을 정적 사이트로 만들어 Firebase Hosting 에 올립니다. 작업 폴더는 Mac 의 `~/Desktop/soccerdaddy` 입니다.

```bash
npm install
npm run build     # 공개 시각이 지난 글만
npm run preview   # 예약 글까지 포함
npm run serve     # dist/ 미리보기 (http://localhost:3000)
```

| 경로 | 역할 |
| --- | --- |
| `posts/*.md` | 글 (작성 규칙은 `POSTING.md`) |
| `images/` | 글 표지 그림 (구글 Flow 로 생성, 1200px webp) |
| `player.json` | 상태창 항목과 기본 프로필 |
| `blog.config.json` | 블로그 이름, 소개, 주소 |
| `src/` | 빌드 스크립트, 자동 표지, 스타일 |
| `.github/workflows/firebase-deploy.yml` | 커밋하거나 매일 09:05·19:05(KST)에 빌드해서 Firebase Hosting 에 배포 |

## 처음 한 번 설정 (Firebase)

컴퓨터의 Firebase CLI 로 진행합니다. 자세한 순서는 `FIREBASE.md` 를 보세요.

```bash
firebase login
firebase use --add            # 프로젝트 선택 → 별칭 default
npm install && npm run deploy # 빌드 후 배포
```

자동 배포(하루 2번 예약 글 공개)는 GitHub 저장소에 `FIREBASE_SERVICE_ACCOUNT` 시크릿과 `FIREBASE_PROJECT_ID` 변수를 등록하면 동작합니다.
