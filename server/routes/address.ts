import { Router } from 'express';
import https from 'https';

const router = Router();

const USER_AGENT = 'ShishaDelivery/1.0 (delivery-app)';

// Helper: make a GET request to Nominatim
function nominatimRequest(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON from Nominatim'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Nominatim request timed out'));
    });
  });
}

// Build a clean address from Nominatim address components
function formatAddress(addr: any): string {
  if (!addr) return '';
  const parts: string[] = [];

  // Street + house number
  const street = addr.road || addr.pedestrian || addr.footway || addr.street || '';
  const number = addr.house_number || '';
  if (street) {
    parts.push(number ? `${street} ${number}` : street);
  }

  // Postal code + city
  const zip = addr.postcode || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  if (zip && city) {
    parts.push(`${zip} ${city}`);
  } else if (city) {
    parts.push(city);
  } else if (zip) {
    parts.push(zip);
  }

  // Country
  if (addr.country) {
    parts.push(addr.country);
  }

  return parts.join(', ');
}

/**
 * POST /api/address/validate
 * Forward geocode: address string → verified address + coordinates
 */
router.post('/validate', async (req, res) => {
  const { address } = req.body;

  if (!address || typeof address !== 'string' || address.trim().length < 3) {
    return res.status(400).json({
      valid: false,
      error: 'Adresse muss mindestens 3 Zeichen lang sein',
    });
  }

  try {
    const query = encodeURIComponent(address.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&addressdetails=1&limit=5&accept-language=de`;
    const results = await nominatimRequest(url);

    if (!Array.isArray(results) || results.length === 0) {
      return res.json({
        valid: false,
        error: 'Adresse konnte nicht gefunden werden. Bitte überprüfe die Eingabe.',
      });
    }

    const best = results[0];
    const formatted = formatAddress(best.address) || best.display_name || address;

    return res.json({
      valid: true,
      address: formatted,
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      details: {
        street: best.address?.road || best.address?.pedestrian || null,
        streetNumber: best.address?.house_number || null,
        zipcode: best.address?.postcode || null,
        city: best.address?.city || best.address?.town || best.address?.village || null,
        state: best.address?.state || null,
        country: best.address?.country || null,
      },
      alternatives: results.slice(1, 5).map((r: any) => ({
        address: formatAddress(r.address) || r.display_name || '',
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      })),
    });
  } catch (err: any) {
    console.error('Geocoding error:', err?.message || err);
    return res.status(500).json({
      valid: false,
      error: 'Adressüberprüfung fehlgeschlagen. Bitte versuche es erneut.',
    });
  }
});

/**
 * POST /api/address/reverse
 * Reverse geocode: coordinates → address + coordinates
 */
router.post('/reverse', async (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({
      valid: false,
      error: 'Koordinaten (lat, lng) sind erforderlich',
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      valid: false,
      error: 'Ungültige Koordinaten',
    });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=de`;
    const result = await nominatimRequest(url);

    if (!result || result.error) {
      return res.json({
        valid: false,
        error: 'Keine Adresse für diese Koordinaten gefunden.',
        lat,
        lng,
      });
    }

    const formatted = formatAddress(result.address) || result.display_name || `${lat}, ${lng}`;

    return res.json({
      valid: true,
      address: formatted,
      lat: parseFloat(result.lat) || lat,
      lng: parseFloat(result.lon) || lng,
      details: {
        street: result.address?.road || result.address?.pedestrian || null,
        streetNumber: result.address?.house_number || null,
        zipcode: result.address?.postcode || null,
        city: result.address?.city || result.address?.town || result.address?.village || null,
        state: result.address?.state || null,
        country: result.address?.country || null,
      },
    });
  } catch (err: any) {
    console.error('Reverse geocoding error:', err?.message || err);
    return res.status(500).json({
      valid: false,
      error: 'Adressauflösung fehlgeschlagen. Bitte versuche es erneut.',
      lat,
      lng,
    });
  }
});

export default router;
