import { useState } from 'react'
import { getSchoolLogoUrl } from '../../lib/schoolLogos'

export default function TeamLogo({
  name,
  logoUrl,
  size = 20,
}: {
  name?: string
  logoUrl?: string | null
  size?: number
}) {
  const [error, setError] = useState(false)
  const safeName = typeof name === 'string' ? name.trim() : ''
  const resolvedUrl = safeName ? getSchoolLogoUrl({ name: safeName, logoUrl: logoUrl ?? null }) : null

  if (!resolvedUrl || error || !safeName) {
    const initial = (safeName || '?').charAt(0).toUpperCase()
    return (
      <span
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        className="inline-flex items-center justify-center rounded-full bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-600 flex-shrink-0 select-none"
        title={safeName}
      >
        {initial}
      </span>
    )
  }

  return (
    <img
      src={resolvedUrl}
      alt={safeName}
      loading="lazy"
      onError={() => setError(true)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className="object-contain flex-shrink-0"
    />
  )
}
