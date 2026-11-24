import type { SessionUser } from "../shared/types";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  PUBLIC_BASE_URL: string;
  /** Secret salt for hashing IP addresses. Set with `wrangler secret put IP_HASH_SALT`. */
  IP_HASH_SALT: string;
};

export type Variables = {
  user: SessionUser;
  csrfToken: string;
  ipHash: string;
};

export type AppEnv = { Bindings: Env; Variables: Variables };
