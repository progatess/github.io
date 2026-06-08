// 日付・DOM 関連のユーティリティ

export const pad = (n) => String(n).padStart(2, "0");

// Date -> "YYYY-MM-DD"（ローカル時間）
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Date -> "YYYY-MM-DDTHH:mm"（datetime-local 入力用）
export const toLocalInput = (d) =>
  `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "YYYY-MM-DDTHH:mm" -> Date（ローカル時間）
export const fromLocalInput = (s) => new Date(s);

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

// 週の始まり（日曜）を返す
export const startOfWeek = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const sameDay = (a, b) => ymd(a) === ymd(b);

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 予定の長さ（時間）
export const durationHours = (ev) =>
  Math.max(0, (new Date(ev.end) - new Date(ev.start)) / 3.6e6);

// 表示用の時刻 "HH:mm"
export const hm = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "YYYY年M月" のような月ラベル
export const monthLabel = (d) => `${d.getFullYear()}年${d.getMonth() + 1}月`;

// 簡易ユニーク ID
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// 色の濃淡（カレンダーチップの背景用に薄くする）
export const tint = (hex, alpha = 0.15) => {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// DOM ヘルパ: el("div", {class:"x"}, [child, "text"])
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
