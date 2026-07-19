/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverActions: {
      // Server Actions default to a 1MB body limit, which silently rejects
      // uploads of scanned/photographed documents (comprovantes, RG, etc).
      // Raise it to match the 20MB limits enforced in our upload actions.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
