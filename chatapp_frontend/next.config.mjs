/** @type {import('next').NextConfig} */
const nextConfig = {
  // The first migration slice keeps the existing client router intact while
  // Next owns the document, asset pipeline, and production build.
  images: { unoptimized: true },
  // Keep visual QA free of the development-only Next indicator; errors remain visible.
  devIndicators: false,
};

export default nextConfig;
