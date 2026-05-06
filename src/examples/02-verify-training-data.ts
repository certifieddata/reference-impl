// Verify the training-data certificate at startup, exactly as the app does.
// Run: npm run example:02

import { fetchCert, loadKeys, verifyCertificate } from "@certifieddata/verify";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "..", "fixtures");

const cert = await fetchCert(join(fixturesDir, "training-cert.json"), { offline: true });
const keys = await loadKeys({ keysFile: join(fixturesDir, "keys.json"), offline: true });
const result = await verifyCertificate(cert, keys, join(fixturesDir, "training-data.csv"));

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
process.exit(result.verdict === "VALID" ? 0 : 1);
