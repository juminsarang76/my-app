import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { productName, features, price, targetCustomer, imageStyle, platforms, competitors } =
    await req.json()

  const systemPrompt = `You are an expert e-commerce product image prompt engineer.
Given Korean product details, write a detailed English image generation prompt for a professional product marketing photo.
Output ONLY the prompt—no explanations, no Korean text.
Include: product description, scene/background, lighting, camera angle, mood/style, colors.
Format: single paragraph, under 250 words.`

  const userContent = `
Product name: ${productName}
Key features: ${features}
Price range: ${price}
Target customer: ${targetCustomer}
Image mood/style: ${imageStyle}
Sales platforms: ${Array.isArray(platforms) ? platforms.join(', ') : platforms}
${competitors ? `Competitors / differentiators: ${competitors}` : ''}

Write a photorealistic product photography prompt optimized for the above.`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const prompt = data.choices?.[0]?.message?.content?.trim() ?? ''
  return NextResponse.json({ prompt })
}
