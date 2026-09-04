import fs from "node:fs";

export function configureSessionFixture(sessionApi, envName = "YACH_IM_FULL_SMOKE_SESSION_PATH") {
  const fixturePath = process.env[envName];
  if (!fixturePath) throw new Error(`${envName} is required for an explicit test fixture`);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  let current = structuredClone(fixture);
  sessionApi.configureSessionStore({
    register(key, value) {
      if (key !== "default") throw new Error(`unexpected session key: ${key}`);
      current = structuredClone(value);
    },
    lookup(key) {
      if (key !== "default") throw new Error(`unexpected session key: ${key}`);
      return current === undefined ? undefined : structuredClone(current);
    },
  });
  return sessionApi.loadSession();
}
