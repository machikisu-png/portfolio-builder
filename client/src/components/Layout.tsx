import { type ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertCount?: number;
}

const tabs = [
  { id: 'search', label: 'ファンド検索' },
  { id: 'portfolio', label: 'ポートフォリオ構築' },
  { id: 'myportfolio', label: 'マイポートフォリオ' },
  { id: 'monitoring', label: 'モニタリング' },
];

export default function Layout({ children, activeTab, onTabChange, alertCount }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              投信ポートフォリオビルダー
            </h1>
            <span className="text-sm text-gray-500">個人資産運用ツール</span>
          </div>
          <nav className="flex space-x-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.id === 'monitoring' && alertCount !== undefined && alertCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {alertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
