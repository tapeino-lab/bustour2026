# やまなしバスタワー

スマホ向けの、どうぶつを積み上げる物理パズル（一人用）。

公開先: https://tapeino-lab.github.io/bustour2026/

## 遊び方

- 指で左右に動かし、離すと落ちる。下の「かいてん」ボタンか、動かしている途中にもう1本の指で画面に触れると45°回転。
- 動かしている途中に「かいてん」ボタンの上で指を離すと、落とさずにキャンセル。
- 1個目と、10・20・30…個目にバスが来る。
- 1つでも台から落ちたらゲームオーバー。スコアは積めた数。

## 開発

```sh
npm ci
npm run dev    # 開発サーバー
npm run lint   # ESLint と型チェック
npm test       # Vitest
npm run build  # dist/ に出力
```

main に push すると GitHub Actions（.github/workflows/deploy.yml）で GitHub Pages に公開されます。

物理演算は planck.js（Box2D 系）。

### 更新の反映

ビルド時に `version.json`（package.json のバージョン）を一緒に公開します。遊んでいる端末はゲームオーバーのたびにこれを確認し、新しいバージョンが出ていれば「もういちど」を押したときに新しい版を読み込み直します（`?v=バージョン` を付けてキャッシュを避けます）。

## 顔写真（参加コードで見られる）

顔写真は**このリポジトリには入れません**（公開リポジトリのため）。Firebase（Firestore）に保存し、参加コードを入力した端末だけが見られます。

- 端末は匿名ログインし、正しい参加コードを入れると `members/{uid}` が作られてメンバーになります（判定は Firestore ルール側。コードの答えはゲームのコードに含まれません）。
- 顔写真は `faces/{どうぶつID}` に 160×160 の JPEG（data URL）で保存。メンバーだけが読め、管理者だけが書けます。
- 管理者は `?admin=1` を付けて開くと「かお とうろく」画面が出ます。表示される ID を Firestore の `admins/{ID}` に登録すると、写真を登録できます。
- ルールは `firestore.rules`。`npm run test:rules` でエミュレーター上のテストを実行（Java が必要）。
- Firebase の設定値は GitHub Secrets（`FIREBASE_API_KEY` / `FIREBASE_AUTH_DOMAIN` / `FIREBASE_PROJECT_ID` / `FIREBASE_APP_ID`）からビルド時に渡します。未設定ならダミーの顔で動きます。
- ローカルでエミュレーターを使う場合は `VITE_FIREBASE_EMULATOR=1` と各 `VITE_FIREBASE_*` を付けて `npm run dev`。

どうぶつの ID は `src/pieces.ts` を参照。
