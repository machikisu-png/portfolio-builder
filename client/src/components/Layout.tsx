import { type ReactNode } from 'react';

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
];

export default function Layout({ children, activeTab, onTabChange, alertCount }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
              投信ポートフォリオビルダー <span className="text-xs font-normal text-blue-600">[計算表モード]</span>
            </h1>
            <span className="text-xs sm:text-sm text-gray-500 hidden sm:block">Excel計算表準拠版</span>
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
