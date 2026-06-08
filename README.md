# github.io

## Teamスケジュール（スケジュール管理アプリ）
チームで予定を共有し、ダッシュボードで可視化（BI）するスケジュール管理アプリ。

- アプリ: [`/schedule/`](./schedule/)（GitHub Pages では `https://<user>.github.io/schedule/`）
- 仕様書: [`schedule/SPEC.md`](./schedule/SPEC.md)
- 既定では **localStorage** で即動作。`schedule/js/config.js` に Firebase 設定を入れると
  **クラウド同期・Googleログイン・チーム共有** が有効化されます。
