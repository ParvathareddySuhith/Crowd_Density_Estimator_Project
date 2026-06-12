import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export default function LogConsole({ wsConnected, newAlertLog, logsHistory = [] }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const consoleRef = useRef(null);

  // Sync with WebSocket logs history
  useEffect(() => {
    if (logsHistory && logsHistory.length > 0) {
      // Sort ascending by timestamp for terminal view
      const sorted = [...logsHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setLogs(sorted);
    }
  }, [logsHistory]);

  // Listen to new live alert logs from parent WebSocket (retained for client-side events)
  useEffect(() => {
    if (newAlertLog) {
      setLogs((prev) => {
        // Prevent duplicate logs if they arrive very close
        if (prev.length > 0 && prev[prev.length - 1].message === newAlertLog.message && Math.abs(new Date(prev[prev.length - 1].timestamp) - new Date(newAlertLog.timestamp)) < 1000) {
          return prev;
        }
        return [...prev, newAlertLog].slice(-100);
      });
    }
  }, [newAlertLog]);

  // Auto-scroll to bottom of logs inside the console container
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, filter]);

  const getFilteredLogs = () => {
    if (filter === 'WARNINGS') {
      return logs.filter((l) => l.risk_level === 'WARNING');
    }
    if (filter === 'CRITICAL') {
      return logs.filter((l) => l.risk_level === 'CRITICAL');
    }
    return logs;
  };

  const getRiskStyles = (level) => {
    if (level === 'CRITICAL') return 'text-critical-red bg-critical-red/10 border-critical-red/20';
    if (level === 'WARNING') return 'text-warning-yellow bg-warning-yellow/10 border-warning-yellow/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col h-[350px] relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 z-10 select-none">
        <div className="flex items-center gap-2 text-text-muted">
          <Terminal className="w-4 h-4 text-primary-accent" />
          <span className="text-[10px] font-extrabold tracking-widest uppercase font-mono">System Console Logging</span>
        </div>

        {/* Filter Toggle Buttons */}
        <div className="flex items-center gap-1 bg-slate-950/65 p-1 rounded-lg border border-border-subtle">
          {['ALL', 'WARNINGS', 'CRITICAL'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[9px] font-bold tracking-wider cursor-pointer font-mono uppercase transition-all ${
                filter === f
                  ? 'bg-primary-accent text-white shadow-md'
                  : 'text-text-muted hover:text-slate-355'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Output Screen */}
      <div ref={consoleRef} className="flex-1 bg-slate-950/90 border border-border-subtle rounded-lg p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2 relative">
        <div className="text-slate-600 border-b border-border-subtle pb-2 mb-1 flex justify-between items-center select-none">
          <span>STDOUT LOGGING FEED</span>
          <span className="flex items-center gap-1 text-[9px]">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {wsConnected ? 'ACTIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {getFilteredLogs().length > 0 ? (
            getFilteredLogs().map((log) => (
              <div key={log.id || log.timestamp} className="flex items-start gap-2.5 border-b border-slate-950/20 pb-1 hover:bg-slate-900/10 px-1 rounded transition-colors">
                <span className="text-slate-600 select-none">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold tracking-wide select-none uppercase ${getRiskStyles(log.risk_level)}`}>
                  {log.risk_level}
                </span>
                <span className="text-slate-300 font-medium">
                  {log.message}
                </span>
                {log.count !== undefined && (
                  <span className="text-primary-accent/80 font-semibold ml-auto select-none font-mono">
                    N={log.count}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="text-slate-700 italic text-center py-8">
              No matching records in log buffer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
