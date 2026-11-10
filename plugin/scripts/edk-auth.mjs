#!/usr/bin/env node
// EDK 위키 서버용 Microsoft Entra ID(marcspon 테넌트) 로그인 도우미. 외부 패키지 없이 Node 18+ 로 돈다.
//
//   node edk-auth.mjs login [--device]   브라우저로 회사 계정 로그인(PKCE). --device 는 코드 입력 방식
//   node edk-auth.mjs header             Claude Code headersHelper 용: {"Authorization":"Bearer …"} 출력(필요하면 조용히 갱신)
//   node edk-auth.mjs status | logout
//   node edk-auth.mjs check               로그인돼 있으면 종료 코드 0, 아니면 3 (다른 스크립트가 위키를 열기 전에 확인)
//
// 설정: ../auth.config.json 또는 환경 변수 EDK_ENTRA_TENANT_ID, EDK_ENTRA_CLIENT_ID, EDK_ENTRA_SCOPE, EDK_AUTH_PORT
// 토큰 보관: ~/.config/edk-brain/token.json (권한 600). 비밀번호는 저장하지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = process.env.EDK_AUTH_TOKEN_FILE || path.join(os.homedir(), ".config", "edk-brain", "token.json");

function loadSettings() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(here, "..", "auth.config.json"), "utf8")); } catch { /* 없음 */ }
  const s = {
    tenantId: process.env.EDK_ENTRA_TENANT_ID || file.tenantId,
    clientId: process.env.EDK_ENTRA_CLIENT_ID || file.clientId,
    scope: process.env.EDK_ENTRA_SCOPE || file.scope,
    port: Number(process.env.EDK_AUTH_PORT || file.callbackPort || 53682),
  };
  const missing = Object.entries(s).filter(([, v]) => !v || String(v).includes("REPLACE")).map(([k]) => k);
  if (missing.length) throw new Error(`auth.config.json 설정이 비어 있습니다: ${missing.join(", ")} (관리자에게 문의)`);
  s.authority = `https://login.microsoftonline.com/${s.tenantId}/oauth2/v2.0`;
  s.scopes = `${s.scope} offline_access openid profile`;
  return s;
}

function readToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")); } catch { return null; }
}
function saveToken(t) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t), { mode: 0o600 });
  fs.chmodSync(TOKEN_FILE, 0o600);
}
function claimsOf(jwt) {
  try { return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")); } catch { return {}; }
}

async function tokenRequest(s, body) {
  const res = await fetch(`${s.authority}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: s.clientId, ...body }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error_description || data.error || `HTTP ${res.status}`); e.code = data.error; throw e; }
  return data;
}

function store(data, prev = {}) {
  const t = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || prev.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: claimsOf(data.access_token).preferred_username || claimsOf(data.access_token).upn || prev.user,
  };
  saveToken(t);
  return t;
}

async function validToken(s) {
  const t = readToken();
  if (!t) return null;
  if (t.expires_at - 300 > Date.now() / 1000) return t;
  if (!t.refresh_token) return null;
  try {
    return store(await tokenRequest(s, { grant_type: "refresh_token", refresh_token: t.refresh_token, scope: s.scopes }), t);
  } catch (e) {
    if (["invalid_grant", "interaction_required"].includes(e.code)) fs.rmSync(TOKEN_FILE, { force: true });
    throw e;
  }
}

function openBrowser(url) {
  // 윈도우: cmd /c start 는 주소의 & 를 명령 구분자로 읽어 첫 & 뒤(scope, state 등)를 잘라 버린다
  // (브라우저에 AADSTS900144 "scope 가 필요합니다" 가 뜬다). cmd 를 거치지 않는 rundll32 로 연다.
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "rundll32" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* 주소를 직접 연다 */ }
}

async function loginBrowser(s) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  const redirect = `http://localhost:${s.port}/callback`;
  const url = `${s.authority}/authorize?${new URLSearchParams({
    client_id: s.clientId, response_type: "code", redirect_uri: redirect, response_mode: "query",
    scope: s.scopes, code_challenge: challenge, code_challenge_method: "S256", state, prompt: "select_account",
  })}`;
  const code = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, redirect);
      if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
      const done = (msg, ok) => { res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" }).end(`<p>${msg}</p>`); srv.close(); };
      if (u.searchParams.get("state") !== state) { done("요청이 맞지 않습니다. 다시 로그인하세요.", false); reject(new Error("state 불일치")); return; }
      if (u.searchParams.get("error")) { done("로그인 실패: 창을 닫고 터미널을 확인하세요.", false); reject(new Error(u.searchParams.get("error_description") || u.searchParams.get("error"))); return; }
      done("EDK 위키 로그인 완료. 이 창을 닫아도 됩니다.", true);
      resolve(u.searchParams.get("code"));
    });
    srv.on("error", reject);
    srv.listen(s.port, "127.0.0.1", () => {
      console.error(`브라우저에서 회사(Teams) 계정으로 로그인하세요. 안 열리면 이 주소를 여세요:\n${url}\n`);
      openBrowser(url);
    });
    setTimeout(() => { srv.close(); reject(new Error("5분 안에 로그인하지 않아 멈췄습니다")); }, 5 * 60_000).unref();
  });
  return store(await tokenRequest(s, { grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier, scope: s.scopes }));
}

