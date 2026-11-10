# edk-brain — EDK 위키 Claude Code 플러그인

EDK(ESG 플랫폼) 팀의 위키를 각자의 Claude 에서 쓰게 해 주는 플러그인이다.
**누구나 내려받을 수 있지만, 쓰려면 회사(Teams) 계정으로 로그인해야 한다.** 위키 내용과 코드는 플러그인에 들어 있지 않고
사내 위키 서버에 있으며, 서버는 회사 계정으로 로그인한 사람에게만 답한다.

## 필요한 것

- Claude Code (터미널) 또는 Claude 데스크톱 앱의 Code 탭
- **Node.js 18 이상** — 로그인 도우미가 Node 로 돈다. 터미널에서 `node -v` 로 확인하고, 없으면 https://nodejs.org 에서 LTS 를 설치한다
- 회사 Microsoft 계정(`@marcspon.com`). 외부 초대 계정(게스트)과 개인 계정은 서버가 거절한다
- GitHub 계정이나 git 은 **필요 없다**

## 설치

쓰는 환경에 맞는 방법 하나를 고른다. 어느 방법이든 같은 플러그인이다.

### 회사 Claude 조직에 속한 사람 — 데스크톱 앱에서 검색

Claude 데스크톱 앱의 Code 탭에서 입력란 옆 **＋** → **Add plugins**(또는 Plugins → Browse plugins)를 열고 `edk-brain` 을 찾아 설치한다.
회사 조직 라이브러리에 올라가 있어서 조직 계정으로 로그인한 사람에게만 보인다.

### 그 밖의 사람 — 명령 한 줄

데스크톱 앱의 검색에는 나오지 않는다(공식 목록이나 조직 라이브러리에 있는 것만 검색된다). 아래 명령으로 설치한다. git 이나 GitHub 계정은 필요 없다.

**윈도우에 데스크톱 앱만 있는 경우** — PowerShell 에 통째로 붙여 넣는다(앱 안에 든 Claude Code 실행 파일을 찾아 쓴다):

```
$c = Get-ChildItem "$env:LOCALAPPDATA\Claude-Data\*\claude-code\*\*\claude.exe","$env:APPDATA\Claude\claude-code\*\claude.exe","$env:LOCALAPPDATA\Claude\claude-code\*\claude.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; & $c.FullName plugin install edk-brain --marketplace https://raw.githubusercontent.com/EDK-marcspon/edk-brain-plugin/main/.claude-plugin/marketplace.json
```

**터미널용 Claude Code 가 있는 경우**(윈도우·맥):

```
claude plugin install edk-brain --marketplace https://raw.githubusercontent.com/EDK-marcspon/edk-brain-plugin/main/.claude-plugin/marketplace.json
```

Claude Code 세션 안에서는:

```
/plugin install edk-brain --marketplace https://raw.githubusercontent.com/EDK-marcspon/edk-brain-plugin/main/.claude-plugin/marketplace.json
```

설치한 뒤 세션을 새로 연다.

## 처음 한 번: 로그인

```
/edk-brain:login
```

브라우저가 열리면 회사(Teams) 계정으로 로그인한다. 끝나면 세션을 새로 열거나 `/mcp` 에서 `edk-wiki` 를 다시 연결한다.
토큰은 이 PC 의 `~/.config/edk-brain/token.json` 에만 저장되고, 만료 전에 조용히 갱신된다. 비밀번호는 저장하지 않는다.

## 쓰는 법

| 호출 | 하는 일 |
| --- | --- |
| `/edk-brain:wiki <질문>` | 위키에서 업무 규칙·결정·함정을 찾아 **기획자 문장 + 근거**로 답한다. 위키로 부족하면 서버의 코드 사본(main)으로 확인한다 |
| `/edk-brain:mockup <화면 설명>` | V3 고객사 화면과 같은 테마로 **화면 시안**(브라우저에서 열리는 HTML 한 파일)을 만든다. 운영 코드를 만들지 않는다 |
| `/edk-brain:login [status\|logout\|--device]` | 로그인 / 상태 확인 / 로그아웃 |

