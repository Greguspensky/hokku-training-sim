/**
 * Device Detection Utilities
 * Detect device type for optimal video aspect ratio selection
 */

/**
 * Detect if the current device is a mobile device
 * Uses both user agent and screen size for better accuracy
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Check user agent for mobile keywords
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase())

  // Check screen size (mobile devices typically have width <= 768px)
  const isMobileScreen = window.innerWidth <= 768

  // Check if device has touch support (most mobile devices)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Consider it mobile if:
  // 1. User agent indicates mobile OR
  // 2. Small screen AND has touch support
  return isMobileUA || (isMobileScreen && hasTouch)
}

/**
 * Get the optimal default video aspect ratio based on device type
 * - Mobile devices: 9:16 (portrait)
 * - Desktop/laptop: 16:9 (landscape)
 */
export function getDefaultVideoAspectRatio(): '16:9' | '9:16' | '4:3' | '1:1' {
  return isMobileDevice() ? '9:16' : '16:9'
}

/**
 * Get a user-friendly device type label
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'

  const width = window.innerWidth

  if (width <= 768) return 'mobile'
  if (width <= 1024) return 'tablet'
  return 'desktop'
}
