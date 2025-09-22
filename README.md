# トラック便表示システム

工場に入線するトラックの予定を表示・音声案内するための React + TypeScript 製アプリケーションです。管理 PC に設置した Apache から各モニタ PC へ配信し、クエリパラメーターでモニタごとの表示・音声設定を切り替えられます。Excel の入線予定表を JSON に変換するバッチスクリプトも付属しています。

## プロジェクト構成

```
.
├── config/                 # Excel 変換や表示設定用ファイル
│   └── excel-config.json
├── public/
│   ├── config/             # フロントエンド向け設定
│   │   └── monitor-config.json
│   └── data/               # 変換済み JSON（Apache で配信）
├── scripts/
│   └── convert-excel.ts    # Excel → JSON 変換スクリプト
├── src/                    # React + TypeScript フロントエンド
└── README.md
```

## セットアップ

```bash
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザーで `http://localhost:5173/delivery-schedule?monitor=1` にアクセスするとモニタ 1 向けの画面を確認できます。

## 本番ビルド

```bash
npm run build
```

生成物は `dist/` に出力されます。Apache などの Web サーバーで公開する際は `dist/` 以下をドキュメントルートに配置してください。

## モニタ表示の設定

`public/config/monitor-config.json` でモニタごとの設定を管理します。代表的な項目は以下の通りです。

| 項目 | 説明 |
| --- | --- |
| `id` | クエリーパラメーター `?monitor=` で指定する ID |
| `title` | 画面ヘッダーに表示するタイトル |
| `dataUrl` | 表示に利用する JSON ファイルの URL（Apache 配下のパス） |
| `hasAudio` | `true` の場合は音声案内を実行（モニタ PC②のようにスピーカー無しの場合は `false`） |
| `displayEntryCount` | メインセクションで表示する件数（既定値 1） |
| `speechFormat` | 音声案内のテンプレート。`{supplierReading}` や `{materialReading}` などのプレースホルダーを利用できます |
| `speechLang`, `speechRate`, `speechPitch` | Web Speech API の各パラメーター |

共通の音声テンプレートは `speechFormat`（トップレベル）で定義し、モニタ単位で上書きできます。既定値は「`{supplierReading}がにゅうせんします。{materialReading}のじゅんびをおねがいします。`」です。

## Excel → JSON 変換

1. Excel ファイルを管理 PC 上の所定フォルダーに配置します。
2. 以下のコマンドを実行します。

```bash
npm run convert -- --input data.xlsx --config config/excel-config.json --output public/data
```

- `--input`: 変換元 Excel ファイル（例: `data.xlsx`）
- `--config`: 列構成やシート設定を記述した JSON（既定: `config/excel-config.json`）
- `--output`: 変換結果を書き出すディレクトリー（Apache が配信できる場所）
- `--sheets`: カンマ区切りでシートキーを指定すると、そのシートのみ変換します（任意）。

### Excel 設定ファイル（`config/excel-config.json`）

```json
{
  "headerRows": 3,
  "terminationColumn": "arrivalTime",
  "twoSupplierJoiner": "　",
  "columns": {
    "number": "B",
    "arrivalTime": "C",
    "finishTime": "D",
    "supplierName": "E",
    "preparation": "F",
    "note": "G",
    "yard": "H",
    "lane": "I",
    "supplierReading": "J",
    "materialReading": "K"
  },
  "sheets": [
    {
      "key": "east",
      "sheetName": "東側時間順",
      "outputFile": "east.json"
    },
    {
      "key": "west",
      "sheetName": "西側時間順",
      "outputFile": "west.json"
    }
  ]
}
```

- `headerRows`: 見出し行の数（データ開始行は `headerRows` の次の行）
- `terminationColumn`: データ走査を続けるか判定する列（既定は入線時間列）。空欄に達すると変換を終了します。
- `twoSupplierJoiner`: 複数仕入先を結合する際に使用する区切り文字（既定は全角スペース）。
- `columns`: Excel 列と JSON フィールドの対応表。シート固有の列構成は `sheets[].columns` で上書きできます。
- `sheets[]`: 変換対象シート。`key` はモニタ設定や JSON の `meta.configKey` として利用されます。

### 2社同時入線の扱い

仕入先列（既定で E 列）が 2 行に分かれている場合、下段の入線時間セルは空欄になります。本スクリプトは同じ入線時間の下で仕入先名が続く限り自動的に検出し、全角スペースで結合したうえで 1 件の JSON エントリーとして書き出します。読み仮名（J 列、K 列）についても同様に結合され、音声案内に利用できます。

## 画面仕様

- ヘッダー: 紺色背景・白文字でタイトルと更新情報を表示。
- メイン: 黒背景。入線時間と仕入先名を橙色で、流動レーン・準備・置場を緑色で表示します。備考は白文字です。
- 水平線: メインとフッターの境界にグレーのラインを表示。
- フッター: 左側に橙色の○囲み「次」を配置し、次便の情報をひとまわり小さいフォントで表示します。
- 音声案内: `hasAudio` が `true` のモニタでは、最新の入線予定を Web Speech API で読み上げます。

## 配信構成例

1. 管理 PC に Apache をインストールし、本アプリをビルドした `dist/` と `public/` 配下の設定・データを配置。
2. モニタ PC①: `http://<管理PCホスト名>/delivery-schedule?monitor=1`
3. モニタ PC②: `http://<管理PCホスト名>/delivery-schedule?monitor=2`
4. モニタ PC③: `http://<管理PCホスト名>/delivery-schedule?monitor=3`

モニタ PC② は `hasAudio: false` のため音声案内は行われません。

## ライセンス

このリポジトリはサンプル実装として公開されています。社内システムへ導入する際は運用ルールに従い適宜調整してください。
