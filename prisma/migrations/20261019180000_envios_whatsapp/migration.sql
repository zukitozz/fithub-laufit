-- CreateEnum
CREATE TYPE "TipoAvisoWhatsApp" AS ENUM ('BIENVENIDA', 'COMPROBANTE', 'D3', 'D0');

-- CreateEnum
CREATE TYPE "EstadoEnvioWhatsApp" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'SIN_CONSENTIMIENTO');

-- AlterTable
ALTER TABLE "Socio" ADD COLUMN "bajaVoluntariaWhatsApp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EnvioWhatsApp" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "membresiaId" TEXT,
    "facturaId" TEXT,
    "tipo" "TipoAvisoWhatsApp" NOT NULL,
    "referenciaExterna" TEXT NOT NULL,
    "estado" "EstadoEnvioWhatsApp" NOT NULL DEFAULT 'PENDIENTE',
    "solicitud" JSONB NOT NULL,
    "envioId" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvioWhatsApp_referenciaExterna_key" ON "EnvioWhatsApp"("referenciaExterna");

-- CreateIndex
CREATE INDEX "EnvioWhatsApp_socioId_creadoAt_idx" ON "EnvioWhatsApp"("socioId", "creadoAt");

-- CreateIndex
CREATE INDEX "EnvioWhatsApp_estado_idx" ON "EnvioWhatsApp"("estado");

-- AddForeignKey
ALTER TABLE "EnvioWhatsApp" ADD CONSTRAINT "EnvioWhatsApp_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
