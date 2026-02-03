// Vercel Serverless Function for Content Repurposing
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, formats, tone } = req.body;

    // Validate input
    if (!content || !formats || formats.length === 0 || !tone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Prepare format instructions
    const formatInstructions = formats.map(formatId => {
      const formatMap = {
        tweet: 'a Twitter thread (3-5 tweets, each under 280 characters, numbered, engaging hooks)',
        linkedin: 'a LinkedIn post (professional, 150-200 words, with line breaks for readability, include relevant hashtags)',
        video: 'a video script (with intro hook, main points with timestamps, and outro call-to-action)',
        instagram: 'an Instagram caption (engaging, 125-150 words, with emojis and relevant hashtags)'
      };
      return formatMap[formatId];
    }).join(', ');

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `Transform the following content into ${formatInstructions}.

Tone: ${tone}

Original Content:
${content}

Return ONLY a JSON object with this exact structure (no markdown, no preamble):
{
  "tweet": "...",
  "linkedin": "...",
  "video": "...",
  "instagram": "..."
}

Only include the formats I requested: ${formats.join(', ')}. Make each version unique and optimized for its platform.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: 'AI service error', 
        details: errorData 
      });
    }

    const data = await response.json();
    
    // Extract text from response
    const textContent = data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    // Clean and parse JSON
    const cleanJson = textContent.replace(/```json|```/g, '').trim();
    const parsedResults = JSON.parse(cleanJson);

    // Format results
    const formattedResults = formats.map(formatId => ({
      format: formatId,
      content: parsedResults[formatId] || 'Content generation failed'
    }));

    // Return success
    return res.status(200).json({
      success: true,
      results: formattedResults
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}
