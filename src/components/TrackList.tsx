'use client'

import { Track } from '@/lib/scenarios'

interface TrackListProps {
  tracks: Track[]
  onSelectTrack?: (track: Track) => void
  onEditTrack?: (track: Track) => void
  onDeleteTrack?: (trackId: string) => void
}

export default function TrackList({ 
  tracks, 
  onSelectTrack, 
  onEditTrack, 
  onDeleteTrack 
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tracks yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first training track to get started.
          </p>
        </div>
      </div>
    )
  }

  const formatTargetAudience = (audience: string) => {
    return audience.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="space-y-4">
      {tracks.map((track) => (
        <div
          key={track.id}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {track.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {track.description}
              </p>
              <div className="mt-3 flex items-center space-x-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {formatTargetAudience(track.target_audience)}
                </span>
                {track.scenario_count !== undefined && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    📝 {track.scenario_count} scenario{track.scenario_count !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  Created {new Date(track.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {onSelectTrack && (
                <button
                  onClick={() => onSelectTrack(track)}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Scenarios
                </button>
              )}
              
              {onEditTrack && (
                <button
                  onClick={() => onEditTrack(track)}
                  className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1"
                  title="Edit track"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              
              {onDeleteTrack && (
                <button
                  onClick={() => onDeleteTrack(track.id)}
                  className="text-sm text-red-600 hover:text-red-900 px-2 py-1"
                  title="Delete track"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}