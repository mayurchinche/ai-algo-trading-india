import { Component, type ReactNode } from 'react';
import { downloadJSON } from '../services/journalStorage';
export class JournalErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="app-main"><section className="card"><h1>Journal needs attention</h1><p role="alert">{this.state.error}</p><p>Trading is paused. Existing records have not been reset.</p><button className="primary-button" onClick={() => downloadJSON('journal-recovery.json', { ledger: localStorage.getItem('paper_ledger_v3'), legacy: localStorage.getItem('paper_trades_v2'), signals: localStorage.getItem('signal_history') })}>Export original records</button></section></main>;
  }
}
