'use client';

import Link from 'next/link';
import { MessageSquare, Phone, Globe, Clock, Zap, Smartphone } from 'lucide-react';

export default function GingerLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Meet Ginger
          </h1>
          <p className="text-2xl md:text-3xl text-gray-700 font-medium mb-4">
            A multilingual digital receptionist for hotels
          </p>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Guests scan a QR code and can instantly chat or call your receptionist in their own language.
          </p>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mt-4 leading-relaxed">
            Ginger answers the questions your reception handles all day — clearly, calmly, and 24/7.
          </p>
        </div>

        {/* CTA Section - Top */}
        <div className="text-center mb-16">
          <Link
            href="/demo/flipboard/hotel-mota"
            className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl"
          >
            👉 Try the receptionist
          </Link>

          <p className="text-gray-600 mt-6 text-lg">
            Experience Ginger in action with our Hotel Mota demo
          </p>
        </div>

        {/* What Ginger Helps With */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            What Ginger helps with
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Common Guest Questions */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Common guest questions
              </h3>
              <p className="text-gray-600 leading-relaxed">
                breakfast, spa, ski room, parking, late checkout, towels, Wi-Fi
              </p>
            </div>

            {/* Local Guidance */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🗺️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Local guidance
              </h3>
              <p className="text-gray-600 leading-relaxed">
                ski areas, restaurants, shops, transport, things to do
              </p>
            </div>

            {/* Guest Requests */}
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🛎️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Guest requests
              </h3>
              <p className="text-gray-600 leading-relaxed">
                housekeeping, comfort issues, arrival updates
              </p>
            </div>
          </div>

          <p className="text-center text-lg text-gray-700 mt-8 font-medium">
            Ginger handles the first response and coordination, so your staff can focus on service.
          </p>
        </div>

        {/* Why Hotels Use Ginger */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            Why hotels use Ginger
          </h2>

          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Globe className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Speaks to every guest in their native language
                  </h3>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Reduces repetitive messages and interruptions
                  </h3>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Smartphone className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Works on WhatsApp — no app to install
                  </h3>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Zap className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No training or system changes required
                  </h3>
                </div>
              </div>
            </div>

            <p className="text-lg text-gray-700 mt-8 text-center font-medium">
              Designed for busy hotels with international guests.
            </p>
          </div>
        </div>

        {/* How Guests Use It */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            How guests use it
          </h2>

          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <p className="text-lg text-gray-700 mb-8 text-center">
              Guests simply scan a QR code in the hotel and can immediately:
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
                <MessageSquare className="w-10 h-10 text-indigo-600 flex-shrink-0" />
                <span className="text-xl font-semibold text-gray-900">
                  Write to the receptionist
                </span>
              </div>

              <div className="flex items-center gap-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6">
                <Phone className="w-10 h-10 text-purple-600 flex-shrink-0" />
                <span className="text-xl font-semibold text-gray-900">
                  Call the receptionist
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Link
            href="/demo/flipboard/hotel-mota"
            className="inline-flex items-center gap-3 px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-2xl font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl"
          >
            👉 Try the receptionist
          </Link>

          <p className="text-gray-600 mt-6 text-lg">
            Experience Ginger in action with our Hotel Mota demo
          </p>
        </div>
      </div>

      {/* Copyright Footer */}
      <div className="bg-gray-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            © 2025 Hokku AI. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Ginger is powered by advanced AI technology tailored for hospitality
          </p>
        </div>
      </div>
    </div>
  );
}
