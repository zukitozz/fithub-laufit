-- CreateEnum
CREATE TYPE "MotivoContacto" AS ENUM ('VENCIMIENTO', 'CUMPLEANOS', 'OTRO');

-- CreateTable
CREATE TABLE "ContactoSocio" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "motivo" "MotivoContacto" NOT NULL,
    "nota" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoSocio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactoSocio_socioId_creadoAt_idx" ON "ContactoSocio"("socioId", "creadoAt");

-- AddForeignKey
ALTER TABLE "ContactoSocio" ADD CONSTRAINT "ContactoSocio_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoSocio" ADD CONSTRAINT "ContactoSocio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

