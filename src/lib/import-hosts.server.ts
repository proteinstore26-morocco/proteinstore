import { normalizeImportHost } from "./import-hosts";

export function envImportHosts(): string[] {
  const configured = process.env["IMPORT_ALLOWED_HOSTS"];
  if (!configured?.trim()) return ["powernutritionstore.de", "www.powernutritionstore.de"];
  return configured
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export type ImportHostEntry = {
  host: string;
  source: "env" | "custom";
  createdBy: string | null;
  createdAt: string | null;
};

export async function importHostEntries(): Promise<ImportHostEntry[]> {
  const { orderStore } = await import("./order-store.server");
  const env = envImportHosts();
  const custom = orderStore().listImportHosts();
  const entries: ImportHostEntry[] = env.map((host) => ({
    host,
    source: "env" as const,
    createdBy: null,
    createdAt: null,
  }));
  for (const row of custom) {
    if (!env.includes(row.host)) {
      entries.push({
        host: row.host,
        source: "custom",
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      });
    }
  }
  return entries;
}

export async function effectiveImportHosts(): Promise<string[]> {
  return [...new Set((await importHostEntries()).map((entry) => entry.host))];
}

export async function addImportHost(input: string, actorId: string): Promise<ImportHostEntry> {
  const host = normalizeImportHost(input);
  if (envImportHosts().includes(host))
    throw new Error("Ce domaine est déjà autorisé par la configuration serveur.");
  const { orderStore } = await import("./order-store.server");
  const row = orderStore().addImportHost(host, actorId);
  return { host: row.host, source: "custom", createdBy: row.createdBy, createdAt: row.createdAt };
}

export async function removeImportHost(host: string, actorId: string | null = null): Promise<void> {
  const normalized = normalizeImportHost(host);
  if (envImportHosts().includes(normalized)) {
    throw new Error(
      "Ce domaine vient de IMPORT_ALLOWED_HOSTS : retirez-le de la configuration serveur.",
    );
  }
  const { orderStore } = await import("./order-store.server");
  orderStore().removeImportHost(normalized, actorId);
}
