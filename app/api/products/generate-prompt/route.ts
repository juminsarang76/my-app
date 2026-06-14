import { NextRequest, NextResponse } from 'next/server'
import { callLLMText } from '@/app/lib/llm'

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

  try {
    const { text } = await callLLMText(systemPrompt, userContent, { temperature: 0.7, maxTokens: 500 })
    return NextResponse.json({ prompt: text.trim() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
