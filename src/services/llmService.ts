import { GoogleGenerativeAI } from '@google/generative-ai';

const GOOGLE_API_KEY = 'AIzaSyBkwWZCkxqU-8_7gC_4spyC3I_PEv0y8Ks';
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// Convert JavaScript day (0=Sunday) to database day (0=Monday)
function getDbDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  // Convert: Monday=0, Tuesday=1, ..., Sunday=6
  return (jsDay + 6) % 7;
}

export async function askLLM(question: string, contextData: string): Promise<string> {
  const systemPrompt = `You are an AI assistant for a Delhi bus fleet management system.

You have access to real-time bus data, historical baselines, routes, stops, and alerts from the database.

IMPORTANT: Day of week in database is numbered 0-6 where:
- 0 = Monday
- 1 = Tuesday
- 2 = Wednesday
- 3 = Thursday
- 4 = Friday
- 5 = Saturday
- 6 = Sunday

Your role:
- Answer questions naturally based on the provided data
- Be specific with numbers, bus IDs, and metrics
- Compare current data vs historical baselines when relevant
- Mention if buses are delayed (speed < 70% of baseline)
- Be concise but informative
- When user asks about specific days (Monday, Tuesday, etc), remember the numbering above

The current date/time is: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
Today is ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][getDbDayOfWeek()]}.

Answer in a friendly, conversational tone.`;

  const fullPrompt = `${systemPrompt}

User Question: "${question}"

Available Context Data from Database:
${contextData}

Based on this data, answer the user's question naturally. If data is missing, say so politely.`;

  try {
    console.log('🤖 Using gemini-2.0-flash-exp (user\'s preferred model)...');

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Success with gemini-2.0-flash-exp');

    if (text) {
      return text;
    }

    throw new Error('Empty response from AI');

  } catch (error) {
    console.log('❌ Gemini API error:', error.message);

    // Check if it's a rate limit error
    if (error.message?.includes('429') || error.message?.includes('Resource exhausted')) {
      throw new Error('Google AI API rate limit exceeded. Please wait a moment and try again. Your API key has access to gemini-2.0-flash-exp but is being rate limited.');
    }

    // Check if it's an API key error
    if (error.message?.includes('API key')) {
      throw new Error('Invalid Google AI API key. Please check your key at https://makersuite.google.com/app/apikey');
    }

    throw new Error(`Failed to get response from AI: ${error.message}`);
  }
}
