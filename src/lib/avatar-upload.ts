// Avatar upload utilities for voice settings
import { supabase } from '@/lib/supabase'

const AVATAR_BUCKET = 'voice-avatars'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const TARGET_SIZE = 256 // 256x256px

/**
 * Resize image to target dimensions while maintaining aspect ratio
 */
export async function resizeImage(file: File, targetSize: number = TARGET_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        // Create canvas with target dimensions
        const canvas = document.createElement('canvas')
        canvas.width = targetSize
        canvas.height = targetSize

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Calculate dimensions to cover the square (crop if needed)
        const scale = Math.max(targetSize / img.width, targetSize / img.height)
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        const x = (targetSize - scaledWidth) / 2
        const y = (targetSize - scaledHeight) / 2

        // Draw image centered and scaled
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight)

        // Convert to blob (WebP for best compression, fallback to PNG)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create image blob'))
            }
          },
          'image/webp',
          0.9
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` }
  }

  // Check specific image types
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only PNG, JPEG, and WebP images are allowed' }
  }

  return { valid: true }
}

/**
 * Upload voice avatar to Supabase Storage
 */
export async function uploadVoiceAvatar(voiceId: string, file: File): Promise<string> {
  // Validate file
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Resize image
  const resizedBlob = await resizeImage(file)

  // Generate file path
  const fileExt = 'webp'
  const filePath = `${voiceId}.${fileExt}`

  // Delete existing avatar if exists
  await supabase.storage.from(AVATAR_BUCKET).remove([filePath])

  // Upload new avatar
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, resizedBlob, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600'
    })

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Delete voice avatar from Supabase Storage
 */
export async function deleteVoiceAvatar(avatarUrl: string): Promise<void> {
  if (!avatarUrl) return

  try {
    // Extract file path from URL
    const url = new URL(avatarUrl)
    const pathParts = url.pathname.split('/')
    const fileName = pathParts[pathParts.length - 1]

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([fileName])

    if (error) {
      console.error('Failed to delete avatar:', error)
      // Don't throw - deletion failure shouldn't block other operations
    }
  } catch (error) {
    console.error('Failed to parse avatar URL:', error)
  }
}

/**
 * Get avatar URL for voice ID
 */
export function getAvatarUrl(voiceId: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(`${voiceId}.webp`)

  return publicUrl
}

/**
 * Create preview URL for file upload
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file)
}

/**
 * Revoke preview URL to free memory
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}
