import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token_hash = url.searchParams.get('token_hash')
    const type = url.searchParams.get('type')
    
    if (!token_hash || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing token_hash or type parameter' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })
    
    if (error) {
      console.error('Auth verification error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    // For development, redirect to localhost
    const redirectUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${redirectUrl}/dashboard?verified=true`,
      },
    })
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 