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

### 2. スクレイピングするファンドを増やす [完了]
- WealthAdvisor: ページ1〜3（約60件）
- Minkabu リターンランキング: ページ1〜3（約60件）
- Minkabu シャープレシオ: ページ1〜3
- Minkabu 債券カテゴリ: 国内・国際 各2ページ
- 追加カテゴリ: REIT 2ページ、新興国株式 2ページ
- バッチ処理 + 1.5秒ディレイでレートリミット対策

### 3. 年齢入力 [確認完了]
- ローカルstate + blur時保存で正常動作
- iOS ズーム防止対策済み

### 4. 為替ヘッジ [確認完了]
- ヘッジありファンド7件で正常動作
- ヘッジ変更時にプリセット再選定が発動

## 計算方式
- リスク: プリセット目標値をそのまま使用（計算表方式）
- リターン: ファンドの長期加重平均（10y×3 + 5y×5 + 3y×2）で計算
- シミュレーション: 計算表方式（FV ÷10）とモンテカルロの切替可能
- ファンド選定: リターン/リスク目標一致が最優先 + 品質スコア副次評価
