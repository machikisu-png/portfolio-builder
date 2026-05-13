import type { PortfolioItem } from './types';

function formatYen(n: number): string {
  return `${Math.round(n).toLocaleString()}円`;
}

function inferSellers(fund: PortfolioItem['fund']): string {
  const sellers = fund.sellers || [];
  if (sellers.length > 0) return sellers.join('、');
  // 名前ヒューリスティック
  const name = fund.name;
  const list: string[] = [];
  if (/eMAXIS|ニッセイ|たわら|iFree|SBI[・·]V|楽天[・·]|ひふみ|SMT/.test(name)) {
    list.push('SBI証券', '楽天証券');
  }
  return list.length > 0 ? list.join('、') : '要確認';
}

/**
 * 購入リスト（チェックリスト形式 TXT）をダウンロード
 */
export function exportPurchaseListText(
  items: PortfolioItem[],
  monthlyInvestment: number,
  presetName?: string,
): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);

  const lines: string[] = [];
  lines.push('ポートフォリオ購入リスト');
  lines.push('='.repeat(50));
  lines.push(`作成日: ${dateStr}`);
  if (presetName) lines.push(`タイプ: ${presetName}`);
  lines.push(`月額投資額: ${formatYen(monthlyInvestment)}`);
  lines.push(`ファンド数: ${items.length}本  合計配分: ${(totalWeight * 100).toFixed(1)}%`);
  lines.push('='.repeat(50));
  lines.push('');

  items.forEach((item, i) => {
    const pct = (item.weight * 100).toFixed(2);
    const monthly = monthlyInvestment * item.weight;
    lines.push(`[ ] ${i + 1}. ${item.fund.name}`);
    lines.push(`    カテゴリ      : ${item.fund.category}`);
    lines.push(`    配分          : ${pct}%`);
    lines.push(`    月額金額      : ${formatYen(monthly)}`);
    lines.push(`    販売会社      : ${inferSellers(item.fund)}`);
    if (item.fund.expenseRatio > 0) {
      lines.push(`    信託報酬      : ${item.fund.expenseRatio.toFixed(3)}%`);
    }
    if (item.fund.return1y != null) {
      lines.push(`    1年リターン   : ${item.fund.return1y.toFixed(2)}%`);
    }
    if (item.fund.return5y != null) {
      lines.push(`    5年リターン   : ${item.fund.return5y.toFixed(2)}%`);
    }
    if (item.fund.stdDev != null) {
      lines.push(`    標準偏差      : ${item.fund.stdDev.toFixed(2)}%`);
    }
    if (item.fund.nisaEligible) lines.push(`    NISA          : 対応`);
    if (item.fund.forexHedge === true) lines.push(`    為替ヘッジ    : あり`);
    else if (item.fund.forexHedge === false) lines.push(`    為替ヘッジ    : なし`);
    lines.push('');
  });

  lines.push('='.repeat(50));
  lines.push('購入手順メモ');
  lines.push('='.repeat(50));
  lines.push('1. 証券会社（SBI証券 / 楽天証券）にログイン');
  lines.push('2. NISA口座（つみたて投資枠 / 成長投資枠）の活用可否を確認');
  lines.push('3. 上記ファンドを月額金額で積立設定');
  lines.push('4. 毎月の引落日・引落口座を確認');
  lines.push('5. 設定完了後、各項目にチェックを入れる');
  lines.push('');
  lines.push('※ ファンド名・金額・配分は購入時の最新情報を必ず確認してください');

  const text = lines.join('\n');
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `購入リスト${presetName ? '_' + presetName : ''}_${dateStr.replace(/\//g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 購入リスト（CSV）をダウンロード — スプレッドシート用
 */
export function exportPurchaseListCSV(
  items: PortfolioItem[],
  monthlyInvestment: number,
  presetName?: string,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const header = ['No', 'ファンド名', 'カテゴリ', '配分(%)', '月額(円)', '販売会社', '信託報酬(%)', '1年リターン(%)', '5年リターン(%)', '標準偏差(%)', 'NISA', '為替ヘッジ'];
  const rows = items.map((item, i) => [
    String(i + 1),
    item.fund.name.replace(/,/g, '、'),
    item.fund.category,
    (item.weight * 100).toFixed(2),
    String(Math.round(monthlyInvestment * item.weight)),
    inferSellers(item.fund).replace(/,/g, '、'),
    item.fund.expenseRatio > 0 ? item.fund.expenseRatio.toFixed(3) : '',
    item.fund.return1y != null ? item.fund.return1y.toFixed(2) : '',
    item.fund.return5y != null ? item.fund.return5y.toFixed(2) : '',
    item.fund.stdDev != null ? item.fund.stdDev.toFixed(2) : '',
    item.fund.nisaEligible ? '対応' : '',
    item.fund.forexHedge === true ? 'あり' : item.fund.forexHedge === false ? 'なし' : '',
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(c => /[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `購入リスト${presetName ? '_' + presetName : ''}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
