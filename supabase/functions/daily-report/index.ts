import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const handler = async (req: Request): Promise<Response> => {
  const data = {
    message: "Daily report Edge Function - placeholder",
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
};

Deno.serve(handler); 