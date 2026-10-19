-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- DropForeignKey
ALTER TABLE "Factura" DROP CONSTRAINT "Factura_socioId_fkey";

-- AlterTable
ALTER TABLE "Factura" ADD COLUMN     "cierreTurnoId" TEXT,
ALTER COLUMN "socioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FacturaItem" ADD COLUMN     "productoId" TEXT;

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "codigoBarras" TEXT,
    "precioVenta" DOUBLE PRECISION NOT NULL,
    "precioCosto" DOUBLE PRECISION,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "alertaStock" INTEGER NOT NULL DEFAULT 5,
    "controlaStock" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "stockNuevo" INTEGER NOT NULL,
    "motivo" TEXT,
    "facturaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CierreTurno" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "totalVentas" DOUBLE PRECISION NOT NULL,
    "totalEfectivo" DOUBLE PRECISION NOT NULL,
    "totalTarjeta" DOUBLE PRECISION NOT NULL,
    "totalYape" DOUBLE PRECISION NOT NULL,
    "totalTransferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectivoContado" DOUBLE PRECISION,
    "diferencia" DOUBLE PRECISION,
    "notas" TEXT,
    "cantidadComprobantes" INTEGER NOT NULL DEFAULT 0,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreTurno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_creadoAt_idx" ON "MovimientoInventario"("productoId", "creadoAt");

-- CreateIndex
CREATE INDEX "CierreTurno_fechaFin_idx" ON "CierreTurno"("fechaFin");

-- CreateIndex
CREATE INDEX "Factura_cierreTurnoId_idx" ON "Factura"("cierreTurnoId");

-- CreateIndex
CREATE INDEX "FacturaItem_productoId_idx" ON "FacturaItem"("productoId");

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_cierreTurnoId_fkey" FOREIGN KEY ("cierreTurnoId") REFERENCES "CierreTurno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreTurno" ADD CONSTRAINT "CierreTurno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

