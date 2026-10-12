# SNSQuizLocker

SNS を見すぎないための Chrome 拡張機能です。
対象SNSを開くと画面がオーバーレイされ、**課題（クイズ）**を課されます。
1ラウンドの全問を正解すると、ロックが解除されます。

## 動作の流れ

1. 対象SNS（既定は YouTube。X・Facebook・Instagram・TikTok・Reddit も選択可）を開くと、
   画面全体が課題で覆われる（背後のメディアは自動停止。YouTube の広告だけは止めずに消音して流しきる）。
   YouTube は動画ページ（`/watch`・`/shorts`）を動画ごとに、他のSNSはサイト全体を1単位としてロックする。
2. 選択パネルで有効にしたクイズ（複数ならランダムで1つ）が出題される。
3. 1ラウンドの全問をクリアすると、2 つの選択肢が出る：
   - **もっと続ける!!!** — SNS を離れ、拡張機能内の継続ページ（`continue.html`）へ遷移し、そこで課題を好きなだけ続けられる。
   - **ソーシャルネットワークへ進む** — ロックを解除して閲覧する。

## リポジトリ構成

マルチプラットフォーム展開のため、プラットフォームごとにフォルダを分けている。

```
extension/   Chrome 拡張機能（本体。ビルド不要でそのまま読み込める）
android/     Android ネイティブ版（開発中。クイズ資産は extension/ から取り込む）
ios/         iOS 版（構想段階）
docs/        共通ドキュメント（プライバシーポリシー・ストア掲載文・QAチェックリスト）
scripts/     データ・アイコン生成スクリプト
tmp/         生データ置き場（git 管理外）
```

クイズ本体（`extension/core/` と `extension/quizzes/`）はプレーンな JS/HTML/CSS で
ブラウザ非依存のため、モバイル版は WebView からこの資産を共有して使う。

## インストール（開発者モードで読み込み）

1. Chrome で `chrome://extensions` を開く。
2. 右上の「**デベロッパーモード**」を ON。
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック。
4. `extension/` フォルダ（`D:\SNSBlocker\extension`）を選択。
5. YouTube の動画を開いて動作確認。

## 収録プラグイン

各プラグインの仕様・データの出所・難易度調整は、**各フォルダの README** を参照。

| プラグイン | id | 詳細 |
|---|---|---|
| 古典文学の書き取り | `koten` | [extension/quizzes/koten/README.md](extension/quizzes/koten/README.md) |
| 百人一首 | `hyakunin` | [extension/quizzes/hyakunin/README.md](extension/quizzes/hyakunin/README.md) |
| 重音(2音)の聴音 | `juon` | [extension/quizzes/juon/README.md](extension/quizzes/juon/README.md) |
| 旋律聴音（4小節の書き取り） | `senritsu` | [extension/quizzes/senritsu/README.md](extension/quizzes/senritsu/README.md) |
| 詰将棋(3手詰) | `tsume` | [extension/quizzes/tsume/README.md](extension/quizzes/tsume/README.md) |
| 詰将棋(5手詰) | `tsume5` | 同上（1フォルダから手数別に3プラグインを登録） |
| 詰将棋(7手詰) | `tsume7` | 同上 |

### 選択パネル（出題プラグイン・対象SNS）

ツールバーの拡張機能アイコンを**クリック**（または右クリック→「オプション」）すると
選択パネルが開き、**出題するクイズ**と**対象SNS**をチェックボックスで選べる
（いずれも**複数選択可**・最低1つ）。

- 選択は `chrome.storage.sync`（`enabledQuizzes` / `enabledSites`）に保存され、
  開いているタブにも次の関所/ラウンドから反映される。
- クイズを**複数選択時は、関所ごとにランダム**でいずれか1つが出題される。
  1ラウンド（3問など、問数はプラグインごと）は同じプラグインから出る。
- ストレージ未設定（初回・フォーク運用）のときはクイズ=登録済みの全クイズからランダム、
  対象SNS=YouTube のみ、が使われる。インストール直後は設定パネルが自動で開く。
- 解除状態はタブのセッション中のみ（タブを閉じて開き直すと再出題）。

## アーキテクチャ（基盤 / クイズ の分離）

**基盤部分**と**クイズ部分**を分離している。基盤は「どの形式か」を一切知らず、
選択パネル（または `config.js`）で選ばれたクイズに出題を委譲する。
（以下のパスはすべて `extension/` 内）

