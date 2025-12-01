import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import lighthouse from "lighthouse";
import chromeLauncher from "chrome-launcher";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetUrl =
  process.env.LIGHTHOUSE_URL ?? process.env.APP_ENGINE_URL ?? "http://localhost:3000";

const outputDir = path.resolve(process.cwd(), "artifacts/accessibility");
await fs.promises.mkdir(outputDir, { recursive: true });

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

const options = {
  logLevel: "info",
  output: ["html", "json"],
  onlyCategories: ["accessibility"],
  port: chrome.port,
};

const runnerResult = await lighthouse(targetUrl, options);
const reportHtml = runnerResult.report[0];
const reportJson = runnerResult.report[1];
const timestamp = new Date().toISOString().replace(/[:]/g, "-");
const baseName = `lighthouse-accessibility-${timestamp}`;

await fs.promises.writeFile(path.join(outputDir, `${baseName}.report.html`), reportHtml);
await fs.promises.writeFile(path.join(outputDir, `${baseName}.report.json`), reportJson);

const accessibilityScore = Math.round(
  (runnerResult.lhr.categories.accessibility.score ?? 0) * 100
);

console.log(`Lighthouse accessibility score: ${accessibilityScore}`);

await chrome.kill();

if (accessibilityScore < 90) {
  console.error(`Accessibility score ${accessibilityScore} is below required threshold of 90`);
  process.exit(1);
}
