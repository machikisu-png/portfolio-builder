/**
 * 各証券会社の投信検索ページへのディープリンク
 *
 * 法的制約により売買の仲介はできないため、ユーザーを
 * 証券会社の公式投信検索/購入ページへ誘導する形にする。
 *
 * 仕組み:
 *   1. ファンド名をクリップボードへコピー
 *   2. 証券会社の投信検索ページを新タブで開く
 *   3. ユーザーは検索窓にペースト → ファンド選択 → 購入実行
 *
 * 各社のURLは変更されることがあるため、定数として一元管理。
 */

export interface BrokerInfo {
  id: 'sbi' | 'rakuten' | 'monex' | 'matsui';
  name: string;
  shortName: string;
  /** 投信検索/購入トップページ（ログイン要） */
  fundSearchUrl: string;
  /** ブランドカラー */
  color: string;
  /** Tailwind の background class */
  bgClass: string;
}

export const BROKERS: BrokerInfo[] = [
  {
    id: 'sbi',
    name: 'SBI証券',
    shortName: 'SBI',
    fundSearchUrl: 'https://search.sbisec.co.jp/v2/popwin/info/stock/inv_search.html',
    color: '#005bac',
    bgClass: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'rakuten',
    name: '楽天証券',
    shortName: '楽天',
    fundSearchUrl: 'https://www.rakuten-sec.co.jp/web/fund/find/',
    color: '#bf0000',
    bgClass: 'bg-red-600 hover:bg-red-700',
  },
  {
    id: 'monex',
    name: 'マネックス証券',
    shortName: 'マネックス',
    fundSearchUrl: 'https://info.monex.co.jp/investment-trust/index.html',
    color: '#1e6cb6',
    bgClass: 'bg-sky-700 hover:bg-sky-800',
  },
  {
    id: 'matsui',
    name: '松井証券',
    shortName: '松井',
    fundSearchUrl: 'https://www.matsui.co.jp/fund/',
    color: '#e60012',
    bgClass: 'bg-rose-600 hover:bg-rose-700',
  },
];

/**
 * ファンド名をコピー → 証券会社の投信ページを新タブで開く
 * @returns コピー成功時 true
 */
export async function openBrokerWithFundName(
  broker: BrokerInfo,
  fundName: string
): Promise<boolean> {
  let copied = false;
  try {
    await navigator.clipboard.writeText(fundName);
    copied = true;
  } catch {
    // クリップボード書込み失敗（権限なし等）— 警告のみ
    copied = false;
  }
  // 新タブで開く
  window.open(broker.fundSearchUrl, '_blank', 'noopener,noreferrer');
  return copied;
}
