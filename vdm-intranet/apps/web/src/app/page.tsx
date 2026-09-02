'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.push('/login'), 4200)
    return () => clearTimeout(t)
  }, [router])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="scene">
        {/* Lumière derrière la porte */}
        <div className="back-glow" />

        {/* Porte gauche */}
        <div className="door door-l">
          <div className="door-surface">
            <div className="door-panel top" />
            <div className="door-panel bot" />
          </div>
          <div className="hinge" style={{ top: '18%' }} />
          <div className="hinge" style={{ top: '78%' }} />
          <div className="handle handle-r" />
        </div>

        {/* Porte droite */}
        <div className="door door-r">
          <div className="door-surface">
            <div className="door-panel top" />
            <div className="door-panel bot" />
          </div>
          <div className="hinge" style={{ top: '18%', right: 0, left: 'auto' }} />
          <div className="hinge" style={{ top: '78%', right: 0, left: 'auto' }} />
          <div className="handle handle-l" />
        </div>

        {/* Fissure lumineuse au centre */}
        <div className="crack" />

        {/* Sceau VDM */}
        <div className="seal">
          <div className="seal-card">
            <div className="seal-logo-plaque">
              <img src="/logo_entreprise.png" alt="Veilleur des Médias" />
            </div>
            <div className="seal-rule" />
            <div className="seal-sub">Portail interne · Abidjan, Côte d&rsquo;Ivoire</div>
          </div>
        </div>

        {/* Lien de passage direct */}
        <Link href="/login" className="skip-btn">
          Accéder directement →
        </Link>
      </main>
    </>
  )
}

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; background: #0E1826; }

/* ─── Scène ─── */
.scene {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: #0E1826;
  animation: scene-out 0.5s ease 3.6s both;
}
@keyframes scene-out {
  to { opacity: 0; }
}

/* ─── Lumière de fond (révélée quand les portes s'ouvrent) ─── */
.back-glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 50% 50%,
    rgba(242,140,56,.18) 0%,
    rgba(242,140,56,.05) 40%,
    transparent 70%);
  opacity: 0;
  animation: glow-reveal 0.9s ease 0.5s both;
}
@keyframes glow-reveal {
  to { opacity: 1; }
}

/* ─── Portes ─── */
.door {
  position: absolute;
  top: 0; height: 100%;
  width: 50%;
  will-change: transform;
}
.door-l {
  left: 0;
  transform-origin: 0% 50%;
  animation: open-l 1.4s cubic-bezier(0.7, 0, 0.84, 0) 0.4s both;
}
.door-r {
  right: 0;
  transform-origin: 100% 50%;
  animation: open-r 1.4s cubic-bezier(0.7, 0, 0.84, 0) 0.4s both;
}
@keyframes open-l {
  from { transform: perspective(1200px) rotateY(0deg); }
  to   { transform: perspective(1200px) rotateY(88deg); }
}
@keyframes open-r {
  from { transform: perspective(1200px) rotateY(0deg); }
  to   { transform: perspective(1200px) rotateY(-88deg); }
}

/* ─── Surface de la porte ─── */
.door-surface {
  position: absolute; inset: 0;
  background: linear-gradient(160deg, #24354C 0%, #1B2A3D 55%, #101A28 100%);
  border-top: 1px solid rgba(255,255,255,.04);
  border-bottom: 1px solid rgba(0,0,0,.4);
  display: flex; flex-direction: column;
  padding: 10% 8%;
  gap: 4%;
}

/* Panneaux décoratifs (moulures) */
.door-panel {
  flex: 1;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 2px;
  background: linear-gradient(160deg,
    rgba(255,255,255,.025) 0%,
    rgba(255,255,255,.01) 50%,
    rgba(0,0,0,.03) 100%);
}

/* ─── Charnières ─── */
.hinge {
  position: absolute;
  left: 0;
  width: 12px; height: 32px;
  background: linear-gradient(90deg, #1B2A3D, #2F4666, #1B2A3D);
  border-radius: 2px;
  transform: translateY(-50%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 2px 4px rgba(0,0,0,.5);
}

/* ─── Poignées ─── */
.handle {
  position: absolute;
  top: 50%;
  width: 10px; height: 56px;
  border-radius: 5px;
  background: linear-gradient(180deg,
    #A85A1D 0%, #F28C38 30%, #FFB066 50%, #F28C38 70%, #A85A1D 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.3),
    inset 0 -1px 0 rgba(0,0,0,.3),
    0 4px 12px rgba(0,0,0,.5),
    0 0 20px rgba(242,140,56,.25);
  transform: translateY(-50%);
}
.handle-r { right: 20px; }
.handle-l { left: 20px; }

/* ─── Fissure lumineuse ─── */
.crack {
  position: absolute;
  top: 0; bottom: 0;
  left: 50%; width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(242,140,56,.6) 20%,
    rgba(255,180,80,.9) 50%,
    rgba(242,140,56,.6) 80%,
    transparent 100%
  );
  box-shadow: 0 0 12px 3px rgba(242,140,56,.35), 0 0 30px 8px rgba(242,140,56,.12);
  animation: crack-glow 1.5s ease-in-out 0s infinite alternate;
}
@keyframes crack-glow {
  from { opacity: .7; }
  to   { opacity: 1; }
}

/* ─── Sceau central ─── */
.seal {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 0;
  pointer-events: none;
  z-index: 10;
  animation: seal-in 0.9s cubic-bezier(0.22,1,0.36,1) 1.8s both;
}
@keyframes seal-in {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.seal-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 30px 40px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(27,42,61,.72) 0%, rgba(20,32,47,.9) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.07);
  box-shadow: 0 24px 64px rgba(0,0,0,.55);
}

.seal-logo-plaque {
  background: #fff;
  border-radius: 16px;
  padding: 14px 26px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 40px rgba(242,140,56,.4), 0 10px 28px rgba(0,0,0,.5);
  margin-bottom: 18px;
}
.seal-logo-plaque img {
  display: block;
  height: 38px;
  width: auto;
}

.seal-rule {
  width: 32px; height: 1px;
  background: linear-gradient(90deg, transparent, #F28C38, transparent);
  margin-bottom: 14px;
}

.seal-sub {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px; font-weight: 400;
  letter-spacing: .04em;
  color: rgba(237,232,223,.55);
  text-align: center;
}

/* ─── Lien skip ─── */
.skip-btn {
  position: fixed; bottom: 28px; right: 32px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px; font-weight: 600;
  letter-spacing: .06em; text-transform: uppercase;
  color: rgba(237,232,223,.3);
  text-decoration: none;
  z-index: 100;
  transition: color .2s;
  animation: fade-in .5s ease 1.0s both;
}
.skip-btn:hover { color: rgba(237,232,223,.8); }
@keyframes fade-in {
  from { opacity: 0; } to { opacity: 1; }
}

/* ─── Réduction de mouvement ─── */
@media (prefers-reduced-motion: reduce) {
  .door-l, .door-r, .seal, .back-glow {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
`
