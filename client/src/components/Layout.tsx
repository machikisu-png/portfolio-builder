import { type ReactNode } from 'react';
import { useCalcMode } from '../hooks/useCalcMode';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertCount?: number;
}

const tabs = [
  { id: 'search', label: 'ファンド検索', shortLabel: '検索' },
  { id: 'portfolio', label: 'ポートフォリオ構築', shortLabel: '構築' },
  { id: 'myportfolio', label: 'マイポートフォリオ', shortLabel: 'マイPF' },
  { id: 'monitoring', label: 'モニタリング', shortLabel: '監視' },
  { id: 'consultation', label: '相談', shortLabel: '相談' },
];

export default function Layout({ children, activeTab, onTabChange, alertCount }: LayoutProps) {
  const [calcMode, setMode] = useCalcMode();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
              投信ポートフォリオビルダー
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 計算モード切替 (MPT / 計算表 / プロ) */}
              <div
                className="inline-flex rounded-md border border-gray-300 overflow-hidden text-[10px] sm:text-xs"
                title="リターン/リスクの計算式を切り替えます"
              >
                <button
                  onClick={() => setMode('mpt')}
                  title="マーコビッツ簡易版（カテゴリ間相関をヒューリスティック推定）"
                  className={`px-2 sm:px-3 py-1 font-medium transition-colors ${
                    calcMode === 'mpt'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  MPT
                </button>
                <button
                  onClick={() => setMode('spreadsheet')}
                  title="Excel 計算表と同じ計算式（相関無視、σの単純加重和）"
                  className={`px-2 sm:px-3 py-1 font-medium transition-colors ${
                    calcMode === 'spreadsheet'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  計算表
                </button>
                <button
                  onClick={() => setMode('pro')}
                  title="機関投資家準拠：20年実データから推定した共分散行列を使用"
                  className={`px-2 sm:px-3 py-1 font-medium transition-colors ${
                    calcMode === 'pro'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  プロ
                </button>
              </div>
            </div>
          </div>
          {/* タブ: スマホではスクロール可能に */}
          <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.id === 'monitoring' && alertCount !== undefined && alertCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-[9px] sm:text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