async function loginDevice(s) {
  const res = await fetch(`${s.authority}/devicecode`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: s.clientId, scope: s.scopes }),
  });
  const dc = await res.json();
  if (!res.ok) throw new Error(dc.error_description || dc.error);
  console.error(dc.message);
  const until = Date.now() + dc.expires_in * 1000;
  let wait = (dc.interval || 5) * 1000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, wait));
    try {
      return store(await tokenRequest(s, { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: dc.device_code }));
    } catch (e) {
      if (e.code === "authorization_pending") continue;
      if (e.code === "slow_down") { wait += 5000; continue; }
      throw e;
    }
  }
  throw new Error("코드 입력 시간이 지났습니다");
}

async function main() {
  const [cmd = "status", ...rest] = process.argv.slice(2);
  if (cmd === "header") {
    // headersHelper 는 10초 안에 JSON 을 내야 한다. 실패해도 {} 를 내 서버가 401 과 안내를 돌려주게 한다.
    try {
      const t = await validToken(loadSettings());
      if (!t) { console.error("EDK 위키: 로그인이 필요합니다 → /edk-brain:login"); console.log("{}"); return; }
      console.log(JSON.stringify({ Authorization: `Bearer ${t.access_token}` }));
    } catch (e) {
      console.error(`EDK 위키: 토큰 갱신 실패(${e.message}) → /edk-brain:login`);
      console.log("{}");
    }
    return;
  }
  if (cmd === "check") {
    // 다른 스크립트·스킬이 "회사 계정으로 로그인돼 있나"를 묻는 용도. 로그인돼 있으면 종료 코드 0, 아니면 3.
    // 토큰이 만료됐으면 여기서 갱신을 시도한다. 갱신할 수 없으면 로그인 안 된 것으로 본다.
    let t = null;
    try { t = await validToken(loadSettings()); } catch (e) { console.error(`EDK 위키: 로그인 확인 실패(${e.message})`); }
    if (!t) { console.error("EDK 위키: 회사(Teams) 계정 로그인이 필요합니다 → /edk-brain:login"); process.exitCode = 3; return; }
    console.log(`로그인됨: ${t.user}`);
    return;
  }
  if (cmd === "logout") { fs.rmSync(TOKEN_FILE, { force: true }); console.log("로그아웃했습니다(이 컴퓨터의 토큰 삭제)."); return; }
  const s = loadSettings();
  if (cmd === "login") {
    const t = rest.includes("--device") ? await loginDevice(s) : await loginBrowser(s);
    console.log(`로그인했습니다: ${t.user}. Claude Code 에서 /mcp 로 edk-wiki 를 다시 연결하거나 새 세션을 여세요.`);
    return;
  }
  if (cmd === "status") {
    const t = readToken();
    if (!t) { console.log("로그인 안 됨 → node edk-auth.mjs login"); return; }
    const left = Math.round((t.expires_at - Date.now() / 1000) / 60);
    console.log(`${t.user} - 액세스 토큰 ${left > 0 ? `${left}분 남음` : "만료(다음 사용 때 자동 갱신)"}, 갱신 토큰 ${t.refresh_token ? "있음" : "없음"}`);
    return;
  }
  console.error("사용: edk-auth.mjs login [--device] | header | status | check | logout");
  process.exitCode = 2;
}

main().catch((e) => { console.error(`오류: ${e.message}`); process.exitCode = 1; });
