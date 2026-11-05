import { QUOTE_MODULE } from "./src/modules/quote";
import { APPROVAL_MODULE } from "./src/modules/approval";
import { COMPANY_MODULE } from "./src/modules/company";
import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV!, process.cwd());

const REDIS_URL = process.env.REDIS_URL;

// Use Redis-backed infrastructure modules when REDIS_URL is set (production),
// and fall back to the in-memory ones otherwise (local development).
const infrastructureModules: Record<
  string,
  { resolve: string; options?: Record<string, unknown> }
> = REDIS_URL
  ? {
      [Modules.CACHE]: {
        resolve: "@medusajs/medusa/cache-redis",
        options: { redisUrl: REDIS_URL },
      },
      [Modules.EVENT_BUS]: {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl: REDIS_URL },
      },
      [Modules.WORKFLOW_ENGINE]: {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { url: REDIS_URL } },
      },
      [Modules.LOCKING]: {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
    }
  : {
      [Modules.CACHE]: {
        resolve: "@medusajs/medusa/cache-inmemory",
      },
      [Modules.WORKFLOW_ENGINE]: {
        resolve: "@medusajs/medusa/workflow-engine-inmemory",
      },
    };

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: {
    [COMPANY_MODULE]: {
      resolve: "./modules/company",
    },
    [QUOTE_MODULE]: {
      resolve: "./modules/quote",
    },
    [APPROVAL_MODULE]: {
      resolve: "./modules/approval",
    },
    ...infrastructureModules,
  },
});
