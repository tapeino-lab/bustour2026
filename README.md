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

## 顔写真の差し替え

1. 画像（正方形推奨）を `public/faces/` に置く（例: `public/faces/elephant.png`）。
2. `src/faces.ts` の `FACE_IMAGES` に `elephant: 'faces/elephant.png'` のように追加する。

どうぶつの ID は `src/pieces.ts` を参照。登録がないものはダミーの顔が表示されます。
