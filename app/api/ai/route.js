import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { system, messages, max_tokens = 900, image } = await request.json()

    if (!process.env.GEMINI_API_KEY) {
      return Response.json({ error: 'GEMINI_API_KEY no configurado' }, { status: 500 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: system || '',
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({ history })

    let messageParts
    if (image) {
      messageParts = [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: lastMessage.content },
      ]
    } else {
      messageParts = lastMessage.content
    }

    const result = await chat.sendMessage(messageParts)
    const text = result.response.text()

    return Response.json({ text })
  } catch (error) {
    console.error('Gemini API error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}

