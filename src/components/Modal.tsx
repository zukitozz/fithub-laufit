'use client'

type ModalSize = 'sm' | 'lg'

interface ModalProps {
  title: string
  onClose: () => void
  size?: ModalSize
  children: React.ReactNode
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-lg',
  lg: 'max-w-5xl',
}

export function Modal({ title, onClose, size = 'sm', children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className={`card-surface max-h-full w-full overflow-y-auto ${sizeStyles[size]}`}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-emerald-900">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
