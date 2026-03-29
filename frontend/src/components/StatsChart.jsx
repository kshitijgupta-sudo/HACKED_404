import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  Tooltip,
  BarElement,
  LinearScale,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function StatsChart({ entries }) {
  const countsBySubject = entries.reduce((accumulator, entry) => {
    accumulator[entry.subject_name] = (accumulator[entry.subject_name] || 0) + 1;
    return accumulator;
  }, {});

  const labels = Object.keys(countsBySubject);
  const values = Object.values(countsBySubject);

  const data = {
    labels,
    datasets: [
      {
        label: "Sessions per subject",
        data: values,
        backgroundColor: ["#1f6f5f", "#c06c4e", "#cb8b2a", "#6d597a", "#355070", "#84a98c"],
        borderRadius: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur-md">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--secondary)]">Analytics</p>
        <h2 className="mt-2 text-xl font-bold text-[var(--text)]">Subject distribution</h2>
      </div>

      {labels.length ? (
        <div className="h-[280px]">
          <Bar data={data} options={options} />
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Upload a PDF to generate timetable analytics.</p>
      )}
    </section>
  );
}
