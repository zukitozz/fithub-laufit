/** @type {import("next").NextConfig} */
const nextConfig = {
  // Permite compilar en otra carpeta (NEXT_DIST_DIR) sin pisar un servidor de desarrollo abierto.
  distDir: process.env.NEXT_DIST_DIR || ".next",
}

module.exports = nextConfig
