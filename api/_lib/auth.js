function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase auth env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY (or publishable equivalent).')
  }

  return { supabaseUrl, supabaseAnonKey }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token
}

export async function requireAuthenticatedUser(req) {
  const token = getBearerToken(req)
  if (!token) {
    const error = new Error('Missing bearer token')
    error.statusCode = 401
    throw error
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  })

  if (!response.ok) {
    const error = new Error('Invalid authentication token')
    error.statusCode = 401
    throw error
  }

  const user = await response.json()
  if (!user?.id) {
    const error = new Error('Authenticated user not found')
    error.statusCode = 401
    throw error
  }

  return {
    id: user.id,
    email: user.email || null,
  }
}
