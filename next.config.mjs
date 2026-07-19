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
    // generateContract() reads .docx templates from lib/contract-templates
    // at runtime via a dynamically-built path (fs.readFile with a variable
    // filename). Next's static file tracing can't always detect that, so the
    // templates get dropped from the serverless bundle ("ENOENT ... .docx").
    // Force them to always be included.
    outputFileTracingIncludes: {
      "/rh/[id]": ["./lib/contract-templates/**"],
      "/rh": ["./lib/contract-templates/**"],
    },
  },
};

export default nextConfig;
