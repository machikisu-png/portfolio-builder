import { useState, useCallback, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import FundSearch from './components/FundSearch';
import FundTable from './components/FundTable';
import FundDetailModal from './components/FundDetailModal';
import PortfolioBuilder from './components/PortfolioBuilder';
import MyPortfolio from './components/MyPortfolio';
import AlertBanner from './components/AlertBanner';
import AlertSettingsPanel from './components/AlertSettingsPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { useFunds } from './hooks/useFunds';
import type { Fund, PortfolioItem, SearchFilters } from './lib/types';
import type { Alert, MonitoringConfig } from './lib/alertTypes';
import { defaultConfig } from './lib/alertTypes';
import {
  checkAlerts, loadSnapshots, saveSnapshots,
  loadAlerts, saveAlerts, markAlertsRead,
  loadConfig, saveConfig,
  loadPortfolio, savePortfolio,
} from './lib/alertEngine';
import { api } from './lib/api';

const defaultFilters: SearchFilters = {
  category: '',
  minReturn: null,
  maxExpenseRatio: null,
  nisaOnly: false,
  sortBy: 'score',
  sortOrder: 'desc',
  source: 'all',
};

// ポートフォリオのメタ情報を保存/復元
async function savePortfolioMeta(meta: { presetId: string | null; confirmed: boolean; age: number | null }) {
  await api.put('/portfolio/config', {
    config: { ...(await api.get('/portfolio/config')).config, _portfolioMeta: meta },
  }).catch(() => {});
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('search');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [selectedFunds, setSelectedFunds] = useState<PortfolioItem[]>([]);
  const [detailFund, setDetailFund] = useState<Fund | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [monitorConfig, setMonitorConfig] = useState<MonitoringConfig>(defaultConfig);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);
  const portfolioLoaded = useRef(false);

  const { funds, loading, error } = useFunds(filters);

  // ログイン後にユーザーデータを復元
  useEffect(() => {
    if (!user || portfolioLoaded.current) return;
    portfolioLoaded.current = true;

    (async () => {
      try {
        const [items, savedConfig, savedAlerts] = await Promise.all([
          loadPortfolio(),
          loadConfig(),
          loadAlerts(),
        ]);
        if (items.length > 0) setSelectedFunds(items);
        if (savedConfig) {
          // メタ情報の復元
          const meta = (savedConfig as any)._portfolioMeta;
          if (meta) {
            setPresetId(meta.presetId ?? null);
            setConfirmed(meta.confirmed ?? false);
            setUserAge(meta.age ?? null);
          }
          setMonitorConfig(savedConfig);
        }
        if (savedAlerts.length > 0) setAlerts(savedAlerts);
      } catch {}
    })();
  }, [user]);

  // ログアウト時にリセット
  useEffect(() => {
    if (!user) {
      portfolioLoaded.current = false;
      setSelectedFunds([]);
      setAlerts([]);
      setMonitorConfig(defaultConfig);
      setPresetId(null);
      setConfirmed(false);
      setUserAge(null);
    }
  }, [user]);

  // ポートフォリオ変更時に自動保存
  const handleUpdateFunds = useCallback((items: PortfolioItem[], newPresetId?: string | null) => {
    setSelectedFunds(items);
    if (newPresetId !== undefined) setPresetId(newPresetId);
    if (user) {
      savePortfolio(items).catch(() => {});
      savePortfolioMeta({ presetId: newPresetId !== undefined ? newPresetId : presetId, confirmed: false, age: userAge });
    }
    // 配分変更時は未確定に戻す
    setConfirmed(false);
  }, [user, presetId]);

  const handleConfirm = useCallback(() => {
    setConfirmed(true);
    if (user) savePortfolioMeta({ presetId, confirmed: true, age: userAge });
  }, [user, presetId]);

  const handleUnlock = useCallback(() => {
    setConfirmed(false);
    if (user) savePortfolioMeta({ presetId, confirmed: false, age: userAge });
  }, [user, presetId, userAge]);

  const handleAgeChange = useCallback((age: number | null) => {
    setUserAge(age);
    if (user) savePortfolioMeta({ presetId, confirmed, age });
  }, [user, presetId, confirmed]);

  // モニタリング設定変更時に自動保存
  const handleConfigChange = useCallback((config: MonitoringConfig) => {
    setMonitorConfig(config);
    if (user) saveConfig(config).catch(() => {});
  }, [user]);

  // モニタリングチェック
  useEffect(() => {
    if (funds.length === 0 || !monitorConfig.enabled || !user) return;
    (async () => {
      try {
        const prevSnapshots = await loadSnapshots();
        if (prevSnapshots.length === 0) { await saveSnapshots(funds); return; }
        const now = Date.now();
        const lastChecked = monitorConfig.lastChecked || 0;
        const freqMs: Record<MonitoringConfig['frequency'], number> = {
          monthly: 30*24*60*60*1000, semiannual: 180*24*60*60*1000, annual: 365*24*60*60*1000,
        };
        if (now - lastChecked < freqMs[monitorConfig.frequency]) return;
        const newAlerts = checkAlerts(funds, prevSnapshots, monitorConfig);
        if (newAlerts.length > 0) { setAlerts(prev => [...newAlerts, ...prev]); await saveAlerts(newAlerts); }
        await saveSnapshots(funds);
        const updatedConfig = { ...monitorConfig, lastChecked: now };
        setMonitorConfig(updatedConfig);
        await saveConfig(updatedConfig);
      } catch {}
    })();
  }, [funds, user]);

  const handleDismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    if (user) markAlertsRead([alertId]).catch(() => {});
  }, [user]);

  const handleDismissAllAlerts = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    if (user) markAlertsRead('all').catch(() => {});
  }, [user]);

  const handleManualCheck = useCallback(async () => {
    if (funds.length === 0 || !user) return;
    try {
      const prevSnapshots = await loadSnapshots();
      const newAlerts = checkAlerts(funds, prevSnapshots, { ...monitorConfig, enabled: true });
      if (newAlerts.length > 0) { setAlerts(prev => [...newAlerts, ...prev]); await saveAlerts(newAlerts); }
      await saveSnapshots(funds);
      const updatedConfig = { ...monitorConfig, lastChecked: Date.now() };
      setMonitorConfig(updatedConfig);
      await saveConfig(updatedConfig);
    } catch {}
  }, [funds, monitorConfig, alerts, user]);

  const handleToggleFund = useCallback((fund: Fund) => {
    if (confirmed) return; // 確定済みの場合は変更不可
    setSelectedFunds(prev => {
      const exists = prev.find(item => item.fund.id === fund.id);
      let next: PortfolioItem[];
      if (exists) {
        next = prev.filter(item => item.fund.id !== fund.id);
      } else {
        const newItems = [...prev, { fund, weight: 0 }];
        const equalWeight = 1 / newItems.length;
        next = newItems.map(item => ({ ...item, weight: equalWeight }));
      }
      if (user) savePortfolio(next).catch(() => {});
      return next;
    });
  }, [user, confirmed]);

  const handleGoToSimulation = useCallback(() => {
    setActiveTab('myportfolio');
  }, []);

  const unreadCount = alerts.filter(a => !a.read).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} alertCount={unreadCount}>
      <AlertBanner alerts={alerts} onDismiss={handleDismissAlert} onDismissAll={handleDismissAllAlerts} onViewDetail={() => setActiveTab('monitoring')} />

      {activeTab === 'search' && (
        <>
          <FundSearch filters={filters} onFiltersChange={setFilters} />
          <FundTable
            funds={funds} loading={loading} error={error}
            selectedFunds={selectedFunds} onToggleFund={handleToggleFund} onShowDetail={setDetailFund}
          />
          {selectedFunds.length > 0 && (
            <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
              <span className="text-sm">{selectedFunds.length}件選択中</span>
              <button onClick={() => setActiveTab('portfolio')} className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50">
                ポートフォリオ構築 →
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'portfolio' && (
        <ErrorBoundary resetKey={`portfolio-${presetId ?? 'none'}`}>
          {confirmed && (
            <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-yellow-800">ポートフォリオは確定済みです。編集するにはロックを解除してください。</span>
              <button onClick={handleUnlock} className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50">
                ロック解除
              </button>
            </div>
          )}
          <PortfolioBuilder
            selectedFunds={selectedFunds}
            allFunds={funds}
            onUpdateWeights={(items) => handleUpdateFunds(items)}
            onGoToSimulation={handleGoToSimulation}
            disabled={confirmed}
            onPresetChange={(id) => setPresetId(id)}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'myportfolio' && (
        <ErrorBoundary resetKey={`myportfolio-${presetId ?? 'none'}`}>
          <MyPortfolio
            items={selectedFunds}
            presetId={presetId}
            confirmed={confirmed}
            onConfirm={handleConfirm}
            onUnlock={handleUnlock}
            onGoToBuilder={() => { setConfirmed(false); setActiveTab('portfolio'); }}
            savedAge={userAge}
            onAgeChange={handleAgeChange}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          <AlertSettingsPanel config={monitorConfig} onConfigChange={handleConfigChange} />
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">手動チェック</h3>
              <p className="text-xs text-gray-500">今すぐデータを取得し、アラート条件を確認します</p>
            </div>
            <button onClick={handleManualCheck} disabled={funds.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 transition-colors">
              今すぐチェック
            </button>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">アラート履歴</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">アラートはありません</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.map(alert => {
                  const sc = alert.severity === 'danger' ? 'border-red-200 bg-red-50' : alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50';
                  const bc = alert.severity === 'danger' ? 'bg-red-100 text-red-700' : alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
                  return (
                    <div key={alert.id} className={`p-3 rounded-lg border ${sc} ${alert.read ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bc}`}>
                          {alert.severity === 'danger' ? '重要' : alert.severity === 'warning' ? '注意' : '情報'}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{alert.title}</span>
                        <span className="text-[10px] text-gray-400 ml-auto">{new Date(alert.timestamp).toLocaleDateString('ja-JP')}</span>
                      </div>
                      <p className="text-xs text-gray-600">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1"><span className="font-medium">推奨: </span>{alert.suggestion}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {detailFund && (
        <FundDetailModal
          fund={detailFund}
          isSelected={selectedFunds.some(sf => sf.fund.id === detailFund.id)}
          onToggle={() => handleToggleFund(detailFund)}
          onClose={() => setDetailFund(null)}
        />
      )}
    </Layout>
  );
}
