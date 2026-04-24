import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * サイレント自動復旧型 ErrorBoundary
 * - レンダリング中の例外を捕捉してコンソールに記録
 * - UI はエラー画面を出さず、すぐに children の再マウントを試みる
 * - 繰り返し同じエラーが出る場合のみ最小限のメッセージを表示
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  private errorCount = 0;
  private recoverTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    this.errorCount++;
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught (auto-recover):', error, info);
    // 短時間で自動的に復旧
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
    this.recoverTimer = setTimeout(() => {
      this.setState({ hasError: false, error: null });
    }, 50);
  }

  componentWillUnmount() {
    if (this.recoverTimer) clearTimeout(this.recoverTimer);
  }

  render() {
    // 復旧中も children を返すことで、ちらつきを最小化
    // 連続5回以上エラーが続く場合のみ、最低限のメッセージを表示
    if (this.state.hasError && this.errorCount >= 5) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-5 text-center">
            <p className="text-sm text-gray-600 mb-3">
              表示の読み込みに問題が発生しています。ページを再読み込みしてください。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
