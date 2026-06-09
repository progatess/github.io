// ダッシュボード（BI）。Chart.js（window.Chart）を使用。

import { durationHours, WEEKDAYS, startOfWeek, startOfMonth, addDays, el, clear } from "./util.js";

let charts = [];
function destroyCharts() { charts.forEach((c) => c.destroy()); charts = []; }

// 期間でフィルタ
function filterByRange(events, range) {
  const now = new Date();
  if (range === "all") return events;
  const from = range === "week" ? startOfWeek(now) : startOfMonth(now);
  const to = range === "week" ? addDays(from, 7) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return events.filter((ev) => {
    const s = new Date(ev.start);
    return s >= from && s < to;
  });
}

const fmtH = (h) => (h >= 10 ? h.toFixed(0) : h.toFixed(1));

function kpiCard(label, value, sub) {
  return el("div", { class: "kpi" }, [
    el("div", { class: "kpi-value" }, value),
    el("div", { class: "kpi-label" }, label),
    sub ? el("div", { class: "kpi-sub" }, sub) : null,
  ]);
}

export function renderDashboard(root, state) {
  destroyCharts();
  clear(root);
  const { categories } = state;
  const range = state.range || "month";
  const events = filterByRange(state.events, range);

  // ---- 期間切替 ----
  const ranges = [["week", "今週"], ["month", "今月"], ["all", "全期間"]];
  const switcher = el("div", { class: "range-switch" },
    ranges.map(([v, lbl]) => el("button", {
      class: `range-btn${range === v ? " active" : ""}`,
      onclick: () => { state.range = v; renderDashboard(root, state); },
    }, lbl)));
  root.appendChild(el("div", { class: "dash-head" }, [
    el("h2", {}, "ダッシュボード"), switcher,
  ]));

  // ---- KPI ----
  const total = events.length;
  const totalH = events.reduce((s, e) => s + (e.allDay ? 0 : durationHours(e)), 0);
  const doneN = events.filter((e) => e.done).length;
  const rate = total ? Math.round((doneN / total) * 100) : 0;
  const avgH = total ? totalH / total : 0;

  root.appendChild(el("div", { class: "kpi-row" }, [
    kpiCard("予定件数", String(total), `${range === "week" ? "今週" : range === "month" ? "今月" : "全期間"}`),
    kpiCard("合計時間", `${fmtH(totalH)}h`, "時間指定の合計"),
    kpiCard("完了率", `${rate}%`, `${doneN}/${total} 件`),
    kpiCard("平均予定時間", `${fmtH(avgH)}h`, "1件あたり"),
  ]));

  if (total === 0) {
    root.appendChild(el("div", { class: "empty" }, "この期間の予定はまだありません。"));
    return;
  }

  // ---- グラフ群 ----
  const grid = el("div", { class: "chart-grid" });
  const mkCanvas = (title, wide) => {
    const card = el("div", { class: `chart-card${wide ? " wide" : ""}` },
      [el("h3", {}, title)]);
    const canvas = document.createElement("canvas");
    card.appendChild(canvas);
    grid.appendChild(card);
    return canvas;
  };

  // 1. カテゴリ別 時間配分
  const byCat = {};
  events.forEach((e) => {
    byCat[e.categoryId] = (byCat[e.categoryId] || 0) + (e.allDay ? 0 : durationHours(e));
  });
  const catEntries = categories.filter((c) => byCat[c.id]);
  const c1 = mkCanvas("カテゴリ別 時間配分");
  charts.push(new Chart(c1, {
    type: "doughnut",
    data: {
      labels: catEntries.map((c) => c.name),
      datasets: [{ data: catEntries.map((c) => +byCat[c.id].toFixed(1)),
        backgroundColor: catEntries.map((c) => c.color), borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: "bottom" } }, cutout: "60%" },
  }));

  // 1b. メンバー別 予定件数
  const members = state.members || [];
  if (members.length) {
    const byMember = {};
    events.forEach((e) => { const k = e.memberId || "_un"; byMember[k] = (byMember[k] || 0) + 1; });
    const labels = members.map((m) => m.name);
    const vals = members.map((m) => byMember[m.id] || 0);
    const colors = members.map((m) => m.color || "#4f6df5");
    if (byMember["_un"]) { labels.push("未割り当て"); vals.push(byMember["_un"]); colors.push("#94a3b8"); }
    const cm = mkCanvas("メンバー別 予定件数", true);
    charts.push(new Chart(cm, {
      type: "bar",
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderRadius: 6 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } },
    }));
  }

  // 2. 曜日別 予定件数
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  events.forEach((e) => { byDow[new Date(e.start).getDay()]++; });
  const c2 = mkCanvas("曜日別 予定件数");
  charts.push(new Chart(c2, {
    type: "bar",
    data: { labels: WEEKDAYS, datasets: [{ data: byDow, backgroundColor: "#4f6df5", borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } },
  }));

  // 3. 時間帯別 予定件数
  const byHour = new Array(24).fill(0);
  events.forEach((e) => { if (!e.allDay) byHour[new Date(e.start).getHours()]++; });
  const c3 = mkCanvas("時間帯別 予定件数");
  charts.push(new Chart(c3, {
    type: "bar",
    data: {
      labels: byHour.map((_, h) => `${h}`),
      datasets: [{ data: byHour, backgroundColor: "#16a34a", borderRadius: 4 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: "時" } }, y: { ticks: { precision: 0 } } },
    },
  }));

  // 4. 直近8週の予定件数推移（範囲に関わらず全データから）
  const weeks = [];
  const base = startOfWeek(new Date());
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(base, -7 * i);
    const we = addDays(ws, 7);
    const n = state.events.filter((e) => {
      const s = new Date(e.start); return s >= ws && s < we;
    }).length;
    weeks.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, n });
  }
  const c4 = mkCanvas("直近8週の予定件数推移", true);
  charts.push(new Chart(c4, {
    type: "line",
    data: {
      labels: weeks.map((w) => w.label),
      datasets: [{
        data: weeks.map((w) => w.n), borderColor: "#db2777",
        backgroundColor: "rgba(219,39,119,.12)", fill: true, tension: .35,
        pointRadius: 4, pointBackgroundColor: "#db2777",
      }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } },
  }));

  // 5. 完了 / 未完了
  const c5 = mkCanvas("完了 / 未完了");
  charts.push(new Chart(c5, {
    type: "doughnut",
    data: {
      labels: ["完了", "未完了"],
      datasets: [{ data: [doneN, total - doneN], backgroundColor: ["#16a34a", "#e2e8f0"], borderWidth: 0 }],
    },
    options: { plugins: { legend: { position: "bottom" } }, cutout: "60%" },
  }));

  root.appendChild(grid);
}