`wiki` 와 `mockup` 은 질문 내용에 맞으면 Claude 가 알아서 꺼내 쓴다.

## 로그인하지 않으면

- 위키 질문과 화면 시안 모두 "회사 계정 로그인이 필요합니다"에서 멈춘다.
- 화면 시안의 테마(색·글자·컴포넌트 모양)도 플러그인에 들어 있지 않다. 서버가 로그인한 사람에게만 내려 준다.
- 이 PC 에 EDK 위키 저장소 폴더가 있는 경우(개발자), 로그인 전에는 Claude 가 그 폴더의 위키 파일을 열지 못하게 훅이 막는다.

## 새 버전 받기

직접 추가한 마켓플레이스는 자동으로 갱신되지 않는다.

```
claude plugin marketplace update edk
claude plugin update edk-brain@edk
```

자동으로 받으려면 세션에서 `/plugin` → Marketplaces → `edk` → Enable auto-update.

## 안 될 때

| 증상 | 확인 |
| --- | --- |
| `node` 를 찾을 수 없다 | Node.js 18 이상을 설치하고 터미널·앱을 다시 연다 |
| 로그인 창에 오류(AADSTS…) | 회사 계정인지 확인한다. 게스트·개인 계정은 안 된다. 계속되면 관리자에게 화면의 오류 번호를 전한다 |
| 로그인했는데 위키 도구가 없다 | 세션을 새로 열거나 `/mcp` 에서 `edk-wiki` 를 다시 연결한다. `/edk-brain:login status` 로 로그인 상태를 본다 |
| `edk-wiki` 연결 오류 | 위키 서버가 꺼져 있거나 주소가 바뀐 경우다. 관리자에게 알린다 |

## 들어 있는 것 / 들어 있지 않은 것

- 들어 있는 것: 스킬 세 개(`wiki`, `mockup`, `login`), 로그인 도우미(`scripts/edk-auth.mjs`), 세션 시작·도구 호출 전 훅, 서버 주소(`.mcp.json`), 로그인 설정(`auth.config.json` - 회사 테넌트·앱 번호. 비밀값이 아니다)
- 들어 있지 않은 것: 위키 내용, 코드, 화면 테마, 비밀번호·키·토큰
- 위키 저장소에 인계 메모를 올리거나 위키를 정리(ingest)하는 기능은 저장소 권한이 있는 개발·정리 담당용이라 여기에 없다

## 이 저장소의 구성 (관리자용)

- `plugin/` — 플러그인 원본
- `dist/edk-brain-<버전>.zip` — 배포 파일. `plugin/` 을 압축한 것
- `.claude-plugin/marketplace.json` — 배포 목록. 배포 파일의 주소와 sha256 을 적는다
- **배포하는 곳이 두 군데다.** 이 저장소(누구나, 명령으로 설치)와 회사 Claude 조직 라이브러리(조직에 속한 사람, 데스크톱 앱에서 검색해 설치). 내용은 같은 `plugin/` 폴더다
- 새 버전을 낼 때는 **두 곳 모두** 갱신한다. 한쪽만 올리면 다른 쪽에 옛 버전이 남는다
  1. `plugin/.claude-plugin/plugin.json` 의 `version` 을 올린다. 버전을 올리지 않으면 사용자에게 전달되지 않는다
  2. 새 zip 을 `dist/` 에 추가하고, `marketplace.json` 의 `url`·`sha256` 을 새 파일로 바꿔 이 저장소에 올린다
  3. 같은 `plugin/` 폴더를 조직 라이브러리에 다시 게시한다(같은 이름의 게시본을 새 버전으로 바꾼다). 조직 라이브러리의 게시본은 claude.ai 관리자 설정 → 플러그인 및 Skills → 인벤토리에서 확인·삭제한다
