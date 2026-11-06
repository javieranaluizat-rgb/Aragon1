import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (base de datos local para desarrollo) y pg deben cargarse desde node_modules.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  experimental: {
    // Permite subir estados de cuenta de hasta 4 MB desde el panel.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
