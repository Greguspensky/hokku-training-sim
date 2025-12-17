'use client';

import { DemoAuthProvider } from '@/contexts/DemoContext';
import DemoFlipboardSession from '@/components/Demo/DemoFlipboardSession';
import { useEffect } from 'react';

export default function HotelMotaDemoPage() {
  useEffect(() => {
    document.title = 'Hotel receptionist demo';
  }, []);

  return (
    <DemoAuthProvider>
      <style jsx global>{`
        /* Override ElevenLabs "Start Session" button text */
        button:has(svg + span) span:last-child {
          font-size: 0;
        }
        button:has(svg + span) span:last-child::after {
          content: 'Call';
          font-size: 1.125rem;
          font-weight: 600;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50">
        {/* Main Demo Session */}
        <DemoFlipboardSession />

        {/* Footer */}
        <div className="bg-gray-900 text-white py-6">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-sm text-gray-400">
              © 2025 Hokku AI. All rights reserved.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This demo uses real AI technology with Hotel Mota's knowledge base.
            </p>
          </div>
        </div>
      </div>
    </DemoAuthProvider>
  );
}
