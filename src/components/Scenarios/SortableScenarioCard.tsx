import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Scenario } from '@/lib/scenarios'

interface SortableScenarioCardProps {
  scenario: Scenario
  children: React.ReactNode
  isDraggable: boolean
}

export function SortableScenarioCard({
  scenario,
  children,
  isDraggable
}: SortableScenarioCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scenario.id, disabled: !isDraggable })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-50 rounded-lg shadow-sm"
    >
      <div className="flex items-start">
        {/* Drag Handle - only show when draggable */}
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 p-6 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-l-lg transition-colors"
            title="Drag to reorder"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </div>
        )}

        {/* Scenario Card Content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
