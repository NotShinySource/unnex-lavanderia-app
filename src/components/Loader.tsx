// src/components/Loader.tsx
import { useEffect, useState } from 'react'

interface LoaderProps {
  /** Si es true, ocupa toda la pantalla. Si es false, se comporta como un bloque normal */
  fullScreen?: boolean
  /** Controla si se muestra o no (útil para transiciones de salida) */
  isLoading?: boolean
  /** Texto opcional debajo del spinner. Por defecto: "Cargando..." */
  text?: string
  /** Clase adicional para el contenedor */
  className?: string
}

export default function Loader({ 
  fullScreen = false, 
  isLoading = true, 
  text = "Cargando...", 
  className = "" 
}: LoaderProps) {
  const [show, setShow] = useState(isLoading)

  // Manejo de transición de salida suave
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShow(false), 500) // 500ms para fade-out
      return () => clearTimeout(timer)
    } else {
      setShow(true)
    }
  }, [isLoading])

  if (!show) return null

  // Estilos base para el spinner (Naranja corporativo)
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-[#ff6b35]/20 border-t-[#ff6b35] rounded-full animate-spin"></div>
      <p className="text-sm font-bold text-[#6b6b7e] animate-pulse tracking-widest uppercase">
        {text}
      </p>
    </div>
  )

  if (fullScreen) {
    return (
      <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ${
          isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Versión FullScreen con fondo blanco */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-slate-100 border-t-[#ff6b35] rounded-full animate-spin shadow-lg"></div>
          <p className="text-sm font-bold text-slate-500 animate-pulse tracking-widest uppercase mt-2">
            {text}
          </p>
        </div>
      </div>
    )
  }

  // Versión Inline
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      {spinner}
    </div>
  )
}