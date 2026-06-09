// エントリーポイント：状態管理・ビュー切替・モーダル・認証・入出力

import { createStore } from "./store.js";
import { renderCalendar } from "./calendar.js";
import { renderDashboard } from "./dashboard.js";
import {
  el, clear, ymd, toLocalInput, fromLocalInput, addDays, addMonths,
  startOfWeek, monthLabel, WEEKDAYS,
} from "./util.js";
import { workspaceId, isCloudEnabled } from "./config.js";

const store = createStore();

const state = {
  view: "month",       // month | week | dashboard
  current: new Date(),
  range: "month",      // dashboard 用
  events: [],
  categories: [],
  members: [],
  filter: new Set(),   // 非表示にするカテゴリ ID
  user: null,
};

const $ = (id) => document.getElementById(id);

// ---------------- レンダリング ----------------
function visibleEvents() {
  return state.events.filter((e) => !state.filter.has(e.categoryId));
}

function render() {
  // ラベル更新
  let label = "";
  if (state.view === "week") {
    const ws = startOfWeek(state.current);
    const we = addDays(ws, 6);
    label = `${ws.getFullYear()}年 ${ws.getMonth() + 1}/${ws.getDate()} – ${we.getMonth() + 1}/${we.getDate()}`;
  } else if (state.view === "month") {
    label = monthLabel(state.current);
  } else {
    label = "分析";
  }
  $("period-label").textContent = label;

  // ナビ表示制御
  $("nav-group").style.visibility = state.view === "dashboard" ? "hidden" : "visible";
  $("filter-bar").style.display = state.view === "dashboard" ? "none" : "flex";

  // ビュー切替ボタンの active
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === state.view));

  const main = $("view");
  if (state.view === "dashboard") {
    renderDashboard(main, state);
  } else {
    renderCalendar(main, { ...state, events: visibleEvents() }, {
      onDayClick: (day) => openModal(null, day),
      onSlotClick: (dt, memberId) => openModal(null, dt, memberId),
      onEventClick: (ev) => openModal(ev),
      onAddMember: addMember,
      onEditMember: editMember,
    });
  }
}

function renderFilterBar() {
  const bar = $("filter-bar");
  clear(bar);
  state.categories.forEach((c) => {
    const active = !state.filter.has(c.id);
    bar.appendChild(el("button", {
      class: `cat-pill${active ? " active" : ""}`,
      style: active ? `--c:${c.color}` : "",
      onclick: () => {
        if (state.filter.has(c.id)) state.filter.delete(c.id);
        else state.filter.add(c.id);
        renderFilterBar(); render();
      },
    }, [
      el("span", { class: "dot", style: `background:${c.color}` }),
      c.name,
    ]));
  });
}

// ---------------- モーダル ----------------
let editingId = null;

