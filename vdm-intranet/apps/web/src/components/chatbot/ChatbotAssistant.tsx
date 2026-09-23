import Script from 'next/script'

/**
 * Charge le widget de l'assistant IA Veilleur des Médias (projet chatbot).
 * L'intranet sert ici de site hôte de test : le widget est identique à celui
 * intégré sur veilleurdesmedias.com. Inactif tant que
 * NEXT_PUBLIC_CHATBOT_WIDGET_URL et NEXT_PUBLIC_CHATBOT_SITE_ID ne sont pas
 * définis.
 */
export function ChatbotAssistant() {
  const widgetUrl = process.env.NEXT_PUBLIC_CHATBOT_WIDGET_URL
  const siteId = process.env.NEXT_PUBLIC_CHATBOT_SITE_ID
  if (!widgetUrl || !siteId) return null

  const config = {
    siteId,
    apiBaseUrl: process.env.NEXT_PUBLIC_CHATBOT_API_URL || new URL(widgetUrl).origin,
    // À gauche par défaut : la messagerie interne (ChatWidget) occupe déjà
    // le coin inférieur droit.
    position: process.env.NEXT_PUBLIC_CHATBOT_POSITION === 'right' ? 'right' : 'left',
  }

  return (
    <>
      {/* La configuration doit exister avant l'exécution de widget.js. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.vdmChatbotConfig = ${JSON.stringify(config)};`,
        }}
      />
      <Script src={widgetUrl} strategy="afterInteractive" />
    </>
  )
}
