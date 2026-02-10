// Analytics endpoint - track transformations
// This stores basic stats that can be displayed publicly

// In-memory storage for demo (use database in production)
let analytics = {
  totalTransformations: 0,
  totalUsers: 0,
  countries: {},
  formats: {},
  languages: {},
  dates: {},
  lastUpdated: new Date().toISOString()
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET - Return analytics
  if (req.method === 'GET') {
    const topCountries = Object.entries(analytics.countries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    const topFormats = Object.entries(analytics.formats)
      .sort((a, b) => b[1] - a[1])
      .map(([format, count]) => ({ format, count }));

    return res.status(200).json({
      ...analytics,
      topCountries,
      topFormats,
      countriesCount: Object.keys(analytics.countries).length
    });
  }

  // POST - Track new transformation
  if (req.method === 'POST') {
    const { formats, language, country, userId } = req.body;

    analytics.totalTransformations++;
    
    // Track country
    if (country) {
      analytics.countries[country] = (analytics.countries[country] || 0) + 1;
    }

    // Track formats
    if (formats && Array.isArray(formats)) {
      formats.forEach(format => {
        analytics.formats[format] = (analytics.formats[format] || 0) + 1;
      });
    }

    // Track language
    if (language) {
      analytics.languages[language] = (analytics.languages[language] || 0) + 1;
    }

    // Track date
    const today = new Date().toISOString().split('T')[0];
    analytics.dates[today] = (analytics.dates[today] || 0) + 1;

    analytics.lastUpdated = new Date().toISOString();

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
