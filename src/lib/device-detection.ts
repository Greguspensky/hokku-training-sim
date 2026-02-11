/**
 * Device Detection Utility
 * Detects device type, OS, browser, and other environment information
 * Created: 2026-02-11
 */

export interface DeviceInfo {
  device_type: 'mobile' | 'tablet' | 'desktop'
  os: 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'Unknown'
  os_version: string
  browser: 'Safari' | 'Chrome' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung Internet' | 'Unknown'
  browser_version: string
  screen_resolution: string
  user_agent: string
  is_mobile: boolean
  is_touch_device: boolean
  timestamp: string
}

export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent
  return {
    device_type: getDeviceType(),
    os: getOS(),
    os_version: getOSVersion(),
    browser: getBrowser(),
    browser_version: getBrowserVersion(),
    screen_resolution: getScreenResolution(),
    user_agent: userAgent,
    is_mobile: isMobile(),
    is_touch_device: isTouchDevice(),
    timestamp: new Date().toISOString()
  }
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const userAgent = navigator.userAgent.toLowerCase()
  const screenWidth = window.screen.width
  const isTablet = (
    (userAgent.includes('ipad')) ||
    (userAgent.includes('tablet')) ||
    (screenWidth >= 768 && screenWidth <= 1024 && isTouchDevice())
  )
  if (isTablet) return 'tablet'
  if (isMobile()) return 'mobile'
  return 'desktop'
}

function isMobile(): boolean {
  const userAgent = navigator.userAgent.toLowerCase()
  return (
    userAgent.includes('mobile') ||
    userAgent.includes('android') ||
    userAgent.includes('iphone')
  )
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function getOS(): DeviceInfo['os'] {
  const userAgent = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'iOS'
  if (/Android/.test(userAgent)) return 'Android'
  if (/Win/.test(navigator.platform)) return 'Windows'
  if (/Mac/.test(navigator.platform)) return 'macOS'
  if (/Linux/.test(navigator.platform)) return 'Linux'
  return 'Unknown'
}

function getOSVersion(): string {
  const ua = navigator.userAgent
  const iosMatch = ua.match(/OS (\d+)[_.](\d+)/)
  if (iosMatch) return iosMatch[1] + '.' + iosMatch[2]
  const androidMatch = ua.match(/Android (\d+\.?\d*)/)
  if (androidMatch) return androidMatch[1]
  return 'Unknown'
}

function getBrowser(): DeviceInfo['browser'] {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('edg/')) return 'Edge'
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome'
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
  if (ua.includes('firefox')) return 'Firefox'
  return 'Unknown'
}

function getBrowserVersion(): string {
  const ua = navigator.userAgent
  const browser = getBrowser()
  if (browser === 'Safari') {
    const match = ua.match(/Version\/(\d+\.\d+)/)
    if (match) return match[1]
  }
  if (browser === 'Chrome') {
    const match = ua.match(/Chrome\/(\d+\.\d+)/)
    if (match) return match[1]
  }
  return 'Unknown'
}

function getScreenResolution(): string {
  return window.screen.width + 'x' + window.screen.height
}

export function getDeviceDescription(deviceInfo: DeviceInfo): string {
  const parts = [deviceInfo.device_type]
  if (deviceInfo.os !== 'Unknown') parts.push(deviceInfo.os + ' ' + deviceInfo.os_version)
  if (deviceInfo.browser !== 'Unknown') parts.push(deviceInfo.browser)
  return parts.join(' • ')
}

export function getDeviceEmoji(deviceInfo: DeviceInfo): string {
  return deviceInfo.device_type === 'desktop' ? '💻' : '📱'
}

/**
 * Get the optimal default video aspect ratio based on device type
 * - Mobile devices: 9:16 (portrait)
 * - Desktop/laptop: 16:9 (landscape)
 */
export function getDefaultVideoAspectRatio(): '16:9' | '9:16' | '4:3' | '1:1' {
  if (typeof window === 'undefined') return '16:9' // SSR fallback

  const deviceInfo = getDeviceInfo()
  return deviceInfo.device_type === 'mobile' ? '9:16' : '16:9'
}
