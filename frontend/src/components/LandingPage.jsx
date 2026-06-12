import { useState } from 'react';
import { Shield, ArrowRight, Play, Activity } from 'lucide-react';

export default function LandingPage({ onEnterMonitor }) {
  const [demoActive, setDemoActive] = useState(false);

  return (
    <div className="relative min-h-screen bg-bg-primary text-text-main flex flex-col justify-between overflow-hidden app-grid">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary-accent/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-secondary-accent/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 w-full px-8 py-5 border-b border-border-subtle bg-bg-panel/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-primary-accent to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-accent/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-sm text-text-main uppercase tracking-wider font-mono">
              Crowd Density Estimation System
            </span>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-text-muted">
              <a href="#architecture" className="hover:text-text-main transition-colors">Architecture</a>
              <a href="#technology" className="hover:text-text-main transition-colors">Technology</a>
              <button onClick={() => setDemoActive(true)} className="hover:text-text-main cursor-pointer transition-colors font-semibold">Demo</button>
            </nav>
            <button
              onClick={onEnterMonitor}
              className="bg-primary-accent hover:bg-primary-accent/90 text-white font-bold py-2 px-4 rounded-lg text-xs font-mono transition-all duration-300 cursor-pointer shadow-md shadow-primary-accent/10"
            >
              Launch Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Hero Content Grid */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12 lg:py-20">
        
        {/* Left Column: Title & Subheading */}
        <div className="lg:col-span-6 flex flex-col justify-center text-left">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-accent/10 border border-primary-accent/20 w-fit mb-6">
            <Activity className="w-3.5 h-3.5 text-primary-accent sensor-pulse" />
            <span className="text-[10px] font-extrabold text-primary-accent tracking-widest uppercase font-mono">
              Computer Vision & Video Analytics
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6">
            Real-Time <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-accent via-indigo-400 to-secondary-accent">
              Crowd Density Estimation System
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-text-muted leading-relaxed mb-10 max-w-xl">
            Real-time crowd intelligence, density estimation, risk forecasting, and emergency response support for safer public spaces. Built for smart cities, transportation hubs, and stadiums.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <button
              onClick={onEnterMonitor}
              className="group relative inline-flex items-center justify-center gap-2.5 bg-primary-accent hover:bg-primary-accent/90 text-white font-bold py-4.5 px-8 rounded-xl shadow-xl shadow-primary-accent/20 transition-all duration-300 hover:scale-[1.02] cursor-pointer text-sm font-mono"
            >
              LAUNCH DASHBOARD
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => setDemoActive(true)}
              className="inline-flex items-center justify-center gap-2 bg-slate-900/80 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-border-subtle py-4.5 px-8 rounded-xl transition-all duration-300 cursor-pointer text-sm font-mono"
            >
              <Play className="w-4 h-4" />
              WATCH SYSTEM DEMO
            </button>
          </div>

          {/* Authentic System Architecture Specs */}
          <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-border-subtle/80 max-w-lg select-none">
            <div>
              <span className="text-[10px] text-text-muted block mb-1 font-mono uppercase tracking-wider font-bold">DETECTOR ENGINE</span>
              <span className="text-sm font-extrabold text-white font-mono">YOLOv8m (Fine-Tuned)</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block mb-1 font-mono uppercase tracking-wider font-bold">DENSITY ESTIMATOR</span>
              <span className="text-sm font-extrabold text-white font-mono">CSRNet-Ready Pipeline</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block mb-1 font-mono uppercase tracking-wider font-bold">TRACKER ENGINE</span>
              <span className="text-sm font-extrabold text-white font-mono">ByteTrack</span>
            </div>
          </div>
        </div>

        {/* Right Column: System Processing Pipeline Flowchart */}
        <div className="lg:col-span-6 relative flex justify-center">
          <div className="w-full max-w-[520px] aspect-square rounded-2xl border border-border-subtle/60 bg-bg-panel/45 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
            
            {/* Inner Flow Diagram Wrapper */}
            <div className="relative h-full flex flex-col justify-between select-none">
              
              {/* Pipeline Header */}
              <div className="flex justify-between items-center border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-accent" />
                  <span className="text-[10px] font-bold text-slate-300 font-mono tracking-widest">
                    SYSTEM PIPELINE ARCHITECTURE
                  </span>
                </div>
                <span className="text-[9px] text-text-muted font-mono tracking-widest">
                  FUSION FLOW
                </span>
              </div>

              {/* Architecture Flowchart */}
              <div className="flex-1 flex flex-col justify-center gap-2.5 my-4">
                
                {/* Step 1: Input */}
                <div className="flex flex-col items-center">
                  <div className="bg-bg-primary/80 border border-slate-700/60 p-2.5 rounded-lg w-full text-center shadow-lg">
                    <span className="text-[8px] text-text-muted font-mono block font-bold">STAGE 1: INPUT SENSOR FEED</span>
                    <span className="text-xs font-bold text-white font-mono">Live Camera Feed / Recorded Video Stream (.MP4)</span>
                  </div>
                  {/* Connecting Line */}
                  <div className="w-px h-3 bg-gradient-to-b from-slate-700/60 to-primary-accent" />
                </div>

                {/* Step 2: Parallel Model Inference */}
                <div className="grid grid-cols-2 gap-4 relative">
                  {/* Background link bar */}
                  <div className="absolute top-0 left-1/4 right-1/4 h-px bg-primary-accent/30" />
                  
                  {/* YOLOv8 + ByteTrack Card */}
                  <div className="bg-bg-primary/80 border border-primary-accent/30 p-2.5 rounded-lg text-center shadow-md">
                    <span className="text-[8px] text-primary-accent font-mono block font-bold">STAGE 2A: DETECTOR & TRACKER</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">YOLOv8m + ByteTrack</span>
                    <span className="text-[9px] text-text-muted font-mono block mt-1">Extracts Bounding Boxes & Tracking IDs</span>
                  </div>

                  {/* CSRNet Card */}
                  <div className="bg-bg-primary/80 border border-primary-accent/30 p-2.5 rounded-lg text-center shadow-md">
                    <span className="text-[8px] text-primary-accent font-mono block font-bold">STAGE 2B: DENSITY ESTIMATION</span>
                    <span className="text-xs font-bold text-slate-200 block mt-0.5">CSRNet Model</span>
                    <span className="text-[9px] text-text-muted font-mono block mt-1">Generates Continuous Crowd Density Maps</span>
                  </div>
                </div>

                {/* Connecting Lines Merging */}
                <div className="flex flex-col items-center">
                  <div className="w-px h-3 bg-gradient-to-b from-primary-accent to-slate-700/60" />
                </div>

                {/* Step 3: Fusion Engine */}
                <div className="flex flex-col items-center">
                  <div className="bg-bg-primary/80 border border-slate-700/60 p-2.5 rounded-lg w-full text-center shadow-lg">
                    <span className="text-[8px] text-text-muted font-mono block font-bold">STAGE 3: HYBRID FUSION ENGINE</span>
                    <span className="text-xs font-bold text-slate-200">Counts Weighted Averaging & Outlier Filtering</span>
                  </div>
                  <div className="w-px h-3 bg-slate-700/60" />
                </div>

                {/* Step 4: Safety Assessment Engine */}
                <div className="flex flex-col items-center">
                  <div className="bg-bg-primary/80 border border-slate-700/60 p-2.5 rounded-lg w-full text-center shadow-lg">
                    <span className="text-[8px] text-text-muted font-mono block font-bold">STAGE 4: SAFETY ASSESSMENT ENGINE</span>
                    <span className="text-xs font-bold text-slate-200">Rule Evaluation & Dynamic Threshold Mitigation</span>
                  </div>
                </div>

              </div>

              {/* System Engine Operational Status */}
              <div className="border-t border-border-subtle pt-3 mt-1 grid grid-cols-4 gap-1 text-center bg-slate-950/40 p-2 rounded-lg">
                <div>
                  <span className="text-[7px] text-text-muted block font-mono uppercase tracking-wider font-bold">DETECTION</span>
                  <span className="text-[9px] font-extrabold text-safe-green font-mono uppercase tracking-wider block mt-0.5">ACTIVE</span>
                </div>
                <div>
                  <span className="text-[7px] text-text-muted block font-mono uppercase tracking-wider font-bold">TRACKING</span>
                  <span className="text-[9px] font-extrabold text-safe-green font-mono uppercase tracking-wider block mt-0.5">ACTIVE</span>
                </div>
                <div>
                  <span className="text-[7px] text-text-muted block font-mono uppercase tracking-wider font-bold">DENSITY</span>
                  <span className="text-[9px] font-extrabold text-safe-green font-mono uppercase tracking-wider block mt-0.5">ACTIVE</span>
                </div>
                <div>
                  <span className="text-[7px] text-text-muted block font-mono uppercase tracking-wider font-bold">PREDICTION</span>
                  <span className="text-[9px] font-extrabold text-indigo-400 font-mono uppercase tracking-wider block mt-0.5">READY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Architecture Section */}
      <section id="architecture" className="relative z-10 max-w-7xl mx-auto w-full px-8 py-16 border-t border-border-subtle/50">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-6 font-mono uppercase">System Pipeline Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md">
            <div className="text-primary-accent font-bold text-lg mb-2 font-mono">01 / INPUT</div>
            <h3 className="text-white font-bold mb-2">Sensor Video Stream</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Accepts high-definition real-time video inputs from camera sensors or offline recorded video files (MP4 format).
            </p>
          </div>
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md">
            <div className="text-primary-accent font-bold text-lg mb-2 font-mono">02 / INFERENCE</div>
            <h3 className="text-white font-bold mb-2">Extensible Inference</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              YOLOv8m performs active detection while an asynchronous sampling hook is ready for an independent CSRNet model.
            </p>
          </div>
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md">
            <div className="text-primary-accent font-bold text-lg mb-2 font-mono">03 / TRACKING</div>
            <h3 className="text-white font-bold mb-2">ByteTrack Association</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Performs temporal identification and velocity calculation across frames, maintaining persistent identities for targets.
            </p>
          </div>
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md">
            <div className="text-primary-accent font-bold text-lg mb-2 font-mono">04 / ASSESSMENT</div>
            <h3 className="text-white font-bold mb-2">Safety Mitigation</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Evaluates crowd statistics against dynamic thresholds to trigger warnings and action directives.
            </p>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="relative z-10 max-w-7xl mx-auto w-full px-8 py-16 border-t border-border-subtle/50">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-6 font-mono uppercase">Core Technologies</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="font-bold text-white mb-2 font-mono uppercase text-sm">YOLOv8m Object Detector</div>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                Fine-tuned on the CrowdHuman dataset to optimize head and upper body detection in highly congested or overlapping environments.
              </p>
            </div>
            <span className="text-[10px] text-primary-accent font-mono font-bold uppercase">Object Detection & Localisation</span>
          </div>
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="font-bold text-white mb-2 font-mono uppercase text-sm">CSRNet Density Estimator</div>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                Dilated convolutional neural network designed for congested scene crowd counting and continuous density map generation.
              </p>
            </div>
            <span className="text-[10px] text-primary-accent font-mono font-bold uppercase">Density Map Regression</span>
          </div>
          <div className="bg-bg-panel/40 border border-border-subtle p-5 rounded-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="font-bold text-white mb-2 font-mono uppercase text-sm">ByteTrack Multi-Object Tracker</div>
              <p className="text-xs text-text-muted leading-relaxed mb-4">
                Associates bounding boxes across frames by utilizing detection confidence scores, tracking targets through occlusions.
              </p>
            </div>
            <span className="text-[10px] text-primary-accent font-mono font-bold uppercase">Temporal Data Association</span>
          </div>
        </div>
      </section>

      {/* Demo Modal */}
      {demoActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-2xl p-6 relative shadow-2xl">
            <button 
              onClick={() => setDemoActive(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white font-mono text-sm cursor-pointer"
            >
              ✕ CLOSE
            </button>
            <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase tracking-wider">
              System Demo
            </h3>
            <p className="text-xs text-text-muted mb-6">
              Real-time AI crowd tracking and density estimation system. The pipeline performs bounding box tracking, density map estimation, and safety threshold calculations.
            </p>
            {/* Interactive screenshot placeholder or descriptive layout */}
            <div className="aspect-video bg-black/90 rounded-xl border border-border-subtle/60 flex flex-col items-center justify-center p-4">
              <Play className="w-12 h-12 text-primary-accent mb-3 animate-pulse" />
              <span className="text-xs font-mono text-slate-300">LIVE SENSOR INPUTS</span>
              <span className="text-[10px] font-mono text-text-muted mt-1">Launch the dashboard to monitor active camera sensors and real-time outputs.</span>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setDemoActive(false);
                  onEnterMonitor();
                }}
                className="bg-primary-accent hover:bg-primary-accent/90 text-white font-bold py-2.5 px-6 rounded-lg text-xs font-mono cursor-pointer"
              >
                PROCEED TO MONITORING CONSOLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Powered By Panel */}
      <footer className="relative z-10 w-full py-6 border-t border-border-subtle bg-bg-panel/20 text-center">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            © 2026 AI Crowd Intelligence Portfolio Project.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['FastAPI', 'YOLOv8', 'CSRNet', 'ByteTrack', 'PyTorch', 'React'].map((tech) => (
              <span 
                key={tech} 
                className="px-2.5 py-1 rounded bg-bg-panel/60 text-[9px] font-bold text-slate-400 border border-border-subtle font-mono"
              >
                {tech.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
