'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/auth')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Redirecting to Hokku Training Simulator...</div>
    </div>
  )
}
