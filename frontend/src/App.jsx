import { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import DashboardPage from './components/DashboardPage';
import { apiFetch } from './api';

function App() {
  const [page, setPage] = useState(() => {
    return window.location.pathname === '/monitor' ? 'monitor' : 'landing';
  });

  const [stats, setStats] = useState({
    count: 0,
    risk: 'Initializing...',
    risk_score: 0.0,
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [newAlertLog, setNewAlertLog] = useState(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [monitoringMessage, setMonitoringMessage] = useState('');

  // Read global monitoring state without changing it merely because a user
  // opens or leaves the dashboard.
  useEffect(() => {
    const syncMonitoring = async () => {
      try {
        const res = await apiFetch('/api/config/monitoring');
        const data = await res.json();
        if (data.monitoring_enabled !== undefined) {
          setMonitoringEnabled(data.monitoring_enabled);
        }
      } catch (e) {
        console.error('Failed to sync monitoring state with page', e);
      }
    };

    syncMonitoring();
  }, []);

  const handleToggleMonitoring = async () => {
    const nextVal = !monitoringEnabled;
    setMonitoringMessage('');
    try {
      const res = await apiFetch('/api/config/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMonitoringMessage(data.detail || 'Unable to start the selected video source.');
        return;
      }
      if (data.monitoring_enabled !== undefined) {
        setMonitoringEnabled(data.monitoring_enabled);
        setNewAlertLog({
          timestamp: new Date().toISOString(),
          risk_level: 'INFO',
          message: `System monitoring toggled ${nextVal ? 'ON (Camera active)' : 'OFF (Camera released)'}.`,
        });
      }
    } catch (e) {
      console.error('Failed to toggle monitoring', e);
      setMonitoringMessage('The monitoring service could not be reached.');
    }
  };

  // Sync window back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setPage(window.location.pathname === '/monitor' ? 'monitor' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle page transitions with URL history updates
  const navigateTo = (targetPage) => {
    setPage(targetPage);
    const path = targetPage === 'monitor' ? '/monitor' : '/';
    window.history.pushState({}, '', path);
  };

  // WebSocket Connection Lifecycle
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let active = true;

    const connectWS = () => {
      if (!active) return;

      // Detect dev port 5173 vs production
      const isDev = window.location.port === '5173';
      const wsHost = isDev ? 'localhost:8000' : window.location.host;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      console.log(`Connecting WebSocket to: ${wsProtocol}//${wsHost}/ws/stats`);
      ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/stats`);

      ws.onopen = () => {
        console.log('WebSocket stats channel open.');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStats(data);
        } catch (e) {
          console.error('Failed to parse WebSocket JSON', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket channel closed. Retrying in 3s...');
        setWsConnected(false);
        if (active) {
          reconnectTimer = setTimeout(connectWS, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket encountered an error', err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      active = false;
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const handleCapacityChange = (newCapacity) => {
    // Optionally trigger a log of capacity adjustment
    setNewAlertLog({
      timestamp: new Date().toISOString(),
      risk_level: 'INFO',
      message: `System base safety capacity adjusted to: ${newCapacity} targets.`,
    });
  };

  if (page === 'monitor') {
    return (
      <DashboardPage
        stats={stats}
        wsConnected={wsConnected}
        newAlertLog={newAlertLog}
        monitoringEnabled={monitoringEnabled}
        monitoringMessage={monitoringMessage}
        onToggleMonitoring={handleToggleMonitoring}
        onBackToLanding={() => navigateTo('landing')}
        onCapacityChange={handleCapacityChange}
      />
    );
  }

  return <LandingPage onEnterMonitor={() => navigateTo('monitor')} />;
}

export default App;
