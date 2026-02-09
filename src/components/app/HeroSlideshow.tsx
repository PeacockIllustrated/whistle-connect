'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

const slides = [
  {
    src: '/assets/grassroots-morning.jpeg',
    alt: 'Grassroots football pitch at sunrise with goal post and referee flags',
  },
  {
    src: '/assets/referee_looking.jpeg',
    alt: 'Referee looking out over the football pitch at dawn',
  },
  {
    src: '/assets/coach-shake.jpeg',
    alt: 'Coach and referee shaking hands on the pitch',
  },
]

const INTERVAL = 6000

export function HeroSlideshow() {
  const [current, setCurrent] = useState(0)

  const advance = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
  }, [])

  useEffect(() => {
    const timer = setInterval(advance, INTERVAL)
    return () => clearInterval(timer)
  }, [advance])

  return (
    <>
      {slides.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          className={`object-cover object-center transition-opacity duration-[2000ms] ease-in-out ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
          priority={i === 0}
          sizes="100vw"
        />
      ))}
    </>
  )
}
