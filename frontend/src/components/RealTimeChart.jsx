import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { AreaChart } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function RealTimeChart({ count }) {
  const [chartData, setChartData] = useState({
    labels: Array(30).fill(''),
    datasets: [
      {
        label: 'Crowd Estimate',
        data: Array(30).fill(0),
        borderColor: 'rgb(109, 93, 252)',
        backgroundColor: 'rgba(109, 93, 252, 0.05)',
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: 'rgb(109, 93, 252)',
        pointHoverBorderColor: '#fff',
      },
    ],
  });

  useEffect(() => {
    if (count !== undefined && count !== null) {
      setChartData((prev) => {
        const nextLabels = [...prev.labels, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })];
        const nextData = [...prev.datasets[0].data, count];

        // Keep last 30 readings
        if (nextLabels.length > 30) {
          nextLabels.shift();
          nextData.shift();
        }

        return {
          labels: nextLabels,
          datasets: [
            {
              ...prev.datasets[0],
              data: nextData,
            },
          ],
        };
      });
    }
  }, [count]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(11, 18, 32, 0.95)',
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        titleFont: { family: 'monospace', size: 10 },
        bodyFont: { family: 'monospace', size: 11 },
        padding: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          display: false, // Hide labels for clean minimalist style
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.02)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            family: 'monospace',
            size: 9,
          },
          stepSize: 10,
        },
      },
    },
    animation: {
      duration: 300,
    },
  };

  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col h-full relative overflow-hidden">
      <div className="flex justify-between items-center mb-4 select-none">
        <div className="flex items-center gap-2 text-text-muted">
          <AreaChart className="w-4 h-4 text-primary-accent" />
          <span className="text-[10px] font-extrabold tracking-widest uppercase font-mono">Crowd Volume History</span>
        </div>
        <span className="text-[9px] text-primary-accent font-mono bg-primary-accent/10 px-2 py-0.5 rounded border border-primary-accent/20">
          REAL-TIME TELEMETRY
        </span>
      </div>

      <div className="flex-1 min-h-[140px] relative">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
