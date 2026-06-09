// 月表示・週表示のカレンダー描画

import {
  ymd, hm, sameDay, addDays, startOfWeek, startOfMonth, endOfMonth,
  WEEKDAYS, el, clear, tint, pad,
} from "./util.js";

// 指定日に重なる予定を抽出（終日含む）
function eventsOnDay(events, day) {
  const d = ymd(day);
  return events.filter((ev) => {
    const s = new Date(ev.start), e = new Date(ev.end);
    return ymd(s) <= d && d <= ymd(e);
  });
}

function colorOf(cats, id) {
  return (cats.find((c) => c.id === id) || { color: "#64748b" }).color;
}

// ---------------- 月表示 ----------------
function renderMonth(root, state, cb) {
  const { current, events, categories } = state;
  const first = startOfMonth(current);
  const gridStart = startOfWeek(first);
  const today = new Date();

  const wrap = el("div", { class: "month" });

  // 曜日ヘッダ
  const head = el("div", { class: "month-head" });
  WEEKDAYS.forEach((w, i) =>
    head.appendChild(el("div", { class: `dow dow-${i}` }, w)));
  wrap.appendChild(head);

  const body = el("div", { class: "month-grid" });
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    const inMonth = day.getMonth() === current.getMonth();
    const cell = el("div", {
      class: `day-cell${inMonth ? "" : " muted"}${sameDay(day, today) ? " today" : ""}`,
      onclick: (e) => { if (e.target.closest(".chip")) return; cb.onDayClick(day); },
    });
    cell.appendChild(el("div", { class: "day-num" }, String(day.getDate())));

    const dayEvents = eventsOnDay(events, day)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const list = el("div", { class: "chips" });
    dayEvents.slice(0, 4).forEach((ev) => {
      const color = colorOf(categories, ev.categoryId);
      const chip = el("div", {
        class: `chip${ev.done ? " done" : ""}`,
        style: `background:${tint(color, .16)};border-left:3px solid ${color}`,
        title: ev.title,
        onclick: () => cb.onEventClick(ev),
      }, [
        el("span", { class: "chip-time" }, ev.allDay ? "終日" : hm(ev.start)),
        el("span", { class: "chip-title" }, ev.title),
      ]);
      list.appendChild(chip);
    });
    if (dayEvents.length > 4)
      list.appendChild(el("div", { class: "more" }, `+${dayEvents.length - 4} 件`));
    cell.appendChild(list);
    body.appendChild(cell);
  }
  wrap.appendChild(body);
  root.appendChild(wrap);
}

// 指定メンバー・指定日に重なる予定（終日含む）
function eventsForMemberDay(events, day, memberId) {
  const d = ymd(day);
  return events.filter((ev) => {
    const evMember = ev.memberId || null;
    if (evMember !== memberId) return false;
    const s = new Date(ev.start), e = new Date(ev.end);
    return ymd(s) <= d && d <= ymd(e);
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

// ---------------- 週表示（メンバー × 曜日 グリッド） ----------------
function renderWeek(root, state, cb) {
  const { current, events, categories, members } = state;
  const weekStart = startOfWeek(current);
  const weekEnd = addDays(weekStart, 7);
  const today = new Date();

  // この週に重なる予定だけ対象
  const weekEvents = events.filter((ev) => {
    const s = new Date(ev.start), e = new Date(ev.end);
    return e >= weekStart && s < weekEnd;
  });

  // 行＝メンバー。未割り当ての予定があれば末尾に専用行を追加
  const rows = members.slice();
  if (weekEvents.some((ev) => !ev.memberId))
    rows.push({ id: null, name: "未割り当て", color: "#94a3b8" });

  const wrap = el("div", { class: "wres" });

  // 件数キャプション
  wrap.appendChild(el("div", { class: "wres-caption" }, `${weekEvents.length} 件`));

  const scroll = el("div", { class: "wres-scroll" });
  const grid = el("div", { class: "wres-grid" });

  // ヘッダ行
  grid.appendChild(el("div", { class: "wres-corner" }, "メンバー"));
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const cls = `wres-dayhead dow-${i}${sameDay(day, today) ? " today" : ""}`;
    grid.appendChild(el("div", { class: cls }, [
      el("span", { class: "wd-name" }, WEEKDAYS[i]),
      el("span", { class: "wd-date" }, `${day.getMonth() + 1}/${day.getDate()}`),
    ]));
  }

  // メンバー行
  rows.forEach((m) => {
    grid.appendChild(el("div", {
      class: "wres-member",
      title: m.id ? "クリックで編集" : "",
      onclick: () => { if (m.id) cb.onEditMember(m); },
    }, [
      el("span", { class: "dot", style: `background:${m.color || "#64748b"}` }),
      el("span", { class: "mname" }, m.name),
    ]));

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const weekend = i === 0 || i === 6;
      const cell = el("div", {
        class: `wres-cell${weekend ? " weekend" : ""}${sameDay(day, today) ? " today" : ""}`,
        onclick: (e) => {
          if (e.target.closest(".rev")) return;
          const d = new Date(day); d.setHours(9, 0, 0, 0);
          cb.onSlotClick(d, m.id);
        },
      });
      eventsForMemberDay(weekEvents, day, m.id).forEach((ev) => {
        const color = colorOf(categories, ev.categoryId);
        cell.appendChild(el("div", {
          class: `rev${ev.done ? " done" : ""}`,
          style: `background:${tint(color, .16)};border-left:3px solid ${color}`,
          title: ev.title,
          onclick: () => cb.onEventClick(ev),
        }, [
          el("div", { class: "rev-time" },
            ev.allDay ? "終日" : `${hm(ev.start)} - ${hm(ev.end)}`),
          el("div", { class: "rev-title" }, ev.title),
        ]));
      });
      grid.appendChild(cell);
    }
  });

  scroll.appendChild(grid);
  wrap.appendChild(scroll);

  // メンバー追加
  wrap.appendChild(el("button", {
    class: "add-member", onclick: () => cb.onAddMember(),
  }, [el("span", { class: "fa fa-user-plus" }), " メンバーを追加"]));

  root.appendChild(wrap);
}

export function renderCalendar(root, state, cb) {
  clear(root);
  if (state.view === "week") renderWeek(root, state, cb);
  else renderMonth(root, state, cb);
}
