import './globals.css'

export const metadata = {
  title: 'FitTrack AI',
  description: 'Tu app de entrenamiento con IA',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
