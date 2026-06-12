import { useState, useEffect } from 'react';
import { RefreshCw, Cpu, Layers, Camera, PlayCircle, Upload } from 'lucide-react';
import { apiFetch } from '../api';

export default function CameraFeed({ 
  wsConnected, 
  monitoringEnabled, 
  monitoringMessage,
  fps,
  onToggleMonitoring,
  sourceType,
  setSourceType,
  videoFiles,
  selectedFile,
  setSelectedFile,
  feedUrl,
  setFeedUrl,
  loading,
  handleSourceChange,
  fetchVideos
}) {
  const [uploading, setUploading] = useState(false);
  const [heatmapActive, setHeatmapActive] = useState(false);
  const fetchHeatmapConfig = async () => {
    try {
      const res = await apiFetch('/api/config/heatmap');
      const data = await res.json();
      if (data.heatmap_enabled !== undefined) {
        setHeatmapActive(data.heatmap_enabled);
      }
    } catch (e) {
      console.error('Failed to fetch heatmap config', e);
    }
  };

  // Load the current heatmap configuration.
  useEffect(() => {
    fetchHeatmapConfig();
  }, []);

  const toggleHeatmap = async () => {
    const nextVal = !heatmapActive;
    try {
      const res = await apiFetch('/api/config/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal }),
      });
      const data = await res.json();
      if (data.heatmap_enabled !== undefined) {
        setHeatmapActive(data.heatmap_enabled);
        setFeedUrl(`/video_feed?t=${Date.now()}`);
      }
    } catch (err) {
      console.error('Failed to toggle heatmap', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.mp4')) {
      alert('Only MP4 video files are supported.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'ok') {
        // Refresh video list
        await fetchVideos();
        // Select newly uploaded file
        setSelectedFile(data.filename);
        // Switch source to this video file
        await handleSourceChange('video', data.filename);
      } else {
        alert(data.detail || 'Failed to upload video');
      }
    } catch (err) {
      console.error('Video upload failed:', err);
      alert('Failed to upload video file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-full relative">
      {/* HUD Header */}
      <div className="px-5 py-4 border-b border-border-subtle bg-bg-panel/40 flex justify-between items-center z-10 select-none">
        <div className="flex items-center gap-2.5">
          <Camera className="w-4 h-4 text-primary-accent" />
          <span className="font-extrabold text-xs text-text-main tracking-wider uppercase font-mono">Video Input Sensors</span>
        </div>
        <div className="flex items-center gap-4">
          {/* ON/OFF Switch */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[10px] text-text-muted font-mono font-bold uppercase tracking-wider">SENSOR:</span>
            <button
              onClick={onToggleMonitoring}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none select-none ${
                monitoringEnabled ? 'bg-primary-accent' : 'bg-slate-800'
              }`}
              title={monitoringEnabled ? 'Pause monitoring & release camera' : 'Enable monitoring & activate camera'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  monitoringEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {monitoringEnabled && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono">FPS:</span>
              <span className="text-[11px] text-primary-accent font-mono font-semibold">{fps.toFixed(1)}</span>
            </div>
          )}
          {monitoringEnabled && (
            <button
              onClick={toggleHeatmap}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-bold tracking-wider font-mono uppercase transition-all cursor-pointer ${
                heatmapActive
                  ? 'bg-gradient-to-r from-amber-500 to-red-500 text-white shadow-md border border-transparent'
                  : 'bg-slate-900 border border-border-subtle text-text-muted hover:text-white'
              }`}
              title="Toggle density map heatmap overlay"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{heatmapActive ? 'Heatmap: ON' : 'Heatmap: OFF'}</span>
            </button>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
            wsConnected && monitoringEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {wsConnected && monitoringEnabled ? 'ONLINE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Main Stream Container */}
      <div className="flex-1 bg-black relative min-h-[300px] flex items-center justify-center overflow-hidden group">
        <img 
          src={feedUrl} 
          className="w-full h-full object-cover select-none pointer-events-none" 
          alt="Inference Stream"
          onError={() => {
            // Re-attempt loading on error
            setTimeout(() => {
              setFeedUrl(`/video_feed?t=${Date.now()}`);
            }, 2000);
          }}
        />

        {/* HUD Info Badge */}
        {monitoringEnabled && (
          <div className="absolute top-4 left-4 bg-bg-panel/90 backdrop-blur-md text-[10px] text-slate-200 px-2.5 py-1.5 rounded border border-border-subtle pointer-events-none flex items-center gap-2 font-mono select-none">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider">
              {sourceType === 'live' ? 'Live Camera Sensor Feed' : `Video Stream: ${selectedFile}`}
            </span>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col justify-center items-center gap-3">
            <RefreshCw className="w-8 h-8 text-primary-accent animate-spin" />
            <span className="text-sm font-semibold text-slate-300 tracking-wider font-mono">RE-CONFIGURING INPUT FEED...</span>
          </div>
        )}
      </div>

      {/* Controls Footer */}
      <div className="px-5 py-4 border-t border-border-subtle bg-bg-panel/30 flex flex-col sm:flex-row gap-4 items-center justify-between z-10 select-none">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Cpu className="w-4 h-4 text-primary-accent shrink-0" />
          <span className="text-xs font-bold text-text-muted whitespace-nowrap font-mono">SENSOR SELECT:</span>
          
          <select 
            value={sourceType}
            disabled={!monitoringEnabled}
            onChange={(e) => {
              const val = e.target.value;
              setSourceType(val);
              if (val === 'live') {
                handleSourceChange('live');
              } else if (val === 'video' && selectedFile) {
                handleSourceChange('video', selectedFile);
              }
            }}
            className={`bg-slate-900 border border-border-subtle text-slate-200 text-xs rounded-lg focus:ring-primary-accent focus:border-primary-accent block p-2 w-full sm:w-auto outline-none transition-all font-mono uppercase ${
              monitoringEnabled ? 'cursor-pointer hover:bg-slate-800/80' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <option value="live">Live Camera</option>
            <option value="video">Recorded Video</option>
          </select>
        </div>

        {sourceType === 'video' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-secondary-accent shrink-0 animate-pulse" />
              <select
                value={selectedFile}
                disabled={!monitoringEnabled || uploading}
                onChange={(e) => {
                  const file = e.target.value;
                  setSelectedFile(file);
                  handleSourceChange('video', file);
                }}
                className={`bg-slate-900 border border-border-subtle text-slate-200 text-xs rounded-lg focus:ring-primary-accent focus:border-primary-accent block p-2 w-full outline-none transition-all font-mono ${
                  monitoringEnabled && !uploading ? 'cursor-pointer hover:bg-slate-800/80' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                {videoFiles.length > 0 ? (
                  videoFiles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))
                ) : (
                  <option disabled>No videos found</option>
                )}
              </select>
            </div>
            
            <div className="relative">
              <label
                className={`flex items-center gap-1.5 px-3 py-2 bg-primary-accent/20 hover:bg-primary-accent/35 border border-primary-accent/30 text-primary-accent text-xs font-mono font-semibold rounded-lg transition-all ${
                  monitoringEnabled && !uploading ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'UPLOADING...' : 'ADD VIDEO'}</span>
                <input
                  type="file"
                  accept=".mp4"
                  className="hidden"
                  disabled={!monitoringEnabled || uploading}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>
      {monitoringMessage && (
        <div className="px-5 py-2 border-t border-amber-500/20 bg-amber-500/10 text-amber-300 text-[10px] font-mono">
          {monitoringMessage}
        </div>
      )}
    </div>
  );
}
