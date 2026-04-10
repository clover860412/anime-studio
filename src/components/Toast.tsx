import { useApp } from '../context/AppContext';

export default function Toast() {
  const { state } = useApp();

  if (!state.toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
      <div
        className={`
          px-4 py-3 rounded-lg shadow-lg text-white text-sm
          ${state.toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}
        `}
      >
        {state.toast.message}
      </div>
    </div>
  );
}
