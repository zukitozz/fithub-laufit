/** @type {import("next").NextConfig} */
const nextConfig = {
  // Permite compilar en otra carpeta (NEXT_DIST_DIR) sin pisar un servidor de desarrollo abierto.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Tema del cliente (src/lib/tenant.ts): el navegador lo necesita para el logo y el nombre.
  env: { NEXT_PUBLIC_TENANT: process.env.TENANT || "laufit" },
}

module.exports = nextConfig
