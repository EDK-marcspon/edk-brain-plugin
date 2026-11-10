#!/usr/bin/env node
// PreToolUse 훅: 회사 계정으로 로그인하지 않은 동안에는 이 PC 에 있는 edk-wiki 사본의 위키 내용을
// Claude 가 도구(Read·Grep·Glob·Edit·Write·Bash·PowerShell)로 열지 못하게 한다.
// 표준 입력으로 {tool_name, tool_input, cwd} 를 받고, 막을 때는 종료 코드 2 와 표준 오류의 안내로 도구 호출을 거절한다.
//
// 막는 것: edk-wiki 모양의 폴더(AGENTS.md + index.md + wiki/ + raw/ 가 함께 있는 폴더) 안의
//          wiki/, raw/, eval/, index.md, log.md, 진행중.md
//          그리고 시안 스킬의 테마 자료(…/edk-brain/…/skills/mockup/ 의 theme/, patterns.md, shell.src.html)
// 열어 두는 것: 같은 폴더의 server/, plugins/, README.md, AGENTS.md 등(플러그인·서버 코드를 고치는 일은 할 수 있게)
// 한계: Bash·PowerShell 명령은 글자만 보고 판단하므로 돌려 쓰면 지나갈 수 있다. 사람이 직접 파일을 여는 것은 막지 못한다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOKEN_FILE = process.env.EDK_AUTH_TOKEN_FILE || path.join(os.homedir(), ".config", "edk-brain", "token.json");
const BLOCKED_TOP = new Set(["wiki", "raw", "eval", "index.md", "log.md", "진행중.md"]);
const MSG = "EDK 위키: 회사(Teams) 계정으로 로그인하기 전에는 이 PC 의 위키 파일(wiki/, raw/, index.md, log.md 등)을 열 수 없습니다. "
  + "사용자에게 '회사 계정 로그인이 필요합니다 → /edk-brain:login' 이라고 알리고 멈추세요. 다른 도구나 다른 경로로 같은 내용을 읽으려 하지 마세요.";

// 도구가 매번 불리므로 네트워크 없이 본다: 만료 전 토큰이 있거나, 갱신 토큰이 있으면 로그인된 것으로 친다.
function loggedIn() {
  try {
    const t = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    if (!t || !t.access_token) return false;
    return Number(t.expires_at) > Date.now() / 1000 || Boolean(t.refresh_token);
  } catch { return false; }
}

