import { useState, useEffect } from 'react';
import { 
  Settings, Shield, Clock, Wifi, Power
} from 'lucide-react';
import { apiFetch } from '../api';

// Components
import CameraFeed from './CameraFeed';
import RealTimeChart from './RealTimeChart';
import LogConsole from './LogConsole';
import ConfigPanel from './ConfigPanel';

export default function DashboardPage({ 
  stats, 
  wsConnected, 
  newAlertLog, 
  monitoringEnabled,
  monitoringMessage,
  onToggleMonitoring,
  onBackToLanding,
  onCapacityChange 
}) {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [countHistory, setCountHistory] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Lifted video feed and configuration states
  const [sourceType, setSourceType] = useState('live');
  const [videoFiles, setVideoFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [sceneArea, setSceneArea] = useState(80);
  const [feedUrl, setFeedUrl] = useState(() => `/video_feed?t=${Date.now()}`);
  const [videoLoading, setVideoLoading] = useState(false);

  const fetchVideos = async () => {
    try {
      const res = await apiFetch('/api/videos');
      const data = await res.json();
      if (data.videos) {
        setVideoFiles(data.videos);
        if (data.videos.length > 0) {
          setSelectedFile(data.videos[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load videos', e);
    }
  };

  const fetchSource = async () => {
    try {
      const response = await apiFetch('/api/config/source');
      const data = await response.json();
      if (response.ok) {
        setSourceType(data.source_type);
        if (data.filename) setSelectedFile(data.filename);
      }
    } catch (error) {
      console.error('Failed to load the active source', error);
    }
  };

  // Fetch videos on mount
  useEffect(() => {
    const loadSourceConfiguration = async () => {
      await fetchVideos();
      await fetchSource();
    };
    loadSourceConfiguration();
  }, []);

  const handleSourceChange = async (type, filename = null) => {
    setVideoLoading(true);
    try {
      const body = { source_type: type };
      if (filename) body.filename = filename;

      const response = await apiFetch('/api/config/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Source switch failed');
      }
      console.log('Source switched:', result);
      
      // Cache-bust the video_feed stream to force a reconnect
      setFeedUrl(`/video_feed?t=${Date.now()}`);
    } catch (err) {
      console.error('Failed to switch source:', err);
    } finally {
      setVideoLoading(false);
    }
  };

  // Local clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Track headcount history to compute a real linear trend delta
  useEffect(() => {
    if (stats?.count !== undefined) {
      setCountHistory((prev) => {
        const next = [...prev, stats.count];
        if (next.length > 10) {
          next.shift();
        }
        return next;
      });
    }
  }, [stats?.count]);

  const countVal = stats?.count ?? 0;
  // Authentic density calculation: count / physical monitored scene area (configurable)
  const densityVal = +(countVal / sceneArea).toFixed(2);
  const riskScoreVal = stats?.risk_score !== undefined ? +(stats.risk_score * 100).toFixed(0) : 0;

  // Real rolling trend rate of change (latest headcount minus earliest in 10-frame window)
  const getTrendDelta = () => {
    if (countHistory.length < 5) return 0;
    return countHistory[countHistory.length - 1] - countHistory[0];
  };
  const trendDelta = getTrendDelta();

  // Thirty-second linear projection from the latest approximately five-second window.
  const predCount = Math.max(0, countVal + trendDelta * 6);

  const getActionRecommendation = () => {
    if (stats?.risk === 'CRITICAL') {
      return '🚨 CRITICAL WARNING: Evacuation capacity limits exceeded. Open all auxiliary exit gates immediately and redirect incoming pedestrian traffic.';
    }
    if (stats?.risk === 'WARNING') {
      return '⚠️ WARNING: Crowd levels are elevated. Direct inbound flows to secondary gates and stand by stairwell exit routes.';
    }
    return '✅ SAFE: Crowd levels and densities are within safe operational margins. No immediate mitigation required.';
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-main flex flex-col font-sans select-none relative">
      
      {/* 1. TOP HEADER */}
      <header className="w-full px-6 py-3 border-b border-border-subtle bg-bg-panel/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLanding}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border-subtle bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-all"
            title="Disconnect Stream"
          >
            <Power className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xs font-black font-mono tracking-widest uppercase leading-none text-white">CROWD DENSITY ESTIMATION SYSTEM</h1>
            <span className="text-[8px] text-text-muted font-mono uppercase tracking-wider">REAL-TIME ANALYSIS CONSOLE</span>
          </div>
        </div>

        {/* Header Telemetry Status */}
        <div className="flex items-center gap-5 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">SYSTEM STATUS:</span>
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <Wifi className="w-3.5 h-3.5" /> {wsConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary-accent" />
            <span className="text-slate-300 font-bold">{currentTime}</span>
          </div>

          {/* Settings Toggle Gear */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border border-border-subtle bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-all ${
              settingsOpen ? 'text-primary-accent border-primary-accent bg-primary-accent/10' : ''
            }`}
            title="System Threshold Configuration"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE GRID */}
      <main className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-y-auto">
        
        {/* Left Section (Live Feed and real-time graph) */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="flex-1 min-h-[380px]">
            <CameraFeed 
              wsConnected={wsConnected} 
              monitoringEnabled={monitoringEnabled}
              monitoringMessage={monitoringMessage}
              fps={stats?.fps ?? 0}
              onToggleMonitoring={onToggleMonitoring}
              sourceType={sourceType}
              setSourceType={setSourceType}
              videoFiles={videoFiles}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              feedUrl={feedUrl}
              setFeedUrl={setFeedUrl}
              loading={videoLoading}
              handleSourceChange={handleSourceChange}
              fetchVideos={fetchVideos}
            />
          </div>
          <div className="h-[230px]">
            <RealTimeChart count={countVal} />
          </div>
        </div>

        {/* Right Section (Direct System Outputs & Logs) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Card A: Safety Assessment & Density Estimation */}
          <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block font-mono border-b border-border-subtle pb-2 select-none">
              AI Safety Assessment
            </span>
            
            <div className="grid grid-cols-2 gap-4 select-none">
              {/* Headcount */}
              <div className="bg-bg-primary/45 border border-border-subtle/50 p-3.5 rounded-lg text-center">
                <span className="text-[8px] font-bold text-text-muted block font-mono uppercase">CROWD COUNT</span>
                <span className="text-2xl font-black font-mono text-white mt-1 block">{countVal}</span>
                <span className="text-[8px] text-text-muted font-mono uppercase">Detected Targets</span>
              </div>
              
              {/* Density */}
              <div className="bg-bg-primary/45 border border-border-subtle/50 p-3.5 rounded-lg text-center">
                <span className="text-[8px] font-bold text-text-muted block font-mono uppercase">DENSITY ESTIMATION</span>
                <span className="text-2xl font-black font-mono text-primary-accent mt-1 block">{densityVal}</span>
                <span className="text-[8px] text-text-muted font-mono uppercase">People / m²</span>
              </div>
            </div>

            {/* Risk and Score Bar */}
            <div className="bg-bg-primary/40 border border-border-subtle/50 p-4 rounded-lg flex flex-col gap-3 font-mono text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase font-bold">RISK EVALUATION</span>
                <span className={`text-xs font-black tracking-wider ${
                  stats?.risk === 'CRITICAL' ? 'text-critical-red animate-pulse' :
                  stats?.risk === 'WARNING' ? 'text-warning-yellow' : 'text-safe-green'
                }`}>
                  {stats?.risk || 'STANDBY'}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-[8px] text-text-muted mb-1 select-none">
                  <span>RISK ASSESSMENT SCORE</span>
                  <span>{riskScoreVal}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-border-subtle/40">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      stats?.risk === 'CRITICAL' ? 'bg-critical-red' :
                      stats?.risk === 'WARNING' ? 'bg-warning-yellow' : 'bg-safe-green'
                    }`}
                    style={{ width: `${riskScoreVal}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-border-subtle/30 pt-2 text-[9px] text-text-muted">
                <span>SAFETY CAPACITY LIMIT:</span>
                <span className="font-bold font-mono">
                  {stats?.dynamic_capacity && stats?.dynamic_capacity !== stats?.base_capacity ? (
                    <span className="text-amber-400 flex items-center gap-1 font-bold" title="Capacity limits auto-scaled down due to high ingress velocity">
                      ⚠️ {stats.dynamic_capacity} PAX (Base: {stats.base_capacity})
                    </span>
                  ) : (
                    <span className="text-slate-200">{stats?.base_capacity || 50} PAX</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card B: AI Forecasting & Action Support */}
          <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest block font-mono border-b border-border-subtle pb-2 select-none">
              AI Decision Support
            </span>

            <div className="grid grid-cols-2 gap-3.5 font-mono text-[9px] select-none">
              <div className="bg-bg-primary/45 border border-border-subtle/40 p-3 rounded-lg text-center">
                <span className="text-text-muted block uppercase font-bold">TREND VELOCITY</span>
                <span className={`text-sm font-black mt-1 block ${trendDelta > 0 ? 'text-critical-red' : trendDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {trendDelta > 0 ? `+${trendDelta} PAX / 5s` : `${trendDelta} PAX / 5s`}
                </span>
              </div>
              <div className="bg-bg-primary/45 border border-border-subtle/40 p-3 rounded-lg text-center">
                <span className="text-text-muted block uppercase font-bold">30-SEC PROJECTION</span>
                <span className="text-sm font-black text-white mt-1 block">{predCount} PAX</span>
              </div>
            </div>

            <div className="font-mono">
              <span className="text-[8px] font-bold text-text-muted block mb-1 uppercase select-none">RECOMMENDED MITIGATION DIRECTIVE</span>
              <div className={`p-3 rounded border text-[10px] leading-relaxed select-none ${
                stats?.risk === 'CRITICAL' ? 'bg-critical-red/10 border-critical-red/20 text-critical-red' :
                stats?.risk === 'WARNING' ? 'bg-warning-yellow/10 border-warning-yellow/20 text-warning-yellow' :
                'bg-slate-900 border-border-subtle text-slate-300'
              }`}>
                {getActionRecommendation()}
              </div>
            </div>
          </div>

          {/* Card C: Active Logs Feed */}
          <div className="flex-1 min-h-[180px]">
            <LogConsole wsConnected={wsConnected} newAlertLog={newAlertLog} logsHistory={stats?.logs || []} />
          </div>

        </div>
      </main>

      {/* 3. SETTINGS SIDE-OUT DRAWER OVERLAY */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm">
          {/* Backdrop Closer */}
          <div className="flex-1" onClick={() => setSettingsOpen(false)} />
          {/* Drawer Panel */}
          <div className="w-80 h-full bg-bg-panel border-l border-border-subtle p-5 flex flex-col justify-between shadow-2xl animate-slideLeft">
            <div>
              <div className="flex justify-between items-center border-b border-border-subtle pb-3 mb-6 select-none">
                <span className="text-xs font-bold font-mono tracking-widest uppercase text-white">System Settings</span>
                <button 
                  onClick={() => setSettingsOpen(false)}
                  className="text-text-muted hover:text-white font-mono text-xs cursor-pointer"
                >
                  ✕ CLOSE
                </button>
              </div>
              <ConfigPanel 
                onCapacityChange={onCapacityChange} 
                brightness={stats?.brightness} 
                sceneArea={sceneArea}
                onSceneAreaChange={setSceneArea}
              />
            </div>

            <div className="border-t border-border-subtle pt-4 flex gap-2 items-start font-mono text-[9px] text-text-muted select-none">
              <Shield className="w-4 h-4 text-primary-accent shrink-0" />
              <div>
                <span className="font-bold text-slate-300 block">THRESHOLD LOCK</span>
                Values are applied to the active runtime safety engine.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
