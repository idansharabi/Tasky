import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(apiKey)

export async function analyzeTaskPhoto(photoBase64, mimeType, taskTitle, taskDescription) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `You are a helpful assistant verifying that a child has completed a household task.

Task: "${taskTitle}"
${taskDescription ? `Description: "${taskDescription}"` : ''}

Look at the photo and determine if it shows evidence that this task was completed.
Be reasonably lenient — if the photo shows a good-faith effort, approve it.

Respond in JSON format only:
{
  "approved": true or false,
  "confidence": "high", "medium", or "low",
  "reasoning": "one sentence explanation"
}`

  const imagePart = {
    inlineData: {
      data: photoBase64,
      mimeType,
    },
  }

  try {
    const result = await model.generateContent([prompt, imagePart])
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { approved: null, confidence: 'low', reasoning: 'Could not parse AI response' }
  } catch (err) {
    console.error('Gemini error:', err)
    return { approved: null, confidence: 'low', reasoning: 'AI analysis failed' }
  }
}
