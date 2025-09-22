# IPA PM試験 午後記述式 AI一次採点システム MVP

## 概要
IPAプロジェクトマネージャ試験の午後記述式問題の一次採点を、生成AIを活用して支援するシステムのMVP実装です。

## 特徴
- クライアント・サーバーモデルによるセキュアなAPI呼び出し
- IndexedDBによるローカルデータ管理
- ルールベース評価による事前フィルタリング
- AI採点結果の検証と二次採点対応
- 監査性とトレーサビリティの確保
- **複数LLMプロバイダー対応**: Ollama、LM Studio両方をサポート
- **プロバイダー自動選択**: 環境変数で簡単切り替え

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. ローカルLLMの準備

このシステムは **Ollama** または **LM Studio** のローカルLLMに対応しています。

#### オプション A: Ollama を使用する場合

1. **Ollamaのインストール**
   ```bash
   # https://ollama.ai からダウンロードしてインストール
   ```

2. **モデルのダウンロード**
   ```bash
   # 推奨モデル（約4GB）
   ollama pull llama2:7b

   # または他のモデル
   ollama pull codellama:7b
   ollama pull mistral:7b
   ```

3. **Ollamaサーバーの起動**
   ```bash
   ollama serve
   # デフォルトで http://127.0.0.1:11434 で起動
   ```

#### オプション B: LM Studio を使用する場合

1. **LM Studioのインストール**
   - https://lmstudio.ai からダウンロードしてインストール

2. **モデルのダウンロード**
   - LM Studio内でモデルを検索・ダウンロード
   - 推奨: `microsoft/DialoGPT-medium` や `TheBloke/CodeLlama-7B-Instruct-GGML`

3. **ローカルサーバーの起動**
   - LM Studio で「Local Server」タブを開く
   - モデルを選択して「Start Server」
   - デフォルトで http://127.0.0.1:1234 で起動

### 3. 環境変数の設定

```bash
cp .env.example .env
```

`.env`ファイルを編集して使用するLLMプロバイダーを設定：

```bash
# どちらのプロバイダーを使用するか選択
LLM_PROVIDER=ollama          # または lmstudio

# Ollama設定（Ollamaを使用する場合）
OLLAMA_API_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama2:7b

# LM Studio設定（LM Studioを使用する場合）
LMSTUDIO_API_URL=http://127.0.0.1:1234
LMSTUDIO_API_KEY=dummy-key

# その他の設定
PORT=8000
LOG_LEVEL=info
```

### 4. 開発サーバーの起動
```bash
# フロントエンドとバックエンドを同時起動
npm run dev:both

# または個別起動
npm run dev      # APIサーバー（ポート3000）
npm run client   # フロントエンド（ポート8080）
```

### 5. アクセス
- フロントエンド: http://localhost:8080
- APIサーバー: http://localhost:3000

## 技術スタック
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript, IndexedDB
- **バックエンド**: Node.js, Express.js
- **AI API**: ローカルLLM（Ollama、LM Studio対応）
- **データベース**: IndexedDB（クライアントサイド）

## 使用方法

### LLMプロバイダーの切り替え

実行中にプロバイダーを切り替える場合：

1. `.env`ファイルの`LLM_PROVIDER`を変更
2. サーバーを再起動
```bash
# サーバーを停止（Ctrl+C）
npm run dev:both  # 再起動
```

### 動作確認

システムが正常に動作しているか確認：

```bash
# APIサーバーの動作確認
curl http://localhost:8000/api/models

# 採点APIのテスト
curl -X POST http://localhost:8000/api/grade \
  -H "Content-Type: application/json" \
  -d '{
    "context": "テスト問題の文脈",
    "prompt": "テスト問題",
    "model_answer": "模範解答",
    "intent": "出題意図",
    "student_answer": "学生の解答"
  }'
```

## トラブルシューティング

### よくある問題

#### 1. AI APIエラー（Connection refused）
```
Error: AI API Error: ECONNREFUSED
```
**解決方法:**
- Ollama/LM Studioが起動しているか確認
- URLとポート番号が正しいか確認（`.env`ファイル）
- ファイアウォールでポートがブロックされていないか確認

#### 2. モデルが見つからないエラー
```
Error: model 'llama2:7b' not found
```
**解決方法:**
- Ollamaの場合: `ollama list` でモデル一覧を確認
- モデルが未ダウンロードの場合: `ollama pull llama2:7b`
- `.env`ファイルの`OLLAMA_MODEL`を確認

#### 3. JSONパースエラー
```
JSON Parse Error
```
**解決方法:**
- LLMの応答がJSON形式でない場合に発生
- モデルの性能向上のため、より大きなモデルの使用を推奨
- `temperature`パラメータを下げる（現在0.1に設定済み）

#### 4. ポート競合エラー
```
Error: listen EADDRINUSE :::8000
```
**解決方法:**
- `.env`ファイルで別のポートを指定
- 既存のプロセスを停止: `lsof -ti:8000 | xargs kill -9`

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