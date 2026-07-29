'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface Props {
  onCancel: () => void
}

type Phase = 'confirm' | 'closing'

export function LogoutOverlay({ onCancel }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('confirm')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleConfirm() {
    setPhase('closing')
  }

  useEffect(() => {
    if (phase !== 'closing') return
    const t = setTimeout(async () => {
      await api.auth.logout().catch(() => {})
      router.push('/login')
    }, 3400)
    return () => clearTimeout(t)
  }, [phase, router])

  if (!mounted) return null

  if (phase === 'confirm') {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel()
        }}
      >
        <div className="bg-[#1B293C] rounded-2xl p-8 border border-white/10 shadow-2xl w-full max-w-xs mx-4 text-center animate-modal-in">
          <img
            src="/logo_entreprise.png"
            alt="Veilleur des Médias"
            className="h-7 w-auto mx-auto mb-6 bg-white rounded-md px-2 py-1"
          />
          <div className="w-12 h-12 rounded-xl bg-[#F28C38]/10 border border-[#F28C38]/20 flex items-center justify-center mx-auto mb-5">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="#F28C38"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M13 3h4v14h-4M9 14l4-4-4-4M13 10H5" />
            </svg>
          </div>
          <h2 className="text-white font-semibold text-base mb-1">Se déconnecter ?</h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Votre session sera fermée et vous serez redirigé vers la page de connexion.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border border-white/15 rounded-xl text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-[#F28C38] hover:bg-[#e07d29] rounded-xl text-sm font-semibold text-white transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </div>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes modal-in {
            from { opacity:0; transform:scale(.94) translateY(8px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
          .animate-modal-in { animation: modal-in .2s ease both; }
        `,
          }}
        />
      </div>,
      document.body
    )
  }

  /* ── Animation portes qui se ferment ── */
  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: DOOR_CSS }} />
      <div className="lo-scene">
        {/* Lumière résiduelle derrière */}
        <div className="lo-glow" />

        {/* Porte gauche */}
        <div className="lo-door lo-door-l">
          <div className="lo-surface">
            <div className="lo-panel top" />
            <div className="lo-panel bot" />
          </div>
          <div className="lo-hinge" style={{ top: '18%' }} />
          <div className="lo-hinge" style={{ top: '78%' }} />
          <div className="lo-handle lo-h-r" />
        </div>

        {/* Porte droite */}
        <div className="lo-door lo-door-r">
          <div className="lo-surface">
            <div className="lo-panel top" />
            <div className="lo-panel bot" />
          </div>
          <div className="lo-hinge" style={{ top: '18%', right: 0, left: 'auto' }} />
          <div className="lo-hinge" style={{ top: '78%', right: 0, left: 'auto' }} />
          <div className="lo-handle lo-h-l" />
        </div>

        {/* Sceau central */}
        <div className="lo-seal">
          <div className="lo-card">
            <div className="lo-logo-plaque">
              <img src="/logo_entreprise.png" alt="Veilleur des Médias" />
            </div>
            <div className="lo-rule" />
            <div className="lo-farewell">À bientôt</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

const DOOR_CSS = `
/* Scène */
.lo-scene {
  position: fixed; inset: 0; z-index: 200;
  background: #0B121C;
  display: flex; align-items: center; justify-content: center;
  animation: lo-scene-out 0.5s ease 2.8s both;
}
@keyframes lo-scene-out { to { opacity:0; } }

/* Glow qui s'éteint */
.lo-glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 50% 50%,
    rgba(242,140,56,.15) 0%, rgba(242,140,56,.04) 40%, transparent 70%);
  animation: lo-glow-out 0.8s ease 1.3s both;
}
@keyframes lo-glow-out { to { opacity:0; } }

/* Portes — partent ouvertes, se ferment sur le sceau */
.lo-door {
  position: absolute; top:0; height:100%; width:50%;
  z-index: 20;
  will-change: transform;
}
.lo-door-l {
  left:0;
  transform-origin: 0% 50%;
  animation: lo-close-l 1.2s cubic-bezier(0.16,1,0.3,1) 1.3s both;
}
.lo-door-r {
  right:0;
  transform-origin: 100% 50%;
  animation: lo-close-r 1.2s cubic-bezier(0.16,1,0.3,1) 1.3s both;
}
@keyframes lo-close-l {
  from { transform: perspective(1200px) rotateY(88deg); }
  to   { transform: perspective(1200px) rotateY(0deg); }
}
@keyframes lo-close-r {
  from { transform: perspective(1200px) rotateY(-88deg); }
  to   { transform: perspective(1200px) rotateY(0deg); }
}

/* Surface */
.lo-surface {
  position: absolute; inset: 0;
  background: linear-gradient(160deg, #24354A 0%, #1B293C 55%, #131D2A 100%);
  border-top: 1px solid rgba(255,255,255,.04);
  border-bottom: 1px solid rgba(0,0,0,.4);
  display: flex; flex-direction: column;
  padding: 10% 8%; gap: 4%;
}
.lo-panel {
  flex:1;
  border:1px solid rgba(255,255,255,.06);
  border-radius:2px;
  background: linear-gradient(160deg,
    rgba(255,255,255,.025) 0%,
    rgba(255,255,255,.01) 50%,
    rgba(0,0,0,.03) 100%);
}

/* Charnières */
.lo-hinge {
  position:absolute; left:0;
  width:12px; height:32px;
  background: linear-gradient(90deg, #2a3a4a, #3d5060, #2a3a4a);
  border-radius:2px;
  transform:translateY(-50%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 2px 4px rgba(0,0,0,.5);
}

/* Poignées */
.lo-handle {
  position:absolute; top:50%;
  width:10px; height:56px;
  border-radius:5px;
  background: linear-gradient(180deg,
    #8a6a40 0%, #C8904A 30%, #E8A85A 50%, #C8904A 70%, #8a6a40 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.3),
    inset 0 -1px 0 rgba(0,0,0,.3),
    0 4px 12px rgba(0,0,0,.5),
    0 0 20px rgba(200,144,74,.15);
  transform:translateY(-50%);
}
.lo-h-r { right:20px; }
.lo-h-l { left:20px; }

/* Sceau — apparaît d'abord, la porte se referme dessus ensuite */
.lo-seal {
  position:relative; z-index:10;
  display:flex; flex-direction:column; align-items:center;
  gap:0; pointer-events:none;
  animation: lo-seal-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both;
}
@keyframes lo-seal-in {
  from { opacity:0; transform:scale(.9); }
  to   { opacity:1; transform:scale(1); }
}

.lo-card {
  display:flex; flex-direction:column; align-items:center;
  padding:28px 36px;
  border-radius:20px;
  background:linear-gradient(180deg, rgba(11,18,28,.7) 0%, rgba(11,18,28,.88) 100%);
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.07);
  box-shadow:0 24px 64px rgba(0,0,0,.55);
}

.lo-logo-plaque {
  background:#fff;
  border-radius:16px;
  padding:14px 24px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 0 40px rgba(242,140,56,.35), 0 12px 28px rgba(0,0,0,.55);
  margin-bottom:18px;
}
.lo-logo-plaque img {
  display:block;
  height:36px;
  width:auto;
}
.lo-rule {
  width:28px; height:1px;
  background:linear-gradient(90deg,transparent,#F28C38,transparent);
  margin-bottom:12px;
}
.lo-farewell {
  font-family:Georgia,'Times New Roman',serif;
  font-size:28px; font-weight:normal;
  letter-spacing:-.02em;
  color:rgba(237,232,223,.7);
}

@media(prefers-reduced-motion:reduce){
  .lo-door-l,.lo-door-r,.lo-seal,.lo-glow{
    animation-duration:0.01ms!important;
    animation-delay:0ms!important;
  }
}
`
