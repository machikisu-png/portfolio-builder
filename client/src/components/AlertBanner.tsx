import { useState } from 'react';
import type { Alert } from '../lib/alertTypes';

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss: (alertId: string) => void;
  onDismissAll: () => void;
  onViewDetail: (alert: Alert) => void;
}

const severityStyles = {
  danger: { bg: 'bg-red-50 border-red-200', icon: 'text-red-500', title: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  warning: { bg: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-500', title: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
  info: { bg: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', title: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今日';
  if (days === 1) return '昨日';
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}

export default function AlertBanner({ alerts, onDismiss, onDismissAll, onViewDetail }: AlertBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const unread = alerts.filter(a => !a.read);
  if (unread.length === 0) return null;

  const dangerCount = unread.filter(a => a.severity === 'danger').length;
  const warningCount = unread.filter(a => a.severity === 'warning').length;

  return (
    <div className="mb-4">
      {/* サマリーバー */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`rounded-lg border px-4 py-3 cursor-pointer transition-all hover:shadow-md ${
          dangerCount > 0 ? 'bg-red-50 border-red-200' : warningCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {dangerCount > 0 ? '\u26a0\ufe0f' : warningCount > 0 ? '\u26a0' : '\u2139\ufe0f'}
            </span>
            <div>
              <span className="text-sm font-semibold text-gray-800">
                {unread.length}件のアラート
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {dangerCount > 0 && <span className="text-red-600 font-bold mr-1">重要{dangerCount}件</span>}
                {warningCount > 0 && <span className="text-yellow-600 mr-1">注意{warningCount}件</span>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); onDismissAll(); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              すべて既読
            </button>
            <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {/* 展開時の詳細リスト */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {unread.map(alert => {
            const style = severityStyles[alert.severity];
            return (
              <div key={alert.id} className={`rounded-lg border p-3 ${style.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                        {alert.severity === 'danger' ? '重要' : alert.severity === 'warning' ? '注意' : '情報'}
                      </span>
                      <span className={`text-sm font-semibold ${style.title}`}>{alert.title}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-1.5">{alert.message}</p>
                    <div className="bg-white/60 rounded p-2">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold">推奨アクション: </span>
                        {alert.suggestion}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDismiss(alert.id)}
                    className="text-gray-400 hover:text-gray-600 text-lg shrink-0"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
