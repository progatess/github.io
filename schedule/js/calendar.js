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

// ---------------- 週表示（24h タイムグリッド） ----------------
function renderWeek(root, state, cb) {
  const { current, events, categories } = state;
  const weekStart = startOfWeek(current);
  const today = new Date();
  const HOUR_H = 44; // 1時間の高さ(px)

  const wrap = el("div", { class: "week" });

  // ヘッダ（曜日＋日付）
  const head = el("div", { class: "week-head" });
  head.appendChild(el("div", { class: "time-gutter" }, ""));
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    head.appendChild(el("div", {
      class: `week-day-head${sameDay(day, today) ? " today" : ""}`,
    }, [
      el("span", { class: "wd-name" }, WEEKDAYS[i]),
      el("span", { class: "wd-date" }, `${day.getMonth() + 1}/${day.getDate()}`),
    ]));
  }
  wrap.appendChild(head);

  const scroll = el("div", { class: "week-scroll" });
  const grid = el("div", { class: "week-grid", style: `--hour-h:${HOUR_H}px` });

  // 時間軸
  const gutter = el("div", { class: "time-gutter-col" });
  for (let h = 0; h < 24; h++)
    gutter.appendChild(el("div", { class: "time-label", style: `height:${HOUR_H}px` },
      `${pad(h)}:00`));
  grid.appendChild(gutter);

  // 各日カラム
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const col = el("div", { class: "day-col" });
    for (let h = 0; h < 24; h++) {
      col.appendChild(el("div", {
        class: "hour-slot", style: `height:${HOUR_H}px`,
        onclick: (e) => {
          if (e.target.closest(".wevent")) return;
          const d = new Date(day); d.setHours(h, 0, 0, 0);
          cb.onSlotClick(d);
        },
      }));
    }
    // この日の時間指定予定を配置
    const dayEvents = events.filter((ev) => !ev.allDay && sameDay(new Date(ev.start), day));
    dayEvents.forEach((ev) => {
      const s = new Date(ev.start), e = new Date(ev.end);
      const top = (s.getHours() + s.getMinutes() / 60) * HOUR_H;
      const endH = sameDay(e, day) ? e.getHours() + e.getMinutes() / 60 : 24;
      const height = Math.max(22, (endH - (s.getHours() + s.getMinutes() / 60)) * HOUR_H);
      const color = colorOf(categories, ev.categoryId);
      col.appendChild(el("div", {
        class: `wevent${ev.done ? " done" : ""}`,
        style: `top:${top}px;height:${height}px;background:${tint(color, .18)};border-left:3px solid ${color}`,
        onclick: () => cb.onEventClick(ev),
      }, [
        el("div", { class: "we-title" }, ev.title),
        el("div", { class: "we-time" }, `${hm(ev.start)}–${hm(ev.end)}`),
      ]));
    });
    grid.appendChild(col);
  }
  scroll.appendChild(grid);
  wrap.appendChild(scroll);
  root.appendChild(wrap);

  // 8時あたりまでスクロール
  requestAnimationFrame(() => { scroll.scrollTop = 7 * HOUR_H; });
}

export function renderCalendar(root, state, cb) {
  clear(root);
  if (state.view === "week") renderWeek(root, state, cb);
  else renderMonth(root, state, cb);
}