function openModal(ev = null, presetDate = null, presetMember = null) {
  editingId = ev ? ev.id : null;
  $("modal-title").textContent = ev ? "予定を編集" : "予定を追加";
  $("f-title").value = ev ? ev.title : "";
  $("f-cat").innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  $("f-cat").value = ev ? ev.categoryId : state.categories[0]?.id;

  // 担当者
  $("f-member").innerHTML = state.members
    .map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
  $("f-member").value = ev ? (ev.memberId || state.members[0]?.id)
    : (presetMember || state.members[0]?.id);

  let start, end;
  if (ev) { start = new Date(ev.start); end = new Date(ev.end); }
  else {
    start = presetDate ? new Date(presetDate) : new Date();
    if (!presetDate) start.setMinutes(0, 0, 0);
    else if (start.getHours() === 0 && start.getMinutes() === 0) start.setHours(9);
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  $("f-start").value = toLocalInput(start);
  $("f-end").value = toLocalInput(end);
  $("f-allday").checked = ev ? !!ev.allDay : false;
  $("f-location").value = ev ? (ev.location || "") : "";
  $("f-notes").value = ev ? (ev.notes || "") : "";
  $("f-done").checked = ev ? !!ev.done : false;
  $("btn-delete").style.display = ev ? "inline-flex" : "none";
  $("f-error").textContent = "";

  $("modal").classList.add("open");
  setTimeout(() => $("f-title").focus(), 50);
}

function closeModal() { $("modal").classList.remove("open"); editingId = null; }

async function saveModal() {
  const title = $("f-title").value.trim();
  const start = fromLocalInput($("f-start").value);
  const end = fromLocalInput($("f-end").value);
  if (!title) { $("f-error").textContent = "タイトルを入力してください。"; return; }
  if (!$("f-start").value || !$("f-end").value) { $("f-error").textContent = "開始・終了を入力してください。"; return; }
  if (end < start) { $("f-error").textContent = "終了は開始以降にしてください。"; return; }

  const data = {
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: $("f-allday").checked,
    categoryId: $("f-cat").value,
    memberId: $("f-member").value,
    location: $("f-location").value.trim(),
    notes: $("f-notes").value.trim(),
    done: $("f-done").checked,
  };
  try {
    if (editingId) await store.updateEvent(editingId, data);
    else await store.addEvent(data);
    closeModal();
  } catch (e) {
    $("f-error").textContent = "保存に失敗しました: " + e.message;
  }
}

async function deleteEvent() {
  if (!editingId) return;
  if (!confirm("この予定を削除しますか？")) return;
  await store.deleteEvent(editingId);
  closeModal();
}

// ---------------- メンバー管理 ----------------
async function addMember() {
  const name = prompt("追加するメンバーの名前");
  if (!name || !name.trim()) return;
  const palette = ["#4f6df5", "#16a34a", "#db2777", "#f59e0b", "#0ea5e9", "#9333ea", "#dc2626", "#0d9488"];
  const members = state.members.slice();
  const color = palette[members.length % palette.length];
  members.push({ id: "m_" + Date.now().toString(36), name: name.trim(), color });
  await store.saveMembers(members);
}

async function editMember(member) {
  const name = prompt("メンバー名を編集（空欄で削除）", member.name);
  if (name === null) return; // キャンセル
  let members = state.members.slice();
  if (!name.trim()) {
    if (!confirm(`「${member.name}」を削除しますか？（割り当て済みの予定は「未割り当て」になります）`)) return;
    members = members.filter((m) => m.id !== member.id);
  } else {
    members = members.map((m) => (m.id === member.id ? { ...m, name: name.trim() } : m));
  }
  await store.saveMembers(members);
}

// ---------------- 認証 UI ----------------
function renderAuth() {
  const box = $("auth-box");
  clear(box);
  box.appendChild(el("span", { class: "ws-badge", title: "ワークスペース" },
    [el("span", { class: "fa fa-users" }), ` ${workspaceId}`]));

  if (!isCloudEnabled) {
    box.appendChild(el("span", { class: "mode-badge local" }, "ローカル保存"));
    return;
  }
  if (state.user) {
    box.appendChild(el("span", { class: "user-name" }, state.user.name));
    box.appendChild(el("button", { class: "btn-ghost", onclick: () => store.signOut() }, "ログアウト"));
  } else {
    box.appendChild(el("button", { class: "btn-primary sm", onclick: () => store.signIn() },
      [el("span", { class: "fa fa-google" }), " Googleでログイン"]));
  }
}

// ---------------- 入出力 ----------------
function exportJSON() {
  const data = { workspaceId, exportedAt: new Date().toISOString(),
    categories: state.categories, members: state.members, events: state.events };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob),
    download: `schedule-${ymd(new Date())}.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

function importJSON() {
  const input = el("input", { type: "file", accept: "application/json" });
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm("読み込むと既存データに追加/置換されます。続行しますか？")) return;
      await store.importData(data);
    } catch (e) { alert("読み込みに失敗しました: " + e.message); }
  };
  input.click();
}

// ---------------- ナビゲーション ----------------
function navigate(dir) {
  if (state.view === "week") state.current = addDays(state.current, dir * 7);
  else state.current = addMonths(state.current, dir);
  render();
}

function setView(view) { state.view = view; render(); }

// ---------------- 初期化 ----------------
function bindUI() {
  $("btn-prev").onclick = () => navigate(-1);
  $("btn-next").onclick = () => navigate(1);
  $("btn-today").onclick = () => { state.current = new Date(); render(); };
  $("btn-new").onclick = () => openModal();
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.onclick = () => setView(b.dataset.view));
  $("btn-export").onclick = exportJSON;
  $("btn-import").onclick = importJSON;

  // モーダル
  $("btn-save").onclick = saveModal;
  $("btn-cancel").onclick = closeModal;
  $("btn-delete").onclick = deleteEvent;
  $("modal-backdrop").onclick = closeModal;
  $("f-allday").onchange = (e) => {
    const off = e.target.checked;
    $("f-start").type = off ? "date" : "datetime-local";
    $("f-end").type = off ? "date" : "datetime-local";
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("modal").classList.contains("open")) closeModal();
  });
}

async function main() {
  bindUI();
  state.categories = store.getCategories?.() || [];
  state.members = store.getMembers?.() || [];

  store.on("change", () => {
    state.events = store.getEvents();
    state.categories = store.getCategories();
    state.members = store.getMembers();
    renderFilterBar();
    render();
  });
  store.on("auth", (user) => { state.user = user; renderAuth(); render(); });
  store.on("error", () => {
    $("view").innerHTML =
      '<div class="empty">クラウド接続でエラーが発生しました。ログイン状態と Firestore のルールを確認してください。</div>';
  });

  await store.init();
  state.events = store.getEvents();
  state.categories = store.getCategories();
  state.members = store.getMembers();
  renderAuth();
  renderFilterBar();
  render();
}

main();
