import axios from 'axios';
import * as cheerio from 'cheerio';

export interface MinkabuFund {
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
  sharpeRatio: number | null;
  nisaEligible: boolean;
}

const BASE_URL = 'https://itf.minkabu.jp';

function parseNumber(text: string): number | null {
  if (!text || text === '-' || text === '--' || text.trim() === '') return null;
  const cleaned = text.replace(/,/g, '').replace(/％/g, '').replace(/%/g, '').replace(/円/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeMinkabu(page: number = 1): Promise<MinkabuFund[]> {
  const funds: MinkabuFund[] = [];

  try {
    // ランキングページからデータ取得
    const url = `${BASE_URL}/ranking/return?page=${page}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // ランキングテーブルの解析
    $('table tbody tr, .ranking-table tr, .fund-list-item').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;

      const nameEl = $(row).find('a[href*="/fund/"]').first();
      const name = nameEl.text().trim() || cells.eq(0).text().trim();
      if (!name || name.length < 2) return;

      const href = nameEl.attr('href') || '';
      const idMatch = href.match(/\/fund\/([^/]+)/);
      const id = idMatch ? `mk_${idMatch[1]}` : `mk_${Buffer.from(name).toString('base64').substring(0, 12)}`;

      const fund: MinkabuFund = {
        id,
        name,
        category: guessCategory(name),
        nav: parseNumber(cells.eq(1)?.text()) || 0,
        navChange: 0,
        totalAssets: parseNumber($(row).find('[class*="asset"], [class*="net"]').text()) || 0,
        expenseRatio: 0,
        return1y: parseNumber(cells.eq(2)?.text()),
        return3y: parseNumber(cells.eq(3)?.text()),
        return5y: parseNumber(cells.eq(4)?.text()),
        sharpeRatio: null,
        nisaEligible: $(row).text().includes('NISA') || $(row).find('[class*="nisa"]').length > 0,
      };

      funds.push(fund);
    });

    // 代替パターン
    if (funds.length === 0) {
      $('[class*="fund-name"], [class*="fund_name"]').each((_i, el) => {
        const name = $(el).text().trim();
        if (!name) return;

        const parent = $(el).closest('tr, [class*="item"], [class*="row"]');
        const id = `mk_${Buffer.from(name).toString('base64').substring(0, 12)}`;

        funds.push({
          id,
          name,
          category: guessCategory(name),
          nav: parseNumber(parent.find('[class*="price"], [class*="nav"]').text()) || 0,
          navChange: 0,
          totalAssets: 0,
          expenseRatio: 0,
          return1y: parseNumber(parent.find('[class*="return"], [class*="yield"]').first().text()),
          return3y: null,
          return5y: null,
          sharpeRatio: null,
          nisaEligible: parent.text().includes('NISA'),
        });
      });
    }
  } catch (error) {
    console.error('Minkabu scraping error:', error instanceof Error ? error.message : error);
  }

  return funds;
}

// シャープレシオランキングからデータ取得
export async function scrapeMinkabuSharpe(page: number = 1): Promise<MinkabuFund[]> {
  const funds: MinkabuFund[] = [];

  try {
    const url = `${BASE_URL}/ranking/sharpe?page=${page}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    $('table tbody tr').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;

      const nameEl = $(row).find('a[href*="/fund/"]').first();
      const name = nameEl.text().trim();
      if (!name) return;

      const href = nameEl.attr('href') || '';
      const idMatch = href.match(/\/fund\/([^/]+)/);
      const id = idMatch ? `mk_${idMatch[1]}` : `mk_${Buffer.from(name).toString('base64').substring(0, 12)}`;

      funds.push({
        id,
        name,
        category: guessCategory(name),
        nav: parseNumber(cells.eq(1)?.text()) || 0,
        navChange: 0,
        totalAssets: 0,
        expenseRatio: 0,
        return1y: null,
        return3y: null,
        return5y: null,
        sharpeRatio: parseNumber(cells.eq(2)?.text()),
        nisaEligible: $(row).text().includes('NISA'),
      });
    });
  } catch (error) {
    console.error('Minkabu sharpe scraping error:', error instanceof Error ? error.message : error);
  }

  return funds;
}

