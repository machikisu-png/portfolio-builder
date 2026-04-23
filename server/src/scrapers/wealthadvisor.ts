import axios from 'axios';
import * as cheerio from 'cheerio';

export interface WealthAdvisorFund {
  id: string;
  name: string;
  category: string;
  nav: number;
  navChange: number;
  totalAssets: number;
  expenseRatio: number;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  return10y: number | null;
  sharpeRatio: number | null;
  stdDev: number | null;
  nisaEligible: boolean;
}

const BASE_URL = 'https://www.wealthadvisor.co.jp';

function parseNumber(text: string): number | null {
  if (!text || text === '-' || text === '--' || text.trim() === '') return null;
  const cleaned = text.replace(/,/g, '').replace(/％/g, '').replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeWealthAdvisor(page: number = 1): Promise<WealthAdvisorFund[]> {
  const funds: WealthAdvisorFund[] = [];

  try {
    const url = `${BASE_URL}/FundData/DownloadFundData.do?fnc=search&page=${page}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // ファンドデータテーブルの各行を解析
    $('table.fund-list tr, table[class*="fund"] tr, .search-result-table tr').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 5) return;

      const nameCell = cells.eq(0);
      const name = nameCell.text().trim();
      if (!name || name === 'ファンド名') return;

      // リンクからIDを抽出
      const link = nameCell.find('a').attr('href') || '';
      const idMatch = link.match(/fund_id=(\w+)/);
      const id = idMatch ? `wa_${idMatch[1]}` : `wa_${name.substring(0, 20)}`;

      const fund: WealthAdvisorFund = {
        id,
        name,
        category: cells.eq(1)?.text().trim() || 'その他',
        nav: parseNumber(cells.eq(2)?.text()) || 0,
        navChange: parseNumber(cells.eq(3)?.text()) || 0,
        totalAssets: parseNumber(cells.eq(4)?.text()) || 0,
        expenseRatio: parseNumber(cells.eq(5)?.text()) || 0,
        return1y: parseNumber(cells.eq(6)?.text()),
        return3y: parseNumber(cells.eq(7)?.text()),
        return5y: parseNumber(cells.eq(8)?.text()),
        return10y: parseNumber(cells.eq(9)?.text()),
        sharpeRatio: parseNumber(cells.eq(10)?.text()),
        stdDev: parseNumber(cells.eq(11)?.text()),
        nisaEligible: $(row).text().includes('NISA'),
      };

      funds.push(fund);
    });

    // 別のテーブル構造にも対応
    if (funds.length === 0) {
      $('table tr').each((_i, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;

        const name = cells.eq(0).text().trim();
        if (!name || name.length < 2) return;

        const link = cells.eq(0).find('a').attr('href') || '';
        const id = `wa_${Buffer.from(name).toString('base64').substring(0, 12)}`;

        funds.push({
          id,
          name,
          category: guessCategory(name),
          nav: parseNumber(cells.eq(1)?.text()) || 0,
          navChange: 0,
          totalAssets: parseNumber(cells.eq(2)?.text()) || 0,
          expenseRatio: parseNumber(cells.eq(3)?.text()) || 0,
          return1y: parseNumber(cells.eq(4)?.text()),
          return3y: parseNumber(cells.eq(5)?.text()),
          return5y: parseNumber(cells.eq(6)?.text()),
          return10y: null,
          sharpeRatio: parseNumber(cells.eq(7)?.text()),
          stdDev: null,
          nisaEligible: $(row).text().includes('NISA') || link.includes('nisa'),
        });
      });
    }
  } catch (error) {
    console.error('WealthAdvisor scraping error:', error instanceof Error ? error.message : error);
  }

  return funds;
}

// 全ページ取得（結果が0件になるページまでループ）
export async function scrapeWealthAdvisorAllPages(
  opts: { maxPages?: number; delayMs?: number } = {},
): Promise<WealthAdvisorFund[]> {
  const { maxPages = 50, delayMs = 400 } = opts;
  const all: WealthAdvisorFund[] = [];
  const seenIds = new Set<string>();
  let emptyStreak = 0;

  for (let p = 1; p <= maxPages; p++) {
    let funds: WealthAdvisorFund[] = [];
    try {
      funds = await scrapeWealthAdvisor(p);
    } catch {
      funds = [];
    }

    if (funds.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
    } else {
      emptyStreak = 0;
    }

    let added = 0;
    for (const f of funds) {
      if (!seenIds.has(f.id)) {
        seenIds.add(f.id);
        all.push(f);
        added++;
      }
    }
    if (added === 0 && funds.length > 0) break;

    await new Promise(r => setTimeout(r, delayMs));
  }

  return all;
}

function guessCategory(name: string): string {
  if (name.includes('日経') || name.includes('TOPIX') || name.includes('日本株')) return '国内株式';
  if (name.includes('S&P') || name.includes('先進国') || name.includes('米国')) return '先進国株式';
  if (name.includes('新興国') || name.includes('エマージング')) return '新興国株式';
  if (name.includes('全世界') || name.includes('オールカントリー') || name.includes('グローバル株')) return '全世界株式';
  if (name.includes('国内債券') || name.includes('日本債')) return '国内債券';
  if (name.includes('先進国債') || name.includes('外国債')) return '海外債券';
  if (name.includes('新興国債')) return '新興国債券';
  if (name.includes('バランス') || name.includes('8資産')) return 'バランス型';
  if (name.includes('REIT') || name.includes('リート') || name.includes('不動産')) return 'REIT';
  if (name.includes('金') || name.includes('コモディティ') || name.includes('原油')) return 'コモディティ';
  return 'その他';
}
