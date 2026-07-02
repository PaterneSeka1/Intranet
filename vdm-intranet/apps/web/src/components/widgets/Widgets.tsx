'use client'

import { useEffect, useLayoutEffect, useState } from 'react'

type WeatherData = {
  temperature: number
  weatherCode: number
  windspeed: number
}

function wmoLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Ensoleillé', icon: '☀️' }
  if (code <= 3) return { label: 'Nuageux', icon: '⛅' }
  if (code <= 48) return { label: 'Brouillard', icon: '🌫️' }
  if (code <= 57) return { label: 'Bruine', icon: '🌦️' }
  if (code <= 67) return { label: 'Pluie', icon: '🌧️' }
  if (code <= 77) return { label: 'Neige', icon: '❄️' }
  if (code <= 82) return { label: 'Averses', icon: '⛈️' }
  return { label: 'Orage', icon: '⛈️' }
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC']

const WIDGET_KEYS = ['clock', 'calendar', 'weather'] as const
type WidgetKey = (typeof WIDGET_KEYS)[number]

const WIDGET_LABELS: Record<WidgetKey, string> = {
  clock: 'Horloge',
  calendar: 'Calendrier',
  weather: 'Météo',
}

const CARD = 'backdrop-blur-md bg-white/80 border border-gray-100/60 shadow-2xl rounded-2xl'

const WEATHER_CACHE_KEY = 'vdm_weather_cache'
const WEATHER_TTL = 10 * 60 * 1000

function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: WeatherData; ts: number }
    if (Date.now() - ts > WEATHER_TTL) return null
    return data
  } catch {
    return null
  }
}

function setCachedWeather(data: WeatherData) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* noop */ }
}

// Isolated clock — only this component re-renders every second
function ClockWidget() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`${CARD} w-44 p-4 flex flex-col items-center gap-0.5`}>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        {DAYS[time.getDay()]}
      </div>
      <div className="text-3xl font-bold text-gray-900 font-mono tabular-nums leading-none">
        {time.getHours().toString().padStart(2, '0')}
        <span className="text-gray-400">:</span>
        {time.getMinutes().toString().padStart(2, '0')}
        <span className="text-xl text-gray-400">
          :{time.getSeconds().toString().padStart(2, '0')}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {time.getDate()} {MONTHS[time.getMonth()]} {time.getFullYear()}
      </div>
      <div className="text-[10px] text-gray-400 mt-0.5">Abidjan · UTC+0</div>
    </div>
  )
}

export function Widgets() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  const [visible, setVisible] = useState<Record<WidgetKey, boolean>>({
    clock: true, calendar: true, weather: true,
  })

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('vdm_widgets')
      if (stored) setVisible(JSON.parse(stored))
    } catch { /* noop */ }

    const cached = getCachedWeather()
    if (cached) setWeather(cached)
  }, [])

  function toggleWidget(key: WidgetKey) {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('vdm_widgets', JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  useEffect(() => {
    const cached = getCachedWeather()
    if (cached) { setWeather(cached); return }

    fetch('https://api.open-meteo.com/v1/forecast?latitude=5.345&longitude=-4.0&current_weather=true&timezone=Africa%2FAbidjan')
      .then(r => r.json())
      .then(data => {
        const w: WeatherData = {
          temperature: Math.round(data.current_weather.temperature),
          weatherCode: data.current_weather.weathercode,
          windspeed: Math.round(data.current_weather.windspeed),
        }
        setCachedWeather(w)
        setWeather(w)
      })
      .catch(() => setWeatherError(true))
  }, [])

  // Calendar values computed from current date — only needs day-level accuracy
  const now = new Date()
  const firstDayRaw = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const calCells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d)
  while (calCells.length % 7 !== 0) calCells.push(null)

  const { label: weatherLabel, icon: weatherIcon } = weather ? wmoLabel(weather.weatherCode) : { label: '', icon: '' }
  const anyVisible = Object.values(visible).some(Boolean)

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden lg:flex flex-col items-end gap-2 pointer-events-none">

      {/* ── Bascules ── */}
      <div className="flex gap-1.5 pointer-events-auto">
        {WIDGET_KEYS.map(key => (
          <button
            key={key}
            onClick={() => toggleWidget(key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all backdrop-blur-sm shadow-md border ${
              visible[key]
                ? 'bg-[#F28C38] border-[#F28C38]/30 text-white'
                : 'bg-white/70 border-gray-200/50 text-gray-500 hover:bg-white/90'
            }`}
          >
            {WIDGET_LABELS[key]}
          </button>
        ))}
      </div>

      {/* ── Cartes widgets ── */}
      {anyVisible && (
        <div className="flex gap-3 items-end pointer-events-auto">

          {/* Horloge — composant isolé pour limiter les re-renders */}
          {visible.clock && <ClockWidget />}

          {/* Calendrier */}
          {visible.calendar && (
            <div className={`${CARD} w-44 p-3`}>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center mb-2">
                {MONTHS_SHORT[now.getMonth()]} {now.getFullYear()}
              </div>
              <div className="grid grid-cols-7">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={i} className="text-[9px] font-bold text-gray-400 text-center py-0.5">{d}</div>
                ))}
                {calCells.map((day, i) => (
                  <div
                    key={i}
                    className={`text-[10px] text-center py-0.5 rounded-md font-medium transition-colors ${
                      day === now.getDate()
                        ? 'bg-[#F28C38] text-white'
                        : day
                          ? 'text-gray-700 hover:bg-gray-100'
                          : ''
                    }`}
                  >
                    {day ?? ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Météo Abidjan — mise en cache 10 min */}
          {visible.weather && (
            <div className={`${CARD} w-40 p-4 flex flex-col items-center gap-1`}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Abidjan</div>
              {weatherError ? (
                <div className="text-xs text-gray-400 mt-2">Indisponible</div>
              ) : !weather ? (
                <div className="w-5 h-5 border-2 border-[#F28C38] border-t-transparent rounded-full animate-spin mt-2" />
              ) : (
                <>
                  <div className="text-4xl mt-1">{weatherIcon}</div>
                  <div className="text-2xl font-bold text-gray-900 leading-tight">{weather.temperature} °C</div>
                  <div className="text-xs text-gray-500">{weatherLabel}</div>
                  <div className="text-[10px] text-gray-400">Vent {weather.windspeed} km/h</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
