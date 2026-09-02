'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  username: string
  onComplete: () => void
}

export function LoginAnimation({ username, onComplete }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setTimeout(onComplete, 2800)
    return () => clearTimeout(t)
  }, [onComplete])

  if (!mounted) return null

  const display = username ? username.charAt(0).toUpperCase() + username.slice(1).toLowerCase() : ''

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="la-scene">
        <div className="la-back-glow" />

        {/* Porte gauche */}
        <div className="la-door la-door-l">
          <div className="la-surface">
            <div className="la-panel" />
            <div className="la-panel" />
          </div>
          <div className="la-hinge" style={{ top: '18%' }} />
          <div className="la-hinge" style={{ top: '78%' }} />
          <div className="la-handle la-h-r" />
        </div>

        {/* Porte droite */}
        <div className="la-door la-door-r">
          <div className="la-surface">
            <div className="la-panel" />
            <div className="la-panel" />
          </div>
          <div className="la-hinge" style={{ top: '18%', right: 0, left: 'auto' }} />
          <div className="la-hinge" style={{ top: '78%', right: 0, left: 'auto' }} />
          <div className="la-handle la-h-l" />
        </div>

        <div className="la-crack" />

        {/* Sceau */}
        <div className="la-seal">
          <div className="la-card">
            <div className="la-logo-plaque">
              <img src="/logo_entreprise.png" alt="Veilleur des Médias" />
            </div>
            <div className="la-rule" />
            <h1 className="la-welcome">{display ? `Bienvenue, ${display}.` : 'Bienvenue.'}</h1>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

const CSS = `
.la-scene {
  position: fixed; inset: 0; z-index: 200;
  background: #0E1826;
  display: flex; align-items: center; justify-content: center;
  animation: la-out 0.5s ease 2.4s both;
}
@keyframes la-out { to { opacity: 0; } }

.la-back-glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 50% 50%,
    rgba(242,140,56,.18) 0%, rgba(242,140,56,.05) 40%, transparent 70%);
  opacity: 0;
  animation: la-glow-in 0.9s ease 1.4s both;
}
@keyframes la-glow-in { to { opacity: 1; } }

/* Portes — partent fermées, s'ouvrent */
.la-door {
  position: absolute; top: 0; height: 100%; width: 50%;
  will-change: transform;
}
.la-door-l {
  left: 0;
  transform-origin: 0% 50%;
  animation: la-open-l 1.3s cubic-bezier(0.7,0,0.84,0) 1.0s both;
}
.la-door-r {
  right: 0;
  transform-origin: 100% 50%;
  animation: la-open-r 1.3s cubic-bezier(0.7,0,0.84,0) 1.0s both;
}
@keyframes la-open-l {
  from { transform: perspective(1200px) rotateY(0deg); }
  to   { transform: perspective(1200px) rotateY(88deg); }
}
@keyframes la-open-r {
  from { transform: perspective(1200px) rotateY(0deg); }
  to   { transform: perspective(1200px) rotateY(-88deg); }
}

/* Surface */
.la-surface {
  position: absolute; inset: 0;
  background: linear-gradient(160deg, #24354C 0%, #1B2A3D 55%, #101A28 100%);
  border-top: 1px solid rgba(255,255,255,.04);
  border-bottom: 1px solid rgba(0,0,0,.4);
  display: flex; flex-direction: column;
  padding: 10% 8%; gap: 4%;
}
.la-panel {
  flex: 1;
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 2px;
  background: linear-gradient(160deg,
    rgba(255,255,255,.025) 0%,
    rgba(255,255,255,.01) 50%,
    rgba(0,0,0,.03) 100%);
}

/* Charnières */
.la-hinge {
  position: absolute; left: 0;
  width: 12px; height: 32px;
  background: linear-gradient(90deg, #1B2A3D, #2F4666, #1B2A3D);
  border-radius: 2px;
  transform: translateY(-50%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 2px 4px rgba(0,0,0,.5);
}

/* Poignées */
.la-handle {
  position: absolute; top: 50%;
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
.la-h-r { right: 20px; }
.la-h-l { left: 20px; }

/* Fissure lumineuse */
.la-crack {
  position: absolute; top: 0; bottom: 0;
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
  animation: la-crack-fade 0.6s ease 1.2s both;
}
@keyframes la-crack-fade { to { opacity: 0; } }

/* Sceau — apparaît quand les portes s'ouvrent */
.la-seal {
  position: relative; z-index: 10;
  display: flex; flex-direction: column; align-items: center; gap: 0;
  pointer-events: none;
  animation: la-seal-in 0.8s cubic-bezier(0.22,1,0.36,1) 1.6s both;
}
@keyframes la-seal-in {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.la-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 28px 36px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(27,42,61,.72) 0%, rgba(20,32,47,.9) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.07);
  box-shadow: 0 24px 64px rgba(0,0,0,.55);
}

.la-logo-plaque {
  background: #fff;
  border-radius: 14px;
  padding: 12px 22px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 36px rgba(242,140,56,.4), 0 8px 24px rgba(0,0,0,.5);
  margin-bottom: 16px;
}
.la-logo-plaque img {
  display: block;
  height: 34px;
  width: auto;
}
.la-rule {
  width: 28px; height: 1px;
  background: linear-gradient(90deg, transparent, #F28C38, transparent);
  margin-bottom: 14px;
}
.la-welcome {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(24px, 4vw, 38px);
  font-weight: normal;
  letter-spacing: -.025em;
  color: rgba(237,232,223,.85);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .la-door-l, .la-door-r, .la-seal, .la-back-glow, .la-crack {
    animation-duration: 0.01ms !important;
    animation-delay: 0ms !important;
  }
}
`
