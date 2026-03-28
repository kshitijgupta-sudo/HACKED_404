export default function WorkspaceTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)] backdrop-blur-md">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab.id
              ? "bg-[var(--primary)] text-white"
              : "bg-white/60 text-[var(--text)] hover:bg-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
