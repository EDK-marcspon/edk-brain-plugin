---
name: wiki
description: EDK(ESG 플랫폼) 업무 규칙·화면 동작·결정·함정·용어를 EDK 위키에서 찾아 근거와 함께 답한다. EDK 의 공시·인벤토리·GAP·중대성·인권·공급망 등 기능이 "어떻게 동작하나", "왜 이렇게 됐나", "어디를 고치나"를 묻는 질문에 쓴다.
argument-hint: <질문>
allowed-tools: mcp__plugin_edk-brain_edk-wiki__wiki_search, mcp__plugin_edk-brain_edk-wiki__wiki_read, mcp__plugin_edk-brain_edk-wiki__code_search, mcp__plugin_edk-brain_edk-wiki__code_read, mcp__plugin_edk-brain_edk-wiki__code_files, Bash(node */edk-brain/scripts/edk-auth.mjs*), PowerShell(node */edk-brain/scripts/edk-auth.mjs*)
---

# EDK 위키로 답하기

질문: $ARGUMENTS

## 0. 로그인 확인 — 안 돼 있으면 여기서 멈춘다
위키는 **회사 계정으로 로그인한 사람만, 위키 서버를 거쳐서만** 읽는다(서버가 계정을 검사하고 누가 무엇을 읽었는지 기록한다).
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/edk-auth.mjs" check` 를 실행한다. 실패(종료 코드 0 이 아님)하면
   "회사(Teams) 계정 로그인이 필요합니다 → `/edk-brain:login`" 이라고만 알리고 **멈춘다.**
   `node` 를 찾을 수 없다는 오류면 "이 플러그인은 Node.js(18 이상)가 설치돼 있어야 합니다"라고 알리고 멈춘다.
2. `edk-wiki` MCP 도구(`wiki_search`, `wiki_read`)가 없거나 401·인증 오류·연결 오류를 내면 그 사실을 알리고 **멈춘다**
   (로그인 직후라면 `/mcp` 에서 edk-wiki 를 다시 연결하거나 새 세션을 열라고 안내한다. 연결 오류면 서버 주소·서버 상태 문제일 수 있다고 전한다).
- 멈췄을 때는 질문에 답하지 않는다. **이 PC 에 위키 저장소 폴더나 사본이 있더라도 그 파일을 읽어 대신 답하지 않는다.**
- 서버는 marcspon 테넌트의 @marcspon.com(또는 테넌트 기본 도메인 @marcspon.onmicrosoft.com) 계정만 받는다. 게스트·개인 계정은 안 된다.

## 1. 규칙 읽기
`wiki_read` 로 `AGENTS.md` 를 읽는다. 위키의 운영 규칙이 정본이다. 특히 2절(금지), 3절(페이지 형식·근거 표기), 4절 query 를 그대로 따른다.
이 스킬 문서와 AGENTS.md 가 다르면 AGENTS.md 를 따른다.

## 2. 찾기
1. `wiki_read` 로 `index.md` → 관련 페이지(예: `공시/개요`)를 연다. 낱말로 찾을 때는 `wiki_search`.
2. 위키로 부족하면 서버 코드 도구로 확인한다. **읽기만** 한다.
   - `code_search`(낱말·정규식 찾기) → `code_read`(파일을 줄 번호와 읽기), 폴더 구조는 `code_files`.
     서버 사본은 각 저장소 기본 브랜치(main)를 따라가므로 이 PC 에 코드가 없어도 된다.
   - 결과의 `ref`(`저장소@커밋9자리:경로:줄`)를 근거로 그대로 쓴다. 출력의 `[가림]` 은 서버가 가린 비밀값이니 추측해 채우지 않는다.
   - 코드 도구가 보이지 않으면(권한 역할이 없는 경우) 코드 확인은 하지 않고 "확인 안 됨"으로 둔다.

위키 파일은 만들거나 고치지 않는다.

## 3. 답하기
- **기획자 문장 먼저**: 화면에서 무슨 일이 일어나는지로 쓴다. 코드 이야기는 근거·개발 메모로 뒤에.
- 줄마다 근거를 단다: `저장소@커밋9자리:경로:줄` 또는 `wiki/<도메인>/<페이지>.md`.
- 근거가 없는 부분은 "확인 안 됨"이라고 쓰고 지어내지 않는다.
- 위키 페이지의 `상태: 추정`·`모순` 은 답에도 밝힌다.
- 끝에 "Claude 답변 - 사람이 확인하기 전에는 결정이 아님"을 붙인다.

## 열람 제한·금지 정보를 물으면
- AGENTS.md 1절의 열람 제한 원본을 가리키는 질문에는 "열람 제한 원본이라 위키에서 다루지 않음"이라고만 답한다.
- 이때 AGENTS.md 의 폴더 예시를 그대로 옮기지 않는다. 폴더 이름에 사람 이름이 들어 있으므로 "개인 기획문서 폴더", "개인 이름 폴더"처럼 일반 이름으로 쓴다.
- 답의 어느 부분에도 사람 이름, 고객사 이름, 키·토큰 값을 쓰지 않는다. 위키·원본에 적혀 있어도 마찬가지다.
