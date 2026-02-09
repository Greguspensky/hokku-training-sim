/**
 * Device Check Page
 *
 * Pre-training device setup and validation page.
 * Ensures camera, microphone, and transcription services work before session starts.
 *
 * Prevents transcription failures by validating everything upfront.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, Mic, AlertCircle, CheckCircle2, ArrowLeft, Volume2, PlayCircle, Circle } from 'lucide-react'
import { useDeviceCheck } from '@/hooks/useDeviceCheck'

export interface DeviceCheckPageProps {
  recordingPreference: 'none' | 'audio' | 'audio_video'
  videoAspectRatio?: '16:9' | '9:16' | '4:3' | '1:1'
  onComplete: (devices: { cameraId: string | null, microphoneId: string | null }) => void
  onBack: () => void
}

export function DeviceCheckPage({
  recordingPreference,
  videoAspectRatio = '16:9',
  onComplete,
  onBack
}: DeviceCheckPageProps) {
  const t = useTranslations('training')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)

  const deviceCheck = useDeviceCheck({
    recordingPreference,
    onError: (error) => {
      console.error('Device check error:', error)
    }
  })

  /**
   * Note: Permissions are now requested explicitly via buttons
   * (removed automatic request on mount for better UX)
   */

  /**
   * Run pre-flight checks after permissions granted
   */
  useEffect(() => {
    if (deviceCheck.microphonePermission === 'granted') {
      deviceCheck.checkPreFlight()
      deviceCheck.startAudioMonitoring()
    }
  }, [deviceCheck.microphonePermission])

  /**
   * Start video preview when camera selected
   */
  useEffect(() => {
    if (
      recordingPreference === 'audio_video' &&
      deviceCheck.selectedCamera &&
      deviceCheck.cameraPermission === 'granted'
    ) {
      navigator.mediaDevices
        .getUserMedia({
          video: { deviceId: { exact: deviceCheck.selectedCamera } },
          audio: false
        })
        .then(stream => {
          setVideoStream(stream)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(err => {
          console.error('Failed to start video preview:', err)
        })
    }

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [deviceCheck.selectedCamera, deviceCheck.cameraPermission, recordingPreference])

  /**
   * Handle continue button click
   */
  const handleContinue = () => {
    console.log('✅ Device check complete, continuing to session')

    // Stop all streams
    deviceCheck.stopAudioMonitoring()
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop())
    }

    onComplete({
      cameraId: deviceCheck.selectedCamera,
      microphoneId: deviceCheck.selectedMicrophone
    })
  }

  /**
   * Handle back button click
   */
  const handleBack = () => {
    console.log('⬅️ Going back to recording consent')

    // Stop all streams
    deviceCheck.stopAudioMonitoring()
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop())
    }

    onBack()
  }

  /**
   * Get audio level color
   */
  const getAudioLevelColor = () => {
    if (deviceCheck.audioLevel < 10) return 'bg-gray-300'
    if (deviceCheck.audioLevel < 30) return 'bg-red-500'
    if (deviceCheck.audioLevel < 70) return 'bg-green-500'
    return 'bg-yellow-500'
  }

  /**
   * Get audio level text
   */
  const getAudioLevelText = () => {
    if (deviceCheck.audioLevel < 10) return t('deviceCheck.microphone.levelQuiet')
    if (deviceCheck.audioLevel < 70) return t('deviceCheck.microphone.levelGood')
    return t('deviceCheck.microphone.levelLoud')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('deviceCheck.title')}
          </h1>
          <p className="text-lg text-gray-600">
            {t('deviceCheck.subtitle')}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t('deviceCheck.step', { current: 2, total: 3 })}
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Camera Preview Section */}
          {recordingPreference === 'audio_video' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Camera className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">{t('deviceCheck.camera.title')}</h2>
              </div>

              {/* Camera Permission Status */}
              <div className="mb-4">
                {deviceCheck.cameraPermission === 'granted' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('deviceCheck.camera.granted')}</span>
                  </div>
                )}
                {deviceCheck.cameraPermission === 'denied' && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('deviceCheck.camera.denied')}</span>
                  </div>
                )}
                {deviceCheck.cameraPermission === 'checking' && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm font-medium">{t('deviceCheck.permissions.checkingPermissions')}</span>
                  </div>
                )}
                {(deviceCheck.cameraPermission === 'prompt' || deviceCheck.cameraPermission === 'denied') && (
                  <button
                    onClick={deviceCheck.requestPermissions}
                    className="mt-2 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Camera className="w-5 h-5" />
                    <span>{t('deviceCheck.camera.requestPermission')}</span>
                  </button>
                )}
              </div>

              {/* Camera Device Selector */}
              {deviceCheck.cameraPermission === 'granted' && deviceCheck.cameras.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('deviceCheck.camera.selectDevice')}
                  </label>
                  <select
                    value={deviceCheck.selectedCamera || ''}
                    onChange={(e) => deviceCheck.selectCamera(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {deviceCheck.cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Video Preview */}
              {deviceCheck.cameraPermission === 'granted' && (
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: videoAspectRatio.replace(':', '/') }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Camera Denied Help */}
              {deviceCheck.cameraPermission === 'denied' && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    {t('deviceCheck.camera.helpDenied')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Microphone Check Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Mic className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">{t('deviceCheck.microphone.title')}</h2>
            </div>

            {/* Microphone Permission Status */}
            <div className="mb-4">
              {deviceCheck.microphonePermission === 'granted' && (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('deviceCheck.microphone.granted')}</span>
                </div>
              )}
              {deviceCheck.microphonePermission === 'denied' && (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('deviceCheck.microphone.denied')}</span>
                </div>
              )}
              {deviceCheck.microphonePermission === 'checking' && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-medium">{t('deviceCheck.permissions.checkingPermissions')}</span>
                </div>
              )}
              {(deviceCheck.microphonePermission === 'prompt' || deviceCheck.microphonePermission === 'denied') && (
                <button
                  onClick={deviceCheck.requestPermissions}
                  className="mt-2 w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <Mic className="w-5 h-5" />
                  <span>{t('deviceCheck.microphone.requestPermission')}</span>
                </button>
              )}
            </div>

            {/* Microphone Device Selector */}
            {deviceCheck.microphonePermission === 'granted' && deviceCheck.microphones.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('deviceCheck.microphone.selectDevice')}
                </label>
                <select
                  value={deviceCheck.selectedMicrophone || ''}
                  onChange={(e) => deviceCheck.selectMicrophone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {deviceCheck.microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Audio Level Meter */}
            {deviceCheck.microphonePermission === 'granted' && deviceCheck.isMonitoring && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('deviceCheck.microphone.audioLevel')}
                </label>
                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${getAudioLevelColor()}`}
                    style={{ width: `${deviceCheck.audioLevel}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {deviceCheck.audioLevel < 10 ? t('deviceCheck.microphone.speakNow') : getAudioLevelText()}
                </p>
              </div>
            )}

            {/* Test Recording */}
            {deviceCheck.microphonePermission === 'granted' && (
              <div className="space-y-3">
                <button
                  onClick={deviceCheck.startTestRecording}
                  disabled={deviceCheck.isRecordingTest || !deviceCheck.selectedMicrophone}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {deviceCheck.isRecordingTest ? (
                    <>
                      <Circle className="w-5 h-5 animate-pulse text-red-500 fill-current" />
                      <span>{t('deviceCheck.microphone.recording')}...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>{t('deviceCheck.microphone.testRecording')}</span>
                    </>
                  )}
                </button>

                {deviceCheck.testRecording && !deviceCheck.isRecordingTest && (
                  <button
                    onClick={deviceCheck.playTestRecording}
                    disabled={deviceCheck.isPlayingTest}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <PlayCircle className="w-5 h-5" />
                    <span>{deviceCheck.isPlayingTest ? 'Playing...' : t('deviceCheck.microphone.playTest')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pre-Flight Status Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('deviceCheck.preFlight.title')}</h2>

          <div className="space-y-3">
            {/* Token Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{t('deviceCheck.preFlight.token')}</span>
              <div className="flex items-center space-x-2">
                {deviceCheck.tokenStatus === 'checking' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">{t('deviceCheck.preFlight.checking')}</span>
                  </>
                )}
                {deviceCheck.tokenStatus === 'success' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600">Ready</span>
                  </>
                )}
                {deviceCheck.tokenStatus === 'failed' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-600">Failed</span>
                  </>
                )}
              </div>
            </div>

            {/* WebSocket Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{t('deviceCheck.preFlight.websocket')}</span>
              <div className="flex items-center space-x-2">
                {deviceCheck.websocketStatus === 'checking' && (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">{t('deviceCheck.preFlight.checking')}</span>
                  </>
                )}
                {deviceCheck.websocketStatus === 'success' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600">Ready</span>
                  </>
                )}
                {deviceCheck.websocketStatus === 'failed' && (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-600">Failed</span>
                  </>
                )}
              </div>
            </div>

            {/* Browser Compatibility */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{t('deviceCheck.preFlight.browser')}</span>
              <div className="flex items-center space-x-2">
                {deviceCheck.browserCompatibility.webrtc && deviceCheck.browserCompatibility.mediaRecorder ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600">Compatible</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-600">Not Compatible</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Success Message */}
          {deviceCheck.isReady && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">{t('deviceCheck.preFlight.success')}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {deviceCheck.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{deviceCheck.error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('deviceCheck.buttons.back')}</span>
          </button>

          <button
            onClick={handleContinue}
            disabled={!deviceCheck.isReady}
            className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
            title={!deviceCheck.isReady ? 'Complete device setup to continue' : ''}
          >
            <span>{t('deviceCheck.buttons.continue')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
