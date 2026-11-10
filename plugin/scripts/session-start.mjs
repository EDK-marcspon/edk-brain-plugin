#!/usr/bin/env node
// SessionStart 훅: 세션을 열 때 Claude 에게 EDK 위키를 어떻게 쓰는지(또는 로그인 전이라 쓰지 않는지) 알린다.
// 셸에 기대지 않도록 Node 로만 쓴다(윈도우·맥 어디서나 `node` 만 있으면 돈다). 네트워크는 쓰지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOKEN_FILE = process.env.EDK_AUTH_TOKEN_FILE || path.join(os.homedir(), ".config", "edk-brain", "token.json");

function loggedIn() {
  try {
    const t = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    if (!t || !t.access_token) return false;
    return Number(t.expires_at) > Date.now() / 1000 || Boolean(t.refresh_token);
  } catch { return false; }
}

if (loggedIn()) {
  console.log("EDK 위키: 회사 계정으로 로그인돼 있다. EDK 업무 규칙·결정·함정 질문은 edk-brain:wiki 스킬로, 화면 시안 요청은 edk-brain:mockup 스킬로 처리한다. 둘 다 위키 서버 도구(edk-wiki)로만 내용을 읽는다.");
} else {
  console.log("EDK 위키: 회사(Teams) 계정 로그인이 안 돼 있다. 로그인 전에는 이 플러그인으로 위키를 쓰지 않는다 - 위키 질문 답변과 화면 시안 모두 하지 않는다.");
  console.log("이 PC 에 EDK 위키 저장소 폴더나 사본이 있더라도 그 파일을 읽어 EDK 위키 질문에 답하지 않는다. EDK 위키가 필요한 요청이 오면 '회사 계정 로그인이 필요합니다 → /edk-brain:login' 이라고만 안내한다.");
}
