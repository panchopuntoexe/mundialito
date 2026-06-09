/**
 * Layout de las rutas de autenticación (login, onboarding).
 * Centra el contenido en una tarjeta, mobile-first.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
