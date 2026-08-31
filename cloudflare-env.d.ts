declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    GAME_ROOMS: DurableObjectNamespace;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_SECRET?: string;
  }
}
