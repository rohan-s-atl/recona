import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'

async function main() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Say "Recona AI connection confirmed" and nothing else.' }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  console.log('✓', text)
}

main().catch(console.error)
