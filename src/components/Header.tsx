import { Bot, IndianRupee, Clock, Shield } from 'lucide-react';

export function Header() {
  const now = new Date();
  const marketOpen = now.getHours() >= 9 && now.getHours() < 16;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold gradient-text">AlgoTrader AI</h1>
          <p className="text-[10px] text-gray-500">Indian Stock Market • Paper Trading</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <IndianRupee size={12} />
          <span>NSE / BSE</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock size={12} className="text-gray-400" />
          <span className="text-gray-400">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${marketOpen ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-green-400 pulse-live' : 'bg-red-400'}`}></span>
          {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-900/40 text-purple-400 text-xs font-bold">
          <Shield size={12} />
          PAPER MODE
        </div>
      </div>
    </header>
  );
}