// カテゴリ別ランキングからデータ取得（債券・REIT等）
export async function scrapeMinkabuByCategory(fundType: string, categoryOverride: string, page: number = 1): Promise<MinkabuFund[]> {
  const funds: MinkabuFund[] = [];

  try {
    const url = `${BASE_URL}/ranking/return?fund_type=${fundType}&page=${page}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    $('table tbody tr, .ranking-table tr, .fund-list-item').each((_i, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) return;

      const nameEl = $(row).find('a[href*="/fund/"]').first();
      const name = nameEl.text().trim() || cells.eq(0).text().trim();
      if (!name || name.length < 2) return;

      const href = nameEl.attr('href') || '';
      const idMatch = href.match(/\/fund\/([^/]+)/);
      const id = idMatch ? `mk_${idMatch[1]}` : `mk_${Buffer.from(name).toString('base64').substring(0, 12)}`;

      // カテゴリはファンド名から細分化、デフォルトはcategoryOverride
      const detailedCategory = guessBondCategory(name, categoryOverride);

      funds.push({
        id,
        name,
        category: detailedCategory,
        nav: parseNumber(cells.eq(1)?.text()) || 0,
        navChange: 0,
        totalAssets: parseNumber($(row).find('[class*="asset"], [class*="net"]').text()) || 0,
        expenseRatio: 0,
        return1y: parseNumber(cells.eq(2)?.text()),
        return3y: parseNumber(cells.eq(3)?.text()),
        return5y: parseNumber(cells.eq(4)?.text()),
        sharpeRatio: null,
        nisaEligible: $(row).text().includes('NISA') || $(row).find('[class*="nisa"]').length > 0,
      });
    });

    // 代替パターン
    if (funds.length === 0) {
      $('[class*="fund-name"], [class*="fund_name"]').each((_i, el) => {
        const name = $(el).text().trim();
        if (!name) return;
        const parent = $(el).closest('tr, [class*="item"], [class*="row"]');
        const id = `mk_${Buffer.from(name).toString('base64').substring(0, 12)}`;
        funds.push({
          id,
          name,
          category: guessBondCategory(name, categoryOverride),
          nav: parseNumber(parent.find('[class*="price"], [class*="nav"]').text()) || 0,
          navChange: 0,
          totalAssets: 0,
          expenseRatio: 0,
          return1y: parseNumber(parent.find('[class*="return"], [class*="yield"]').first().text()),
          return3y: null,
          return5y: null,
          sharpeRatio: null,
          nisaEligible: parent.text().includes('NISA'),
        });
      });
    }
  } catch (error) {
    console.error(`Minkabu ${fundType} scraping error:`, error instanceof Error ? error.message : error);
  }

  return funds;
}

// 債券ファンドの細分類
function guessBondCategory(name: string, defaultCategory: string): string {
  // まず一般カテゴリ判定を試みる
  const general = guessCategory(name);
  if (general !== 'その他') return general;

  // 債券の細分化
  if (defaultCategory.includes('国内') || defaultCategory.includes('jp')) {
    if (name.includes('国内') || name.includes('日本')) return '国内債券';
    return '国内債券';
  }
  if (defaultCategory.includes('国際') || defaultCategory.includes('intl')) {
    if (name.includes('新興国') || name.includes('エマージング')) return '新興国債券';
    if (name.includes('先進国') || name.includes('米国') || name.includes('欧州')) return '海外債券';
    // 「外国債券」「グローバル債券」等は海外債券に分類
    if (name.includes('外国') || name.includes('グローバル') || name.includes('ワールド')) return '海外債券';
    return '海外債券';
  }
  return defaultCategory;
}

// 全ページ取得（結果が0件になるページまでループ）
export async function scrapeMinkabuAllPages(
  kind: 'return' | 'sharpe' | 'category',
  opts: { fundType?: string; categoryOverride?: string; maxPages?: number; delayMs?: number } = {},
): Promise<MinkabuFund[]> {
  const { fundType, categoryOverride, maxPages = 50, delayMs = 400 } = opts;
  const all: MinkabuFund[] = [];
  const seenIds = new Set<string>();
  let emptyStreak = 0;

  for (let p = 1; p <= maxPages; p++) {
    let funds: MinkabuFund[] = [];
    try {
      if (kind === 'return') funds = await scrapeMinkabu(p);
      else if (kind === 'sharpe') funds = await scrapeMinkabuSharpe(p);
      else if (kind === 'category' && fundType && categoryOverride)
        funds = await scrapeMinkabuByCategory(fundType, categoryOverride, p);
    } catch {
      funds = [];
    }

    if (funds.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break; // 2ページ連続空なら終了
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
    // 新規追加が無くなったら終了
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
