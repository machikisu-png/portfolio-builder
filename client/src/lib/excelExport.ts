import ExcelJS from 'exceljs';
import type { PortfolioItem } from './types';

/**
 * エクセル「ポートフォリオ計算表.xlsx」のカテゴリ列マッピング
 * アプリのカテゴリ → エクセルの列
 */
const CATEGORY_TO_COLUMN: Record<string, string> = {
  '国内債券': 'C',
  '国内株式': 'E',
  '海外債券': 'G',
  '新興国債券': 'G', // 外国債券にまとめる
  '先進国株式': 'I',
  '全世界株式': 'I', // 先進国株式にまとめる
  'REIT': 'K',
  'コモディティ': 'M',
  '新興国株式': 'O',
  // バランス型はマッピング先なし → スキップ
};

interface CategoryAgg {
  column: string;
  totalWeight: number;
  weightedReturn: number;  // 加重和
  weightedRisk: number;    // 加重和
  fundNames: string[];
}

/**
 * ファンドの長期リターンを取得（5年→3年→1年の順）
 */
function getReturn(item: PortfolioItem): number {
  const f = item.fund;
  if (f.return5y != null && Number.isFinite(f.return5y)) return f.return5y;
  if (f.return3y != null && Number.isFinite(f.return3y)) return f.return3y;
  if (f.return1y != null && Number.isFinite(f.return1y)) return Math.min(f.return1y, 8);
  return 0;
}

function getRisk(item: PortfolioItem): number {
  const f = item.fund;
  if (f.stdDev != null && Number.isFinite(f.stdDev)) return f.stdDev;
  return Math.abs(getReturn(item)) * 0.8 + 5;
}

/**
 * 選択ファンドをエクセルのカテゴリ列ごとに集約
 */
function aggregateByCategory(items: PortfolioItem[]): Map<string, CategoryAgg> {
  const map = new Map<string, CategoryAgg>();
  for (const item of items) {
    const col = CATEGORY_TO_COLUMN[item.fund.category];
    if (!col) continue; // マッピング対象外（バランス型など）
    const existing = map.get(col);
    if (existing) {
      existing.totalWeight += item.weight;
      existing.weightedReturn += item.weight * getReturn(item);
      existing.weightedRisk += item.weight * getRisk(item);
      existing.fundNames.push(item.fund.name);
    } else {
      map.set(col, {
        column: col,
        totalWeight: item.weight,
        weightedReturn: item.weight * getReturn(item),
        weightedRisk: item.weight * getRisk(item),
        fundNames: [item.fund.name],
      });
    }
  }
  return map;
}

/**
 * テンプレートを読み込み、ポートフォリオ情報を書き込んでダウンロード
 *
 * 埋めるセル:
 * - Q3: 総投資額
 * - 各カテゴリ列 row 3: 投資額（Q3 × 割合）
 * - 各カテゴリ列 row 4: 投資割合（%）
 * - 各カテゴリ列 row 5: 利回り（%）
 * - 各カテゴリ列 row 8: 標準偏差（%）
 * - 各カテゴリ列 row 11: ファンド名
 */
export async function exportPortfolioToExcel(
  items: PortfolioItem[],
  monthlyInvestment: number,
  years: number,
  presetName?: string,
): Promise<void> {
  // テンプレート取得
  const res = await fetch('/portfolio-template.xlsx');
  if (!res.ok) throw new Error('テンプレートファイルの読み込みに失敗しました');
  const arrayBuffer = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.getWorksheet('ポートフォリオ') || wb.worksheets[0];
  if (!ws) throw new Error('ポートフォリオシートが見つかりません');

  // カテゴリ別集約
  const agg = aggregateByCategory(items);

  // 総投資額（積立総額 = 月額 × 12 × 年数）を数値で入力
  const totalInvestment = monthlyInvestment * 12 * years;
  ws.getCell('Q3').value = totalInvestment;

  // 全カテゴリ列をクリア（未使用カテゴリは空にする）
  const allColumns = ['C', 'E', 'G', 'I', 'K', 'M', 'O'];
  for (const col of allColumns) {
    ws.getCell(`${col}3`).value = null;  // 投資額
    ws.getCell(`${col}4`).value = null;  // 割合
    ws.getCell(`${col}5`).value = null;  // 利回り
    ws.getCell(`${col}8`).value = null;  // 標準偏差
    ws.getCell(`${col}11`).value = null; // ファンド名
  }

  // 各カテゴリに「数値のみ」を書き込み（式は書かない）
  agg.forEach((data, col) => {
    const weightPct = data.totalWeight; // 0-1 の小数
    const avgReturn = data.totalWeight > 0 ? data.weightedReturn / data.totalWeight : 0;
    const avgRisk = data.totalWeight > 0 ? data.weightedRisk / data.totalWeight : 0;
    const fundNameJoined = data.fundNames.length <= 2
      ? data.fundNames.join('、')
      : `${data.fundNames[0]} 他${data.fundNames.length - 1}本`;

    // 投資額 = 総投資額 × 割合（数値で入れる）
    ws.getCell(`${col}3`).value = Math.round(totalInvestment * weightPct);
    ws.getCell(`${col}4`).value = weightPct;       // 割合（0-1 小数）
    ws.getCell(`${col}5`).value = avgReturn;       // 利回り (%値)
    ws.getCell(`${col}8`).value = avgRisk;         // 標準偏差 (%値)
    ws.getCell(`${col}11`).value = fundNameJoined; // ファンド名
  });

  // 積立条件も反映（B28 = 月額、J28 = 年数）
  if (monthlyInvestment > 0) ws.getCell('B28').value = monthlyInvestment;
  if (years > 0) ws.getCell('J28').value = years;

  // ファイル名
  const datePart = new Date().toISOString().slice(0, 10);
  const presetPart = presetName ? `_${presetName}` : '';
  const filename = `ポートフォリオ計算表${presetPart}_${datePart}.xlsx`;

  // ダウンロード
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
