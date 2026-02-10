// Enhanced Vercel Serverless Function for Content Repurposing
// Includes: URL extraction, Analytics, Multi-language support

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, formats, tone, language = 'en', url, userCountry } = req.body;

    // URL content extraction
    let finalContent = content;
    if (url && !content) {
      try {
        // Extract content from URL using a simple fetch
        const urlResponse = await fetch(url);
        const html = await urlResponse.text();
        
        // Simple text extraction (remove HTML tags)
        finalContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 3000); // Limit to first 3000 chars
      } catch (urlError) {
        console.error('URL extraction error:', urlError);
        return res.status(400).json({ error: 'Failed to extract content from URL' });
      }
    }

    // Validate input
    if (!finalContent || !formats || formats.length === 0 || !tone) {
      return res.status(400).json({ 
        error: 'Missing required fields: content (or url), formats, and tone are required' 
      });
    }

    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Language mapping
    const languageNames = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      it: 'Italian',
      ja: 'Japanese',
      zh: 'Chinese'
    };

    const targetLanguage = languageNames[language] || 'English';

    // Enhanced format instructions with new formats
    const formatMap = {
      tweet: 'a Twitter thread (3-5 tweets, each under 280 characters, numbered, engaging hooks)',
      linkedin: 'a LinkedIn post (professional, 150-200 words, with line breaks for readability, include relevant hashtags)',
      video: 'a video script (with intro hook, main points with timestamps, and outro call-to-action)',
      instagram: 'an Instagram caption (engaging, 125-150 words, with emojis and relevant hashtags)',
      email: 'an email newsletter (professional subject line, engaging intro, clear sections, strong CTA)',
      blog: 'a blog post introduction (compelling hook, 2-3 engaging paragraphs, SEO-optimized)',
      podcast: 'a podcast script (conversational tone, natural transitions, questions for guest, 3-5 minute segment)',
      tiktok: 'a TikTok video script (15-60 second hook, punchy delivery, trending language, call-to-action)',
      press: 'a press release (formal AP style, headline, dateline, quote, boilerplate, contact info)',
      medium: 'a Medium article (thought-provoking title, engaging subheadings, 800-1000 words, storytelling approach)'
    };

    const formatInstructions = formats
      .map(formatId => formatMap[formatId])
      .filter(Boolean)
      .join(', ');

    console.log('Calling Anthropic API...');

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
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Transform the following content into ${formatInstructions}.

Tone: ${tone}
Language: ${targetLanguage} (write ALL outputs in ${targetLanguage})

Original Content:
${finalContent}

Return ONLY a JSON object with this exact structure (no markdown, no preamble):
{
  "tweet": "...",
  "linkedin": "...",
  "video": "...",
  "instagram": "...",
  "email": "...",
  "blog": "...",
  "podcast": "...",
  "tiktok": "...",
  "press": "...",
  "medium": "..."
}

Only include the formats I requested: ${formats.join(', ')}. 
Make each version unique and optimized for its platform.
Write EVERYTHING in ${targetLanguage}.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: 'AI service error', 
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    console.log('Anthropic API success');
    
    // Extract text from response
    const textContent = data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    // Clean and parse JSON
    const cleanJson = textContent.replace(/```json|```/g, '').trim();
    const parsedResults = JSON.parse(cleanJson);

    // Format results with character counts
    const formattedResults = formats.map(formatId => ({
      format: formatId,
      content: parsedResults[formatId] || 'Content generation failed',
      characterCount: (parsedResults[formatId] || '').length,
      wordCount: (parsedResults[formatId] || '').split(/\s+/).length
    }));

    console.log('Returning success response');

    // Log analytics (in production, save to database)
    console.log('Analytics:', {
      timestamp: new Date().toISOString(),
      formats: formats,
      tone: tone,
      language: language,
      country: userCountry || 'unknown',
      contentLength: finalContent.length,
      fromUrl: !!url
    });

    // Return success
    return res.status(200).json({
      success: true,
      results: formattedResults,
      metadata: {
        language: targetLanguage,
        originalLength: finalContent.length,
        extractedFromUrl: !!url
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
}
