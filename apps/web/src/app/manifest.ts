import type { MetadataRoute } from 'next';

// Lets staff add TimeSync to their phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TimeSync Scheduling',
    short_name: 'TimeSync',
    description: 'AI workforce scheduling',
    start_url: '/my-schedule',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  };
}
