import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SiteLedger',
    short_name: 'SiteLedger',
    description: 'Construction site invoice management',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F5F1',
    theme_color: '#1B3A5C',
    icons: [
      {
        src: '/icons/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/apple-touch-icon-180x180.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
