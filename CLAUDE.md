# あおやまなしバスタワー2026 — 開発メモ（Claude 向け）

スマホ向けの積み上げゲーム。Vite + TypeScript + planck.js（物理）+ Canvas。
main に push すると GitHub Actions で GitHub Pages に自動公開される
（https://tapeino-lab.github.io/bustour2026/）。

## 作業ルール（必ず守る）

- **常に日本語で返答する。**
- 相談・計画の段階ではファイルを変更しない。変更は明確な指示があってから。
- 変更のたびにバージョンのパッチ番号を上げる（例 1.0.11 → 1.0.12）。
  - `package.json` と `package-lock.json`（2か所）を書き換える。画面表示は package.json から自動で出る。
  - 「安定版」と言われたらマイナー番号を上げてパッチを 00 にする（例 1.0.xx → 1.1.00）。
- lint とテストが通ってからコミットする。確認していない変更は push しない。
- コミットメッセージは英語1行。main に直接 push する（`git push -u origin main`）。
- **API キーやパスワードはコミットしない。**
- 変更した返答の最後に、次の4つを書く。
  - 変更内容
  - バージョン番号
  - コミットハッシュ
  - コミットメッセージ
- Canvas にカスタムフォント（Dela Gothic One）で文字を描くときは、フォントの読み込み完了を確認してから描く（`src/fonts.ts` の `waitForFont`）。
- 作業を始める前に `git pull origin main` で他セッションの更新を取り込む。

## コマンド

```sh
npm ci                 # 依存のインストール
npm run lint           # eslint + 型チェック
npm test               # ゲームのテスト（vitest）
npm run test:rules     # Firestore ルールのテスト（エミュレータ。Java が必要）
VITE_BASE_PATH=/bustour2026/ npm run build   # 本番と同じ設定でビルド
npm run dev            # 開発サーバー
```

push 前に必ず実行するもの：
- lint
- test
- build
- `firestore.rules` を変えたときは test:rules

## 公開リポジトリに入れないもの（プライバシー・著作権）

このリポジトリは公開されている。次のものは**絶対にコミットしない**。

- 顔写真
- しげみ（人物）の写真
- BGM（著作権あり）

これらは Firebase Firestore に置き、メンバー（参加コードを入れた端末）だけが読める。

- アップロードは管理ページ（`?admin=1` を付けて、管理者端末で開く）から行う。
- 写真は「ひょうじ」スイッチを ON にしたものだけメンバーに見える。
- 写真の形式：顔写真は正方形の JPEG。切り抜き写真（`sprite` があるオブジェクト、例：しげみ）は透過を残した PNG。
- 写真が無いあいだは、ダミーの顔または灰色のシルエットで表示される。

Firebase の設定（`src/online.ts` の firebaseOptions）は公開して問題ない値。秘密の鍵ではない。

## Firestore

- コレクション構成とアクセス権は `firestore.rules` の冒頭コメントを参照する。
- **`firestore.rules` を変えたら、ユーザーに「Firebase コンソール → Firestore Database → ルール に貼り直して公開」するよう必ず案内する。** push してもルールは自動で反映されない。
- 参加コード（config/join）と管理者（admins/{uid}）はコンソールでのみ設定する。

## 作りの注意点

- オブジェクト定義は `src/pieces.ts`。
  - 全体に PIECE_SCALE 0.88 がかかる。
  - 柔らかいオブジェクト（うーぱーるーぱー）は複数のパーツを関節でつないでいる。着地して落ち着くと1つの剛体にまとめる（`freeze`）。
- ランキングの「タワー再現画像」は、各パーツの位置と角度を文字列で保存している（`src/tower.ts`）。
  - **オブジェクトのパーツ数や構成を変えると、過去の記録が正しく描けなくなる。** そのときは `src/tower.ts` の `LEGACY_SEGMENTS` に、古い構成からの読み替えを追加する。
  - オブジェクトの id を変えたり消したりすると、古い記録が読めなくなる。
- 更新は `version.json` で検知する（`src/update.ts`）。プレイ中には再読み込みせず、自然なタイミングでだけ更新する。
- 確認用表示（デバッグ）は `?debug=1`、または管理者端末で `?admin=1` のときだけ出す。
- Firefox ではちらつき対策で CPU 描画の canvas を使う。
- 見た目を確認するときは、開発サーバーと Playwright（Chromium はインストール済み）でスクリーンショットを撮る。
