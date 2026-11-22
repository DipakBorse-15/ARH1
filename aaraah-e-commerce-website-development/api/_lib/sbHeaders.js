// Headers for calling the Supabase REST API with the public (publishable / anon) key.
// New keys ("sb_publishable_...") are NOT JWTs and must go in the `apikey` header only.
// Old anon keys (JWT, start with "eyJ") still need the Authorization header too.
export function sbHeaders(key) {
  return String(key).startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}
