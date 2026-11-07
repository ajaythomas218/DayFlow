import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DayFlow — Your Personal Life & Productivity OS',
    short_name: 'DayFlow',
    description: 'Everything in flow. Master your personal ecosystem with tasks, time-blocking, reminders, and daily reflection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#0F172A',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}

