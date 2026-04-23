# ポートフォリオビルダー 進捗メモ

## 公開URL
- フロント: https://portfolio-builder-omega-silk.vercel.app
- バックエンド: https://portfolio-builder-api-br7g.onrender.com
- GitHub: https://github.com/machikisu-png/portfolio-builder

## プロジェクトパス
/Users/takayukikitamura/Desktop/Claude cord関連/attendance/portfolio-builder/

## デプロイ方法
- git push → Vercel管理画面で Deployments → ... → Redeploy（Build Cacheチェック外す）
- サーバー変更時は Render管理画面でも Manual Deploy → Deploy latest commit

## 完了タスク（2026-04-13）

### 1. 期待リターンをプリセット目標値に一致させる [完了]
- Simulation.tsx に `presetExpectedReturn` propを追加
- MyPortfolio.tsx から `preset?.expectedReturn` を渡すよう修正
- リスクと同様、プリセット選択時はプリセットの目標リターン値を使用

### 2. スクレイピングするファンドを増やす [完了・拡充済]
- WealthAdvisor: ページ1〜5
- Minkabu リターンランキング: ページ1〜3
- Minkabu シャープレシオ: ページ1〜3
- カテゴリ別: 国内債券2p, 海外債券2p, REIT 2p, 新興国株式2p, 国内株式2p, 先進国株式2p, バランス型2p, コモディティ1p
- 4バッチ構成 + 1.5秒ディレイでレートリミット対策
- 170件以上のファンドを自動取得（30分キャッシュ）

### 3. 年齢入力 [確認完了]
- ローカルstate + blur時保存で正常動作
- iOS ズーム防止対策済み

### 4. 為替ヘッジ [修正完了]
- ヘッジありファンド7件で正常動作
- ヘッジ変更時にプリセット再選定が発動
- 最適化ループでヘッジ設定が無視されるバグを修正済み

### 5. 目標との比較のリターン値統一 [完了]
- PortfolioBuilder.tsx の「目標との比較」でもプリセット値を使用するよう修正

## 計算方式
- リスク: プリセット目標値をそのまま使用（計算表方式）
- リターン: プリセット選択時はプリセット目標値を使用（シミュレーション・目標比較・チャート全て統一）
- シミュレーション: 計算表方式（FV ÷10）とモンテカルロの切替可能
- ファンド選定: リターン/リスク目標一致が最優先 + 品質スコア副次評価
