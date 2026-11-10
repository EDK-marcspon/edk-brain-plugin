---
name: login
description: EDK 위키 서버에 회사(Teams, Microsoft Entra ID - marcspon 테넌트) 계정으로 로그인·로그아웃·상태 확인을 한다. edk-wiki 도구가 401·로그인 필요 오류를 낼 때 쓴다.
argument-hint: "[status|logout|--device]"
allowed-tools: Bash(node */edk-brain/scripts/edk-auth.mjs*), PowerShell(node */edk-brain/scripts/edk-auth.mjs*)
---

# EDK 위키 로그인

인자: $ARGUMENTS

- 인자가 `status` 면 `node "${CLAUDE_PLUGIN_ROOT}/scripts/edk-auth.mjs" status` 를 실행해 결과를 그대로 전한다.
- 인자가 `logout` 이면 `node "${CLAUDE_PLUGIN_ROOT}/scripts/edk-auth.mjs" logout` 을 실행한다.
- 그 밖(빈 인자 포함)이면 로그인한다:
  1. 사용자에게 "브라우저가 열리면 회사(Teams) 계정(@marcspon.com)으로 로그인하세요"라고 먼저 알린다.
  2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/edk-auth.mjs" login` 을 실행한다(인자에 `--device` 가 있으면 붙인다 - 브라우저를 못 여는 환경용, 화면의 코드를 다른 기기에서 입력).
     로그인을 기다리므로 타임아웃을 6분으로 둔다.
  3. 끝나면 "`/mcp` 에서 edk-wiki 를 다시 연결하거나 새 세션을 여세요"라고 안내한다.

비밀번호를 묻거나 받지 않는다. 토큰은 `~/.config/edk-brain/token.json`(권한 600)에만 저장되며, 내용을 출력하지 않는다.
설정이 비었다는 오류가 나면 `auth.config.json` 을 관리자가 채워야 한다고 전한다.
