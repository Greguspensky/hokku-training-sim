import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'ru', 'it'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Only add prefix for non-default locales
  localePrefix: 'as-needed',

  // Don't detect locale from browser/headers - only use cookie
  localeDetection: false
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
