import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { extractBearerToken } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = extractBearerToken(authHeader)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read PDF bytes from request body
    const pdfBytes = await req.arrayBuffer()
    console.log('[extract-pdf] Server fallback extraction, bytes:', pdfBytes.byteLength)

    if (!pdfBytes || pdfBytes.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'PDF file data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use a simple text extraction approach for PDFs
    // Decode the PDF bytes to find text content between stream markers
    const decoder = new TextDecoder('latin1')
    const rawText = decoder.decode(pdfBytes)

    // Extract text from PDF content streams
    // This is a basic extraction that works for most text-based PDFs
    const textChunks: string[] = []

    // Look for text between BT (begin text) and ET (end text) operators
    const btEtRegex = /BT\s([\s\S]*?)ET/g
    let match
    while ((match = btEtRegex.exec(rawText)) !== null) {
      const block = match[1]
      // Extract text from Tj and TJ operators
      const tjRegex = /\((.*?)\)\s*Tj/g
      let tjMatch
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textChunks.push(tjMatch[1])
      }
      // Extract from TJ arrays
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g
      let tjArrayMatch
      while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
        const arrayContent = tjArrayMatch[1]
        const stringRegex = /\((.*?)\)/g
        let strMatch
        while ((strMatch = stringRegex.exec(arrayContent)) !== null) {
          textChunks.push(strMatch[1])
        }
      }
    }

    const extractedText = textChunks
      .join(' ')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    console.log('[extract-pdf] Extracted text length:', extractedText.length)

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[extract-pdf] Error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
