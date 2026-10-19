-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('DNI', 'CE', 'RUC');

-- CreateEnum
CREATE TYPE "UnidadDuracion" AS ENUM ('MESES', 'DIAS');

-- CreateEnum
CREATE TYPE "OrigenAsistencia" AS ENUM ('QR', 'RECEPCION');

-- CreateEnum
CREATE TYPE "EstadoMembresiaAlMarcar" AS ENUM ('VIGENTE', 'POR_VENCER', 'VENCIDA', 'SIN_MEMBRESIA');

-- CreateEnum
CREATE TYPE "ValidacionAsistencia" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoMarcacion" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "OrigenMarcacion" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "FacturaTipo" AS ENUM ('BOLETA', 'FACTURA', 'NOTA_CREDITO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO', 'MIXTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Socio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'DNI',
    "numeroDocumento" TEXT NOT NULL,
    "razonSocial" TEXT,
    "rucFactura" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "fechaNacimiento" DATE,
    "fotoKey" TEXT,
    "contactoEmergencia" TEXT,
    "telefonoEmergencia" TEXT,
    "condicionMedica" TEXT,
    "notas" TEXT,
    "consentimientoWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "consentimientoWhatsAppAt" TIMESTAMP(3),
    "consentimientoWhatsAppOrigen" TEXT,
    "recordatorioPospuestoHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL,
    "unidad" "UnidadDuracion" NOT NULL DEFAULT 'MESES',
    "precio" DOUBLE PRECISION NOT NULL,
    "matricula" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esPaseDiario" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membresia" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "anuladaMotivo" TEXT,
    "anuladaPorId" TEXT,
    "anuladaAt" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "facturaId" TEXT,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "membresiaId" TEXT,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "OrigenAsistencia" NOT NULL,
    "estadoMembresia" "EstadoMembresiaAlMarcar" NOT NULL,
    "diasRestantes" INTEGER,
    "validacion" "ValidacionAsistencia" NOT NULL DEFAULT 'PENDIENTE',
    "validadaPorId" TEXT,
    "validadaAt" TIMESTAMP(3),
    "motivo" TEXT,
    "ip" TEXT,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'DNI',
    "numeroDocumento" TEXT NOT NULL,
    "celular" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarcacionCoach" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "tipo" "TipoMarcacion" NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "OrigenMarcacion" NOT NULL,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "registradaPorId" TEXT,
    "ip" TEXT,

    CONSTRAINT "MarcacionCoach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "tipo" "FacturaTipo" NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "gravadas" DOUBLE PRECISION,
    "igv" DOUBLE PRECISION,
    "metodoPago" "MetodoPago" NOT NULL,
    "pagoEfectivo" DOUBLE PRECISION,
    "pagoTarjeta" DOUBLE PRECISION,
    "pagoYape" DOUBLE PRECISION,
    "pagoTransferencia" DOUBLE PRECISION,
    "pagoDeposito" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receptorTipoDocumento" TEXT NOT NULL,
    "receptorNumeroDocumento" TEXT NOT NULL,
    "receptorNombre" TEXT NOT NULL,
    "tipoComprobante" TEXT,
    "numeracionComprobante" TEXT,
    "fechaEmision" TIMESTAMP(3),
    "tipoMoneda" TEXT DEFAULT 'PEN',
    "montoLetras" TEXT,
    "tipoNota" TEXT,
    "tipoDocumentoAfectado" TEXT,
    "numeracionDocumentoAfectado" TEXT,
    "motivoDocumentoAfectado" TEXT,
    "facturaAfectadaId" TEXT,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "estadoFacturador" TEXT,
    "cadenaParaCodigoQr" TEXT,
    "codigoHash" TEXT,
    "errors" TEXT,
    "xmlEnvio" TEXT,
    "cdr" TEXT,
    "usuarioId" TEXT,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaItem" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precioUnit" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "codigoProducto" TEXT,

    CONSTRAINT "FacturaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "tipoComprobante" VARCHAR(2) NOT NULL,
    "serie" VARCHAR(3) NOT NULL,
    "estado" INTEGER NOT NULL DEFAULT 1,
    "descripcion" VARCHAR(200),

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correlativo" (
    "id" TEXT NOT NULL,
    "tipoDocumento" VARCHAR(2) NOT NULL,
    "serie" VARCHAR(3) NOT NULL,
    "prefijo" VARCHAR(2) NOT NULL,
    "numeracion" INTEGER NOT NULL DEFAULT 0,
    "estado" CHAR(1) NOT NULL DEFAULT 'A',
    "ruc" VARCHAR(11) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correlativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nombreGimnasio" TEXT NOT NULL DEFAULT 'LAUFIT Fitness Club',
    "direccion" TEXT,
    "telefonoContacto" TEXT,
    "ruc" VARCHAR(11),
    "razonSocial" TEXT,
    "direccionFiscal" TEXT,
    "codigoUbigeo" TEXT,
    "facturacionActivo" BOOLEAN NOT NULL DEFAULT false,
    "diasAvisoVencimiento" INTEGER NOT NULL DEFAULT 7,
    "diasGracia" INTEGER NOT NULL DEFAULT 0,
    "minutosAntiDuplicadoIngreso" INTEGER NOT NULL DEFAULT 60,
    "qrToken" TEXT NOT NULL,
    "horarioAtencion" JSONB,
    "whatsappActivo" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Socio_nombre_idx" ON "Socio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_tipoDocumento_numeroDocumento_key" ON "Socio"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "Membresia_socioId_fechaFin_idx" ON "Membresia"("socioId", "fechaFin");

-- CreateIndex
CREATE INDEX "Asistencia_socioId_fechaHora_idx" ON "Asistencia"("socioId", "fechaHora");

-- CreateIndex
CREATE INDEX "Asistencia_fechaHora_idx" ON "Asistencia"("fechaHora");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_tipoDocumento_numeroDocumento_key" ON "Coach"("tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE INDEX "MarcacionCoach_coachId_fechaHora_idx" ON "MarcacionCoach"("coachId", "fechaHora");

-- CreateIndex
CREATE INDEX "Factura_socioId_idx" ON "Factura"("socioId");

-- CreateIndex
CREATE INDEX "Factura_creadoAt_idx" ON "Factura"("creadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "Correlativo_ruc_tipoDocumento_serie_prefijo_key" ON "Correlativo"("ruc", "tipoDocumento", "serie", "prefijo");

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarcacionCoach" ADD CONSTRAINT "MarcacionCoach_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaItem" ADD CONSTRAINT "FacturaItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