```
core/registry.js   基盤: クイズを登録・選択するレジストリ（window.Kansho）
core/ui.js         基盤: 形式非依存の共有UI部品（el / コピペ禁止 / 進捗ヘッダ）
core/sites.js      基盤: 対象SNSのアダプタ（URL判定・ロック単位。サイトを登録制で追加）
core/host.js       基盤: 関所（ロック検知・オーバーレイ・解除管理・クリア後画面。サイト非依存）
core/overlay.css   基盤: 共通スタイル＋デザイントークン（--k-*。ライト/ダーク両対応）
config.js          どの形式を出すか（選択パネルの保存値の読み込み＋フォーク用の既定値）
continue.html/js   基盤: 継続ページ
options.html/js    基盤: 出題プラグインの選択パネル（ツールバーアイコンから開く）
quizzes/<id>/      クイズ: 1フォルダ＝1プラグイン（ロジック・データ・CSS・README）
```

- **フォーク運用**するなら、`quizzes/` に目的の形式だけを残せばよい
  （未設定時は登録済みの全クイズから出題されるため、それだけが出る）。基盤（`core/`）は変更不要。
  各クイズは他クイズに依存しない自己完結を保つこと
  （hyakunin が koten と採点ロジックを重複して持つのはこのため）。
- **拡張機能内での切り替え**は上記の選択パネルで行う。

### 新しいクイズ形式を追加する

1. `quizzes/<形式名>/` を作り、その中で `Kansho.registerQuiz({ ... })` を呼ぶスクリプトを書く。

   ```js
   Kansho.registerQuiz({
     id: "shogi",            // 選択パネル・storage の enabledQuizzes と対応
     title: "次の一手",
     badge: "次",            // 判子バッジ用の漢字一字（絵文字は使わない）
     // 1ラウンドを container に構築し、クリアで ctx.onComplete(info) を呼ぶ。
     // info = { body, ui, el, restart } を渡すと基盤がクリア後画面を描く。
     start: function (container, ctx) { /* … */ }
   });
   ```

   共有UI（`Kansho.ui.el` / `forbidCopy` / `forbidPaste` / `renderHeader`）を利用でき、
   採点などその形式固有のロジックはこのフォルダ内に閉じ込める。データは
   `Kansho.data.<形式名>…` に置くと基盤の他部分から独立する。固有のスタイルは
   `quizzes/<形式名>/<形式名>.css` に置く（基盤CSSの後に読み込むので `.ytg-btn` 等を上書きできる）。
   プラグインの説明は `quizzes/<形式名>/README.md` に書く。
2. `manifest.json` の `content_scripts.js` / `content_scripts.css` / `web_accessible_resources`、
   `continue.html` の `<script>`・`<link>`、および `options.html` の `<script>` に、
   追加したファイルを（JSは `config.js` の後・`core/host.js` の前、CSSは
   `core/overlay.css` の後に）登録する。
3. 選択パネルで新しいクイズにチェックを入れると出題される。

## デザイン

- **ライト=「学習ノート」**（白ノート地・青磁アクセント）、**ダーク=「夜の書斎」**（墨地・琥珀）。
  OS の設定（`prefers-color-scheme`）に追従する。
- 配色はすべて `core/overlay.css` の `--k-*` トークン経由。クイズCSSもトークンを使う
  （盤・鍵盤など実物由来の固定色は例外）。
- **絵文字は使わない**。プラグインの印は漢字一字の判子バッジ（角・枠。`spec.badge`）。
- 本文（覚える対象）は明朝＋背表紙線（左のアクセント線）、UIはゴシック。
- 進捗はスタンプ（済=✓ / 現在=番号）。動きは意味のあるもの（ゲージ・ぼかし解除・正解フェード）だけ。

## ライセンスとクレジット

コードは [MIT License](LICENSE)。収録データの出典は以下のとおり。

- **詰将棋の出題データ**: [やねうら王 詰将棋500万問](https://yaneuraou.yaneu.com/2020/12/25/christmas-present/)
  （作者が著作権を主張しない旨を明示して公開したデータ）から抽出・検証したもの。
- **古典文学・近代文学の本文**: 著作権保護期間の満了した作品。近代文学は
  [青空文庫](https://www.aozora.gr.jp/) の公開テキストに基づく（ルビは本プロジェクトで付与・補完）。
- **百人一首**: 歌はパブリックドメイン。表記は近江神宮「小倉百人一首一覧」を参照した。

## 仕様メモ

- 解除状態は **タブのセッション中のみ**保持（`sessionStorage`）。タブを閉じて開き直すと再度出題されます。動画ごとに個別に判定します。
- コピー・ペースト・右クリック・ドラッグは課題エリア内で無効化しています（自制のためのツールなので、完全な回避防止は目的としていません）。
