/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // html-docx-js reads its template files from disk next to its own code; bundling it breaks DOCX export.
  serverExternalPackages: ['html-docx-js'],
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution for TypeScript files
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', ...(config.resolve.extensions || [])]
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    // Make puppeteer external so webpack doesn't try to bundle it
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('puppeteer')
    }
    return config
  },
}
export default nextConfig
