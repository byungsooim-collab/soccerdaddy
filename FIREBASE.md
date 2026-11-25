# Firebase 연결하기 (대표가 Mac 에서 한 번)

프로젝트 이름은 **soccerdaddy-blog** 로 정했습니다. 아래 명령은 Mac 터미널에서 순서대로 붙여 넣으면 됩니다.
Claude 세션 안에서 하려면 각 줄 앞에 `!` 를 붙여 입력하세요.

## 0. 준비 (한 번)

```bash
cd ~/Desktop/soccerdaddy
npm install                      # firebase 는 설치 없이 npx 로 실행합니다
```

## 1. 로그인 (대표가 직접) — ✅ 완료 (11/25)

```bash
npx firebase-tools login                   # 브라우저가 열리면 구글 계정으로 로그인 → 허용
```

## 2. 프로젝트 만들기 — ✅ 완료: ID `soccerdaddy-blog`, 기본 주소 https://soccerdaddy-blog.web.app

```bash
npx firebase-tools projects:create soccerdaddy-blog --display-name "Soccer Daddy"   # 표시 이름은 영문만 가능
```

- **"already exists" 오류**가 나면 이름이 이미 쓰이는 것입니다. 뒤에 숫자를 붙여 다시 만드세요. 예: `soccerdaddy-blog-2611`
- 만든 뒤 실제 ID 를 확인합니다.

```bash
npx firebase-tools projects:list           # 표에서 사커대디의 Project ID 확인
npx firebase-tools use --add               # 방금 만든 프로젝트 선택 → 별칭은 default 입력
```

`npx firebase-tools use --add` 를 하면 `.firebaserc` 에 실제 프로젝트 ID 가 default 로 기록됩니다.
Firebase 콘솔(https://console.firebase.google.com) → Soccer Daddy → Hosting → **시작하기**를 한 번 눌러 Hosting 을 켜 주세요.
(정적 블로그는 무료 Spark 요금제로 충분합니다. 결제 카드 등록은 필요 없습니다.)

## 3. 첫 배포 — ✅ 완료 (11/25): https://soccerdaddy-blog.web.app

```bash
npm run deploy
```

끝나면 `https://<프로젝트ID>.web.app` 주소가 나옵니다. 이때부터 블로그가 인터넷에 공개됩니다.

## 4. 자동 배포 (예약 글이 매일 9시·19시에 열리도록)

예약 글은 "배포할 때" 공개 시각이 지난 글만 포함됩니다. 그래서 GitHub 가 하루 두 번 다시 배포하도록 키를 등록합니다.

1. Firebase 콘솔 → ⚙️ 프로젝트 설정 → **서비스 계정** 탭 → **새 비공개 키 생성** → JSON 파일이 다운로드됩니다.
2. 터미널에서 (파일 이름과 프로젝트 ID 를 바꿔서):

```bash
gh secret set FIREBASE_SERVICE_ACCOUNT < ~/Downloads/<받은 파일>.json --repo byungsooim-collab/soccerdaddy
gh variable set FIREBASE_PROJECT_ID --body <프로젝트ID> --repo byungsooim-collab/soccerdaddy
rm ~/Downloads/<받은 파일>.json   # 키 파일은 등록 후 꼭 지우기
```

등록 후 GitHub 저장소 → Actions → "Firebase 배포" → **Run workflow** 로 한 번 돌려 초록불인지 확인합니다.

## 5. 도메인 연결 (도메인 구매 후)

1. Firebase 콘솔 → Hosting → **커스텀 도메인 추가** → 산 도메인 입력 (예: `soccerdaddy.kr`, `www.soccerdaddy.kr` 둘 다).
2. 화면에 나오는 **TXT 레코드**(소유 확인)와 **A 레코드**를 도메인 산 곳(가비아·후이즈·Cloudflare 등)의 DNS 설정에 그대로 추가합니다.
3. 확인과 인증서(https) 발급까지 몇 분 ~ 24시간 걸립니다. 콘솔에 "연결됨"이 뜨면 끝.
4. Claude 에게 도메인을 알려 주면 `blog.config.json` 의 `siteUrl` 을 바꾸고 다시 배포합니다 (검색·공유 미리보기 주소가 이 값으로 만들어집니다).

## 마무리 체크

- `.firebaserc` 가 실제 ID 로 바뀌었으면 Claude 에게 커밋·푸시를 맡기세요.
- 이후 글은 `posts/` 에 넣고 푸시만 하면 자동으로 공개됩니다.
