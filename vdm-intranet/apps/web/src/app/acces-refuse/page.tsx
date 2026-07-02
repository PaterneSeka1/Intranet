import Link from 'next/link'

export default function AccesRefusePage() {
  return (
    <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Accès refusé</h1>
        <p className="text-sm text-gray-500 mb-6">
          Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <Link
          href="/accueil"
          className="inline-block bg-[#F28C38] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#e07d29] transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  )
}
