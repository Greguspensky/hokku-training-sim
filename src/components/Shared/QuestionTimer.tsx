/**
 * QuestionTimer Component
 * Reusable countdown timer display for training questions
 * Shows time remaining with color coding (red when < 10s, orange when < 30s)
 */

'use client';

interface QuestionTimerProps {
  timeRemaining: number;
  isActive: boolean;
  className?: string;
}

export function QuestionTimer({
  timeRemaining,
  isActive,
  className = ''
}: QuestionTimerProps) {
  if (!isActive) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Color coding based on time remaining
  const colorClass =
    timeRemaining <= 10
      ? 'text-red-600 animate-pulse'
      : timeRemaining <= 30
      ? 'text-orange-600'
      : 'text-blue-600';

  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl px-8 py-4 shadow-lg ${className}`}
    >
      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
        Time Remaining
      </div>
      <div className={`text-6xl font-bold tabular-nums leading-tight ${colorClass}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </div>
      <div className="text-xs text-gray-500 mt-1">minutes</div>
    </div>
  );
}
