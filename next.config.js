/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  swcMinify: true,
  images: {
    unoptimized: process.env.NODE_ENV === 'production' ? false : true,
  },
}

module.exports = nextConfig
