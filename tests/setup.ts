// Keep tests deterministic and in local mode even when the developer has a
// .env.local file or provider keys in their shell.
process.env.AUTH_SECRET = "whisk-flow-test-secret-that-is-long-enough-0123456789";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
delete process.env.DATABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.JSON2VIDEO_API_KEY;
delete process.env.GEMINI_IMAGE_MODEL;
delete process.env.GEMINI_VIDEO_MODEL;
delete process.env.GEMINI_TEXT_MODEL;
delete process.env.OPENAI_IMAGE_MODEL;
delete process.env.OPENAI_PRECISION_IMAGE_MODEL;
delete process.env.OPENAI_TEXT_MODEL;
delete process.env.JSON2VIDEO_MODEL;
delete process.env.CREDIT_COST_OVERRIDES;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
