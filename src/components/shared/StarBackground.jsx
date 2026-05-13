import { useEffect, useRef } from 'react'

export default function StarBackground() {
  const canvasRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Static stars ─────────────────────────────────────────
    const STAR_COUNT = 220
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:       Math.random(),
      y:       Math.random(),
      r:       Math.random() * 1.4 + 0.3,
      base:    Math.random() * 0.6 + 0.2,
      speed:   Math.random() * 0.008 + 0.003,
      offset:  Math.random() * Math.PI * 2,
    }))

    // ── Shooting stars ────────────────────────────────────────
    const shooting = []
    let lastShot = 0

    function spawnShooting() {
      const angle = (Math.PI / 180) * (Math.random() * 25 + 15) // 15–40°
      const speed = Math.random() * 7 + 5
      const startX = Math.random() < 0.6
        ? Math.random() * canvas.width
        : 0
      const startY = Math.random() < 0.6
        ? 0
        : Math.random() * canvas.height * 0.4

      shooting.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: Math.random() * 100 + 60,
        opacity: 1,
      })
    }

    // ── Draw loop ─────────────────────────────────────────────
    function draw(ts) {
      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      bg.addColorStop(0, '#060d1f')
      bg.addColorStop(0.5, '#0a1628')
      bg.addColorStop(1, '#071022')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Static stars
      const t = ts * 0.001
      for (const s of stars) {
        const opacity = s.base + Math.sin(t * s.speed * 10 + s.offset) * 0.3
        ctx.beginPath()
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 220, 255, ${Math.max(0, opacity)})`
        ctx.fill()
      }

      // Spawn shooting star every 1.8–3.5s
      if (ts - lastShot > Math.random() * 1700 + 1800) {
        spawnShooting()
        lastShot = ts
      }

      // Draw & update shooting stars
      for (let i = shooting.length - 1; i >= 0; i--) {
        const s = shooting[i]

        const tailX = s.x - s.vx * (s.length / (Math.hypot(s.vx, s.vy)))
        const tailY = s.y - s.vy * (s.length / (Math.hypot(s.vx, s.vy)))

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
        grad.addColorStop(0, `rgba(147, 197, 253, 0)`)
        grad.addColorStop(0.6, `rgba(191, 219, 254, ${s.opacity * 0.4})`)
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.opacity})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(s.x, s.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.8
        ctx.stroke()

        // Bright head glow
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6)
        glow.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`)
        glow.addColorStop(1, `rgba(147, 197, 253, 0)`)
        ctx.beginPath()
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        s.x += s.vx
        s.y += s.vy
        s.opacity -= 0.014

        if (s.opacity <= 0) shooting.splice(i, 1)
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 0, display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