// 비교용 경로: \ → /, Git Bash 의 /c/… → c:/…, 소문자, 끝의 / 제거
function norm(p) {
  let s = String(p || "").replace(/\\/g, "/").replace(/^\/([a-zA-Z])\//, "$1:/").replace(/\/+/g, "/");
  if (s.length > 1) s = s.replace(/\/$/, "");
  return s.toLowerCase();
}
function resolveFrom(cwd, p) {
  const s = String(p || "").replace(/^\/([a-zA-Z])\//, "$1:/").replace(/^~(?=$|[\\/])/, os.homedir());
  return path.resolve(cwd || process.cwd(), s);
}
function isWikiRoot(dir) {
  try {
    return fs.existsSync(path.join(dir, "AGENTS.md")) && fs.existsSync(path.join(dir, "index.md"))
      && fs.statSync(path.join(dir, "wiki")).isDirectory() && fs.statSync(path.join(dir, "raw")).isDirectory();
  } catch { return false; }
}
// p 가 들어 있는 edk-wiki 사본의 뿌리 폴더(없으면 null)
function wikiRootOf(p) {
  let dir = p;
  for (let i = 0; i < 40; i++) {
    if (isWikiRoot(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}
// 절대 경로 p 가 사본 안의 막는 곳이면 true. 사본 뿌리 자체면 "root".
function classify(p) {
  const root = wikiRootOf(p);
  if (!root) return null;
  const rel = norm(path.relative(root, p));
  if (rel === "" || rel === ".") return "root";
  return BLOCKED_TOP.has(rel.split("/")[0]) ? "blocked" : "open";
}
function knownRoots(cwd) {
  const out = [];
  const add = (d) => { if (d && isWikiRoot(d) && !out.includes(d)) out.push(d); };
  add(wikiRootOf(cwd || process.cwd()));
  add(process.env.EDK_WIKI_DIR || path.join(os.homedir(), ".edk-wiki"));
  add(path.join(os.homedir(), ".claude", "plugins", "marketplaces", "edk-wiki"));
  return out;
}
// 시안 스킬의 테마 자료(회사 프론트 코드에서 뽑은 토큰·컴포넌트 클래스)도 로그인 전에는 열지 못한다.
// 설치된 플러그인 캐시든 저장소 사본이든 `…/edk-brain/…/skills/mockup/` 아래의 theme/, patterns.md, shell.src.html 이 대상이다.
const THEME_FILE = /\/edk-brain\/(?:[^/]+\/)*skills\/mockup\/(?:theme(?:\/|$)|patterns\.md$|shell\.src\.html$)/;
const THEME_DIR = /\/edk-brain\/(?:[^/]+\/)*skills\/mockup(?:\/|$)/;
function isThemePath(p) { return THEME_FILE.test(norm(p)); }

// 글롭 무늬에서 * ? [ { 가 나오기 전까지의 글자 그대로인 앞부분
function literalPrefix(pattern) {
  const segs = String(pattern || "").replace(/\\/g, "/").split("/");
  const keep = [];
  for (const s of segs) { if (/[*?\[{]/.test(s)) break; keep.push(s); }
  return keep.join("/");
}
// 찾기 도구(Grep·Glob): 찾는 뿌리가 막는 곳이거나, 사본 뿌리·그 위 폴더라서 위키까지 훑게 되면 막는다.
function searchDenied(cwd, base, pattern) {
  const prefix = literalPrefix(pattern);
  const start = resolveFrom(base ? resolveFrom(cwd, base) : cwd, prefix || ".");
  if (THEME_DIR.test(norm(start))) return true;
  const c = classify(start);
  if (c === "blocked" || c === "root") return true;
  if (c === "open") return false;
  const s = norm(start) + "/";
  return knownRoots(cwd).some((r) => (norm(r) + "/").startsWith(s)); // 사본을 품은 위 폴더에서 훑기
}
function commandDenied(cwd, cmd) {
  const text = norm(cmd).replace(/["'`]/g, " ");
  if (/skills\/mockup\/(theme|patterns\.md|shell\.src\.html)/.test(text)) return true;
  for (const r of knownRoots(cwd)) {
    const nr = norm(r);
    // 같은 폴더를 가리키는 여러 표기: c:/…, Git Bash 의 /c/…, ~/…, $HOME/…
    const forms = new Set([nr, nr.replace(/^([a-z]):/, "/$1")]);
    const home = norm(os.homedir());
    if (nr.startsWith(home + "/")) for (const h of ["~", "$home", "${home}", "$env:userprofile", "%userprofile%"]) forms.add(h + nr.slice(home.length));
    for (const form of forms) for (const top of BLOCKED_TOP) if (text.includes(`${form}/${top}`)) return true;
  }
  const here = classify(resolveFrom(cwd, "."));
  if (here === "blocked") return true;
  if (here === "root") {
    // 사본 뿌리에서 도는 명령: 상대 경로로 위키 내용을 가리키면 막는다(skills/wiki 처럼 더 긴 경로의 일부는 제외)
    if (/(^|[\s=(:,;|&<>]|\.\/)(wiki|raw|eval)(\/|\s|$)/.test(text)) return true;
    if (/(^|[\s=(:,;|&<>]|\.\/)(index\.md|log\.md|진행중\.md)(\s|$|[;|&)>])/.test(text)) return true;
  }
  return false;
}

function main() {
  if (loggedIn()) return 0;
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { return 0; }
  const tool = input.tool_name || "";
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  let deny = false;
  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path || ti.notebook_path;
    if (p) deny = classify(resolveFrom(cwd, p)) === "blocked" || isThemePath(resolveFrom(cwd, p));
  } else if (tool === "Grep") {
    deny = searchDenied(cwd, ti.path, ti.glob);
  } else if (tool === "Glob") {
    deny = searchDenied(cwd, ti.path, ti.pattern);
  } else if (tool === "Bash" || tool === "PowerShell") {
    deny = commandDenied(cwd, ti.command || "");
  }
  if (!deny) return 0;
  process.stderr.write(MSG + "\n");
  return 2;
}
process.exitCode = main();
