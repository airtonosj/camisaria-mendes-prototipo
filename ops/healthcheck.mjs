const url = (process.env.HEALTHCHECK_URL || "http://127.0.0.1:3333/api/health").trim();
const attempts = Math.max(1, Number.parseInt(process.env.HEALTHCHECK_ATTEMPTS || "12", 10));
const intervalMs = Math.max(100, Number.parseInt(process.env.HEALTHCHECK_INTERVAL_MS || "2500", 10));

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true || body.schema?.ready !== true || body.storage?.ready !== true) {
      throw new Error(`resposta não saudável (${response.status}): ${JSON.stringify(body)}`);
    }
    console.log(`Health check aprovado em ${url}: schema ${body.schema.current}, storage pronto.`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < attempts) await delay(intervalMs);
  }
}

console.error(`Health check falhou após ${attempts} tentativa(s): ${lastError?.message || lastError}`);
process.exit(1);
