/*
 * .env.test is loaded by dotenv-cli from the
 * npm test:integration command.
 *
 * This file does not load environment variables.
 * It only verifies that the integration tests
 * are safely isolated.
 */

if (process.env.NODE_ENV !== "test") {
  throw new Error(
    `SAFETY STOP: Integration tests require NODE_ENV=test. Current value: "${process.env.NODE_ENV ?? "undefined"}".`
  );
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SAFETY STOP: DATABASE_URL is missing for integration tests."
  );
}

const parsedDatabaseUrl = new URL(databaseUrl);

const schema =
  parsedDatabaseUrl.searchParams.get("schema");

/*
 * This is the most important safety check.
 *
 * Even if NODE_ENV is accidentally configured
 * incorrectly elsewhere, integration tests must
 * NEVER run against the normal public schema.
 */
if (schema !== "integration_test") {
  throw new Error(
    `SAFETY STOP: Integration tests cannot run against schema "${schema ?? "public"}". Expected "integration_test".`
  );
}