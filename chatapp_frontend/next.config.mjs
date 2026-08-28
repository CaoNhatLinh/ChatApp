/** @type {import('next').NextConfig} */
const nextConfig = {
  // The first migration slice keeps the existing client router intact while
  // Next owns the document, asset pipeline, and production build.
  images: { unoptimized: true },
};

export default nextConfig;
