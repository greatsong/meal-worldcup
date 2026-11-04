(() => {
"use strict";
/* ---------- 공용 도구 ---------- */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const store = {
  get(key) { try { return { ok: true, raw: localStorage.getItem(key) }; } catch (e) { return { ok: false, raw: null }; } },
  set(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } },
  remove(key) { try { localStorage.removeItem(key); return true; } catch (e) { return false; } }
};
function rid(n = 8) {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  let s = ""; for (let i = 0; i < n * 4; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const randomAlias = () => "연습" + ALPHA[Math.floor(Math.random() * 26)];
const roundName = n => n === 2 ? "결승" : n + "강";
function copyText(text, btn) {
  const done = () => { const o = btn.textContent; btn.textContent = "복사됨"; setTimeout(() => btn.textContent = o, 1400); };
  try {
    navigator.clipboard.writeText(text).then(done, () => fallback());
  } catch (e) { fallback(); }
  function fallback() {
    const p = btn.closest(".prompt")?.querySelector("p");
    if (!p) return;
    const r = document.createRange(); r.selectNodeContents(p);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    btn.textContent = "선택됨, 복사하세요";
    setTimeout(() => btn.textContent = "복사", 1800);
  }
}


// 복사 버튼이 붙은 코드 상자 (ds-danggok의 codewrap)
function codeCopy(label, text) {
  const b = el("button", { class: "btn small", type: "button", text: "복사" });
  const pre = el("pre", { class: "code" }, el("code", { text }));
  b.addEventListener("click", () => {
    const done = () => { b.textContent = "복사됨"; setTimeout(() => b.textContent = "복사", 1400); };
    try { navigator.clipboard.writeText(text).then(done, sel); } catch (e) { sel(); }
    function sel() { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "선택됨, 복사하세요"; }
  });
  return el("div", { class: "codewrap" }, [el("div", { class: "cw-head" }, [el("span", { text: label }), b]), pre]);
}
/* ---------- 설계 메모 (1차시 산출물, 2단계 이후의 재료) ---------- */
const EXAMPLE = {
  topic: "과일",
  question: "학교 간식으로 어떤 과일을 더 좋아할까?",
  criterion: "지금 먹고 싶은 마음으로 선택하기",
  candidates: ["사과", "배", "귤", "딸기", "포도", "복숭아", "수박", "바나나"]
};
const DESIGN_KEY = "meal_worldcup_design_demo";
let design = (() => {
  const g = store.get(DESIGN_KEY);
  if (g.ok && g.raw) { try { const d = JSON.parse(g.raw); if (d && Array.isArray(d.candidates)) return d; } catch (e) {} }
  return structuredClone(EXAMPLE);
})();
const saveDesign = () => store.set(DESIGN_KEY, JSON.stringify(design));

function validate(list) {
  const errs = [];
  const t = list.map(x => typeof x === "string" ? x.trim() : "");
  if (t.length !== 8) errs.push(`후보가 ${t.length}개입니다. 정확히 8개가 필요합니다.`);
  t.forEach((x, i) => { if (!x) errs.push(`${i + 1}번째 후보가 비어 있습니다.`); });
  const seen = new Set(), dup = new Set();
  t.filter(Boolean).forEach(x => seen.has(x) ? dup.add(x) : seen.add(x));
  dup.forEach(x => errs.push(`"${x}" 후보가 두 번 이상 들어 있습니다.`));
  return { ok: errs.length === 0, errs, clean: t };
}

/* ---------- 토너먼트 엔진 (교원 3차시 상태 변수 그대로) ---------- */
function newGame(candidates) {
  return { original: candidates, currentRound: candidates.slice(), winners: [], matchIndex: 0,
           busy: false, processed: new Set(), log: [], done: false, champion: null };
}
function choose(g, side, extra = {}) {
  if (g.done || g.busy) return false;
  const id = g.currentRound.length + "-" + g.matchIndex;
  if (g.processed.has(id)) return false;
  g.busy = true; g.processed.add(id);
  const left = g.currentRound[g.matchIndex], right = g.currentRound[g.matchIndex + 1];
  const selected = side === 1 ? right : left;
  g.winners.push(selected);
  g.log.push({ roundSize: g.currentRound.length, match: g.matchIndex / 2 + 1, left, right, selected, ...extra });
  g.matchIndex += 2;
  if (g.matchIndex >= g.currentRound.length) { g.currentRound = g.winners; g.winners = []; g.matchIndex = 0; }
  if (g.currentRound.length === 1) { g.done = true; g.champion = g.currentRound[0]; }
  return true;
}

/* ---------- 기록 저장 (교원 4차시) ---------- */
const RUNS_KEY = "meal_worldcup_v1";
const runsState = { runs: [], status: "", level: "ok", locked: false };
function loadRuns() {
  const g = store.get(RUNS_KEY);
  if (!g.ok) { runsState.runs = []; runsState.locked = true; runsState.level = "bad";
    runsState.status = "저장소를 읽을 수 없습니다(비공개 모드나 저장 차단). 기존 저장값을 보호하려고 이번 기록은 화면에만 남깁니다."; return; }
  if (g.raw === null) { runsState.runs = []; runsState.locked = false; runsState.level = "ok";
    runsState.status = "저장된 회차가 없습니다. 결승까지 마치면 이 브라우저에 한 회차가 저장됩니다."; return; }
  try {
    const v = JSON.parse(g.raw);
    const validRun = r => r && typeof r === "object"
      && ["runId", "alias", "topic", "version", "winner"].every(k => typeof r[k] === "string")
      && Array.isArray(r.choices) && r.choices.length === 7
      && r.choices.every(c => c && typeof c.selected === "string")
      && r.choices[6].selected === r.winner;
    if (!Array.isArray(v) || !v.every(validRun)) throw new Error("형식");
    runsState.runs = v; runsState.locked = false; runsState.level = "ok";
    runsState.status = `이 브라우저에 저장된 완료 회차 ${v.length}개를 복원했습니다.`;
  } catch (e) {
    runsState.runs = []; runsState.locked = true; runsState.level = "bad";
    runsState.status = "저장된 기록을 복원할 수 없습니다. 원문은 지우지 않고 그대로 두며, 새 기록도 덮어쓰지 않습니다.";
  }
}
function saveRun(run) {
  runsState.runs.push(run);
  if (runsState.locked) { runsState.level = "bad"; runsState.status = "기존 저장값을 보호하는 중이라 이번 회차는 화면에만 남깁니다. 연습 기록 지우기에 성공하면 다시 저장합니다."; return false; }
  const ok = store.set(RUNS_KEY, JSON.stringify(runsState.runs));
  runsState.level = ok ? "ok" : "bad";
  runsState.status = ok ? `완료 회차를 저장했습니다. 지금 저장된 회차는 ${runsState.runs.length}개입니다.`
                        : "저장에 실패했습니다. 이번 회차는 화면에만 남고 새로고침하면 사라집니다.";
  return ok;
}
loadRuns();

/* ---------- 모의 시트와 saveVote (교원 5~6차시 Code.gs를 브라우저 안에서 흉내) ---------- */
const SHEET_KEY = "meal_worldcup_sheet_demo";
const HEADERS = ["requestId", "alias", "topic", "winner", "receivedAt"];
let sheetLocked = false;
let sheet = (() => {
  const g = store.get(SHEET_KEY);
  if (!g.ok) { sheetLocked = true; return []; }
  if (g.raw === null) return [];
  try {
    const v = JSON.parse(g.raw);
    const validRow = r => Array.isArray(r) && r.length === 5 && r.every(x => typeof x === "string");
    if (Array.isArray(v) && v.every(validRow)) return v;
  } catch (e) {}
  sheetLocked = true;   // 손상된 원문은 덮어쓰지 않는다
  return [];
})();
const saveSheet = () => sheetLocked ? false : store.set(SHEET_KEY, JSON.stringify(sheet));
const pendingVotes = new Map();   // 확인하지 못한 요청은 단계를 옮겨도 남긴다
let sending = false, lastPendingMsg = "";
const net = { failBefore: false, loseReply: false };

function saveVoteOn(rows, p) {
  const cands = validate(design.candidates).clean;
  if (!p || typeof p !== "object" || Array.isArray(p) ||
      Object.keys(p).sort().join(",") !== "alias,requestId,topic,winner" ||
      typeof p.requestId !== "string" || typeof p.alias !== "string" ||
      typeof p.topic !== "string" || typeof p.winner !== "string" ||
      !/^[a-zA-Z0-9-]{8,64}$/.test(p.requestId) || !/^연습[A-Z]$/.test(p.alias) ||
      p.topic !== design.topic || !cands.includes(p.winner)) throw new Error("INVALID_INPUT");
  const prior = rows.find(r => r[0] === p.requestId);
  if (prior) {
    if (prior[1] !== p.alias || prior[2] !== p.topic || prior[3] !== p.winner) throw new Error("REQUEST_CONFLICT");
    return { ok: true, duplicate: true, requestId: p.requestId };
  }
  rows.push([p.requestId, p.alias, p.topic, p.winner, new Date().toISOString()]);
  return { ok: true, duplicate: false, requestId: p.requestId };
}
function callSaveVote(p) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (net.failBefore) return reject(new Error("연결 실패(모의)"));
      let res;
      try { res = saveVoteOn(sheet, p); saveSheet(); } catch (e) { return reject(e); }
      if (net.loseReply) return reject(new Error("응답 유실(모의)"));
      resolve(res);
    }, 650);
  });
}

/* ---------- 단계 정의 ---------- */
const STAGES = [
  { id: "s1", name: "치킨 월드컵 체험", tags: ["학생 1차시"],
    goal: "교사 예제로 8강부터 결승까지 직접 고르고, 선택과 이유를 함께 기록합니다. 그다음 내가 만들 월드컵의 주제와 후보 8개를 설계 메모로 남깁니다.",
    file: "급식_1차시_치킨월드컵_예제.html",
    added: ["두 항목 중 하나를 고르면 고른 항목만 다음 라운드로 올라갑니다", "8강 네 경기, 4강 두 경기, 결승 한 경기로 7번 선택하면 우승 1개가 남습니다", "경기마다 선택 이유를 짧게 적고 결과 기록표로 모아 봅니다", "설계 메모(주제, 질문, 후보 8개, 선택 기준)를 바탕으로 2단계 앱을 만듭니다"],
    prompts: [],
    checks: ["예제 HTML 실행, 다음 라운드와 다시하기 동작을 수업 전에 확인", "앱 실행이 어려우면 8강 대진표와 개인 메모로 같은 활동 진행", "주제 선택과 결과 공개는 자율이며 실명 정보는 수집하지 않음", "질문을 읽으면 무엇을 고를지 알 수 있는가", "후보 8개가 같은 기준으로 비교되는가, 겹치는 후보는 없는가", "누군가를 평가하거나 개인 정보를 묻지는 않는가"],
    code: null },
  { id: "s2", name: "한 경기 화면", tags: ["학생 2차시 전반", "교원 2차시"],
    goal: "후보 목록을 배열 한 곳에 두고, 첫 두 후보를 같은 크기의 버튼으로 보여 줍니다. 버튼을 누르면 고른 이름만 표시하고 아직 다음 경기로 넘어가지 않습니다.",
    file: "index.html  (v01, 한 경기)",
    added: ["candidates 배열 하나에서 후보 이름을 읽어 화면에 표시", "첫 두 후보 candidates[0], candidates[1]을 같은 크기의 버튼으로 표시", "누른 후보 이름을 결과 영역에 textContent로 표시", "후보가 8개가 아니거나 빈 이름, 중복 이름이 있으면 시작하지 않고 고칠 조건을 안내"],
    prompts: [
      { who: "학생", title: "첫 프롬프트", text: "주제는 [과일]이고 후보는 [8개 이름]이야.\n두 후보 중 하나를 고르는 HTML을 만들어 줘.\n키보드로도 선택하고, 선택한 이름을 보여 줘.\n외부 연결, 실명 입력 없이 한 파일로 실행하게 해 줘." },
      { who: "교원", title: "전체 입력 프롬프트", text: "빈 index.html에서 과일 월드컵의 한 경기 화면을 만들어 줘. candidates 배열은 [\"사과\", \"배\", \"귤\", \"딸기\", \"포도\", \"복숭아\", \"수박\", \"바나나\"]로 해 줘. 첫 두 후보 candidates[0], candidates[1]만 같은 크기의 실제 버튼에 표시해 줘. 버튼을 누르면 선택한 이름을 결과 영역의 textContent에 표시해 줘. 아직 다음 경기로 넘어가거나 저장하지 마. 후보 이름은 배열 한 곳에서만 바꾸도록 해 줘. 외부 연결 없이 HTML 한 파일로 만들고 배열과 화면이 연결되는 부분에 짧은 주석을 넣어 줘." },
      { who: "교원", title: "보강 프롬프트", text: "candidates 배열의 이름 앞뒤 공백을 trim한 뒤 검사해 줘. 후보가 정확히 8개가 아니거나, 빈 문자열이 있거나, 같은 이름이 두 번 있으면 경기를 시작하지 말고 어떤 조건을 고쳐야 하는지 화면에 알려 줘. 후보를 자동 추가하거나 자동 삭제하지 마." }
    ],
    checks: ["사과 버튼을 누르면 \"사과\", 배 버튼을 누르면 \"배\"가 표시된다", "배열의 사과를 청사과로 바꾸면 첫 버튼과 선택 결과도 청사과가 된다", "다른 일곱 후보는 그대로 유지된다", "후보 7개, 빈 이름, 중복 이름에서 각각 알맞은 안내가 나온다", "Tab으로 버튼이 구분되고 Enter나 Space로 선택된다", "문구가 길어도 두 버튼이 겹치지 않는다"],
    code: `// 후보는 이 배열 한 곳에서만 바꾼다
const candidates = ["사과", "배", "귤", "딸기", "포도", "복숭아", "수박", "바나나"];

// 시작 전 검사: 8개, 빈 이름 없음, 중복 없음
const ok = candidates.length === 8
  && candidates.every(x => typeof x === "string" && x.trim())
  && new Set(candidates.map(x => x.trim())).size === 8;

// 화면은 배열의 값을 읽어 표시만 한다
const firstPair = candidates.slice(0, 2);
leftBtn.textContent = firstPair[0];
rightBtn.textContent = firstPair[1];
leftBtn.onclick = () => result.textContent = firstPair[0];` },
  { id: "s3", name: "토너먼트 연결", tags: ["학생 2차시 후반", "교원 3차시"],
    goal: "고른 후보만 승자 목록에 넣고, 라운드가 끝나면 승자들이 새 후보가 됩니다. 연속 클릭을 막고 다시하기로 모든 경기 상태를 처음으로 되돌립니다.",
    file: "index.html  (v02, 토너먼트)",
    added: ["currentRound(이번 후보), winners(다음 승자), matchIndex(경기 위치) 세 상태로 진행", "라운드가 끝나면 currentRound를 winners로 바꾸고 위치를 0으로", "선택 순간 두 버튼을 잠그고 같은 경기 ID는 다시 처리하지 않음", "우승 화면과 다시하기, 교사 디버그 영역에서 상태 확인"],
    prompts: [
      { who: "학생", title: "기능 추가 요청", text: "고른 후보만 다음 라운드 목록에 넣어 줘.\n8강 네 경기가 끝나면 4강 두 경기를 보여 줘.\n결승을 고르면 우승 후보와 다시하기를 보여 줘.\n기존 주제와 후보 이름은 그대로 유지해 줘." },
      { who: "교원", title: "전체 확장 프롬프트", text: "두 후보 선택 화면에 라운드를 연결해 줘. 초기 배열은 사과, 배, 귤, 딸기, 포도, 복숭아, 수박, 바나나 순서이며 아직 무작위로 섞지 마. currentRound는 이번 라운드의 후보 배열, winners는 다음 라운드의 승자 배열, matchIndex는 이번 경기의 첫 후보 위치로 사용해 줘. 한 번 선택할 때 winners에 선택한 후보 한 개만 넣고 matchIndex를 2만큼 늘려. 이번 라운드가 끝나면 currentRound를 winners로 교체하고 winners=[]와 matchIndex=0으로 초기화해 줘. 후보가 한 개면 우승 이름과 다시하기만 보여 줘. 설명용 상태는 교사 디버그 영역에서만 확인할 수 있게 해 줘." },
      { who: "교원", title: "연속 클릭 수정 프롬프트", text: "빠른 두 번 클릭으로 한 경기가 중복 처리되지 않게 해 줘. 선택을 받는 즉시 busy=true로 하고 두 버튼을 비활성화해. 각 경기에는 round 크기와 경기 위치로 만든 matchId를 붙여 이미 처리한 matchId는 무시해 줘. 승자와 로그를 한 번 추가한 뒤 다음 경기 화면을 새로 그리고, 새 화면에서만 입력을 다시 허용해 줘. 우승 뒤 다시하기를 누르면 원본 후보 배열의 복사본으로 돌아가고 winners, matchIndex, 로그, processedMatchIds, busy를 초기화해 줘. 원본 candidates 배열은 변형하지 마." }
    ],
    checks: ["항상 왼쪽 선택: 우승 사과, 선택 7건", "항상 오른쪽 선택: 우승 바나나, 선택 7건", "8강을 마친 순간: 후보 4개, 새 라운드 위치 0", "우승 후 다시하기: 8개 후보, 선택 기록 0건", "빠른 두 번 클릭에도 한 경기는 한 번만 기록된다"],
    code: `function choose(side) {
  if (busy) return;                       // 처리 중이면 무시
  const id = currentRound.length + "-" + matchIndex;
  if (processed.has(id)) return;          // 이미 처리한 경기
  busy = true; processed.add(id);
  const pick = currentRound[matchIndex + side];
  winners.push(pick);                     // 승자 한 개만
  log.push({ roundSize: currentRound.length, match: matchIndex / 2 + 1, selected: pick });
  matchIndex += 2;
  if (matchIndex >= currentRound.length) { // 라운드 종료
    currentRound = winners; winners = []; matchIndex = 0;
  }
  render();                               // 새 화면을 그린 뒤
  requestAnimationFrame(() => busy = false); // 다시 입력 허용
}` },
  { id: "s4", name: "결과를 기록으로", tags: ["교원 4차시", "학생 3차시 준비"],
    goal: "한 회차를 회차 ID, 무작위 별명, 주제, 버전, 선택 7건, 우승으로 기록하고 이 브라우저의 localStorage에 저장합니다. 저장 위치와 범위를 화면에 알립니다.",
    file: "index.html  (v03, 브라우저 저장)",
    added: ["회차마다 runId, 무작위 별명(연습A 형식), 주제, 버전, choices, winner를 기록", "결승 전에는 winner를 null로 두고, 결승을 마칠 때 한 번만 저장", "localStorage 키 meal_worldcup_v1 하나에 JSON으로 저장하고 복원", "다시하기는 새 경기만 초기화하고 완료 목록은 보존", "연습 기록 지우기는 확인 뒤 이 앱의 키만 제거"],
    prompts: [
      { who: "교원", title: "기록 형식 프롬프트", text: "토너먼트 한 회차를 runId, 가상 별명, 주제, 버전, choices, winner로 기록해 줘. choices에는 라운드 후보 수, 경기 번호, 왼쪽, 오른쪽 후보, 선택 후보를 넣어. 결승을 마치기 전 winner는 null로 두고, 결승 종료 시 최종 결과를 한 번만 기록해. 실명, 학번, 이메일, IP 수집 코드, 건강정보는 넣지 마. 화면 표는 textContent로 안전하게 표시해 줘." },
      { who: "교원", title: "브라우저 저장 프롬프트", text: "완료한 회차 목록을 localStorage의 meal_worldcup_v1 키 하나에 JSON.stringify로 저장해 줘. 앱 시작 때 getItem으로 읽고 JSON.parse로 복원하되 저장 접근 실패와 잘못된 JSON을 try/catch로 처리해 화면에 안내해 줘. 오류가 나면 기존 값을 자동 삭제하거나 새 빈 목록으로 덮어쓰지 마. \"연습 기록 지우기\"는 확인 후 removeItem(\"meal_worldcup_v1\")만 실행하고 localStorage.clear()는 사용하지 마. 화면에 저장 위치, 외부 전송 없음, 공용 기기에서 다른 사용자에게 보일 수 있다는 안내를 넣어 줘." }
    ],
    checks: ["완료 후 새로고침: 저장 허용 환경에서 완료 기록이 복원된다", "다른 브라우저로 열기: 기록이 자동 공유되지 않는다", "다시하기 한 번: 새 경기는 0건, 완료 목록은 보존된다", "연습 기록 지우기: 확인 뒤 이 앱의 기록만 제거된다", "7번 선택한 경로가 빠짐없이 기록되고 우승이 마지막 선택과 같다", "실명, 학번, 건강정보 입력 칸이 없다"],
    code: `// 결승을 마칠 때 한 번만
const run = { runId, alias, topic: "과일", version: "v01", choices, winner };
runs.push(run);
localStorage.setItem("meal_worldcup_v1", JSON.stringify(runs));

// 앱 시작 때 복원
try {
  const raw = localStorage.getItem("meal_worldcup_v1");
  runs = raw === null ? [] : JSON.parse(raw);
} catch (e) {
  showNotice("복원할 수 없음");  // 원문은 지우지 않는다
}` },
  { id: "s5", name: "친구들과 데이터 모으기", tags: ["학생 3차시", "교원 5~6차시"],
    goal: "완료한 회차 한 건을 시트의 한 행으로 보냅니다. 같은 요청 ID로 재시도하면 행이 늘지 않고, 실패와 중복을 구분해 안내합니다. 이 페이지의 시트는 브라우저 안의 모의 시트입니다.",
    file: "Index.html + Code.gs  (v04, 시트 연동 모의)",
    added: ["완료 회차를 {requestId, alias, topic, winner} 한 객체로 묶어 전송", "전송 중 버튼 잠금, 응답을 받은 뒤에만 결과 표시", "서버(saveVote)는 허용한 값만 받고 같은 requestId는 다시 저장하지 않음", "실패하면 같은 요청 ID로 재시도", "한 행이 한 응답인지, 빈칸과 중복이 없는지 자료 점검"],
    prompts: [
      { who: "교원", title: "Apps Script 작성 요청", text: "아래 열 구조를 가진 교원 가상 실습용 Apps Script를 작성해 줘. 탭 이름은 results, 1행 머리글은 requestId, alias, topic, winner, receivedAt이야. 시트 식별자는 REPLACE_WITH_APPROVED_TEST_SHEET_ID라는 자리표시자로 남겨 줘. 원자료 목록을 외부에 돌려주는 함수는 만들지 마." }
    ],
    checks: ["새 ID, 연습A, 사과: 새 행 1개, duplicate=false", "같은 ID와 같은 값: 새 행 0개, duplicate=true", "같은 ID, 우승만 변경: REQUEST_CONFLICT, 새 행 0개", "새 ID, 연습B, 배: 새 행 1개, 기존 값 유지", "앱의 우승 후보와 시트의 우승 후보가 일치한다", "전송 성공 메시지만 보고 저장 성공으로 단정하지 않고 시트를 확인한다", "연동이 막히면 종이 기록표나 가상 표로 같은 검증을 한다"],
    code: `// Code.gs (요약)
function saveVote(p) {
  if (!허용한_키와_형식(p)) throw new Error("INVALID_INPUT");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("BUSY_RETRY_SAME_ID");
  try {
    const prior = rows.find(r => r[0] === p.requestId);
    if (prior) {
      if (내용이_다르면) throw new Error("REQUEST_CONFLICT");
      return { ok: true, duplicate: true, requestId: p.requestId };
    }
    sheet.appendRow([p.requestId, p.alias, p.topic, p.winner, new Date().toISOString()]);
    return { ok: true, duplicate: false, requestId: p.requestId };
  } finally { lock.releaseLock(); }
}

// Index.html: 실패해도 pending을 보존해 같은 requestId로 재시도
google.script.run
  .withSuccessHandler(showSaved)
  .withFailureHandler(keepPendingAndRetry)
  .saveVote(pending);` },
  { id: "s6", name: "모은 데이터 분석", tags: ["학생 4차시", "교원 7차시"],
    goal: "같은 주제, 같은 규칙의 기록만 묶어 후보별 우승 횟수와 비율을 표와 막대그래프로 나타냅니다. 막대 합계를 원본 건수와 대조하고, 관찰, 해석, 한계를 나누어 작성합니다.",
    file: "분석 시트  (v05, 집계와 그래프)",
    added: ["후보별 우승 횟수와 비율 집계, 합계를 원본 건수와 대조", "세로 막대그래프(0부터 시작, 제목에 대상과 응답 수)", "관찰, 비교, 한계, 추가 확인 네 문장으로 해석", "유사도는 가상 별점 두 칸으로 개념만 연결"],
    prompts: [],
    checks: ["세 막대의 합이 원본 응답 수와 같다", "가로축은 후보, 세로축은 우승 횟수(건)이며 세로축은 0부터 시작한다", "그래프 제목에 대상, 기간, 응답 수가 있다", "관찰 문장은 표에서 직접 확인할 수 있다", "'학교에서 가장 인기'처럼 수집 범위 밖으로 넓히지 않는다", "개인별 결과를 전체 공개하지 않는다"],
    code: `A1 우승후보, A2:A7  사과 / 사과 / 귤 / 배 / 사과 / 귤
C1 후보, D1 우승횟수, E1 비율
D2 =COUNTIF($A$2:$A$7, C2)     → D4까지 복사
E2 =D2/COUNTA($A$2:$A$7)      → E4까지 복사, 백분율 표시
C1:D4 선택 → 삽입 → 차트 → 세로 막대그래프
제목: 가상 과일 월드컵 우승 빈도(n=6)` },
  { id: "s7", name: "급식 API 수집", tags: ["학생 5차시", "교원 8차시"],
    goal: "NEIS 급식식단정보 API에 교육청, 학교, 식사, 날짜 조건을 보내고 응답을 읽습니다. 정상, 자료 없음, 오류, 잘림을 서로 다른 상태로 기록하고, 메뉴 원문을 보존한 채 출처를 붙인 표로 정리합니다.",
    file: "급식_5차시_당곡고실데이터_API실습.html",
    added: ["요청 조건(교육청, 학교, 식사, 날짜)과 응답 항목을 나누어 표시", "INFO-000 정상, INFO-200 자료 없음, ERROR-300 필수 인자 누락, 통신 실패를 다른 상태로 안내", "조회 취소, 늦게 도착한 응답 무시", "인증키 없는 조회는 첫 5건만 온다는 잘림 표시", "메뉴 원문을 보존하고 정리 열은 따로, 조회 시각과 출처를 함께 기록"],
    prompts: [],
    checks: ["11월 1일 조회: INFO-200을 빈 자료로 처리하고 잔반 0이나 휴교로 해석하지 않는다", "필수 인자를 뺀 조회: 성공과 구분된 오류 안내가 나온다", "조회 중 취소: 취소 상태가 표시되고 늦게 온 응답이 화면을 덮지 않는다", "저장된 실데이터: 조회 시각이 보이고 최신 조회가 아님을 밝힌다", "10월 전체 인증키 없는 조회: 전체 15건 중 5건만 받았다고 표시한다", "급식인원수(MLSV_FGR)와 잔반량을 같은 값으로 사용하지 않는다", "인증키를 HTML, 발표 화면, 공개 저장소에 넣지 않는다"],
    code: `const url = "https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json"
  + "&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010073&MMEAL_SC_CODE=2"
  + \`&MLSV_FROM_YMD=\${ymd}&MLSV_TO_YMD=\${ymd}\`;

const myTurn = ++requestNo;            // 늦게 온 응답을 가려낸다
controller = new AbortController();    // 조회 취소
const data = await (await fetch(url, { signal: controller.signal })).json();
if (myTurn !== requestNo) return;      // 그사이 새 조회가 시작됨

if (data.RESULT?.CODE === "INFO-200") showEmpty();   // 자료 없음
else if (data.RESULT) showError(data.RESULT.CODE);   // ERROR-300 등
else {
  const [head, body] = data.mealServiceDietInfo;
  const total = head.head[0].list_total_count;
  const rows = body.row;                // total > rows.length 이면 잘림
}` },
  { id: "s8", name: "급식 선호도 별점 앱", tags: ["학생 6차시"],
    goal: "메뉴마다 같은 1~5점 기준으로 별점을 받고, 먹어 보지 않았거나 응답하지 않은 경우는 빈칸으로 남깁니다. 메뉴 하나에 대한 응답 하나를 한 행으로 저장하고, 메뉴별 평균 옆에 응답 수를 함께 표시합니다.",
    file: "급식_6차시_선호도조사.html",
    added: ["메뉴마다 같은 질문과 1~5점 척도, 먹어 보지 않음과 응답하지 않음은 빈칸", "제출 전에 요약을 보여 주고 한 번만 기록(중복 클릭 방지)", "한 메뉴 응답을 한 행으로 저장하는 긴 표", "미응답은 평균의 분모에서 빼고, 유효 응답이 없으면 평균을 계산하지 않음", "평균 옆에 응답 수를 함께 표시"],
    prompts: [
      { who: "학생", title: "별점 화면 요청", text: "메뉴 A, B, C 각각에 1~5점 선택칸을 만들어 줘.\n1은 전혀 좋아하지 않음, 5는 매우 좋아함이야.\n먹어 보지 않음, 응답하지 않음은 빈칸으로 남겨 줘.\n실명 없이 확인 화면을 거쳐 한 번만 기록하게 해 줘." },
      { who: "교원", title: "완전한 요청 예시", text: "단일 HTML로 메뉴 A, B, C 선호도 화면을 만들어 줘. 각 메뉴는 1~5점의 같은 척도를 사용하고 미응답은 빈칸으로 남겨 줘. 제출 전에 요약을 보여 주고 중복 클릭을 막아 줘. 지금은 로컬 가상 저장만 하고 외부 전송은 하지 마. 0, 6, 문자는 유효하지 않은 점수로 처리하고 키보드로도 조작할 수 있게 해 줘." }
    ],
    checks: ["미응답을 0점으로 바꾸지 않는다", "가상 자료에서 메뉴 A 평균 4.0점, 3건이 나온다", "유효 응답이 없는 메뉴는 평균 0점이 아니라 계산 불가로 표시한다", "중복 클릭으로 같은 응답이 두 번 생성되지 않는다", "평균만 보고 응답 1건인 메뉴가 더 낫다고 단정하지 않는다", "시트로 보낼 때는 5단계와 같이 요청 ID로 한 건만 저장되는지 확인한다"],
    code: `// 한 메뉴 응답 = 한 행 (긴 표)
rows.push({ alias: "연습01", menu: "메뉴 A", score: 4 });
rows.push({ alias: "연습01", menu: "메뉴 B", score: null }); // 빈칸

// 평균은 유효 응답만으로
const valid = rows.filter(r => r.menu === m && r.score !== null);
const avg = valid.length ? sum(valid) / valid.length : null; // null이면 계산 불가
show(\`\${m}: \${avg ?? "계산 불가"}, \${valid.length}건\`);` },
  { id: "s9", name: "비슷한 급식 입맛 찾기", tags: ["학생 7차시"],
    goal: "같은 메뉴 순서로 별점을 나열해 벡터로 만들고, 코사인 유사도로 방향을 비교합니다. 결과는 내 것만 확인하며 수치를 사람에 대한 평가로 바꾸지 않습니다.",
    file: "급식_7차시_유사도.html",
    added: ["모든 응답을 같은 메뉴 순서의 벡터로 정리", "곱의 합을 두 길이의 곱으로 나누는 코사인 계산 과정 표시", "두 사람이 모두 응답한 메뉴만 사용하고 미응답을 0점으로 바꾸지 않음", "공통 응답이 2개보다 적으면 계산하지 않음", "다른 사람의 별점과 이름은 보이지 않고 내 결과만 표시"],
    prompts: [],
    checks: ["예시에서 A와 B의 코사인 유사도는 0.9959, A와 C의 코사인 유사도는 0.5429로 나온다", "열 순서가 다른 표를 바로 비교하지 않는다", "미응답이 있으면 공통 응답 메뉴만으로 계산한다", "0.9959를 친구 관계나 건강 점수로 해석하지 않는다", "친구의 별점 전체나 순위를 공개하지 않는다", "사용한 메뉴 수와 공통 응답 수를 함께 기록한다"],
    code: `// 같은 메뉴 순서의 두 벡터 (둘 다 응답한 메뉴만)
const dot = a.reduce((s, x, i) => s + x * b[i], 0);   // 5×4 + 3×2 + 1×1 = 27
const len = v => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const cos = dot / (len(a) * len(b));                  // 27 / √735 ≈ 0.9959` },
  { id: "s10", name: "가장 많이 남길 반찬 예측", tags: ["학생 8차시", "교원 9~10차시"],
    goal: "메뉴 특성(튀김, 매운맛, 국류)을 입력으로, 규칙으로 만든 모의 잔반률을 정답으로 두고 학습 16행, 시험 4행으로 회귀 모델을 학습합니다. 시험 오차를 학습 평균만 예측하는 기준 모델의 시험 오차와 비교하고 계수를 해석합니다.",
    file: "급식_메뉴특성_회귀실습 (브라우저판)",
    added: ["실제 메뉴 원문을 보존한 채 특성 열을 만들고, 이름만으로 판단하기 어려우면 미확인", "입력 특성과 예측 대상(모의 잔반률)을 나누어 정의", "학습 자료와 시험 자료를 먼저 나누고 학습 자료로만 계수 계산", "시험 MAE를 기준 모델(학습 평균 예측)과 같은 시험 자료에서 비교", "계수를 %p 단위와 조건과 함께 해석"],
    prompts: [],
    checks: ["작은 예제: 학습 직선 10 − 2x, 시험 MAE 0.5%p, 기준 모델 2.5%p", "메뉴 특성 회귀: 절편 12, 튀김 +4, 매운맛 +3, 국류 −2", "시험 자료가 학습에 섞이지 않는다", "0.5%가 아니라 0.5%p로 읽는다", "모의 잔반과 실제 학교 결과를 구분하고 계수를 원인으로 단정하지 않는다", "API 메뉴만으로 실측 잔반 정답이 생기지 않는다"],
    code: `// 정규방정식 (XᵀX) w = Xᵀy 로 계수를 구한다. X의 첫 열은 절편용 1
const X = train.map(r => [1, r.fried, r.spicy, r.soup]);
const w = solve(XtX(X), Xty(X, train.map(r => r.y)));
const pred = r => w[0] + w[1]*r.fried + w[2]*r.spicy + w[3]*r.soup;

const mae = rows => mean(rows.map(r => Math.abs(r.y - pred(r))));
const base = mean(train.map(r => r.y));                 // 기준 모델
const baseMae = mean(test.map(r => Math.abs(r.y - base)));` },
  { id: "s11", name: "모델 검증과 한계", tags: ["학생 9차시"],
    goal: "시험 자료는 고정하고 한 번에 한 조건만 바꾸어 학습 오차와 시험 오차를 함께 기록합니다. 과적합, 증강, 편향이 결과에 어떻게 드러나는지 확인합니다.",
    file: "급식_9차시_비교실험.html",
    added: ["학습 행 수, 사용 특성, 메뉴 이름 원핫, 같은 행 복사를 조건으로 바꾸는 실험", "실행할 때마다 학습 MAE와 시험 MAE를 같은 시험 4행으로 기록", "실험 기록표에 조건 하나와 결과 두 개를 남김", "최소 최대 변환 기준을 학습 자료에서 정하는 예시"],
    prompts: [],
    checks: ["한 번에 한 조건만 바꾸고 시험 자료는 그대로 둔다", "학습 오차가 줄었는데 시험 오차가 늘면 과적합을 의심한다", "같은 행을 복사해 늘리면 계수가 바뀌지 않음을 확인한다", "증강한 자료를 독립적인 실제 응답으로 세지 않는다", "좋은 결과만 골라 남기지 않는다", "시험값을 넣어 최솟값과 최댓값을 다시 계산하지 않는다"],
    code: `// 같은 시험 4행에서 조건 하나만 바꿔 비교
run({ rows: 16, features: ["fried", "spicy", "soup"] });   // 기본
run({ rows: 8,  features: ["fried", "spicy", "soup"] });   // 자료 수만 변경
run({ rows: 16, features: ["spicy", "soup"] });            // 특성 수만 변경
run({ rows: 16, features: [...base, ...menuNameOneHot] }); // 학습은 거의 0, 시험은?

// 최소 최대 변환은 학습 자료에서 기준을 정한다
const scale = v => (v - trainMin) / (trainMax - trainMin);` },
  { id: "s12", name: "식단 개선안 설계와 발표", tags: ["학생 10차시"],
    goal: "앞 차시의 자료와 모델 기록을 근거로 사실, 해석, 제안, 먼저 확인할 것을 나누어 제안서를 씁니다. 가상값이나 모의 결과만 있으면 예비 제안으로 표시하고, 이해관계자와 동료 평가 기준으로 점검합니다.",
    file: "급식_10차시_제안서.html",
    added: ["앞 단계의 결과를 출처와 가상, 모의, 실제 여부와 함께 근거로 불러오기", "사실, 조심스러운 해석, 작은 제안, 먼저 확인 네 칸 문장 틀", "가상값이나 모의 근거를 쓰면 예비 제안으로 자동 표시", "단정 표현(반드시, 항상, 학교 전체 등) 찾기", "이해관계자 검토와 동료 평가 기준"],
    prompts: [],
    checks: ["확인한 사실에 자료, 기간, 건수가 들어 있다", "모의 결과를 학교 사실로 바꾸어 말하지 않는다", "'이 반찬이 반드시 남는다' 같은 단정을 피한다", "실제로 듣지 않은 관계자 의견을 들은 것처럼 쓰지 않는다", "특정 메뉴나 담당자를 비난하는 표현이 없다", "학교에서 시도하려면 먼저 확인할 조건을 적었다"],
    code: null }
];

/* ---------- 공용: 설계 오류 안내 ---------- */
function designGate(box) {
  const v = validate(design.candidates);
  if (v.ok) return v.clean;
  box.replaceChildren(el("div", { class: "alert", role: "alert" }, [
    "설계 메모의 후보를 먼저 고쳐야 경기를 시작할 수 있습니다.",
    el("ul", {}, v.errs.map(e => el("li", { text: e })))
  ]), el("div", { class: "row c" }, [
    el("a", { class: "btn", href: "lesson01.html#memo", text: "1차시 설계 메모로 가기" }),
    el("button", { class: "btn", type: "button", text: "예시 후보로 되돌리기", onclick: () => { design = structuredClone(EXAMPLE); saveDesign(); location.reload(); } })
  ]));
  return null;
}

/* ---------- 공용: 토너먼트 화면 ---------- */
function mountTournament(box, opt) {
  // opt: candidates, title, chickenLabels, reason, debug, record, send
  let g = newGame(opt.candidates);
  let run = null;
  let reasonVal = "";

  function labelFor(rs, m) {
    if (!opt.chickenLabels) return `${roundName(rs)} ${m}경기`;
    if (rs === 8) return "8강 " + "①②③④"[m - 1];
    if (rs === 4) return "4강 " + "가나"[m - 1];
    return "결승";
  }
  function start() {
    if (sending) return;   // 전송 중에는 새 경기로 넘어가지 않는다
    g = newGame(opt.candidates);
    run = opt.record ? { runId: "run-" + rid().slice(0, 8), alias: randomAlias(), topic: design.topic, version: "v01", choices: [], winner: null } : null;
    render();
  }
  function pick(side) {
    const extra = opt.reason ? { reason: reasonVal.trim() } : {};
    if (!choose(g, side, extra)) return;
    reasonVal = "";
    if (run) {
      const c = g.log[g.log.length - 1];
      run.choices.push({ roundSize: c.roundSize, match: c.match, left: c.left, right: c.right, selected: c.selected });
      if (g.done) { run.winner = g.champion; saveRun(structuredClone(run)); opt.onRecord && opt.onRecord(run); }
    }
    render();
    // 새 화면이 그려진 뒤에만 다시 입력을 받는다
    const painted = g;
    // 화면이 숨겨진 탭에서도 풀리도록 requestAnimationFrame 대신 짧은 타이머를 쓴다
    setTimeout(() => {
      if (g !== painted) return;
      g.busy = false;
      box.querySelectorAll(".cand").forEach(b => { b.disabled = false; });
      if (opt.debug) opt.debug(g);
    }, 60);
  }
  function render() {
    const nodes = [el("div", { class: "app-title", text: opt.title })];
    if (run) nodes.push(el("p", { class: "notice", text: `이번 회차 표식: ${run.alias} (무작위 별명, 실명과 연결하지 않음) / 회차 ID ${run.runId}` }));
    if (!g.done) {
      const rs = g.currentRound.length, m = g.matchIndex / 2 + 1;
      const L = g.currentRound[g.matchIndex], R = g.currentRound[g.matchIndex + 1];
      const lb = el("button", { class: "cand", type: "button", onclick: () => pick(0) }, [L, el("span", { class: "k", text: "왼쪽" })]);
      const rb = el("button", { class: "cand", type: "button", onclick: () => pick(1) }, [R, el("span", { class: "k", text: "오른쪽" })]);
      if (g.busy) { lb.disabled = true; rb.disabled = true; }
      nodes.push(
        el("div", { class: "round", text: `${labelFor(rs, m)}  (${g.log.length + 1}/7번째 선택)` }),
        el("div", { class: "progress", "aria-hidden": "true" }, el("span", { style: `width:${(g.log.length / 7) * 100}%` })),
        el("div", { class: "match" }, [lb, el("span", { class: "vs", text: "vs" }), rb])
      );
      if (opt.reason) {
        const inp = el("input", { type: "text", id: "reason-input", placeholder: "예: 바삭한 식감을 좋아해서", value: reasonVal, maxlength: "40" });
        inp.addEventListener("input", e => reasonVal = e.target.value);
        nodes.push(el("div", { class: "field" }, [el("label", { for: "reason-input", text: "선택 이유 메모 (자율, 고르기 전에 적기)" }), inp]));
      }
    } else {
      nodes.push(el("div", { class: "champ" }, [
        el("span", { class: "crown", text: "오늘 나의 우승 항목" }),
        el("span", { class: "name", text: g.champion }),
        el("span", { class: "notice", text: `선택 ${g.log.length}건으로 우승 1개가 남았습니다.` })
      ]));
      if (opt.reason) {
        nodes.push(el("div", { class: "tablewrap" }, el("table", {}, [
          el("thead", {}, el("tr", {}, [el("th", { text: "라운드" }), el("th", { text: "선택 항목" }), el("th", { text: "선택 이유" })])),
          el("tbody", {}, g.log.map(c => el("tr", {}, [el("td", { text: labelFor(c.roundSize, c.match) }), el("td", { text: c.selected }), el("td", { text: c.reason || "(적지 않음)" })])))
        ])));
      }
      if (opt.send) nodes.push(opt.send(run));
      nodes.push(el("div", { class: "row c" }, el("button", { class: "btn primary", type: "button", text: "다시하기", onclick: start })));
    }
    box.replaceChildren(...nodes);
    if (opt.debug) opt.debug(g);
    if (opt.after) opt.after(g);
  }
  start();
  return { restart: start, game: () => g };
}

/* ---------- 각 단계의 앱 ---------- */
const APPS = {};

APPS.s1 = (box, col) => {
  const chicken = ["후라이드", "양념", "간장", "허니", "마늘", "매콤", "치즈", "숯불"];
  const holder = el("div", { style: "display:grid;gap:14px" });
  box.append(
    el("p", { class: "notice", text: "규칙: 두 항목 중 하나를 고릅니다. 선택한 항목만 다음 라운드에 올라가고, 7번 선택하면 우승 항목 1개가 남습니다. 후보는 수업용 예시이며 브랜드, 사진, 실제 구매 정보는 사용하지 않습니다." }),
    holder
  );
  mountTournament(holder, { candidates: chicken, title: "치킨 월드컵", chickenLabels: true, reason: true });

  // 설계 메모
  const memo = el("div", { class: "panel", id: "memo" });
  const ins = [];
  function field(id, label, key, ph) {
    const i = el("input", { type: "text", id, value: design[key], placeholder: ph });
    i.addEventListener("input", () => { design[key] = i.value; saveDesign(); });
    ins.push(i);
    return el("div", { class: "field" }, [el("label", { for: id, text: label }), i]);
  }
  const candBoxes = design.candidates.slice(0, 8).concat(Array(Math.max(0, 8 - design.candidates.length)).fill("")).map((c, i) => {
    const inp = el("input", { type: "text", id: `memo-c${i}`, value: c, "aria-label": `후보 ${i + 1}` });
    inp.addEventListener("input", () => {
      const arr = [...memo.querySelectorAll(".cands8 input")].map(x => x.value);
      design.candidates = arr; saveDesign(); updateMemoState();
    });
    return inp;
  });
  const state = el("div", {});
  function updateMemoState() {
    const v = validate(design.candidates);
    state.replaceChildren(v.ok ? el("div", { class: "okbox", text: `후보 8개가 준비되었습니다. 2단계부터 "${design.topic} 월드컵"으로 앱이 만들어집니다.` })
                               : el("div", { class: "alert" }, [el("ul", {}, v.errs.map(e => el("li", { text: e })))]));
  }
  memo.append(
    el("h3", {}, ["내 주제 설계 메모 ", el("small", { text: "1차시 산출물, 다음 차시 앱의 재료" })]),
    el("p", { class: "notice", text: "예시: 학교에서 먹고 싶은 과일. 새로 만든 수업용 예시이며 실제 설문 결과가 아닙니다. 지금은 코드를 만들지 않고 생각을 구체화합니다. 메모는 이 브라우저에만 저장되니 이름, 학번, 연락처, 건강정보는 적지 않습니다." }),
    el("div", { class: "two" }, [field("memo-topic", "내 주제", "topic", "예: 과일"), field("memo-crit", "선택 기준", "criterion", "예: 지금 먹고 싶은 마음으로")]),
    field("memo-q", "알아보고 싶은 질문", "question", "예: 학교 간식으로 어떤 과일을 더 좋아할까?"),
    el("div", { class: "field" }, [el("label", { text: "후보 8개 (같은 범주, 구체적인 이름, 중복 없음)" }), el("div", { class: "cands8" }, candBoxes)]),
    state,
    el("div", { class: "row" }, el("button", { class: "btn small", type: "button", text: "과일 예시로 되돌리기", onclick: () => { design = structuredClone(EXAMPLE); saveDesign(); location.reload(); } }))
  );
  updateMemoState();
  col.append(memo);
};

APPS.s2 = (box, col) => {
  // 설계 메모를 그대로 검사한다. 잘못된 후보를 예시로 몰래 바꾸지 않는다
  let test = design.candidates.slice();
  const base = (validate(design.candidates).ok ? validate(design.candidates).clean : EXAMPLE.candidates).slice();
  const codeView = el("pre", { class: "code" });
  const screen = el("div", { style: "display:grid;gap:14px" });
  function draw() {
    codeView.replaceChildren(el("code", { text: "const candidates = [" + test.map(x => JSON.stringify(x)).join(", ") + "];" }));
    const v = validate(test);
    if (!v.ok) {
      screen.replaceChildren(el("div", { class: "app-title", text: `${design.topic} 월드컵` }),
        el("div", { class: "alert", role: "alert" }, ["경기를 시작하지 않습니다. 아래 조건에 맞게 후보를 고쳐 주세요.", el("ul", {}, v.errs.map(e => el("li", { text: e })))]));
      return;
    }
    const pair = v.clean.slice(0, 2);
    const result = el("p", { class: "result", role: "status", text: "두 후보 중 하나를 고르세요." });
    const mk = (name, side) => el("button", { class: "cand", type: "button", onclick: () => { result.replaceChildren("선택한 후보: ", el("b", { text: name })); } }, [name, el("span", { class: "k", text: side })]);
    screen.replaceChildren(
      el("div", { class: "app-title", text: `${design.topic} 월드컵` }),
      el("div", { class: "round", text: "한 경기 (다음 경기 연결은 3단계)" }),
      el("div", { class: "match" }, [mk(pair[0], "candidates[0]"), el("span", { class: "vs", text: "vs" }), mk(pair[1], "candidates[1]")]),
      result
    );
  }
  const tests = [
    ["정상 배열", () => base.slice()],
    ["첫 후보를 청사과로", () => { const t = base.slice(); t[0] = "청" + t[0]; return t; }],
    ["후보 7개", () => base.slice(0, 7)],
    ["빈 이름 포함", () => { const t = base.slice(); t[3] = "  "; return t; }],
    ["첫 후보가 두 번", () => { const t = base.slice(); t[5] = t[0]; return t; }]
  ];
  box.append(screen);
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["배열 바꿔 시험하기 ", el("small", { text: "화면은 배열을 읽어 표시만 한다" })]),
    codeView,
    el("div", { class: "row" }, tests.map(([label, fn]) => el("button", { class: "btn small", type: "button", text: label, onclick: () => { test = fn(); draw(); } }))),
    el("p", { class: "notice", text: "시험을 마치면 정상 배열로 되돌립니다. 이 시험은 설계 메모를 바꾸지 않습니다." })
  ]));
  draw();
};

function debugTable(g) {
  const rows = [
    ["현재 후보 currentRound", g.currentRound.join(", ")],
    ["다음 승자 winners", g.winners.join(", ") || "(없음)"],
    ["경기 위치 matchIndex", g.done ? "(종료)" : `${g.matchIndex}: ${g.currentRound[g.matchIndex]}과 ${g.currentRound[g.matchIndex + 1]}`],
    ["선택 기록 수", g.log.length + "건"],
    ["busy", String(g.busy)]
  ];
  return el("div", { class: "tablewrap" }, el("table", { class: "state" }, el("tbody", {}, rows.map(r => el("tr", {}, [el("td", { text: r[0] }), el("td", { class: "mono", text: r[1] })])))));
}

APPS.s3 = (box, col) => {
  const cands = designGate(box); if (!cands) return;
  const dbg = el("div", {});
  const results = el("div", { style: "display:grid;gap:6px" });
  mountTournament(box, { candidates: cands, title: `${design.topic} 월드컵`, debug: g => dbg.replaceChildren(debugTable(g)) });

  function runPath(side) {
    const g = newGame(cands); let after8 = null;
    while (!g.done) { choose(g, side); g.busy = false; if (!after8 && g.currentRound.length === 4 && g.winners.length === 0) after8 = { n: g.currentRound.length, idx: g.matchIndex, list: g.currentRound.slice() }; }
    return { g, after8 };
  }
  function line(name, expect, actual, pass) {
    return el("div", { class: "row" }, [el("span", { class: "pill " + (pass ? "ok" : "bad"), text: pass ? "통과" : "다름" }), el("span", {}, [el("b", { text: name }), ` 기대: ${expect} / 실제: ${actual}`])]);
  }
  const tests = {
    left() {
      const { g, after8 } = runPath(0);
      const exp8 = [cands[0], cands[2], cands[4], cands[6]];
      return [line("항상 왼쪽", `우승 ${cands[0]}, 선택 7건`, `우승 ${g.champion}, 선택 ${g.log.length}건`, g.champion === cands[0] && g.log.length === 7),
              line("8강 마친 순간", `후보 4개 [${exp8.join(", ")}], 위치 0`, `후보 ${after8.n}개 [${after8.list.join(", ")}], 위치 ${after8.idx}`, after8.n === 4 && after8.idx === 0 && after8.list.join() === exp8.join())];
    },
    right() {
      const { g } = runPath(1);
      return [line("항상 오른쪽", `우승 ${cands[7]}, 선택 7건`, `우승 ${g.champion}, 선택 ${g.log.length}건`, g.champion === cands[7] && g.log.length === 7)];
    },
    double() {
      const g = newGame(cands);
      choose(g, 0); choose(g, 0);           // 같은 경기에 빠른 두 번 클릭
      const n1 = g.log.length;
      g.busy = false; choose(g, 1);         // 새 화면이 그려진 뒤의 정상 클릭
      return [line("빠른 두 번 클릭", "첫 경기 기록 1건, 다음 경기 클릭은 정상 처리", `첫 경기 기록 ${n1}건, 이어서 ${g.log.length}건`, n1 === 1 && g.log.length === 2)];
    },
    restart() {
      const g0 = runPath(0).g; const before = cands.join();
      const g = newGame(g0.original);
      return [line("우승 후 다시하기", "8개 후보, 선택 기록 0건, 원본 배열 그대로", `${g.currentRound.length}개 후보, 선택 기록 ${g.log.length}건, 원본 ${cands.join() === before ? "그대로" : "바뀜"}`, g.currentRound.length === 8 && g.log.length === 0 && cands.join() === before)];
    }
  };
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["교사 디버그 영역 ", el("small", { text: "선택할 때마다 세 상태가 바뀌는 모습" })]),
    dbg
  ]), el("div", { class: "panel" }, [
    el("h3", {}, ["시험 시나리오 자동 실행 ", el("small", { text: "무작위 대진을 켜기 전의 결정적 시험" })]),
    el("div", { class: "row" }, [
      el("button", { class: "btn small", type: "button", text: "항상 왼쪽", onclick: () => results.replaceChildren(...tests.left()) }),
      el("button", { class: "btn small", type: "button", text: "항상 오른쪽", onclick: () => results.replaceChildren(...tests.right()) }),
      el("button", { class: "btn small", type: "button", text: "빠른 두 번 클릭", onclick: () => results.replaceChildren(...tests.double()) }),
      el("button", { class: "btn small", type: "button", text: "다시하기 초기화", onclick: () => results.replaceChildren(...tests.restart()) }),
      el("button", { class: "btn small primary", type: "button", text: "전체 실행", onclick: () => results.replaceChildren(...tests.left(), ...tests.right(), ...tests.double(), ...tests.restart()) })
    ]),
    results
  ]));
};

function runsPanel() {
  const panel = el("div", { class: "panel" });
  function draw() {
    const confirmBox = el("div", { class: "row" });
    const clearBtn = el("button", { class: "btn small", type: "button", text: "연습 기록 지우기", onclick: () => {
      confirmBox.replaceChildren(el("span", { text: "이 앱의 기록(meal_worldcup_v1)만 지웁니다. 지울까요?" }),
        el("button", { class: "btn small primary", type: "button", text: "지우기", onclick: () => {
          const ok = store.remove(RUNS_KEY);
          if (ok) { runsState.runs = []; runsState.locked = false; }
          runsState.level = ok ? "ok" : "bad"; runsState.status = ok ? "이 앱의 연습 기록을 지웠습니다." : "기록을 지우지 못했습니다. 저장소 접근이 막혀 있어 기존 기록과 보호 상태를 그대로 둡니다."; draw(); } }),
        el("button", { class: "btn small", type: "button", text: "취소", onclick: () => confirmBox.replaceChildren() }));
    } });
    const runs = runsState.runs;
    const last = runs[runs.length - 1];
    panel.replaceChildren(
      el("h3", {}, ["저장된 완료 회차 ", el("small", { text: "localStorage, 키 meal_worldcup_v1" })]),
      el("div", { class: runsState.level === "ok" ? "okbox" : "alert", role: "status", text: runsState.status }),
      el("p", { class: "notice", text: "저장 위치는 이 브라우저입니다. 외부로 전송하지 않으며, 다른 브라우저에는 보이지 않습니다. 공용 기기에서는 다음 사용자에게 보일 수 있으니 연습이 끝나면 지웁니다." }),
      runs.length ? el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["회차 ID", "표식", "주제", "버전", "우승", "선택 수"].map(h => el("th", { class: h === "선택 수" ? "num" : null, text: h })))),
        el("tbody", {}, runs.map((r, i) => el("tr", { class: i === runs.length - 1 ? "fresh" : null }, [
          el("td", { class: "mono", text: r.runId }), el("td", { text: r.alias }), el("td", { text: r.topic }), el("td", { text: r.version }),
          el("td", { text: r.winner ?? "(미완료)" }), el("td", { class: "num", text: String(r.choices?.length ?? 0) })])))
      ])) : null,
      last ? el("details", {}, [el("summary", { text: "마지막 회차의 기록 형태(JSON)" }), el("pre", { class: "code" }, el("code", { text: JSON.stringify(last, null, 1) }))]) : null,
      el("div", { class: "row" }, [clearBtn, confirmBox])
    );
  }
  draw();
  return { panel, draw };
}

APPS.s4 = (box, col) => {
  const cands = designGate(box); if (!cands) return;
  loadRuns();
  const rp = runsPanel();
  mountTournament(box, { candidates: cands, title: `${design.topic} 월드컵`, record: true, onRecord: () => rp.draw() });
  col.append(rp.panel);
};

APPS.s5 = (box, col) => {
  const cands = designGate(box); if (!cands) return;
  loadRuns();
  const sheetBox = el("div", {});
  let freshId = null;
  const expectInp = el("input", { type: "number", id: "expect-n", min: "0", value: "6", style: "max-width:90px" });

  // 한 요청을 보내고 결과를 status에 표시한다. 실패하면 pendingVotes에 남겨 같은 ID로 재시도한다
  function sendPending(entry, btn, status) {
    if (sending) return;
    const pending = entry.payload;
    sending = true; btn.disabled = true; status.textContent = "저장 확인 중";
    pendingVotes.set(pending.requestId, entry);
    callSaveVote(pending).then(res => {
      if (!res || res.ok !== true || res.requestId !== pending.requestId) return fail("응답 형식이 다릅니다");
      sending = false; pendingVotes.delete(pending.requestId);
      lastPendingMsg = res.duplicate ? `ID ${pending.requestId.slice(0, 8)}…: 이미 저장된 같은 요청입니다. 행이 늘지 않았는지 시트에서 확인하세요.` : `ID ${pending.requestId.slice(0, 8)}…: 저장 응답을 받았습니다.`;
      freshId = res.requestId; drawSheet(); drawPending();
      status.replaceChildren(el("span", { class: "pill ok", text: res.duplicate ? "중복" : "저장" }), " ",
        res.duplicate ? "이미 저장된 같은 요청입니다. 시트에서 한 행인지 확인하세요." : "저장 응답을 받았습니다. 시트에서 한 행인지 확인하세요.");
      btn.textContent = "저장 완료";
    }, err => fail(err.message));
    function fail(why) {
      sending = false; btn.disabled = false; btn.textContent = "같은 요청 재시도";
      status.replaceChildren(el("span", { class: "pill bad", text: "확인 못 함" }), ` 저장 결과를 확인하지 못했습니다(${why}). 시트를 먼저 확인한 뒤 같은 요청으로 재시도하세요.`);
      drawSheet(); drawPending();
    }
  }
  function sendCard(run) {
    let entry = [...pendingVotes.values()].find(p => p.runId === run.runId) || null;
    const status = el("p", { class: "result", role: "status", text: entry ? "확인하지 못한 요청이 있습니다. 같은 요청으로 재시도하세요." : "결과를 시트로 보내기 전입니다." });
    const btn = el("button", { class: "btn primary", type: "button", text: entry ? "같은 요청 재시도" : "한 건 저장" });
    btn.addEventListener("click", () => {
      // pending은 한 번만 만들고, 재시도 때도 같은 requestId를 사용한다
      if (!entry) entry = { runId: run.runId, payload: { requestId: rid(), alias: run.alias, topic: run.topic, winner: run.winner } };
      sendPending(entry, btn, status);
    });
    return el("div", { class: "panel", style: "background:var(--bg)" }, [
      el("div", { class: "tablewrap" }, el("table", {}, el("tbody", {}, [["보낼 값", "requestId, alias, topic, winner"], ["표식", run.alias], ["주제", run.topic], ["우승", run.winner]].map(r => el("tr", {}, [el("td", { text: r[0] }), el("td", { text: r[1] })]))))),
      el("div", { class: "row c" }, btn), status
    ]);
  }

  function checks() {
    const n = sheet.length;
    const blank = sheet.filter(r => !String(r[3] || "").trim()).length;
    const ids = new Set(sheet.map(r => r[0]));
    const off = sheet.filter(r => !cands.includes(r[3]) || r[2] !== design.topic).length;
    const exp = Number(expectInp.value) || 0;
    const item = (ok, t) => el("li", { class: "row" }, [el("span", { class: "pill " + (ok ? "ok" : "wait"), text: ok ? "확인" : "살펴보기" }), el("span", { text: t })]);
    return el("ul", { class: "checks" }, [
      item(n === exp, `예상 참가 ${exp}건, 실제 기록 ${n}건`),
      item(blank === 0, `빈 우승 후보 ${blank}건 (끝까지 참여했는지 확인)`),
      item(ids.size === n, `같은 요청 ID 반복 ${n - ids.size}건 (이중 클릭, 재전송 여부)`),
      item(off === 0, `지금 후보 목록과 다른 표기 또는 다른 주제 ${off}건`)
    ]);
  }

  function drawSheet() {
    const confirmBox = el("div", { class: "row" });
    sheetBox.replaceChildren(
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, [el("th", { text: "" }), ...HEADERS.map(h => el("th", { text: h }))])),
        el("tbody", {}, sheet.length ? sheet.map((r, i) => el("tr", { class: r[0] === freshId ? "fresh" : null }, [el("td", { class: "num", text: String(i + 2) }), ...r.map((c, j) => el("td", { class: j === 0 || j === 4 ? "mono" : null, text: j === 0 ? String(c).slice(0, 13) + (String(c).length > 13 ? "…" : "") : j === 4 ? String(c).slice(5, 19).replace("T", " ") : c }))]))
                                  : el("tr", {}, el("td", { colspan: "6", text: "아직 행이 없습니다. 왼쪽에서 결승까지 마치고 한 건 저장을 누르세요." })))
      ])),
      el("p", { class: "notice", text: `results 탭, 머리글 제외 데이터 ${sheet.length}행` }),
      sheetLocked ? el("div", { class: "alert", text: "저장된 모의 시트를 복원하지 못해 원문을 보호하고 있습니다. 새 행은 화면에만 남습니다. 모의 시트 비우기에 성공하면 다시 저장합니다." }) : null,
      el("div", { class: "field" }, [el("label", { for: "expect-n", text: "예상 참가 수" }), expectInp]),
      checks(),
      el("div", { class: "row" }, [
        el("button", { class: "btn small", type: "button", text: "가상 6건 넣기", onclick: () => {
          ["사과", "사과", "귤", "배", "사과", "귤"].forEach((w, i) => {
            const win = cands.includes(w) ? w : cands[[0, 0, 2, 1, 0, 2][i]];
            try { saveVoteOn(sheet, { requestId: "demo-seed-" + rid().slice(0, 8), alias: "연습" + ALPHA[i], topic: design.topic, winner: win }); } catch (e) {}
          });
          saveSheet(); drawSheet(); } }),
        el("button", { class: "btn small", type: "button", text: "모의 시트 비우기", onclick: () => {
          confirmBox.replaceChildren(el("span", { text: "모의 시트의 모든 행을 지울까요?" }),
            el("button", { class: "btn small primary", type: "button", text: "비우기", onclick: () => {
              if (store.remove(SHEET_KEY)) { sheet = []; sheetLocked = false; freshId = null; }
              drawSheet(); } }),
            el("button", { class: "btn small", type: "button", text: "취소", onclick: () => confirmBox.replaceChildren() }));
        } }),
        confirmBox
      ])
    );
  }
  expectInp.addEventListener("input", drawSheet);

  // 네 가지 가상 요청 시험 (빈 시험용 시트에서)
  const fourOut = el("div", { style: "display:grid;gap:6px" });
  function runFour() {
    const rows = []; const a = cands[0], b = cands[1];
    const reqs = [
      ["새 ID, 연습A, " + a, { requestId: "demo-run-0001", alias: "연습A", topic: design.topic, winner: a }, "새 행 1개, duplicate=false", (r, d) => d === 1 && r && r.duplicate === false],
      ["같은 ID와 같은 값", { requestId: "demo-run-0001", alias: "연습A", topic: design.topic, winner: a }, "새 행 0개, duplicate=true", (r, d) => d === 0 && r && r.duplicate === true],
      ["같은 ID, 우승만 " + b + "(으)로", { requestId: "demo-run-0001", alias: "연습A", topic: design.topic, winner: b }, "REQUEST_CONFLICT, 새 행 0개", (r, d, e) => d === 0 && e === "REQUEST_CONFLICT"],
      ["새 ID, 연습B, " + b, { requestId: "demo-run-0002", alias: "연습B", topic: design.topic, winner: b }, "새 행 1개, 기존 값 유지", (r, d) => d === 1 && rows[0][3] === a]
    ];
    fourOut.replaceChildren(...reqs.map(([name, p, exp, judge]) => {
      const before = rows.length; let res = null, err = null;
      try { res = saveVoteOn(rows, p); } catch (e) { err = e.message; }
      const d = rows.length - before;
      const actual = err ? `${err}, 새 행 ${d}개` : `새 행 ${d}개, duplicate=${res.duplicate}`;
      const pass = judge(res, d, err);
      return el("div", { class: "row" }, [el("span", { class: "pill " + (pass ? "ok" : "bad"), text: pass ? "통과" : "다름" }), el("span", {}, [el("b", { text: name }), ` 기대: ${exp} / 실제: ${actual}`])]);
    }));
  }

  const failBox = el("input", { type: "checkbox", id: "net-fail" });
  failBox.checked = net.failBefore;
  failBox.addEventListener("change", () => net.failBefore = failBox.checked);
  const loseBox = el("input", { type: "checkbox", id: "net-lose" });
  loseBox.checked = net.loseReply;
  loseBox.addEventListener("change", () => net.loseReply = loseBox.checked);

  mountTournament(box, { candidates: cands, title: `${design.topic} 월드컵`, record: true, send: sendCard });

  // 확인하지 못한 요청: 새 경기로 넘어가도 같은 requestId로 다시 확인할 수 있게 남긴다
  const pendingBox = el("div", {});
  function drawPending() {
    const list = [...pendingVotes.values()];
    if (!list.length) { pendingBox.replaceChildren(lastPendingMsg ? el("div", { class: "okbox", role: "status", text: lastPendingMsg }) : ""); return; }
    pendingBox.replaceChildren(el("div", { class: "panel" }, [
      el("h3", {}, ["확인하지 못한 요청 ", el("small", { text: "같은 requestId로만 재시도" })]),
      ...list.map(entry => {
        const st = el("span", { class: "notice", text: `${entry.payload.alias}, 우승 ${entry.payload.winner}, ID ${entry.payload.requestId.slice(0, 8)}…` });
        const b = el("button", { class: "btn small", type: "button", text: "같은 요청 재시도" });
        b.addEventListener("click", () => sendPending(entry, b, st));
        return el("div", { class: "row" }, [b, st]);
      })
    ]));
  }

  col.append(
    el("div", { class: "panel" }, [
      el("h3", { text: "연동의 원리" }),
      el("div", { class: "flow" }, [
        el("div", {}, [el("b", { text: "앱" }), "수집할 값과 전송 요청 만들기"]),
        el("div", {}, [el("b", { text: "웹앱" }), "받은 값 검사, 중복 처리, 저장 요청"]),
        el("div", {}, [el("b", { text: "시트" }), "합의한 열과 권한으로 기록 보관"])
      ]),
      el("p", { class: "notice", text: "이 페이지의 웹앱과 시트는 브라우저 안에서 Code.gs의 검사 규칙을 그대로 흉내 낸 모의 환경입니다. 실제 구글 시트로 전송하지 않습니다." }),
      el("ul", { class: "checks" }, [
        el("li", {}, el("label", { for: "net-fail" }, [failBox, el("span", { text: "연결 실패 만들기 (저장 전에 실패)" })])),
        el("li", {}, el("label", { for: "net-lose" }, [loseBox, el("span", { text: "응답 유실 만들기 (저장은 되었는데 응답이 오지 않음)" })]))
      ]),
      el("p", { class: "notice", text: "응답 유실을 켜고 저장한 뒤 끄고 재시도하면, 같은 요청 ID라서 행이 하나만 남는 것을 확인할 수 있습니다." })
    ]),
    pendingBox,
    el("div", { class: "panel" }, [el("h3", {}, ["모의 시트 ", el("small", { text: "새로 생긴 행은 노란색" })]), sheetBox]),
    el("div", { class: "panel" }, [
      el("h3", {}, ["네 가지 가상 요청 ", el("small", { text: "빈 시험용 시트에서 순서대로" })]),
      el("div", { class: "row" }, el("button", { class: "btn small primary", type: "button", text: "순서대로 보내기", onclick: runFour })),
      fourOut
    ])
  );
  drawSheet(); drawPending();
};

APPS.s6 = (box, col) => {
  const cands = designGate(box); if (!cands) return;
  const SAMPLE = ["사과", "사과", "귤", "배", "사과", "귤"].map((w, i) => cands.includes(w) ? w : cands[[0, 0, 2, 1, 0, 2][i]]);
  let src = "sample";
  const out = el("div", { style: "display:grid;gap:14px" });
  const r1 = el("input", { type: "radio", name: "src", id: "src-sample", checked: true });
  const r2 = el("input", { type: "radio", name: "src", id: "src-sheet" });
  r1.addEventListener("change", () => { src = "sample"; draw(); });
  r2.addEventListener("change", () => { src = "sheet"; draw(); });
  const sentences = {};

  function draw() {
    const winners = src === "sample" ? SAMPLE : sheet.filter(r => r[2] === design.topic).map(r => r[3]);
    const n = winners.length;
    const label = src === "sample" ? `가상 ${design.topic} 월드컵 우승 빈도(n=${n})` : `모의 시트 ${design.topic} 월드컵 우승 빈도(n=${n})`;
    const counts = cands.map(c => ({ c, k: winners.filter(w => w === c).length })).sort((a, b) => b.k - a.k || cands.indexOf(a.c) - cands.indexOf(b.c));
    const sum = counts.reduce((s, x) => s + x.k, 0);
    const pct = k => n ? (k / n * 100) : 0;
    const fmtPct = k => { const p = pct(k); return Number.isInteger(p) ? `${p}%` : `약 ${Math.round(p)}%`; };
    if (!n) {
      out.replaceChildren(el("div", { class: "app-title", text: label }),
        el("div", { class: "alert", text: "모의 시트에 이 주제의 기록이 없습니다. 5단계에서 결과를 저장하거나 가상 6건을 넣은 뒤 다시 보세요." }));
      return;
    }
    const maxK = Math.max(1, ...counts.map(x => x.k));
    // 막대그래프 (세로, 0부터)
    const W = 560, H = 260, padL = 40, padB = 46, padT = 26, padR = 10;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const step = maxK <= 5 ? 1 : Math.ceil(maxK / 5);
    const top = Math.ceil(maxK / step) * step;
    const y = v => padT + plotH - (v / top) * plotH;
    const bw = plotW / counts.length;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "chart"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label + ", " + counts.map(x => `${x.c} ${x.k}건`).join(", "));
    svg.style.width = "100%"; svg.style.height = "auto";
    const add = (tag, at, txt) => { const e = document.createElementNS(ns, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
    for (let v = 0; v <= top; v += step) {
      add("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" });
      add("text", { x: padL - 8, y: y(v) + 4, "text-anchor": "end" }, String(v));
    }
    add("text", { x: padL - 30, y: padT - 10 }, "우승 횟수(건)");
    counts.forEach((x, i) => {
      const cx = padL + bw * i + bw / 2, w = Math.min(46, bw * .62);
      if (x.k > 0) add("rect", { x: cx - w / 2, y: y(x.k), width: w, height: y(0) - y(x.k), rx: 3, class: "bar" + (x.k === maxK ? " top" : "") });
      add("text", { x: cx, y: y(x.k) - 6, "text-anchor": "middle", class: "val" }, String(x.k));
      add("text", { x: cx, y: H - padB + 18, "text-anchor": "middle" }, x.c.length > 5 ? x.c.slice(0, 5) + "…" : x.c);
    });

    const topK = counts[0];
    const obs = `${src === "sample" ? "가상 응답" : "모의 시트 기록"} ${n}건 중 ${topK.c}의 우승은 ${topK.k}건이다.`;
    const sField = (key, title, ph) => {
      const i = el("input", { type: "text", id: "sent-" + key, value: sentences[key] || "", placeholder: ph });
      i.addEventListener("input", () => sentences[key] = i.value);
      return el("div", { class: "field" }, [el("label", { for: "sent-" + key }, [el("b", { text: title }), " "]), i]);
    };
    out.replaceChildren(
      el("div", { class: "app-title", style: "font-size:20px", text: label }),
      svg,
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, [el("th", { text: "후보" }), el("th", { class: "num", text: "우승 횟수" }), el("th", { class: "num", text: `전체 ${n}건 중 비율` })])),
        el("tbody", {}, [...counts.map(x => el("tr", {}, [el("td", { text: x.c }), el("td", { class: "num", text: String(x.k) }), el("td", { class: "num", text: fmtPct(x.k) })])),
          ...(sum < n ? [el("tr", {}, [el("td", { text: "후보 목록 밖" }), el("td", { class: "num", text: String(n - sum) }), el("td", { class: "num", text: fmtPct(n - sum) })])] : []),
          el("tr", {}, [el("td", { text: "합계" }), el("td", { class: "num", text: String(n) }), el("td", { class: "num", text: "100%" })])])
      ])),
      el("div", { class: sum === n ? "okbox" : "alert", text: sum === n ? `막대 합계 ${sum}건이 원본 ${n}건과 같습니다.` : `막대 합계 ${sum}건이 원본 ${n}건과 다릅니다. 후보 목록에 없는 이름이 섞였는지 확인하세요.` }),
      el("div", { class: "panel", style: "background:var(--bg)" }, [
        el("h3", {}, ["세 문장으로 해석하기 ", el("small", { text: "자료 밖의 사실을 보태지 않기" })]),
        el("div", { class: "sentences" }, [
          el("div", { class: "field" }, [el("label", {}, el("b", { text: "관찰" })), el("p", { text: obs })]),
          sField("cmp", "비교", "내 예상 [내용]과 비교하면 [같은 점, 다른 점]"),
          sField("lim", "한계", "[대상, 대진, 표본 수] 때문에 [범위]는 말하기 어렵다"),
          sField("more", "추가 확인", "다음에는 [어떤 자료]를 더 모으고 싶다")
        ]),
        el("p", { class: "notice", text: `예: ${obs.replace("이다.", "이지만")} '학교에서 가장 인기'인지는 아직 모릅니다. 다른 학생, 다른 대진표에서는 달라질 수 있습니다.` })
      ])
    );
  }
  box.append(el("div", { class: "row" }, [
    el("label", { for: "src-sample", class: "row" }, [r1, "가상 6건 예시"]),
    el("label", { for: "src-sheet", class: "row" }, [r2, "5단계 모의 시트의 기록"])
  ]), el("p", { class: "notice", text: "모의 시트의 기록은 주제 이름으로만 묶습니다. 후보나 선택 기준을 바꿨다면 규칙이 다른 기록이 섞이므로 5단계에서 시트를 비우고 새로 모읍니다." }), out);
  draw();

  // 유사도 개념 연결 (교원 7차시)
  const ns = "http://www.w3.org/2000/svg";
  const sv = document.createElementNS(ns, "svg");
  sv.setAttribute("viewBox", "0 0 260 230"); sv.setAttribute("class", "chart"); sv.setAttribute("role", "img");
  sv.setAttribute("aria-label", "가상 별점 벡터 P(5,1), Q(4,1), R(1,5)의 방향 비교");
  sv.style.width = "100%"; sv.style.maxWidth = "320px"; sv.style.height = "auto";
  const o = { x: 40, y: 190 }, u = 30;
  const a = (tag, at, txt) => { const e = document.createElementNS(ns, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; sv.append(e); return e; };
  for (let i = 0; i <= 5; i++) {
    a("line", { x1: o.x + i * u, x2: o.x + i * u, y1: o.y, y2: o.y - 5 * u, class: "grid" });
    a("line", { x1: o.x, x2: o.x + 5 * u, y1: o.y - i * u, y2: o.y - i * u, class: "grid" });
    a("text", { x: o.x + i * u, y: o.y + 16, "text-anchor": "middle" }, String(i));
    if (i) a("text", { x: o.x - 10, y: o.y - i * u + 4, "text-anchor": "end" }, String(i));
  }
  a("text", { x: o.x + 5 * u, y: o.y + 34, "text-anchor": "end" }, "메뉴 A 별점");
  a("text", { x: 4, y: 22 }, "메뉴 B 별점");
  const defs = document.createElementNS(ns, "defs");
  defs.innerHTML = '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>';
  sv.prepend(defs);
  [["P", 5, 1, "var(--accent)"], ["Q", 4, 1, "var(--accent)"], ["R", 1, 5, "var(--yolk)"]].forEach(([nm, x, yv, c]) => {
    const g = document.createElementNS(ns, "g"); g.setAttribute("style", `color:${c}`);
    const ln = document.createElementNS(ns, "line");
    Object.entries({ x1: o.x, y1: o.y, x2: o.x + x * u, y2: o.y - yv * u, stroke: "currentColor", "stroke-width": 2.5, "marker-end": "url(#ah)" }).forEach(([k, v]) => ln.setAttribute(k, v));
    const t = document.createElementNS(ns, "text");
    Object.entries({ x: o.x + x * u + (nm === "Q" ? -2 : 6), y: o.y - yv * u + (nm === "Q" ? 16 : -4), class: "val" }).forEach(([k, v]) => t.setAttribute(k, v));
    t.textContent = `${nm}(${x},${yv})`;
    g.append(ln, t); sv.append(g);
  });
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["유사도 개념 연결 ", el("small", { text: "교원 7차시, 계산 도구는 만들지 않음" })]),
    sv,
    el("p", { text: "같은 메뉴 순서로 별점을 나열하면 방향을 비교할 수 있습니다. 메뉴 A를 상대적으로 높게 평가한 P와 Q는 방향이 비슷하고 R은 다릅니다." }),
    el("p", { class: "notice", text: "P와 Q의 방향이 비슷하다는 것은 이번 메뉴 응답에만 해당합니다. 성격이나 친밀도를 뜻하지 않습니다. 코사인 계산은 학생 7차시에서 다룹니다." })
  ]));
};

/* ==========================================================
   5~10차시 공용 자료
   ========================================================== */
const SNAP_AT = "2026-11-04 22:05 KST";
const SNAP_SRC = "NEIS 교육정보 개방 포털, 급식식단정보(mealServiceDietInfo), 인증키 없는 공개 조회";
const R = (ymd, fgr, dish, cal) => ({ ATPT_OFCDC_SC_CODE: "B10", SD_SCHUL_CODE: "7010073", SCHUL_NM: "당곡고등학교", MMEAL_SC_CODE: "2", MMEAL_SC_NM: "중식", MLSV_YMD: ymd, MLSV_FGR: fgr, DDISH_NM: dish, CAL_INFO: cal });
const SNAP = [
  R("20261026", 770.0, "친환경현미밥 <br/>참치김치찌개 (5.6.9.13)<br/>연근조림 (5.6.13)<br/>매운갈비찜 (5.6.10.13)<br/>야채달걀말이 (1)<br/>총각김치 (9)<br/>귤 ", "817.9 Kcal"),
  R("20261027", 770.0, "비건햄김치볶음밥 (5.6.9)<br/>가쓰오브시국 (5.6.9.13)<br/>달걀찜 (1.13)<br/>진미채고추장볶음 (6.13.17)<br/>생선까스&콘소스 (1.2.5.6.13)<br/>깍두기 (9)<br/>바나나우유 (2)", "789.8 Kcal"),
  R("20261028", 340.0, "친환경보리밥 <br/>소고기무국 (16)<br/>마늘쫑무침 (6.13)<br/>낙지야채볶음 (5.6.13)<br/>꽃전 (1.5.6.10.16)<br/>배추김치 (9)<br/>미니도넛 (1.2.5.6)", "819.6 Kcal"),
  R("20261029", 340.0, "소시지달걀볶음밥 (1.2.5.6.10.13.15.16.18)<br/>돈육고추장찌개 (5.6.10.13)<br/>치킨샐러드&허니머스터드S (1.2.5.6.15.16)<br/>숙주나물무침 <br/>배추김치 (9)<br/>포도주스 (2.5)", "760.8 Kcal"),
  R("20261030", 340.0, "단호박카레라이스 (2.5.6.10.12.13.16.18)<br/>팽이장국 (5.6.13)<br/>타워함박스테이크 (1.2.5.6.10.12.13.15.16)<br/>배추김치 (9)<br/>감말랭이야채샐러드 (1.2.5.6)", "838.9 Kcal"),
  R("20261102", 770.0, "친환경칼슘기장밥 <br/>바지락미역국 (5.6.13.18)<br/>시금치나물 <br/>닭볶음탕 (5.6.13.15)<br/>어묵볶음 (5.6.13.18)<br/>배추김치 (9)<br/>조각케이크 (1.2.6)", "836.9 Kcal"),
  R("20261103", 770.0, "낙지볶음밥 (2.5.6.16)<br/>미소국 (5.6)<br/>도토리묵&양념장 (5.6.13)<br/>사과 <br/>달걀후라이 (1)<br/>레몬크림깐쇼새우 (1.2.5.6.9.13)<br/>깍두기 (9)", "820.3 Kcal")
];
const SNAP_OCT = [
  R("20261001", 770.0, "친환경칼슘기장밥 <br/>육개장 (1.5.6.13.15.16)<br/>제육볶음 (6.10.13)<br/>타코야끼 (1.2.5.6.10.15.16.18)<br/>배추김치 (9)<br/>레몬에이드 <br/>오이&쌈장 (5.6)", "784.2 Kcal"),
  R("20261002", 770.0, "추가밥 <br/>미니한우쌀국수 (2.5.6.13.16)<br/>공심채볶음 (5.6.13.18)<br/>새우튀김&칠리소스 (6.9.12)<br/>배추김치 (9)<br/>에그타르트 (1.2.5.6.16)", "822.8 Kcal"),
  R("20261014", 770.0, "친환경칼슘기장밥 <br/>돈육감자탕 (5.6.10.13.16)<br/>오징어초무침 (6.17)<br/>미니돈가스&파채 (5.6.10.13.16)<br/>배식용김 <br/>석박지 (9)<br/>청포도 ", "624.9 Kcal"),
  R("20261015", 770.0, "친환경현미밥 <br/>햄찌개 (1.2.5.6.9.10.13.15.16)<br/>돈육메추리알조림 (1.5.6.10.13)<br/>고등어무조림 (5.6.7.13)<br/>시금치나물 <br/>깍두기 (9)<br/>사과생크림와플 (2.5.6)", "991.0 Kcal"),
  R("20261016", 770.0, "후리가케밥 (1.2.5.6.9.13.16.18)<br/>고명유부국 (1.2.5.6.9.13)<br/>꼬들단무지무침 <br/>떡볶이 (2.5.6.16)<br/>버터갈릭감자튀김 (2.5.6.16)<br/>배추김치 (9)<br/>요구르트 (5.6.10)", "817.4 Kcal")
];
const okResp = (rows, total) => ({ mealServiceDietInfo: [{ head: [{ list_total_count: total ?? rows.length }, { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } }] }, { row: rows }] });
function snapResponse(q) {
  if (q.missing) return { RESULT: { CODE: "ERROR-300", MESSAGE: "필수 값이 누락되어 있습니다. 요청인자를 참고 하십시오." } };
  if (q.from === "20261001" && q.to === "20261031") return okResp(SNAP_OCT, 15);
  const rows = SNAP.filter(r => r.MLSV_YMD >= q.from && r.MLSV_YMD <= q.to);
  if (rows.length) return okResp(rows.slice(0, 5), rows.length);
  if (q.from === "20261101") return { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } };
  return undefined;   // 스냅샷에 없는 조건
}
const splitMenu = raw => String(raw || "").split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
const cleanDish = s => s.replace(/\s*\([0-9.]+\)\s*$/, "").trim();
const fmtYmd = y => `${y.slice(0, 4)}-${y.slice(4, 6)}-${y.slice(6, 8)}`;

// 6~7차시 별점 자료 (가상 응답만)
const VOTES_KEY = "meal_votes_demo";
const PRACTICE = ["메뉴 A", "메뉴 B", "메뉴 C"];
let votes = (() => {
  const g = store.get(VOTES_KEY);
  if (g.ok && g.raw) { try { const v = JSON.parse(g.raw); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch (e) {} }
  return {};
})();
const saveVotes = () => store.set(VOTES_KEY, JSON.stringify(votes));
function menuSets() {
  const sets = [{ key: "practice", label: "연습 메뉴 A, B, C (가상)", menus: PRACTICE }];
  SNAP.forEach(r => sets.push({ key: "d" + r.MLSV_YMD, label: `${fmtYmd(r.MLSV_YMD)} 당곡고 중식 (실제 메뉴)`, menus: splitMenu(r.DDISH_NM).map(cleanDish) }));
  return sets;
}
let voteSetKey = "practice";
const setRows = key => (votes[key] = votes[key] || []);
function aggregate(key, menus) {
  const rows = setRows(key);
  return menus.map(m => {
    const valid = rows.filter(r => r.menu === m && typeof r.score === "number");
    const blank = rows.filter(r => r.menu === m && r.score === null).length;
    return { m, n: valid.length, blank, avg: valid.length ? valid.reduce((s, r) => s + r.score, 0) / valid.length : null };
  });
}

// 8~9차시 회귀 (모의 잔반률)
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function fitLinear(X, y, lam = 0) {
  const p = X[0].length, A = Array.from({ length: p }, () => Array(p).fill(0)), b = Array(p).fill(0);
  X.forEach((x, i) => { for (let a = 0; a < p; a++) { b[a] += x[a] * y[i]; for (let c = 0; c < p; c++) A[a][c] += x[a] * x[c]; } });
  for (let a = 1; a < p; a++) A[a][a] += lam;   // 절편에는 벌점을 주지 않는다
  return solve(A, b);
}
const dotv = (w, x) => w.reduce((s, wi, i) => s + wi * x[i], 0);
const meanOf = a => a.reduce((s, x) => s + x, 0) / a.length;
const RULE = (f, s, u) => 12 + 4 * f + 3 * s - 2 * u;
const COMBOS = [[0, 0, 0, .5], [1, 0, 0, 1], [0, 1, 0, .5], [0, 0, 1, 1], [1, 1, 0, .5], [1, 0, 1, 1], [0, 1, 1, .5], [1, 1, 1, 1]];
const TRAIN = [1, -1].flatMap((sg, h) => COMBOS.map(([f, s, u, e], i) => ({ name: `가상 메뉴 ${h * 8 + i + 1}`, fried: f, spicy: s, soup: u, y: RULE(f, s, u) + sg * e })));
const TEST = [[1, 1, 0, -.5], [0, 0, 1, .5], [1, 0, 1, .5], [0, 1, 1, -.5]].map(([f, s, u, e], i) => ({ name: `시험 메뉴 ${i + 1}`, fried: f, spicy: s, soup: u, y: RULE(f, s, u) + e }));
const FEAT_LABEL = { fried: "튀김 여부", spicy: "매운맛 여부", soup: "국류 여부" };
function runExp({ rows = 16, feats = ["fried", "spicy", "soup"], onehot = false, aug = false } = {}) {
  let tr = TRAIN.slice(0, rows);
  if (aug) tr = tr.concat(tr.map(r => ({ ...r })));
  const names = onehot ? [...new Set(tr.map(r => r.name))] : [];
  const vec = r => [1, ...feats.map(k => r[k]), ...names.map(n => r.name === n ? 1 : 0)];
  const w = fitLinear(tr.map(vec), tr.map(r => r.y), onehot ? 1e-3 : 0);
  if (!w) return null;
  const base = meanOf(tr.map(r => r.y));
  return {
    w, feats, names, n: tr.length,
    trMae: meanOf(tr.map(r => Math.abs(r.y - dotv(w, vec(r))))),
    teMae: meanOf(TEST.map(r => Math.abs(r.y - dotv(w, vec(r))))),
    baseMae: meanOf(TEST.map(r => Math.abs(r.y - base))),
    preds: TEST.map(r => dotv(w, vec(r))), base
  };
}
const pp = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();
const signed = v => (v >= 0 ? "+" : "−") + pp(Math.abs(v));

// 메뉴 이름으로 특성 만들기 (교원 9차시): 이름만으로 정하기 어려우면 미확인
const FEATURE_RULES = {
  fried: { yes: /까스|가스|튀김|깐쇼|강정|탕수|도넛|타코야끼/, unsure: /후라이|전$|치킨/ },
  spicy: { yes: /매운|매콤|고추장|떡볶이|육개장|제육/, unsure: /김치|낙지|닭볶음탕|칠리|석박지|깍두기/ },
  soup: { yes: /국$|국수$|찌개|장국|탕$/, unsure: /볶음탕/ }
};
function featureOf(name, key) {
  const r = FEATURE_RULES[key];
  if (r.unsure.test(name)) return "미확인";
  return r.yes.test(name) ? 1 : 0;
}

/* ---------- 7단계: 급식 API 수집 (학생 5차시) ---------- */
let apiRows = [];      // 표에 추가한 수집 결과
APPS.s7 = (box, col) => {
  let reqNo = 0, ctrl = null;
  const dateIn = el("input", { type: "date", id: "api-date", value: "2026-11-03", min: "2026-01-01", max: "2026-12-31" });
  const statusEl = el("div", { role: "status" });
  const out = el("div", { style: "display:grid;gap:12px" });
  const tableBox = el("div", {});
  const ymd = () => (dateIn.value || "").replaceAll("-", "");
  // 학교 찾기(ds-danggok 방식): 교육청과 학교 이름으로 코드를 찾아 요청 주소를 자동으로 채운다
  const OFFICES = [["B10", "서울"], ["C10", "부산"], ["D10", "대구"], ["E10", "인천"], ["F10", "광주"], ["G10", "대전"], ["H10", "울산"], ["I10", "세종"], ["J10", "경기"], ["K10", "강원"], ["M10", "충북"], ["N10", "충남"], ["P10", "전북"], ["Q10", "전남"], ["R10", "경북"], ["S10", "경남"], ["T10", "제주"]];
  let school = { office: "B10", officeName: "서울", code: "7010073", name: "당곡고등학교" };
  const isDanggok = () => school.code === "7010073";
  const urlFor = q => `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${school.office}`
    + (q.missing ? "" : `&SD_SCHUL_CODE=${school.code}`) + "&MMEAL_SC_CODE=2" + (q.missing ? `&MLSV_YMD=${q.from}` : `&MLSV_FROM_YMD=${q.from}&MLSV_TO_YMD=${q.to}`);
  const reqBox = el("div", { style: "display:grid;gap:8px" });
  function drawReq() {
    const url = urlFor({ from: ymd(), to: ymd() });
    reqBox.replaceChildren(
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["요청 인자", "뜻", "이번 조회"].map(h => el("th", { text: h })))),
        el("tbody", {}, [["ATPT_OFCDC_SC_CODE", "시도교육청코드", `${school.office} (${school.officeName})`], ["SD_SCHUL_CODE", "학교 행정표준코드", `${school.code} (${school.name})`], ["MMEAL_SC_CODE", "식사 코드", "2 (중식)"], ["MLSV_FROM_YMD, MLSV_TO_YMD", "급식일자", ymd()]]
          .map(r => el("tr", {}, r.map((c, i) => el("td", { class: i === 0 ? "mono" : null, text: c })))))
      ])),
      codeCopy("완성된 요청 주소", url)
    );
  }
  const offSel = el("select", { id: "sf-office", class: "btn", "aria-label": "교육청" }, OFFICES.map(([v, n]) => el("option", { value: v, text: n })));
  const nameIn = el("input", { type: "text", id: "sf-name", value: "당곡고등학교", "aria-label": "학교 이름" });
  const finderOut = el("div", { role: "status" });
  async function findSchool() {
    const office = offSel.value, name = nameIn.value.trim();
    if (!name) { finderOut.replaceChildren(el("div", { class: "alert", text: "학교 이름을 정식 명칭으로 넣어 주세요." })); return; }
    finderOut.replaceChildren(el("p", { class: "notice", text: "학교 코드를 찾는 중입니다." }));
    try {
      const res = await fetch(`https://open.neis.go.kr/hub/schoolInfo?Type=json&ATPT_OFCDC_SC_CODE=${office}&SCHUL_NM=${encodeURIComponent(name)}`);
      const d = await res.json();
      const rows = d.schoolInfo ? d.schoolInfo[1].row : [];
      if (!rows.length) { finderOut.replaceChildren(el("div", { class: "alert", text: `찾는 학교가 없습니다(${d.RESULT ? d.RESULT.CODE : "결과 없음"}). 정식 명칭으로 다시 넣어 주세요.` })); return; }
      finderOut.replaceChildren(el("div", { class: "row" }, rows.slice(0, 5).map(r => el("button", { class: "btn small", type: "button", onclick: () => {
        school = { office: r.ATPT_OFCDC_SC_CODE, officeName: r.ATPT_OFCDC_SC_NM.replace(/특별시|광역시|특별자치시|특별자치도|교육청|도$/g, ""), code: r.SD_SCHUL_CODE, name: r.SCHUL_NM };
        finderOut.replaceChildren(el("div", { class: "okbox", text: `${r.SCHUL_NM}(${r.ATPT_OFCDC_SC_CODE}, ${r.SD_SCHUL_CODE})로 바꿨습니다. 요청 주소가 함께 바뀝니다.` }));
        drawReq(); } }, `${r.SCHUL_NM} · ${r.LCTN_SC_NM || ""} ${r.SD_SCHUL_CODE}`.replace(" · ", ", ")))));
    } catch (e) {
      finderOut.replaceChildren(el("div", { class: "notice", text: "이 화면에서는 외부 조회가 막혀 있어 학교 찾기를 할 수 없습니다. 공개 페이지(greatsong.github.io/meal-worldcup)에서 사용하세요. 지금은 당곡고등학교로 진행합니다." }));
    }
  }
  dateIn.addEventListener("change", drawReq);
  const setStatus = (kind, text) => statusEl.replaceChildren(el("div", { class: kind === "ok" ? "okbox" : kind === "bad" ? "alert" : "notice" }, text));

  function show(q, data, mode, at) {
    const src = el("div", { class: "tablewrap" }, el("table", { class: "state" }, el("tbody", {}, [
      ["모드", mode === "live" ? "실시간 조회" : `저장된 실데이터 (조회 시각 ${SNAP_AT}, 최신 조회가 아님)`],
      ["조회 시각", at], ["제공 기관", SNAP_SRC], ["요청 주소", urlFor(q)]
    ].map(r => el("tr", {}, [el("td", { text: r[0] }), el("td", { class: "mono", style: "white-space:normal;word-break:break-all", text: r[1] })])))));
    const raw = el("details", {}, [el("summary", { text: "응답 원문(JSON) 보기" }), el("pre", { class: "code" }, el("code", { text: JSON.stringify(data, null, 1) }))]);
    if (data.RESULT) {
      const code = data.RESULT.CODE;
      if (code === "INFO-200") setStatus("info", [el("span", { class: "pill wait", text: "자료 없음" }), ` INFO-200: 이 조건의 자료가 없습니다. 잔반 0이나 휴교를 뜻하지 않습니다.`]);
      else setStatus("bad", [el("span", { class: "pill bad", text: "오류" }), ` ${code}: ${data.RESULT.MESSAGE} 성공 결과와 구분해 기록합니다.`]);
      out.replaceChildren(src, raw); return;
    }
    const [head, body] = data.mealServiceDietInfo;
    const total = head.head[0].list_total_count, rows = body.row;
    const cut = total > rows.length;
    setStatus(cut ? "info" : "ok", [el("span", { class: "pill " + (cut ? "wait" : "ok"), text: cut ? "잘림" : "정상" }),
      cut ? ` INFO-000이지만 전체 ${total}건 중 ${rows.length}건만 받았습니다. 인증키 없는 조회의 첫 5건 제한이며 전체 기간 수집이 아닙니다.` : ` INFO-000, ${rows.length}건을 받았습니다.`]);
    const tbl = el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["급식일", "식사", "메뉴 원문(DDISH_NM)", "정리한 메뉴", "열량", "급식인원수"].map(h => el("th", { text: h })))),
      el("tbody", {}, rows.map(r => el("tr", {}, [
        el("td", { text: fmtYmd(r.MLSV_YMD) }), el("td", { text: r.MMEAL_SC_NM }),
        el("td", { class: "mono", style: "white-space:normal;min-width:220px", text: r.DDISH_NM }),
        el("td", { style: "white-space:normal;min-width:160px", text: splitMenu(r.DDISH_NM).map(cleanDish).join(", ") }),
        el("td", { text: r.CAL_INFO }), el("td", { class: "num", text: r.MLSV_FGR == null ? "미확인" : String(r.MLSV_FGR) })])))
    ]));
    const addBtn = el("button", { class: "btn small", type: "button", text: "정리 표에 추가", onclick: () => {
      rows.forEach(r => { if (!apiRows.some(x => x.MLSV_YMD === r.MLSV_YMD)) apiRows.push({ ...r, _mode: mode, _at: at }); });
      apiRows.sort((a, b) => a.MLSV_YMD.localeCompare(b.MLSV_YMD)); drawTable(); } });
    out.replaceChildren(tbl, el("p", { class: "notice", text: "급식인원수(MLSV_FGR)는 응답에 적힌 인원 값이며 실제 출석이나 잔반을 뜻하지 않습니다. 알레르기 번호를 지운 정리 열은 분석용이며 안전 안내에는 원문을 사용합니다." }), el("div", { class: "row" }, addBtn), src, raw);
  }
  function fromSnapshot(q, why) {
    if (!isDanggok()) { setStatus("bad", [el("span", { class: "pill bad", text: "없음" }), ` ${why ? why + " " : ""}저장된 실데이터는 당곡고등학교만 있습니다. 실시간 조회를 사용하세요.`]); out.replaceChildren(); return; }
    const data = snapResponse(q);
    if (data === undefined) { setStatus("bad", [el("span", { class: "pill bad", text: "없음" }), ` ${why ? why + " " : ""}저장된 실데이터에 이 날짜가 없습니다. 2026-10-26~30, 11-01~03 또는 10월 전체로 시험하세요.`]); out.replaceChildren(); return; }
    show(q, data, "snapshot", SNAP_AT);
    if (why) statusEl.prepend(el("p", { class: "notice", text: why }));
  }
  async function live(q) {
    if (ctrl) ctrl.abort();
    const my = ++reqNo; ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort("timeout"), 15000);
    setStatus("info", [el("span", { class: "pill wait", text: "조회 중" }), " NEIS에 요청을 보냈습니다. 결과를 기다리는 동안 같은 버튼을 반복해 누르지 않습니다."]);
    try {
      const res = await fetch(urlFor(q), { signal: ctrl.signal });
      const data = await res.json();
      if (my !== reqNo) return;                 // 늦게 온 응답은 무시
      clearTimeout(timer); show(q, data, "live", new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " KST");
    } catch (e) {
      clearTimeout(timer);
      if (my !== reqNo) return;
      if (ctrl.signal.aborted && ctrl.signal.reason !== "timeout") { setStatus("info", [el("span", { class: "pill wait", text: "취소" }), " 조회를 취소했습니다. 늦게 도착한 응답은 화면에 반영하지 않습니다."]); return; }
      fromSnapshot(q, ctrl.signal.reason === "timeout" ? "15초 안에 응답이 없어 저장된 실데이터를 대신 보여 줍니다." : "이 화면에서는 외부 조회가 막혀 있거나 연결에 실패했습니다. 아래는 저장된 실데이터입니다. 실시간 조회는 공개 페이지(greatsong.github.io/meal-worldcup)에서 됩니다.");
    }
  }
  const cancel = () => { if (ctrl) { reqNo++; ctrl.abort(); setStatus("info", [el("span", { class: "pill wait", text: "취소" }), " 조회를 취소했습니다. 늦게 도착한 응답은 화면에 반영하지 않습니다."]); } };
  function drawTable() {
    tableBox.replaceChildren(apiRows.length ? el("div", { class: "panel" }, [
      el("h3", {}, ["출처를 붙인 급식 정리 표 ", el("small", { text: `${apiRows.length}일` })]),
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["급식일", "메뉴 수", "열량", "급식인원수", "가져온 방법"].map(h => el("th", { text: h })))),
        el("tbody", {}, apiRows.map(r => el("tr", {}, [el("td", { text: fmtYmd(r.MLSV_YMD) }), el("td", { class: "num", text: String(splitMenu(r.DDISH_NM).length) }), el("td", { text: r.CAL_INFO }), el("td", { class: "num", text: String(r.MLSV_FGR ?? "미확인") }), el("td", { text: r._mode === "live" ? `실시간 ${r._at}` : `저장본 ${r._at}` })])))
      ])),
      el("p", { class: "notice", text: "응답이 없는 날은 0이 아니라 표에서 빠진 날로 남깁니다. 반환된 날짜 수와 중복 행을 확인합니다." })
    ]) : null);
  }

  box.append(
    el("div", { class: "finder" }, [
      el("div", { class: "row" }, [offSel, nameIn, el("button", { class: "btn", type: "button", text: "코드 찾기", onclick: findSchool })]),
      finderOut
    ]),
    el("div", { class: "row" }, [el("label", { for: "api-date", text: "급식일" }), dateIn]),
    reqBox,
    el("div", { class: "row" }, [
      el("button", { class: "btn primary", type: "button", text: "NEIS 실데이터 조회", onclick: () => live({ from: ymd(), to: ymd() }) }),
      el("button", { class: "btn", type: "button", text: "조회 취소", onclick: cancel }),
      el("button", { class: "btn", type: "button", text: "저장된 실데이터 열기", onclick: () => fromSnapshot({ from: ymd(), to: ymd() }) })
    ]),
    el("div", { class: "row" }, [
      el("span", { class: "notice", text: "상태 시험" }),
      el("button", { class: "btn small", type: "button", text: "11월 1일 (자료 없음)", onclick: () => { dateIn.value = "2026-11-01"; fromSnapshot({ from: "20261101", to: "20261101" }); } }),
      el("button", { class: "btn small", type: "button", text: "학교 코드 빼기 (필수 인자 누락)", onclick: () => fromSnapshot({ from: ymd(), to: ymd(), missing: true }) }),
      el("button", { class: "btn small", type: "button", text: "10월 전체 (무키 잘림)", onclick: () => fromSnapshot({ from: "20261001", to: "20261031" }) })
    ]),
    statusEl, out
  );
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["검토본과 다른 값 ", el("small", { text: "공개 응답은 바뀔 수 있음" })]),
    el("p", { text: "검토본에는 2026-11-03 18:08 KST 조회에서 확인한 11월 3일 중식 열량이 817.2 Kcal로 기록되어 있습니다. 이 페이지의 저장본(2026-11-04 22:05 KST 조회)에서는 같은 날이 820.3 Kcal입니다. 수업 자료에는 조회 시각을 함께 적고, 수업 직전에 다시 확인합니다." })
  ]), tableBox);
  drawTable(); drawReq();
  fromSnapshot({ from: "20261103", to: "20261103" });
};

/* ---------- 8단계: 급식 선호도 별점 앱 (학생 6차시) ---------- */
APPS.s8 = (box, col) => {
  const sets = menuSets();
  const sel = el("select", { id: "vote-set", class: "btn" }, sets.map(s => el("option", { value: s.key, text: s.label })));
  sel.value = voteSetKey;
  const formBox = el("div", { style: "display:grid;gap:12px" });
  const aggBox = el("div", {});
  let locked = false;
  sel.addEventListener("change", () => { voteSetKey = sel.value; drawForm(); drawAgg(); });
  const cur = () => sets.find(s => s.key === voteSetKey) || sets[0];
  const nextAlias = () => "연습" + String(new Set(setRows(voteSetKey).map(r => r.alias)).size + 1).padStart(2, "0");

  function drawForm() {
    const set = cur(), alias = nextAlias();
    const answers = {};
    const items = set.menus.map((m, i) => {
      const name = `v-${i}`;
      const opts = [1, 2, 3, 4, 5].map(v => el("label", { class: "row", style: "gap:3px" }, [el("input", { type: "radio", name, value: String(v), onchange: () => answers[m] = v }), String(v)]));
      const none = el("label", { class: "row", style: "gap:3px" }, [el("input", { type: "radio", name, value: "none", onchange: () => answers[m] = "none" }), "먹어 보지 않음"]);
      const skip = el("label", { class: "row", style: "gap:3px" }, [el("input", { type: "radio", name, value: "skip", checked: true, onchange: () => delete answers[m] }), "응답하지 않음"]);
      return el("fieldset", { style: "border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:0" }, [
        el("legend", { style: "font-weight:700;padding:0 4px", text: m }), el("div", { class: "row" }, [...opts, none, skip])]);
    });
    const confirmBox = el("div", {});
    const submit = el("button", { class: "btn primary", type: "button", text: "제출 전 확인" });
    submit.addEventListener("click", () => {
      const summary = set.menus.map(m => `${m}: ${typeof answers[m] === "number" ? answers[m] + "점" : "빈칸"}`).join(", ");
      const ok = el("button", { class: "btn primary", type: "button", text: "이대로 한 번 기록" });
      ok.addEventListener("click", () => {
        if (locked) return; locked = true; ok.disabled = true;
        set.menus.forEach(m => setRows(voteSetKey).push({ alias, menu: m, score: typeof answers[m] === "number" ? answers[m] : null }));
        saveVotes();
        setTimeout(() => { locked = false; drawForm(); drawAgg(); }, 300);
      });
      confirmBox.replaceChildren(el("div", { class: "panel", style: "background:var(--yolk-soft)" }, [
        el("p", {}, [el("b", { text: `${alias} 응답 요약` }), ` ${summary}`]),
        el("div", { class: "row" }, [ok, el("button", { class: "btn", type: "button", text: "고치기", onclick: () => confirmBox.replaceChildren() })])
      ]));
    });
    formBox.replaceChildren(
      el("div", { class: "app-title", style: "font-size:22px", text: "급식 선호도 조사" }),
      el("p", { class: "notice", text: `응답 표식 ${alias} (실명 없이 자동 부여). 질문: 이 메뉴를 얼마나 좋아하나요? 1 전혀 좋아하지 않음, 5 매우 좋아함. 점수는 선호 응답이며 잔반 실측값이 아닙니다.` }),
      ...items, el("div", { class: "row c" }, submit), confirmBox);
  }
  function drawAgg() {
    const set = cur(), rows = setRows(voteSetKey), agg = aggregate(voteSetKey, set.menus);
    const sorted = agg.slice().sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    const confirmBox = el("div", { class: "row" });
    aggBox.replaceChildren(el("div", { class: "panel" }, [
      el("h3", {}, ["메뉴별 평균과 응답 수 ", el("small", { text: `응답자 ${new Set(rows.map(r => r.alias)).size}명` })]),
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["메뉴", "평균", "유효 응답", "빈칸"].map((h, i) => el("th", { class: i ? "num" : null, text: h })))),
        el("tbody", {}, sorted.map(a => el("tr", {}, [el("td", { text: a.m }), el("td", { class: "num", text: a.avg == null ? "계산 불가" : a.avg.toFixed(1) + "점" }), el("td", { class: "num", text: a.n + "건" }), el("td", { class: "num", text: String(a.blank) })])))
      ])),
      el("p", { class: "notice", text: "응답 수가 적은 메뉴의 평균은 변동 폭이 큽니다. 숫자만으로 메뉴나 조리하신 분을 평가하지 않습니다." }),
      el("details", {}, [el("summary", { text: `저장된 긴 표 (${rows.length}행)` }), el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["응답 표식", "메뉴", "점수"].map(h => el("th", { text: h })))),
        el("tbody", {}, rows.map(r => el("tr", {}, [el("td", { text: r.alias }), el("td", { text: r.menu }), el("td", { text: r.score == null ? "빈칸" : String(r.score) })])))
      ]))]),
      el("div", { class: "row" }, [
        voteSetKey === "practice" ? el("button", { class: "btn small", type: "button", text: "검토본 가상 응답 넣기", onclick: () => {
          votes.practice = [["연습01", 4, null, 2], ["연습02", 5, 5, 1], ["연습03", 3, null, 4]].flatMap(([a, ...s]) => PRACTICE.map((m, i) => ({ alias: a, menu: m, score: s[i] })));
          saveVotes(); drawForm(); drawAgg(); } }) : null,
        el("button", { class: "btn small", type: "button", text: "이 메뉴 묶음의 응답 비우기", onclick: () => {
          confirmBox.replaceChildren(el("span", { text: "이 메뉴 묶음의 가상 응답을 모두 지울까요?" }),
            el("button", { class: "btn small primary", type: "button", text: "지우기", onclick: () => { votes[voteSetKey] = []; saveVotes(); drawForm(); drawAgg(); } }),
            el("button", { class: "btn small", type: "button", text: "취소", onclick: () => confirmBox.replaceChildren() }));
        } }), confirmBox
      ])
    ]));
  }
  box.append(el("div", { class: "row" }, [el("label", { for: "vote-set", text: "메뉴 묶음" }), sel]), formBox);
  col.append(aggBox);
  if (voteSetKey === "practice" && !setRows("practice").length) {
    votes.practice = [["연습01", 4, null, 2], ["연습02", 5, 5, 1], ["연습03", 3, null, 4]].flatMap(([a, ...s]) => PRACTICE.map((m, i) => ({ alias: a, menu: m, score: s[i] })));
  }
  drawForm(); drawAgg();
};

/* ---------- 9단계: 비슷한 급식 입맛 찾기 (학생 7차시) ---------- */
function cosine(a, b) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const la = Math.sqrt(a.reduce((s, x) => s + x * x, 0)), lb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return la && lb ? { dot, la2: a.reduce((s, x) => s + x * x, 0), lb2: b.reduce((s, x) => s + x * x, 0), cos: dot / (la * lb) } : null;
}
APPS.s9 = (box, col) => {
  // 계산 예시 (검토본 S76~S77)
  const EX = { A: [5, 3, 1], B: [4, 2, 1], C: [1, 3, 5] };
  const ab = cosine(EX.A, EX.B), ac = cosine(EX.A, EX.C);
  box.append(
    el("div", { class: "app-title", style: "font-size:22px", text: "같은 메뉴 순서의 벡터" }),
    el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["가상 응답", "메뉴 1", "메뉴 2", "메뉴 3"].map((h, i) => el("th", { class: i ? "num" : null, text: h })))),
      el("tbody", {}, Object.entries(EX).map(([k, v]) => el("tr", {}, [el("td", { text: k }), ...v.map(x => el("td", { class: "num", text: String(x) }))])))
    ])),
    el("pre", { class: "code" }, el("code", { text:
`A·B = 5×4 + 3×2 + 1×1 = ${ab.dot}
두 길이의 곱 = √${ab.la2} × √${ab.lb2} = √${ab.la2 * ab.lb2}
A와 B의 코사인 = ${ab.dot}/√${ab.la2 * ab.lb2} ≈ ${ab.cos.toFixed(4)}
A·C = 5×1 + 3×3 + 1×5 = ${ac.dot}
A와 C의 코사인 = ${ac.dot}/√${ac.la2 * ac.lb2} = ${ac.dot}/${Math.sqrt(ac.la2 * ac.lb2)} ≈ ${ac.cos.toFixed(4)}` })),
    el("p", { class: "notice", text: "A와 B는 메뉴 1에 높은 별점을, 메뉴 3에 낮은 별점을 주어 방향이 비슷합니다. 모든 값이 양수이므로 0.54를 일반적인 유사성 기준으로 단정하지 않습니다. 0.9959는 친구 관계의 점수도, 건강 점수도 아닙니다." })
  );

  // 내 결과만 보기 (8단계 가상 응답)
  const mine = el("div", { style: "display:grid;gap:10px" });
  const sets = menuSets().filter(s => setRows(s.key).length);
  const panel = el("div", { class: "panel" }, [el("h3", {}, ["내 결과만 확인하기 ", el("small", { text: "8단계의 가상 응답 사용" })]), mine]);
  col.append(panel);
  if (!sets.length) { mine.append(el("p", { class: "notice", text: "8단계에 응답이 없습니다. 8단계에서 가상 응답을 넣은 뒤 다시 보세요." })); return; }
  const setSel = el("select", { id: "sim-set", class: "btn" }, sets.map(s => el("option", { value: s.key, text: s.label })));
  if (sets.some(s => s.key === voteSetKey)) setSel.value = voteSetKey;
  const meSel = el("select", { id: "sim-me", class: "btn" });
  const res = el("div", {});
  function fillMe() {
    const aliases = [...new Set(setRows(setSel.value).map(r => r.alias))];
    meSel.replaceChildren(...aliases.map(a => el("option", { value: a, text: a })));
    calc();
  }
  function calc() {
    const set = sets.find(s => s.key === setSel.value), rows = setRows(set.key), me = meSel.value;
    const scoreOf = (a, m) => { const r = rows.find(x => x.alias === a && x.menu === m); return r && typeof r.score === "number" ? r.score : null; };
    const others = [...new Set(rows.map(r => r.alias))].filter(a => a !== me);
    const results = []; let skipped = 0;
    others.forEach(o => {
      const common = set.menus.filter(m => scoreOf(me, m) != null && scoreOf(o, m) != null);
      if (common.length < 2) { skipped++; return; }
      results.push({ cos: cosine(common.map(m => scoreOf(me, m)), common.map(m => scoreOf(o, m))).cos, k: common.length });
    });
    results.sort((a, b) => b.cos - a.cos);
    res.replaceChildren(
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, [el("th", { text: "메뉴" }), ...set.menus.map(m => el("th", { class: "num", text: m }))])),
        el("tbody", {}, el("tr", {}, [el("td", { text: `${me} (나)` }), ...set.menus.map(m => el("td", { class: "num", text: scoreOf(me, m) ?? "빈칸" }))]))
      ])),
      results.length ? el("div", { class: "okbox" }, `다른 응답 ${results.length}개와 비교했습니다. 가장 방향이 비슷한 응답과의 코사인은 ${results[0].cos.toFixed(4)}이고, 공통 응답 메뉴는 ${results[0].k}개입니다.`)
                     : el("div", { class: "alert", text: "공통 응답이 2개 이상인 비교 대상이 없어 계산하지 않았습니다." }),
      skipped ? el("p", { class: "notice", text: `공통 응답이 2개보다 적은 ${skipped}개는 계산에서 뺐습니다. 미응답을 0점으로 바꾸지 않았습니다.` }) : null,
      results.length ? el("p", { class: "notice", text: `내 코사인 값들: ${results.map(r => r.cos.toFixed(3)).join(", ")}. 다른 사람의 이름과 별점은 보여 주지 않습니다. 이 값은 이번 메뉴 응답에만 해당하며 성격이나 친밀도를 뜻하지 않습니다.` }) : null
    );
  }
  setSel.addEventListener("change", fillMe); meSel.addEventListener("change", calc);
  mine.append(el("div", { class: "row" }, [el("label", { for: "sim-set", text: "메뉴 묶음" }), setSel]), el("div", { class: "row" }, [el("label", { for: "sim-me", text: "내 표식" }), meSel]), res);
  fillMe();
};

/* ---------- 10단계: 가장 많이 남길 반찬 예측 (학생 8차시, 교원 9~10차시) ---------- */
APPS.s10 = (box, col) => {
  // 작은 회귀 (S88~S90)
  const tr1 = [[1, 8], [2, 6], [3, 4], [4, 2]], te1 = [[1.5, 7.5], [3.5, 2.5]];
  const w1 = fitLinear(tr1.map(([x]) => [1, x]), tr1.map(([, y]) => y));
  const p1 = te1.map(([x]) => w1[0] + w1[1] * x);
  const mae1 = meanOf(te1.map(([, y], i) => Math.abs(y - p1[i])));
  const base1 = meanOf(tr1.map(([, y]) => y)), bmae1 = meanOf(te1.map(([, y]) => Math.abs(y - base1)));
  const r = runExp();
  box.append(
    el("div", { class: "app-title", style: "font-size:22px", text: "모의 잔반률 회귀" }),
    el("div", { class: "alert", text: "여기의 잔반률은 규칙으로 만든 모의값입니다. 실제 식단에서 관측한 잔반이나 학교 효과가 아닙니다." }),
    el("h3", { text: "1. 작은 회귀: 선호 점수 x로 잔반률 y 예측" }),
    el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["구분", "x", "모의 y", "예측", "절대 오차"].map((h, i) => el("th", { class: i > 1 ? "num" : null, text: h })))),
      el("tbody", {}, [
        ...tr1.map(([x, y], i) => el("tr", {}, [el("td", { text: `학습 ${i + 1}` }), el("td", { text: String(x) }), el("td", { class: "num", text: y + "%" }), el("td", { class: "num", text: "" }), el("td", { class: "num", text: "" })])),
        ...te1.map(([x, y], i) => el("tr", {}, [el("td", { text: `시험 ${i + 1}` }), el("td", { text: String(x) }), el("td", { class: "num", text: y + "%" }), el("td", { class: "num", text: pp(p1[i], 1) + "%" }), el("td", { class: "num", text: pp(Math.abs(y - p1[i]), 1) + "%p" })]))
      ])
    ])),
    el("p", {}, [`학습으로 얻은 직선: 예측 잔반률 = ${pp(w1[0])} − ${pp(-w1[1])}×x. 시험 MAE ${pp(mae1, 1)}%p, 학습 평균 ${pp(base1)}%만 예측하는 기준 모델의 시험 MAE ${pp(bmae1, 1)}%p.`]),
    el("h3", { text: "2. 메뉴 특성 세 개로 회귀 (학습 16행, 시험 4행)" }),
    el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["항목", "계수", "이 예제에서의 뜻"].map(h => el("th", { text: h })))),
      el("tbody", {}, [["절편", r.w[0], `모든 특성이 0이면 ${pp(r.w[0])}%`], ...r.feats.map((k, i) => [FEAT_LABEL[k], r.w[i + 1], `다른 입력이 같을 때 예측값 ${signed(r.w[i + 1])}%p`])]
        .map(([a, b, c], i) => el("tr", {}, [el("td", { text: a }), el("td", { class: "num", text: i ? signed(b) : pp(b) }), el("td", { text: c })])))
    ])),
    el("div", { class: "okbox", text: `시험 MAE ${pp(r.teMae, 2)}%p, 기준 모델(학습 평균 ${pp(r.base, 2)}% 예측) ${pp(r.baseMae, 2)}%p. 같은 시험 4행에서 비교한 값이며 가상 생성 규칙의 결과일 뿐입니다.` }),
    el("details", {}, [el("summary", { text: "학습 16행과 시험 4행 보기" }), el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["구분", "메뉴", "튀김", "매운맛", "국류", "모의 잔반률", "예측"].map((h, i) => el("th", { class: i > 1 ? "num" : null, text: h })))),
      el("tbody", {}, [...TRAIN.map(x => ["학습", x, null]), ...TEST.map((x, i) => ["시험", x, r.preds[i]])].map(([g, x, p]) => el("tr", {}, [
        el("td", { text: g }), el("td", { text: x.name }), el("td", { class: "num", text: String(x.fried) }), el("td", { class: "num", text: String(x.spicy) }), el("td", { class: "num", text: String(x.soup) }),
        el("td", { class: "num", text: pp(x.y, 1) + "%" }), el("td", { class: "num", text: p == null ? "" : pp(p, 2) + "%" })])))
    ]))])
  );
  // 특성 만들기 (교원 9차시): 실제 메뉴 이름에 규칙 적용
  const dishes = [...new Map(SNAP.flatMap(d => splitMenu(d.DDISH_NM).map(raw => [cleanDish(raw), raw]))).entries()];
  const cnt = k => dishes.filter(([n]) => featureOf(n, k) === "미확인").length;
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["특성 만들기 연습 ", el("small", { text: "실제 메뉴 이름, 교원 9차시" })]),
    el("p", { class: "notice", text: `저장된 실데이터 ${SNAP.length}일의 메뉴 ${dishes.length}개에 이름 규칙을 적용했습니다. 이름만으로 정하기 어려운 값은 미확인으로 둡니다(튀김 ${cnt("fried")}, 매운맛 ${cnt("spicy")}, 국류 ${cnt("soup")}). 이 분류는 실제 조리법을 확인한 결과가 아니며, 이 표의 자료는 위의 모의 회귀에 섞지 않습니다.` }),
    el("div", { class: "tablewrap", style: "max-height:320px;overflow:auto" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["원문", "정리", "튀김", "매운맛", "국류"].map(h => el("th", { text: h })))),
      el("tbody", {}, dishes.map(([n, raw]) => el("tr", {}, [el("td", { class: "mono", text: raw }), el("td", { text: n }), ...["fried", "spicy", "soup"].map(k => { const v = featureOf(n, k); return el("td", { class: "num" }, v === "미확인" ? el("span", { class: "pill wait", text: "미확인" }) : String(v)); })])))
    ]))
  ]), el("div", { class: "panel" }, [
    el("h3", { text: "범주를 숫자로 (원핫 인코딩)" }),
    el("div", { class: "tablewrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["가상 메뉴", "구이", "볶음", "찜"].map((h, i) => el("th", { class: i ? "num" : null, text: h })))),
      el("tbody", {}, [["메뉴 A: 구이", 1, 0, 0], ["메뉴 B: 볶음", 0, 1, 0], ["메뉴 C: 찜", 0, 0, 1]].map(rw => el("tr", {}, rw.map((c, i) => el("td", { class: i ? "num" : null, text: String(c) })))))
    ])),
    el("p", { class: "notice", text: "순서가 없는 조리 유형에 1, 2, 3 순위를 주지 않습니다. 전처리 규칙은 학습 자료에서 정한 뒤 시험 자료에도 똑같이 적용합니다." })
  ]));
};

/* ---------- 11단계: 모델 검증과 한계 (학생 9차시) ---------- */
const expLog = [];
APPS.s11 = (box, col) => {
  const rowsSel = el("select", { id: "exp-rows", class: "btn" }, [el("option", { value: "16", text: "학습 16행" }), el("option", { value: "8", text: "학습 8행" })]);
  const fchk = Object.keys(FEAT_LABEL).map(k => { const c = el("input", { type: "checkbox", id: "f-" + k, checked: true }); return [k, c, el("label", { for: "f-" + k, class: "row", style: "gap:4px" }, [c, FEAT_LABEL[k]])]; });
  const oh = el("input", { type: "checkbox", id: "f-oh" }), aug = el("input", { type: "checkbox", id: "f-aug" });
  const out = el("div", { style: "display:grid;gap:10px" });
  const logBox = el("div", {});
  let last = null;
  function cond() {
    const feats = fchk.filter(([, c]) => c.checked).map(([k]) => k);
    return { rows: Number(rowsSel.value), feats, onehot: oh.checked, aug: aug.checked };
  }
  function describe(c) {
    const parts = [];
    if (c.rows !== 16) parts.push(`학습 ${c.rows}행`);
    const miss = Object.keys(FEAT_LABEL).filter(k => !c.feats.includes(k));
    if (miss.length) parts.push(miss.map(k => FEAT_LABEL[k].replace(" 여부", "")).join(", ") + " 제외");
    if (c.onehot) parts.push("메뉴 이름 원핫 추가");
    if (c.aug) parts.push("같은 행 복사 2배");
    return parts.length ? parts.join(", ") : "변경 없음 (기본)";
  }
  function run() {
    const c = cond(), r = runExp(c);
    last = { c, r };
    if (!r) { out.replaceChildren(el("div", { class: "alert", text: "계수를 계산할 수 없습니다. 특성이나 행 수를 바꾸세요." })); return; }
    const gap = r.teMae - r.trMae;
    out.replaceChildren(
      el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["조건", "학습 행", "계수 수", "학습 MAE", "시험 MAE", "기준 모델"].map((h, i) => el("th", { class: i ? "num" : null, text: h })))),
        el("tbody", {}, el("tr", {}, [el("td", { style: "white-space:normal", text: describe(c) }), el("td", { class: "num", text: String(r.n) }), el("td", { class: "num", text: String(r.w.length) }),
          el("td", { class: "num", text: pp(r.trMae) + "%p" }), el("td", { class: "num", text: pp(r.teMae) + "%p" }), el("td", { class: "num", text: pp(r.baseMae) + "%p" })]))
      ])),
      el("p", { class: "notice", text: `계수: 절편 ${pp(r.w[0])}` + r.feats.map((k, i) => `, ${FEAT_LABEL[k]} ${signed(r.w[i + 1])}`).join("") + (r.names.length ? `, 메뉴 이름 열 ${r.names.length}개` : "") }),
      gap > 1 && r.trMae < 0.2 ? el("div", { class: "alert", text: "학습 오차는 거의 0인데 시험 오차가 큽니다. 학습 자료의 우연한 특징까지 맞추었을 수 있습니다(과적합)." }) : null,
      c.aug ? el("div", { class: "notice", text: "같은 행을 복사해 늘리면 행 수는 두 배가 되지만 새로운 관찰이 추가된 것은 아니어서 계수가 그대로입니다. 증강한 자료를 독립적인 실제 응답으로 세지 않습니다." }) : null
    );
  }
  function drawLog() {
    logBox.replaceChildren(el("div", { class: "panel" }, [
      el("h3", {}, ["실험 기록표 ", el("small", { text: "조건 하나와 결과 두 개" })]),
      expLog.length ? el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["실험", "바꾼 조건", "학습 MAE", "시험 MAE"].map((h, i) => el("th", { class: i > 1 ? "num" : null, text: h })))),
        el("tbody", {}, expLog.map((e, i) => el("tr", {}, [el("td", { text: i === 0 ? "기본" : String.fromCharCode(64 + i) }), el("td", { style: "white-space:normal", text: e.label }), el("td", { class: "num", text: pp(e.tr) + "%p" }), el("td", { class: "num", text: pp(e.te) + "%p" })])))
      ])) : el("p", { class: "notice", text: "아직 기록이 없습니다. 실행한 뒤 기록표에 추가하세요. 결과를 미리 적지 않습니다." }),
      el("p", { class: "notice", text: "이 수치는 이 페이지의 모의 자료에서 계산한 값입니다. 검토본의 Python 예제와 자료가 달라 수치가 다를 수 있으며, 늘 같은 순서가 되는 법칙도 아닙니다." }),
      expLog.length ? el("button", { class: "btn small", type: "button", text: "기록표 비우기", onclick: () => { expLog.length = 0; drawLog(); } }) : null
    ]));
  }
  [rowsSel, oh, aug, ...fchk.map(([, c]) => c)].forEach(x => x.addEventListener("change", run));
  box.append(
    el("div", { class: "app-title", style: "font-size:22px", text: "한 번에 한 조건만" }),
    el("div", { class: "row" }, [el("label", { for: "exp-rows", text: "학습 자료" }), rowsSel]),
    el("div", { class: "row" }, [el("span", { class: "notice", text: "특성" }), ...fchk.map(x => x[2])]),
    el("div", { class: "row" }, [el("label", { for: "f-oh", class: "row", style: "gap:4px" }, [oh, "메뉴 이름 원핫 추가(행마다 열 하나)"]), el("label", { for: "f-aug", class: "row", style: "gap:4px" }, [aug, "같은 행 복사로 2배"])]),
    out,
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "button", text: "기록표에 추가", onclick: () => { if (last && last.r) { expLog.push({ label: describe(last.c), tr: last.r.trMae, te: last.r.teMae }); drawLog(); } } }))
  );
  // 최소 최대 변환 (S100)
  const mm = [1, 2, 3], mn = Math.min(...mm), mx = Math.max(...mm);
  col.append(logBox, el("div", { class: "panel" }, [
    el("h3", { text: "변환 기준도 학습 자료에서" }),
    el("pre", { class: "code" }, el("code", { text: `학습값 [${mm.join(", ")}]: 최솟값 ${mn}, 최댓값 ${mx}\n변환 = (값 − ${mn}) ÷ (${mx} − ${mn})\n학습의 2 → ${pp((2 - mn) / (mx - mn))}\n새로운 값 4 → ${pp((4 - mn) / (mx - mn))}  (0~1 밖이어도 기준을 다시 계산하지 않음)` }))
  ]), el("div", { class: "panel" }, [
    el("h3", { text: "증강과 편향 질문" }),
    el("ul", { class: "added" }, ["원자료에 어떤 메뉴와 대상이 빠졌는가", "가상 자료를 만드는 규칙은 무엇인가", "증강 전후를 같은 시험 자료로 비교했는가", "새로운 실제 관찰이 필요한 부분은 무엇인가"].map(t => el("li", { text: t })))
  ]));
  run(); drawLog();
};

/* ---------- 12단계: 식단 개선안 (학생 10차시) ---------- */
const proposal = { fact: "", interp: "", idea: "", check: "", kinds: new Set(), stake: {}, peer: {} };
APPS.s12 = (box, col) => {
  // 앞 단계의 근거
  const ev = [];
  const sheetTopic = sheet.filter(r => r[2] === design.topic);
  if (sheetTopic.length) {
    const top = Object.entries(sheetTopic.reduce((a, r) => (a[r[3]] = (a[r[3]] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1])[0];
    ev.push({ kind: "가상", src: "4~5단계 모의 시트", text: `모의 시트의 ${design.topic} 월드컵 기록 ${sheetTopic.length}건 중 ${top[0]}의 우승이 ${top[1]}건이었다.` });
  } else ev.push({ kind: "가상", src: "6단계 가상 6건", text: "가상 응답 6건 중 사과 우승이 3건이었다." });
  const d3 = SNAP.find(r => r.MLSV_YMD === "20261103");
  ev.push({ kind: "실제", src: `NEIS 공개 API, 조회 ${SNAP_AT}`, text: `2026-11-03 당곡고 중식은 메뉴 ${splitMenu(d3.DDISH_NM).length}개, ${d3.CAL_INFO}였다.` });
  const vs = menuSets().find(s => setRows(s.key).length);
  if (vs) {
    const a = aggregate(vs.key, vs.menus).filter(x => x.avg != null).sort((x, y) => x.avg - y.avg)[0];
    if (a) ev.push({ kind: "가상", src: "8단계 별점 조사", text: `${vs.label}에서 ${a.m}의 평균 별점이 ${pp(a.avg, 1)}점(${a.n}건)으로 가장 낮았다.` });
  }
  const rr = runExp();
  ev.push({ kind: "모의", src: "10단계 모의 회귀", text: `모의 잔반률 회귀에서 튀김 여부 계수는 ${signed(rr.w[1])}%p, 시험 MAE는 ${pp(rr.teMae)}%p였다.` });

  const fields = [
    ["fact", "확인한 사실", "[자료, 기간, 건수]에서 [관찰]을 확인했다."],
    ["interp", "조심스러운 해석", "[조건]에서는 [가능성]을 생각할 수 있다."],
    ["idea", "작은 제안", "[범위]에서 [작은 변화]를 검토해 보고 싶다."],
    ["check", "먼저 확인", "[측정, 관계자 협의, 운영 조건]이 필요하다."]
  ];
  const preview = el("div", {});
  const OVER = ["반드시", "항상", "무조건", "학교 전체", "모든 학생", "확실히", "틀림없이"];
  const inputs = {};
  function drawPreview() {
    const all = fields.map(([k]) => proposal[k]).join(" ");
    const over = OVER.filter(w => all.includes(w));
    const prelim = [...proposal.kinds].some(k => k !== "실제");
    const stakeDone = Object.values(proposal.stake).filter(Boolean).length;
    preview.replaceChildren(el("div", { class: "panel", style: "background:var(--bg)" }, [
      el("div", { class: "row" }, [el("h3", { text: "식단 개선 제안서" }), prelim ? el("span", { class: "pill wait", text: "예비 제안" }) : null]),
      prelim ? el("p", { class: "notice", text: "가상값이나 모의 결과를 근거로 사용했습니다. 실제 측정 자료가 생기기 전까지는 예비 제안이며, 학교의 승인이나 실제 시행을 뜻하지 않습니다." }) : null,
      ...fields.map(([k, t]) => el("p", {}, [el("b", { text: t + ": " }), proposal[k] || "(아직 쓰지 않음)"])),
      over.length ? el("div", { class: "alert", text: `단정 표현을 찾았습니다: ${over.join(", ")}. 수집한 자료의 범위에 맞게 고쳐 씁니다.` }) : el("div", { class: "okbox", text: "단정 표현이 보이지 않습니다." }),
      el("p", { class: "notice", text: `이해관계자 검토 ${stakeDone}/4` })
    ]));
  }
  box.append(
    el("div", { class: "app-title", style: "font-size:22px", text: "식단 개선안 쓰기" }),
    el("div", { class: "field" }, [el("label", { text: "앞 단계의 근거 (누르면 확인한 사실에 넣습니다)" }),
      el("div", { style: "display:grid;gap:6px" }, ev.map(e => el("button", { class: "btn", type: "button", style: "text-align:left", onclick: () => {
        proposal.fact = (proposal.fact ? proposal.fact + " " : "") + e.text; proposal.kinds.add(e.kind); inputs.fact.value = proposal.fact; drawPreview(); } },
        [el("span", { class: "pill " + (e.kind === "실제" ? "ok" : "wait"), text: e.kind }), " ", e.text, el("span", { class: "notice", style: "display:block;background:none;padding:2px 0 0", text: "출처: " + e.src })])))]),
    ...fields.map(([k, t, ph]) => {
      const i = el("input", { type: "text", id: "prop-" + k, value: proposal[k], placeholder: ph });
      i.addEventListener("input", () => { proposal[k] = i.value; drawPreview(); });
      inputs[k] = i;
      return el("div", { class: "field" }, [el("label", { for: "prop-" + k, text: t }), i]);
    }),
    el("div", { class: "row" }, el("button", { class: "btn small", type: "button", text: "근거 표시 초기화", onclick: () => { proposal.kinds.clear(); drawPreview(); } })),
    preview
  );
  const stakes = [["student", "학생: 선택의 다양성과 참여 부담"], ["nutri", "영양교사: 영양 균형과 식단 운영 조건"], ["cook", "조리 종사자: 조리 과정, 안전, 업무 부담"], ["school", "학교: 실행 가능성과 자료 활용 범위"]];
  const rubric = [["problem", "문제 정의", "누구의 어떤 문제인지 분명한가"], ["data", "자료 근거", "출처, 대상, 기간, 가상 여부가 보이는가"], ["scope", "해석의 범위", "한계와 불확실성을 말했는가"], ["plan", "실행 계획", "현장 협의, 측정, 부작용 확인이 있는가"]];
  col.append(el("div", { class: "panel" }, [
    el("h3", {}, ["이해관계자 검토 ", el("small", { text: "직접 듣지 않은 의견은 들은 것처럼 쓰지 않기" })]),
    el("ul", { class: "checks" }, stakes.map(([k, t]) => el("li", {}, el("label", { for: "st-" + k }, [
      (() => { const c = el("input", { type: "checkbox", id: "st-" + k, checked: !!proposal.stake[k] }); c.addEventListener("change", () => { proposal.stake[k] = c.checked; drawPreview(); }); return c; })(),
      el("span", { text: t })]))))
  ]), el("div", { class: "panel" }, [
    el("h3", {}, ["동료 평가 ", el("small", { text: "사람 대신 주장과 자료를 검토" })]),
    ...rubric.map(([k, t, q]) => el("fieldset", { style: "border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:0" }, [
      el("legend", { style: "font-weight:700;padding:0 4px", text: t }), el("p", { class: "notice", style: "background:none;padding:0", text: q }),
      el("div", { class: "row" }, ["충분", "보완", "다시 검토"].map(v => el("label", { class: "row", style: "gap:4px" }, [
        (() => { const rd = el("input", { type: "radio", name: "peer-" + k, value: v, checked: proposal.peer[k] === v }); rd.addEventListener("change", () => proposal.peer[k] = v); return rd; })(), v])))
    ])),
    el("p", { class: "notice", text: "모의 자료를 실제 성과처럼 주장한 경우 다시 검토로 분류합니다. 점수와 배점은 교사가 수업 운영 기준에 맞게 정합니다." })
  ]));
  drawPreview();
};


const LESSONS = [{"no": 1, "title": "이상형 월드컵 만나기", "sub": "치킨 월드컵 체험과 내 주제 설계", "group": 1, "goals": ["월드컵 결과를 친구와 비교하고 서로 다른 선택의 이유를 설명할 수 있다.", "내가 조사하고 싶은 주제를 정하고 비교할 항목과 선택 기준을 만들 수 있다."], "flow": [["질문 열기", "좋아하는 메뉴와 남기는 메뉴"], ["월드컵 규칙", "두 항목 중 하나를 고릅니다"], ["치킨 월드컵 8강", "각 줄에서 하나씩 선택해요"], ["치킨 월드컵 4강", "내가 고른 네 항목이 다시 만나요"], ["치킨 월드컵 결승", "오늘 나의 우승 항목은?"], ["결과를 기록하는 방법", "선택과 이유를 함께 남겨요"], ["짝과 비교하기", "같은 결과라도 이유가 다를 수 있어요"], ["결과를 해석할 때", "한 번의 우승만으로 알 수 없는 것"], ["주제의 조건", "친구들이 편하게 고를 수 있는 주제"], ["주제 설계 예시", "예시: 학교에서 먹고 싶은 과일"], ["내 주제 설계하기", "다음 차시에 만들 앱의 설계 메모"], ["짝과 설계 점검", "내 질문이 잘 전달되는지 확인해요"], ["다음 차시와 연결", "다음에는 내 월드컵을 직접 만듭니다"]], "wrap": ["나와 짝의 선택에서 발견한 점 적기", "내 월드컵의 질문 적기", "다음 차시에 꼭 구현하고 싶은 기능 적기"], "teacherNotes": ["예제 HTML 실행, 다음 라운드, 다시하기 동작 확인", "앱 실행이 어려우면 8강 대진표와 개인 메모 사용", "주제 선택과 결과 공개는 자율, 실명 정보 수집 없음", "활동 시간 45분과 모둠 규모를 현장에 맞춰 사전 점검"], "stages": ["s1"], "teacher": []}, {"no": 2, "title": "내 월드컵 만들기", "sub": "한 경기 화면에서 토너먼트까지", "group": 1, "goals": ["내 주제와 후보로 두 항목 선택 화면을 만들 수 있다.", "선택한 항목만 다음 라운드로 올라가는지 확인하고 수정할 수 있다."], "flow": [["첫 번째 요청", "화면과 동작을 나누어 요청해요"], ["첫 프롬프트 쓰기", "내 주제를 넣어 그대로 요청해 봐요"], ["수정 요청 연습", "‘안 돼요’를 재현 가능한 설명으로"], ["기능을 하나씩 추가", "화면이 되면 라운드를 연결해요"], ["동작 시험", "성공한 화면보다 작동 순서를 확인해요"]], "wrap": ["산출물: 내 주제의 월드컵 앱 초안", "고른 후보가 어떤 목록에 남는지 설명하기", "수정 요청 전후에 달라진 점 한 가지 기록하기"], "teacherNotes": ["학교에서 허용한 생성형 AI 사용 조건 확인", "브라우저 미리보기와 로컬 HTML 실행 사전 시험", "AI 직접 사용이 어려우면 교사 예제 수정으로 대체", "외부 배포, 공유는 수업 운영 승인 범위에서 별도 진행"], "stages": ["s2", "s3"], "teacher": ["교원 2~3차시"]}, {"no": 3, "title": "친구들과 데이터 모으기", "sub": "기록을 저장하고 시트로 모으기", "group": 1, "goals": ["친구들의 월드컵 결과를 개인 식별 정보 없이 기록할 수 있다.", "한 사람의 응답 한 건을 표의 한 행으로 정리하고 누락을 확인할 수 있다."], "flow": [["수집 설계", "먼저 기록할 항목을 정해요"], ["한 행의 의미", "가상 응답 3건을 표로 옮겨 봐요"], ["짝 활동 순서", "사용자와 기록 확인자 역할을 바꿔요"], ["체험과 기록", "친구가 직접 고른 결과를 기록해요"], ["자료 점검", "빈칸과 중복을 먼저 확인해요"]], "wrap": ["산출물: 결과 표와 수집 규칙", "한 행과 한 열이 무엇을 뜻하는지 설명하기", "누락, 중복을 처리한 근거를 기록하기"], "teacherNotes": ["시트 연동은 교사가 승인된 환경에서 사전 준비", "이번 제작 중 학생 정보 수집, 전송은 실행하지 않음", "별명과 실명을 연결하는 명단은 만들지 않음", "연동 실패 시 교사 제공 가상 표로 활동 가능"], "stages": ["s4", "s5"], "teacher": ["교원 4~6차시"]}, {"no": 4, "title": "모은 데이터 분석하기", "sub": "우승 빈도 표와 막대그래프", "group": 1, "goals": ["항목별 선택 빈도를 표와 그래프로 나타낼 수 있다.", "예상과 다른 결과를 근거로 설명하고 작은 표본의 한계를 말할 수 있다."], "flow": [["분석 질문", "어떤 항목이 자주 우승했을까요?"], ["표와 그래프", "가상 자료로 집계 방법을 확인해요"], ["막대그래프 만들기", "표의 수가 막대의 높이가 됩니다"], ["집계에서 해석으로", "세 문장으로 결과를 설명해요"], ["결과 해석", "예상과 다른 점을 설명해요"]], "wrap": ["산출물: 집계 표, 그래프, 해석 문장", "막대 길이와 원본 건수가 맞는지 확인하기", "관찰과 추측을 구분하고 한계 한 가지 적기"], "teacherNotes": ["실제 수집 자료의 공유 범위, 동의 확인", "가상 예시와 실제 자료는 파일명, 표제로 구분", "자동 그래프라도 집계 수를 원본과 대조", "시각화 도구는 학교에서 허용한 것으로 선택"], "stages": ["s6"], "teacher": ["교원 7차시"]}, {"no": 5, "title": "API로 급식 데이터 수집", "sub": "NEIS 급식 API의 요청과 응답", "group": 2, "goals": ["공공데이터의 요청 조건과 응답을 구분할 수 있다.", "급식일, 메뉴 등 필요한 값을 분석용 표로 정리하고 출처를 남길 수 있다."], "flow": [["API의 역할", "조건을 보내면 정해진 형식의 자료를 받아요"], ["API 요청 읽기", "조건 이름과 값을 구분해요"], ["실제 요청 조건", "당곡고의 하루 중식을 조회해요"], ["실제 응답 읽기", "공개 식단 1건에서 확인한 값"], ["없음과 잘림 처리", "응답이 왔다고 수집이 끝난 것은 아니에요"], ["실데이터 실습 시작", "날짜를 정하고 공개 API를 조회해요"], ["안정성 확인", "실패와 취소도 실습의 일부입니다"], ["응답 읽기", "메뉴 한 줄은 어떤 값일까요?"], ["데이터 성격", "식단과 선호와 잔반은 다른 자료예요"], ["수집과 정리", "작은 기간부터 결과를 확인해요"], ["장애 대비 연습", "연결이 막히면 모의 자료로 구조를 익혀요"]], "wrap": ["산출물: 출처를 붙인 급식 정리 표", "요청 조건과 응답 항목을 각각 설명하기", "메뉴와 잔반량을 구분하고 없는 항목 표시하기"], "teacherNotes": ["원격 실습 전에 계정, 접속, 학교 정책 확인", "NEIS 공식 문서의 최신 필드, 제한을 수업 전 재확인", "인증키를 HTML, 학생 프롬프트, 공개 저장소에 노출하지 않음", "접속 불가 시 교사 제공 비식별 샘플 표 사용"], "stages": ["s7"], "teacher": ["교원 8차시"]}, {"no": 6, "title": "급식 선호도 조사 앱 만들기", "sub": "메뉴별 별점과 응답 수", "group": 2, "goals": ["메뉴별 별점을 입력하는 화면을 만들 수 있다.", "개인 식별 정보 없이 기록을 모으고 메뉴별 평균과 응답 수를 확인할 수 있다."], "flow": [["투표 화면", "메뉴마다 같은 기준으로 별점을 받아요"], ["별점 화면 요청", "공통 질문과 미응답 처리를 함께 써요"], ["저장 형식 확인", "한 메뉴 응답을 한 행으로 정해요"], ["시트 연동", "보낸 한 건이 표에 저장되는지 확인해요"], ["평균과 순위", "평균 옆에 응답 수도 함께 써요"]], "wrap": ["산출물: 투표 앱, 시트, 메뉴별 집계", "미응답과 0점을 구분했는지 확인하기", "평균과 응답 수를 함께 제시하기"], "teacherNotes": ["6차시 시간 확인 필요: 표기45분, 공용 세부 합계50분", "원계획 배분5+13+14+8+5와 공용5+18+14+8+5 보존", "시간을 임의 확정하지 않고 검토본으로 유지", "학교 Google 계정과 Apps Script 권한, 배포 사전 점검"], "stages": ["s8"], "teacher": []}, {"no": 7, "title": "비슷한 급식 입맛 찾기", "sub": "별점 벡터와 코사인 유사도", "group": 2, "goals": ["메뉴별 별점을 같은 순서의 벡터로 표현할 수 있다.", "유사도 결과를 해석하고 작은 데이터와 프라이버시의 한계를 설명할 수 있다."], "flow": [["벡터로 나타내기", "같은 메뉴 순서로 숫자를 나열해요"], ["계산 전 예측", "세 메뉴의 가상 별점 벡터"], ["코사인 계산 예시", "곱의 합을 두 길이의 곱으로 나눠요"], ["숫자를 사람 평가로 바꾸지 않기", "비슷함은 이번 메뉴 응답에만 해당해요"], ["유사도 계산", "코사인 유사도는 방향을 비교해요"], ["결과 공개 범위", "내 결과만 확인하며 한계를 적어요"]], "wrap": ["산출물: 벡터 표, 유사도 해석 기록", "열 순서가 다른 표를 바로 비교하면 안 되는 이유", "내 결과 공개 범위와 한계 한 가지"], "teacherNotes": ["원격 실습은 가상 데이터로 먼저 동작 점검", "학생 개인별 유사도는 본인에게만 제공", "별명으로도 재식별 가능하면 공개 범위를 더 제한", "사용 도구, 계산식, 결측값 처리 방식 기록"], "stages": ["s9"], "teacher": []}, {"no": 8, "title": "가장 많이 남길 반찬 예측하기", "sub": "메뉴 특성과 모의 잔반 회귀", "group": 2, "goals": ["메뉴 특성과 예측할 잔반 값을 구분할 수 있다.", "학습, 시험 자료를 나눠 회귀 모델을 만들고 결과와 계수를 해석할 수 있다."], "flow": [["예측 문제 정의", "입력과 정답을 구분해요"], ["범주를 숫자로", "원핫 인코딩으로 범주를 구분해요"], ["학습과 시험", "처음 보는 자료로 예측을 확인해요"], ["작은 회귀 실습", "학습용 모의 자료로 직선을 맞춰요"], ["시험 오차 계산", "학습에 쓰지 않은 두 값을 비교해요"], ["기준 모델과 비교", "복잡한 모델이 꼭 더 좋은 것은 아니에요"], ["계수 해석", "계수의 방향과 조건을 함께 읽어요"], ["메뉴 특성 회귀 실행", "세 가지 특성으로 실제 학습을 실행해요"], ["메뉴 회귀 결과 읽기", "계수의 단위와 조건을 함께 설명해요"]], "wrap": ["산출물: 모델, 시험 성능, 계수 기록", "입력과 목표값의 출처를 각각 설명하기", "모의 잔반과 실제 학교 결과를 구분하기"], "teacherNotes": ["실습 앱과 샘플 데이터는 현장 실행 전 별도 검증", "자료 미확보 시 모의값임을 표, 그래프에 계속 표시", "테스트 자료가 학습 과정에 새지 않도록 분리", "실제 잔반 수집은 제공자, 학교와 활용 범위 합의 후"], "stages": ["s10"], "teacher": ["교원 9~10차시"]}, {"no": 9, "title": "모델 검증과 한계", "sub": "과적합, 증강, 편향 비교 실험", "group": 2, "goals": ["학습 성능과 시험 성능을 비교해 과적합을 설명할 수 있다.", "특성과 자료를 바꾼 실험을 비교하고 편향이 남는 이유를 설명할 수 있다."], "flow": [["비교 실험", "한 번에 한 조건만 바꾸어 봐요"], ["실험 기록표", "조건 하나와 결과 두 개를 함께 남겨요"], ["단위와 정규화", "변환 기준도 학습 자료에서 정해요"], ["같은 예제 비교", "학습 자료와 특성을 바꿔 확인해요"], ["과적합 읽기", "학습에서는 좋은데 시험에서는?"], ["증강과 편향", "자료를 늘려도 빠진 메뉴, 대상은 남아요"]], "wrap": ["산출물: 조건별 비교 표, 검증 기록, 한계", "학습 성능만 높은 모델의 위험 설명하기", "더 필요한 자료와 다음 검증 한 가지 제안하기"], "teacherNotes": ["학생 실험 결과를 사전에 정해 놓지 않음", "모의 자료 생성 규칙과 난수 조건 보존", "시험 자료를 반복 튜닝에 사용한 한계도 기록", "표본 편향, 측정 오류, 과적합을 구분해서 지도"], "stages": ["s11"], "teacher": []}, {"no": 10, "title": "식단 개선안 설계와 발표", "sub": "근거와 한계를 담은 제안서", "group": 3, "goals": ["자료의 근거와 한계를 함께 제시하는 식단 개선안을 만들 수 있다.", "학생과 급식 관계자의 입장을 고려해 실천, 검증 계획을 발표할 수 있다."], "flow": [["제안의 구조", "문제, 근거, 실천 방법을 연결해요"], ["이해관계자 검토", "같은 문제를 다른 입장에서 봐요"], ["발표와 피드백", "확인한 사실과 제안을 구분해요"], ["제안서 쓰기", "사실, 해석, 제안, 확인을 나누어 써요"], ["동료 평가", "근거와 실행 가능성을 점검해요"]], "wrap": ["산출물: 식단 개선 제안서, 발표자료, 성찰지", "근거와 주장 사이에 비약이 없는지 점검하기", "실제 실행 전 필요한 협의와 추가 자료 적기"], "teacherNotes": ["종합평가: 문제 정의, 자료 처리, 모델 해석, 윤리 협업", "실제 성능과 가상 예시를 발표에서 구분", "교외 전송, 실제 식단 변경은 이번 제작 범위 밖", "원본 자료와 수정본을 날짜, 버전별 보존"], "stages": ["s12"], "teacher": []}];
const CONTENT = [
 {
  "no": 1,
  "why": "같은 메뉴를 골라도 선택한 이유는 다를 수 있습니다. 치킨 월드컵에서 자신의 선택을 기록하고 친구와 비교합니다. 이 경험을 바탕으로 직접 조사할 질문과 후보를 정합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "좋아하는 메뉴와 선택 기준을 생각합니다."
   },
   {
    "part": "활동",
    "min": 10,
    "what": "치킨 월드컵에서 선택과 이유를 기록합니다."
   },
   {
    "part": "활동",
    "min": 8,
    "what": "짝과 선택 이유를 비교하고 결과의 한계를 찾습니다."
   },
   {
    "part": "활동",
    "min": 15,
    "what": "내 월드컵을 설계하고 짝의 의견으로 보완합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "문제를 풀고 선택 근거를 설명합니다."
   },
   {
    "part": "정리와 공유",
    "min": 7,
    "what": "공유에 동의한 내용을 설명하고 다음 차시에 사용할 설계를 확인합니다."
   }
  ],
  "opening": {
   "questions": [
    "급식에서 기억에 남는 메뉴는 무엇이며, 어떤 점이 좋았습니까?",
    "같은 메뉴를 고른 친구와 선택 이유도 같을까요?",
    "우승 항목을 알면 다른 후보를 얼마나 좋아하는지도 알 수 있을까요?"
   ],
   "expect": "교사용: 맛, 식감, 익숙함처럼 서로 다른 기준이 나올 수 있습니다. 선택에 정답을 정하지 않고, 고른 이름과 이유를 함께 기록하도록 안내합니다."
  },
  "activities": [
   {
    "title": "치킨 월드컵 체험",
    "min": 10,
    "steps": [
     {
      "st": "① 선택 기준 정하기",
      "text": "급식에서 기억에 남는 메뉴와 좋아하는 이유를 생각합니다. 맛이나 식감처럼 자신이 중요하게 생각하는 기준을 적습니다."
     },
     {
      "st": "② 결과 예측과 8강 선택",
      "text": "후라이드, 양념, 간장, 허니, 마늘, 매콤, 치즈, 숯불 중 우승할 것 같은 후보를 먼저 적습니다. 이 앱으로 치킨 월드컵을 해 보며 두 후보 중 하나씩 고르고 선택한 이름과 이유를 기록합니다."
     },
     {
      "st": "③ 4강과 결승 선택",
      "text": "앞 경기에서 고른 후보가 다음 라운드에 나오는지 확인합니다. 처음의 선택 기준과 지금의 기준이 달라졌다면 어느 경기에서 달라졌는지 표시합니다."
     },
     {
      "st": "④ 내 결과 확인",
      "text": "7번의 선택을 마친 뒤 우승 항목과 마지막 선택이 일치하는지 확인합니다. 모르는 맛을 상상해서 골랐다면 그 사실도 기록합니다."
     }
    ],
    "worksheet": [
     {
      "label": "선택 기준과 예상",
      "placeholder": "중요하게 생각한 기준은 ______입니다. 예상 우승 후보는 ______이며, 이유는 ______입니다."
     },
     {
      "label": "경기별 선택 기록",
      "placeholder": "라운드와 경기: ______ / 비교한 후보: ______, ______ / 선택: ______ / 이유: ______"
     },
     {
      "label": "결과 대조",
      "placeholder": "예상 우승 후보는 ______, 내가 고른 실제 우승 후보는 ______입니다. 기준이 달라진 경기는 ______이며, 달라진 이유는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "선택과 이유의 기록",
     "text": "이름이나 학번 없이 내 활동지에 기록합니다. 오늘은 외부 시트로 전송하지 않습니다."
    },
    "app": "s1"
   },
   {
    "title": "짝과 선택 이유 비교",
    "min": 8,
    "steps": [
     {
      "st": "① 공유할 내용 선택",
      "text": "내 기록에서 짝에게 설명하고 싶은 선택과 이유를 고릅니다. 결과를 공개할지는 스스로 결정합니다."
     },
     {
      "st": "② 같은 점과 다른 점 비교",
      "text": "공유에 동의한 내용으로 우승 항목과 선택 기준을 비교합니다. 같은 결과라도 이유가 같은지 확인합니다."
     },
     {
      "st": "③ 설명의 근거 확인",
      "text": "짝의 말을 듣고 선택 기준이 드러나는 부분을 내 말로 설명합니다. 상대의 선택을 평가하지 않고, 설명이 맞는지 짝에게 확인합니다."
     },
     {
      "st": "④ 추가 질문 작성",
      "text": "대진표나 그날의 기분이 달랐다면 결과가 바뀔지 생각합니다. 한 번의 우승만으로 알기 어려운 내용을 질문으로 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "비교 기록",
      "placeholder": "공유에 동의한 내용에서 같은 점은 ______이며, 다른 점은 ______입니다."
     },
     {
      "label": "이유 확인",
      "placeholder": "짝의 선택 기준을 ______라고 이해했습니다. 짝에게 확인한 뒤 ______로 보완했습니다."
     },
     {
      "label": "더 알아볼 질문",
      "placeholder": "이번 결과만으로 ______는 알기 어렵습니다. 더 알아보려면 ______를 확인하고 싶습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "결과 해석의 범위",
     "text": "몇 명의 결과만으로 전교생의 선호를 설명하기는 어렵습니다. 우승 항목 하나만으로는 각 후보를 얼마나 좋아하는지 알 수 없습니다."
    }
   },
   {
    "title": "내 월드컵 설계",
    "min": 15,
    "steps": [
     {
      "st": "① 주제와 질문 설정",
      "text": "조사하고 싶은 주제와 질문을 적습니다. 과일을 주제로 한다면 학교 간식으로 어떤 과일을 더 좋아하는지 물을 수 있습니다."
     },
     {
      "st": "② 후보와 선택 기준 작성",
      "text": "같은 기준으로 비교할 수 있는 후보 8개를 적습니다. 무엇을 기준으로 고를지도 함께 씁니다."
     },
     {
      "st": "③ 짝의 설계 점검",
      "text": "질문이 분명한지, 후보가 겹치지 않는지 짝의 의견을 듣습니다. 짝은 질문을 읽고 무엇을 고르는 활동인지 설명한 뒤, 고치면 좋을 부분과 이유를 말합니다."
     },
     {
      "st": "④ 설계 수정과 보관",
      "text": "받은 의견을 반영할지 판단하고 수정한 부분과 이유를 적습니다. 주제, 질문, 후보 8개, 선택 기준을 정리해 다음 차시에 사용합니다."
     }
    ],
    "worksheet": [
     {
      "label": "주제와 조사 질문",
      "placeholder": "내 주제는 ______입니다. 알아보고 싶은 질문은 ‘______?’입니다."
     },
     {
      "label": "후보와 기준",
      "placeholder": "후보 8개: ______ / 참여자는 ______를 기준으로 고릅니다."
     },
     {
      "label": "짝 점검과 수정",
      "placeholder": "짝의 의견은 ______입니다. ______를 ______로 고쳤으며, 이유는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "설계의 필수 조건",
     "text": "질문만 읽어도 무엇을 고르는지 알 수 있어야 합니다. 외모, 성적, 가족 형편을 다루거나 친구나 선생님의 순위를 매기는 주제는 피하며, 이름, 학번, 연락처, 건강정보를 묻는 항목도 넣지 않습니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "대진표 변경 검토",
    "text": "내 설계에서 후보는 유지하고 처음 만나는 상대를 바꾸어 봅니다. 우승이 달라질 수 있는 이유와 확인에 필요한 기록을 적습니다."
   },
   {
    "title": "질문 표현 비교",
    "text": "같은 후보를 두고 ‘지금 먹고 싶은 것’과 ‘학교 간식으로 먹고 싶은 것’을 각각 물으면 선택이 달라질지 생각합니다. 조사 목적에 맞는 질문을 고르고 이유를 씁니다."
   }
  ],
  "quiz": [
   {
    "q": "후보 8개로 시작하는 월드컵에서 우승 항목이 정해질 때까지 선택하는 횟수는 얼마입니까?",
    "options": [
     "전체 경기에서 선택하는 횟수는 모두 7번",
     "8강에서만 선택하는 횟수는 8번",
     "후보마다 한 번씩 선택하므로 모두 8번",
     "후보마다 두 번씩 선택하는 방식이므로 모두 16번"
    ],
    "answer": 0,
    "explain": "8강에서 4번, 4강에서 2번, 결승에서 1번 선택합니다."
   },
   {
    "q": "짝과 우승 항목이 같았을 때 적절한 해석은 무엇입니까?",
    "options": [
     "다른 후보의 선호 순서도 같다고 판단합니다.",
     "같은 기준으로 선택했으므로 다른 대진표에서도 우승이 같다고 판단합니다.",
     "우승 항목이 같아도 선택한 이유는 다를 수 있습니다.",
     "다음 급식에서도 두 사람이 남기는 양이 같다고 판단합니다."
    ],
    "answer": 2,
    "explain": "같은 우승 항목을 골라도 중요하게 생각한 기준은 다를 수 있습니다. 결과와 이유를 함께 비교합니다."
   },
   {
    "q": "다음 차시 앱 제작에 사용할 설계 메모로 적절한 것은 무엇입니까?",
    "options": [
     "친구의 이름과 외모 순위를 적습니다.",
     "앱에서 사용할 질문, 후보, 선택 기준을 적습니다.",
     "우승 항목만 기록하고 조사에 사용할 질문은 작성하지 않습니다.",
     "친구의 연락처와 건강정보를 모아 후보 설명에 자세히 적습니다."
    ],
    "answer": 1,
    "explain": "주제와 질문, 같은 기준으로 비교할 후보 8개, 선택 기준을 정리합니다. 개인을 알아볼 수 있는 정보는 넣지 않습니다."
   }
  ],
  "check": [
   "월드컵에서 선택한 항목과 이유를 기록할 수 있다.",
   "나와 짝의 선택에서 같은 점과 다른 점을 설명할 수 있다.",
   "조사할 질문과 후보 8개, 선택 기준을 정할 수 있다."
  ],
  "terms": [
   {
    "term": "후보",
    "def": "비교하고 선택할 대상"
   },
   {
    "term": "선택 기준",
    "def": "후보 중 하나를 고를 때 판단의 근거로 삼는 조건"
   },
   {
    "term": "대진표",
    "def": "어떤 후보끼리 비교하는지 정리한 표"
   },
   {
    "term": "선호",
    "def": "다른 대상보다 더 좋아하거나 선택하려는 경향"
   }
  ],
  "teacher": [
   {
    "issue": "선택 이유를 쓰기 어려운 경우",
    "response": "맛, 식감, 익숙함 중 자신의 선택과 관계있는 기준을 찾도록 돕습니다. 먹어 보지 않았다면 상상한 선호라고 기록하도록 안내합니다."
   },
   {
    "issue": "개인 결과 공유를 원하지 않는 경우",
    "response": "공유를 강요하지 않고 자신의 기록에서 기준이 달라진 부분을 찾아 적게 합니다. 짝과는 개인 결과 대신 조사 질문의 명확성을 점검할 수 있습니다."
   },
   {
    "issue": "후보가 떠오르지 않는 경우",
    "response": "같은 범주에서 먼저 생각나는 후보를 적고 겹치는 이름을 확인하게 합니다. 앱이 열리지 않으면 종이 대진표로 선택과 이유를 기록합니다."
   },
   {
    "issue": "시간 배분 확인",
    "response": "도입 5분, 체험 10분, 비교 8분, 설계 15분, 확인 문제 5분, 정리 7분으로 진행합니다."
   }
  ]
 },
 {
  "no": 2,
  "why": "AI에게 앱을 요청하려면 만들 화면과 필요한 동작을 구체적으로 설명해야 합니다. 먼저 두 후보 중 하나를 고르는 화면을 만들고 라운드를 연결합니다. 직접 실행한 결과를 바탕으로 수정 요청을 작성합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "설계 메모와 첫 화면의 성공 조건을 확인합니다."
   },
   {
    "part": "활동",
    "min": 12,
    "what": "한 경기 화면을 만들고 입력 방법을 시험합니다."
   },
   {
    "part": "활동",
    "min": 13,
    "what": "토너먼트를 연결하고 정해진 선택 순서로 시험합니다."
   },
   {
    "part": "활동",
    "min": 10,
    "what": "관찰한 문제를 기록하고 수정 전후를 비교합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "화면, 동작, 오류 기록을 구분하는 문제를 풉니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "시험 결과와 아직 확인하지 못한 동작을 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "지난 시간의 설계 메모에서 AI에게 알려 주어야 할 내용은 무엇입니까?",
    "후보 버튼이 보이면 앱이 잘 작동한다고 판단해도 될까요?",
    "‘안 됩니다’라는 말에 어떤 기록을 더하면 문제를 확인하기 쉬울까요?"
   ],
   "expect": "교사용: 주제, 후보, 선택 기준과 함께 버튼을 눌렀을 때의 동작을 설명해야 한다는 답을 예상합니다. 화면에 보이는 내용과 실행 결과를 나누어 시험하도록 안내합니다."
  },
  "activities": [
   {
    "title": "한 경기 화면 제작",
    "min": 12,
    "steps": [
     {
      "st": "① 첫 프롬프트 확인",
      "text": "아래 프롬프트를 학교에서 허용한 AI 도구에 붙여 넣습니다. 색칠한 부분은 1차시 설계 메모의 주제와 후보로 자동으로 채워집니다.",
      "prompt": "주제는 [과일]이고 후보는 [8개 이름]이야.\n두 후보 중 하나를 고르는 HTML을 만들어 줘.\n키보드로도 선택하고, 선택한 이름을 보여 줘.\n외부 연결, 실명 입력 없이 한 파일로 실행하게 해 줘."
     },
     {
      "st": "② 첫 결과 실행",
      "text": "AI가 만든 코드를 살펴보고 선생님에게 확인받은 뒤 실행합니다. 내가 만든 앱에서 후보를 선택하며 누른 이름과 표시된 이름을 비교합니다. 이 페이지의 앱은 같은 동작을 확인하는 예시로 사용합니다."
     },
     {
      "st": "③ 입력 방법 시험",
      "text": "마우스와 키보드로 각각 선택해 봅니다. 후보 이름을 바꾸었다면 화면에도 같은 이름이 표시되는지 확인합니다."
     },
     {
      "st": "④ 기대 결과와 관찰 비교",
      "text": "후보가 보이는지와 선택한 이름이 맞게 나오는지를 따로 기록합니다. 아직 시험하지 않은 항목은 성공으로 표시하지 않고 미확인으로 남깁니다."
     }
    ],
    "worksheet": [
     {
      "label": "첫 화면의 성공 조건",
      "placeholder": "화면에는 ______가 보여야 하며, 후보를 선택하면 ______가 나와야 합니다."
     },
     {
      "label": "입력 방법별 시험",
      "placeholder": "입력 방법: ______ / 선택한 후보: ______ / 표시된 이름: ______ / 일치 여부: ______"
     },
     {
      "label": "이름 변경 확인",
      "placeholder": "바꾼 이름은 ______입니다. 버튼에는 ______, 선택 결과에는 ______가 표시되었습니다."
     }
    ],
    "callout": {
     "kind": "tip",
     "title": "첫 화면의 확인 범위",
     "text": "처음에는 두 후보가 보이고 선택한 이름이 맞게 표시되는지 확인합니다. 다음 경기로 넘어가는 기능은 이후에 추가합니다."
    },
    "app": "s2"
   },
   {
    "title": "토너먼트 연결",
    "min": 13,
    "steps": [
     {
      "st": "① 기능 추가 요청",
      "text": "한 경기 화면이 작동하면 다음 요청을 보냅니다. 기존 주제와 후보를 유지하면서 추가할 동작을 설명합니다.",
      "prompt": "고른 후보만 다음 라운드 목록에 넣어 줘.\n8강 네 경기가 끝나면 4강 두 경기를 보여 줘.\n결승을 고르면 우승 후보와 다시하기를 보여 줘.\n기존 주제와 후보 이름은 그대로 유지해 줘."
     },
     {
      "st": "② 시험 결과 예측",
      "text": "후보 순서를 섞지 않는 조건에서 왼쪽 후보만 계속 고르면 누가 우승할지 예상합니다. 오른쪽 후보만 계속 고를 때 누가 우승할지, 빠르게 두 번 눌렀을 때 어떻게 기록될지도 예상해 적습니다."
     },
     {
      "st": "③ 진출 후보 확인",
      "text": "이 앱으로 8강부터 결승까지 진행합니다. 각 라운드에서 고른 후보만 다음 라운드에 나오는지 선택 기록과 비교해 확인합니다."
     },
     {
      "st": "④ 다시하기와 연속 클릭 시험",
      "text": "우승 항목을 확인한 뒤 다시하기를 실행하고, 후보 8개로 새 경기가 시작되는지 확인합니다. 왼쪽 선택, 오른쪽 선택, 빠른 두 번 클릭을 나누어 시험한 뒤 확인 칸을 펼칩니다."
     }
    ],
    "worksheet": [
     {
      "label": "시험별 예상",
      "placeholder": "왼쪽만 고르면 ______, 오른쪽만 고르면 ______가 우승할 것으로 예상합니다. 빠른 두 번 클릭은 ______로 기록되어야 합니다."
     },
     {
      "label": "실행 결과",
      "placeholder": "시험 조건: ______ / 우승: ______ / 선택 기록 수: ______ / 예상과 다른 부분: ______"
     },
     {
      "label": "다시하기 확인",
      "placeholder": "다시하기 뒤 후보는 ______이며, 새 경기의 선택 기록은 ______입니다. 남아 있는 이전 경기 정보는 ______입니다."
     }
    ],
    "reveal": {
     "title": "시험 후 기대 결과 확인",
     "text": "후보 순서를 섞지 않을 때 왼쪽만 계속 선택하면 후보 배열의 첫 항목이, 오른쪽만 계속 선택하면 마지막 항목이 우승합니다. 완료한 회차의 선택 기록은 7건입니다. 같은 경기에서 빠르게 두 번 클릭해도 선택은 한 번만 기록되어야 합니다."
    },
    "callout": {
     "kind": "check",
     "title": "화면과 동작의 구분",
     "text": "화면이 보이는 것과 경기 순서가 맞게 진행되는 것은 따로 확인합니다. 실제 실행 결과를 기대 결과와 비교해 기록합니다."
    },
    "app": "s3"
   },
   {
    "title": "오류 기록과 수정",
    "min": 10,
    "steps": [
     {
      "st": "① 문제 재현",
      "text": "문제가 생긴 화면에서 어떤 순서로 조작했는지 적습니다. 실제로 나온 결과와 기대한 결과를 구분합니다."
     },
     {
      "st": "② 수정 요청 작성",
      "text": "관찰한 문제 하나를 골라 행동, 실제 결과, 기대 결과를 자연어로 설명합니다. 아래는 라운드 연결을 요청한 뒤에도 다음 경기가 나오지 않는 상황의 예시이며, 내 요청에는 실제로 관찰한 내용을 씁니다.",
      "prompt": "첫 화면에서 왼쪽 후보를 한 번 눌렀어.\n후보가 바뀌지 않고 이름만 아래에 표시돼.\n고른 후보가 남고 다음 경기가 나오게 고쳐 줘.\n제목과 후보 목록은 바꾸지 말아 줘."
     },
     {
      "st": "③ 같은 순서로 재시험",
      "text": "수정한 앱을 같은 순서로 조작합니다. 수정 전후에 달라진 점을 적고 파일은 날짜와 버전으로 구분해 보관합니다."
     },
     {
      "st": "④ 기존 동작 재확인",
      "text": "고친 부분을 확인한 뒤 후보 이름, 다음 라운드 진출, 다시하기도 살펴봅니다. 문제가 발견되지 않았다면 억지로 오류를 만들지 않고 시험한 조건과 미확인 조건을 정리합니다."
     }
    ],
    "worksheet": [
     {
      "label": "문제 재현 기록",
      "placeholder": "______ 화면에서 ______ 순서로 조작했습니다. 실제 결과는 ______이며, 기대 결과는 ______입니다."
     },
     {
      "label": "내 수정 요청",
      "placeholder": "______했더니 ______가 나왔어. ______가 나오게 고쳐 줘. ______는 유지해 줘."
     },
     {
      "label": "수정 전후 비교",
      "placeholder": "같은 조작에서 수정 전에는 ______, 수정 후에는 ______였습니다. 추가로 확인할 동작은 ______입니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "기능 추가와 오류의 구분",
     "text": "첫 단계에서 선택한 이름만 표시되는 것은 요청한 동작입니다. 라운드를 연결한 뒤에도 다음 경기가 나오지 않는다면 수정할 문제로 기록합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "후보 입력 조건 점검",
    "text": "교사 예제의 복사본에서 빈 이름이나 중복 이름이 있을 때 어떤 안내가 필요한지 적습니다. 원래 후보 목록과 구분하여 시험하고, 자동으로 후보를 바꾸는 대신 수정할 내용을 알려 주는지 확인합니다.",
    "prompt": "후보 이름이 비어 있거나 겹치면 시작 전에 고칠 내용을 알려 줘. 후보를 임의로 바꾸지 말아 줘."
   },
   {
    "title": "짝의 재현 기록 검토",
    "text": "개인 결과 대신 조작 순서와 화면 설명을 서로 읽습니다. 설명만으로 같은 시험을 할 수 있는지 확인하고 빠진 조건을 보완합니다."
   }
  ],
  "quiz": [
   {
    "q": "처음 만드는 한 경기 화면에서 먼저 확인할 내용은 무엇입니까?",
    "options": [
     "학교 전체의 선호 순위를 확인합니다.",
     "화면에서 후보를 고르면 선택한 이름이 표시되는지 확인합니다.",
     "친구들이 참여한 결과가 외부 시트의 각 행에 저장되는지 확인합니다.",
     "급식 API에서 다음 달 메뉴를 불러와 날짜별로 보여 주는지 확인합니다."
    ],
    "answer": 1,
    "explain": "첫 화면에서는 두 후보를 보여 주고 선택한 이름을 표시하는 동작부터 확인합니다."
   },
   {
    "q": "AI에게 오류 수정을 요청하기 전에 준비할 기록으로 적절한 것은 무엇입니까?",
    "options": [
     "앱에 대한 전체적인 느낌과 평가",
     "새 화면에 넣고 싶은 장식과 후보 사진 목록",
     "친구의 앱과 비슷하게 바꾸고 싶은 화면 디자인 전체",
     "오류가 난 조작 순서와 실제 결과, 기대 결과"
    ],
    "answer": 3,
    "explain": "문제를 같은 순서로 재현할 수 있어야 수정 전후를 비교할 수 있습니다."
   },
   {
    "q": "한 경기 화면을 처음 요청했고, 선택한 이름이 아래에 표시되었습니다. 적절한 판단은 무엇입니까?",
    "options": [
     "다음 경기가 없어 연결 오류입니다.",
     "이름이 표시되었으므로 결승 진행과 다시하기 기능까지 검증되었습니다.",
     "선택한 이름이 표시되므로 첫 단계의 요청에 맞는 동작입니다.",
     "외부 시트에 새 행이 추가되지 않았으므로 결과 저장 기능이 실패했습니다."
    ],
    "answer": 2,
    "explain": "첫 단계에서는 선택한 이름을 표시하도록 요청했습니다. 라운드 연결은 기능을 추가한 뒤 따로 시험합니다."
   }
  ],
  "check": [
   "내 주제와 후보를 넣어 AI에게 한 경기 화면을 요청할 수 있다.",
   "선택한 후보만 다음 라운드에 진출하는지 확인할 수 있다.",
   "조작 순서와 실제 결과, 기대 결과를 담아 수정 요청을 작성할 수 있다.",
   "수정한 앱을 같은 조건으로 다시 시험할 수 있다."
  ],
  "terms": [
   {
    "term": "프롬프트",
    "def": "AI에게 작업을 요청하는 입력 내용"
   },
   {
    "term": "HTML",
    "def": "웹 페이지의 구조와 내용을 작성하는 언어"
   },
   {
    "term": "라운드",
    "def": "8강이나 4강처럼 같은 단계의 경기 묶음"
   },
   {
    "term": "재현",
    "def": "같은 조작 순서로 문제가 다시 나타나는지 확인함"
   },
   {
    "term": "버전",
    "def": "수정 시점이나 변경 내용을 구분하는 표시"
   }
  ],
  "teacher": [
   {
    "issue": "AI 도구 사용이나 실행이 어려운 경우",
    "response": "교사 예제의 후보를 설계 메모에 맞게 바꾸어 같은 시험을 진행합니다. 생성이나 실행을 기다리는 동안 기대 결과와 시험 순서를 작성하게 합니다."
   },
   {
    "issue": "이름만 나오는 화면을 오류로 판단하는 경우",
    "response": "첫 요청과 기능 추가 요청을 나란히 읽게 합니다. 실제 동작이 어느 요청의 성공 조건에 해당하는지 설명하게 합니다."
   },
   {
    "issue": "오류가 없어서 수정 활동을 진행하지 못하는 경우",
    "response": "시험 기록의 빠진 조건을 찾아 보완하거나 가정한 오류 예시로 요청문을 작성하게 합니다. 가정한 상황을 실제 발견한 오류로 보고하지 않도록 합니다."
   },
   {
    "issue": "시험 기대 결과 확인",
    "response": "왼쪽만 선택하면 첫 후보가, 오른쪽만 선택하면 마지막 후보가 우승하며 선택 기록은 7건입니다. 빠르게 두 번 클릭해도 선택이 한 번만 기록되는지 확인합니다."
   }
  ]
 },
 {
  "no": 3,
  "why": "선택 결과를 비교하려면 무엇을 한 건으로 기록할지 먼저 정해야 합니다. 완료된 응답 한 건을 표의 한 행으로 정리하고 저장 결과를 확인합니다. 개인을 알아볼 수 있는 정보는 수집하지 않습니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "한 행의 의미와 필요한 수집 항목을 생각합니다."
   },
   {
    "part": "활동",
    "min": 7,
    "what": "가상 응답을 표로 옮기고 수집 규칙을 작성합니다."
   },
   {
    "part": "활동",
    "min": 10,
    "what": "내 완료 기록과 브라우저 저장 범위를 확인합니다."
   },
   {
    "part": "활동",
    "min": 12,
    "what": "모의 시트에서 새 요청, 재시도, 충돌을 시험합니다."
   },
   {
    "part": "활동",
    "min": 6,
    "what": "누락과 중복의 처리 근거를 정리합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "행의 단위와 재전송 처리 문제를 풉니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "수집 규칙을 설명하고 공용 기기의 내 기록을 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "같은 사람이 월드컵을 다시 끝내면 표에는 무엇을 기록해야 할까요?",
    "같은 결과를 다시 보내는 것과 새 경기를 끝내는 것은 어떻게 다릅니까?",
    "전송 성공 문구만 보고 저장이 완료되었다고 판단해도 될까요?"
   ],
   "expect": "교사용: 사람 수와 응답 수가 다를 수 있고, 재전송과 새 응답을 구분해야 한다는 답을 예상합니다. 완료된 회차와 요청을 구분하는 표식을 확인하도록 안내합니다."
  },
  "activities": [
   {
    "title": "수집 규칙과 표 설계",
    "min": 7,
    "steps": [
     {
      "st": "① 기록 항목 선정",
      "text": "무작위 별명, 주제, 우승 후보처럼 비교에 필요한 항목을 정합니다. 선택 이유를 적을 때도 개인을 알아볼 수 있는 내용은 넣지 않습니다."
     },
     {
      "st": "② 가상 응답의 표 작성",
      "text": "가상 응답인 연습01의 사과, 연습02의 귤, 연습03의 사과를 과일 주제의 표로 옮깁니다. 완료된 응답 한 건마다 한 행을 만듭니다."
     },
     {
      "st": "③ 참여 규칙 작성",
      "text": "한 사람이 여러 번 참여할 수 있는지와 재전송을 어떻게 확인할지 정합니다. 별명과 실명을 연결하는 명단은 만들지 않고, 별명만으로도 누구인지 알아볼 수 있는지 살핍니다."
     },
     {
      "st": "④ 기록 형식 연결",
      "text": "회차 기록의 runId, 별명, 주제, 버전, choices, winner가 각각 무엇을 뜻하는지 설명합니다. 모의 시트의 requestId, alias, topic, winner, receivedAt 열과 비교하여 회차 기록과 시트의 항목이 같은지 다른지 구분합니다."
     }
    ],
    "worksheet": [
     {
      "label": "가상 응답 표",
      "placeholder": "응답 표식: ______ / 주제: ______ / 우승 후보: ______"
     },
     {
      "label": "기록 항목의 뜻",
      "placeholder": "______ 항목은 ______를 뜻합니다. 회차 기록에는 있으나 시트 열에는 없는 항목은 ______입니다."
     },
     {
      "label": "수집 규칙",
      "placeholder": "한 행은 ______입니다. 새 참여는 ______로 구분하고, 재전송은 ______로 확인합니다. 수집하지 않을 정보는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "행 수와 사람 수",
     "text": "한 사람이 여러 번 참여했다면 여러 행이 생길 수 있습니다. 이 표의 한 행은 한 사람이 아니라 완료된 응답 한 건을 뜻합니다."
    }
   },
   {
    "title": "내 결과의 기록 확인",
    "min": 10,
    "steps": [
     {
      "st": "① 저장 결과 예측",
      "text": "완료 뒤 새로고침, 다른 브라우저로 열기, 다시하기, 연습 기록 지우기를 했을 때 기록이 어떻게 될지 예상합니다. 실제 시험 전에 예상 내용을 적습니다."
     },
     {
      "st": "② 완료 결과 대조",
      "text": "이 앱으로 한 회차를 마친 뒤 내 선택 기록과 우승 결과를 대조합니다. 선택 7건이 남았는지와 결승에서 고른 후보가 우승으로 기록되었는지 확인합니다."
     },
     {
      "st": "③ 저장 범위 확인",
      "text": "저장 위치와 안내 문구를 읽습니다. 저장이 허용된 환경에서 새로고침한 뒤 내 완료 기록이 유지되는지 확인합니다."
     },
     {
      "st": "④ 사용 후 기록 정리",
      "text": "다시하기의 결과를 확인하고, 연습 기록 지우기는 안내 문구로 기능만 확인합니다. 뒤의 모의 시트 활동에 완료 기록이 필요할 수 있으므로 공용 기기의 내 연습 기록은 차시 끝의 정리 시간에 지웁니다."
     }
    ],
    "worksheet": [
     {
      "label": "저장 동작의 예상과 관찰",
      "placeholder": "시험할 동작: ______ / 예상: ______ / 실제 관찰: ______ / 차이: ______"
     },
     {
      "label": "내 회차 대조",
      "placeholder": "선택 기록은 ______건이며, 마지막 선택은 ______, 기록된 우승은 ______입니다."
     },
     {
      "label": "저장 범위 설명",
      "placeholder": "내 기록이 저장된 곳은 ______입니다. 다른 기기나 브라우저와의 공유 여부는 ______로 확인했습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "내 결과만 보기",
     "text": "내 결과만 확인하고 다른 사용자의 기록을 열어보지 않습니다. 브라우저에 저장한 기록은 공용 기기의 다른 사용자에게 보일 수 있습니다."
    },
    "app": "s4"
   },
   {
    "title": "모의 시트 기록 시험",
    "min": 12,
    "steps": [
     {
      "st": "① 짝의 역할 설정",
      "text": "사용자는 가상 별명으로 연습 회차를 끝까지 한 번 진행하고, 확인자는 연습 회차의 우승 결과와 새 행의 값을 대조합니다. 이 점검에는 실제 선호 대신 연습용 선택을 사용하고, 개인별 결과는 본인이 확인합니다."
     },
     {
      "st": "② 요청별 결과 예측",
      "text": "새 ID로 보내기, 같은 ID와 같은 값으로 다시 보내기, 같은 ID에서 우승만 바꾸기, 다른 새 ID로 보내기의 결과를 예상합니다. 각 경우에 새 행이 생길지와 어떤 안내가 필요한지 적습니다."
     },
     {
      "st": "③ 모의 기록 확인",
      "text": "이 앱으로 브라우저 안의 모의 시트에 완료 응답을 기록해 봅니다. 정상 완료 한 건에 새 행 하나가 생기고 우승 후보가 일치하는지 확인합니다."
     },
     {
      "st": "④ 재시도와 충돌 시험",
      "text": "예측한 요청을 순서대로 시험하고, 각 요청 전후의 행 수 변화와 안내를 기록합니다. 같은 ID의 우승만 바꾸었을 때 기존 값이 유지되는지 확인한 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "⑤ 역할 교대와 설명",
      "text": "역할을 바꾸어 가상 요청의 결과를 설명합니다. 참여하지 않아도 불이익이 없고 이유 공개를 강요하지 않으며, 개인별 결과는 전체에 공개하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "요청별 예측표",
      "placeholder": "요청 조건: ______ / 예상 새 행 수: ______ / 예상 안내: ______"
     },
     {
      "label": "요청별 실행 기록",
      "placeholder": "요청 조건: ______ / 실제 새 행 수: ______ / 실제 안내: ______ / 기존 값 유지 여부: ______"
     },
     {
      "label": "재시도와 새 응답의 차이",
      "placeholder": "재시도는 ______이며, 새 응답은 ______입니다. 구분에 사용한 항목은 ______입니다."
     }
    ],
    "reveal": {
     "title": "가상 요청 시험 결과 확인",
     "text": "새 ID로 요청하면 새 행 1개가 생깁니다. 같은 ID와 같은 값으로 다시 요청하면 새 행 0개입니다. 같은 ID에서 우승만 바꾸면 REQUEST_CONFLICT이며 새 행 0개입니다. 다른 새 ID로 요청하면 새 행 1개가 생깁니다."
    },
    "callout": {
     "kind": "warn",
     "title": "모의 시트의 범위",
     "text": "이 페이지의 시트는 브라우저 안의 모의 시트입니다. 모의 기록을 실제 외부 시트 전송 성공으로 보고하지 않습니다."
    },
    "app": "s5"
   },
   {
    "title": "누락과 중복의 처리 근거",
    "min": 6,
    "steps": [
     {
      "st": "① 예상 기록 수 대조",
      "text": "예상한 참가 수와 실제 기록 수를 비교합니다. 참여 규칙에 따라 완료 응답이 몇 건이어야 하는지 확인하고, 참가 수와 응답 수가 달라도 되는 경우를 구분합니다."
     },
     {
      "st": "② 이상 기록의 원인 검토",
      "text": "우승 후보가 빈칸이면 끝까지 참여했는지 확인합니다. 행이 반복되면 이중 클릭이나 재전송 때문인지, 후보 이름이 다르면 같은 항목인지 확인합니다."
     },
     {
      "st": "③ 정리본과 근거 작성",
      "text": "원본과 별도로 만든 정리본에 처리 이유를 적습니다. 확인되지 않은 원인은 미확인으로 남기고, 값이 비슷하다는 이유로 서로 다른 응답을 합치지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "점검 기록",
      "placeholder": "발견한 문제는 ______입니다. 확인한 근거는 ______이며, 아직 모르는 점은 ______입니다."
     },
     {
      "label": "처리 근거",
      "placeholder": "원본은 보존했습니다. 정리본에서 ______를 처리했으며, 이유는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "삭제 전 확인",
     "text": "우승 후보가 같다는 이유만으로 중복 응답이라고 판단하지 않습니다. 요청 표식과 수집 규칙을 확인한 뒤 처리합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "수집 규칙 설명서",
    "text": "처음 참여하는 학생이 읽을 수 있도록 한 행의 의미, 재시도 방법, 결과 공개 범위를 짧게 정리합니다. 짝은 설명만 읽고 새 응답과 재전송을 구분해 봅니다."
   },
   {
    "title": "확인되지 않은 기록의 처리",
    "text": "반복된 행의 원인을 알 수 없다고 가정합니다. 원본을 보존하면서 분석에 포함할지 보류할지 판단하고, 추가로 확인할 항목을 적습니다."
   }
  ],
  "quiz": [
   {
    "q": "이 차시의 결과 표에서 한 행이 뜻하는 것은 무엇입니까?",
    "options": [
     "한 후보가 선택된 전체 횟수",
     "한 후보가 여러 경기에서 선택된 횟수를 합친 기록",
     "토너먼트를 끝까지 진행하여 완료된 응답 한 건",
     "한 학급에 속한 학생들의 우승 결과를 모두 합친 전체 기록"
    ],
    "answer": 2,
    "explain": "완료된 응답 한 건을 한 행으로 기록합니다. 같은 사람이 여러 번 참여하면 그 사람의 응답이 여러 행으로 기록될 수 있습니다."
   },
   {
    "q": "같은 기록이 반복된 행을 발견했을 때 먼저 할 일은 무엇입니까?",
    "options": [
     "우승 후보가 같으면 삭제합니다.",
     "서로 다른 학생의 응답이라고 판단하여 집계에 합산합니다.",
     "각 행에 참여자의 실명을 추가하여 같은 사람의 응답을 구분합니다.",
     "같은 응답이 다시 전송된 것인지 먼저 확인합니다."
    ],
    "answer": 3,
    "explain": "행이 반복된 원인이 이중 클릭이나 재전송인지 확인합니다. 원본을 보존하고 처리한 근거를 기록합니다."
   },
   {
    "q": "같은 요청 ID에서 우승 후보만 바꾸어 모의 시트에 보냈습니다. 기대 결과는 무엇입니까?",
    "options": [
     "후보가 달라 새 행을 추가합니다.",
     "원래 행에 저장된 우승 후보를 새로 받은 값으로 바꾸어 저장합니다.",
     "참가자를 구분하도록 별명에 실명을 추가한 뒤 새로운 행으로 저장합니다.",
     "같은 요청 ID의 내용 충돌로 안내하고 새 행을 만들지 않습니다."
    ],
    "answer": 3,
    "explain": "같은 ID에 다른 값이 들어오면 REQUEST_CONFLICT로 처리합니다. 새 행을 만들거나 기존 값을 덮어쓰는 경우와 구분합니다."
   }
  ],
  "check": [
   "개인을 알아볼 수 있는 정보 없이 수집 항목을 정할 수 있다.",
   "결과 표에서 한 행과 한 열의 의미를 설명할 수 있다.",
   "내 결과와 저장된 값을 비교하고 누락과 중복을 점검할 수 있다.",
   "모의 시트 기록과 실제 외부 전송을 구분할 수 있다.",
   "새 응답, 같은 요청의 재시도, 충돌을 구분할 수 있다."
  ],
  "terms": [
   {
    "term": "행",
    "def": "표에서 가로 방향으로 놓인 자료 묶음이며, 이 활동에서는 완료된 응답 한 건"
   },
   {
    "term": "열",
    "def": "주제나 우승 후보처럼 같은 항목의 값을 세로로 모은 부분"
   },
   {
    "term": "누락",
    "def": "기록해야 할 값이나 응답이 빠짐"
   },
   {
    "term": "중복",
    "def": "같은 응답이 반복해서 기록됨"
   },
   {
    "term": "모의 시트",
    "def": "외부 시트 전송을 연습하기 위해 브라우저 안에서 사용하는 표"
   },
   {
    "term": "회차 ID",
    "def": "월드컵의 각 회차를 구분하는 표식"
   },
   {
    "term": "요청 ID",
    "def": "저장 요청을 구분하고 같은 요청의 재시도를 확인하는 표식"
   },
   {
    "term": "충돌",
    "def": "같은 요청 ID에 기존 기록과 다른 값이 들어온 상태"
   }
  ],
  "teacher": [
   {
    "issue": "행 수를 사람 수로 해석하는 경우",
    "response": "가상 응답 표에서 한 행의 단위를 다시 읽게 합니다. 새 참여와 같은 요청의 재시도를 구분하여 예상 응답 수를 설명하게 합니다."
   },
   {
    "issue": "짝 점검에서 개인 결과를 열어보려는 경우",
    "response": "개인 결과는 본인만 확인하게 하고 짝 점검은 가상 별명과 가상 결과로 진행합니다. 참여와 이유 공개를 강요하지 않습니다."
   },
   {
    "issue": "브라우저 저장이나 모의 시험이 막히는 경우",
    "response": "저장 실패를 성공으로 기록하지 않게 합니다. 가상 기록표에 예상과 관찰 가능한 범위를 나누어 적고, 외부 시트 연동과 구분합니다."
   },
   {
    "issue": "요청별 처리 결과 확인",
    "response": "새 ID로 보내기, 같은 ID와 같은 값으로 다시 보내기, 같은 ID의 우승만 바꾸어 보내기, 다른 새 ID로 보내기 순서로 시험합니다. 새 ID로 보내면 새 행 1개가 생깁니다. 같은 ID와 같은 값으로 다시 보내면 새 행 0개입니다. 같은 ID의 우승만 바꾸면 REQUEST_CONFLICT이며 새 행 0개입니다."
   }
  ]
 },
 {
  "no": 4,
  "why": "응답을 모은 뒤에는 후보별 우승 횟수를 집계해 비교할 수 있습니다. 표와 막대그래프가 원본 기록과 일치하는지 확인합니다. 숫자로 확인한 사실과 추측을 구분해 결과를 설명합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "우승 횟수로 답할 수 있는 질문을 정합니다."
   },
   {
    "part": "활동",
    "min": 8,
    "what": "분석 범위를 정하고 가상 응답을 직접 집계합니다."
   },
   {
    "part": "활동",
    "min": 12,
    "what": "막대그래프를 만들고 원본 및 수동 집계와 대조합니다."
   },
   {
    "part": "활동",
    "min": 9,
    "what": "관찰, 비교, 한계, 추가 질문을 작성합니다."
   },
   {
    "part": "활동",
    "min": 6,
    "what": "짝의 집계와 해석을 검토하고 보완합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "집계와 그래프 해석 문제를 풉니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "자료로 설명할 수 있는 범위와 다음 질문을 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "경기마다 선택된 횟수와 최종 우승 횟수는 같은 값입니까?",
    "그래프에서 가장 높은 막대만 보고 학교 전체의 선호를 알 수 있을까요?",
    "자동으로 만든 그래프가 정확한지 확인하려면 무엇과 비교해야 할까요?"
   ],
   "expect": "교사용: 우승은 완료 응답마다 기록되지만 한 회차 안에서도 후보 선택은 여러 번 이루어진다는 답을 예상합니다. 이번 집계의 단위를 완료 응답의 우승으로 정하고 원본과 대조하도록 안내합니다."
  },
  "activities": [
   {
    "title": "분석 범위와 집계",
    "min": 8,
    "steps": [
     {
      "st": "① 분석 질문 설정",
      "text": "어떤 후보가 자주 우승했는지 알아보기로 합니다. 그래프를 보기 전에 예상하는 결과를 한 문장으로 적습니다."
     },
     {
      "st": "② 비교할 기록 선정",
      "text": "같은 주제와 같은 규칙으로 진행한 기록만 묶습니다. 응답 한 건마다 우승 후보를 집계하며, 경기마다 후보가 선택된 횟수와 구분합니다."
     },
     {
      "st": "③ 가상 응답의 수동 집계",
      "text": "교재의 가상 응답 6건(사과, 사과, 귤, 배, 사과, 귤)을 보고 후보별 우승 횟수를 직접 집계합니다. 집계에 포함한 원본 응답을 표시하며 집계표를 작성합니다."
     },
     {
      "st": "④ 비율과 합계 계산",
      "text": "후보별 횟수가 전체 응답에서 차지하는 비율을 계산합니다. 횟수의 합이 원본 응답 수와 맞는지 확인하고, 계산한 값을 다음 활동에서 앱의 계산값과 비교합니다."
     }
    ],
    "worksheet": [
     {
      "label": "분석 질문과 예상",
      "placeholder": "분석할 자료는 ______입니다. ______가 자주 우승할 것으로 예상하며, 이유는 ______입니다."
     },
     {
      "label": "수동 집계표",
      "placeholder": "후보: ______ / 우승 횟수: ______건 / 확인한 원본 응답: ______"
     },
     {
      "label": "비율과 합계",
      "placeholder": "전체 응답은 ______건입니다. 후보별 비율은 ______이며, 횟수 합계는 ______건입니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "가상 자료 표시",
     "text": "이 수치는 연습용 가상 응답의 집계입니다. 실제 학생이나 학교 전체의 선호 조사 결과로 사용하지 않습니다."
    }
   },
   {
    "title": "막대그래프 작성과 대조",
    "min": 12,
    "steps": [
     {
      "st": "① 표의 그래프 작성",
      "text": "이 앱으로 후보별 우승 횟수를 막대그래프로 나타내 봅니다. 가로축의 후보와 세로축의 우승 횟수 단위를 확인합니다."
     },
     {
      "st": "② 축과 제목 확인",
      "text": "세로축이 0부터 시작하는지 확인합니다. 제목에는 대상, 기간, 응답 수를 쓰고 가상 자료라면 가상임을 표시합니다."
     },
     {
      "st": "③ 수동 집계와 앱 대조",
      "text": "각 막대의 값이 집계 표와 일치하는지 확인합니다. 다른 값이 나오면 원본에서 빠뜨리거나 반복해서 센 응답이 있는지 확인합니다. 점검을 마친 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "④ 원본과 합계 비교",
      "text": "가상 예시에서는 후보별 횟수의 합이 원본 6건과 같은지 계산합니다. 모의 시트 기록을 사용한다면 그 기록의 실제 건수를 기준으로 다시 집계하고, 가상 예시와 섞지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "그래프 제목과 축",
      "placeholder": "제목: ______ / 가로축: ______ / 세로축과 단위: ______ / 세로축 시작값: ______"
     },
     {
      "label": "값 대조",
      "placeholder": "후보: ______ / 수동 집계: ______건 / 앱의 표: ______건 / 막대 값: ______건"
     },
     {
      "label": "불일치 확인",
      "placeholder": "일치 여부는 ______입니다. 다른 값이 나온 원인은 ______이며, 확인하거나 고친 내용은 ______입니다."
     }
    ],
    "reveal": {
     "title": "직접 집계한 뒤 가상 예시 확인",
     "text": "가상 응답 6건의 집계는 사과 3건, 귤 2건, 배 1건입니다. 전체 6건에서 차지하는 비율은 각각 50%, 약 33%, 약 17%입니다."
    },
    "callout": {
     "kind": "check",
     "title": "자동 그래프의 검증",
     "text": "그래프가 자동으로 만들어져도 집계한 건수를 원본과 대조합니다. 각 막대의 값이 후보별 집계와 일치하고, 값의 합이 전체 응답 수와 맞는지 확인합니다."
    },
    "app": "s6"
   },
   {
    "title": "결과 해석과 한계 작성",
    "min": 9,
    "steps": [
     {
      "st": "① 관찰 문장 작성",
      "text": "표에서 직접 확인할 수 있는 사실을 씁니다. 가상 예시에서는 가상 응답 6건 중 사과가 우승한 응답은 3건이라고 적습니다."
     },
     {
      "st": "② 예상과 결과 비교",
      "text": "처음 적은 예상과 결과에서 같은 점이나 다른 점을 씁니다. 표에서 확인한 사실과 그 이유에 관한 추측을 구분합니다."
     },
     {
      "st": "③ 한계 검토",
      "text": "참여 대상, 대진표, 작은 표본 때문에 설명하기 어려운 범위를 적습니다. 같은 사람이 여러 번 참여할 수 있었다면 응답 수를 사람 수로 해석하지 않습니다."
     },
     {
      "st": "④ 추가 질문 설정",
      "text": "더 확인하고 싶은 자료나 질문을 정합니다. 결과를 공유할 때는 개인별 결과를 전체에 공개하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "관찰과 비교",
      "placeholder": "______ 자료의 전체 ______건 중 ______의 우승은 ______건입니다. 내 예상과 비교하면 ______입니다."
     },
     {
      "label": "추측과 한계",
      "placeholder": "이유를 ______라고 추측하지만, 표만으로는 확인할 수 없습니다. ______ 때문에 ______까지 설명하기는 어렵습니다."
     },
     {
      "label": "추가 확인",
      "placeholder": "다음에는 ______를 알아보기 위해 ______ 자료를 확인하고 싶습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "학교 전체로 확대하지 않기",
     "text": "가상 응답 6건에서 사과가 가장 자주 우승해도 학교에서 가장 인기 있다고 말할 근거는 없습니다. 수집한 자료의 범위 안에서 설명합니다."
    }
   },
   {
    "title": "짝의 분석 검토",
    "min": 6,
    "steps": [
     {
      "st": "① 집계 근거 점검",
      "text": "개인별 기록을 제외한 집계표와 그래프를 짝에게 보여 줍니다. 짝은 제목의 자료 범위, 축의 단위, 횟수 합계가 맞는지 확인합니다."
     },
     {
      "st": "② 해석 문장 점검",
      "text": "짝의 문장에서 표로 확인할 수 있는 부분과 추가 근거가 필요한 부분을 구분합니다. ‘학교에서 가장 인기 있습니다’처럼 자료의 범위를 넘은 표현이 있다면 수정할 이유를 설명합니다."
     },
     {
      "st": "③ 의견 반영",
      "text": "받은 의견을 바탕으로 표, 그래프, 해석 문장을 보완합니다. 바꾼 부분과 유지한 부분의 이유를 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "짝의 검토 의견",
      "placeholder": "근거가 분명한 부분은 ______입니다. 추가 확인이 필요한 부분은 ______이며, 이유는 ______입니다."
     },
     {
      "label": "수정 기록",
      "placeholder": "______라는 표현이나 표시를 ______로 바꾸었습니다. 바꾼 이유는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "분석 결과의 필수 조건",
     "text": "집계표와 그래프의 값이 일치해야 하며 자료 범위와 가상 여부를 밝혀야 합니다. 해석에는 관찰한 사실, 예상과의 비교, 한계, 추가 질문을 포함합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "같은 집계의 해석 비교",
    "text": "같은 집계표를 보고 관찰 문장과 추측 문장을 각각 작성합니다. 짝에게 두 문장을 구분하도록 요청하고, 추측을 확인하려면 어떤 자료가 필요한지 적습니다."
   },
   {
    "title": "선호 조사 질문 보완",
    "text": "우승 항목만으로 알 수 없는 내용을 적고, 후보마다 별점을 받으면 무엇을 더 알 수 있을지 설명합니다. 우승 횟수와 별점이 서로 다른 질문의 결과라는 점을 포함합니다."
   }
  ],
  "quiz": [
   {
    "q": "가상 응답 6건에서 사과가 우승한 응답은 3건, 귤은 2건, 배는 1건입니다. 표에서 직접 확인할 수 있는 문장은 무엇입니까?",
    "options": [
     "학교 학생 대부분은 사과를 좋아합니다.",
     "다음 조사에서도 사과가 다른 후보보다 자주 우승할 것으로 확인됩니다.",
     "급식에 사과를 제공하면 다른 과일을 제공할 때보다 잔반이 적습니다.",
     "집계한 가상 응답 6건 중 사과가 우승한 응답은 3건입니다."
    ],
    "answer": 3,
    "explain": "관찰 문장은 집계 표에서 직접 확인할 수 있어야 합니다. 학교 전체의 선호나 잔반량은 이 자료로 알 수 없습니다."
   },
   {
    "q": "후보별 우승 횟수의 막대그래프를 검증하는 방법으로 적절한 것은 무엇입니까?",
    "options": [
     "가장 높은 막대의 색을 확인합니다.",
     "후보별 막대 값의 합을 원본 응답 건수와 비교합니다.",
     "예상한 후보가 더 자주 우승한 것으로 나오도록 분석 자료를 바꿉니다.",
     "후보별 막대 높이가 서로 비슷해지도록 세로축의 시작값을 바꿉니다."
    ],
    "answer": 1,
    "explain": "막대의 값이 집계 표와 일치하고 합계가 원본 응답 수와 같은지 확인합니다."
   },
   {
    "q": "후보별 우승 횟수를 집계할 때 적절한 기준은 무엇입니까?",
    "options": [
     "같은 주제와 규칙으로 진행하여 완료한 응답",
     "주제가 다른 기록의 경기 선택 횟수",
     "내가 예상한 우승 결과와 일치하는 응답만 골라 모은 묶음",
     "경기가 완료되었는지 구분하지 않고 모은 화면의 선택 기록"
    ],
    "answer": 0,
    "explain": "같은 주제와 규칙으로 진행한 기록을 묶고 완료 응답마다 우승 후보를 집계합니다. 라운드별 선택 횟수와 우승 횟수는 구분합니다."
   }
  ],
  "check": [
   "같은 주제와 규칙의 응답을 골라 후보별 우승 횟수를 집계할 수 있다.",
   "표와 막대그래프의 값을 원본 건수와 대조할 수 있다.",
   "관찰과 추측을 구분해 결과를 설명할 수 있다.",
   "자료의 한계와 추가로 확인할 질문을 적을 수 있다."
  ],
  "terms": [
   {
    "term": "빈도",
    "def": "정한 항목이 나타난 횟수"
   },
   {
    "term": "비율",
    "def": "전체에서 해당 항목이 차지하는 몫"
   },
   {
    "term": "막대그래프",
    "def": "항목별 수량을 막대의 길이나 높이로 나타낸 그래프"
   },
   {
    "term": "관찰",
    "def": "자료에서 직접 확인한 내용"
   },
   {
    "term": "표본",
    "def": "전체 대상 중 실제로 조사한 일부"
   },
   {
    "term": "집계",
    "def": "정한 기준에 따라 자료를 묶어 수를 셈"
   }
  ],
  "teacher": [
   {
    "issue": "경기 선택과 최종 우승을 섞어 세는 경우",
    "response": "원본의 완료 응답마다 우승 항목을 표시하게 합니다. 이번 질문이 경기별 선택 횟수가 아니라 완료 응답의 우승 횟수를 묻는다는 점을 확인합니다."
   },
   {
    "issue": "자동 그래프의 값이 수동 집계와 다른 경우",
    "response": "그래프 모양을 먼저 고치지 않고 분석에 포함한 기록과 집계 단위를 비교하게 합니다. 원본의 누락이나 중복 계산을 확인한 뒤 수정합니다."
   },
   {
    "issue": "가상 집계를 실제 선호로 설명하는 경우",
    "response": "문장의 주어를 ‘학교 학생’에서 ‘가상 응답’으로 고치게 합니다. 관찰 가능한 수와 해석의 범위를 함께 설명하게 합니다."
   },
   {
    "issue": "가상 집계의 기준값 확인",
    "response": "가상 응답 6건의 집계는 사과 3건, 귤 2건, 배 1건이며 비율은 50%, 약 33%, 약 17%입니다."
   }
  ]
 },
 {
  "no": 5,
  "why": "급식 식단을 분석하려면 출처와 조회 조건이 분명한 자료가 필요합니다. NEIS 급식 API에 학교와 날짜 조건을 보내고 응답에서 필요한 값을 확인합니다. 공개 식단으로 알 수 있는 내용과 별도로 조사해야 할 내용을 구분합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "공개 식단으로 답할 수 있는 질문을 구분합니다."
   },
   {
    "part": "활동",
    "min": 6,
    "what": "학교, 날짜, 식사 등의 요청 조건을 확인합니다."
   },
   {
    "part": "활동",
    "min": 10,
    "what": "공개 식단을 조회하고 응답과 조회 시각을 기록합니다."
   },
   {
    "part": "활동",
    "min": 6,
    "what": "자료 없음, 일부 수신, 오류와 취소를 구분합니다."
   },
   {
    "part": "활동",
    "min": 7,
    "what": "저장된 실제 자료에서 메뉴 등장과 열량을 비교합니다."
   },
   {
    "part": "활동",
    "min": 6,
    "what": "분석용 표와 출처, 자료의 한계를 정리합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "응답 상태와 조회 시각에 관한 문제를 풉니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "확인한 사실과 별도로 조사할 내용을 설명합니다."
   }
  ],
  "opening": {
   "questions": [
    "공개 식단에 메뉴가 자주 나오면 학생들이 좋아한다고 판단할 수 있을까요?",
    "학교와 날짜를 정해 요청하면 어떤 항목을 받을 것으로 예상합니까?",
    "자료가 없다는 응답과 연결에 실패한 상황은 어떻게 다릅니까?"
   ],
   "expect": "교사용: 학생은 메뉴, 날짜, 열량 등을 예상하되 선호도나 잔반량도 받을 수 있다고 생각할 수 있습니다. 공개 응답에서 확인할 수 있는 값과 별도 조사가 필요한 값을 구분하도록 안내합니다."
  },
  "activities": [
   {
    "title": "API 요청 조건 확인",
    "min": 6,
    "steps": [
     {
      "st": "① 요청과 응답 구분",
      "text": "요청에는 찾을 학교, 날짜, 식사 같은 조건을 담습니다. 응답에서는 급식일과 메뉴처럼 공개된 항목을 확인합니다."
     },
     {
      "st": "② 조건 이름과 값 연결",
      "text": "시도교육청코드와 학교 행정표준코드를 공식 학교 정보와 대조합니다. 응답 형식은 json으로 지정했는지, 급식일자는 20261103처럼 8자리로 적었는지 확인합니다."
     },
     {
      "st": "③ 하루 조회 조건 기록",
      "text": "교재의 예시 조건인 당곡고등학교, 교육청코드 B10, 학교코드 7010073, 중식 코드 2를 기록합니다. 시작일과 종료일은 모두 20261103으로 정합니다."
     },
     {
      "st": "④ 조건 점검",
      "text": "짝과 요청 조건만 비교하여 같은 학교와 날짜의 중식을 찾는지 확인합니다. 다른 학교는 앱의 학교 찾기로 코드를 확인하며, 실시간 학교 찾기는 공개 페이지에서 사용할 수 있습니다."
     }
    ],
    "worksheet": [
     {
      "label": "요청 조건표",
      "placeholder": "학교: ______ / 교육청코드: ______ / 학교코드: ______ / 식사: ______ / 시작일: ______ / 종료일: ______"
     },
     {
      "label": "요청과 응답의 구분",
      "placeholder": "내가 보내는 조건은 ______이며, 응답에서 확인할 항목은 ______입니다."
     }
    ],
    "callout": {
     "kind": "tip",
     "title": "예시 날짜와 오늘 날짜",
     "text": "교재의 예시 날짜는 2026년 11월 3일입니다. 오늘 날짜는 실행하는 날에 따라 바뀌므로 예시와 구분합니다."
    }
   },
   {
    "title": "공개 식단 조회와 응답 확인",
    "min": 10,
    "steps": [
     {
      "st": "① 조회 전 예상",
      "text": "요청한 학교, 날짜, 식사가 응답의 어느 항목에 나타날지 예상합니다. 같은 날짜를 나중에 다시 조회하면 열량 값이 같을지도 예상하고 이유를 적습니다."
     },
     {
      "st": "② 하루 자료 조회",
      "text": "이 앱으로 정한 학교와 날짜의 공개 식단을 조회해 봅니다. 화면의 학교, 날짜, 식사가 요청한 조건과 같은지 확인하고 조회 상태도 확인합니다."
     },
     {
      "st": "③ 응답 항목 기록",
      "text": "응답에서 급식일, 식사 이름, 메뉴 원문을 찾아 기록합니다. 열량과 조회 시각을 함께 적고, 실시간 조회인지 저장된 실제 자료를 연 것인지 구분합니다."
     },
     {
      "st": "④ 기록의 기준 비교",
      "text": "지금 조회한 결과와 저장본을 비교합니다. 저장본은 2026년 11월 4일 22:05 KST에 조회한 기록입니다. 최신 조회 결과가 아니므로 조회 시각을 함께 적습니다. 예상과 관찰을 비교한 뒤 확인 칸을 펼칩니다."
     }
    ],
    "worksheet": [
     {
      "label": "조회 전 예상",
      "placeholder": "응답에서 ______를 확인할 것으로 예상합니다. 나중에 다시 조회한 값은 ______ 것으로 예상하며, 이유는 ______입니다."
     },
     {
      "label": "응답과 출처 기록",
      "placeholder": "학교: ______ / 급식일: ______ / 식사: ______ / 메뉴 원문: ______ / 열량: ______ / 조회 시각: ______ / 실시간 또는 저장본: ______"
     },
     {
      "label": "조회 시점 비교",
      "placeholder": "비교한 두 기록의 조회 시각은 ______와 ______입니다. 값의 차이는 ______이며, 기록에 함께 적어야 할 조건은 ______입니다."
     }
    ],
    "reveal": {
     "title": "조회 후 교재의 기록 비교",
     "text": "2026년 11월 3일 중식 열량은 처음 확인한 11월 3일 18:08 KST 조회 당시 817.2 Kcal였고, 11월 4일 22:05 KST에 조회한 저장본에서는 820.3 Kcal입니다."
    },
    "callout": {
     "kind": "check",
     "title": "공개 자료는 바뀔 수 있음",
     "text": "같은 날짜를 다시 조회해도 응답이 그대로 유지된다고 보장할 수 없습니다. 값을 기록할 때는 조회 시각을 함께 남깁니다."
    },
    "app": "s7"
   },
   {
    "title": "자료 없음과 불완전 수집 구분",
    "min": 6,
    "steps": [
     {
      "st": "① 응답 상태 예측",
      "text": "자료가 없을 때와 일부만 받았을 때 각각 어떤 기록이 필요한지 예상합니다. 조회 성공 문구만으로 자료를 모두 수집했다고 판단해도 되는지 생각하고 이유를 적습니다."
     },
     {
      "st": "② 자료 없음 확인",
      "text": "앞서 사용한 앱에서 2026년 11월 1일 중식의 응답 상태를 확인합니다. 이 조건의 자료가 없다는 뜻으로 기록하며 잔반 0이나 휴교로 해석하지 않습니다."
     },
     {
      "st": "③ 전체 건수와 수신 건수 비교",
      "text": "2026년 10월의 인증키 없는 조회에서 전체 건수와 실제 받은 건수를 비교합니다. 성공 응답이어도 필요한 기간의 자료를 모두 받았는지 따로 확인한 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "④ 오류와 취소 기록",
      "text": "필수 조건 누락, 통신 실패, 조회 취소를 자료 없음과 구분해 기록합니다. 연결 장애로 모의 자료를 사용했다면 실제 API 조회 성공으로 기록하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "상태 구분표",
      "placeholder": "조회 조건: ______ / 상태 문구나 코드: ______ / 확인된 뜻: ______ / 이 응답으로 알 수 없는 것: ______"
     },
     {
      "label": "수집 범위 점검",
      "placeholder": "전체 건수는 ______건, 수신 건수는 ______건입니다. 수집 상태를 ______로 판단하며, 이유는 ______입니다."
     }
    ],
    "reveal": {
     "title": "응답 확인 후 교재의 상태 비교",
     "text": "2026년 11월 1일 중식은 INFO-200으로 자료 없음이 확인되었습니다. 인증키 없는 2026년 10월 전체 조회에서는 전체 15건 중 5건만 받았습니다."
    },
    "callout": {
     "kind": "warn",
     "title": "인증키 없는 조회의 제한",
     "text": "교재에서는 한 번에 받을 건수나 페이지 번호를 바꿔도 첫 5건 제한을 넘지 못했습니다. 전체 기간의 수집 여부는 수신 건수를 대조해 판단합니다."
    }
   },
   {
    "title": "저장된 실제 자료의 발견",
    "min": 7,
    "steps": [
     {
      "st": "① 비교 범위와 예상 설정",
      "text": "11월 4일 22:05 KST에 조회해 저장한 당곡고 중식 12일의 자료를 살펴봅니다. 해당 날짜는 10월 1일, 2일, 14일, 15일, 16일, 26일부터 30일, 11월 2일과 3일입니다. 자주 나온 메뉴와 열량이 높거나 낮을 것 같은 날을 예상합니다."
     },
     {
      "st": "② 질문별 자료 확인",
      "text": "짝과 메뉴 등장, 열량, 급식인원수 중 맡을 항목을 정하고 앞서 앱에서 확인한 저장 자료를 살펴봅니다. 메뉴를 맡으면 같은 이름이 나온 날짜를 표시하고, 열량이나 급식인원수를 맡으면 날짜별 값을 비교합니다."
     },
     {
      "st": "③ 예측과 관찰 비교",
      "text": "내가 맡은 항목에서 예상과 다른 점을 기록하고 짝에게 확인한 날짜와 값을 설명합니다. 기록을 마친 뒤 확인 칸을 펼쳐 교재의 계산값과 비교합니다."
     },
     {
      "st": "④ 해석 가능한 범위 검토",
      "text": "메뉴가 자주 나온 사실을 학생 선호로 바꾸어 설명하지 않습니다. 급식인원수 값이 달라진 이유를 응답만으로 알 수 있는지 판단하고, 확인되지 않은 이유는 추측으로 구분합니다."
     }
    ],
    "worksheet": [
     {
      "label": "질문과 예상",
      "placeholder": "내가 맡은 항목은 ______입니다. ______일 것으로 예상하며, 확인할 값이나 날짜는 ______입니다."
     },
     {
      "label": "관찰 근거",
      "placeholder": "확인한 날짜는 ______이며 값은 ______입니다. 예상과 비교하면 ______입니다."
     },
     {
      "label": "사실과 미확인 이유",
      "placeholder": "자료로 확인한 사실은 ______입니다. 그 이유가 ______인지는 이 응답만으로 확인할 수 없습니다."
     }
    ],
    "reveal": {
     "title": "예측과 자료 확인 후 계산값 비교",
     "text": "저장된 중식 12일의 자료에서 메뉴가 등장한 횟수는 80회이며, 서로 다른 메뉴는 68개입니다. 배추김치는 7일, 친환경칼슘기장밥과 깍두기는 각각 3일, 친환경현미밥과 시금치나물은 각각 2일 나왔습니다. 열량은 10월 14일에 624.9 Kcal로 가장 낮고, 10월 15일에 991.0 Kcal로 가장 높으며, 12일 평균은 810.4 Kcal입니다. 급식인원수가 770으로 기록된 날은 9일, 340으로 기록된 날은 3일입니다. 340인 날짜는 10월 28일, 29일, 30일입니다."
    },
    "callout": {
     "kind": "warn",
     "title": "급식인원수의 해석",
     "text": "급식인원수 값이 바뀐 이유는 응답만으로 알 수 없습니다. 급식인원수는 출석이나 잔반이 아니며, 메뉴 등장 횟수도 학생 선호가 아닙니다."
    }
   },
   {
    "title": "분석용 표와 출처 정리",
    "min": 6,
    "steps": [
     {
      "st": "① 필요한 값의 표 작성",
      "text": "11월 3일 메뉴 원문에서 세 가지를 골라 급식일, 식사, 메뉴를 구분해 한 행씩 정리합니다. 메뉴 원문을 보존하고 분석용으로 정리한 내용은 별도 열에 적습니다."
     },
     {
      "st": "② 원문과 분석본 구분",
      "text": "메뉴 원문과 분석용 이름을 나란히 비교하고 어떤 내용을 정리했는지 적습니다. 숫자와 알레르기 표기를 지운 분석본은 안전 안내에 사용하지 않습니다."
     },
     {
      "st": "③ 없는 값 구분",
      "text": "응답 항목과 누락 여부를 확인하고 없는 값은 미확인으로 남깁니다. 급식인원수 값이 있어도 실제 출석이나 잔반량으로 사용하지 않습니다."
     },
     {
      "st": "④ 출처와 한계 기록",
      "text": "제공 기관, 조회 기간, 조회 시각과 요청 조건을 표에 함께 기록합니다. 선호도와 잔반량처럼 별도 조사가 필요한 항목도 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "원문과 분석용 값",
      "placeholder": "급식일: ______ / 식사: ______ / 메뉴 원문: ______ / 분석용 이름: ______ / 정리한 내용: ______"
     },
     {
      "label": "출처 기록",
      "placeholder": "제공 기관: ______ / 조회 기간: ______ / 조회 시각: ______ / 요청 조건: ______ / 실시간, 저장본 또는 모의 자료: ______"
     },
     {
      "label": "미확인과 추가 조사",
      "placeholder": "응답에서 확인한 항목은 ______입니다. ______는 미확인이며, 별도 조사에는 ______가 필요합니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "표 작성의 필수 조건",
     "text": "메뉴 원문과 분석용 값을 구분하고 출처와 조회 시각을 기록합니다. 공개 식단의 메뉴와 급식인원수는 실제 섭취량이나 잔반 실측값이 아니며, 인증키는 학생 프롬프트나 발표 자료에 넣지 않습니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "API로 답할 수 있는 질문",
    "text": "‘자주 등장한 메뉴’와 ‘많이 남긴 메뉴’를 각각 조사하려면 어떤 자료가 필요한지 비교합니다. 공개 식단만으로 답할 수 있는 질문과 별도 측정이 필요한 질문을 나누어 씁니다."
   },
   {
    "title": "다른 학교의 요청 조건",
    "text": "공개 페이지의 학교 찾기를 사용할 수 있다면 다른 학교의 공식 코드를 확인하고 요청 조건표를 작성합니다. 실시간 조회를 하지 못했다면 조건 확인과 실제 응답 확인을 구분해 기록합니다."
   }
  ],
  "quiz": [
   {
    "q": "급식 API에서 INFO-200을 받았을 때 적절한 해석은 무엇입니까?",
    "options": [
     "지정한 날짜 등 현재 조회 조건에 맞는 자료가 없습니다.",
     "그날 급식을 남긴 사람이 없었습니다.",
     "해당 날짜에 학교가 휴교하여 급식을 제공하지 않은 것으로 확인됩니다.",
     "조회한 기간에 제공된 식단을 빠짐없이 수집하여 목록이 완성된 상태입니다."
    ],
    "answer": 0,
    "explain": "INFO-200은 해당 조회 조건의 자료가 없다는 뜻입니다. 잔반량이나 휴교 여부를 알려 주지는 않습니다."
   },
   {
    "q": "전체 건수는 15건인데 실제 받은 목록은 5건입니다. 적절한 기록은 무엇입니까?",
    "options": [
     "응답이 성공했으므로 수집을 완료했습니다.",
     "받지 못한 날짜는 급식이 제공되지 않은 날로 판단하여 기록합니다.",
     "전체 건수보다 실제 받은 목록이 적으므로 일부만 수신했습니다.",
     "전체 건수가 잘못 표시된 것으로 보고 받은 목록에 맞추어 5건으로 수정합니다."
    ],
    "answer": 2,
    "explain": "전체 건수와 받은 목록의 건수가 다르므로 불완전한 수집입니다. 교재의 인증키 없는 10월 조회에서도 이 차이를 확인했습니다."
   },
   {
    "q": "같은 급식일의 열량이 조회 시점에 따라 다르게 기록되어 있습니다. 적절한 대응은 무엇입니까?",
    "options": [
     "값이 큰 기록만 정답으로 남깁니다.",
     "열량을 비교할 수 있도록 각 자료의 조회 시각을 함께 기록합니다.",
     "현재 조회한 값에 맞추어 이전에 저장한 조회 기록의 열량 값까지 바꿉니다.",
     "예전에 저장한 자료를 오늘 실시간으로 조회한 결과라고 표시하여 발표합니다."
    ],
    "answer": 1,
    "explain": "공개 자료는 조회 시점에 따라 달라질 수 있습니다. 날짜 조건과 조회 시각, 실시간 조회인지 저장본인지를 함께 기록합니다."
   }
  ],
  "check": [
   "API의 요청 조건과 응답 항목을 구분할 수 있다.",
   "정상 응답, 자료 없음, 오류, 일부 수신을 구분할 수 있다.",
   "메뉴 원문을 보존하며 출처를 기록한 분석용 표를 만들 수 있다.",
   "저장된 실제 자료와 현재 실시간 조회를 구분할 수 있다.",
   "공개 식단과 선호도, 잔반 실측값의 차이를 설명할 수 있다."
  ],
  "terms": [
   {
    "term": "API",
    "def": "정해진 조건과 형식으로 자료를 요청하고 응답받는 방식"
   },
   {
    "term": "요청 인자",
    "def": "학교나 날짜처럼 API에 보낼 조건의 항목"
   },
   {
    "term": "응답",
    "def": "요청을 받은 API가 돌려주는 자료나 처리 결과"
   },
   {
    "term": "인증키",
    "def": "API 이용 권한을 확인하는 데 사용하는 값"
   },
   {
    "term": "스냅샷",
    "def": "특정 조회 시점의 응답을 저장해 둔 자료"
   },
   {
    "term": "메뉴 등장 횟수",
    "def": "정한 기간의 식단에서 메뉴가 나타난 횟수"
   },
   {
    "term": "급식인원수",
    "def": "API의 MLSV_FGR 항목에 기록된 인원수 값으로, 실제 출석이나 잔반 측정값과 구분되는 항목"
   }
  ],
  "teacher": [
   {
    "issue": "연결 장애로 조회가 어려운 경우",
    "response": "저장된 실제 응답으로 항목 읽기와 비교를 진행하고 현재 실시간 조회와 구분하게 합니다. 모의 자료로 대체했다면 실제 학교 식단이나 API 조회 성공으로 기록하지 않도록 합니다."
   },
   {
    "issue": "요청 조건과 응답 항목을 혼동하는 경우",
    "response": "보낸 학교, 날짜, 식사 조건을 응답의 해당 항목과 연결하게 합니다. 코드 확인이 어려우면 교재에서 확인한 학교 조건으로 하루 조회부터 진행합니다."
   },
   {
    "issue": "발견 활동의 모든 항목을 계산하려다 시간이 부족한 경우",
    "response": "짝과 메뉴 등장, 열량, 급식인원수 중 확인할 항목을 나누게 합니다. 각자 예측과 근거를 적은 뒤 결과를 설명하고 확인 칸을 열도록 합니다."
   },
   {
    "issue": "저장본의 수치와 조회 조건 확인",
    "response": "발견 활동에서는 2026년 11월 4일 22:05 KST에 조회한 당곡고 중식 12일의 자료를 살펴봅니다. 수치는 활동의 확인 칸을 기준으로 확인하고, 응답만으로 급식인원수 변화의 이유를 설명하지 않도록 합니다."
   }
  ]
 },
 {
  "no": 6,
  "why": "메뉴별 선호도를 비교하려면 같은 질문과 점수 기준으로 응답을 모아야 합니다. 미응답을 구분하고 평균 옆에 응답 수를 적어야 결과를 해석할 수 있습니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "별점과 잔반의 차이를 이야기하고 공통 질문을 확인합니다."
   },
   {
    "part": "활동",
    "min": 35,
    "what": "별점 화면 제작, 저장 확인, 가상 집계, 해석 문장 수정을 진행합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "문제를 풀고 미응답 처리와 집계 근거를 설명합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "화면 수정 내용과 집계의 한계를 공유하고 다음 차시에 사용할 기록을 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "월드컵 우승 결과만으로 각 메뉴를 얼마나 좋아하는지 알 수 있습니까?",
    "먹어 보지 않은 메뉴를 낮은 점수로 기록하면 어떤 문제가 생깁니까?",
    "평균이 높은 메뉴와 응답이 많은 메뉴를 어떻게 비교해야 합니까?"
   ],
   "expect": "교사용: 우승하지 않은 메뉴의 선호 정도는 알기 어렵고, 먹어 보지 않음은 싫어함과 다르다는 답을 예상합니다. 같은 질문과 점수 기준을 정하고 평균 옆에 응답 수를 기록하는 활동으로 연결합니다."
  },
  "activities": [
   {
    "title": "별점 질문과 화면 구성",
    "min": 13,
    "steps": [
     {
      "st": "① 공통 질문 확인",
      "text": "질문은 ‘이 메뉴를 얼마나 좋아하나요?’로 정합니다. 모든 메뉴에 같은 1~5점 기준을 적용하고 먹어 보지 않은 경우와 미응답은 빈칸으로 남깁니다."
     },
     {
      "st": "② 별점 화면 요청",
      "text": "학교에서 허용한 AI 도구에 다음 프롬프트를 붙여 넣습니다. 실제 학생 응답 대신 가상값으로 시험합니다.",
      "prompt": "메뉴 A, B, C 각각에 1~5점 선택칸이 있는 HTML 화면을 만들어 줘.\n1은 전혀 좋아하지 않음, 5는 매우 좋아함이야.\n먹어 보지 않음, 응답하지 않음은 빈칸으로 남겨 줘.\n실명 없이 확인 화면을 거쳐 한 번만 기록하게 해 줘.\n지금은 가상값을 이 기기에만 저장하고 외부로 보내지 않게 해 줘."
     },
     {
      "st": "③ 화면 확인",
      "text": "가상 점수를 선택한 뒤 선택한 값과 제출 전 확인 화면에 표시된 값을 비교합니다. 짝은 실제 개인 응답 대신 가상값으로 빈칸 처리와 키보드 조작을 확인합니다."
     },
     {
      "st": "④ 화면 개선",
      "text": "AI가 만든 화면에서 빈칸, 중복 클릭, 키보드 조작을 확인합니다. 문제가 있으면 실제 동작과 원하는 동작을 적어 수정을 요청합니다.",
      "prompt": "제출 전에 메뉴별 선택 결과를 보여 줘.\n중복 클릭으로 같은 응답이 두 번 기록되지 않게 해 줘.\n0, 6, 문자는 유효하지 않은 점수로 안내하고 키보드로도 조작할 수 있게 해 줘."
     }
    ],
    "worksheet": [
     {
      "label": "질문과 점수 기준",
      "placeholder": "공통 질문은 ______입니다. 낮은 점수와 높은 점수의 뜻은 각각 ______입니다."
     },
     {
      "label": "화면 시험 기록",
      "placeholder": "가상값으로 ______을 했을 때 ______이 표시되었습니다. 기대한 결과는 ______입니다."
     },
     {
      "label": "수정 요청과 재확인",
      "placeholder": "______을 고쳐 달라고 요청했습니다. 같은 순서로 다시 시험한 결과는 ______입니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "선호와 잔반의 구분",
     "text": "별점은 메뉴를 좋아하는 정도를 나타내는 응답입니다. 실제 남긴 양을 측정한 값으로 사용하지 않습니다."
    }
   },
   {
    "title": "응답 표와 저장 결과 확인",
    "min": 7,
    "steps": [
     {
      "st": "① 한 행의 의미 확인",
      "text": "한 메뉴에 대한 응답 하나를 표의 한 행으로 정리합니다. 가상 응답 표식을 실명과 연결하지 않습니다."
     },
     {
      "st": "② 작은 가상 표 계산",
      "text": "별도의 작은 가상 표에서 메뉴 A의 점수가 4점과 5점이면 평균은 4.5점이고 유효 응답은 2건입니다. 메뉴 B의 응답이 빈칸뿐이면 평균을 0점으로 표시하지 않고 계산할 수 없는 상태로 표시합니다. 이 표는 다음 활동의 가상 응답 3건과 다른 자료입니다."
     },
     {
      "st": "③ 화면과 저장값 대조",
      "text": "교사가 준비한 가상 응답 한 건으로 화면의 선택값과 저장된 값을 비교합니다. 메뉴 이름, 점수, 빈칸이 예상한 열에 들어갔는지 표시합니다."
     },
     {
      "st": "④ 중복과 열람 범위 점검",
      "text": "이번 화면에서는 응답을 외부로 보내지 않으므로 이 기기의 저장값이나 가상 표와 대조해 같은 응답이 중복 저장되지 않는지 확인합니다. 교사가 승인된 환경에서 시트 연동을 시연하면 필요한 사람만 원자료를 볼 수 있는지도 확인합니다. 실제 전송 여부는 따로 기록합니다."
     }
    ],
    "worksheet": [
     {
      "label": "한 행 설명",
      "placeholder": "이 표의 한 행은 ______을 뜻합니다. 빈칸은 ______ 상태입니다."
     },
     {
      "label": "저장 대조 기록",
      "placeholder": "화면의 ______과 저장된 ______을 비교했습니다. 일치 여부와 중복 여부는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "가상 응답으로 확인",
     "text": "실제 응답을 보내기 전에 가상값으로 저장 결과를 확인합니다. 외부 공유나 웹앱 배포는 학교의 운영 승인 범위를 확인한 뒤 진행합니다."
    }
   },
   {
    "title": "가상 응답 집계와 예측 확인",
    "min": 9,
    "steps": [
     {
      "st": "① 가상 응답 정리",
      "text": "메뉴 A, B, C 순서로 연습01은 4점, 빈칸, 2점이고 연습02는 5점, 5점, 1점이며 연습03은 3점, 빈칸, 4점입니다. 실제 학생 응답이 아닌 연습 자료임을 표의 제목에 적습니다."
     },
     {
      "st": "② 집계 결과 예측",
      "text": "메뉴마다 유효한 점수를 골라 평균과 응답 수를 계산합니다. 빈칸을 평균 계산에서 어떻게 처리했는지 옆에 적고, 예상 결과를 기록한 뒤 앱을 엽니다."
     },
     {
      "st": "③ 앱으로 집계 확인",
      "text": "이 앱으로 가상 별점을 기록하고 메뉴별 평균과 응답 수를 확인합니다. 빈칸이 평균 계산에서 제외되는지 앞에서 계산한 값과 대조합니다."
     },
     {
      "st": "④ 예측과 결과 대조",
      "text": "예상과 다른 값이 있으면 원래 점수, 유효 응답 수, 중복 기록 순서로 확인합니다. 직접 계산하고 앱에서 확인한 뒤 아래 확인 칸을 펼칩니다."
     }
    ],
    "worksheet": [
     {
      "label": "메뉴별 예상 집계",
      "placeholder": "메뉴 ______의 유효 점수는 ______이며 예상 평균은 ______점, 응답 수는 ______건입니다."
     },
     {
      "label": "앱 확인과 차이의 이유",
      "placeholder": "앱에서 확인한 평균과 응답 수는 ______입니다. 예상과의 차이는 ______에서 생겼습니다."
     }
    ],
    "reveal": {
     "title": "계산과 앱 확인 후 펼치는 가상 집계",
     "text": "연습용 가상 자료의 집계입니다. 메뉴 A는 평균 4.0점에 응답 3건, 메뉴 B는 평균 5.0점에 응답 1건, 메뉴 C는 평균 약 2.3점에 응답 3건입니다."
    },
    "callout": {
     "kind": "check",
     "title": "필수 확인 조건",
     "text": "집계 표에 가상 자료 표시, 메뉴별 평균, 유효 응답 수를 함께 넣습니다. 미응답을 0점으로 바꾸지 않았는지 확인합니다."
    },
    "app": "s8"
   },
   {
    "title": "평균과 응답 수 해석",
    "min": 6,
    "steps": [
     {
      "st": "① 가상 집계 비교",
      "text": "가상 자료에서 메뉴 A의 평균은 4.0점, 응답 수는 3건이고 메뉴 B의 평균은 5.0점, 응답 수는 1건입니다. 평균과 응답 수를 함께 비교합니다."
     },
     {
      "st": "② 해석 문장 작성",
      "text": "확인한 평균과 응답 수를 적고, 결과를 해석할 때 추가로 확인할 조건을 씁니다. 응답이 적은 메뉴의 평균만으로 더 좋은 메뉴라고 단정하지 않습니다."
     },
     {
      "st": "③ 짝 점검과 문장 수정",
      "text": "짝의 문장에서 집계로 확인한 내용과 추가 확인이 필요한 내용을 구분합니다. 별점으로 잔반량을 설명하거나 집계 결과를 학교 전체의 선호로 일반화한 표현을 찾아 고칩니다."
     },
     {
      "st": "④ 다음 조사 질문 작성",
      "text": "저장 자료에 있는 날짜의 실제 메뉴 묶음으로 별점을 남길 때도 같은 질문과 점수 기준을 적용합니다. 실제 메뉴를 사용했다는 사실과 응답이 실제인지 가상인지의 구분을 각각 기록합니다."
     }
    ],
    "worksheet": [
     {
      "label": "관찰과 한계",
      "placeholder": "가상 자료에서 ______을 확인했습니다. 이 결과만으로 ______은 판단하기 어렵습니다."
     },
     {
      "label": "짝 점검 후 수정",
      "placeholder": "처음 문장의 ______을 ______으로 고쳤습니다. 더 확인할 조건은 ______입니다."
     }
    ],
    "callout": {
     "kind": "tip",
     "title": "집계의 해석 범위",
     "text": "조사에 참여한 사람들의 응답 범위에서 결과를 설명합니다. 숫자만으로 메뉴나 조리하신 분을 평가하지 않습니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "유효 응답이 없는 메뉴의 안내",
    "text": "가상 시험에서 한 메뉴의 응답을 빈칸으로 남기고 평균 안내를 확인합니다. 0점과 계산 불가를 구분하도록 수정 요청을 작성합니다.",
    "prompt": "유효 응답이 없는 메뉴는 평균을 계산할 수 없다고 알려 줘. 평균 옆에는 유효 응답 수를 보여 줘."
   }
  ],
  "quiz": [
   {
    "q": "어떤 메뉴의 응답이 모두 빈칸입니다. 평균은 어떻게 표시해야 합니까?",
    "options": [
     "유효한 응답이 없어 평균 계산 불가로 표시",
     "빈 응답을 0점으로 기록",
     "해당 메뉴의 빈 응답을 다른 메뉴의 평균으로 채워 기록",
     "해당 메뉴의 빈 응답을 점수 기준의 중간값으로 채워 기록"
    ],
    "answer": 0,
    "explain": "빈칸은 유효한 점수가 아니므로 평균 계산에서 제외합니다. 유효 응답이 없으면 평균을 계산할 수 없습니다."
   },
   {
    "q": "가상 자료에서 A는 평균 4.0점에 응답 3건, B는 평균 5.0점에 응답 1건입니다. 적절한 해석은 무엇입니까?",
    "options": [
     "B가 학교 전체에서 더 선호됩니다.",
     "B의 평균이 높으므로 실제 잔반량도 A보다 적다는 결과입니다.",
     "메뉴별 평균을 해석할 때는 응답 수를 함께 살펴야 합니다.",
     "A는 응답이 적으므로 평균을 비교하는 분석 대상에서 제외해야 합니다."
    ],
    "answer": 2,
    "explain": "메뉴마다 응답 수가 다르므로 평균만으로 우열을 단정하기 어렵습니다. 별점으로 실제 잔반량을 알 수도 없습니다."
   },
   {
    "q": "같은 가상 응답을 제출한 뒤 저장 결과를 확인할 때 적절한 행동은 무엇입니까?",
    "options": [
     "완료 안내가 있으면 대조를 생략합니다.",
     "참가자를 구분하려고 응답 표식을 실명과 연결한 확인용 명단을 만듭니다.",
     "저장된 기록이 늘어나면 새로운 응답으로 판단하여 집계에 포함합니다.",
     "가상 응답에서 선택한 값과 실제로 저장된 값을 대조합니다."
    ],
    "answer": 3,
    "explain": "완료 안내와 실제 저장 결과는 따로 확인합니다. 선택값의 일치 여부와 중복 기록 여부를 가상 응답으로 시험합니다."
   }
  ],
  "check": [
   "같은 질문과 점수 기준으로 메뉴별 별점 화면을 구성할 수 있다.",
   "가상값으로 저장 결과와 중복 기록 여부를 확인할 수 있다.",
   "미응답을 구분하고 평균과 응답 수를 함께 설명할 수 있다."
  ],
  "terms": [
   {
    "term": "선호도",
    "def": "대상을 좋아하는 정도"
   },
   {
    "term": "척도",
    "def": "응답을 수치로 나타내는 공통 기준"
   },
   {
    "term": "미응답",
    "def": "질문에 응답하지 않은 상태"
   },
   {
    "term": "유효 응답 수",
    "def": "정해진 점수 기준에 맞아 집계에 포함되는 응답의 수"
   },
   {
    "term": "평균",
    "def": "유효한 점수의 합을 유효 응답 수로 나눈 값"
   }
  ],
  "teacher": [
   {
    "issue": "먹어 보지 않은 메뉴를 낮은 점수로 기록합니다.",
    "response": "좋아하지 않는 경우와 먹어 본 경험이 없어 판단할 수 없는 경우를 구분하게 합니다. 빈칸을 점수로 바꾸지 않고 유효 응답 수에서 제외하는 이유를 말하게 합니다."
   },
   {
    "issue": "화면 제작이나 시트 연결에 시간이 오래 걸립니다.",
    "response": "교사가 준비한 예제로 같은 가상값을 시험하게 합니다. 화면 확인, 저장 대조, 집계 해석을 진행하되 실제 전송을 하지 않았다면 그 사실을 기록하게 합니다."
   },
   {
    "issue": "평균이 가장 높은 메뉴를 학교 전체의 선호 메뉴라고 씁니다.",
    "response": "해당 메뉴의 응답 수와 자료의 성격을 함께 읽게 합니다. 관찰 문장 뒤에 추가로 필요한 조사 조건을 적게 합니다."
   }
  ]
 },
 {
  "no": 7,
  "why": "메뉴별 별점을 같은 순서로 나열하면 응답의 유사성을 비교할 수 있습니다. 유사도 수치가 무엇을 비교한 결과인지 이해하고 개인별 결과의 공개 범위를 정합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "비슷한 별점의 뜻을 예상하고 비교 조건을 이야기합니다."
   },
   {
    "part": "활동",
    "min": 35,
    "what": "벡터 구성, 코사인 계산, 공통 응답 비교, 공개 범위 점검을 진행합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "메뉴 순서와 미응답 처리, 해석 범위를 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "개인 결과를 제외하고 계산 방법과 한계를 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "점수의 합이 비슷하면 좋아하는 메뉴도 비슷하다고 볼 수 있습니까?",
    "같은 위치의 숫자가 서로 다른 메뉴를 뜻하면 비교 결과를 믿을 수 있습니까?",
    "별점이 비슷하다는 결과로 어디까지 설명할 수 있습니까?"
   ],
   "expect": "교사용: 합계보다 어떤 메뉴에 높은 점수를 주었는지가 중요하다는 답을 예상합니다. 메뉴 순서와 공통 응답을 먼저 확인한 뒤 방향을 비교하는 활동으로 연결합니다."
  },
  "activities": [
   {
    "title": "별점 벡터 구성",
    "min": 8,
    "steps": [
     {
      "st": "① 메뉴 순서 통일",
      "text": "가상 별점을 메뉴 1, 메뉴 2, 메뉴 3 순서로 정리합니다. 같은 위치의 숫자가 같은 메뉴를 뜻하도록 열 순서를 맞춥니다."
     },
     {
      "st": "② 가상 벡터 작성",
      "text": "가상 응답 A는 [5, 3, 1], B는 [4, 2, 1], C는 [1, 3, 5]로 적습니다. 이 예시에는 미응답이 없으며 A, B, C는 실제 학생이 아닙니다."
     },
     {
      "st": "③ 계산 전 예측",
      "text": "A의 응답과 점수 방향이 더 비슷한 응답을 고르고 이유를 적습니다. 어느 메뉴에 높은 점수와 낮은 점수를 주었는지 비교합니다."
     },
     {
      "st": "④ 열 순서 점검",
      "text": "짝은 벡터의 각 숫자가 어느 메뉴의 점수인지 말합니다. 열 순서를 바꿀 때 메뉴 이름과 점수가 함께 옮겨져야 하는 이유를 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "메뉴 순서와 벡터",
      "placeholder": "메뉴 순서는 ______입니다. 가상 응답 ______의 벡터는 ______입니다."
     },
     {
      "label": "계산 전 예상",
      "placeholder": "A와 방향이 더 비슷할 것으로 예상한 응답은 ______입니다. 메뉴별 점수를 보면 ______이기 때문입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "비교 조건",
     "text": "열 순서와 점수 기준이 같은지 먼저 확인합니다. 미응답을 임의로 0점으로 바꾸지 않습니다."
    }
   },
   {
    "title": "코사인 계산과 예측 대조",
    "min": 10,
    "steps": [
     {
      "st": "① 곱의 합 계산",
      "text": "A와 B의 같은 위치에 있는 값을 곱해 더하면 5×4 + 3×2 + 1×1 = 27입니다. 각 곱에서 같은 메뉴에 대한 두 점수를 사용했는지 확인합니다."
     },
     {
      "st": "② 벡터의 길이 확인",
      "text": "A의 길이는 √(25+9+1) = √35, B의 길이는 √(16+4+1) = √21입니다. 곱의 합을 두 길이의 곱으로 나누어 방향의 유사성을 계산합니다."
     },
     {
      "st": "③ 다른 비교 계산",
      "text": "같은 방법으로 A와 C를 비교하고 계산 결과를 적습니다. 어느 비교의 값이 더 큰지 확인한 뒤 처음의 예상과 대조합니다."
     },
     {
      "st": "④ 계산 근거 설명",
      "text": "짝에게 메뉴 순서, 곱의 합, 두 길이의 곱을 차례로 설명합니다. 최종 소수값만 적지 않고 계산에 사용한 벡터를 함께 남깁니다."
     }
    ],
    "worksheet": [
     {
      "label": "계산 기록",
      "placeholder": "______와 ______의 곱의 합은 ______이고 두 길이의 곱은 ______입니다. 나눈 값은 ______입니다."
     },
     {
      "label": "예상과의 비교",
      "placeholder": "계산 전 예상과 ______했습니다. 같은 메뉴의 점수 방향을 비교하면 ______으로 설명할 수 있습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "계산할 수 없는 경우",
     "text": "모든 성분이 0인 벡터가 있으면 분모가 0이 되어 코사인 유사도를 계산할 수 없습니다. 미응답을 0점으로 바꾸어 계산을 진행하지 않습니다."
    }
   },
   {
    "title": "공통 응답 비교와 앱 확인",
    "min": 10,
    "steps": [
     {
      "st": "① 앞의 계산 확인",
      "text": "이 앱으로 앞의 가상 자료를 비교하고 계산 결과를 대조합니다. 직접 계산한 값과 차이가 있으면 벡터의 순서와 입력값부터 확인합니다."
     },
     {
      "st": "② 미응답이 있는 자료 준비",
      "text": "앞 차시 가상 자료에서 연습01은 메뉴 A, B, C에 4점, 빈칸, 2점을 기록했습니다. 연습02는 5점, 5점, 1점이고 연습03은 3점, 빈칸, 4점입니다."
     },
     {
      "st": "③ 공통 메뉴 선택과 예상",
      "text": "연습01을 기준으로 비교할 때 두 응답에 모두 점수가 있는 메뉴만 표시합니다. 메뉴 A와 C의 점수를 보고 어느 응답의 방향이 더 비슷할지 예상합니다."
     },
     {
      "st": "④ 실행과 조건 확인",
      "text": "앱의 결과를 확인하고 사용한 메뉴 수와 공통 응답 수를 기록합니다. 공통 응답이 2개보다 적으면 계산하지 않으며, 실행을 마친 뒤 확인 칸을 펼칩니다."
     }
    ],
    "worksheet": [
     {
      "label": "공통 응답과 예상",
      "placeholder": "기준 응답은 ______이며 비교에 사용할 공통 메뉴는 ______입니다. 더 비슷할 것으로 예상한 응답과 이유는 ______입니다."
     },
     {
      "label": "앱 결과 대조",
      "placeholder": "사용한 메뉴 수는 ______이고 공통 응답 수는 ______입니다. 앱 결과는 ______이며 계산 또는 예상과 ______합니다."
     },
     {
      "label": "제외 이유",
      "placeholder": "메뉴 ______을 제외한 이유는 ______입니다. 빈칸을 0점으로 바꾸면 ______ 문제가 생깁니다."
     }
    ],
    "reveal": {
     "title": "예측과 앱 확인 후 펼치는 유사도",
     "text": "가상 응답 A [5, 3, 1]과 가상 응답 B [4, 2, 1]의 코사인 유사도는 약 0.9959이고, 가상 응답 A와 가상 응답 C [1, 3, 5]의 코사인 유사도는 약 0.5429입니다. 앞 차시 가상 응답에서 연습01을 기준으로 메뉴 A와 메뉴 C만 비교하면 연습02와는 약 0.9648, 연습03과는 약 0.8944입니다. 메뉴 B는 연습01이 응답하지 않아 두 비교에서 모두 제외합니다. 별점은 모두 양수이므로 이 값들을 일반적인 유사성 판단의 기준으로 삼지 않습니다."
    },
    "callout": {
     "kind": "check",
     "title": "필수 기록 조건",
     "text": "메뉴 순서, 공통 응답 수, 메뉴를 제외한 이유를 함께 기록합니다. 가상 예시를 제외한 개인별 결과는 내 것만 확인하며 다른 사람의 이름과 별점은 공개하지 않습니다."
    },
    "app": "s9"
   },
   {
    "title": "결과 해석과 공개 범위",
    "min": 7,
    "steps": [
     {
      "st": "① 해석 범위 작성",
      "text": "결과는 이번 메뉴 응답에서 나타난 선호 방향의 유사성으로 설명합니다. 입력 메뉴나 응답 방식이 달라지면 결과가 달라질 수 있음을 적습니다."
     },
     {
      "st": "② 개인별 결과 확인",
      "text": "개인별 결과는 내 것만 확인합니다. 친구의 별점 전체나 개인별 순위를 공개하지 않습니다."
     },
     {
      "st": "③ 문장 점검과 수정",
      "text": "가상 예시의 유사도 0.9959는 친구 관계나 건강 상태의 점수가 아닙니다. 몇 개 메뉴의 응답으로 성격이나 친밀도를 판단하는 문장을 이번 자료의 비교 결과를 설명하는 문장으로 고칩니다."
     },
     {
      "st": "④ 방법과 한계 정리",
      "text": "벡터 표와 계산 방법, 사용한 메뉴 수, 해석의 한계를 정리합니다. 공유할 기록에는 개인 이름을 넣지 않으며, 별명으로도 사람을 알아볼 수 있는지 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "해석 문장",
      "placeholder": "이번 ______ 메뉴의 공통 응답에서는 ______의 방향이 더 비슷했습니다. 이 값으로 ______을 판단할 수는 없습니다."
     },
     {
      "label": "공개 범위와 한계",
      "placeholder": "공유할 내용은 ______이고 본인만 확인할 내용은 ______입니다. 메뉴 수가 적어서 ______을 설명하기 어렵습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "프라이버시 보호",
     "text": "별점 응답도 프라이버시 보호 대상입니다. 메뉴 수가 적은 자료의 결과를 폭넓게 해석할 수는 없으며, 공유할 때는 계산 방법과 한계를 중심으로 설명합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "비교 불가 안내 점검",
    "text": "가상 자료의 미응답을 조정해 공통 응답이 2개 미만인 상태를 만들고 안내를 확인합니다. 계산 불가 이유를 적되 개인의 응답 부족을 평가하는 표현은 사용하지 않습니다."
   }
  ],
  "quiz": [
   {
    "q": "두 별점 벡터를 비교하기 전에 확인할 조건은 무엇입니까?",
    "options": [
     "응답자의 평균 점수가 같음",
     "두 벡터에서 비교하는 메뉴의 순서가 같음",
     "각 응답자의 메뉴를 높은 점수순으로 따로 정렬",
     "두 응답자의 미응답을 낮은 점수로 바꾸어 벡터에 입력"
    ],
    "answer": 1,
    "explain": "같은 위치의 숫자가 같은 메뉴를 나타내야 비교할 수 있습니다. 점수 기준과 미응답 처리 기준도 확인합니다."
   },
   {
    "q": "두 가상 응답의 공통 응답 메뉴가 2개 미만입니다. 이 교재의 처리 기준은 무엇입니까?",
    "options": [
     "빈칸에 0점을 넣어 계산합니다.",
     "다른 응답자가 같은 메뉴에 준 점수를 가져와 빈칸을 채웁니다.",
     "공통 응답 메뉴가 부족하므로 유사도를 계산하지 않습니다.",
     "각 응답자의 별점 합계를 구하여 코사인 유사도 값을 대신합니다."
    ],
    "answer": 2,
    "explain": "이 활동에서는 공통 응답이 2개보다 적으면 계산하지 않습니다. 미응답을 임의의 점수로 바꾸지 않습니다."
   },
   {
    "q": "코사인 유사도 결과에 대한 적절한 설명은 무엇입니까?",
    "options": [
     "이번에 입력한 별점 벡터의 방향을 비교한 결과입니다.",
     "응답자들의 친구 관계를 나타냅니다.",
     "응답자들의 건강 상태가 서로 얼마나 비슷한지를 나타내는 결과입니다.",
     "이번에 비교하지 않은 다른 메뉴에서도 같은 선호가 나타날 것임을 뜻합니다."
    ],
    "answer": 0,
    "explain": "코사인 유사도는 입력한 벡터의 방향을 비교한 값입니다. 이 결과로 사람의 성격이나 관계를 판단할 수 없습니다."
   }
  ],
  "check": [
   "같은 메뉴 순서로 별점 벡터를 만들 수 있다.",
   "코사인 유사도 결과를 계산 전 예측과 비교할 수 있다.",
   "공통 응답을 골라 미응답 처리 기준을 설명할 수 있다.",
   "내 결과만 확인하고 유사도의 해석 범위를 설명할 수 있다."
  ],
  "terms": [
   {
    "term": "벡터",
    "def": "정해진 순서로 숫자를 나열한 것"
   },
   {
    "term": "코사인 유사도",
    "def": "두 벡터의 방향이 비슷한 정도를 나타내는 값"
   },
   {
    "term": "공통 응답",
    "def": "비교하는 두 응답자가 모두 점수를 기록한 메뉴의 응답"
   },
   {
    "term": "프라이버시",
    "def": "개인의 정보가 본인이 원하지 않는 범위로 공개되거나 사용되지 않도록 보호받을 권리"
   }
  ],
  "teacher": [
   {
    "issue": "숫자의 순서만 옮기고 메뉴 이름은 그대로 둡니다.",
    "response": "각 숫자 아래에 메뉴 이름을 적게 합니다. 같은 위치에서 같은 메뉴의 점수를 비교하고 있는지 짝이 설명하게 합니다."
   },
   {
    "issue": "제곱근 계산에 시간이 오래 걸립니다.",
    "response": "곱의 합과 벡터의 길이까지 확인한 뒤 계산기를 사용하게 합니다. 소수값 암기보다 메뉴 순서와 해당 응답을 계산에 포함한 근거를 확인합니다."
   },
   {
    "issue": "유사도를 친구 관계의 순위로 발표하려고 합니다.",
    "response": "가상 응답으로 설명을 바꾸고 개인 결과의 공개를 멈추게 합니다. 공유물에는 계산 방법, 공통 응답 수, 해석의 한계만 남기게 합니다."
   }
  ]
 },
 {
  "no": 8,
  "why": "메뉴 특성으로 잔반을 예측하려면 입력과 예측 대상의 출처를 구분해야 합니다. 모의 잔반 자료로 회귀 절차를 연습하고, 학습에 사용하지 않은 자료에서 예측 오차를 확인합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "급식 API에 있는 값과 잔반 예측에 추가로 필요한 값을 구분합니다."
   },
   {
    "part": "활동",
    "min": 35,
    "what": "입력 정의, 실제 메뉴의 특성 분류, 작은 회귀 계산, 앱 실행, 계수 해석을 진행합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "학습과 시험 분리, 오차 단위, 계수 해석을 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "모의 결과임을 밝히며 시험 성능과 해석 조건을 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "공개 식단에 메뉴 이름이 있으면 그날 남긴 양도 알 수 있습니까?",
    "학습에 사용한 자료로 성능을 확인하면 무엇을 놓칠 수 있습니까?",
    "튀김 여부의 계수가 양수라면 실제 조리법을 바꿀 근거로 충분합니까?"
   ],
   "expect": "교사용: 메뉴와 잔반 실측값은 다르고, 학습한 자료만으로 새 자료의 성능을 알기 어렵다는 답을 예상합니다. 입력과 목표값의 출처를 따로 적고 모의 회귀를 시험 자료에서 확인하도록 안내합니다."
  },
  "activities": [
   {
    "title": "입력 특성과 목표값 구분",
    "min": 7,
    "steps": [
     {
      "st": "① 예측 대상 확인",
      "text": "입력은 메뉴의 특성이고 목표값은 예측하려는 잔반 값입니다. 급식 API의 메뉴 정보만으로 정답으로 사용할 실측 잔반값을 얻을 수는 없습니다."
     },
     {
      "st": "② 특성 기록 기준 작성",
      "text": "튀김 여부, 매운맛 여부, 국류 여부를 각각 0 또는 1로 표현하는 기준을 확인합니다. 메뉴 이름만으로 판단하기 어려우면 미확인으로 남기고 원문을 보존합니다."
     },
     {
      "st": "③ 범주의 숫자 표현",
      "text": "구이, 볶음, 찜처럼 순서가 없는 조리 유형에 1, 2, 3을 매기지 않습니다. 유형별 열을 두고 해당하면 1, 아니면 0으로 나타내는 원핫 인코딩을 사용합니다."
     },
     {
      "st": "④ 표현 방식 비교",
      "text": "조리 유형을 원핫 인코딩으로 표현하는 것과 튀김 여부, 매운맛 여부를 각각 0 또는 1로 표현하는 것을 구분합니다. 짝에게 입력 열과 목표값 열을 설명하고 각 값의 출처를 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "입력과 목표값",
      "placeholder": "입력 특성은 ______이고 목표값은 ______입니다. 각 값의 출처는 ______입니다."
     },
     {
      "label": "특성 판단 기준",
      "placeholder": "특성 ______은 ______이면 1, ______이면 0으로 기록합니다. 판단하기 어려우면 ______으로 남깁니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "모의 목표값 표시",
     "text": "이번 회귀 연습의 입력과 잔반률은 수업을 위해 만든 가상값입니다. 실제 식단에서 측정한 잔반이나 학교의 개선 성과로 소개하지 않습니다."
    }
   },
   {
    "title": "실제 메뉴 이름의 특성 분류",
    "min": 7,
    "steps": [
     {
      "st": "① 원문과 분류 대상 확인",
      "text": "5차시에서 살펴본 당곡고 중식 저장본의 메뉴 원문을 확인합니다. 실제 메뉴 이름으로 특성을 정하는 활동이며, 여기에 잔반 정답이 포함된 것은 아닙니다."
     },
     {
      "st": "② 분류 예측",
      "text": "꽃전, 타코야끼, 미니도넛, 달걀후라이, 새우튀김&칠리소스, 레몬크림깐쇼새우, 치킨샐러드&허니머스터드S, 버터갈릭감자튀김, 미니돈가스&파채, 생선까스&콘소스를 튀김 반찬, 튀김 반찬 아님, 미확인 중 어디에 넣을지 예상해 적습니다."
     },
     {
      "st": "③ 저장 자료와 대조",
      "text": "메뉴 이름과 나온 날짜를 원자료에서 확인하고, 튀김 반찬이 나온 일수를 날짜 기준으로 집계합니다. 이름으로 판단한 분류와 실제 조리법 확인을 구분한 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "④ 미확인 사유 기록",
      "text": "판단이 어려운 메뉴는 미확인으로 남기고 필요한 확인 자료를 적습니다. 이 실제 메뉴 분류 표는 뒤의 모의 회귀 자료에 섞지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "분류 예상과 이유",
      "placeholder": "메뉴 ______은 이름의 ______을 근거로 ______으로 예상했습니다."
     },
     {
      "label": "날짜 대조와 한계",
      "placeholder": "원자료에서 확인한 날짜와 메뉴는 ______입니다. 이름만으로 ______은 확인하기 어렵습니다."
     }
    ],
    "reveal": {
     "title": "분류 예측과 원자료 대조 후 펼치는 결과",
     "text": "저장된 당곡고 중식 12일 자료에서 이름 규칙으로 분류하면 튀김 반찬이 나온 날은 7일입니다. 해당 메뉴는 타코야끼, 새우튀김&칠리소스, 미니돈가스&파채, 버터갈릭감자튀김, 생선까스&콘소스, 미니도넛, 레몬크림깐쇼새우입니다. 꽃전, 치킨샐러드&허니머스터드S, 달걀후라이는 이름만으로 정하기 어려워 미확인으로 둡니다."
    },
    "callout": {
     "kind": "warn",
     "title": "이름 규칙과 실측의 구분",
     "text": "메뉴 이름으로 만든 특성은 조리 현장을 확인한 결과가 아닙니다. 이 표를 모의 잔반 자료와 합쳐 실제 학교의 예측 성능으로 소개하지 않습니다."
    }
   },
   {
    "title": "작은 회귀 예제와 시험 오차",
    "min": 8,
    "steps": [
     {
      "st": "① 학습과 시험 분리",
      "text": "모델을 학습시키기 전에 학습 자료와 시험 자료를 나눕니다. 같은 날의 같은 항목이 양쪽에 섞이지 않는지 확인합니다."
     },
     {
      "st": "② 학습 직선 확인",
      "text": "별도의 작은 모의 예제에서 선호 점수 x가 1, 2, 3, 4일 때 잔반률은 각각 8%, 6%, 4%, 2%입니다. 이 학습 자료로 얻은 직선은 ‘예측 잔반률 = 10 − 2×x’입니다."
     },
     {
      "st": "③ 시험 예측 계산",
      "text": "시험값 x가 1.5와 3.5일 때 예측값을 먼저 계산합니다. 계산한 뒤 모의 정답 7.5%, 2.5%와 각각 비교해 오차의 크기를 적습니다."
     },
     {
      "st": "④ 시험 MAE 계산",
      "text": "두 절대 오차를 더해 시험 자료 수로 나누어 MAE를 구합니다. 짝과 계산을 대조하고 오차의 부호를 그대로 평균 내지 않는 이유를 설명합니다."
     },
     {
      "st": "⑤ 기준 모델 비교",
      "text": "작은 모의 예제에서 학습 잔반률의 평균인 5%를 예측하는 기준 모델의 시험 MAE는 2.5%p입니다. 직선 모델과 같은 시험 자료에서 같은 지표로 비교합니다."
     }
    ],
    "worksheet": [
     {
      "label": "시험 예측과 절대 오차",
      "placeholder": "시험 x가 ______일 때 예측은 ______%이고 모의 정답은 ______%입니다. 절대 오차는 ______%p입니다."
     },
     {
      "label": "기준 모델 비교",
      "placeholder": "같은 시험 자료에서 직선 모델의 MAE는 ______이고 기준 모델의 MAE는 ______입니다. 이 결과의 범위는 ______입니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "오차 단위 확인",
     "text": "잔반률 두 값의 차이는 퍼센트포인트로 읽습니다. 이 예제의 MAE는 0.5%가 아니라 0.5%p입니다."
    },
    "reveal": {
     "title": "계산 확인",
     "text": "시험 자료의 예측은 7.0%, 3.0%이고 MAE는 (0.5 + 0.5) ÷ 2 = 0.5%p입니다. 학습 평균 5%만 예측하는 기준 모델의 MAE는 2.5%p입니다."
    }
   },
   {
    "title": "메뉴 특성 회귀 실행과 성능 비교",
    "min": 8,
    "steps": [
     {
      "st": "① 자료와 분할 확인",
      "text": "이 앱으로 튀김 여부, 매운맛 여부, 국류 여부를 입력 특성으로 사용하는 모의 회귀 실습을 합니다. 학습 16행과 시험 4행을 구분하고 목표값이 모의 잔반률인지 확인합니다."
     },
     {
      "st": "② 실행 전 예상",
      "text": "메뉴 특성을 사용하는 모델과 학습 평균만 예측하는 기준 모델 중 어느 쪽의 시험 오차가 작을지 예상합니다. 앞의 작은 예제와 이번 예제는 다른 자료임을 기록합니다."
     },
     {
      "st": "③ 실행 결과 기록",
      "text": "앱을 실행하고 모델의 시험 오차와 기준 모델의 오차를 기록합니다. 기준 모델이 사용하는 학습 평균 14.5%에 시험 정답이 섞이지 않았는지 확인합니다."
     },
     {
      "st": "④ 교재 예시와 대조",
      "text": "실행 결과와 예상의 차이를 설명한 뒤 확인 칸을 펼칩니다. 앞의 작은 예제와 오차 수치가 같더라도 자료와 설정을 함께 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "실행 조건과 예상",
      "placeholder": "입력은 ______이고 학습과 시험의 구분은 ______입니다. 시험 오차는 ______일 것으로 예상합니다."
     },
     {
      "label": "실행 결과",
      "placeholder": "모델의 시험 MAE는 ______이고 기준 모델의 시험 MAE는 ______입니다. 예상과 비교하면 ______입니다."
     }
    ],
    "reveal": {
     "title": "예측과 실행 후 펼치는 메뉴 특성 회귀 결과",
     "text": "모의 메뉴 특성 회귀는 학습 16행과 시험 4행을 사용합니다. 모델의 시험 MAE는 0.5%p이고 학습 평균 14.5%를 예측하는 기준 모델의 시험 MAE는 2.5%p입니다."
    },
    "callout": {
     "kind": "warn",
     "title": "비교 결과의 범위",
     "text": "모의 예제에서 오차가 작았다는 결과를 실제 학교의 예측 성능으로 확대하지 않습니다. 더 많은 실제 자료를 사용하고 기간을 달리해 예측 성능을 확인해야 합니다."
    },
    "app": "s10"
   },
   {
    "title": "계수 해석과 결과 기록",
    "min": 5,
    "steps": [
     {
      "st": "① 절편 확인",
      "text": "메뉴 특성 모의 예제의 절편은 12이며, 모든 입력 특성이 0일 때 예측 잔반률이 12%라는 뜻입니다. 입력 특성의 코딩 기준과 함께 기록합니다."
     },
     {
      "st": "② 계수의 조건과 단위 확인",
      "text": "다른 입력이 같을 때 해당 특성이 0에서 1로 바뀌면 예측 잔반률의 차이는 튀김이 +4%p, 매운맛이 +3%p, 국류가 −2%p입니다. 이 계수는 모의 자료의 생성 규칙에서 나온 값입니다."
     },
     {
      "st": "③ 해석 문장 서로 점검",
      "text": "특성을 골라 ‘다른 입력이 같을 때’라는 조건과 %p 단위를 넣어 설명합니다. 짝은 모의 계수를 실제 조리법의 효과로 단정한 부분이 있는지 확인합니다."
     },
     {
      "st": "④ 실습 기록 정리",
      "text": "입력과 목표값의 출처, 학습과 시험의 구분, 시험 MAE, 기준 모델, 계수 해석을 정리합니다. 표와 설명에 모의 결과임을 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "조건을 포함한 계수 해석",
      "placeholder": "모의 예제에서 다른 입력이 같을 때 ______이 0에서 1로 바뀌면 예측 잔반률은 ______%p만큼 ______합니다."
     },
     {
      "label": "결과의 한계",
      "placeholder": "이 계수는 ______에서 나온 값입니다. 실제 식단 변경 전에 ______을 확인해야 합니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "계수와 원인의 구분",
     "text": "계수의 방향만으로 특정 조리법이 잔반을 늘리거나 줄이는 원인이라고 단정하지 않습니다. 실제 식단 변경에는 추가 자료와 현장 검토가 필요합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "특성 분류 기준 보완",
    "text": "미확인으로 남긴 메뉴를 골라 어떤 자료가 있어야 특성을 판단할 수 있는지 적습니다. 조리법을 확인하지 않은 상태에서 임의로 분류하지 않습니다."
   },
   {
    "title": "모델 비교 설명문 점검",
    "text": "작은 직선 예제와 메뉴 특성 예제의 결과를 각각 설명합니다. 시험 MAE가 같다는 이유만으로 같은 모델이나 같은 자료라고 쓰지 않았는지 확인합니다."
   }
  ],
  "quiz": [
   {
    "q": "회귀 모델을 학습하고 평가하는 절차로 적절한 것은 무엇입니까?",
    "options": [
     "시험 정답까지 넣어 모델을 맞춥니다.",
     "학습에 사용한 자료만으로 모델의 최종 예측 성능을 평가합니다.",
     "모델을 학습하기 전에 학습 자료와 시험 자료를 나눕니다.",
     "예측 오차가 작게 나온 시험 자료만 골라 최종 평가 결과를 남깁니다."
    ],
    "answer": 2,
    "explain": "학습 자료와 시험 자료를 먼저 나누고 학습 자료로 모델을 학습시킵니다. 시험 자료는 학습에 사용하지 않고 모델의 예측을 평가하는 데 사용합니다."
   },
   {
    "q": "모의 잔반률 정답 7.5%와 예측 7.0%의 절대 오차는 얼마입니까?",
    "options": [
     "두 잔반률의 차이인 0.5%p",
     "두 값의 차이인 0.5%",
     "두 잔반률을 더하여 구한 14.5%",
     "정답 잔반률을 그대로 사용한 7.5%"
    ],
    "answer": 0,
    "explain": "두 잔반률의 차이는 0.5%p이며 0.5%로 읽지 않습니다."
   },
   {
    "q": "모의 메뉴 특성 회귀에서 튀김 계수 +4%p를 어떻게 해석해야 합니까?",
    "options": [
     "튀김을 제공하면 실제 잔반률이 4%p 증가한다고 확인한 측정 결과입니다.",
     "다른 입력이 같을 때 튀김 여부에 따라 달라지는 모의 예측값의 차이입니다.",
     "급식 API가 튀김 메뉴를 먹은 뒤 발생한 실제 잔반량을 측정하여 알려 준 결과입니다.",
     "조사 대상과 조사 기간이 달라져도 튀김의 영향이 같다고 판단할 수 있는 학교 운영 근거입니다."
    ],
    "answer": 1,
    "explain": "다른 입력이 같을 때 튀김 여부가 0에서 1로 바뀔 때 나타나는 모의 예측값의 차이입니다. 실제 인과관계나 학교의 잔반 실측 결과를 뜻하지 않습니다."
   }
  ],
  "check": [
   "입력 특성과 목표값의 출처를 구분할 수 있다.",
   "메뉴 이름으로 특성을 정할 때 미확인으로 남겨야 하는 경우를 설명할 수 있다.",
   "학습 자료와 시험 자료를 나누어 회귀 실습을 할 수 있다.",
   "같은 시험 자료에서 모델과 기준 모델의 MAE를 비교할 수 있다.",
   "모의 예제의 계수를 조건과 단위에 맞게 해석할 수 있다."
  ],
  "terms": [
   {
    "term": "입력 특성",
    "def": "모델이 예측에 사용하는 대상의 속성"
   },
   {
    "term": "목표값",
    "def": "모델이 예측하려는 값"
   },
   {
    "term": "회귀",
    "def": "입력 특성과 수치형 목표값의 관계를 학습해 수치를 예측하는 방법"
   },
   {
    "term": "원핫 인코딩",
    "def": "범주별 열을 만들고 해당 여부를 1과 0으로 나타내는 방식"
   },
   {
    "term": "MAE",
    "def": "예측값과 정답 사이 절대 오차의 평균"
   },
   {
    "term": "기준 모델",
    "def": "다른 모델의 성능을 비교할 때 기준으로 삼는 모델"
   },
   {
    "term": "절편",
    "def": "회귀 모델에서 모든 입력 특성이 0일 때의 예측값"
   },
   {
    "term": "계수",
    "def": "회귀 모델에서 다른 입력이 같을 때 특정 입력의 변화에 따른 예측값의 변화를 나타내는 값"
   }
  ],
  "teacher": [
   {
    "issue": "실제 메뉴 이름을 사용했으므로 잔반 목표값도 실제라고 생각합니다.",
    "response": "입력의 출처와 목표값의 출처를 따로 적게 합니다. 실제 메뉴 분류 표와 모의 회귀 자료를 분리해 보관하게 합니다."
   },
   {
    "issue": "메뉴 이름만으로 조리법을 확정합니다.",
    "response": "이름 규칙에 따른 분류인지 실제 조리법 확인인지 구분하게 합니다. 판단 근거가 부족한 메뉴는 미확인으로 두고 필요한 자료를 쓰게 합니다."
   },
   {
    "issue": "양수인 오차와 음수인 오차를 그대로 더해 서로 상쇄됩니다.",
    "response": "정답과 예측 사이 차이의 크기를 각각 적게 합니다. 그 크기를 평균 내는 것이 MAE임을 계산표에서 확인합니다."
   },
   {
    "issue": "양의 계수를 실제 잔반 증가의 원인으로 설명합니다.",
    "response": "설명에 모의 예제, 다른 입력이 같을 때, %p를 넣게 합니다. 실제 식단의 효과를 확인하려면 별도의 측정과 현장 검토가 필요하다는 문장을 덧붙이게 합니다."
   }
  ]
 },
 {
  "no": 9,
  "why": "학습 자료에서 오차가 작아도 새로운 자료에서 같은 성능이 나온다고 보장할 수는 없습니다. 조건을 하나씩 바꾸어 학습 오차와 시험 오차를 비교하고, 자료를 늘려도 남는 한계를 확인합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "학습 오차와 시험 오차가 서로 다르게 바뀔 가능성을 예상합니다."
   },
   {
    "part": "활동",
    "min": 35,
    "what": "실험 설계, 조건별 실행, 정규화 확인, 증강과 편향 검토를 진행합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "과적합, 증강, 정규화 기준을 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "조건별 비교 결과와 다음 검증에 필요한 실제 자료를 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "학습 오차가 줄었다면 새로운 자료의 예측도 좋아졌다고 볼 수 있습니까?",
    "같은 행을 복사해 자료를 늘리는 것과 새로운 관찰을 추가하는 것은 어떻게 다릅니까?",
    "조건을 여러 개 바꾸면 결과가 달라진 이유를 설명하기 쉬워집니까?"
   ],
   "expect": "교사용: 학습한 자료를 잘 맞히는 것과 새 자료를 잘 예측하는 것은 다르다는 답을 예상합니다. 같은 시험 자료에서 조건을 하나씩 바꾸고 학습 오차와 시험 오차를 함께 기록하도록 안내합니다."
  },
  "activities": [
   {
    "title": "비교 실험 설계",
    "min": 8,
    "steps": [
     {
      "st": "① 기본 조건 기록",
      "text": "사용 특성, 학습 자료 수, 자료 버전과 분할 기준을 적습니다. 비교할 시험 자료와 평가 지표는 같게 유지합니다."
     },
     {
      "st": "② 비교 조건 선정",
      "text": "기본 조건을 학습 8행, 튀김 특성 제외, 메뉴 이름 원핫 추가, 같은 행 복사 2배 조건과 각각 비교합니다. 각 실험은 기본 조건으로 되돌린 뒤 해당 조건만 바꾸도록 계획합니다."
     },
     {
      "st": "③ 실행 전 예측",
      "text": "각 조건에서 학습 오차와 시험 오차가 각각 줄어들지, 늘어날지, 비슷할지 예상합니다. 결과를 미리 확정하지 않고 예상의 이유를 적습니다."
     },
     {
      "st": "④ 기록표 서로 점검",
      "text": "짝은 실험마다 달라지는 조건과 유지하는 조건을 구분해 읽습니다. 학습 MAE와 시험 MAE를 나란히 적을 수 있도록 빈 기록표를 준비합니다."
     }
    ],
    "worksheet": [
     {
      "label": "기본 조건과 고정 조건",
      "placeholder": "기본 조건은 ______입니다. 비교 중 유지할 시험 자료, 지표, 자료 버전은 ______입니다."
     },
     {
      "label": "조건별 예상",
      "placeholder": "______만 바꾸면 학습 MAE는 ______, 시험 MAE는 ______할 것으로 예상합니다. 이유는 ______입니다."
     },
     {
      "label": "실험 기록표",
      "placeholder": "조건: ______ / 바꾼 내용: ______ / 학습 MAE: 실행 후 기록 / 시험 MAE: 실행 후 기록 / 단위: ______"
     }
    ],
    "callout": {
     "kind": "check",
     "title": "필수 실험 조건",
     "text": "같은 시험 4행을 유지하고 한 번에 한 조건만 바꿉니다. 앞 실험의 변경을 남긴 채 다음 조건을 추가하지 않습니다."
    }
   },
   {
    "title": "조건별 실행과 과적합 확인",
    "min": 14,
    "steps": [
     {
      "st": "① 기본 모델 실행",
      "text": "이 앱으로 기본 모델을 실행하고 학습 MAE와 시험 MAE를 기록합니다. 예상 칸을 지우지 않고 실제 실행값을 옆에 적습니다."
     },
     {
      "st": "② 자료 수와 특성 변경",
      "text": "학습 자료 수만 바꾼 실험과 튀김 특성을 제외한 실험을 각각 실행합니다. 각 실행 전에 기본 조건으로 돌아갔는지 확인하고 두 오차를 기록합니다."
     },
     {
      "st": "③ 메뉴 이름 원핫 조건 실행",
      "text": "앱에서 메뉴 이름 원핫 조건을 적용해 학습 MAE와 시험 MAE를 기록합니다. 학습 오차가 줄어든 만큼 시험 오차도 줄었는지 살펴봅니다."
     },
     {
      "st": "④ 같은 행 복사 조건 실행",
      "text": "같은 학습행을 복사한 조건을 실행하고 오차와 계수를 기본 조건과 비교합니다. 행 수가 늘어난 것이 새로 관찰한 정보가 늘어난 것과 같은 뜻인지 설명합니다."
     },
     {
      "st": "⑤ 예측과 실행 결과 비교",
      "text": "학습 오차가 줄었는데 시험 오차가 늘었다면 과적합 가능성을 검토합니다. 자료 분포의 변화도 살펴보고, 두 오차의 차이만으로 원인을 단정하지 않습니다."
     },
     {
      "st": "⑥ 교재 확인값 대조",
      "text": "조건별 실행을 마친 뒤 확인 칸을 펼쳐 비교합니다. 값이 다르면 결과를 고쳐 쓰기 전에 자료 버전, 분할, 사용 특성, 기본 조건 복원 여부를 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "실행 결과 비교",
      "placeholder": "조건 ______의 학습 MAE는 ______%p, 시험 MAE는 ______%p입니다. 기본 조건과 비교하면 ______입니다."
     },
     {
      "label": "과적합과 암기 해석",
      "placeholder": "조건 ______에서는 학습 오차가 ______했지만 시험 오차는 ______했습니다. 이 결과는 ______ 가능성을 보여 줍니다."
     },
     {
      "label": "예상과 다른 결과",
      "placeholder": "______ 조건의 결과가 예상과 달랐습니다. 확인한 설정은 ______이고 수정한 설명은 ______입니다."
     }
    ],
    "reveal": {
     "title": "조건별 예측과 실행 후 펼치는 확인값",
     "text": "같은 시험 4행을 사용한 앱의 모의 실험값이며 단위는 %p입니다. 기본 조건은 학습 MAE 0.75, 시험 MAE 0.5입니다. 학습 8행 조건은 학습 0.13, 시험 0.81로 학습 오차는 줄고 시험 오차는 늘어 과적합 가능성을 보여 줍니다. 튀김 제외 조건은 학습 2.0, 시험 2.0입니다. 메뉴 이름 원핫 추가 조건은 학습 0, 시험 0.5로 학습 자료의 예측 오차는 없어졌지만 시험 오차는 줄지 않았습니다. 같은 행 복사 2배 조건은 학습 0.75, 시험 0.5이고 계수도 그대로입니다."
    },
    "callout": {
     "kind": "check",
     "title": "전체 실험 기록",
     "text": "좋은 결과만 골라 남기지 않고 조건별 학습 오차와 시험 오차를 함께 기록합니다. 시험 자료를 보며 모델을 반복 조정했다면 그 한계도 적습니다."
    },
    "app": "s11"
   },
   {
    "title": "정규화 기준과 새로운 값",
    "min": 5,
    "steps": [
     {
      "st": "① 변환 기준 확인",
      "text": "최소 최대 변환을 사용한다면 최솟값과 최댓값을 학습 자료에서 정합니다. 시험 자료에도 같은 기준을 적용하며 원래 단위와 변환 기준을 기록합니다."
     },
     {
      "st": "② 변환값 예상",
      "text": "학습값 [1, 2, 3]의 최솟값 1과 최댓값 3을 기준으로 학습값 2와 새로운 값 4가 각각 어떻게 바뀔지 예상합니다. 새로운 값이 학습 범위 밖에 있다는 점을 계산 전에 표시합니다."
     },
     {
      "st": "③ 계산과 대조",
      "text": "각 값에서 학습 최솟값을 뺀 뒤 학습 최댓값과 최솟값의 차이로 나누어 확인합니다. 계산 결과를 기록한 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "④ 기준 변경의 문제 설명",
      "text": "시험값을 포함해 최솟값과 최댓값을 다시 정하지 않습니다. 학습과 시험에 다른 기준을 적용하면 어떤 문제가 생길지 짝에게 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "변환 예상과 계산",
      "placeholder": "학습 기준은 최솟값 ______, 최댓값 ______입니다. 값 ______의 예상 변환값은 ______이고 계산 결과는 ______입니다."
     },
     {
      "label": "변환 기준의 한계",
      "placeholder": "시험값을 보고 기준을 다시 정하지 않는 이유는 ______입니다. 정규화만으로 해결되지 않는 문제는 ______입니다."
     }
    ],
    "reveal": {
     "title": "예측과 계산 후 펼치는 변환값",
     "text": "학습값 [1, 2, 3]의 최솟값 1과 최댓값 3을 기준으로 최소 최대 변환을 하면 2는 0.5, 새로운 값 4는 1.5가 됩니다."
    },
    "callout": {
     "kind": "tip",
     "title": "정규화의 한계",
     "text": "정규화는 모든 회귀에 필요한 절차는 아니며 표본 편향이나 측정 오류를 해결하지도 않습니다. 최댓값과 최솟값이 같아 분모가 0인 경우는 별도 처리가 필요합니다."
    }
   },
   {
    "title": "증강과 편향의 한계 정리",
    "min": 8,
    "steps": [
     {
      "st": "① 자료 증가 방식 구분",
      "text": "같은 행을 복사한 경우, 비슷한 가상 자료를 만든 경우, 새로운 실제 관찰을 추가한 경우를 구분합니다. 앞의 복사 실험에서 확인한 계수와 두 오차의 변화 여부를 근거로 설명합니다."
     },
     {
      "st": "② 빠진 대상 확인",
      "text": "원자료에 빠진 메뉴와 대상이 무엇인지 확인합니다. 가상 자료의 생성 규칙을 적고, 증강으로 원자료의 치우침이 해결되었는지 검토합니다."
     },
     {
      "st": "③ 한계의 종류 구분",
      "text": "학습 자료에 지나치게 맞춘 문제, 특정 대상이 빠진 문제, 측정값이 부정확한 문제를 구분합니다. 각각을 확인하려면 어떤 기록이 필요한지 적습니다."
     },
     {
      "st": "④ 다음 검증 제안",
      "text": "조건별 비교 표와 한계를 정리하고 새로 필요한 실제 관찰을 제안합니다. 같은 시험 자료로 반복 조정했다면 별도의 새로운 자료에서 최종 평가가 필요하다는 점도 적습니다."
     },
     {
      "st": "⑤ 짝 검토",
      "text": "짝은 제안한 자료가 현재의 한계를 확인하는 데 필요한지 질문합니다. 가상 자료의 증가를 실제 응답자 증가로 표현한 문장은 고칩니다."
     }
    ],
    "worksheet": [
     {
      "label": "자료 증가 방식 비교",
      "placeholder": "같은 행 복사는 ______이고 새로운 실제 관찰은 ______입니다. 둘의 차이는 ______입니다."
     },
     {
      "label": "남은 한계",
      "placeholder": "현재 자료에는 ______이 빠져 있거나 불확실합니다. 증강 후에도 ______을 확인해야 합니다."
     },
     {
      "label": "다음 검증 계획",
      "placeholder": "다음에는 ______ 자료를 확보해 ______ 조건에서 ______을 확인하겠습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "증강 자료의 범위",
     "text": "증강한 자료를 독립적인 실제 학생 응답으로 세지 않습니다. 증강 전후의 성능은 같은 시험 자료로 비교합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "시험 자료를 반복 사용한 한계",
    "text": "이번 비교에서 같은 시험 자료를 여러 번 확인한 사실을 검증 기록에 덧붙입니다. 모델 선택이 끝난 뒤 새로운 자료로 무엇을 확인할지 제안합니다."
   },
   {
    "title": "자료 증가 제안 검토",
    "text": "현재 빠진 대상이나 메뉴를 정하고 실제 관찰을 추가하는 계획을 씁니다. 같은 행 복사만으로 그 정보를 얻을 수 있는지 설명합니다."
   }
  ],
  "quiz": [
   {
    "q": "조건을 바꾼 뒤 학습 MAE는 줄고 시험 MAE는 늘었습니다. 먼저 검토할 내용은 무엇입니까?",
    "options": [
     "시험 오차를 기록에서 제외할 필요성",
     "시험 자료의 구성을 바꾸어 시험 MAE를 낮출 수 있는 방법",
     "학습 MAE가 줄어든 결과를 근거로 전체 성능이 좋아졌다는 결론",
     "학습 자료에 지나치게 맞추어진 과적합 가능성"
    ],
    "answer": 3,
    "explain": "학습 오차가 줄어도 시험 오차가 늘면 과적합 가능성을 살펴봅니다. 자료 분포의 변화 등 다른 조건도 함께 검토합니다."
   },
   {
    "q": "원자료를 바탕으로 비슷한 가상 자료를 더 만들었습니다. 적절한 설명은 무엇입니까?",
    "options": [
     "실제 응답자가 늘어났습니다.",
     "원자료에 있던 편향이 가상 자료에도 남을 수 있습니다.",
     "원자료에서 빠진 메뉴에 대한 실제 응답자의 반응까지 확인했습니다.",
     "추가한 가상 자료를 시험 자료로 사용하면 실제 학교에서의 성능이 입증됩니다."
    ],
    "answer": 1,
    "explain": "원자료가 치우쳤다면 증강한 자료에도 그 치우침이 남을 수 있습니다. 가상 자료가 늘어난 것을 새로운 실제 관찰이 추가된 것으로 보지 않습니다."
   },
   {
    "q": "최소 최대 변환을 시험 자료에 적용할 때 적절한 기준은 무엇입니까?",
    "options": [
     "학습과 시험을 합쳐 구한 최솟값과 최댓값",
     "시험 자료에서 따로 구한 값",
     "학습 자료에서 정한 최솟값과 최댓값",
     "새로운 값이 들어올 때마다 전체 자료에서 다시 구한 변환 기준"
    ],
    "answer": 2,
    "explain": "변환 기준은 학습 자료에서 정하고 시험 자료에도 그대로 적용합니다. 새 값의 변환 결과는 학습 자료의 변환 범위를 벗어날 수 있습니다."
   }
  ],
  "check": [
   "시험 자료를 고정하고 한 번에 한 조건만 바꾸어 실험할 수 있다.",
   "학습 MAE와 시험 MAE를 함께 기록하고 과적합 가능성을 설명할 수 있다.",
   "정규화 기준을 학습 자료에서 정해야 하는 이유를 설명할 수 있다.",
   "자료 증강과 새로운 실제 관찰의 차이를 설명할 수 있다."
  ],
  "terms": [
   {
    "term": "과적합",
    "def": "학습 자료의 우연한 특징까지 학습해 새로운 자료의 예측 성능이 낮아지는 현상"
   },
   {
    "term": "정규화",
    "def": "정해진 기준으로 입력값의 범위나 크기를 바꾸는 처리"
   },
   {
    "term": "최소 최대 변환",
    "def": "학습 자료의 최솟값과 최댓값을 기준으로 값의 범위를 바꾸는 정규화 방식"
   },
   {
    "term": "자료 증강",
    "def": "원자료를 변형하거나 이를 바탕으로 가상 자료를 만들어 학습 자료를 늘리는 방법"
   },
   {
    "term": "표본 편향",
    "def": "수집한 자료가 특정 대상이나 조건에 치우치는 문제"
   },
   {
    "term": "측정 오류",
    "def": "측정하거나 기록한 값이 측정하려는 실제 값과 다른 문제"
   }
  ],
  "teacher": [
   {
    "issue": "여러 조건을 연속해서 바꾸고 한 조건의 효과로 해석합니다.",
    "response": "실험마다 기본 조건으로 되돌린 기록을 확인합니다. 바꾼 조건과 유지한 조건을 말하게 한 뒤 다시 실행하게 합니다."
   },
   {
    "issue": "교재의 확인값을 실행 전에 기록합니다.",
    "response": "확인 칸을 접은 상태에서 예측, 실행값, 해석을 먼저 작성하게 합니다. 값이 다르면 교재 수치로 덮어쓰지 않고 자료 버전과 설정을 대조하게 합니다. 학습 8행의 시험 MAE는 이 앱에서 0.81이고 교재 원본의 Python 예제 표에는 1.0%p입니다. 따라서 사용한 도구를 함께 기록하게 합니다."
   },
   {
    "issue": "학습 오차 감소를 모델 개선으로 단정합니다.",
    "response": "같은 조건의 시험 오차를 함께 읽게 합니다. 학습 오차가 줄고 시험 오차가 늘어난 경우와 시험 오차가 그대로인 경우를 구분해 설명하게 합니다."
   },
   {
    "issue": "복사한 행 수를 새로운 실제 응답 수로 셉니다.",
    "response": "행 수와 독립적으로 관찰한 정보의 수를 구분하게 합니다. 빠진 메뉴나 대상의 실제 반응이 추가되었는지 질문합니다."
   }
  ]
 },
 {
  "no": 10,
  "why": "식단 개선안을 쓰려면 확인한 사실과 제안을 구분하고 근거의 한계를 밝혀야 합니다. 학생과 급식 관계자의 입장을 고려해 실행 전에 필요한 협의와 검증 방법을 정합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "모둠을 확인하고 앞 차시의 결과 중 실제 자료와 가상 또는 모의 자료를 구분합니다."
   },
   {
    "part": "활동",
    "min": 35,
    "what": "근거 정리, 제안서 작성, 모둠 간 발표와 평가, 수정과 성찰을 진행합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "예비 제안, 동료 평가, 실제 자료의 해석 범위를 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "수정한 제안과 실행 전 필요한 자료 및 협의를 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "앞 차시에서 확인한 값 중 학교의 실제 자료는 무엇이며 가상 또는 모의 결과는 무엇입니까?",
    "실제 자료가 있다는 사실만으로 제안의 효과까지 확인했다고 말할 수 있습니까?",
    "학생이 원하는 변화와 급식 관계자가 확인해야 할 조건은 어떻게 다를 수 있습니까?"
   ],
   "expect": "교사용: 공개 식단은 실제 자료지만 가상 별점과 모의 회귀는 실제 학교 결과가 아니라는 답을 예상합니다. 근거의 성격을 표시하고 실제 효과가 확인되지 않았다면 예비 제안으로 작성하고 추가 확인 계획을 포함하게 합니다."
  },
  "activities": [
   {
    "title": "문제와 근거 정리",
    "min": 8,
    "steps": [
     {
      "st": "① 문제 범위 설정",
      "text": "누구의 어떤 급식 문제를 다룰지 정합니다. 앞 차시의 자료와 모델 기록에서 이 문제를 설명할 근거를 찾습니다."
     },
     {
      "st": "② 근거의 성격 분류",
      "text": "가상 월드컵 응답, 실제 공개 식단, 가상 별점, 모의 회귀 결과를 각각 분류합니다. 어떤 값이 선호를 나타내고 어떤 값이 메뉴의 등장이나 모의 예측을 나타내는지 구분합니다."
     },
     {
      "st": "③ 원기록 대조",
      "text": "자료의 출처, 대상, 기간, 건수와 실제 또는 가상 여부를 정리합니다. 값을 기억으로 적지 않고 앞 차시의 집계와 실행 기록에서 확인한 뒤 확인 칸을 펼칩니다."
     },
     {
      "st": "④ 사실과 해석 구분",
      "text": "직접 관찰한 사실과 그 사실에 대한 해석을 구분합니다. 실제 측정 자료가 없으면 예비 제안으로 표시하며 모의 결과만 있다면 실제 식단 변경의 효과를 확인했다고 쓰지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "문제와 대상",
      "placeholder": "우리 모둠이 다룰 문제는 ______이며 대상과 범위는 ______입니다."
     },
     {
      "label": "근거 목록",
      "placeholder": "자료와 출처: ______ / 대상과 기간: ______ / 건수와 단위: ______ / 실제, 가상, 모의 구분: ______"
     },
     {
      "label": "해석의 한계",
      "placeholder": "이 자료에서 확인한 것은 ______입니다. 아직 확인하지 못한 것은 ______이며 제안의 상태는 ______입니다."
     }
    ],
    "reveal": {
     "title": "분류와 원기록 확인 후 펼치는 근거",
     "text": "가상 월드컵 응답 6건에서 사과 우승은 3건입니다. 실제 공개 식단의 저장 자료에서는 당곡고 중식 12일 중 배추김치가 7일 등장했습니다. 가상 별점 자료에서 메뉴 C의 평균은 약 2.3점이고 응답은 3건입니다. 모의 메뉴 특성 회귀에서 튀김 계수는 다른 입력이 같을 때 +4%p입니다. 앞의 값들은 자료의 성격이 서로 다르며 식단 변경의 실제 효과를 확인한 결과가 아닙니다."
    },
    "callout": {
     "kind": "check",
     "title": "근거가 부족한 경우",
     "text": "근거가 약한 부분은 추가 확인 계획으로 적습니다. 현재 자료만으로 판단하기 어렵다는 결론도 가능합니다."
    }
   },
   {
    "title": "이해관계자 검토와 제안서 작성",
    "min": 10,
    "steps": [
     {
      "st": "① 입장별 조건 검토",
      "text": "학생의 선택 다양성과 참여 부담, 영양교사가 고려해야 할 영양 균형과 운영 조건을 살펴봅니다. 조리 종사자의 안전과 업무 부담, 학교의 실행 가능성과 자료 활용 범위도 확인합니다."
     },
     {
      "st": "② 확인할 질문 작성",
      "text": "맛 외에도 비용, 영양, 조리 과정에서 확인할 조건을 적습니다. 실제로 듣지 않은 관계자 의견은 대신 작성하지 않고 협의할 질문으로 남깁니다."
     },
     {
      "st": "③ 제안서 초안 작성",
      "text": "모둠원은 확인한 사실, 조심스러운 해석, 작은 제안, 먼저 확인할 것을 한 칸씩 맡아 이 앱에 작성합니다. 근거에 없는 효과나 실제로 듣지 않은 관계자 의견을 추가하지 않습니다."
     },
     {
      "st": "④ 실행 전 조건 정리",
      "text": "시도할 변화의 범위를 정하고 필요한 측정과 관계자 협의를 적습니다. 효과뿐 아니라 부작용을 어떻게 확인할지도 제안서에 포함합니다."
     },
     {
      "st": "⑤ 필수 조건 점검",
      "text": "근거의 출처와 성격, 해석의 한계, 관계자 협의, 효과와 부작용의 확인 계획이 있는지 점검합니다. 모의 근거만 있으면 예비 제안으로 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "사실과 조심스러운 해석",
      "placeholder": "확인한 사실: ______ 자료의 ______ 기간, ______건에서 ______을 확인했습니다. 해석: ______ 조건에서는 ______ 가능성을 생각할 수 있습니다."
     },
     {
      "label": "작은 제안과 먼저 확인할 것",
      "placeholder": "______ 범위에서 ______ 변화를 검토하고 싶습니다. 먼저 필요한 측정과 관계자 협의는 ______입니다."
     },
     {
      "label": "이해관계자와 검증 계획",
      "placeholder": "______ 입장에서 확인할 조건은 ______입니다. 효과는 ______으로 확인하고 부작용은 ______으로 살피겠습니다."
     }
    ],
    "callout": {
     "kind": "warn",
     "title": "제안과 시행의 구분",
     "text": "학생의 수업 제안은 학교의 승인이나 실제 시행을 뜻하지 않습니다. 특정 메뉴나 담당자를 비난하는 표현은 고칩니다."
    },
    "app": "s12"
   },
   {
    "title": "발표와 동료 평가",
    "min": 12,
    "steps": [
     {
      "st": "① 모둠 간 발표 준비",
      "text": "두 모둠씩 서로 발표를 듣도록 짝을 정하고, 여러 짝이 동시에 발표를 진행합니다. 발표할 모둠과 평가할 모둠은 제안서의 근거와 평가 기준을 확인합니다."
     },
     {
      "st": "② 첫 모둠 발표",
      "text": "첫 모둠은 3분 동안 확인한 사실과 출처, 제안하는 작은 변화, 자료와 모델의 한계를 발표합니다. 학교에서 시도하기 전에 확인할 조건도 설명합니다."
     },
     {
      "st": "③ 질문과 평가",
      "text": "듣는 모둠은 2분 동안 근거가 분명한 점과 더 확인할 점을 말합니다. 문제 정의, 자료 근거, 해석 범위, 실행 계획을 기준으로 질문합니다."
     },
     {
      "st": "④ 역할 교대",
      "text": "역할을 바꾸어 다른 모둠도 3분 발표와 2분 질문 및 평가를 진행합니다. 가상 예시를 제외한 개인별 별점과 유사도 결과는 발표 자료에 넣지 않습니다."
     },
     {
      "st": "⑤ 수정 의견 기록",
      "text": "사람 대신 주장과 자료를 검토합니다. 발표 모둠은 받은 질문을 근거 보완, 표현 수정, 추가 확인 계획으로 구분해 기록합니다."
     }
    ],
    "worksheet": [
     {
      "label": "발표 구성",
      "placeholder": "확인한 사실과 출처는 ______입니다. 제안은 ______이며 한계와 실행 전 조건은 ______입니다."
     },
     {
      "label": "동료 평가",
      "placeholder": "근거가 분명한 부분은 ______입니다. 더 확인할 점은 ______이며 질문한 이유는 ______입니다."
     },
     {
      "label": "받은 의견",
      "placeholder": "받은 질문은 ______입니다. 근거 보완, 표현 수정, 추가 확인 중 ______에 반영하겠습니다."
     }
    ],
    "callout": {
     "kind": "tip",
     "title": "수정에 도움이 되는 피드백",
     "text": "‘이 근거는 좋았고, 이 조건을 더 확인하면 좋겠습니다’처럼 구체적으로 말합니다. 실제로 확인하지 않은 관계자의 의견이나 효과를 덧붙이도록 요구하지 않습니다."
    }
   },
   {
    "title": "제안서 수정과 성찰",
    "min": 5,
    "steps": [
     {
      "st": "① 주장과 근거 재대조",
      "text": "피드백을 반영해 근거의 범위를 벗어난 주장은 고치고 빠진 확인 조건은 보완합니다. 가상 자료를 실제 학교 결과로 표현하거나 실제 메뉴 등장 횟수를 선호로 바꾼 부분이 있는지 확인합니다."
     },
     {
      "st": "② 수정 이유 기록",
      "text": "수정 전후 문장을 나란히 적고 어느 근거 또는 질문 때문에 고쳤는지 설명합니다. 반영을 보류한 의견은 그 이유와 추가로 확인할 내용을 적습니다."
     },
     {
      "st": "③ 산출물과 다음 계획 정리",
      "text": "제안서, 발표자료, 성찰지를 정리하고 실제 실행 전에 필요한 추가 자료와 협의를 적습니다. 원본과 수정본을 구분해 보관합니다."
     }
    ],
    "worksheet": [
     {
      "label": "수정 전후 비교",
      "placeholder": "수정 전에는 ______이라고 썼습니다. ______을 근거로 ______으로 고쳤습니다."
     },
     {
      "label": "성찰과 다음 확인",
      "placeholder": "이번에 판단을 바꾼 이유는 ______입니다. 실제로 시도하기 전에 ______을 확인하고 ______과 협의해야 합니다."
     }
    ],
    "callout": {
     "kind": "check",
     "title": "제출 전 확인",
     "text": "제안서에 자료 출처와 실제, 가상, 모의 구분이 보이는지 확인합니다. 예비 제안 표시, 해석의 한계, 실행 전 협의와 검증 계획도 점검합니다."
    }
   }
  ],
  "challenge": [
   {
    "title": "근거와 주장의 연결 검토",
    "text": "제안서의 주장을 골라 어떤 자료가 뒷받침하는지 연결해 적습니다. 연결할 근거가 없으면 주장의 범위를 줄이거나 추가 확인 질문으로 바꿉니다."
   },
   {
    "title": "실행 전 협의 질문 보완",
    "text": "학생, 영양교사, 조리 종사자, 학교 중 의견을 더 확인해야 할 대상을 골라 질문을 작성합니다. 예상 답변을 실제 의견으로 기록하지 않습니다."
   }
  ],
  "quiz": [
   {
    "q": "모의 잔반 결과만으로 식단 개선안을 작성할 때 적절한 방법은 무엇입니까?",
    "options": [
     "모의 결과에 근거한 예비 제안으로 표시합니다.",
     "학교 전체의 효과로 씁니다.",
     "실제 잔반량을 측정하여 얻은 결과라는 제목으로 발표합니다.",
     "발표를 간단히 하려고 모의 자료를 사용했다는 설명을 생략합니다."
    ],
    "answer": 0,
    "explain": "모의 결과만 있다면 예비 제안으로 표시하고 실제 효과를 주장하지 않습니다. 실행 전에 필요한 측정과 협의도 적습니다."
   },
   {
    "q": "친구의 식단 개선안에 줄 피드백으로 적절한 것은 무엇입니까?",
    "options": [
     "발표자의 성격으로 평가합니다.",
     "들은 적 없는 관계자의 의견을 제안의 근거에 덧붙이도록 합니다.",
     "모의 결과에 어떤 한계가 있는지 설명하는 부분은 발표에서 빼도록 합니다.",
     "제안을 실행하기 전에 확인해야 할 조건을 질문합니다."
    ],
    "answer": 3,
    "explain": "동료 평가는 주장과 자료, 실행 가능성을 중심으로 합니다. 관계자 협의와 측정 등 실행 전에 필요한 조건을 확인합니다."
   },
   {
    "q": "실제 공개 식단의 저장 자료에서 배추김치가 12일 중 7일 등장했습니다. 이 근거로 확인할 수 있는 것은 무엇입니까?",
    "options": [
     "학생들이 배추김치를 더 좋아했다는 점",
     "저장된 식단 12일 중 배추김치가 나온 일수가 7일이라는 점",
     "배추김치를 제공한 날에는 실제로 발생한 잔반량이 다른 날보다 줄었다는 점",
     "배추김치를 제공하는 횟수를 늘리면 학교의 식단 개선 효과가 나타난다는 점"
    ],
    "answer": 1,
    "explain": "공개 식단의 저장 자료에서 확인한 것은 저장된 12일 중 메뉴가 나온 일수입니다. 선호도나 잔반 변화, 식단 변경의 효과를 확인하려면 별도의 자료가 필요합니다."
   }
  ],
  "check": [
   "사실과 해석, 제안, 먼저 확인할 것을 구분해 제안서를 쓸 수 있다.",
   "자료 출처와 실제 또는 가상 여부, 해석의 한계를 설명할 수 있다.",
   "학생과 급식 관계자의 입장에서 실행 조건을 검토할 수 있다.",
   "근거와 한계를 포함해 제안서를 발표할 수 있다.",
   "동료의 피드백을 반영해 근거와 실행 계획을 보완할 수 있다."
  ],
  "terms": [
   {
    "term": "근거",
    "def": "주장이나 해석을 뒷받침하는 확인 가능한 자료"
   },
   {
    "term": "이해관계자",
    "def": "제안의 실행이나 결과에 영향을 주거나 영향을 받는 사람과 집단"
   },
   {
    "term": "예비 제안",
    "def": "실제 측정이나 추가 확인이 필요한 상태에서 검토용으로 작성한 제안"
   },
   {
    "term": "검증 계획",
    "def": "제안의 효과와 부작용을 어떤 자료와 방법으로 확인할지 정한 계획"
   },
   {
    "term": "동료 평가",
    "def": "학생들이 정해진 기준으로 서로의 결과물을 검토하고 의견을 주는 활동"
   }
  ],
  "teacher": [
   {
    "issue": "가상 응답과 실제 메뉴 자료를 합쳐 실제 선호 결과처럼 씁니다.",
    "response": "근거마다 실제, 가상, 모의를 표시하고 무엇을 측정한 값인지 설명하게 합니다. 메뉴 등장 횟수, 별점, 모의 계수를 같은 의미로 사용한 문장을 고치게 합니다."
   },
   {
    "issue": "모의 자료뿐이라 제안서를 쓸 수 없다고 생각합니다.",
    "response": "예비 제안으로 표시하고 추가 측정과 협의를 중심으로 쓰게 합니다. 현재 자료만으로 효과를 판단하기 어렵다는 결론도 인정합니다."
   },
   {
    "issue": "발표 시간이 부족해 일부 모둠만 발표합니다.",
    "response": "두 모둠씩 짝을 지어 동시에 발표하게 합니다. 각 모둠의 3분 발표와 질문 및 평가 시간을 지켜 모든 모둠이 피드백을 받게 합니다."
   },
   {
    "issue": "동료 평가가 칭찬이나 사람 평가로 끝납니다.",
    "response": "문제 정의, 자료 근거, 해석 범위, 실행 계획 중 어느 기준에 따른 의견인지 말하게 합니다. 제안서에서 확인한 문장과 수정할 조건을 함께 적게 합니다."
   }
  ]
 }
]
;
const TLESSONS = [
 {
  "no": 1,
  "title": "바이브코딩 첫걸음",
  "sub": "자연어로 웹페이지를 요청하고 고치기",
  "group": 1,
  "goals": [
   "자연어로 간단한 웹페이지를 만들고 수정 요청을 구체화할 수 있다.",
   "생성된 결과를 직접 확인하며 오류, 수정, 검증 기록을 남길 수 있다."
  ],
  "flow": [
   [
    "연수의 출발",
    ""
   ],
   [
    "첫 HTML 요청",
    ""
   ],
   [
    "요청의 구성",
    ""
   ],
   [
    "한 조건 수정",
    ""
   ],
   [
    "수정과 확인",
    ""
   ],
   [
    "오류 보고 입력",
    ""
   ]
  ],
  "wrap": [
   "산출물: 간단한 웹페이지와 수정 전후 기록",
   "학생에게 보여 줄 첫 프롬프트 한 문장",
   "오류를 설명한 문장과 다시 시험한 결과"
  ],
  "teacherNotes": [
   "학교 AI 도구 이용, 학생 계정, 연령 조건 확인",
   "빈 HTML 편집, 브라우저 미리보기 환경 준비",
   "외부 공개, 설치, 키 입력은 이번 제작 중 실행하지 않음",
   "비식별 예시만 사용하고 학생 자료를 AI에 보내지 않음"
  ],
  "stages": [],
  "teacher": []
 },
 {
  "no": 2,
  "title": "이상형 월드컵 만들기 1",
  "sub": "후보 배열과 한 경기 화면",
  "group": 1,
  "goals": [
   "두 후보 중 하나를 고르는 화면을 직접 만들 수 있다.",
   "후보 목록과 화면 동작을 분리해 수정하기 쉬운 구조를 만들 수 있다."
  ],
  "flow": [
   [
    "화면 설계",
    ""
   ],
   [
    "후보 입력 자료",
    ""
   ],
   [
    "목록을 데이터로",
    ""
   ],
   [
    "배열 변경 시험",
    ""
   ],
   [
    "수업 시연 점검",
    ""
   ],
   [
    "잘못된 후보 시험",
    ""
   ]
  ],
  "wrap": [
   "산출물: 두 후보 선택 화면, 후보 배열",
   "학생이 수정할 한 지점 표시하기",
   "코드와 화면의 연결을 쉬운 말로 설명하기"
  ],
  "teacherNotes": [
   "정확한 후보 수, 중복 이름 시험",
   "학교 브라우저, 키보드, 화면 확대 시험",
   "실습에 없는 기능을 자동으로 추가하지 않기",
   "실제 배포 없이 로컬 검증부터 진행"
  ],
  "stages": [
   "s2"
  ],
  "teacher": [
   "학생 2차시"
  ]
 },
 {
  "no": 3,
  "title": "이상형 월드컵 만들기 2",
  "sub": "라운드 상태와 시험 시나리오",
  "group": 1,
  "goals": [
   "선택한 후보만 다음 라운드에 올리는 토너먼트 흐름을 구현할 수 있다.",
   "라운드, 결승, 재시작 동작을 시험해 오류를 수정할 수 있다."
  ],
  "flow": [
   [
    "라운드 구조",
    ""
   ],
   [
    "라운드 상태 예시",
    ""
   ],
   [
    "단계별 구현",
    ""
   ],
   [
    "연속 클릭 방지",
    ""
   ],
   [
    "시험 시나리오",
    ""
   ],
   [
    "예상 경로 대조",
    ""
   ]
  ],
  "wrap": [
   "산출물: 토너먼트 앱, 시험 기록",
   "현재 후보와 다음 후보의 차이 설명하기",
   "재시작 때 초기화해야 할 상태 적기"
  ],
  "teacherNotes": [
   "원계획은 라운드 연결과 우승 표시까지",
   "학생에게 상태 변수의 뜻을 화면으로 설명",
   "예상하지 않은 새 기능은 별도 버전으로 분리",
   "브라우저에서 실제 동작 검증 후 수업 제공"
  ],
  "stages": [
   "s3"
  ],
  "teacher": [
   "학생 2차시"
  ]
 },
 {
  "no": 4,
  "title": "결과를 기록으로 남기기",
  "sub": "선택 기록과 브라우저 저장",
  "group": 1,
  "goals": [
   "라운드별 선택과 우승 결과를 일관된 형식으로 기록할 수 있다.",
   "브라우저 저장의 범위와 개인 정보 보호 조건을 설명할 수 있다."
  ],
  "flow": [
   [
    "기록 항목",
    ""
   ],
   [
    "한 경기의 기록",
    ""
   ],
   [
    "브라우저 저장",
    ""
   ],
   [
    "브라우저 저장 요청",
    ""
   ],
   [
    "기록 검증",
    ""
   ],
   [
    "저장과 복원 시험",
    ""
   ]
  ],
  "wrap": [
   "산출물: 기록 기능, 결과 표, 저장 범위 안내",
   "수집하지 않을 정보 세 가지",
   "수업 종료 후 기록 처리 기준"
  ],
  "teacherNotes": [
   "공용 기기 브라우저 저장, 초기화 사전 점검",
   "자동 전송, 분석 도구 추적 기능 미사용",
   "실명, 학번, 건강정보 입력 칸 없음 확인",
   "학생 응답 활용 범위는 학교 운영 기준에 맞춤"
  ],
  "stages": [
   "s4"
  ],
  "teacher": [
   "학생 3차시"
  ]
 },
 {
  "no": 5,
  "title": "구글 시트 연동 1",
  "sub": "앱, 웹앱, 시트의 역할과 권한",
  "group": 1,
  "goals": [
   "앱, 웹앱, 시트의 역할과 요청 흐름을 설명할 수 있다.",
   "실행 주체와 접근 범위를 확인하며 연동 설계를 검토할 수 있다."
  ],
  "flow": [
   [
    "연동의 원리",
    ""
   ],
   [
    "시험용 시트 준비",
    ""
   ],
   [
    "Google Apps Script",
    ""
   ],
   [
    "서버 저장 코드",
    ""
   ],
   [
    "경고 화면의 의미",
    ""
   ],
   [
    "시험 주소와 실행 권한",
    ""
   ]
  ],
  "wrap": [
   "산출물: 데이터 흐름도, 권한 점검표",
   "앱과 시트 사이에서 검사할 항목",
   "배포 전 학교 관리자에게 확인할 조건"
  ],
  "teacherNotes": [
   "학교 정책에 맞는 시험용 시트와 테스트 계정",
   "공식 배포 안내, 권한 화면 최신 상태 확인",
   "기존 시트 공유 범위 변경 전 별도 승인",
   "사용자 모르게 지속 접근, 인증정보 저장 금지"
  ],
  "stages": [
   "s5"
  ],
  "teacher": [
   "학생 3차시"
  ]
 },
 {
  "no": 6,
  "title": "구글 시트 연동 2",
  "sub": "가상 응답 전송과 중복 검증",
  "group": 1,
  "goals": [
   "가상 응답을 전송하고 시트에 정확히 저장되는지 검증할 수 있다.",
   "여러 응답의 중복, 실패, 재시도를 구분해 문제를 진단할 수 있다."
  ],
  "flow": [
   [
    "한 건 연결",
    ""
   ],
   [
    "화면에서 서버 호출",
    ""
   ],
   [
    "짝 시험",
    ""
   ],
   [
    "한 건과 중복 대조",
    ""
   ],
   [
    "문제 진단",
    ""
   ],
   [
    "연결 실패 진단",
    ""
   ]
  ],
  "wrap": [
   "산출물: 연동 앱, 가상 시험 표, 오류 기록",
   "한 건 저장을 증명하는 확인 절차",
   "중복과 실패를 구분해 처리할 원칙"
  ],
  "teacherNotes": [
   "Apps Script 및 학교 계정 정책, 사용 제한 확인",
   "가상 응답만으로 동시 사용, 중복 테스트",
   "공용 시트 원자료 접근 최소화",
   "수집 동의, 보존 기간, 삭제 책임자 사전 협의"
  ],
  "stages": [
   "s5"
  ],
  "teacher": [
   "학생 3차시"
  ]
 },
 {
  "no": 7,
  "title": "모은 데이터 정리와 분석",
  "sub": "집계 기준, 분포, 유사도 개념",
  "group": 1,
  "goals": [
   "집계 기준을 정하고 순위, 분포를 시각화할 수 있다.",
   "학생에게 결과 해석과 프라이버시 한계를 지도할 수 있다."
  ],
  "flow": [
   [
    "정리의 기준",
    ""
   ],
   [
    "시각화 선택",
    ""
   ],
   [
    "가상 빈도 집계",
    ""
   ],
   [
    "수업 발문",
    ""
   ],
   [
    "유사도 개념 연결",
    ""
   ]
  ],
  "wrap": [
   "산출물: 정리 기준, 집계 그래프, 해석 발문",
   "학생에게 보여 줄 잘못된 해석 사례 한 가지",
   "개인별 결과를 보호할 공개 범위"
  ],
  "teacherNotes": [
   "예제와 실제 자료 파일명 분리",
   "집계값을 원본 건수와 대조",
   "차트 자동생성 후 축, 분모, 누락 항목 확인",
   "식단, 교사, 조리 종사자 낙인 표현 점검"
  ],
  "stages": [
   "s6"
  ],
  "teacher": [
   "학생 4차시"
  ]
 },
 {
  "no": 8,
  "title": "나이스 API로 급식 수집",
  "sub": "학교와 기간 조건으로 급식 수집",
  "group": 2,
  "goals": [
   "학교, 기간 조건을 정해 급식 데이터를 수집하는 절차를 설명할 수 있다.",
   "인증키와 원본 자료를 보호하고 수집 결과의 범위를 점검할 수 있다."
  ],
  "flow": [
   [
    "수집 설계",
    ""
   ],
   [
    "급식 요청 항목",
    ""
   ],
   [
    "실제 요청 조건",
    ""
   ],
   [
    "실제 응답 읽기",
    ""
   ],
   [
    "없음과 잘림 처리",
    ""
   ],
   [
    "실데이터 실습 시작",
    ""
   ],
   [
    "안정성 확인",
    ""
   ],
   [
    "인증키 관리",
    ""
   ],
   [
    "수집 결과 확인",
    ""
   ],
   [
    "JSON에서 표로",
    ""
   ]
  ],
  "wrap": [
   "산출물: 수집 조건, 원본 응답, 분석용 표",
   "인증키를 감춰야 할 위치 설명",
   "미확보 자료와 확인된 자료 구분"
  ],
  "teacherNotes": [
   "NEIS 공식 포털의 최신 문서, 한도 확인",
   "학교 계정, 네트워크 허용 조건 점검",
   "실제 데이터 제공 범위, 활용 조건 준수",
   "학생 5차시에 제공할 비식별 샘플 준비"
  ],
  "stages": [
   "s7"
  ],
  "teacher": [
   "학생 5차시"
  ]
 },
 {
  "no": 9,
  "title": "급식 전처리와 특성 만들기",
  "sub": "메뉴 원문 보존과 특성 정의",
  "group": 2,
  "goals": [
   "메뉴 원문을 보존하며 분석용 정리 열을 만들 수 있다.",
   "일관된 기준으로 메뉴 특성을 정의하고 분포, 누락을 점검할 수 있다."
  ],
  "flow": [
   [
    "원문 보존",
    ""
   ],
   [
    "원문과 정리본 대조",
    ""
   ],
   [
    "특성의 정의",
    ""
   ],
   [
    "특성을 숫자로 바꾸기",
    ""
   ],
   [
    "특성 표 점검",
    ""
   ]
  ],
  "wrap": [
   "산출물: 전처리 규칙, 특성 정의표, 분포 기록",
   "원문을 보존해야 하는 이유 설명",
   "학생이 헷갈릴 경계 메뉴와 지도 방법"
  ],
  "teacherNotes": [
   "식품 안전 안내용 원문과 분석용 변환본 분리",
   "메뉴명으로 알 수 없는 사실을 AI가 보충하지 않게 함",
   "모의 데이터의 생성 규칙도 별도로 기록",
   "학생 8차시의 입력 특성 표로 이어질 수 있게 준비"
  ],
  "stages": [
   "s10"
  ],
  "teacher": [
   "학생 8차시"
  ]
 },
 {
  "no": 10,
  "title": "반찬 회귀 모델 만들기",
  "sub": "모의 잔반 회귀와 수업 연결",
  "group": 2,
  "goals": [
   "메뉴 특성과 모의 잔반으로 회귀 모델을 만들고 시험 성능을 확인할 수 있다.",
   "계수와 오차를 해석하며 실제 학교 적용의 한계를 설명할 수 있다."
  ],
  "flow": [
   [
    "대표 차시 운영",
    ""
   ],
   [
    "실습 수행",
    ""
   ],
   [
    "회귀 실행과 대조",
    ""
   ],
   [
    "수업으로 연결",
    ""
   ]
  ],
  "wrap": [
   "산출물: 모델, 시험 성능, 계수, 한계 기록",
   "평가: 문제의 데이터화, 해석, 학교 적용, AI 활용",
   "연수 후 적용 전 확인할 자료와 협의 사항"
  ],
  "teacherNotes": [
   "현재 제작 범위는 사용자 지시에 따른 교원10차시",
   "원계획11~15차시는 이력, 참고 자료로 보존",
   "연수 후 모의수업, 별도 심화는 확정 과업으로 추가하지 않음",
   "학교의 실제 잔반 자료를 사용한 모델 검증은 후속 준비 필요"
  ],
  "stages": [
   "s10"
  ],
  "teacher": [
   "학생 8차시"
  ]
 }
];
const TCONTENT = [
 {
  "no": 1,
  "why": "AI에게 웹페이지를 요청한 뒤에는 직접 실행해 요구한 동작과 실제 동작을 비교해야 합니다. 교사가 먼저 작은 화면을 만들고 한 조건씩 수정하면서 학생에게 필요한 요청 방법과 확인 절차를 익힙니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "시작 버튼을 누르기 전과 후의 화면을 예상합니다."
   },
   {
    "part": "첫 요청과 실행",
    "min": 8,
    "what": "안내 화면을 요청하고 첫 결과를 실행합니다."
   },
   {
    "part": "성공 조건 확인",
    "min": 10,
    "what": "클릭과 키보드 조작을 시험합니다."
   },
   {
    "part": "한 조건 수정",
    "min": 9,
    "what": "버튼 색을 바꾸고 기존 동작을 다시 확인합니다."
   },
   {
    "part": "오류 기록과 재시험",
    "min": 8,
    "what": "재현 순서와 실제 결과를 바탕으로 수정 요청을 작성합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "두 문항에 답하고 판단 근거를 설명합니다."
   },
   {
    "part": "학생 수업 적용과 정리",
    "min": 5,
    "what": "학생에게 보여 줄 첫 요청과 확인 절차를 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "시작 버튼을 누르기 전과 후에 무엇이 달라져야 합니까?",
    "AI가 완성했다고 답하면 어떤 동작을 직접 확인해야 합니까?"
   ],
   "expect": "화면에 필요한 요소와 성공 조건을 구분해 말하도록 합니다. 코드 지식보다 직접 관찰할 수 있는 동작부터 설명하도록 안내합니다."
  },
  "activities": [
   {
    "title": "안내 화면 첫 요청",
    "min": 8,
    "steps": [
     {
      "st": "① 결과 예상하기",
      "text": "제목과 시작 버튼이 있는 화면을 간단히 그립니다. 버튼을 누르기 전에는 안내 문장이 보이지 않는다는 조건을 표시합니다."
     },
     {
      "st": "② AI에게 요청하기",
      "text": "학교에서 허용한 AI 도구에 요청합니다. 생성된 코드를 승인된 편집 환경에 저장하고 첫 버전을 보관합니다.",
      "prompt": "고등학생용 수업 안내 웹페이지를 만들어 줘.\n- HTML, CSS, JavaScript를 HTML 파일 하나에 넣어 줘.\n- 제목은 “우리 반 데이터 탐구”이고 “시작” 버튼이 하나 있어야 합니다.\n- 버튼을 누르기 전에는 안내 문장이 보이지 않고, 누르면 “두 후보 중 하나를 골라 봅시다.”가 한 번 나타나게 해 줘.\n- Tab과 Enter로도 버튼을 사용할 수 있고 작은 화면에서도 글자가 잘리지 않게 해 줘.\n- 외부 연결, 로그인, 분석 추적, 데이터 저장과 전송은 넣지 마세요.\n- 설명 뒤에 전체 코드와 확인할 시험 세 가지를 알려 줘."
     },
     {
      "st": "③ 첫 화면 실행하기",
      "text": "승인된 미리보기에서 실행합니다. 예상한 화면과 실제 화면을 비교하고 아직 확인하지 않은 동작도 구분해 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "예상 화면",
      "placeholder": "처음 보이는 요소와 클릭 후 나타날 문장을 적습니다."
     },
     {
      "label": "첫 실행 결과",
      "placeholder": "예상과 같은 점, 다른 점, 아직 확인하지 않은 점을 적습니다."
     }
    ],
    "reveal": {
     "title": "첫 요청의 확인 범위",
     "text": "연수 자료의 첫 요청은 제목, 시작 버튼, 클릭 후 한 번 나타나는 안내 문장을 만들어 달라는 내용입니다. 첫 결과가 예상과 다르면 실제 화면을 근거로 다음 요청을 작성합니다."
    },
    "callout": {
     "kind": "tip",
     "title": "첫 결과 보관",
     "text": "수정하기 전에 실행한 첫 버전을 보관합니다. 수정 전후를 비교할 자료로 사용합니다."
    }
   },
   {
    "title": "성공 조건을 시험으로 바꾸기",
    "min": 10,
    "steps": [
     {
      "st": "① 시험 순서 작성하기",
      "text": "새로 열기, 시작 버튼 누르기, 반복해서 누르기의 순서로 기대 결과를 적습니다. AI가 제시한 시험에도 빠진 조건이 있는지 확인합니다."
     },
     {
      "st": "② 마우스와 키보드로 확인하기",
      "text": "새로 연 화면에서 안내 문장이 숨겨져 있는지 확인합니다. 마우스로 버튼을 누른 뒤 화면을 다시 새로 열어 Tab과 Enter로도 시험합니다. 반복해서 눌러도 같은 문장이 계속 추가되지 않는지 확인합니다."
     },
     {
      "st": "③ 짝과 판정 비교하기",
      "text": "짝에게 시험 순서만 전달하고 같은 결과가 나오는지 확인합니다. 작은 화면에서도 제목과 버튼을 읽을 수 있는지 살펴봅니다."
     }
    ],
    "worksheet": [
     {
      "label": "시험 기록",
      "placeholder": "수행 순서 / 기대 결과 / 실제 결과 / 통과 여부를 적습니다."
     },
     {
      "label": "짝의 확인",
      "placeholder": "같은 순서로 확인한 결과와 추가로 필요한 시험을 적습니다."
     }
    ],
    "reveal": {
     "title": "통과 판단의 기준",
     "text": "처음에는 안내 문장이 보이지 않고, 버튼을 누르면 한 번 나타나야 합니다. 마우스와 키보드 조작은 각각 확인합니다. 화면이 보기 좋다는 평가만으로 동작 확인을 대신할 수는 없습니다."
    },
    "callout": {
     "kind": "check",
     "title": "관찰한 결과 기록",
     "text": "직접 실행한 결과를 적습니다. 실행하지 못한 항목은 미확인으로 표시합니다."
    }
   },
   {
    "title": "버튼 색 한 가지 수정",
    "min": 9,
    "steps": [
     {
      "st": "① 변경과 유지 조건 나누기",
      "text": "버튼 배경과 글자색을 변경 조건으로 적습니다. 제목, 안내 문장, 클릭 동작은 유지 조건으로 적습니다."
     },
     {
      "st": "② 수정 요청하기",
      "text": "현재 확인한 코드를 함께 제시하고 수정을 요청합니다. 수정 결과는 이전 버전과 구분해 보관합니다.",
      "prompt": "현재 확인한 안내 화면의 시작 버튼 색을 수정해 줘.\n- 배경색은 초록색 #166534, 글자색은 흰색으로 바꿔 줘.\n- 제목, 안내 문장, 클릭 후 한 번 표시되는 동작은 유지해 줘.\n- 외부 연결이나 새 기능은 추가하지 마세요.\n- 바꾼 부분을 설명한 뒤 전체 코드를 보여 줘."
     },
     {
      "st": "③ 기존 시험 반복하기",
      "text": "색 변경을 확인하고 앞 활동의 시험을 같은 순서로 반복합니다. 빨리 끝났다면 작은 화면에서도 버튼 글자가 잘 읽히는지 추가로 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "수정 조건",
      "placeholder": "바꿀 내용 / 유지할 내용을 나누어 적습니다."
     },
     {
      "label": "수정 전후 비교",
      "placeholder": "버튼 색과 기존 동작이 각각 어떻게 확인되었는지 적습니다."
     }
    ],
    "reveal": {
     "title": "수정 후 다시 확인할 내용",
     "text": "버튼 색이 바뀌어도 안내 문장의 표시 동작은 다시 시험해야 합니다. 수정된 화면과 이전 화면을 비교하면 요청하지 않은 변경도 찾을 수 있습니다."
    },
    "callout": {
     "kind": "tip",
     "title": "수정 범위 줄이기",
     "text": "버튼 색을 수정하는 데 오래 걸리면 버튼 문구 한 가지를 바꾸는 활동으로 대체합니다. 유지할 동작을 다시 확인하는 절차는 같습니다."
    }
   },
   {
    "title": "오류 설명과 같은 순서 재시험",
    "min": 8,
    "steps": [
     {
      "st": "① 오류 기록하기",
      "text": "실제 문제가 있으면 조작 순서, 실제 결과, 기대 결과를 나누어 적습니다. 문제가 없으면 안내 문장이 나타나지 않는 가상 사례로 요청 문장을 연습합니다."
     },
     {
      "st": "② 수정 요청 작성하기",
      "text": "아래 요청은 같은 오류를 관찰했을 때 사용합니다. 다른 문제가 있다면 실제로 확인한 내용으로 바꿉니다. 가상 사례로 연습한 경우에는 오류를 고쳤다고 기록하지 않습니다.",
      "prompt": "현재 안내 화면의 동작을 수정해 줘.\n- 새로 열고 시작 버튼을 한 번 눌렀지만 안내 문장이 나타나지 않았습니다.\n- 기대 결과는 “두 후보 중 하나를 골라 봅시다.”가 한 번 나타나는 것입니다.\n- 제목과 초록 버튼 색은 유지해 줘.\n- 원인 후보를 짧게 설명하고 필요한 부분을 고쳐 줘.\n- 전체 수정 코드와 같은 오류를 다시 시험할 순서를 알려 줘."
     },
     {
      "st": "③ 재시험하고 설명하기",
      "text": "실제 오류를 수정했다면 같은 순서로 다시 시험합니다. 짝에게 수정 요청 한 문장과 확인 결과를 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "오류 보고",
      "placeholder": "실제 사례인지 가상 사례인지 표시하고 순서 / 실제 결과 / 기대 결과를 적습니다."
     },
     {
      "label": "재시험 결과",
      "placeholder": "수정 버전에서 수정 전과 동일한 순서로 시험한 결과를 적습니다. 실행 전이면 미확인으로 표시합니다."
     }
    ],
    "reveal": {
     "title": "오류 보고의 구성",
     "text": "재현 순서와 실제 결과가 있어야 같은 문제를 다시 확인할 수 있습니다. 수정 후에는 AI의 설명과 별개로 직접 실행해 기대 결과와 비교합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "공유할 자료 확인",
     "text": "오류 기록과 AI 입력에는 계정 정보, 인증정보, 학생 자료를 넣지 않습니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 2차시의 제작 준비",
    "text": "이번 연수는 학생 2차시의 한 경기 화면 제작에 필요한 요청과 확인 방법을 준비하는 활동입니다. 학생은 1차시에서 정한 주제와 후보를 사용하므로 안내 화면 제작 전체를 반복할 필요는 없습니다."
   },
   {
    "title": "막히는 지점과 시간 조정",
    "text": "학생이 만들고 싶은 모양만 설명하면 버튼을 누른 뒤 무엇이 보여야 하는지 묻습니다. 학생 2차시에서는 한 경기 제작, 라운드 연결, 오류 수정을 함께 다루므로 색 변경은 선택 활동으로 돌리고 동작 확인 시간을 확보합니다."
   }
  ],
  "quiz": [
   {
    "q": "첫 안내 화면의 성공 조건으로 적절한 것은 무엇입니까?",
    "options": [
     "버튼을 클릭한 후 안내 문장이 한 번 나타납니다.",
     "페이지를 열면 안내가 보입니다.",
     "시작 버튼을 누를 때마다 같은 안내 문장이 화면에 추가됩니다.",
     "AI가 화면을 완성했다고 답하면 버튼을 눌러 보는 시험을 생략합니다."
    ],
    "answer": 0,
    "explain": "안내 문장은 처음에는 숨겨져 있고 시작 버튼을 누르면 한 번 나타나야 합니다."
   },
   {
    "q": "버튼 색을 수정한 뒤 필요한 확인은 무엇입니까?",
    "options": [
     "새 색만 보고 기존 버전은 지웁니다.",
     "AI가 설명한 수정 내용만 읽고 버튼을 클릭하는 시험은 생략합니다.",
     "색을 수정한 뒤에도 기존 버튼 동작을 다시 시험합니다.",
     "버튼 색을 수정하는 김에 제목과 안내 문장의 내용까지 한꺼번에 바꿉니다."
    ],
    "answer": 2,
    "explain": "색 변경 후에도 클릭 전 숨김과 클릭 후 표시 동작이 유지되는지 확인합니다."
   }
  ],
  "check": [
   "목적과 성공 조건을 담아 웹페이지를 요청할 수 있다.",
   "변경 조건과 유지 조건을 나누어 수정 요청을 작성할 수 있다.",
   "재현 순서와 실제 결과, 기대 결과를 구분해 기록할 수 있다."
  ],
  "terms": [
   {
    "term": "바이브코딩",
    "def": "자연어로 AI에게 코드를 요청하고 실행 결과를 확인하며 수정하는 제작 방식"
   },
   {
    "term": "프롬프트",
    "def": "AI에게 작업을 요청하는 입력 내용"
   },
   {
    "term": "HTML",
    "def": "웹페이지의 구조와 내용을 작성하는 언어"
   },
   {
    "term": "CSS",
    "def": "웹페이지의 색과 배치 등 표현을 정하는 언어"
   },
   {
    "term": "JavaScript",
    "def": "웹페이지의 클릭 반응 등 동작을 작성하는 언어"
   },
   {
    "term": "재현",
    "def": "같은 조작 순서로 문제가 다시 나타나는지 확인함"
   }
  ],
  "teacher": [
   {
    "issue": "AI 도구나 미리보기를 사용할 수 없습니다.",
    "response": "연수 전에 학교의 도구 이용 조건과 미리보기 환경을 확인합니다. 실행이 막히면 준비한 화면과 코드 예시로 예상 결과와 시험 순서를 작성하고 실행 여부는 미확인으로 표시합니다."
   },
   {
    "issue": "생성된 코드가 길어 시작하지 못합니다.",
    "response": "전체 문법 해석보다 제목, 버튼, 안내 문장이 요구대로 보이는지 먼저 확인합니다. 코드를 읽을 때도 이 요소와 연결된 부분부터 살펴봅니다."
   },
   {
    "issue": "오류가 없어 오류 수정 활동을 하지 못합니다.",
    "response": "가상 오류의 보고 문장을 작성합니다. 실제 오류와 가상 사례를 구분하고 수정 성공 여부를 만들어 적지 않도록 합니다."
   }
  ]
 },
 {
  "no": 2,
  "why": "후보 이름을 여러 곳에 적으면 하나를 바꿀 때 화면과 선택 결과가 달라질 수 있습니다. 교사가 한 경기 화면을 직접 만들고 후보 목록을 수정하면서 데이터와 화면의 관계를 확인합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "한 경기 화면의 동작 범위를 정합니다."
   },
   {
    "part": "후보와 화면 설계",
    "min": 8,
    "what": "후보 목록과 예상 화면을 작성합니다."
   },
   {
    "part": "한 경기 화면 제작",
    "min": 10,
    "what": "AI에게 요청하고 두 후보의 선택 결과를 확인합니다."
   },
   {
    "part": "후보 한 항목 변경",
    "min": 9,
    "what": "목록 변경이 버튼과 결과에 반영되는지 시험합니다."
   },
   {
    "part": "잘못된 후보 시험",
    "min": 8,
    "what": "후보 수, 빈 이름, 중복 이름을 확인합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "목록과 화면의 관계를 판단합니다."
   },
   {
    "part": "학생 수업 적용과 정리",
    "min": 5,
    "what": "학생이 수정할 부분과 필수 시험을 정합니다."
   }
  ],
  "opening": {
   "questions": [
    "후보 이름 하나를 바꿀 때 몇 곳을 수정하면 좋겠습니까?",
    "한 경기 화면에서 후보를 누른 뒤 무엇을 확인해야 합니까?"
   ],
   "expect": "후보 목록과 화면을 구분해 설명하도록 합니다. 이번 차시에서는 선택한 이름까지만 표시하고 다음 경기는 연결하지 않는다는 범위를 확인합니다."
  },
  "activities": [
   {
    "title": "후보 목록과 예상 화면 작성",
    "min": 8,
    "steps": [
     {
      "st": "① 공통 후보 확인하기",
      "text": "사과, 배, 귤, 딸기, 포도, 복숭아, 수박, 바나나를 순서대로 적습니다. 첫 화면에는 사과와 배가 보여야 한다고 예상합니다."
     },
     {
      "st": "② 화면과 결과 그리기",
      "text": "같은 크기의 선택 버튼 두 개와 결과 영역을 그립니다. 사과를 누른 경우와 배를 누른 경우의 결과를 각각 적습니다."
     },
     {
      "st": "③ 범위 합의하기",
      "text": "짝과 화면 설계를 비교합니다. 다음 경기 진행과 저장 기능은 이번 첫 제작에 넣지 않기로 했는지 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "후보 목록",
      "placeholder": "공통 후보 8개를 순서대로 적습니다."
     },
     {
      "label": "동작 예상",
      "placeholder": "사과 선택 결과 / 배 선택 결과 / 아직 넣지 않을 기능을 적습니다."
     }
    ],
    "reveal": {
     "title": "첫 경기의 기준",
     "text": "공통 후보 순서에서 첫 경기는 사과와 배입니다. 첫 제작에서는 두 후보를 표시하고 누른 이름을 보여 주는 데까지 구현합니다."
    },
    "callout": {
     "kind": "check",
     "title": "텍스트 후보 사용",
     "text": "연수에서는 과일 이름만 사용합니다. 인물 사진이나 외부 이미지 주소가 없어도 선택 동작을 확인할 수 있습니다."
    }
   },
   {
    "title": "한 경기 화면 요청과 실행",
    "min": 10,
    "steps": [
     {
      "st": "① 제작 요청하기",
      "text": "공통 후보와 성공 조건을 읽은 뒤 학교에서 허용한 AI 도구에 요청합니다.",
      "prompt": "과일 월드컵의 한 경기 화면을 만들어 줘.\n- 후보 목록은 [“사과”, “배”, “귤”, “딸기”, “포도”, “복숭아”, “수박”, “바나나”]입니다.\n- 첫 두 후보만 같은 크기의 버튼에 표시하고, 누르면 선택한 이름을 결과 영역에 보여 줘.\n- 아직 다음 경기로 넘어가거나 저장하지 마세요.\n- 후보 이름은 배열 한 곳에서만 바꾸고 화면과 결과에 반영되게 해 줘.\n- 키보드로도 선택할 수 있게 해 줘.\n- 외부 연결 없이 HTML 파일 하나로 만들고 후보 목록과 화면이 연결되는 부분을 짧은 주석으로 설명해 줘."
     },
     {
      "st": "② 내 결과 시험하기",
      "text": "생성된 화면을 실행합니다. 사과를 눌러 결과를 확인하고 새로 연 뒤 배도 확인합니다. Tab으로 버튼을 구분하고 Enter 또는 Space로 선택합니다."
     },
     {
      "st": "③ 페이지 예시와 비교하기",
      "text": "아래 앱은 비교할 때만 사용합니다. 내 화면에서 확인한 결과를 먼저 적고 예시와 다른 동작이 요청 범위의 차이인지 오류인지 판단합니다."
     }
    ],
    "worksheet": [
     {
      "label": "선택 시험",
      "placeholder": "누른 후보 / 표시된 이름 / 입력 방법을 적습니다."
     },
     {
      "label": "내 화면과 예시 비교",
      "placeholder": "같은 점과 확인이 더 필요한 점을 적습니다."
     }
    ],
    "reveal": {
     "title": "코드에서 확인할 관계",
     "text": "후보 목록은 데이터이고 버튼은 그 값을 읽어 표시하는 화면 요소입니다. 결과 영역에도 선택한 후보 이름이 표시되어야 합니다. 후보 목록 자체가 화면은 아닙니다."
    },
    "callout": {
     "kind": "tip",
     "title": "다음 경기가 나오지 않는 경우",
     "text": "이번 요청에서는 선택한 이름만 표시합니다. 다음 경기가 나오지 않는 것은 현재 제작 범위에 맞는 동작입니다."
    },
    "app": "s2"
   },
   {
    "title": "목록 한 항목 변경 시험",
    "min": 9,
    "steps": [
     {
      "st": "① 변경 결과 예상하기",
      "text": "사과를 청사과로 바꾸면 첫 버튼과 선택 결과가 어떻게 달라져야 하는지 적습니다. 다른 일곱 후보는 유지 조건으로 표시합니다."
     },
     {
      "st": "② 수정 요청하기",
      "text": "현재 코드를 함께 제시하고 후보 목록 한 항목의 변경을 요청합니다.",
      "prompt": "후보 배열의 첫 항목을 사과에서 청사과로 바꿔 줘.\n- 화면의 버튼과 선택 결과는 후보 배열에서 읽도록 유지해 줘.\n- 다른 일곱 후보와 기존 기능은 바꾸지 마세요.\n- 먼저 바꿀 부분을 알려 줘."
     },
     {
      "st": "③ 변경 전후 대조하기",
      "text": "수정 결과를 새로 열어 버튼과 선택 결과를 확인합니다. 목록의 다른 일곱 후보도 비교합니다. 시험을 마치면 다음 차시의 공통 시험을 위해 사과로 복구합니다."
     }
    ],
    "worksheet": [
     {
      "label": "변경 예상과 관찰",
      "placeholder": "버튼 이름 / 선택 결과 / 나머지 후보에 관해 예상한 내용과 실제 결과를 적습니다."
     },
     {
      "label": "학생에게 설명할 문장",
      "placeholder": "후보 목록을 바꾸면 화면이 달라지는 이유를 한 문장으로 씁니다."
     }
    ],
    "reveal": {
     "title": "불일치를 찾았을 때",
     "text": "버튼은 청사과인데 결과가 사과라면 목록 변경이 모든 표시에 반영되지 않은 상태입니다. 어느 화면에서 어떤 이름이 나왔는지 적어 수정을 요청합니다."
    },
    "callout": {
     "kind": "check",
     "title": "변경 범위 확인",
     "text": "이름이 바뀐 것뿐 아니라 다른 후보와 선택 동작이 유지되는지도 확인합니다."
    }
   },
   {
    "title": "입력 오류와 화면 사용성 시험",
    "min": 8,
    "steps": [
     {
      "st": "① 잘못된 입력 예상하기",
      "text": "후보가 7개인 경우, 빈 이름이 있는 경우, 사과가 두 번 있는 경우에 어떤 안내가 필요한지 적습니다."
     },
     {
      "st": "② 보강 요청과 시험하기",
      "text": "정상 목록을 보관한 뒤 아래 조건을 요청합니다. 오류 입력은 하나씩 적용해 안내를 확인하고 매번 정상 목록으로 복구합니다.",
      "prompt": "후보 목록이 잘못되었을 때 고칠 조건을 화면에 알려 줘.\n- 이름 앞뒤의 공백을 제외하고 확인해 줘.\n- 후보가 정확히 8개가 아니거나 빈 이름이 있거나 같은 이름이 두 번 있으면 경기를 시작하지 마세요.\n- 후보를 자동으로 추가하거나 삭제하지 마세요.\n- 정상 후보의 화면과 선택 동작은 유지해 줘."
     },
     {
      "st": "③ 수업 시연 점검하기",
      "text": "빨리 끝났다면 화면을 확대했을 때의 표시 상태를 확인합니다. 긴 후보 이름 때문에 버튼이 겹치는지는 수업 전에 점검하고 정상 목록으로 복구합니다."
     }
    ],
    "worksheet": [
     {
      "label": "오류 입력 시험",
      "placeholder": "입력 조건 / 기대 안내 / 실제 안내를 적습니다."
     },
     {
      "label": "시연 점검",
      "placeholder": "키보드와 화면 확대 시험 결과, 학생이 막힐 지점을 적습니다."
     }
    ],
    "reveal": {
     "title": "정상 입력과 오류 입력",
     "text": "서로 다른 이름이 8개이면 첫 두 후보를 표시합니다. 후보 수가 다르거나 빈 이름이나 중복 이름이 있으면 고칠 조건을 안내해야 합니다. 정상 목록 복구 후에도 선택 시험을 반복합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "임의로 후보 바꾸지 않기",
     "text": "입력 오류를 감추려고 후보를 자동 추가하거나 삭제하면 작성한 목록과 실제 경기가 달라집니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 2차시 전반 연결",
    "text": "학생은 1차시 설계 메모의 주제와 후보 8개로 한 경기 화면을 만듭니다. 교사는 후보 목록에서 학생이 수정할 부분을 보여 주고, 누른 이름과 표시된 이름을 비교하도록 합니다."
   },
   {
    "title": "막히는 지점과 시간 조정",
    "text": "학생이 화면 문구를 여러 곳에서 고치면 목록 한 곳의 변경이 버튼과 결과에 반영되는지 확인하게 합니다. 학생 2차시 후반에는 라운드 연결도 진행하므로 후보 한 항목 변경과 기본 선택 시험을 우선하고 긴 문구 시험은 선택 활동으로 운영합니다."
   }
  ],
  "quiz": [
   {
    "q": "후보 이름을 한 배열에 모으는 이유로 적절한 것은 무엇입니까?",
    "options": [
     "후보 수와 관계없이 시작하려고 합니다.",
     "후보 목록을 한곳에서 쉽게 바꾸기 위해서입니다.",
     "후보를 선택한 결과를 별도의 외부 서버로 보내려고 합니다.",
     "배열에 모으면 모든 후보의 우승 가능성을 같게 만들 수 있기 때문입니다."
    ],
    "answer": 1,
    "explain": "후보 목록을 한곳에서 수정하고 화면과 선택 결과가 같은 값을 읽는지 확인합니다."
   },
   {
    "q": "후보 목록에 사과가 두 번 있을 때 적절한 동작은 무엇입니까?",
    "options": [
     "중복 후보를 말없이 삭제합니다.",
     "후보 수가 맞도록 다른 과일을 자동으로 추가하여 경기를 진행합니다.",
     "이름이 같은 두 사과를 서로 다른 후보로 판단하여 토너먼트를 시작합니다.",
     "후보 목록에 중복된 이름이 있음을 작성자에게 안내합니다."
    ],
    "answer": 3,
    "explain": "중복 이름이 있으면 시작하지 않고 작성자가 고칠 조건을 알려야 합니다."
   }
  ],
  "check": [
   "두 후보를 표시하고 선택한 이름을 보여 주는 화면을 요청할 수 있다.",
   "후보 목록 변경이 버튼과 선택 결과에 반영되는지 확인할 수 있다.",
   "후보 수, 빈 이름, 중복 이름의 오류를 시험할 수 있다."
  ],
  "terms": [
   {
    "term": "후보",
    "def": "비교하고 선택할 대상"
   },
   {
    "term": "배열",
    "def": "여러 값을 순서대로 모아 둔 자료 구조"
   },
   {
    "term": "결과 영역",
    "def": "선택한 이름 등 실행 결과를 화면에 표시하는 부분"
   },
   {
    "term": "중복 이름",
    "def": "후보 목록에 같은 이름이 둘 이상 있는 상태"
   }
  ],
  "teacher": [
   {
    "issue": "AI가 토너먼트 전체와 저장 기능까지 추가합니다.",
    "response": "한 경기의 선택 결과만 표시하도록 범위를 다시 요청합니다. 추가 기능을 확인하느라 기본 선택 시험을 생략하지 않도록 합니다."
   },
   {
    "issue": "청사과 변경이 화면 일부에만 반영됩니다.",
    "response": "후보 목록, 버튼, 선택 결과를 나란히 비교합니다. 실제로 다른 이름이 표시된 위치를 적어 수정 요청에 사용합니다."
   },
   {
    "issue": "잘못된 후보를 입력해 시험한 뒤 정상적으로 실행되지 않습니다.",
    "response": "보관한 정상 목록을 복구하고 새로 열어 확인합니다. 여러 오류 입력을 동시에 적용하지 않도록 합니다."
   }
  ]
 },
 {
  "no": 3,
  "why": "한 경기 화면이 작동해도 선택한 후보가 다음 라운드에 정확히 진출하는지는 따로 확인해야 합니다. 교사가 예상 경로를 먼저 작성하고 실행 결과와 비교하면서 라운드 연결과 재시작을 검증합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "후보와 승자의 변화를 예상합니다."
   },
   {
    "part": "라운드 경로 예측",
    "min": 8,
    "what": "왼쪽과 오른쪽 선택 경로를 작성합니다."
   },
   {
    "part": "라운드 연결 제작",
    "min": 10,
    "what": "한 경기 화면을 확장하고 진출 후보를 확인합니다."
   },
   {
    "part": "중복 처리와 재시작",
    "min": 9,
    "what": "연속 클릭과 초기화 동작을 시험합니다."
   },
   {
    "part": "경로 대조와 수정",
    "min": 8,
    "what": "서로 다른 선택 경로의 예상과 실제를 비교합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "선택 횟수와 라운드 상태를 판단합니다."
   },
   {
    "part": "학생 수업 적용과 정리",
    "min": 5,
    "what": "상태 설명 방법과 필수 시험을 정합니다."
   }
  ],
  "opening": {
   "questions": [
    "8강 네 경기가 끝나면 어떤 후보가 4강에 있어야 합니까?",
    "우승 후 다시하기를 누르면 무엇을 초기화해야 합니까?"
   ],
   "expect": "현재 라운드 후보와 다음 라운드 승자를 구분해 말하도록 합니다. 우승 이름뿐 아니라 중간 진출 후보도 확인해야 한다는 점을 설명합니다."
  },
  "activities": [
   {
    "title": "두 선택 경로 예상",
    "min": 8,
    "steps": [
     {
      "st": "① 공통 대진 확인하기",
      "text": "사과, 배, 귤, 딸기, 포도, 복숭아, 수박, 바나나 순서를 확인합니다. 무작위로 섞지 않은 상태에서 두 후보씩 짝지어 적습니다."
     },
     {
      "st": "② 왼쪽 경로 예상하기",
      "text": "항상 왼쪽만 골랐을 때 8강 승자, 4강 승자, 우승 후보를 적습니다. 전체 선택 횟수도 계산합니다."
     },
     {
      "st": "③ 오른쪽 경로 비교하기",
      "text": "항상 오른쪽만 고른 경로도 작성합니다. 짝과 각 라운드의 후보 수와 최종 우승 후보를 비교합니다."
     }
    ],
    "worksheet": [
     {
      "label": "왼쪽 경로 예상",
      "placeholder": "8강 승자 / 4강 승자 / 우승 / 선택 횟수를 적습니다."
     },
     {
      "label": "오른쪽 경로 예상",
      "placeholder": "8강 승자 / 4강 승자 / 우승 / 선택 횟수를 적습니다."
     }
    ],
    "reveal": {
     "title": "예상 경로 확인",
     "text": "항상 왼쪽을 고르면 8강 승자는 사과, 귤, 포도, 수박이고 4강 승자는 사과, 포도이며 우승은 사과입니다. 항상 오른쪽을 고르면 8강 승자는 배, 딸기, 복숭아, 바나나이고 4강 승자는 딸기, 바나나이며 우승은 바나나입니다. 두 경로 모두 선택은 7번입니다."
    },
    "callout": {
     "kind": "check",
     "title": "대진 순서 유지",
     "text": "예상 경로와 비교하는 동안 후보 순서를 유지합니다. 무작위 대진은 이번 시험에 사용하지 않습니다."
    }
   },
   {
    "title": "한 경기에서 라운드로 확장",
    "min": 10,
    "steps": [
     {
      "st": "① 확장 요청하기",
      "text": "앞 차시에서 확인한 한 경기 화면과 함께 요청합니다.",
      "prompt": "두 후보 선택 화면에 라운드를 연결해 줘.\n- 초기 후보는 사과, 배, 귤, 딸기, 포도, 복숭아, 수박, 바나나 순서이며 무작위로 섞지 마세요.\n- 고른 후보만 다음 라운드에 진출해야 합니다.\n- 8강 네 경기가 끝나면 4강 두 경기, 그다음 결승을 보여 줘.\n- 우승이 정해지면 우승 이름과 다시하기를 보여 줘.\n- 교사가 확인하는 영역에서 현재 후보, 다음 라운드 승자, 현재 경기 위치를 볼 수 있게 해 줘."
     },
     {
      "st": "② 8강 종료에서 멈추기",
      "text": "내가 만든 화면에서 왼쪽 후보를 차례로 고릅니다. 8강을 마친 직후 멈추고 4강 후보가 예상 목록과 같은지 확인합니다."
     },
     {
      "st": "③ 우승까지 대조하기",
      "text": "결승까지 진행하고 우승과 선택 횟수를 적습니다. 아래 앱은 내 결과와 비교할 때 사용합니다."
     }
    ],
    "worksheet": [
     {
      "label": "라운드 전환 관찰",
      "placeholder": "8강 종료 후 후보 목록과 새 라운드의 경기 위치를 적습니다."
     },
     {
      "label": "완료 결과",
      "placeholder": "우승 / 선택 횟수 / 예상과 다른 지점을 적습니다."
     }
    ],
    "reveal": {
     "title": "상태의 뜻",
     "text": "현재 후보는 이번 라운드에 참여하는 후보 목록이고 다음 승자는 다음 라운드로 진출할 후보 목록입니다. 연수 자료의 상태 예시에서 경기 위치는 0부터 시작합니다. 8강이 끝나면 현재 후보는 4개가 되고 새 라운드의 경기 위치는 0이 됩니다."
    },
    "callout": {
     "kind": "tip",
     "title": "중간 결과 확인",
     "text": "우승 이름이 예상과 같아도 중간 후보가 잘못될 수 있습니다. 라운드 전환 직후의 목록을 함께 확인합니다."
    },
    "app": "s3"
   },
   {
    "title": "연속 클릭과 다시하기 시험",
    "min": 9,
    "steps": [
     {
      "st": "① 중복과 정상 선택 구분하기",
      "text": "같은 경기가 중복 처리되는 경우와 다음 경기에서 새로 선택하는 경우를 구분합니다. 두 경우에 기록이 어떻게 달라져야 하는지 적습니다."
     },
     {
      "st": "② 보강 요청하기",
      "text": "한 경기 중복 처리 방지와 다시하기 조건을 요청합니다.",
      "prompt": "빠른 두 번 클릭으로 같은 경기가 중복 처리되지 않게 해 줘.\n- 선택한 직후 다음 경기 화면이 준비될 때까지 선택 버튼을 잠가 줘.\n- 같은 경기는 승자와 선택 기록에 한 번만 반영해 줘.\n- 다음 경기 화면에서는 정상적으로 새 선택을 받게 해 줘.\n- 다시하기를 누르면 원래 후보 8개로 시작하고 승자 목록, 경기 위치, 선택 기록과 처리 상태를 초기화해 줘.\n- 원래 후보 목록은 유지해 줘."
     },
     {
      "st": "③ 처리 결과 확인하기",
      "text": "빠른 클릭 시험 후 같은 경기가 두 번 기록되지 않았는지 확인합니다. 우승 뒤 다시하기를 눌러 첫 대진과 선택 기록 0건을 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "연속 클릭 시험",
      "placeholder": "수행 순서 / 같은 경기의 기록 수 / 다음 경기 선택 결과를 적습니다."
     },
     {
      "label": "다시하기 시험",
      "placeholder": "초기 후보 / 승자 목록 / 경기 위치 / 선택 기록을 확인해 적습니다."
     }
    ],
    "reveal": {
     "title": "중복 처리 방지 원리",
     "text": "연수 자료의 예시에서는 처리 중 입력을 막고 경기 식별자로 이미 처리한 경기를 구분합니다. 다음 경기의 정상 선택까지 막히면 수정이 필요합니다. 다시하기를 실행하면 후보, 승자, 위치, 기록과 처리 상태가 처음 상태로 돌아갑니다."
    },
    "callout": {
     "kind": "warn",
     "title": "빠른 클릭 시험 해석",
     "text": "빠르게 두 번 눌렀다는 사실만으로 중복이라고 판단하지 않습니다. 같은 경기 기록이 늘었는지, 새 경기에서 선택된 것인지 구분합니다."
    }
   },
   {
    "title": "다른 경로 재시험과 오류 수정",
    "min": 8,
    "steps": [
     {
      "st": "① 오른쪽 경로 시험하기",
      "text": "다시하기 후 항상 오른쪽을 고릅니다. 라운드별 승자와 우승을 예상 기록에 대조합니다."
     },
     {
      "st": "② 불일치 보고하기",
      "text": "예상과 다른 경우 아래 틀을 실제 관찰값으로 채워 요청합니다. 문제가 없으면 짝에게 시험 기록을 설명합니다.",
      "prompt": "라운드 진행에서 예상과 다른 결과를 확인했습니다.\n- 후보 순서는 기존과 같습니다.\n- 선택한 순서는 [실제로 누른 순서]입니다.\n- 기대한 다음 라운드 후보는 [예상 목록]이고 실제 후보는 [직접 확인한 목록]입니다.\n- 같은 경로를 재현해 원인을 설명하고 수정해 줘.\n- 다른 화면과 후보 순서는 유지해 줘."
     },
     {
      "st": "③ 같은 경로 다시 확인하기",
      "text": "수정했다면 오류가 난 경로를 다시 시험합니다. 빨리 끝났다면 좌우를 섞은 경로를 먼저 예상한 뒤 추가로 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "경로 시험표",
      "placeholder": "선택 경로 / 예상 우승 / 실제 우승 / 선택 횟수를 적습니다."
     },
     {
      "label": "수정과 재시험",
      "placeholder": "불일치 지점 / 수정 버전 / 같은 경로의 재시험 결과를 적습니다."
     }
    ],
    "reveal": {
     "title": "두 경로의 통과 조건",
     "text": "공통 순서에서 왼쪽만 고르면 사과가, 오른쪽만 고르면 바나나가 우승하며 두 경로 모두 7번 선택하면 끝납니다. 다시하기 후에는 후보 8개와 선택 기록 0건으로 시작해야 합니다."
    },
    "callout": {
     "kind": "check",
     "title": "실제 결과와 예시 구분",
     "text": "예상 목록을 실제 결과 칸에 옮겨 적지 않습니다. 실행하지 못한 경로는 미확인으로 남깁니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 2차시 후반 연결",
    "text": "학생에게 현재 라운드 후보와 다음 라운드 승자를 종이 목록으로 먼저 구분하게 합니다. 학생이 자신이 고른 후보가 다음 목록에 있는지 설명한 뒤 자기 앱의 화면과 비교하도록 합니다."
   },
   {
    "title": "막히는 지점과 시간 조정",
    "text": "학생이 우승 화면만 보고 완료했다고 하면 8강 종료 직후의 후보를 확인하게 합니다. 학생 2차시는 한 경기 제작도 포함하므로 왼쪽과 오른쪽 경로, 다시하기를 필수 시험으로 정하고 추가 경로는 빨리 끝낸 학생에게 배정합니다."
   }
  ],
  "quiz": [
   {
    "q": "후보가 8개인 토너먼트가 정상 종료될 때 선택 횟수는 몇 번입니까?",
    "options": [
     "후보마다 한 번씩 총 8번",
     "결승까지 진행하며 선택하는 횟수는 모두 6번",
     "전체 경기를 합하여 선택하는 횟수는 7번",
     "매 라운드에서 후보 수만큼 선택하므로 라운드마다 8번씩"
    ],
    "answer": 2,
    "explain": "8강에서 4번, 4강에서 2번, 결승에서 1번 선택합니다."
   },
   {
    "q": "8강이 끝난 직후의 상태로 적절한 것은 무엇입니까?",
    "options": [
     "현재 후보 4개, 새 라운드의 경기 위치 0",
     "현재 후보 8개, 이전 경기 위치 유지",
     "현재 후보 2개, 다음 라운드를 위해 선택 기록 모두 삭제",
     "현재 후보 1개, 우승이 결정된 것으로 보고 다시하기 즉시 실행"
    ],
    "answer": 0,
    "explain": "8강 승자 네 후보가 새 라운드의 후보가 되고 경기 위치는 처음으로 돌아갑니다."
   }
  ],
  "check": [
   "선택한 후보만 다음 라운드에 진출하는지 확인할 수 있다.",
   "서로 다른 선택 경로의 예상 결과와 실제 결과를 비교할 수 있다.",
   "같은 경기의 중복 처리와 다음 경기의 정상 선택을 구분할 수 있다.",
   "다시하기에서 초기화할 상태를 설명할 수 있다."
  ],
  "terms": [
   {
    "term": "토너먼트",
    "def": "각 경기에서 선택된 후보가 다음 단계로 진출하는 경기 방식"
   },
   {
    "term": "라운드",
    "def": "8강이나 4강처럼 같은 단계의 경기 묶음"
   },
   {
    "term": "상태",
    "def": "현재 후보와 경기 위치처럼 실행 중 기억하는 값"
   },
   {
    "term": "경기 식별자",
    "def": "어느 경기인지 구분하기 위한 값"
   },
   {
    "term": "초기화",
    "def": "실행 중인 값을 처음 상태로 되돌림"
   }
  ],
  "teacher": [
   {
    "issue": "첫 선택 직후 승자가 현재 후보 목록에도 남아 있어 혼동합니다.",
    "response": "진행 중인 라운드 목록과 다음 승자 목록을 나란히 보여 줍니다. 라운드가 끝날 때 새 후보 목록으로 바뀌는 시점을 확인합니다."
   },
   {
    "issue": "빠르게 두 번 클릭한 결과를 판단하기 어렵습니다.",
    "response": "클릭 횟수만 세지 말고 경기별 기록을 확인합니다. 같은 경기의 중복과 새 경기의 정상 선택을 구분해 설명합니다."
   },
   {
    "issue": "다시하기 뒤 이전 승자나 기록이 남습니다.",
    "response": "후보, 승자, 경기 위치, 선택 기록, 처리 상태를 항목별로 확인합니다. 남은 상태와 재현 순서를 적어 수정을 요청합니다."
   }
  ]
 },
 {
  "no": 4,
  "why": "선택 결과를 분석하려면 한 회차와 한 경기의 기록을 구분하고 같은 형식으로 저장해야 합니다. 교사가 기록과 복원을 직접 확인하면서 학생에게 저장 범위와 공용 기기 사용 조건을 설명할 준비를 합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "선택 기록과 완료 회차의 차이를 확인합니다."
   },
   {
    "part": "기록 형식 설계",
    "min": 8,
    "what": "필요한 항목과 수집하지 않을 정보를 정합니다."
   },
   {
    "part": "기록 기능 제작",
    "min": 10,
    "what": "선택 경로와 최종 우승 기록을 대조합니다."
   },
   {
    "part": "브라우저 저장과 복원",
    "min": 9,
    "what": "저장 기능을 요청하고 새로고침 결과를 확인합니다."
   },
   {
    "part": "저장 범위와 삭제 시험",
    "min": 8,
    "what": "다시하기, 다른 브라우저, 기록 지우기를 구분합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "기록 단위와 저장 범위를 판단합니다."
   },
   {
    "part": "학생 수업 적용과 정리",
    "min": 5,
    "what": "학생에게 안내할 기록 처리 기준을 작성합니다."
   }
  ],
  "opening": {
   "questions": [
    "선택 일곱 건과 완료 회차 한 건은 어떻게 다릅니까?",
    "같은 기기의 다른 사용자가 이전 기록을 볼 수 있다면 어떤 안내가 필요합니까?"
   ],
   "expect": "한 회차 안에 여러 선택 기록과 최종 우승이 있다는 관계를 확인합니다. 저장 기능과 함께 저장 위치와 삭제 기준도 다뤄야 한다는 점을 설명합니다."
  },
  "activities": [
   {
    "title": "기록 항목과 단위 설계",
    "min": 8,
    "steps": [
     {
      "st": "① 기록할 질문 정하기",
      "text": "우승 후보만 비교할지 선택 경로도 확인할지 정합니다. 이번 연수에서는 경로와 최종 결과를 함께 기록합니다."
     },
     {
      "st": "② 한 회차 구조 작성하기",
      "text": "회차 ID, 가상 별명, 주제, 버전, 선택 기록, 우승을 적습니다. 첫 경기 기록에는 라운드 후보 수, 경기 번호, 두 후보와 선택 후보를 넣습니다."
     },
     {
      "st": "③ 수집하지 않을 정보 정하기",
      "text": "개인을 알아볼 수 있는 정보를 제외합니다. 별명이 실제 신원과 연결되지 않는지도 짝과 함께 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "한 회차의 기록",
      "placeholder": "회차 정보 / 첫 경기 기록 / 완료 시 우승을 나누어 적습니다."
     },
     {
      "label": "수집 제외와 이유",
      "placeholder": "수집하지 않을 정보 세 가지와 제외 이유를 적습니다."
     }
    ],
    "reveal": {
     "title": "기록 단위 확인",
     "text": "한 회차의 완료 기록에는 선택 로그 7건과 우승 한 개가 들어갑니다. 한 경기만 담은 발췌 예시는 전체 완료 기록이 아닙니다. 회차 ID는 사람을 식별하기 위한 값이 아닙니다."
    },
    "callout": {
     "kind": "warn",
     "title": "별명의 한계",
     "text": "별명을 사용해도 다른 정보와 결합하면 누구인지 알 수 있습니다. 실제 신원과 연결하는 명단을 만들지 않습니다."
    }
   },
   {
    "title": "선택 경로와 우승 기록 제작",
    "min": 10,
    "steps": [
     {
      "st": "① 기록 기능 요청하기",
      "text": "앞 차시의 토너먼트에 기록 기능을 추가하도록 요청합니다.",
      "prompt": "토너먼트 한 회차의 선택 경로와 최종 결과를 기록해 줘.\n- 회차 ID, 가상 별명, 주제, 버전, 선택 기록, 우승을 포함해 줘.\n- 선택 기록에는 라운드 후보 수, 경기 번호, 왼쪽 후보, 오른쪽 후보, 선택 후보를 넣어 줘.\n- 결승을 마치기 전에는 우승을 미정으로 두고 결승 종료 시 최종 결과를 한 번만 기록해 줘.\n- 실명, 학번, 이메일, IP 주소, 건강정보는 수집하지 마세요.\n- 기록된 후보 이름을 화면 표에서 안전하게 확인할 수 있게 해 줘."
     },
     {
      "st": "② 완료 전후 비교하기",
      "text": "결승 전에는 우승이 미정인지 확인합니다. 한 회차를 마친 뒤 실제로 누른 순서와 선택 기록을 비교하고 마지막 선택과 우승이 같은지 확인합니다."
     },
     {
      "st": "③ 예시와 형식 비교하기",
      "text": "아래 앱은 기록 형식과 동작을 비교할 때 사용합니다. 내 앱의 기록이 빠졌거나 같은 경기가 반복되었는지 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "선택 경로 대조",
      "placeholder": "직접 고른 순서 / 기록된 순서 / 누락이나 중복 여부를 적습니다."
     },
     {
      "label": "우승 기록 확인",
      "placeholder": "결승 전 값 / 마지막 선택 / 기록된 우승을 적습니다."
     }
    ],
    "reveal": {
     "title": "예시 자료의 항목 이름",
     "text": "연수 자료에서는 회차 ID를 runId, 가상 별명을 alias, 주제를 topic, 버전을 version, 선택 목록을 choices, 우승을 winner로 구분합니다. 결승 전 우승은 미정이며 완료된 선택 목록에는 7건이 있어야 합니다."
    },
    "callout": {
     "kind": "check",
     "title": "화면과 기록 대조",
     "text": "결과 표가 있다는 사실만 확인하지 않습니다. 직접 고른 경로와 표의 값이 같은지 비교합니다."
    },
    "app": "s4"
   },
   {
    "title": "브라우저 저장과 복원 요청",
    "min": 9,
    "steps": [
     {
      "st": "① 새로고침 결과 예상하기",
      "text": "현재 기록이 새로고침 뒤에도 남는지 예상합니다. 저장 위치와 외부 전송 여부를 설명하는 안내 문장을 작성합니다."
     },
     {
      "st": "② 저장 기능 요청하기",
      "text": "확인한 기록 기능에 저장과 복원을 추가하도록 요청합니다.",
      "prompt": "완료한 회차 목록을 이 브라우저에 저장하고 다시 열 때 복원해 줘.\n- 이 앱의 기록은 meal_worldcup_v1이라는 전용 저장 키 하나로 구분해 줘.\n- 저장에 접근할 수 없거나 저장된 내용을 읽을 수 없으면 화면에 알려 줘.\n- 오류가 나도 기존 기록을 자동 삭제하거나 빈 목록으로 덮어쓰지 마세요.\n- “연습 기록 지우기”는 확인을 받은 뒤 이 앱의 기록만 지우게 해 줘.\n- 저장 위치, 외부 전송 없음, 공용 기기의 다른 사용자에게 보일 수 있다는 안내를 넣어 줘."
     },
     {
      "st": "③ 완료 기록 복원하기",
      "text": "저장이 허용된 동일한 미리보기 환경에서 한 회차를 완료하고 새로고침합니다. 완료 목록과 우승이 복원되는지 확인합니다."
     }
    ],
    "worksheet": [
     {
      "label": "저장 안내 문장",
      "placeholder": "저장 위치 / 외부 전송 여부 / 공용 기기 주의사항을 씁니다."
     },
     {
      "label": "복원 시험",
      "placeholder": "환경 / 새로고침 전 기록 / 새로고침 후 기록 / 판정을 적습니다."
     }
    ],
    "reveal": {
     "title": "브라우저 저장 예시의 동작",
     "text": "연수 자료의 예시에서는 localStorage에 완료 목록을 JSON 형식으로 저장합니다. 저장소 접근 실패와 저장 내용 해석 실패를 처리하고, 오류가 있어도 기존 값을 자동으로 지우지 않습니다. 파일을 직접 여는 방식에서는 저장 동작이 환경마다 다를 수 있습니다."
    },
    "callout": {
     "kind": "warn",
     "title": "저장이 막힌 환경",
     "text": "저장이 차단되면 실패 상태를 기록합니다. 설정을 낮추지 않고 가상 기록표로 기록 대조 활동을 이어 갑니다."
    }
   },
   {
    "title": "다시하기와 기록 지우기 구분",
    "min": 8,
    "steps": [
     {
      "st": "① 다시하기 시험하기",
      "text": "완료 후 다시하기를 실행합니다. 새 경기의 선택 기록은 0건이고 완료 목록은 남아 있는지 확인합니다."
     },
     {
      "st": "② 다른 브라우저와 비교하기",
      "text": "다른 브라우저에서는 기록이 자동으로 공유되지 않는지 확인합니다. 화면에 표시된 저장 범위 안내를 읽고 실제 결과와 맞는지 확인합니다."
     },
     {
      "st": "③ 기록 지우기 확인하기",
      "text": "연습 기록 지우기를 실행해 확인 절차와 앱 기록 제거를 시험합니다. 빨리 끝났다면 준비된 손상 기록 사례에서 복원 실패 안내와 원문 보존 여부를 검토합니다."
     }
    ],
    "worksheet": [
     {
      "label": "저장 범위 시험",
      "placeholder": "다시하기 / 다른 브라우저 / 연습 기록 지우기의 기대 결과와 실제 결과를 적습니다."
     },
     {
      "label": "수업 종료 기준",
      "placeholder": "언제 어떤 기록을 지우고 누가 확인할지 적습니다."
     }
    ],
    "reveal": {
     "title": "네 상황의 기대 결과",
     "text": "저장 허용 환경에서는 새로고침 뒤 완료 기록이 복원됩니다. 다른 브라우저에는 자동 공유되지 않습니다. 다시하기는 새 경기만 초기화하고 완료 목록은 보존합니다. 연습 기록 지우기는 확인 후 해당 앱의 기록만 제거합니다."
    },
    "callout": {
     "kind": "check",
     "title": "삭제 범위 제한",
     "text": "이 앱의 연습 기록만 지웁니다. 다른 앱이나 다른 사용자의 기록을 확인하거나 삭제하지 않습니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 3차시의 기록 활동 연결",
    "text": "학생에게 선택 한 건과 완료 응답 한 건을 구분하게 합니다. 개인 활동에서 선택 경로를 확인한 뒤, 공유할 결과 표에서는 완료된 응답 한 건을 한 행으로 다루도록 안내합니다."
   },
   {
    "title": "막히는 지점과 시간 조정",
    "text": "학생이 다시하기와 삭제를 같은 기능으로 생각하면 새 경기 기록과 완료 목록을 나란히 비교하게 합니다. 학생 3차시에서는 수집 규칙과 모의 시트 점검도 진행하므로 저장 코드 제작은 교사가 준비하고 학생은 완료, 새로고침, 다시하기, 기록 지우기를 중심으로 시험합니다."
   }
  ],
  "quiz": [
   {
    "q": "정상 완료된 한 회차의 기록으로 적절한 것은 무엇입니까?",
    "options": [
     "첫 경기 한 건과 임의로 정한 우승",
     "참여자를 구분하기 위한 모든 참여자의 실명과 이메일 목록",
     "경기에 참여했지만 한 번도 선택하지 않은 후보만 모은 목록",
     "한 회차에서 이루어진 선택 7건과 최종 우승 한 개"
    ],
    "answer": 3,
    "explain": "후보가 8개인 토너먼트의 한 회차에는 선택 일곱 건과 최종 우승이 기록됩니다."
   },
   {
    "q": "완료 후 다시하기를 눌렀을 때 적절한 결과는 무엇입니까?",
    "options": [
     "다른 앱의 기록까지 삭제합니다.",
     "새 경기를 진행하는 데 필요한 상태만 초기화합니다.",
     "이전 회차에서 선택한 일곱 건의 기록을 새로 시작하는 경기에 복사합니다.",
     "기존 완료 목록을 다른 브라우저에서도 볼 수 있도록 공유합니다."
    ],
    "answer": 1,
    "explain": "다시하기는 새 경기의 상태를 초기화하고 완료 목록은 보존합니다. 기록 삭제는 별도 기능입니다."
   }
  ],
  "check": [
   "한 경기의 선택 기록과 한 회차의 완료 기록을 구분할 수 있다.",
   "직접 선택한 경로와 저장된 우승 결과를 대조할 수 있다.",
   "브라우저 저장의 범위와 공용 기기 사용 조건을 설명할 수 있다.",
   "다시하기와 연습 기록 지우기의 차이를 확인할 수 있다."
  ],
  "terms": [
   {
    "term": "회차",
    "def": "처음 시작해 우승이 정해질 때까지 진행한 한 번의 활동"
   },
   {
    "term": "회차 ID",
    "def": "각 활동 회차를 구분하기 위한 값"
   },
   {
    "term": "선택 로그",
    "def": "각 경기의 후보와 선택 결과를 순서대로 남긴 기록"
   },
   {
    "term": "localStorage",
    "def": "같은 브라우저의 같은 출처에서 자료를 저장하고 읽는 기능"
   },
   {
    "term": "저장 키",
    "def": "브라우저에 저장한 값을 구분하는 이름"
   },
   {
    "term": "JSON",
    "def": "이름과 값, 목록 등을 텍스트로 나타내는 자료 형식"
   },
   {
    "term": "출처",
    "def": "웹페이지의 주소 체계와 호스트, 포트로 구분되는 실행 범위"
   }
  ],
  "teacher": [
   {
    "issue": "선택 7건을 완료 응답 7건으로 셉니다.",
    "response": "회차 하나 안에 선택 일곱 건과 우승 하나가 들어가는 구조를 그립니다. 공유 표의 한 행은 완료 응답 한 건이라는 기준과 비교합니다."
   },
   {
    "issue": "새로고침 뒤 기록이 사라집니다.",
    "response": "완료 여부와 저장 허용 상태를 확인하고, 동일한 브라우저와 출처에서 실행했는지도 확인합니다. 실행 환경을 기록하고 저장이 차단된 경우에는 가상 표로 대체합니다."
   },
   {
    "issue": "손상된 기록을 지우면 해결된다고 생각합니다.",
    "response": "오류 안내와 원문 보존이 먼저라는 조건을 확인합니다. 손상 사례는 준비된 가상 자료로만 검토합니다."
   },
   {
    "issue": "공용 기기에 이전 사용자의 기록이 남아 있습니다.",
    "response": "다른 사용자의 기록을 열어보지 않도록 합니다. 연수 전에는 가상 자료만 있는 환경을 준비하고 종료 시 앱 전용 연습 기록의 처리 여부를 확인합니다."
   }
  ]
 },
 {
  "no": 5,
  "why": "앱의 저장 메시지와 시트에 남은 기록은 서로 대조해야 합니다. 교사가 모의 시트로 요청 흐름을 체험하고 앱, 웹앱, 시트의 역할과 권한을 구분하면서 학생 수업에 필요한 연동 설계를 검토합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "화면의 성공 안내와 저장 확인의 차이를 생각합니다."
   },
   {
    "part": "연동 흐름 체험",
    "min": 8,
    "what": "모의 기록 한 건을 확인하고 데이터 흐름을 그립니다."
   },
   {
    "part": "다섯 열 설계",
    "min": 10,
    "what": "가상 요청의 값을 열에 대응시키고 AI에게 작성을 요청할 문장을 만듭니다."
   },
   {
    "part": "서버와 화면 역할 검토",
    "min": 9,
    "what": "입력 검사, 저장, 응답 처리를 구분합니다."
   },
   {
    "part": "권한과 접근 범위 점검",
    "min": 8,
    "what": "실행 주체와 접근 대상을 구분해 점검표를 작성합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "연동 역할과 권한 판단을 확인합니다."
   },
   {
    "part": "학생 수업 적용과 정리",
    "min": 5,
    "what": "학생용 모의 활동과 후속 검증 항목을 정리합니다."
   }
  ],
  "opening": {
   "questions": [
    "화면에 저장되었다고 표시되면 무엇을 더 확인해야 합니까?",
    "앱을 사용할 수 있는 사람과 시트 원자료를 읽을 수 있는 사람은 같아야 합니까?"
   ],
   "expect": "앱의 요청, 웹앱의 처리, 시트의 기록을 구분하도록 합니다. 이번 차시는 모의 체험과 설계 검토이며 실제 구글 시트 연결 성공을 확인하는 활동은 아니라는 범위를 안내합니다."
  },
  "activities": [
   {
    "title": "모의 기록 한 건과 흐름도",
    "min": 8,
    "steps": [
     {
      "st": "① 저장 결과 예상하기",
      "text": "가상 별명이 연습A이고 주제가 과일이며 우승이 사과인 완료 응답을 생각합니다. 이 응답 한 건이 표에 어떻게 남아야 하는지 적습니다."
     },
     {
      "st": "② 모의 기록 확인하기",
      "text": "아래 앱에서 가상 결과를 모의 시트에 기록합니다. 추가된 행과 우승 후보를 확인하고 관찰한 결과를 적습니다."
     },
     {
      "st": "③ 역할별 흐름 그리기",
      "text": "앱이 요청을 만들고, 웹앱이 값을 검사해 저장을 요청하며, 시트가 기록을 보관하는 흐름을 그립니다. 응답이 화면으로 돌아오는 방향도 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "모의 관찰",
      "placeholder": "보낸 가상값 / 추가된 행 / 화면 안내 / 확인 범위를 적습니다."
     },
     {
      "label": "데이터 흐름도",
      "placeholder": "앱, 웹앱, 시트의 역할과 요청 및 응답 방향을 적습니다."
     }
    ],
    "reveal": {
     "title": "모의 체험의 범위",
     "text": "이 페이지의 시트는 브라우저 안의 모의 시트입니다. 모의 행 추가는 실제 구글 시트 전송 성공의 근거가 아닙니다. 실제 연동 설계에서는 앱, 웹앱, 시트의 역할을 나누어 확인합니다."
    },
    "callout": {
     "kind": "check",
     "title": "관찰 범위 표시",
     "text": "활동 결과에는 모의 시트에서 확인했다고 적습니다. 실제 외부 시트에 저장했다고 표현하지 않습니다."
    },
    "app": "s5"
   },
   {
    "title": "시험용 표의 다섯 열 설계",
    "min": 10,
    "steps": [
     {
      "st": "① 머리글 작성하기",
      "text": "가상 표의 탭 이름을 results로 적습니다. 첫 행에 requestId, alias, topic, winner, receivedAt을 순서대로 쓰고 두 번째 행부터 결과를 적도록 설계합니다."
     },
     {
      "st": "② 값의 생성 위치 나누기",
      "text": "요청 ID, 가상 별명, 주제, 우승은 앱이 보내는 값으로 구분합니다. 수신 시각은 서버가 저장할 때 기록하는 값으로 구분합니다."
     },
     {
      "st": "③ AI 작성 요청 검토하기",
      "text": "학교에서 허용한 AI 도구에 아래 요청을 입력합니다. 결과는 역할과 조건을 확인하는 자료로 사용하고 실제 연결이나 배포는 진행하지 않습니다.",
      "prompt": "교원 가상 실습용 Google Apps Script를 작성해 줘.\n- 탭 이름은 results이고 첫 행 머리글은 requestId, alias, topic, winner, receivedAt 순서입니다.\n- 앱에서 요청 ID, 가상 별명, 주제, 우승을 보내면 검사 후 한 행에 기록하고 수신 시각을 남겨 줘.\n- 시트 식별자는 REPLACE_WITH_APPROVED_TEST_SHEET_ID라는 대체 문구로 남겨 줘.\n- 원자료 목록을 외부에 돌려주는 함수는 만들지 마세요."
     }
    ],
    "worksheet": [
     {
      "label": "열 대응표",
      "placeholder": "각 열의 뜻 / 가상값 / 값을 만드는 위치를 적습니다."
     },
     {
      "label": "작성 결과 검토",
      "placeholder": "머리글 일치 여부 / 시트 식별자 처리 / 원자료 반환 여부를 적습니다."
     }
    ],
    "reveal": {
     "title": "다섯 열의 역할",
     "text": "requestId는 같은 전송 요청을 구분하는 값, alias는 가상 별명, topic은 주제, winner는 우승, receivedAt은 서버의 수신 시각입니다. 요청 ID는 참여자의 신원을 뜻하지 않습니다. 첫 행은 머리글이고 두 번째 행부터 가상 결과를 기록합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "실제 식별자 제외",
     "text": "외부 AI 입력과 공유 자료에는 실제 시트 식별자나 인증정보를 넣지 않습니다. 대체 문구를 그대로 사용합니다."
    }
   },
   {
    "title": "서버 저장과 화면 응답 역할 검토",
    "min": 9,
    "steps": [
     {
      "st": "① 입력 검사 위치 표시하기",
      "text": "연수 자료의 예시를 읽고 화면의 검사와 서버의 검사를 구분합니다. 서버가 허용된 가상 별명, 과일 주제, 후보 목록과 요청 형식을 확인하는 이유를 적습니다."
     },
     {
      "st": "② 같은 요청 처리 예상하기",
      "text": "같은 요청 ID와 같은 값이 다시 오면 새 행을 추가해야 하는지 판단합니다. 같은 ID에 다른 우승이 오면 어떻게 안내해야 하는지도 적습니다."
     },
     {
      "st": "③ 화면 안내 조건 정하기",
      "text": "요청 전, 응답 대기, 성공 응답, 실패의 상태별 안내를 적습니다. 다음 차시에서 응답 ID와 실제 행을 대조할 항목을 정리합니다."
     }
    ],
    "worksheet": [
     {
      "label": "역할 구분",
      "placeholder": "화면이 할 일 / 서버가 검사할 일 / 시트에서 확인할 일을 적습니다."
     },
     {
      "label": "응답 상태와 확인",
      "placeholder": "대기 / 성공 응답 / 실패에서 표시할 내용과 확인할 증거를 적습니다."
     }
    ],
    "reveal": {
     "title": "연수 자료 예시의 동작",
     "text": "서버 예시에서는 화면 제공, 입력 검사, 같은 요청의 중복 확인, 한 행 저장을 구분합니다. 같은 ID와 같은 값이 오면 행을 늘리지 않고, 같은 ID에 다른 값이 오면 충돌로 중지합니다. 저장 응답으로는 확인용 요청 ID와 처리 결과를 돌려주며 원자료 목록을 반환하지 않습니다. 화면 예시에서는 서버 응답을 기다린 뒤 안내합니다. 실제 호출에는 해당 실행 환경이 필요하므로 로컬 화면 미리보기만으로 연결 여부를 판단할 수 없습니다."
    },
    "callout": {
     "kind": "tip",
     "title": "이번 차시와 후속 시험",
     "text": "이번 차시는 역할과 검사 조건을 설명하는 데 집중합니다. 여러 요청의 중복, 충돌, 실패를 대조하는 본격적인 시험은 다음 차시에서 다룹니다."
    }
   },
   {
    "title": "실행 주체와 접근 범위 점검",
    "min": 8,
    "steps": [
     {
      "st": "① 서로 다른 권한 나누기",
      "text": "웹앱이 어떤 계정 권한으로 실행되는지, 누가 앱에 접근하는지, 누가 시트 원자료를 읽고 수정하는지를 별도 항목으로 적습니다."
     },
     {
      "st": "② 경고 사례 검토하기",
      "text": "코드의 출처를 확인할 수 없거나 필요하지 않은 서비스 권한을 요구하는 가상 사례를 읽습니다. 확인이 필요한 코드 소유자, 요청된 서비스 권한, 학교 정책을 적고 상태를 미확인으로 표시합니다."
     },
     {
      "st": "③ 관리자 확인 항목 정리하기",
      "text": "시험 계정의 사용 조건과 원자료 접근 범위를 질문으로 정리합니다. 빨리 끝났다면 앱 사용자의 범위와 시트 편집자의 범위가 서로 다를 수 있는 이유를 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "권한 점검표",
      "placeholder": "실행 계정 / 앱 접근 대상 / 원자료 읽기 대상 / 원자료 수정 대상을 적고 확인 상태를 표시합니다."
     },
     {
      "label": "관리자 확인 질문",
      "placeholder": "학교 정책과 시험 계정 조건에서 아직 확인할 내용을 적습니다."
     }
    ],
    "reveal": {
     "title": "권한 판단의 구분",
     "text": "실행 주체, 앱 접근 범위, 시트 공유 범위는 별도로 확인할 항목입니다. 배포자 권한으로 실행하면 앱 이용자에게 시트 원자료 편집 권한을 주지 않아도 되지만, 접속 사용자 권한으로 실행하면 그 사용자에게 시트를 편집할 권한이 있어야 합니다. 가능한 설정과 사용 조건은 계정과 학교 정책에 따라 달라질 수 있습니다."
    },
    "callout": {
     "kind": "warn",
     "title": "확인되지 않은 권한",
     "text": "경고나 권한 문제가 있으면 실습을 모의 흐름으로 진행합니다. 점검표에는 확인되지 않은 조건과 담당자에게 물을 내용을 기록합니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 3차시의 모의 수집 연결",
    "text": "학생은 가상 응답 한 건이 표의 한 행으로 남는지 확인하고 앱의 우승과 기록값을 비교합니다. 교사는 실제 연동 환경을 별도로 검토하며, 학생에게는 모의 기록과 실제 외부 저장의 차이를 분명히 설명합니다."
   },
   {
    "title": "막히는 지점과 시간 조정",
    "text": "학생이 저장 메시지만 보고 완료했다고 하면 요청에 대응하는 행과 우승값을 찾게 합니다. 학생 3차시에는 기록 형식과 저장 범위 확인도 포함되므로 서버 코드 작성과 권한 검토는 교사가 준비하고, 학생은 가상값을 대응시키고 행을 확인하는 활동에 집중하도록 합니다."
   }
  ],
  "quiz": [
   {
    "q": "앱이 보낸 값을 검사하고 시트 저장을 요청하는 역할은 무엇입니까?",
    "options": [
     "표의 머리글을 꾸미는 화면",
     "응답 기록을 보관하도록 마련한 시트의 열",
     "참가자가 사용할 가상 별명을 적어 두는 활동지",
     "앱에서 받은 요청을 처리하는 웹앱"
    ],
    "answer": 3,
    "explain": "웹앱의 서버 쪽 처리가 입력을 검사하고 중복 여부를 확인한 뒤 시트 저장을 요청합니다."
   },
   {
    "q": "권한 점검에서 적절한 판단은 무엇입니까?",
    "options": [
     "앱의 실행 주체와 접근할 수 있는 대상을 구분합니다.",
     "앱 이용자를 원자료 편집자로 봅니다.",
     "앱에 접근하는 과정에서 오류가 나면 원자료를 전체 공개로 바꿉니다.",
     "권한 경고가 나타나도 앱 소유자가 누구인지 확인하는 절차는 생략합니다."
    ],
    "answer": 0,
    "explain": "어떤 계정 권한으로 실행되는지와 누가 접근할 수 있는지는 별도로 확인합니다. 시트 원자료의 접근 권한도 구분합니다."
   }
  ],
  "check": [
   "앱, 웹앱, 시트의 역할과 요청 흐름을 설명할 수 있다.",
   "가상 요청의 값과 시트의 다섯 열을 대응시킬 수 있다.",
   "실행 주체, 앱 접근 대상, 원자료 접근 범위를 구분할 수 있다.",
   "모의 시트에서 확인한 결과와 실제 연동 검증을 구분할 수 있다."
  ],
  "terms": [
   {
    "term": "연동",
    "def": "서로 다른 프로그램이나 저장소가 값을 주고받으며 동작하도록 연결함"
   },
   {
    "term": "웹앱",
    "def": "웹으로 받은 요청을 처리하고 화면이나 결과를 반환하는 프로그램"
   },
   {
    "term": "Google Apps Script",
    "def": "구글 서비스와 연결된 작업을 작성하고 실행하는 개발 환경"
   },
   {
    "term": "요청 ID",
    "def": "한 전송 요청과 그 재시도를 구분하기 위한 값"
   },
   {
    "term": "머리글",
    "def": "표에서 각 열의 항목 이름을 적은 부분"
   },
   {
    "term": "시트 식별자",
    "def": "연결할 스프레드시트를 구분하는 고유한 값"
   },
   {
    "term": "실행 주체",
    "def": "프로그램이 서비스를 사용할 때 그 권한이 적용되는 계정"
   },
   {
    "term": "모의 시트",
    "def": "외부 시트 전송을 연습하기 위해 브라우저 안에서 사용하는 표"
   }
  ],
  "teacher": [
   {
    "issue": "모의 행 추가를 실제 구글 시트 저장으로 이해합니다.",
    "response": "브라우저 안의 모의 시트라는 안내를 다시 읽고 결과 기록에도 모의 확인이라고 표시합니다. 실제 외부 저장 여부는 별도 검증 항목으로 둡니다."
   },
   {
    "issue": "열 이름이나 순서가 서로 다릅니다.",
    "response": "results 탭의 다섯 머리글을 기준으로 순서와 대소문자를 대조합니다. 중간 빈 열과 추가 제목 행 없이 설계했는지 확인합니다."
   },
   {
    "issue": "로컬 화면에서 서버 호출이 되지 않아 막힙니다.",
    "response": "화면 미리보기와 서버 실행 환경의 차이를 설명합니다. 이번 차시는 역할 검토와 모의 흐름으로 진행하고 실제 연결 여부는 미확인으로 기록합니다."
   },
   {
    "issue": "실행 권한과 시트 공유 권한을 같은 것으로 생각합니다.",
    "response": "실행 계정, 앱 접근자, 원자료 읽기 대상, 원자료 수정 대상을 네 칸으로 나눕니다. 학교 정책과 담당자가 확인할 항목을 표시합니다."
   }
  ]
 },
 {
  "no": 6,
  "why": "화면에 저장 성공이 표시되어도 기록이 정확히 남았는지는 따로 확인해야 합니다. 가상 요청으로 한 건 저장, 중복, 충돌, 재시도를 시험하고 학생 수업에 사용할 확인 절차를 마련합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "저장 성공의 증거를 예상합니다."
   },
   {
    "part": "한 건 저장 대조",
    "min": 10,
    "what": "요청값과 모의 시트의 한 행을 비교합니다."
   },
   {
    "part": "중복과 충돌 시험",
    "min": 12,
    "what": "네 가지 가상 요청의 행 증가 수를 확인합니다."
   },
   {
    "part": "실패 진단",
    "min": 8,
    "what": "실패한 단계를 찾고 오류 기록을 작성합니다."
   },
   {
    "part": "학생 수업 적용",
    "min": 5,
    "what": "학생용 시험표와 대응 문장을 작성합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "재시도와 저장 검증 원칙을 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "시험표와 오류 기록을 짝에게 설명합니다."
   }
  ],
  "opening": {
   "questions": [
    "저장 성공 문구 외에 무엇을 확인해야 한 건이 저장되었다고 판단할 수 있습니까?",
    "응답을 받지 못했을 때 요청을 다시 보내면 같은 기록이 늘어날 수 있습니까?"
   ],
   "expect": "화면의 안내와 저장된 행을 구분하도록 질문합니다. 응답이 없다는 사실만으로 저장 실패를 단정하지 않게 합니다."
  },
  "activities": [
   {
    "title": "가상 요청 한 건과 저장 행 대조",
    "min": 10,
    "steps": [
     {
      "st": "① 예상 기록 작성",
      "text": "가상 별명은 연습A, 주제는 과일, 우승 후보는 사과로 정합니다. 저장될 값과 예상 행 증가 수를 먼저 적고, 머리글을 제외한 현재 행 수를 확인합니다. 요청 ID는 전송할 때 만들어지므로 전송 후 화면에서 확인해 적습니다."
     },
     {
      "st": "② 한 건 저장 확인",
      "text": "이 앱에서 가상 요청 한 건을 시험합니다. 화면의 응답 ID, 저장 행의 요청 ID, 별명, 주제, 우승 후보를 대조합니다."
     },
     {
      "st": "③ 확인 기준 설명",
      "text": "짝에게 무엇을 확인했는지 설명합니다. 성공 문구만 확인한 경우와 요청 ID가 같은 한 행까지 확인한 경우의 차이를 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "전송 전 예상",
      "placeholder": "가상 별명, 주제, 우승 후보, 예상 행 증가 수를 적습니다. 요청 ID는 전송 후 적습니다."
     },
     {
      "label": "저장 후 대조",
      "placeholder": "화면 응답과 저장 행에서 일치한 값과 다른 값을 적습니다."
     }
    ],
    "reveal": {
     "title": "한 건 저장의 확인 기준",
     "text": "새 요청 한 건은 데이터 행 하나를 추가해야 합니다. 저장 열은 requestId, alias, topic, winner, receivedAt 순서입니다. 연수 자료의 서버 예시는 입력을 검사한 뒤 저장하고 확인 ID를 반환합니다. 화면 예시는 응답을 기다린 뒤 결과를 표시합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "모의 시트의 확인 범위",
     "text": "이 페이지의 시트는 브라우저 안의 모의 시트입니다. 여기서 확인한 결과는 실제 구글 시트 연결이나 두 기기의 공동 저장을 검증한 결과가 아닙니다."
    },
    "app": "s5"
   },
   {
    "title": "같은 요청과 다른 요청 구분",
    "min": 12,
    "steps": [
     {
      "st": "① 네 가지 결과 예상",
      "text": "새 ID로 별명 연습A와 우승 후보 사과를 보낸 요청, 같은 ID로 같은 값을 보낸 요청, 같은 ID로 우승 후보만 배로 바꾼 요청, 새 ID로 별명 연습B와 우승 후보 배를 보낸 요청을 순서대로 적습니다. 각 요청의 예상 행 증가 수를 먼저 적습니다."
     },
     {
      "st": "② 시험표 대조",
      "text": "모의 앱에서 가능한 시험을 실행하고 반환 상태와 행 수를 적습니다. 직접 입력할 수 없는 조건은 연수 자료의 시험표와 대조하며 실행한 시험과 자료로 확인한 시험을 구분합니다."
     },
     {
      "st": "③ 짝 시험과 추가 확인",
      "text": "짝과 서로 다른 가상 요청을 맡아 기록을 비교합니다. 먼저 끝났다면 실제 공동 저장을 확인하려면 무엇을 더 시험해야 하는지 적습니다. 모의 시트의 두 화면을 같은 저장소로 간주하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "네 가지 시험표",
      "placeholder": "요청 조건 / 예상 행 증가 / 확인 결과 / 직접 실행 또는 자료 대조를 적습니다."
     },
     {
      "label": "공동 저장의 추가 확인",
      "placeholder": "서로 다른 기기의 요청이 각각 한 행으로 저장되었음을 확인할 방법을 적습니다."
     }
    ],
    "reveal": {
     "title": "연수 자료의 기대 결과",
     "text": "새 ID로 별명 연습A와 우승 후보 사과를 보내면 새 행 1개가 추가됩니다. 같은 ID로 같은 값을 보내면 중복으로 처리되어 새 행은 0개입니다. 같은 ID로 우승 후보만 바꾸면 REQUEST_CONFLICT로 처리되며 새 행은 0개입니다. 새 ID로 별명 연습B와 우승 후보 배를 보내면 새 행 1개가 추가됩니다. 빈 표에서 시작했다면 마지막 데이터는 두 행이며 기존 값은 유지됩니다."
    },
    "callout": {
     "kind": "check",
     "title": "요청 ID의 뜻",
     "text": "요청 ID는 같은 전송의 재시도를 구분하는 값입니다. 참여자의 신원을 나타내는 값이 아닙니다."
    }
   },
   {
    "title": "응답 불명과 저장 오류 진단",
    "min": 8,
    "steps": [
     {
      "st": "① 증상 분류",
      "text": "진행자가 제시한 오류 사례를 화면, 요청, 저장 중 어느 단계에서 먼저 확인할지 분류합니다. 버튼이 반응하지 않는 경우와 행의 열 순서가 다른 경우를 구분합니다."
     },
     {
      "st": "② 응답 불명 대응",
      "text": "저장 결과를 확인하지 못한 상황에서 시트의 요청 ID를 먼저 찾는 절차를 적습니다. 같은 전송을 확인할 때는 요청 ID와 내용을 유지합니다."
     },
     {
      "st": "③ 오류 보고 작성",
      "text": "실행 버전, 가상 요청 ID, 발생 시각, 화면 증상, 기대 행 수, 실제 행 수, 확인한 권한, 재시험 결과를 기록합니다. 확인하지 못한 항목은 미확인으로 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "첫 확인 지점",
      "placeholder": "증상 / 먼저 볼 단계 / 확인할 증거를 적습니다."
     },
     {
      "label": "오류 보고",
      "placeholder": "가상 요청의 기대 결과, 실제 결과, 다음 확인, 재시험 결과를 적습니다."
     }
    ],
    "reveal": {
     "title": "오류별 확인 대상",
     "text": "google is not defined가 표시되면 로컬 HTML과 HTML Service 화면의 차이를 확인합니다. 접근 거부나 권한 오류가 발생하면 실행 계정, 승인 범위, 학교 정책을 확인합니다. SHEET_NOT_FOUND가 표시되면 탭 이름 results와 대소문자를 확인합니다. HEADER_MISMATCH가 표시되면 머리글 다섯 칸과 순서를 확인합니다. INVALID_INPUT이 표시되면 가상 표식 형식과 후보 허용 목록을 확인합니다. BUSY_RETRY_SAME_ID가 표시되면 시트를 확인한 뒤 같은 요청 ID로 재시도합니다. REQUEST_CONFLICT가 표시되면 기존 행과 요청 내용을 대조하고 내용을 임의로 바꾸지 않습니다. 응답이 불명확하면 시트에서 요청 ID를 먼저 찾습니다."
    },
    "callout": {
     "kind": "warn",
     "title": "오류 기록의 공개 범위",
     "text": "공유용 기록에는 계정 정보, 인증키, 토큰, 비밀값이 포함된 주소를 넣지 않습니다. 연수에서는 모의 흐름과 가상값으로 진단합니다."
    }
   },
   {
    "title": "학생용 저장 확인표 작성",
    "min": 5,
    "steps": [
     {
      "st": "① 필수 시험 선택",
      "text": "학생 3차시에 사용할 새 요청, 같은 요청 재시도, 내용 충돌의 확인 항목을 고릅니다."
     },
     {
      "st": "② 대응 문장 작성",
      "text": "학생이 저장 성공 문구만 보고 끝냈을 때 사용할 질문과, 응답이 없을 때 안내할 행동을 각각 한 문장으로 씁니다."
     },
     {
      "st": "③ 짝 검토",
      "text": "짝 검토는 정리와 공유 시간에 합니다. 확인표를 바꾸어 읽고 학생이 실제로 확인할 수 있는 증거가 적혀 있는지 점검합니다."
     }
    ],
    "worksheet": [
     {
      "label": "학생용 확인표",
      "placeholder": "시험 조건 / 학생이 볼 증거 / 통과 기준을 적습니다."
     },
     {
      "label": "학생에게 할 질문",
      "placeholder": "화면의 응답과 저장 행을 연결하는 질문을 적습니다."
     }
    ],
    "reveal": {
     "title": "확인표의 필수 항목",
     "text": "학생용 확인표에는 요청 ID, 예상 행 증가 수, 실제 행 증가 수, 값의 일치 여부가 필요합니다. 모의 시험과 실제 연결 시험도 구분해 표시합니다."
    },
    "callout": {
     "kind": "tip",
     "title": "조작이 어려운 경우",
     "text": "종이 요청표와 가상 저장표를 사용해 같은 요청의 행을 찾도록 합니다. 저장 검증의 기준은 그대로 적용합니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 3차시로 연결",
    "text": "학생 수업에서는 기록 형식, 브라우저 저장, 모의 시트 확인을 한 차시에 다룹니다. 교원 연수의 연결 진단 전체를 반복하지 않고 한 건 저장과 같은 요청 재시도를 필수 활동으로 정합니다."
   },
   {
    "title": "막히는 지점과 대응",
    "text": "학생이 행 수를 사람 수로 읽으면 한 행은 응답 한 건임을 확인합니다. 응답이 없을 때 새 요청을 만들려 하면 기존 요청 ID와 저장 행부터 찾도록 안내합니다."
   },
   {
    "title": "시간 조정",
    "text": "50분 안에서 모의 시트 검증에 12분을 확보합니다. 시간이 부족하면 충돌 시험은 교사 시연으로 바꾸고 학생의 예상과 실제 결과 기록은 유지합니다."
   }
  ],
  "quiz": [
   {
    "q": "같은 전송의 저장 결과를 확인하지 못했습니다. 먼저 할 일은 무엇입니까?",
    "options": [
     "해당 전송에 사용한 기존 요청 ID를 확인합니다.",
     "새 요청 ID로 여러 번 전송합니다.",
     "저장 여부를 다시 확인하기 전에 저장표에 있던 기존 행을 모두 지웁니다.",
     "우승 후보의 값을 다른 후보로 바꾸어 같은 응답을 다시 보냅니다."
    ],
    "answer": 0,
    "explain": "응답을 받지 못해도 저장되었을 수 있습니다. 기존 요청 ID를 확인하고 같은 전송의 재시도에는 같은 ID와 내용을 사용합니다."
   },
   {
    "q": "같은 요청 ID에서 우승 후보만 바꾸어 보냈을 때 연수 자료의 기대 결과는 무엇입니까?",
    "options": [
     "기존 행의 우승 후보를 바꿉니다.",
     "같은 요청 ID의 내용이 달라 충돌로 처리합니다.",
     "우승 후보가 달라진 것을 새 응답으로 판단하여 시트에 한 행을 추가합니다.",
     "기존 요청 ID에 해당하는 행을 지운 뒤 새 우승 후보로 행을 저장합니다."
    ],
    "answer": 1,
    "explain": "같은 ID에서 내용이 바뀌면 REQUEST_CONFLICT로 처리하며 새 행을 추가하지 않습니다."
   }
  ],
  "check": [
   "요청값과 저장 행을 대조해 한 건 저장 여부를 확인할 수 있다.",
   "중복, 충돌, 응답 불명을 구분해 시험표에 기록할 수 있다.",
   "학생 3차시에 사용할 저장 확인 질문을 작성할 수 있다."
  ],
  "terms": [
   {
    "term": "요청 ID",
    "def": "같은 전송과 그 재시도를 구분하는 식별값."
   },
   {
    "term": "중복 요청",
    "def": "같은 요청 ID와 같은 내용으로 다시 보낸 요청."
   },
   {
    "term": "요청 충돌",
    "def": "같은 요청 ID로 서로 다른 내용을 보낸 상태."
   },
   {
    "term": "모의 시트",
    "def": "외부 시트 연결 없이 브라우저 안에서 저장과 확인을 연습하는 표."
   }
  ],
  "teacher": [
   {
    "issue": "두 기기의 모의 시트가 서로 다릅니다.",
    "response": "각 브라우저 안의 모의 시트임을 확인합니다. 실제 공동 저장을 검증한 것으로 기록하지 않으며 가상 시험표로 요청별 결과를 비교합니다."
   },
   {
    "issue": "응답 불명을 저장 실패로 판단합니다.",
    "response": "이미 저장되었을 가능성을 질문하고 요청 ID로 행을 찾게 합니다. 시트를 확인한 뒤 재시도가 필요하면 같은 요청 ID와 내용을 사용합니다."
   },
   {
    "issue": "연수 전에 준비할 자료가 불분명합니다.",
    "response": "네 가지 가상 요청 시험표와 오류 사례를 준비합니다. 실제 구글 시트 시험은 승인된 교원 시험용 시트에서 별도로 하며, 이 연수에서는 배포와 권한 변경 없이 모의 앱을 사용합니다."
   }
  ]
 },
 {
  "no": 7,
  "why": "그래프를 만들기 전에 어떤 응답을 함께 집계할지 정해야 합니다. 가상 자료를 직접 집계하고 원본과 대조한 뒤, 학생이 결과의 범위와 공개 조건을 설명하도록 수업을 설계합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "순위로 답할 수 있는 질문과 답할 수 없는 질문을 구분합니다."
   },
   {
    "part": "정리 기준 작성",
    "min": 8,
    "what": "한 행의 뜻과 결측, 중복 처리 기준을 정합니다."
   },
   {
    "part": "집계와 그래프 대조",
    "min": 12,
    "what": "가상 여섯 건을 표와 막대그래프로 확인합니다."
   },
   {
    "part": "해석과 유사도 개념",
    "min": 10,
    "what": "집계의 한계와 가상 별점의 비교 조건을 설명합니다."
   },
   {
    "part": "학생 수업 적용",
    "min": 5,
    "what": "해석 발문과 공개 범위를 작성합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "집계 기준과 결과 해석을 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "정리 기준, 그래프, 해석 문장을 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "우승 횟수가 가장 많은 후보를 학교 전체가 가장 좋아한다고 말할 수 있습니까?",
    "평균 점수가 같으면 응답의 분포도 같습니까?"
   ],
   "expect": "우승 횟수와 별점 분포로 답할 수 있는 질문이 서로 다르고, 평균이 같아도 분포는 다를 수 있다는 점을 확인합니다. 그래프의 모양보다 집계 대상과 분모를 먼저 말하도록 합니다."
  },
  "activities": [
   {
    "title": "분석 범위와 정리 기준 작성",
    "min": 8,
    "steps": [
     {
      "st": "① 한 행의 뜻 확인",
      "text": "가상 과일 월드컵 기록에서 한 행이 무엇을 뜻하는지 적습니다. 주제, 규칙, 버전이 같은 응답을 함께 집계하도록 조건을 정합니다."
     },
     {
      "st": "② 처리 기준 작성",
      "text": "빈 응답, 같은 요청의 재전송, 후보 이름의 표기 차이를 어떻게 처리할지 적습니다. 원본은 보존하고 정리한 값과 이유를 별도로 기록합니다."
     },
     {
      "st": "③ 짝과 기준 비교",
      "text": "짝의 기준으로 같은 자료를 정리해도 결과가 같을지 확인합니다. 판단이 다른 항목은 임의로 삭제하지 않고 확인할 사항으로 남깁니다."
     }
    ],
    "worksheet": [
     {
      "label": "분석 범위",
      "placeholder": "주제, 규칙, 버전, 기간, 한 행의 뜻을 적습니다."
     },
     {
      "label": "정리 기준",
      "placeholder": "빈 응답 / 재전송 / 표기 차이의 처리 방법과 이유를 적습니다."
     }
    ],
    "reveal": {
     "title": "중복을 판단하는 기준",
     "text": "우승 후보가 같다는 이유만으로 중복 응답이라고 판단할 수는 없습니다. 같은 요청의 재전송인지, 서로 다른 응답에서 같은 후보를 골랐는지 구분해야 합니다. 제외한 응답이 있으면 이유와 유효 응답 수를 기록합니다."
    },
    "callout": {
     "kind": "check",
     "title": "원본과 정리본 구분",
     "text": "정리 기준을 바꾸더라도 원본으로 돌아가 확인할 수 있어야 합니다. 원자료를 알리지 않고 고치거나 지우지 않습니다."
    }
   },
   {
    "title": "가상 여섯 건 집계와 그래프 검증",
    "min": 12,
    "steps": [
     {
      "st": "① 손으로 예상",
      "text": "사과, 사과, 귤, 배, 사과, 귤을 한 행씩 적습니다. 후보별 우승 횟수와 비율을 계산하고 합계가 원본 건수와 같은지 확인합니다."
     },
     {
      "st": "② 앱으로 대조",
      "text": "이 앱의 가상 자료 집계와 자신의 계산을 비교합니다. 후보별 막대 높이, 횟수 합계, 비율의 분모를 확인합니다."
     },
     {
      "st": "③ 그래프 수정",
      "text": "그래프 제목에 가상 자료, 대상, 자료 기간, 응답 수를 표시합니다. 기간 정보가 없다면 미제공이라고 적습니다. 후보 축과 횟수 축, 세로축의 0 기준을 확인하고 짝에게 검토받습니다."
     }
    ],
    "worksheet": [
     {
      "label": "빈도와 비율",
      "placeholder": "사과 / 귤 / 배의 횟수와 비율, 합계를 적습니다."
     },
     {
      "label": "그래프 검토",
      "placeholder": "제목, 축, 0 기준, 원본 대조에서 확인한 내용을 적습니다."
     }
    ],
    "reveal": {
     "title": "연수 자료의 가상 집계",
     "text": "사과는 3건으로 50%, 귤은 2건으로 약 33%, 배는 1건으로 약 17%입니다. 우승 횟수의 합은 6건입니다. 이 값은 가상 여섯 건의 결과이며 실제 학급의 선호를 나타내지 않습니다."
    },
    "callout": {
     "kind": "tip",
     "title": "먼저 끝난 경우",
     "text": "자동으로 만든 그래프를 다시 검토합니다. 제목이나 축 정보 하나가 빠졌을 때 독자가 무엇을 잘못 이해할지 설명합니다."
    },
    "app": "s6"
   },
   {
    "title": "관찰과 해석 구분 및 유사도 비교",
    "min": 10,
    "steps": [
     {
      "st": "① 해석 문장 작성",
      "text": "집계표에서 직접 확인한 관찰, 후보 간 비교, 자료의 한계, 추가 확인을 각각 한 문장으로 씁니다. 학교 전체의 선호라는 표현이 들어갔는지 검토합니다."
     },
     {
      "st": "② 가상 별점 비교",
      "text": "메뉴 A와 B에 준 점수가 P는 각각 5와 1, Q는 각각 4와 1, R은 각각 1과 5라고 읽습니다. 어떤 응답끼리 상대적 평가 방향이 비슷한지 말로 설명합니다."
     },
     {
      "st": "③ 비교 조건과 공개 범위 확인",
      "text": "메뉴 열 순서가 다른 경우와 미응답을 0으로 바꾸는 경우 중 하나를 골라 비교가 어떻게 달라질지 토의합니다. 비슷한 별점이 성격이나 친밀도를 뜻하지 않는 이유를 한 문장으로 적습니다."
     }
    ],
    "worksheet": [
     {
      "label": "해석 네 문장",
      "placeholder": "관찰 / 비교 / 한계 / 추가 확인을 구분해 적습니다."
     },
     {
      "label": "유사도 비교 조건",
      "placeholder": "같아야 할 열 순서, 미응답 처리, 해석하면 안 되는 내용을 적습니다."
     }
    ],
    "reveal": {
     "title": "가상 별점에서 확인할 내용",
     "text": "P와 Q는 메뉴 A를 B보다 상대적으로 높게 평가한다는 점에서 방향이 비슷합니다. 메뉴 두 개의 응답으로 성격이나 관계를 판단할 수는 없습니다. 이번 연수에서는 공식 유도나 개인별 순위 제작 없이 비교 조건과 한계만 다룹니다."
    },
    "callout": {
     "kind": "warn",
     "title": "공개가 필요한 정보인지 확인",
     "text": "집계 결과를 설명하는 데 개인별 별점이나 이름은 필요하지 않습니다. 메뉴나 급식 담당자를 비난하는 해석도 수정합니다."
    }
   },
   {
    "title": "학생용 해석 발문 작성",
    "min": 5,
    "steps": [
     {
      "st": "① 잘못된 해석 선택",
      "text": "가상 여섯 건으로 학교 전체의 입맛을 설명한 문장을 수정합니다. 수정 근거로 응답 범위와 건수를 넣습니다."
     },
     {
      "st": "② 학생 발문 작성",
      "text": "학생 4차시에서 그래프와 원본을 연결하는 질문, 해석의 범위를 묻는 질문을 하나씩 작성합니다."
     },
     {
      "st": "③ 공개 기준 확인",
      "text": "학생이 공유할 집계와 개인 활동지에만 둘 정보를 구분합니다. 짝에게 공개 기준을 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "수정한 해석과 발문",
      "placeholder": "잘못된 해석 / 수정 문장 / 학생에게 할 질문을 적습니다."
     },
     {
      "label": "공개 범위",
      "placeholder": "공유할 집계와 공유하지 않을 개인별 정보를 적습니다."
     }
    ],
    "reveal": {
     "title": "해석 문장의 범위",
     "text": "이 가상 여섯 건에서는 사과의 우승 횟수가 가장 많다고 설명할 수 있습니다. 응답 수가 많아져도 특정 참여자만 응답했다면 대표성의 한계는 남습니다."
    },
    "callout": {
     "kind": "check",
     "title": "수업 산출물",
     "text": "정리 기준, 집계 그래프, 해석 발문을 함께 보관합니다. 그래프만으로 학생의 해석 과정을 평가하지 않습니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 4차시로 연결",
    "text": "학생 수업에서는 분석 범위, 빈도 집계, 막대그래프 검증, 해석 문장을 중심으로 운영합니다. 유사도는 후속 학습을 위한 짧은 질문으로만 연결합니다."
   },
   {
    "title": "막히는 지점과 대응",
    "text": "학생이 같은 우승 후보를 중복으로 지우면 요청이 같은지 먼저 확인하게 합니다. 비율을 잘못 계산하면 집계에 포함한 유효 응답 수를 직접 확인하고 그 수를 분모로 표시하게 합니다."
   },
   {
    "title": "시간 조정",
    "text": "50분 안에서 분석 범위와 직접 집계에 8분, 막대그래프 제작과 대조에 12분을 확보합니다. 계산이 지연되면 가상 여섯 건만 사용하고, 원본 합계 확인과 해석 작성 시간을 유지합니다."
   }
  ],
  "quiz": [
   {
    "q": "가상 기록 사과, 사과, 귤, 배, 사과, 귤을 집계한 결과는 무엇입니까?",
    "options": [
     "사과 2건, 귤 3건, 배 1건입니다.",
     "같은 후보 이름이 반복되면 지우고 각 후보를 모두 한 건으로 셉니다.",
     "집계 결과는 사과 3건, 귤 2건, 배 1건입니다.",
     "사과가 나온 횟수의 비율을 계산하여 전체 응답의 3분의 1로 봅니다."
    ],
    "answer": 2,
    "explain": "후보 이름이 반복되어도 서로 다른 응답일 수 있습니다. 이 가상 자료의 빈도 합계는 6건입니다."
   },
   {
    "q": "가상 여섯 건의 결과를 설명한 문장으로 적절한 것은 무엇입니까?",
    "options": [
     "학교 전체 학생은 사과를 가장 좋아합니다.",
     "사과가 우승한 결과를 보면 학생들은 다른 과일을 싫어합니다.",
     "이 가상 응답의 우승 결과로 학생들의 건강 상태를 알 수 있습니다.",
     "집계한 이 가상 자료에서는 사과의 우승이 가장 많습니다."
    ],
    "answer": 3,
    "explain": "확인한 자료의 범위 안에서 설명해야 합니다. 우승 횟수만으로 전체 선호나 건강 상태를 판단할 수 없습니다."
   }
  ],
  "check": [
   "원본을 보존하며 결측, 중복, 표기 처리 기준을 작성할 수 있다.",
   "집계 합계와 그래프를 원본 응답 수와 대조할 수 있다.",
   "관찰과 해석을 구분하고 개인별 결과의 공개 범위를 정할 수 있다."
  ],
  "terms": [
   {
    "term": "빈도",
    "def": "특정 값이나 사건이 나타난 횟수."
   },
   {
    "term": "유효 응답",
    "def": "정한 기준에 따라 집계에 포함한 응답."
   },
   {
    "term": "분포",
    "def": "값별로 자료가 얼마나 모여 있는지 나타낸 상태."
   },
   {
    "term": "대표성",
    "def": "수집한 자료가 설명하려는 집단의 특성을 반영하는 정도."
   },
   {
    "term": "유사도",
    "def": "정해진 기준으로 자료 사이의 비슷한 정도를 나타낸 값."
   }
  ],
  "teacher": [
   {
    "issue": "자동 그래프가 나오면 검증을 끝냅니다.",
    "response": "원본에서 후보별 응답 수를 다시 집계해 막대 높이와 대조하고 합계, 분모, 축을 확인하게 합니다. 가상 집계의 합계가 원본 6건과 같은지도 확인합니다."
   },
   {
    "issue": "유사도 계산과 개인별 순위 제작으로 활동이 늘어납니다.",
    "response": "가상 별점의 방향 비교까지만 진행합니다. 이번 차시는 정리와 분포 해석이 중심이며 코사인 공식 유도와 개인별 순위 제작은 다루지 않습니다."
   },
   {
    "issue": "공유할 자료의 범위를 정하지 못합니다.",
    "response": "집계표와 개인별 원자료를 구분한 예시를 준비합니다. 예제와 실제 자료를 분리하고 원본 건수와 집계가 일치하는지 사전에 확인합니다."
   }
  ]
 },
 {
  "no": 8,
  "why": "공개 API에서 응답을 받아도 필요한 자료를 모두 수집했다는 뜻은 아닙니다. 학교와 날짜 조건을 정해 급식 응답을 읽고, 자료 없음과 오류, 일부 반환을 구분해 학생 수업에 사용할 출처 기록을 작성합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "급식 식단으로 알 수 있는 정보와 없는 정보를 구분합니다."
   },
   {
    "part": "수집 조건 설계",
    "min": 8,
    "what": "학교, 식사, 날짜와 필요한 응답 항목을 정합니다."
   },
   {
    "part": "공개 응답 확인",
    "min": 12,
    "what": "조회 결과와 저장본의 출처를 비교합니다."
   },
   {
    "part": "없음과 오류 및 일부 반환",
    "min": 10,
    "what": "상태를 분류하고 원본에서 표를 작성합니다."
   },
   {
    "part": "학생 수업 적용",
    "min": 5,
    "what": "학생용 수집 기록과 대체 활동을 정합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "자료 없음과 수집 범위를 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "수집 조건, 원본, 분석용 표를 설명합니다."
   }
  ],
  "opening": {
   "questions": [
    "식단과 급식인원수를 받으면 그날의 잔반량도 알 수 있습니까?",
    "오류 없이 자료를 받았다면 요청한 기간의 자료가 모두 왔다고 판단할 수 있습니까?"
   ],
   "expect": "식단 정보와 실제 섭취량 또는 잔반 관측을 구분합니다. 응답 상태와 실제 수신 건수를 별도로 확인하도록 안내합니다."
  },
  "activities": [
   {
    "title": "분석 질문과 수집 조건 작성",
    "min": 8,
    "steps": [
     {
      "st": "① 질문의 범위 정하기",
      "text": "특정 날짜의 중식 메뉴 확인처럼 공개 식단으로 답할 수 있는 질문을 정합니다. 잔반량처럼 별도 관측이 필요한 정보도 적습니다."
     },
     {
      "st": "② 요청 조건 기록",
      "text": "공식 문서 요약에서 교육청 코드, 학교 코드, 식사, 날짜, 응답 형식을 확인합니다. 당곡고등학교의 교육청 코드는 B10, 학교 코드는 7010073, 중식 코드는 2입니다."
     },
     {
      "st": "③ 필요한 응답 항목 선택",
      "text": "급식일자, 식사 이름, 메뉴 원문, 열량 등 질문에 필요한 항목을 고릅니다. 하루 조회와 기간 조회 중 이번 활동에 필요한 조건을 선택합니다."
     }
    ],
    "worksheet": [
     {
      "label": "수집 설계",
      "placeholder": "분석 질문 / 학교 / 식사 / 날짜 또는 기간 / 필요한 항목을 적습니다."
     },
     {
      "label": "별도로 필요한 자료",
      "placeholder": "API 응답만으로 확인할 수 없는 정보와 필요한 출처를 적습니다."
     }
    ],
    "reveal": {
     "title": "요청 조건과 응답 형식",
     "text": "교육청과 학교 코드는 필수 조건입니다. 날짜와 식사는 선택 조건이며, 응답 형식을 JSON으로 지정하지 않으면 기본 형식은 XML입니다. 인증키 없는 샘플은 첫 페이지의 5건으로 제한됩니다."
    },
    "callout": {
     "kind": "check",
     "title": "날짜를 명시",
     "text": "오늘이라는 표현만 사용하지 않고 조회할 날짜를 적습니다. 고정 예시 날짜, 자료 기준일, 실제 조회 시각을 구분합니다."
    }
   },
   {
    "title": "하루 중식 조회와 출처 대조",
    "min": 12,
    "steps": [
     {
      "st": "① 확인할 값 예상",
      "text": "2026년 11월 3일 당곡고등학교 중식을 조회할 조건을 기록합니다. 결과에서 학교, 급식일, 식사 이름을 먼저 확인하기로 정합니다."
     },
     {
      "st": "② 응답 확인",
      "text": "이 앱에서 해당 날짜를 선택하고 조회 상태와 원본을 확인합니다. 원격 조회가 가능한 환경에서는 공개 응답을 읽고, 연결이 안 되면 출처가 표시된 저장본을 사용합니다."
     },
     {
      "st": "③ 출처와 값 비교",
      "text": "학교, 날짜, 식사, 열량, 조회 시각, 실시간 조회 또는 저장본 여부를 기록합니다. 자신의 결과를 접힌 확인 칸과 비교하고 값이 다르면 출처와 시각부터 대조합니다."
     }
    ],
    "worksheet": [
     {
      "label": "조회 기록",
      "placeholder": "조회 조건 / 상태 / 확인한 값 / 조회 시각 / 실시간 또는 저장본을 적습니다."
     },
     {
      "label": "자료 간 차이",
      "placeholder": "같은 날짜의 값이 다를 때 비교한 출처와 조회 시각을 적습니다."
     }
    ],
    "reveal": {
     "title": "조회 시각이 다른 두 기록",
     "text": "연수 자료에서 2026년 11월 3일 18:08 KST에 확인한 중식 응답의 열량은 817.2 Kcal이며 급식인원수 값은 770.0입니다. 학생용 저장본에 기록된 같은 급식일의 열량은 11월 4일 22:05 KST 조회 기준으로 820.3 Kcal입니다. 공개 자료는 갱신될 수 있으므로 한 값을 최신 정답으로 고정하지 않고 조회 시각과 원본을 함께 확인합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "인원수와 잔반 구분",
     "text": "급식인원수는 응답에 있는 인원수 값입니다. 실제 출석, 실제 섭취량, 잔반량을 입증하는 값으로 사용하지 않습니다."
    },
    "app": "s7"
   },
   {
    "title": "응답 상태 분류와 분석용 표 작성",
    "min": 10,
    "steps": [
     {
      "st": "① 세 경우 비교",
      "text": "11월 3일 중식, 11월 1일 중식, 10월 전체 중식의 결과를 비교합니다. 정상, 자료 없음, 일부 반환 중 어느 상태인지 적고 전체 건수와 실제 받은 건수를 구분합니다."
     },
     {
      "st": "② 오류와 취소 확인",
      "text": "앱에 준비된 필수 조건 누락과 조회 취소 사례를 확인합니다. 해당 조작이 불가능한 환경에서는 연수 자료의 사례를 읽고 정상 응답과 구분한 안내 문장을 작성합니다."
     },
     {
      "st": "③ 원본에서 표 작성",
      "text": "정상 응답 한 건에서 날짜, 식사 코드와 이름, 메뉴 원문을 새 표로 옮깁니다. 원본과 요청 조건, 조회 시각, 받은 건수도 함께 보관합니다. 자료 없음이나 오류 응답에 정상 응답과 같은 메뉴 목록이 있다고 가정하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "상태 비교표",
      "placeholder": "조회 조건 / 응답 상태 / 전체 건수 / 수신 건수 / 해석을 적습니다."
     },
     {
      "label": "분석용 한 행",
      "placeholder": "날짜, 식사, 메뉴 원문, 출처와 조회 시각을 적습니다."
     }
    ],
    "reveal": {
     "title": "연수 자료가 확인한 상태",
     "text": "11월 3일 중식은 INFO-000의 정상 응답 1건입니다. 11월 1일 중식은 INFO-200으로 해당 조건의 자료가 없습니다. 10월 전체는 전체 15건 중 5건만 받았습니다. 필수 인자를 뺀 조회는 ERROR-300으로, 성공과 구분해 안내해야 합니다. 인증키 없는 샘플에서 페이지 번호나 요청 건수를 바꾸어도 첫 5건 제한은 해제되지 않았습니다."
    },
    "callout": {
     "kind": "tip",
     "title": "먼저 끝난 경우",
     "text": "정상, 자료 없음, 오류, 일부 반환을 각각 한 문장으로 설명합니다. 저장본을 실시간 조회 성공으로 잘못 표시한 문장도 수정합니다."
    }
   },
   {
    "title": "학생용 수집 기록과 대체 활동 설계",
    "min": 5,
    "steps": [
     {
      "st": "① 필수 기록 선택",
      "text": "학생 5차시 활동지에 넣을 요청 조건, 응답 상태, 수신 건수, 출처 항목을 고릅니다."
     },
     {
      "st": "② 대체 자료 결정",
      "text": "학교망에서 조회가 안 될 때 사용할 저장 응답을 정합니다. 저장본의 기준일과 조회 시각을 학생이 어디에 표시할지 적습니다."
     },
     {
      "st": "③ 공유 자료 점검",
      "text": "학생용 화면과 활동지에 인증키가 포함되지 않았는지 확인합니다. 실제 키를 입력하지 않고 키를 제외해야 할 위치를 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "학생용 수집 기록",
      "placeholder": "학생이 반드시 적을 항목과 누락 시 사용할 질문을 적습니다."
     },
     {
      "label": "연결 실패 시 운영",
      "placeholder": "대체 저장본의 출처와 학생에게 안내할 문장을 적습니다."
     }
    ],
    "reveal": {
     "title": "수집 결과의 표현",
     "text": "하루 응답을 받았다면 하루 조회 결과라고 기록합니다. 일부만 받았다면 미확보 범위를 표시합니다. 저장본으로 진행했다면 현재 실시간 조회가 아닌 저장 자료 분석으로 기록합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "인증키를 넣지 않을 위치",
     "text": "실제 인증키를 프롬프트, 브라우저 코드, 발표 화면, 공유 주소에 넣지 않습니다. 이 연수에서는 인증키 발급이나 입력 없이 공개 샘플과 저장 응답을 사용합니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 5차시로 연결",
    "text": "학생 수업에서는 학교와 날짜 조건 확인, 공개 응답 읽기, 상태 구분, 출처 기록을 중심으로 운영합니다. 인증키 없는 하루 조회와 전체 기간 수집을 구분하게 합니다."
   },
   {
    "title": "막히는 지점과 대응",
    "text": "INFO-200을 잔반 0이나 휴교로 해석하면 응답이 알려 주는 것은 해당 조건의 자료 없음뿐임을 확인합니다. 전체 건수만 보고 수집 완료라고 하면 실제 받은 목록 길이와 비교하게 합니다."
   },
   {
    "title": "시간 조정",
    "text": "50분 안에서 요청 조건 확인에 6분, 조회와 기록에 10분, 상태 구분에 6분을 확보합니다. 학생 5차시에는 저장 자료의 메뉴 등장과 열량 비교에 7분, 분석용 표 정리에 6분도 배정되어 있습니다. 연결 문제가 지속되면 저장본으로 전환하고 조건, 상태, 출처 기록을 계속합니다."
   }
  ],
  "quiz": [
   {
    "q": "INFO-200 응답으로 확인할 수 있는 내용은 무엇입니까?",
    "options": [
     "그날 급식의 잔반량이 0입니다.",
     "조회에 사용한 해당 조건의 자료가 없습니다.",
     "자료가 없으므로 해당 학교가 휴교했음을 확정합니다.",
     "조회한 기간에 해당하는 모든 자료를 빠짐없이 받았습니다."
    ],
    "answer": 1,
    "explain": "INFO-200은 해당 조건의 자료가 없다는 뜻입니다. 잔반량이나 휴교 여부를 알려 주지 않습니다."
   },
   {
    "q": "10월 전체 건수는 15건인데 실제로 5건을 받았습니다. 적절한 기록은 무엇입니까?",
    "options": [
     "전체 15건의 수집을 마쳤습니다.",
     "받지 못한 나머지 10건은 급식이 제공되지 않은 것으로 기록합니다.",
     "전체 목록 가운데 실제로는 5건만 수신했습니다.",
     "페이지 번호를 바꾸어 요청하면 자료 수신에 제한이 없다고 기록합니다."
    ],
    "answer": 2,
    "explain": "인증키 없는 샘플은 첫 5건으로 제한됩니다. 전체 건수와 실제 수신 건수를 구분하고 미확보 범위를 남깁니다."
   }
  ],
  "check": [
   "학교, 식사, 날짜 조건과 필요한 응답 항목을 구분할 수 있다.",
   "정상, 자료 없음, 오류, 일부 반환을 구분해 기록할 수 있다.",
   "원본과 조회 시각을 보존하고 저장본과 실시간 조회를 구분할 수 있다."
  ],
  "terms": [
   {
    "term": "API",
    "def": "정해진 요청과 응답 형식으로 프로그램 사이에서 자료를 주고받는 인터페이스."
   },
   {
    "term": "JSON",
    "def": "이름과 값, 목록 등을 사용해 자료 구조를 표현하는 텍스트 형식."
   },
   {
    "term": "인증키",
    "def": "API 이용 요청을 식별하거나 이용 범위를 관리하는 데 사용하는 값."
   },
   {
    "term": "수신 건수",
    "def": "요청 결과로 실제 받은 자료의 개수."
   },
   {
    "term": "저장본",
    "def": "특정 시각에 받은 응답을 보관한 자료."
   }
  ],
  "teacher": [
   {
    "issue": "예시 열량과 화면의 값이 다릅니다.",
    "response": "학교, 급식일, 식사, 조회 시각을 먼저 비교합니다. 다른 시각의 저장본을 같은 응답으로 취급하지 않습니다."
   },
   {
    "issue": "학교망에서 공개 조회가 되지 않습니다.",
    "response": "출처와 조회 시각이 있는 저장 응답을 준비하고 같은 상태 분류와 표 작성 활동을 진행합니다. 현재 연결 성공으로 기록하지 않습니다."
   },
   {
    "issue": "정상 응답과 자료 없음의 구조를 같게 읽습니다.",
    "response": "정상 응답의 메뉴 목록과 자료 없음의 안내를 나란히 보여 줍니다. 없는 메뉴값을 채우거나 인원수에서 잔반량을 추정하지 않게 합니다."
   }
  ]
 },
 {
  "no": 9,
  "why": "메뉴 이름을 정리하는 규칙과 특성을 판단하는 기준이 달라지면 모델의 입력도 달라집니다. 원문을 보존하며 정리 열과 특성 정의표를 만들고, 확인하지 못한 값을 학생에게 어떻게 안내할지 정합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "메뉴 이름에서 확인할 수 있는 사실의 범위를 생각합니다."
   },
   {
    "part": "원문과 정리 열 대조",
    "min": 10,
    "what": "전처리 요청을 작성하고 변환 결과를 검토합니다."
   },
   {
    "part": "특성 정의와 코딩",
    "min": 12,
    "what": "가상 메뉴의 특성과 미확인 기준을 작성합니다."
   },
   {
    "part": "특성 표 품질 점검",
    "min": 8,
    "what": "누락, 분포, 중복 정보, 정답 포함 여부를 확인합니다."
   },
   {
    "part": "학생 수업 적용",
    "min": 5,
    "what": "학생용 기준표와 경계 사례 질문을 만듭니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "원문 보존과 미확인 처리를 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "전처리 규칙, 특성 정의표, 점검 기록을 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "메뉴 이름에 닭이 들어가면 튀김이라고 정할 수 있습니까?",
    "분석에 필요 없는 표기를 분리한 메뉴를 실제 급식 안내에 다시 사용해도 됩니까?"
   ],
   "expect": "메뉴명으로 확인한 사실과 추측을 구분합니다. 분석용 변환본과 식품 안전 안내용 원문의 사용 목적을 분리하도록 합니다."
  },
  "activities": [
   {
    "title": "원문을 보존하는 전처리 요청",
    "min": 10,
    "steps": [
     {
      "st": "① 변환 결과 예상",
      "text": "가상 원문인 쌀밥<br/>두부국 (5.6)<br/>닭튀김 (5.6.15)을 읽습니다. 원문, 정리 이름, 분리한 표기, 적용 규칙을 어떤 열로 남길지 적습니다."
     },
     {
      "st": "② 자연어로 요청",
      "text": "준비된 AI 도구에 가상 원문과 요청을 입력합니다. 도구를 사용할 수 없으면 연수 자료의 변환 예시를 같은 기준으로 검토합니다.",
      "prompt": "급식 메뉴의 원문 열은 절대 바꾸지 말고 새 열을 만들어 줘.\n- <br/> 또는 <br>로 구분된 메뉴를 나누고 앞뒤 공백을 정리해 줘.\n- 이 연습에서는 메뉴 뒤 괄호 안이 숫자와 점, 공백만으로 된 경우에만 알레르기 표기를 별도 열로 분리해 줘.\n- 다른 괄호 내용은 지우지 말고 검토 대상으로 남겨 줘.\n- 원문, 정리 이름, 분리한 표기, 적용 규칙을 나란히 보여 줘.\n- 실제 조리법이나 재료를 추측해 보충하지 마."
     },
     {
      "st": "③ 결과 검토와 수정",
      "text": "원문이 그대로인지, 정리 이름에서 필요한 표기만 분리했는지 확인합니다. 다른 괄호 내용까지 지웠다면 해당 결과와 기대 결과를 설명해 수정 요청을 작성합니다."
     }
    ],
    "worksheet": [
     {
      "label": "전처리 대조표",
      "placeholder": "원문 / 정리 이름 / 분리한 표기 / 적용 규칙을 적습니다."
     },
     {
      "label": "수정 요청",
      "placeholder": "바뀌면 안 되는 값, 실제 바뀐 값, 기대 결과를 적습니다."
     }
    ],
    "reveal": {
     "title": "가상 예시의 정리 결과",
     "text": "가상 예시의 정리 이름은 쌀밥, 두부국, 닭튀김입니다. 원문은 별도 열에 보존하며 숫자로 된 알레르기 표기는 분리해 남깁니다. 연수 자료의 처리 예시는 줄 구분으로 메뉴를 나누고 공백을 정리한 뒤 정해진 조건의 끝 괄호만 분리합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "분석본의 사용 범위",
     "text": "알레르기 표기를 분리한 분석본을 실제 급식 안내에 사용하지 않습니다. 가상 예시의 번호도 실제 음식의 안전 정보를 대신하지 않습니다."
    }
   },
   {
    "title": "특성 정의표와 미확인 기준 작성",
    "min": 12,
    "steps": [
     {
      "st": "① 특성의 뜻 정의",
      "text": "국류, 튀김, 매운맛을 판단할 근거와 예외를 적습니다. 해당하지 않음이 확인된 0과 판단 근거가 없는 미확인을 구분합니다."
     },
     {
      "st": "② 가상 정답으로 코딩",
      "text": "교사가 정한 가상 기준에서 두부국은 국류 1과 튀김 0, 닭튀김은 국류 0과 튀김 1, 쌀밥은 둘 다 0으로 표시합니다. 조리법 미확인 메뉴는 두 열 모두 미확인으로 남깁니다."
     },
     {
      "st": "③ 앱의 특성 표 검토",
      "text": "이 앱의 특성 만들기 표에서 원문과 판단 근거를 비교합니다. 이름만으로 정하기 어려운 메뉴를 찾아 미확인 이유를 적습니다. 이번 활동에서는 회귀 학습을 실행하지 않습니다."
     }
    ],
    "worksheet": [
     {
      "label": "특성 정의표",
      "placeholder": "특성 / 1의 기준 / 0의 기준 / 미확인 기준 / 확인 근거를 적습니다."
     },
     {
      "label": "경계 메뉴",
      "placeholder": "판단이 어려운 메뉴와 추가로 확인할 자료를 적습니다."
     }
    ],
    "reveal": {
     "title": "가상 코딩과 실제 메뉴 구분",
     "text": "두부국, 닭튀김, 쌀밥의 값은 교사가 미리 정한 가상 코딩 정답입니다. 실제 메뉴에 같은 기준을 적용하려면 조리법 등 확인 근거가 필요합니다. 학생용 이름 규칙 표의 튀김 기준에서는 꽃전, 치킨샐러드&허니머스터드S, 달걀후라이를 미확인으로 둡니다. 이 실제 메뉴 표를 모의 회귀 자료에 섞지 않습니다."
    },
    "callout": {
     "kind": "check",
     "title": "미확인은 0과 다릅니다",
     "text": "0은 정한 기준에 해당하지 않는다고 확인한 값입니다. 미확인은 판단 근거가 부족한 상태이므로 임의로 0으로 바꾸지 않습니다."
    },
    "app": "s10"
   },
   {
    "title": "특성 표의 누락과 입력 정보 점검",
    "min": 8,
    "steps": [
     {
      "st": "① 분포와 누락 확인",
      "text": "만든 표에서 각 특성의 0, 1, 미확인 개수를 집계합니다. 대부분 같은 값인 열과 미확인 값이 집중된 메뉴를 찾아 이유를 적습니다."
     },
     {
      "st": "② 범주 표현 비교",
      "text": "채소, 육류, 곡류처럼 순서가 없는 범주에 1, 2, 3을 붙인 표와 범주별 열로 나눈 표를 비교합니다. 숫자의 크기가 범주의 크기를 뜻하는지 설명합니다."
     },
     {
      "st": "③ 입력 열 점검",
      "text": "다음 차시의 잔반 정답이나 정답으로 계산한 값이 입력에 섞이지 않았는지 확인합니다. 같은 뜻의 중복 열과 확인 근거가 없는 열을 표시합니다."
     }
    ],
    "worksheet": [
     {
      "label": "특성 품질 기록",
      "placeholder": "각 열의 0, 1, 미확인 개수와 검토가 필요한 이유를 적습니다."
     },
     {
      "label": "입력에서 제외할 정보",
      "placeholder": "정답 관련 열, 중복 열, 확인되지 않은 열과 처리 이유를 적습니다."
     }
    ],
    "reveal": {
     "title": "범주와 정답 정보의 구분",
     "text": "순서가 없는 범주는 범주별 열을 두는 원핫 인코딩으로 표현할 수 있습니다. 절편이 있는 선형회귀에서는 기준 범주 설정도 확인합니다. 누락 처리와 범주 목록은 학습 자료에서 정하고 시험 자료에도 같은 기준을 적용합니다."
    },
    "callout": {
     "kind": "tip",
     "title": "먼저 끝난 경우",
     "text": "짝에게 특성 정의표만 주고 같은 메뉴를 분류하게 합니다. 값이 다르면 어느 기준이 부족했는지 찾아 정의표를 수정합니다."
    }
   },
   {
    "title": "학생용 경계 사례와 안내 작성",
    "min": 5,
    "steps": [
     {
      "st": "① 필수 기준 선택",
      "text": "학생 8차시에서 사용할 튀김, 매운맛, 국류의 기준과 미확인 표시 방법을 짧게 정리합니다."
     },
     {
      "st": "② 지도 질문 작성",
      "text": "학생이 메뉴 이름만 보고 조리법을 단정했을 때 확인 근거를 묻는 질문을 씁니다."
     },
     {
      "st": "③ 자료 분리 확인",
      "text": "학생에게 줄 원문, 분석용 표, 모의 회귀 자료를 구분합니다. 서로 섞이지 않도록 활동지에 표시할 문구를 정합니다."
     }
    ],
    "worksheet": [
     {
      "label": "학생용 안내",
      "placeholder": "판단 근거가 없을 때의 표시와 확인할 자료를 적습니다."
     },
     {
      "label": "자료 구분 문구",
      "placeholder": "원문 / 분석용 변환본 / 모의 회귀 자료의 표시 문구를 적습니다."
     }
    ],
    "reveal": {
     "title": "다음 실습으로 넘길 자료",
     "text": "전처리 규칙, 특성 정의표, 누락과 분포 기록을 함께 정리합니다. 실제 메뉴의 이름 규칙 표와 잔반 정답이 포함된 모의 회귀 표는 별도 자료로 유지합니다."
    },
    "callout": {
     "kind": "check",
     "title": "판단 이유를 평가",
     "text": "미확인 값을 억지로 채우기보다 판단 근거와 추가 확인 방법을 설명했는지 확인합니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 8차시로 연결",
    "text": "교원 연수의 전처리와 특성 만들기는 학생 8차시의 입력 준비에 연결합니다. 학생에게는 원문이 보존된 예제 표와 특성 기준을 미리 준비해 회귀 실습 시간도 확보합니다."
   },
   {
    "title": "막히는 지점과 대응",
    "text": "학생이 모든 괄호를 지우면 알레르기 표기와 다른 설명을 구분해 다시 비교하게 합니다. 미확인을 0으로 채우면 해당하지 않음과 알 수 없음을 각각 말로 설명하게 합니다."
   },
   {
    "title": "시간 조정",
    "text": "학생 8차시에서는 입력 특성 구분 7분과 실제 메뉴 특성 분류 7분으로 입력 준비를 14분 안에 진행하고 회귀와 해석으로 이어갑니다. 전처리 도구 제작이 지연되면 준비된 정리본을 사용하되 원문 대조와 미확인 판단은 학생이 수행합니다."
   }
  ],
  "quiz": [
   {
    "q": "메뉴 이름만으로 튀김 여부를 판단하기 어렵습니다. 적절한 처리는 무엇입니까?",
    "options": [
     "튀김이 아니라고 보고 0을 넣습니다.",
     "육류가 들어간 메뉴는 모두 튀김으로 분류하여 1을 넣습니다.",
     "AI가 메뉴 이름으로 추측한 조리법을 확인된 사실로 저장합니다.",
     "판단할 근거가 부족하므로 튀김 여부를 미확인으로 둡니다."
    ],
    "answer": 3,
    "explain": "판단 근거가 없으면 미확인으로 남깁니다. 미확인은 해당 특성이 없다고 확인한 값인 0과 구분해야 합니다."
   },
   {
    "q": "알레르기 표기를 분리한 분석본의 사용 방법으로 적절한 것은 무엇입니까?",
    "options": [
     "알레르기 표기를 분리한 자료는 분석용으로 사용합니다.",
     "원문을 지우고 급식 안내로 씁니다.",
     "알레르기 표기가 사라졌으므로 해당 메뉴를 안전한 음식으로 안내합니다.",
     "실제로 사용된 재료를 확인하지 않고 분리한 알레르기 표기를 다시 만듭니다."
    ],
    "answer": 0,
    "explain": "분석용 변환본과 안전 안내용 원문은 목적이 다릅니다. 원문과 분리한 표기를 보존하고 분석본을 급식 안내로 재사용하지 않습니다."
   }
  ],
  "check": [
   "메뉴 원문을 보존하며 정리 열과 변환 규칙을 작성할 수 있다.",
   "0, 1, 미확인을 구분하는 특성 정의표를 만들 수 있다.",
   "특성 표의 누락과 중복 정보, 정답 정보의 포함 여부를 점검할 수 있다."
  ],
  "terms": [
   {
    "term": "전처리",
    "def": "분석 목적에 맞게 자료를 정리하거나 변환하는 작업."
   },
   {
    "term": "특성",
    "def": "모델의 입력으로 사용하는 자료의 속성."
   },
   {
    "term": "미확인",
    "def": "판단에 필요한 근거가 부족해 값을 확정하지 않은 상태."
   },
   {
    "term": "원핫 인코딩",
    "def": "범주별 열을 만들고 해당 여부를 0과 1로 나타내는 표현 방식."
   },
   {
    "term": "정보 누출",
    "def": "예측 시점에 알 수 없는 정답 관련 정보나 시험 정보가 학습 과정에 들어가는 문제."
   }
  ],
  "teacher": [
   {
    "issue": "AI가 원문을 고치거나 모든 괄호를 지웁니다.",
    "response": "원문과 결과를 나란히 놓고 어떤 표기가 달라졌는지 확인하게 합니다. 자연어 요청의 처리 조건과 실제 결과가 다른 곳을 찾아 수정 요청을 작성합니다."
   },
   {
    "issue": "가상 코딩 정답을 실제 조리법으로 받아들입니다.",
    "response": "교사가 정한 가상 정답임을 표시하고 실제 메뉴에는 식단 담당 자료 등 별도 근거가 필요하다고 안내합니다."
   },
   {
    "issue": "회귀 실행까지 진행해 시간이 부족합니다.",
    "response": "이번 차시는 특성 만들기 표까지만 사용합니다. 원문, 분석본, 모의 자료를 구분해 준비합니다."
   }
  ]
 },
 {
  "no": 10,
  "why": "회귀 결과를 해석하려면 입력과 정답의 출처, 학습과 시험의 구분, 오차의 단위를 함께 확인해야 합니다. 모의 잔반 자료로 모델을 실행하고 기준 모델과 비교한 뒤, 학생이 설명할 수 있어야 할 결과와 한계를 정합니다.",
  "timetable": [
   {
    "part": "도입",
    "min": 5,
    "what": "모의 잔반과 실제 학교 잔반을 구분합니다."
   },
   {
    "part": "입력과 목표값 준비",
    "min": 10,
    "what": "특성, 모의 생성 규칙, 학습과 시험 조건을 확인합니다."
   },
   {
    "part": "회귀 실행과 시험 평가",
    "min": 15,
    "what": "모델을 실행하고 같은 시험 자료에서 기준 모델과 비교합니다."
   },
   {
    "part": "계수와 한계 해석",
    "min": 5,
    "what": "계수의 조건과 단위를 설명합니다."
   },
   {
    "part": "학생 수업 적용",
    "min": 5,
    "what": "결과 설명 질문과 평가 기준을 작성합니다."
   },
   {
    "part": "확인 문제",
    "min": 5,
    "what": "시험 평가와 오차 단위를 확인합니다."
   },
   {
    "part": "정리와 공유",
    "min": 5,
    "what": "모델 결과와 학교 적용 전 확인 사항을 공유합니다."
   }
  ],
  "opening": {
   "questions": [
    "모의 자료에서 오차가 작으면 실제 학교의 잔반도 잘 예측한다고 말할 수 있습니까?",
    "잔반률 7.5%와 예측값 7.0%의 차이는 어떤 단위로 읽습니까?"
   ],
   "expect": "모의 실행 결과와 실제 적용 성과를 구분합니다. 모델을 실행하기 전에 시험 자료와 비교 기준을 정해야 한다는 점을 확인합니다."
  },
  "activities": [
   {
    "title": "입력 특성과 모의 목표값 준비",
    "min": 10,
    "steps": [
     {
      "st": "① 자료의 출처 구분",
      "text": "입력은 튀김, 매운맛, 국류의 0과 1 값이고 목표값은 규칙으로 만든 모의 잔반률임을 적습니다. 실제 메뉴 API에 실측 잔반 정답이 들어 있지 않음을 확인합니다."
     },
     {
      "st": "② 생성 규칙 읽기",
      "text": "모의 잔반률은 기본값 12에 튀김 4, 매운맛 3, 국류 -2의 효과와 오차를 반영해 만든 값입니다. 이 규칙이 실제 학교의 관찰 결과인지 짝에게 설명합니다."
     },
     {
      "st": "③ 학습과 시험 구분",
      "text": "기본 조건의 학습 16행과 별도 시험 4행을 확인합니다. 시험 자료를 학습이나 처리 기준 결정에 사용하지 않는다고 기록합니다."
     }
    ],
    "worksheet": [
     {
      "label": "실습 조건",
      "placeholder": "실행 환경 또는 버전 / 입력 / 목표값 / 단위 / 모의 생성 규칙을 적습니다."
     },
     {
      "label": "자료 구분",
      "placeholder": "학습 행 수, 시험 행 수, 시험 자료를 사용하지 않을 작업을 적습니다."
     }
    ],
    "reveal": {
     "title": "이번 회귀 실습의 자료",
     "text": "기본 모의 실습은 세 특성, 학습 16행, 시험 4행을 사용합니다. 목표값의 단위는 %입니다. 실제 식단과 결합해 관찰한 잔반 자료가 아니므로 모델 결과에도 모의 실습이라고 표시합니다."
    },
    "callout": {
     "kind": "warn",
     "title": "실제 특성 표와 분리",
     "text": "앞 차시에서 만든 실제 메뉴의 이름 규칙 표를 이 모의 학습 자료에 임의로 합치지 않습니다. 실측 잔반 정답이 없는 메뉴를 학습 정답이 있는 자료처럼 사용하지 않습니다."
    }
   },
   {
    "title": "회귀 실행과 기준 모델 비교",
    "min": 15,
    "steps": [
     {
      "st": "① 비교 결과 예상",
      "text": "학습 평균만 예측하는 기준 모델과 특성을 사용하는 회귀 모델 중 어느 쪽의 시험 오차가 작을지 예상하고 이유를 적습니다. 비교할 시험 자료와 지표는 같게 둡니다."
     },
     {
      "st": "② 모의 회귀 실행",
      "text": "이 앱에서 기본 조건의 메뉴 특성 회귀를 실행합니다. 학습과 시험 행 수, 사용 특성, 시험 MAE, 기준 모델의 시험 MAE를 기록합니다. 실행이 어려우면 조건이 표시된 연수 자료의 출력으로 비교합니다."
     },
     {
      "st": "③ 오차 단위 검산",
      "text": "별도의 작은 예제에서 모의 정답 7.5%와 2.5%, 예측 7.0%와 3.0%의 차이를 계산합니다. 두 오차 크기의 평균을 구하고 메뉴 특성 회귀와는 다른 자료임을 표시합니다."
     },
     {
      "st": "④ 예상과 결과 비교",
      "text": "자신의 예상과 실행 결과를 비교합니다. 먼저 끝났다면 학습 평균 기준 모델이 시험 정답의 평균을 사용하면 안 되는 이유를 설명합니다."
     }
    ],
    "worksheet": [
     {
      "label": "예상과 실행 기록",
      "placeholder": "예상 / 학습과 시험 행 수 / 특성 / 회귀 시험 MAE / 기준 모델 시험 MAE를 적습니다."
     },
     {
      "label": "오차 검산",
      "placeholder": "작은 예제의 각 절대 오차와 평균, 단위를 적습니다."
     },
     {
      "label": "해석의 범위",
      "placeholder": "이 비교로 확인한 내용과 실제 학교에서 아직 확인하지 못한 내용을 적습니다."
     }
    ],
    "reveal": {
     "title": "기본 모의 실습의 확인값",
     "text": "메뉴 특성 회귀의 기본 조건에서 시험 MAE는 0.5%p이며, 학습 평균만 예측하는 기준 모델의 시험 MAE는 2.5%p입니다. 별도의 작은 예제도 각 절대 오차가 0.5%p여서 MAE가 0.5%p입니다. 수치가 같아도 서로 다른 자료이므로 조건을 구분합니다."
    },
    "callout": {
     "kind": "check",
     "title": "실행 여부 표시",
     "text": "직접 실행한 결과와 연수 자료의 출력을 읽은 결과를 구분합니다. 모의 자료에서 확인한 오차를 실제 학교의 예측 성능으로 제시하지 않습니다."
    },
    "app": "s10"
   },
   {
    "title": "계수의 조건과 학교 적용 한계 해석",
    "min": 5,
    "steps": [
     {
      "st": "① 절편과 계수 확인",
      "text": "기본 모의 실행의 절편과 세 특성의 계수를 읽습니다. 절편은 모든 입력이 0일 때의 예측 잔반률로 설명합니다."
     },
     {
      "st": "② 조건을 넣어 설명",
      "text": "다른 입력이 같을 때 튀김 값이 0에서 1로 바뀌면 예측 잔반률이 얼마나 달라지는지 단위와 함께 적습니다."
     },
     {
      "st": "③ 학교 적용 전 확인",
      "text": "실제 식단을 바꾸기 전에 추가로 확인할 사항을 실제 잔반 측정, 자료의 기간과 단위, 담당자 협의 중에서 골라 적습니다. 전체 토의는 정리와 공유 시간에 합니다."
     }
    ],
    "worksheet": [
     {
      "label": "계수 해석",
      "placeholder": "다른 입력이 같을 때 / 특성의 변화 / 예측값의 차이와 단위를 적습니다."
     },
     {
      "label": "학교 적용 전 확인",
      "placeholder": "추가 측정 자료와 필요한 협의 사항을 적습니다."
     }
    ],
    "reveal": {
     "title": "모의 자료의 계수",
     "text": "기본 실행의 절편은 12이고 계수는 튀김 +4, 매운맛 +3, 국류 -2입니다. 모든 입력이 0이면 예측 잔반률은 12%입니다. 다른 입력이 같을 때 튀김이 0에서 1로 바뀌면 예측 잔반률은 4%p 높아집니다. 이는 모의 생성 규칙에서 나온 관계이며 실제 원인을 입증하지 않습니다."
    },
    "callout": {
     "kind": "warn",
     "title": "식단 변경의 근거",
     "text": "모의 계수만으로 특정 반찬을 줄이거나 제외하자고 결론 내리지 않습니다. 실제 자료의 검증과 현장 협의가 필요합니다."
    }
   },
   {
    "title": "학생용 결과 설명과 평가 기준 작성",
    "min": 5,
    "steps": [
     {
      "st": "① 학생 질문 선택",
      "text": "학생 8차시에 사용할 입력과 정답의 출처, 학습과 시험의 분리, 시험 오차, 계수 해석 질문을 정합니다."
     },
     {
      "st": "② 결과 설명 작성",
      "text": "모의 자료의 조건, 기준 모델과의 비교, 계수의 조건과 단위, 실제 적용의 한계를 포함해 짧은 결과 설명을 씁니다."
     },
     {
      "st": "③ 짝 평가",
      "text": "문제의 데이터화, 해석, 학교 적용, AI 활용 중 두 관점을 골라 서로의 결과 설명을 읽고 검토합니다. 나머지 관점과 AI가 제시한 결과의 확인 방법은 정리와 공유 시간에 점검합니다."
     }
    ],
    "worksheet": [
     {
      "label": "학생용 결과 설명",
      "placeholder": "모의 자료 조건 / 시험 비교 / 계수 해석 / 한계를 적습니다."
     },
     {
      "label": "평가 질문",
      "placeholder": "학생의 설명과 검증 과정을 확인할 질문을 적습니다."
     }
    ],
    "reveal": {
     "title": "결과 기록의 필수 내용",
     "text": "실행 조건, 입력과 목표값의 출처, 학습과 시험 행 수, 시험 MAE, 기준 모델, 계수, 한계를 함께 기록합니다. 숫자가 맞는지와 그 숫자를 어디까지 해석할 수 있는지를 함께 평가합니다."
    },
    "callout": {
     "kind": "tip",
     "title": "실행 환경이 없는 경우",
     "text": "조건과 출력이 함께 있는 자료로 비교와 해석을 진행합니다. 직접 실행하지 않았다는 사실을 기록하고 검산 가능한 오차 계산은 수행합니다."
    }
   }
  ],
  "apply": [
   {
    "title": "학생 8차시로 연결",
    "text": "교원 9차시의 특성 준비와 이번 회귀 실습을 학생 8차시에 연결합니다. 학생은 준비된 모의 자료로 실행하고 작은 예제의 오차 계산과 메뉴 특성 회귀를 구분해 기록합니다."
   },
   {
    "title": "막히는 지점과 대응",
    "text": "학생이 MAE를 %로 읽으면 두 비율의 차이를 직접 계산해 %p로 적게 합니다. 튀김 계수를 원인으로 설명하면 다른 입력이 같을 때의 모의 예측 차이라는 조건을 문장에 넣게 합니다."
   },
   {
    "title": "시간 조정",
    "text": "학생 8차시는 도입 5분, 입력 특성 구분 7분, 실제 메뉴 특성 분류 7분, 작은 회귀 예제 8분, 앱 실행과 성능 비교 8분, 계수 해석 5분, 확인 문제 5분, 정리 5분으로 운영합니다. 실행 문제가 생기면 준비된 출력으로 전환하고 해석 시간을 확보합니다."
   }
  ],
  "quiz": [
   {
    "q": "회귀 모델과 기준 모델의 성능을 비교하는 방법으로 적절한 것은 무엇입니까?",
    "options": [
     "회귀 모델은 학습 자료로만 평가합니다.",
     "기준 모델이 예측할 값으로 시험 자료의 정답 평균을 사용합니다.",
     "시험 자료 중에서 예측 오차가 작게 나온 행만 골라 성능을 비교합니다.",
     "두 모델을 동일하게 마련한 시험 자료에서 비교합니다."
    ],
    "answer": 3,
    "explain": "같은 시험 자료와 같은 지표를 사용해야 비교할 수 있습니다. 기준 모델의 평균은 학습 자료에서 정합니다."
   },
   {
    "q": "모의 잔반률 정답 7.5%와 예측 7.0%의 절대 오차는 얼마입니까?",
    "options": [
     "두 잔반률의 차이인 0.5%p",
     "정답의 0.5%인 값",
     "두 비율을 더하여 계산한 14.5%",
     "예측 잔반률을 그대로 사용한 7.0%"
    ],
    "answer": 0,
    "explain": "두 비율의 차이는 퍼센트포인트로 읽습니다. 이 경우 절대 오차는 0.5%p입니다."
   }
  ],
  "check": [
   "모의 입력과 목표값의 출처, 학습과 시험 조건을 설명할 수 있다.",
   "같은 시험 자료에서 회귀 모델과 기준 모델의 MAE를 비교할 수 있다.",
   "계수를 조건과 단위에 맞게 해석하고 실제 학교 적용의 한계를 설명할 수 있다.",
   "학생 8차시의 결과 설명과 검증 과정을 평가할 질문을 작성할 수 있다."
  ],
  "terms": [
   {
    "term": "회귀",
    "def": "입력 특성과 수치형 목표값의 관계를 학습해 수치를 예측하는 방법."
   },
   {
    "term": "목표값",
    "def": "모델이 예측하려는 값."
   },
   {
    "term": "시험 자료",
    "def": "학습에 사용하지 않고 예측 성능을 평가하는 자료."
   },
   {
    "term": "기준 모델",
    "def": "학습한 모델의 성능과 비교하는 단순한 예측 방법."
   },
   {
    "term": "MAE",
    "def": "예측값과 정답의 차이에서 부호를 제외한 크기의 평균."
   },
   {
    "term": "퍼센트포인트",
    "def": "백분율로 나타낸 두 비율의 차이를 표시하는 단위."
   },
   {
    "term": "계수",
    "def": "다른 입력이 같을 때 특정 입력의 한 단위 변화에 따른 예측값의 차이를 나타내는 값."
   },
   {
    "term": "절편",
    "def": "모델의 모든 입력값이 0일 때의 예측값."
   }
  ],
  "teacher": [
   {
    "issue": "실행 환경이 없어 모델을 직접 실행하지 못합니다.",
    "response": "앱이나 조건이 표시된 실행 출력을 사용해 비교 활동을 진행합니다. 별도 설치나 장시간 환경 설정으로 연수를 중단하지 않습니다. 직접 실행하지 않았다는 사실은 기록에 표시합니다."
   },
   {
    "issue": "다른 환경의 조건 변경 결과를 같은 실험으로 비교합니다.",
    "response": "기본 조건을 먼저 확인하고 자료와 실행 환경을 기록하게 합니다. 학습 8행의 시험 MAE는 연수 자료의 Python 출력이 1.0%p, 페이지 앱이 0.81%p로 다릅니다. 자료 생성과 분할 조건이 같은지 확인하기 전까지 직접 비교하지 않습니다."
   },
   {
    "issue": "연수 결과를 실제 잔반 예측 성과로 제시합니다.",
    "response": "모든 결과에 모의 자료임을 표시하게 합니다. 실제 학교 적용에는 관측 자료와 별도 검증이 필요합니다."
   }
  ]
 }
]
;
/* ==========================================================
   목차 페이지와 차시 페이지 (ds-danggok처럼 목차에서 각 차시로 넘어간다)
   ========================================================== */
const GROUP_LABEL = { 1: "1마당. 내 입맛 데이터로 연습", 2: "2마당. 급식이라는 진짜 문제", 3: "3마당. 데이터로 학교 바꾸기" };
const GROUP_RANGE = { 1: "1~4차시", 2: "5~9차시", 3: "10차시" };
const pad2 = n => String(n).padStart(2, "0");
const lessonHref = n => `lesson${pad2(n)}.html`;
const root = document.getElementById("root");
// 학생 수업(s)과 교원 연수(t) 두 갈래
const TRACK = {
  s: { list: () => LESSONS, content: () => (typeof CONTENT !== "undefined" ? CONTENT : []), href: n => `lesson${pad2(n)}.html`,
       label: GROUP_LABEL, range: GROUP_RANGE, badge: n => `학생 ${n}차시`, key: n => String(n), back: "차시별 수업 자료로 돌아가기" },
  t: { list: () => TLESSONS, content: () => (typeof TCONTENT !== "undefined" ? TCONTENT : []), href: n => `tlesson${pad2(n)}.html`,
       label: { 1: "1부. 기초 다지기", 2: "2부. 공공데이터와 머신러닝" }, range: { 1: "1~7차시", 2: "8~10차시" }, badge: n => `교원 연수 ${n}차시`, key: n => "t" + n, back: "교원 연수 목차로 돌아가기" }
};

function topbar(badges, isIndex) {
  return el("div", { class: "topbar" }, el("div", { class: "inner" }, [
    el("a", { class: "brand", href: "index.html" }, [el("span", { class: "mark", "aria-hidden": "true" }), "급식 이상형 월드컵"]),
    el("span", { class: "spacer" }),
    ...badges.map(b => el("span", { class: "badge", text: b })),
    isIndex ? null : el("a", { class: "home", href: "index.html", text: "← 목차" })
  ]));
}
function footer() {
  return el("footer", { class: "foot" }, [
    el("p", { text: "근거 자료: 급식_AI문제해결_고등 학생 01-10차시 검토본 v05, 교원 01-10차시 검토본 v04 (2026-11-03), 상세설계 260714." }),
    el("p", { text: "월드컵 후보, 별점 응답, 잔반률은 모두 수업용 가상값 또는 모의값입니다. 급식 메뉴만 NEIS 공개 API의 실제 응답이며, 시트는 이 페이지 안의 모의 시트로 외부에 전송하지 않습니다." })
  ]);
}

/* ---------- 목차 ---------- */
function renderIndex() {
  // 예전 단계 주소(#s3 등)로 들어오면 그 단계가 있는 차시로 보낸다
  const old = (location.hash || "").replace("#", "");
  const hit = LESSONS.find(l => l.stages.includes(old));
  if (hit) { location.replace(lessonHref(hit.no) + "#" + old); return; }

  const groupsOf = (k, gs, gcls) => gs.map(g => el("section", { class: "lesson-group " + gcls(g) }, [
    el("h3", { class: "lg-head" }, [el("span", { class: "lg-range", text: TRACK[k].range[g] }), TRACK[k].label[g]]),
    el("div", { class: "lesson-list" }, TRACK[k].list().filter(l => l.group === g).map(l => el("a", { class: "lesson-link", href: TRACK[k].href(l.no) }, [
      el("span", { class: "no" }, [el("b", { text: pad2(l.no) }), " 차시"]),
      el("span", { class: "tt", text: l.title }),
      el("span", { class: "sub", text: l.sub }),
      l.teacher.length ? el("span", { class: "ch" }, l.teacher.map(t => el("span", { class: "chip t", text: t }))) : null
    ])))
  ]));
  const groups = groupsOf("s", [1, 2, 3], g => "g" + g);
  const tgroups = groupsOf("t", [1, 2], g => "g" + (g === 1 ? 4 : 5));
  root.replaceChildren(
    topbar(["학생용", "교원 연수"], true),
    el("div", { class: "wrap" }, [
      el("section", { class: "hero" }, [
        el("div", { class: "eyebrow", text: "AI교육센터 파일럿 프로그램 / 급식 AI 문제해결 고등" }),
        el("h1", { text: "급식 이상형 월드컵" }),
        el("p", { class: "lede", text: "학생이 10차시 동안 만드는 코드를 차시별로 보여 줍니다. 이상형 월드컵으로 시작한 앱이 급식 API 수집, 별점 조사, 유사도, 회귀, 검증을 거쳐 식단 개선안으로 이어집니다. 차시를 고르면 50분 수업 흐름, 활동지, 직접 사용해 볼 수 있는 앱이 나옵니다. 아래에는 교사가 먼저 만들어 보고 수업으로 옮기는 교원 연수 10차시가 있습니다." }),
        el("div", { class: "hero-links" }, [
          el("a", { class: "btn primary", href: lessonHref(1), text: "1차시부터 시작하기 →" }),
          el("a", { class: "btn", href: "#teacher", text: "교원 연수 자료 보기" })
        ])
      ]),
      el("div", { class: "section-title" }, [el("h2", { text: "차시별 수업 자료" }), el("span", { class: "muted", text: "학생 1~10차시, 교원 연계 차시 표시" })]),
      el("div", { class: "lesson-groups" }, groups),
      el("div", { class: "section-title", id: "teacher" }, [el("h2", { text: "교원 연수 자료" }), el("span", { class: "muted", text: "교원 1~10차시, 교사가 먼저 만들어 보고 수업으로 옮기기" })]),
      el("div", { class: "lesson-groups" }, tgroups),
      footer()
    ])
  );
}

/* ---------- 차시 페이지 ---------- */
// 1차시 설계 메모의 주제와 후보를 프롬프트 빈칸에 자동으로 채운다
function fillSlots(text) {
  const v = validate(design.candidates);
  if (!v.ok) return { nodes: [text], plain: text, filled: false };
  const c = v.clean, topic = (design.topic || "").trim() || "과일";
  // 받침에 따라 조사를 맞춘다 (과자야, 과일이야)
  const has = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
  const last = c[c.length - 1];
  const reps = [
    ["[8개 이름]이야", c.join(", ") + (has(last) ? "이야" : "야")],
    ["[과일]이고", topic + (has(topic) ? "이고" : "고")],
    ['["사과", "배", "귤", "딸기", "포도", "복숭아", "수박", "바나나"]', "[" + c.map(x => JSON.stringify(x)).join(", ") + "]"],
    ["사과, 배, 귤, 딸기, 포도, 복숭아, 수박, 바나나", c.join(", ")],
    ["[과일]", topic], ["[8개 이름]", c.join(", ")], ["과일 월드컵", topic + " 월드컵"]
  ];
  let parts = [text], filled = false;
  reps.forEach(([k, val]) => {
    parts = parts.flatMap(x => typeof x !== "string" ? [x] : x.split(k).flatMap((s, i, a) => i < a.length - 1 ? (filled = true, [s, { v: val }]) : [s]));
  });
  parts = parts.filter(x => x !== "");
  return { nodes: parts.map(x => typeof x === "string" ? x : el("mark", { class: "slot", text: x.v })), plain: parts.map(x => typeof x === "string" ? x : x.v).join(""), filled };
}
const CHECK_KEY = "meal_checks_v1";
let checksSaved = (() => { const g = store.get(CHECK_KEY); try { return g.ok && g.raw ? JSON.parse(g.raw) || {} : {}; } catch (e) { return {}; } })();
function stageSection(s, k) {
  const appBody = el("div", { class: "app", id: "app-" + s.id });
  const left = el("div", { class: "col" }, [
    el("div", { class: "appframe" }, [
      el("div", { class: "appbar" }, [el("span", { class: "dot" }), el("span", { class: "dot" }), el("span", { class: "dot" }), el("span", { class: "fname", text: s.file })]),
      appBody
    ])
  ]);
  const right = el("div", { class: "col" });
  right.append(el("div", { class: "panel" }, [
    el("h3", { text: s.id === "s1" ? "이 앱에서 하는 일" : "앞 단계에 더한 것" }),
    el("ul", { class: "added" }, s.added.map(t => el("li", { text: t })))
  ]));
  if (s.prompts.length) {
    right.append(el("div", { class: "panel" }, [
      el("h3", {}, ["AI에게 한 요청 ", el("small", { text: "검토본의 프롬프트 원문" })]),
      ...s.prompts.map((p, i) => {
        const f = fillSlots(p.text);
        const b = el("button", { class: "btn small", type: "button", text: "복사" });
        b.addEventListener("click", () => copyText(f.plain, b));
        return el("div", { class: "prompt" }, [
          el("div", { class: "ph" }, [el("span", {}, [el("b", { class: "pn", text: "①②③④"[i] || "" }), " ", p.title, " ", el("span", { class: "who", text: p.who })]), b]),
          el("p", {}, f.nodes),
          f.filled ? el("div", { class: "slot-note" }, ["색칠한 부분은 ", el("a", { href: "lesson01.html#memo", text: "1차시 설계 메모" }), "에서 채웠습니다."]) : null
        ]);
      })
    ]));
  }
  right.append(el("div", { class: "panel" }, [
    el("h3", {}, ["확인할 것 ", el("small", { text: "직접 해 보며 체크" })]),
    el("ul", { class: "checks" }, s.checks.map((t, i) => {
      const id = `${s.id}-c${i}`;
      const box = el("input", { type: "checkbox", id, checked: !!checksSaved[id] });
      box.addEventListener("change", () => { checksSaved[id] = box.checked; store.set(CHECK_KEY, JSON.stringify(checksSaved)); });
      return el("li", {}, el("label", { for: id }, [box, el("span", { text: t })]));
    }))
  ]));
  if (s.code) right.append(el("div", { class: "panel" }, [
    el("details", {}, [el("summary", { text: s.id === "s6" ? "스프레드시트로 같은 집계 하기" : "핵심 코드 읽기" }), codeCopy(s.id === "s6" ? "수식과 순서" : "핵심 코드", s.code)])
  ]));
  const sec = el("section", { class: "stage", id: s.id }, [
    typeof k === "number" ? el("h2", { text: `${k}. ${s.name}` }) : el("h3", { class: "stage-h", text: `직접 해 보기: ${s.name}` }),
    el("div", { class: "row" }, s.tags.map(t => el("span", { class: "chip" + (t.startsWith("교원") ? " t" : ""), text: t }))),
    el("p", { class: "goal", text: s.goal }),
    el("div", { class: "grid" }, [left, right])
  ]);
  return { sec, run: () => APPS[s.id](appBody, left) };
}

// 본문 조각 (3-way로 집필한 차시 본문을 그린다)
function stepsBox(steps) {
  return el("ol", { class: "steps" }, steps.map(s => {
    const kids = [el("span", { class: "st", text: s.st }), el("p", { text: s.text })];
    if (s.prompt) {
      const f = fillSlots(s.prompt);
      const b = el("button", { class: "btn small", type: "button", text: "복사" });
      b.addEventListener("click", () => copyText(f.plain, b));
      kids.push(el("div", { class: "prompt" }, [
        el("div", { class: "ph" }, [el("span", { text: "AI에게 붙여 넣을 요청" }), b]),
        el("p", {}, f.nodes),
        f.filled ? el("div", { class: "slot-note" }, ["색칠한 부분은 ", el("a", { href: "lesson01.html#memo", text: "1차시 설계 메모" }), "에서 채웠습니다."]) : null
      ]));
    }
    return el("li", {}, kids);
  }));
}
function calloutBox(c) {
  const icon = { tip: "도움말", warn: "주의", check: "확인" }[c.kind] || "도움말";
  return el("div", { class: "callout " + (c.kind || "tip") }, [el("div", { class: "h" }, [el("span", { class: "ck", text: icon }), " ", c.title]), el("p", { text: c.text })]);
}
function quizBox(qs, lno) {
  return el("div", { class: "quiz" }, qs.map((q, qi) => {
    const out = el("div", { class: "qout", role: "status" });
    const opts = q.options.map((o, i) => {
      const b = el("button", { class: "opt", type: "button" }, [el("b", { text: "①②③④"[i] }), " ", o]);
      b.addEventListener("click", () => {
        opts.forEach((x, j) => { x.classList.toggle("right", j === q.answer); x.classList.toggle("wrong", j === i && i !== q.answer); });
        out.replaceChildren(el("div", { class: i === q.answer ? "okbox" : "alert" }, [i === q.answer ? "맞습니다. " : `정답은 ${"①②③④"[q.answer]}입니다. `, q.explain]));
      });
      return b;
    });
    return el("div", { class: "qitem" }, [el("p", { class: "qq" }, [el("b", { text: `문제 ${qi + 1}. ` }), q.q]), el("div", { class: "qopts" }, opts), out]);
  }));
}

// 활동지: 학생이 적은 내용은 이 브라우저에만 저장한다
const WS_KEY = "meal_ws_v1";
let wsSaved = (() => { const g = store.get(WS_KEY); try { return g.ok && g.raw ? JSON.parse(g.raw) || {} : {}; } catch (e) { return {}; } })();
function worksheetBox(lno, ai, fields) { // lno는 저장 키(학생 "3", 교원 "t3")
  return el("div", { class: "ws" }, [el("div", { class: "ws-h", text: "활동지" }), ...fields.map((f, i) => {
    const id = `ws-${lno}-${ai}-${i}`;
    const ta = el("textarea", { id, rows: "2", placeholder: f.placeholder || "" });
    ta.value = (wsSaved[lno] || {})[id] || "";
    ta.addEventListener("input", () => { (wsSaved[lno] = wsSaved[lno] || {})[id] = ta.value; store.set(WS_KEY, JSON.stringify(wsSaved)); });
    return el("div", { class: "field" }, [el("label", { for: id, text: f.label }), ta]);
  })]);
}
function revealBox(r) {
  return el("details", { class: "reveal" }, [el("summary", { text: (r.title || "교재가 확인한 값") + " (예측하고 확인한 뒤 펼치기)" }), el("p", { text: r.text })]);
}
function renderLesson(n, kind = "s") {
  const TR = TRACK[kind], LIST = TR.list();
  const l = LIST.find(x => x.no === n) || LIST[0];
  const K = TR.key(l.no);
  const c = TR.content().find(x => x.no === l.no) || null;
  document.title = `${kind === "t" ? "교원 연수 " : ""}${l.no}차시 ${l.title}, 급식 이상형 월드컵`;
  const prev = LIST.find(x => x.no === l.no - 1), next = LIST.find(x => x.no === l.no + 1);
  const runs = [];
  const stageFor = id => { const x = stageSection(STAGES.find(s => s.id === id), "nested"); runs.push(x.run); return x.sec; };

  const flow = l.no === 1
    ? el("div", { class: "tablewrap" }, el("table", {}, [
        el("thead", {}, el("tr", {}, ["활동", "할 일", "시간"].map((h, i) => el("th", { class: i === 2 ? "num" : null, text: h })))),
        el("tbody", {}, [["질문 열기", "급식과 선택 이야기", "5분"], ["월드컵 체험", "치킨 8강 선택", "10분"], ["결과 비교", "짝과 이유 비교", "8분"], ["주제 설계", "내 주제와 항목 만들기", "15분"], ["정리", "공유와 퇴장권", "7분"]]
          .map(r => el("tr", {}, r.map((x, i) => el("td", { class: i === 2 ? "num" : null, text: x })))))
      ]))
    : null;

  const body = [];
  if (c) {
    const tt = c.timetable && c.timetable.length
      ? el("div", { class: "tablewrap" }, el("table", { class: "timetable" }, [
          el("thead", {}, el("tr", {}, ["구성", "할 일", "시간"].map((h, i) => el("th", { class: i === 2 ? "num" : null, text: h })))),
          el("tbody", {}, [...c.timetable.map(r => el("tr", {}, [el("td", { text: r.part }), el("td", { text: r.what }), el("td", { class: "num", text: r.min + "분" })])),
            el("tr", { class: "sum" }, [el("td", { text: "합계" }), el("td", { text: "" }), el("td", { class: "num", text: c.timetable.reduce((s, r) => s + r.min, 0) + "분" })])])
        ]))
      : flow;
    body.push(el("h2", { text: "0. 왜 배우나" }), el("p", { class: "why", text: c.why }), tt);
    if (c.opening && c.opening.questions) body.push(el("div", { class: "opening" }, [
      el("div", { class: "goals-h", text: "수업을 여는 질문" }),
      el("ul", {}, c.opening.questions.map(q => el("li", { text: q }))),
      c.opening.expect ? el("details", { class: "tnote-in" }, [el("summary", { text: "교사용: 예상 답과 이어 갈 말" }), el("p", { text: c.opening.expect })]) : null
    ]));
    const placed = new Set();
    c.activities.forEach((a, i) => {
      body.push(el("h2", {}, [`${i + 1}. ${a.title}`, a.min ? el("span", { class: "min", text: `${a.min}분` }) : null]));
      if (a.steps && a.steps.length) body.push(stepsBox(a.steps));
      if (a.worksheet && a.worksheet.length) body.push(worksheetBox(K, i, a.worksheet));
      if (a.reveal) body.push(revealBox(a.reveal));
      if (a.callout) body.push(calloutBox(a.callout));
      if (a.app && l.stages.includes(a.app) && !placed.has(a.app)) { placed.add(a.app); body.push(stageFor(a.app)); }
    });
    l.stages.filter(id => !placed.has(id)).forEach(id => body.push(stageFor(id)));
    if (c.apply && c.apply.length) body.push(el("h2", { text: "수업으로 옮기기" }), stepsBox(c.apply.map((x, i) => ({ st: `${i + 1}. ${x.title}`, text: x.text }))));
    if (c.challenge && c.challenge.length) body.push(el("h2", { text: "도전 과제" }), el("p", { class: "muted", text: "활동을 일찍 마친 학생이 이어서 합니다." }), stepsBox(c.challenge.map((x, i) => ({ st: `도전 ${i + 1}. ${x.title}`, text: x.text, prompt: x.prompt }))));
    if (c.quiz && c.quiz.length) body.push(el("h2", { text: "확인 문제" }), quizBox(c.quiz, l.no));
    body.push(el("h2", { text: "오늘의 체크" }), el("ul", { class: "checklist" }, (c.check && c.check.length ? c.check : l.wrap).map(w => el("li", { text: w }))));
    const mine = el("div", { class: "mine" });
    const drawMine = () => {
      const filled = c.activities.flatMap((a, ai) => (a.worksheet || []).map((f, fi) => [f.label, ((wsSaved[K] || {})[`ws-${K}-${ai}-${fi}`] || "").trim()])).filter(x => x[1]);
      mine.replaceChildren(filled.length ? el("details", { class: "callout tip" }, [el("summary", { text: `내가 적은 활동지 모아 보기 (${filled.length}칸)` }), el("ul", {}, filled.map(([k, v]) => el("li", {}, [el("b", { text: k + ": " }), v])))]) : el("p", { class: "muted", text: "활동지에 적은 내용은 이 브라우저에만 저장되고, 여기에서 모아 볼 수 있습니다." }));
    };
    root.addEventListener("input", e => { if (e.target.closest && e.target.closest(".ws")) drawMine(); });
    drawMine(); body.push(mine);
    if (c.terms && c.terms.length) body.push(el("h2", { text: "오늘의 용어" }), el("div", { class: "tablewrap" }, el("table", { class: "glossary" }, [
      el("thead", {}, el("tr", {}, [el("th", { text: "용어" }), el("th", { text: "뜻" })])),
      el("tbody", {}, c.terms.map(x => el("tr", {}, [el("td", { class: "term", text: x.term }), el("td", { text: x.def })])))
    ])));
  } else {
    body.push(el("h2", { text: "0. 오늘의 흐름" }), flow, el("ol", { class: "flowline" }, l.flow.map(([t, s]) => el("li", { title: s, text: t }))));
    l.stages.forEach((id, i) => { const x = stageSection(STAGES.find(s => s.id === id), i + 1); runs.push(x.run); body.push(x.sec); });
    body.push(el("h2", { text: "오늘의 체크" }), el("ul", { class: "checklist" }, l.wrap.map(w => el("li", { text: w }))));
  }

  root.replaceChildren(
    topbar([TR.badge(l.no), ...l.teacher]),
    el("div", { class: "wrap" }, [el("main", { class: "lesson g" + (kind === "t" ? (l.group === 1 ? 4 : 5) : l.group) }, [
      el("span", { class: "eyebrow", text: `${kind === "t" ? "교원 연수, " : ""}${TR.label[l.group]}, ${l.no}차시` }),
      el("h1", { text: l.title }),
      el("div", { class: "under" }),
      el("div", { class: "goals" }, [el("div", { class: "goals-h", text: "오늘 배울 내용" }), el("ul", {}, l.goals.map(g => el("li", { text: g })))]),
      ...body,
      (l.teacherNotes.length || (c && c.teacher && c.teacher.length)) ? el("details", { class: "callout tnote" }, [el("summary", { text: "교사용: 준비, 점검, 진행 메모" }),
        el("ul", {}, l.teacherNotes.map(t => el("li", { text: t }))),
        c && c.teacher && c.teacher.length ? el("div", { class: "tablewrap", style: "margin-top:8px" }, el("table", { class: "glossary" }, [
          el("thead", {}, el("tr", {}, [el("th", { text: "학생이 막히는 지점" }), el("th", { text: "대응" })])),
          el("tbody", {}, c.teacher.map(x => el("tr", {}, [el("td", { text: x.issue }), el("td", { text: x.response })])))
        ])) : null]) : null,
      el("nav", { class: "pager", "aria-label": "차시 이동" }, [
        prev ? el("a", { class: "prev", href: TR.href(prev.no) }, [el("div", { class: "dir", text: "← 이전" }), el("div", { class: "tt", text: `${prev.no}차시. ${prev.title}` })]) : el("span"),
        next ? el("a", { class: "next", href: TR.href(next.no) }, [el("div", { class: "dir", text: "다음 →" }), el("div", { class: "tt", text: `${next.no}차시. ${next.title}` })]) : el("a", { class: "next", href: kind === "t" ? "index.html#teacher" : "index.html" }, [el("div", { class: "dir", text: "목차 →" }), el("div", { class: "tt", text: TR.back })])
      ])
    ]), footer()])
  );
  runs.forEach(r => r());
  const h = (location.hash || "").replace("#", "");
  if (h) { const t = document.getElementById(h); if (t) t.scrollIntoView(); }
}

/* ---------- 시작 ---------- */
if (root.dataset.page === "lesson") renderLesson(Number(root.dataset.lesson), "s");
else if (root.dataset.page === "tlesson") renderLesson(Number(root.dataset.lesson), "t");
else renderIndex();
})();