/**
 * VideoPlayerWithDuration
 *
 * Custom video player with manual controls that uses database duration.
 * Needed because Safari iOS creates MP4 files with corrupted duration metadata.
 *
 * Problem: Safari prevents overriding video.duration (read-only property)
 * Solution: Hide native controls, build custom controls using database duration
 *
 * See: SAFARI_IOS_MP4_DURATION_BUG_2026-02-08.md
 */

'use client'

import { useRef, useEffect, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react'

interface VideoPlayerWithDurationProps {
  videoUrl: string
  durationSeconds: number  // Correct duration from database
  className?: string
}

export function VideoPlayerWithDuration({
  videoUrl,
  durationSeconds,
  className = ''
}: VideoPlayerWithDurationProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  /**
   * Detect corrupted duration on metadata load
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      const fileDuration = video.duration
      const isInvalid = fileDuration > 86400 || isNaN(fileDuration) || !isFinite(fileDuration)

      if (isInvalid) {
        console.warn(`⚠️ Corrupted video duration detected:`)
        console.warn(`   File metadata: ${fileDuration}s (${formatDuration(fileDuration)})`)
        console.warn(`   Database value: ${durationSeconds}s (${formatDuration(durationSeconds)})`)
        setIsCorrupted(true)
      }
      setIsLoaded(true)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)

      // Stop at actual duration if video file duration is wrong
      if (isCorrupted && video.currentTime >= durationSeconds) {
        video.pause()
        video.currentTime = durationSeconds
        setIsPlaying(false)
      }
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [durationSeconds, isCorrupted])

  /**
   * Play/Pause toggle
   */
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  /**
   * Seek to specific time
   */
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const time = parseFloat(e.target.value)
    video.currentTime = time
    setCurrentTime(time)
  }

  /**
   * Volume control
   */
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const vol = parseFloat(e.target.value)
    video.volume = vol
    setVolume(vol)
    setIsMuted(vol === 0)
  }

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume || 0.5
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }

  /**
   * Fullscreen toggle
   */
  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen?.()
    }
  }

  // Use database duration for progress bar if corrupted
  const displayDuration = isCorrupted ? durationSeconds : (videoRef.current?.duration || durationSeconds)
  const progressPercentage = (currentTime / displayDuration) * 100

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video Element (no native controls) */}
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        preload="metadata"
        onClick={togglePlay}
      >
        <source src={videoUrl} type="video/mp4" />
        <source src={videoUrl} type="video/webm" />
        Your browser does not support the video element.
      </video>

      {/* Corrupted Duration Warning Badge */}
      {isCorrupted && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-md shadow-lg z-10">
          ⚠️ Duration fixed
        </div>
      )}

      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Progress Bar */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={displayDuration}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercentage}%, #4b5563 ${progressPercentage}%, #4b5563 100%)`
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center space-x-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6" fill="currentColor" />
              )}
            </button>

            {/* Time Display */}
            <span className="text-white text-sm font-mono">
              {formatDuration(currentTime)} / {formatDuration(displayDuration)}
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-blue-400 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
        </div>
      )}
    </div>
  )
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) {
    return '0:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}
