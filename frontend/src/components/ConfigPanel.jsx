import { useEffect, useState } from 'react';
import { Sliders, Info, Sun } from 'lucide-react';
import { apiFetch } from '../api';

export default function ConfigPanel({ 
  onCapacityChange, 
  brightness,
  sceneArea = 80,
  onSceneAreaChange
}) {
  const [capacity, setCapacity] = useState(50);
  const [brightnessThreshold, setBrightnessThreshold] = useState(80);
  const [saved, setSaved] = useState(false);

  const fetchCapacity = async () => {
    try {
      const res = await apiFetch('/api/config/capacity');
      const data = await res.json();
      if (data.base_capacity) {
        setCapacity(data.base_capacity);
      }
    } catch (e) {
      console.error('Failed to load capacity config', e);
    }
  };

  const fetchBrightness = async () => {
    try {
      const res = await apiFetch('/api/config/brightness');
      const data = await res.json();
      if (data.brightness_threshold !== undefined) {
        setBrightnessThreshold(data.brightness_threshold);
      }
    } catch (e) {
      console.error('Failed to load brightness config', e);
    }
  };

  // Fetch initial configs on mount
  useEffect(() => {
    fetchCapacity();
    fetchBrightness();
  }, []);

  const updateCapacity = async (val) => {
    try {
      const res = await apiFetch('/api/config/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: parseInt(val) }),
      });
      const data = await res.json();
      if (data.base_capacity) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onCapacityChange) onCapacityChange(data.base_capacity);
      }
    } catch (e) {
      console.error('Failed to update capacity config', e);
    }
  };

  const updateBrightness = async (val) => {
    try {
      const res = await apiFetch('/api/config/brightness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: parseFloat(val) }),
      });
      const data = await res.json();
      if (data.brightness_threshold !== undefined) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error('Failed to update brightness config', e);
    }
  };

  const currentBrightness = brightness !== undefined ? Math.round(brightness) : 0;
  const isEnhancing = currentBrightness < brightnessThreshold && currentBrightness > 0;

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col justify-between h-full relative overflow-hidden group">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center select-none">
          <div className="flex items-center gap-2 text-text-muted">
            <Sliders className="w-4 h-4 text-primary-accent" />
            <span className="text-[10px] font-extrabold tracking-widest uppercase font-mono">Operations Config</span>
          </div>
          {saved && (
            <span className="text-[9px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              SAVED
            </span>
          )}
        </div>

        {/* Monitored Area Slider Control */}
        <div className="bg-slate-950/40 p-4 rounded-lg border border-border-subtle/50 select-none">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[9.5px] font-extrabold text-text-muted font-mono uppercase">MONITORED ZONE AREA</span>
            <span className="text-xl font-black text-primary-accent font-mono">{sceneArea} m²</span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            value={sceneArea}
            onChange={(e) => onSceneAreaChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-accent outline-none"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1 select-none">
            <span>MIN: 10 m²</span>
            <span>DEFAULT: 80 m²</span>
            <span>MAX: 300 m²</span>
          </div>
        </div>

        {/* Capacity Slider Control */}
        <div className="bg-slate-950/40 p-4 rounded-lg border border-border-subtle/50 select-none">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[9.5px] font-extrabold text-text-muted font-mono uppercase">BASE SAFETY CAPACITY</span>
            <span className="text-xl font-black text-primary-accent font-mono">{capacity} PAX</span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            onMouseUp={(e) => updateCapacity(e.target.value)}
            onTouchEnd={(e) => updateCapacity(e.target.value)}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-accent outline-none"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-1 select-none">
            <span>MIN: 10</span>
            <span>DEFAULT: 50</span>
            <span>MAX: 150</span>
          </div>
          <div className="text-[8.5px] text-slate-500 font-mono mt-2.5 leading-relaxed border-t border-border-subtle/20 pt-2">
            ℹ️ Auto-Scaling active: Safety limits dynamically down-scale (up to 30%) during rapid crowd ingress velocities.
          </div>
        </div>

        {/* Low-Light Threshold Slider Control */}
        <div className="bg-slate-950/40 p-4 rounded-lg border border-border-subtle/50 select-none flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[9.5px] font-extrabold text-text-muted font-mono uppercase">LOW-LIGHT THRESHOLD</span>
            <span className="text-xl font-black text-primary-accent font-mono">{brightnessThreshold} lx</span>
          </div>
          <input
            type="range"
            min="10"
            max="180"
            value={brightnessThreshold}
            onChange={(e) => setBrightnessThreshold(e.target.value)}
            onMouseUp={(e) => updateBrightness(e.target.value)}
            onTouchEnd={(e) => updateBrightness(e.target.value)}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-accent outline-none"
          />
          <div className="flex justify-between text-[9px] text-slate-600 font-mono select-none">
            <span>MIN: 10 lx</span>
            <span>MAX: 180 lx</span>
          </div>
          
          <div className="border-t border-border-subtle/40 pt-2 flex justify-between items-center text-[10px] font-mono">
            <span className="text-text-muted flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              LIVE SENSOR VALUE:
            </span>
            <span className="text-slate-200 font-bold">{currentBrightness} lx</span>
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-text-muted">ENHANCEMENT STATUS:</span>
            <span className={`font-bold uppercase tracking-wider ${isEnhancing ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
              {isEnhancing ? 'Active (Enhancing)' : 'Bypassed (Normal)'}
            </span>
          </div>
        </div>

        {/* System Threshold Benchmarks */}
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-lg">
            <span className="text-[9px] font-bold text-emerald-500 block uppercase">SAFE</span>
            <span className="text-[11px] text-slate-355 font-semibold">&lt; {Math.floor(capacity * 0.5)}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg">
            <span className="text-[9px] font-bold text-amber-500 block uppercase">WARN</span>
            <span className="text-[11px] text-slate-355 font-semibold">&ge; {Math.floor(capacity * 0.5)}</span>
          </div>
          <div className="bg-rose-500/5 border border-rose-500/10 p-2 rounded-lg">
            <span className="text-[9px] font-bold text-rose-500 block uppercase">CRIT</span>
            <span className="text-[11px] text-slate-355 font-semibold">&ge; {Math.floor(capacity * 0.85)}</span>
          </div>
        </div>
      </div>

      {/* Adaptive Preprocessing Info Card */}
      <div className="mt-6 flex gap-2.5 items-start bg-primary-accent/5 border border-primary-accent/10 p-3.5 rounded-lg text-text-muted text-[11px] leading-relaxed font-mono">
        <Info className="w-4 h-4 text-primary-accent shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-300 block text-[9px] tracking-wider mb-0.5">Adaptive Preprocessing</span>
          CLAHE, Gamma-Boost, and Denoising are dynamically applied only when average frame brightness falls below the Low-Light Threshold.
        </div>
      </div>
    </div>
  );
}
