// =============================================================
// アプリ設定
// クラウド同期（チーム共有）を使う場合は、以下の firebaseConfig を
// あなたの Firebase プロジェクトの値に置き換えてください。
// 置き換えない（apiKey が空のまま）場合は、自動的に localStorage
// モード（この端末のみ・ログイン不要）で動作します。
// 詳しい手順は ../SPEC.md の「8. クラウド同期の有効化手順」を参照。
// =============================================================

export const firebaseConfig = {
  apiKey: "",            // ← Firebase の apiKey を貼り付けると同期が有効化されます
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// チームで共有する“部屋”の ID。同じ値を使うメンバー同士で予定を共有します。
export const workspaceId = "team-default";

// 既定カテゴリ（後からアプリ内で追加・編集可能）
export const defaultCategories = [
  { id: "work",     name: "仕事",         color: "#4f6df5" },
  { id: "study",    name: "勉強",         color: "#16a34a" },
  { id: "private",  name: "プライベート", color: "#f59e0b" },
  { id: "meeting",  name: "会議",         color: "#db2777" },
  { id: "other",    name: "その他",       color: "#64748b" },
];

// 既定メンバー（担当者）。週表示の各行になります。アプリ内で追加・改名・削除可能。
export const defaultMembers = [
  { id: "m_self", name: "自分",       color: "#4f6df5" },
  { id: "m_2",    name: "メンバー2",  color: "#16a34a" },
  { id: "m_3",    name: "メンバー3",  color: "#db2777" },
];

// Firebase の設定が入っているか
export const isCloudEnabled = Boolean(firebaseConfig.apiKey);
