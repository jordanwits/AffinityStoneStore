/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['core'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Allow up to 10MB for image uploads
    },
  },
  webpack: (config, { isServer }) => {
    // Exclude Supabase Edge Functions from build (they use Deno, not Node.js)
    config.module.rules.push({
      test: /supabase\/functions\/.*/,
      loader: 'ignore-loader',
    });
    return config;
  },
};

module.exports = nextConfig;
