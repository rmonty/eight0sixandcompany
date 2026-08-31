const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export function formatAddress(address = {}) {
  return [address.street, address.city, address.state, address.zip]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')
}

async function geocodeAddress(address) {
  const query = formatAddress(address)
  if (!query) return null

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  })

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Eight0SixAndCompany/1.0 (local delivery quote)',
    },
  })

  if (!response.ok) {
    throw new Error('Unable to look up delivery address.')
  }

  const results = await response.json()
  if (!Array.isArray(results) || results.length === 0) {
    return null
  }

  const first = results[0]
  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  return { lat, lon }
}

async function getDrivingDistanceMiles(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Unable to calculate delivery distance.')
  }

  const data = await response.json()
  const meters = data?.routes?.[0]?.distance
  if (!Number.isFinite(meters) || meters <= 0) {
    return null
  }

  return Number((meters / 1609.344).toFixed(1))
}

export async function quoteDeliveryMiles(originAddress, destinationAddress) {
  const [origin, destination] = await Promise.all([
    geocodeAddress(originAddress),
    geocodeAddress(destinationAddress),
  ])

  if (!origin || !destination) {
    return null
  }

  return getDrivingDistanceMiles(origin, destination)
}

export function calculateMileageDeliveryFee({
  miles,
  mileageRate,
  minimumFee = 0,
}) {
  const normalizedMiles = Math.max(0, Number(miles || 0))
  const rate = Math.max(0, Number(mileageRate || 0))
  const minimum = Math.max(0, Number(minimumFee || 0))
  const mileageFee = Number((normalizedMiles * rate).toFixed(2))
  return Number(Math.max(minimum, mileageFee).toFixed(2))
}
