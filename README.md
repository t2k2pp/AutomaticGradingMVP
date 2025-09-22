# IPA PM試験 午後記述式 AI一次採点システム MVP

## 概要
IPAプロジェクトマネージャ試験の午後記述式問題の一次採点を、生成AIを活用して支援するシステムのMVP実装です。

## 特徴
- クライアント・サーバーモデルによるセキュアなAPI呼び出し
- IndexedDBによるローカルデータ管理
- ルールベース評価による事前フィルタリング
- AI採点結果の検証と二次採点対応
- 監査性とトレーサビリティの確保

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
# .envファイルを編集してローカルLLMの設定を行う
```

### 3. 開発サーバーの起動
```bash
# フロントエンドとバックエンドを同時起動
npm run dev:both

# または個別起動
npm run dev      # APIサーバー（ポート3000）
npm run client   # フロントエンド（ポート8080）
```

### 4. アクセス
- フロントエンド: http://localhost:8080
- APIサーバー: http://localhost:3000

## 技術スタック
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript, IndexedDB
- **バックエンド**: Node.js, Express.js
- **AI API**: ローカルLLM（OpenAI互換）
- **データベース**: IndexedDB（クライアントサイド）

## ディレクトリ構成
```
├── public/              # フロントエンドファイル
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
├── server/              # バックエンドファイル
│   ├── app.js
│   ├── routes/
│   ├── middleware/
│   └── utils/
└── docs/               # ドキュメント
```

## セキュリティ
- APIキーはサーバーサイドで管理
- レート制限による過負荷防止
- CORS設定による不正アクセス防止
- 全てのAPI呼び出しをログ記録

## ライセンス
MIT License