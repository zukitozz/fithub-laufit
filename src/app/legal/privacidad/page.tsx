import Link from 'next/link'

export const metadata = { title: 'Privacidad · LAUFIT Fitness Club' }

// Texto base para revisar con un abogado antes de publicarlo (Ley 29733, Protección de Datos Personales).
export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-ink-800">
      <Link href="/auth/login" className="text-sm font-semibold text-laufit-600">← Volver</Link>
      <h1 className="page-heading mt-4 text-4xl">Política de privacidad</h1>
      <p className="mt-1 text-sm text-ink-400">THE1 FITNESS CLUB CENTER S.A.C. · LAUFIT Fitness Club</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed">
        <p>
          Tratamos tus datos personales (nombre, documento de identidad, celular, foto, fecha de nacimiento, datos de contacto de emergencia
          y condiciones de salud que nos indiques) para gestionar tu membresía, registrar tu asistencia, emitir tus comprobantes de pago
          y, si lo aceptaste, enviarte avisos por WhatsApp sobre tu comprobante y el vencimiento de tu membresía.
        </p>
        <p>
          Al escanear el código QR del gimnasio e ingresar tu documento, registramos la fecha y hora de tu ingreso. Esta información la
          ve el personal de recepción para verificar tu identidad y el estado de tu membresía.
        </p>
        <p>
          Puedes pedir en recepción que actualicemos, corrijamos o eliminemos tus datos, o que dejemos de enviarte avisos por WhatsApp
          (también puedes responder &quot;baja&quot; a cualquiera de nuestros mensajes). Guardamos tus datos mientras mantengas una relación con
          el gimnasio y durante los plazos que exigen las normas tributarias y laborales.
        </p>
        <p>Contacto: recepción de LAUFIT Fitness Club, Av. Próceres de Huandoy 7585, Los Olivos · 974 775 549.</p>
      </div>
    </main>
  )
}
