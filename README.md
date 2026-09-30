# 日本市外局番クイズ — Signal Atlas

Wikimedia Commons の `Japan telephone code areas.svg` を元データに、3桁の日本の市外局番エリアを地図で当てるブラウザ完結型クイズです。

## 起動

```bash
pnpm install
pnpm extract       # 元SVGから public/data/areaData.json を再生成
pnpm validate:data # ラベル、source unit、path ID、matrix を検証
pnpm start         # http://localhost:3000
```

ブラウザで `http://localhost:3000` を開いてください。外部API、外部フォント、地図タイルには依存しません。

## 構成

- `public/source-map.svg` / `public/data/source-map.svg`: 同梱した準拠元SVG
- `scripts/extract-areas.mjs`: SVGの`kuiki`レイヤー、数字ラベル座標、ポリゴン形状、継承transformから動的にareaDataを抽出
- `public/data/areaData.json`: 生成済み59区画のメタデータと144個の一意なインラインSVG path
- `src/main.js`: 出題、ヒント、採点、ストリーク、正答率、学習モード
- `src/map.js`: インラインSVGの描画、クリック判定、ドラッグ・ズーム操作
- `src/styles.css`: レスポンシブなダーク／ライトUI

問題数はコードに固定せず、`areaData.json` の `areas.length` から動的に決まります。`03`、`06`、4桁・5桁局番の上位3桁表記も抽出データに含まれます。

## 出典

区画形状: [Wikimedia Commons — Japan telephone code areas.svg](https://commons.wikimedia.org/wiki/File:Japan_telephone_code_areas.svg)
