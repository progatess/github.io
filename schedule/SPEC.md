# スケジュール管理アプリ 仕様書

## 1. 概要
チーム/複数人で予定（カレンダーイベント）を共有し、その活動をダッシュボードで
可視化（BI）するためのスケジュール管理アプリ。GitHub Pages（静的サイト）上で動作する。

- 種別: クライアントサイド SPA（ビルド不要・バニラ JS / ES Modules）
- ホスティング: GitHub Pages（`<user>.github.io/schedule/`）
- 可視化: Chart.js
- 同期/共有: Firebase（Firestore + Authentication）。**未設定時は localStorage で単独動作**

## 2. ターゲットと目的
- 主利用者: チーム（複数メンバー）
- 目的: メンバー間で予定を共有・調整し、カテゴリ別の時間配分や予定の傾向を
  ダッシュボードで把握する。

## 3. 用語
| 用語 | 意味 |
|---|---|
| ワークスペース (workspace) | 共有の単位。同じ workspace ID のメンバーで予定を共有する |
| イベント (event) | 開始/終了時刻を持つ予定 |
| カテゴリ (category) | 予定の分類（色付き）。BI 集計の軸 |

## 4. データモデル
### Event
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 一意 ID |
| title | string | 予定名（必須） |
| start | ISO8601 string | 開始日時 |
| end | ISO8601 string | 終了日時 |
| allDay | boolean | 終日予定か |
| categoryId | string | カテゴリ参照 |
| location | string | 場所（任意） |
| notes | string | メモ（任意） |
| done | boolean | 完了フラグ（消化率の集計に使用） |
| createdBy | string | 作成者（メール/UID） |
| createdAt / updatedAt | ISO8601 | 監査用 |

### Category（既定）
仕事 / 勉強 / プライベート / 会議 / その他（各色付き）。追加・編集可。

## 5. 機能要件
### 5.1 カレンダー
- **月表示**: 6週グリッド。日セルに予定チップを表示。日クリックで新規作成。
- **週表示（メンバー × 曜日）**: 行＝メンバー（担当者）、列＝その週の7日。各セルに
  担当者の予定（時刻＋タイトル）を表示し、**一目で全員の週間予定を把握**できる。
  空きセルのクリックでその担当者・その日に新規作成。週内の合計件数を表示。
  土日列は色分け、未割り当ての予定は専用行に表示。
- 前/次/今日への移動、表示中の年月週ラベル。
- カテゴリによる色分けと、カテゴリ絞り込みフィルタ。

### 5.1b メンバー（担当者）
- 予定に担当者（memberId）を割り当て。週表示の行になる。
- メンバーの追加（週表示の「メンバーを追加」）、改名・削除（行名クリック）。
- 既定メンバーは `config.js` の `defaultMembers` で定義。

### 5.2 予定 CRUD
- モーダルで作成/編集/削除。タイトル・開始/終了・終日・カテゴリ・場所・メモ・完了。
- バリデーション（タイトル必須、終了 ≥ 開始）。

### 5.3 ダッシュボード（BI）
- 集計期間切替（今週 / 今月 / 全期間）。
- KPI カード: 予定件数 / 合計時間 / 完了率 / 平均予定時間。
- グラフ:
  1. カテゴリ別 時間配分（ドーナツ）
  1b. メンバー別 予定件数（横棒）
  2. 曜日別 予定件数（棒）
  3. 時間帯別 予定件数（棒, 0–23時）
  4. 直近8週の予定件数推移（折れ線）
  5. 完了 / 未完了（ドーナツ）

### 5.4 同期・共有・認証
- Firebase 設定あり: Google ログイン → Firestore でリアルタイム同期。
  同一 workspace のメンバーで予定共有。
- Firebase 設定なし: 自動で localStorage モードにフォールバック（単独動作）。
- ストレージ抽象化（`store.js`）で UI から保存先を隠蔽。

### 5.5 その他
- JSON エクスポート / インポート（バックアップ・端末間移行）。
- レスポンシブ（PC / スマホ）。

## 6. 非機能要件
- ビルド不要・依存は CDN のみ（Chart.js, Firebase）。
- 初回ロードでネットワーク不要（Firebase 未設定時）。
- アクセシビリティ: キーボード操作可能なモーダル、ARIA ラベル。

## 7. アーキテクチャ
```
schedule/
  index.html          画面の骨格
  css/style.css        スタイル
  js/
    config.js          Firebase設定 + workspace（ここを編集して同期を有効化）
    util.js            日付/DOM ユーティリティ
    store.js           保存抽象化（LocalStore / FirebaseStore）+ イベント通知
    calendar.js        月/週カレンダー描画
    dashboard.js       Chart.js による BI 描画
    app.js             エントリ。状態管理・モーダル・ビュー切替
```

## 8. クラウド同期の有効化手順（任意）
1. Firebase コンソールでプロジェクト作成 → Firestore と Authentication(Google) を有効化。
2. ウェブアプリを追加し、`firebaseConfig` を取得。
3. `js/config.js` の `firebaseConfig` を貼り替え、`workspaceId` をチームで共有する任意値に設定。
4. Firestore セキュリティルール例:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /workspaces/{ws}/events/{event} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   ※本番では workspace のメンバー制御を追加すること。

## 9. 将来拡張
- 予定への参加メンバー割当・空き時間提案。
- 繰り返し予定（RRULE）。
- Googleカレンダー双方向同期。
- workspace ごとのメンバー権限管理。
