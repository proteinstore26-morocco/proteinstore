// Host allowlist validation for the importer (pure, testable).
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".test", ".invalid", ".onion"];

/** Normalize and validate a public hostname. Throws on protocols, paths, IPs, local names. */
export function normalizeImportHost(input: string): string {
  const host = input.trim().toLowerCase().replace(/\.$/, "");
  if (!host) throw new Error("Domaine vide.");
  if (
    host.includes("://") ||
    host.includes("/") ||
    host.includes(":") ||
    host.includes("@") ||
    /\s/.test(host)
  ) {
    throw new Error(
      "Indiquez uniquement le domaine, sans https://, chemin, port ni identifiants (ex. boutique.com).",
    );
  }
  if (host.length > 253) throw new Error("Domaine trop long.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes("[")) {
    throw new Error("Les adresses IP ne sont pas autorisées, uniquement des noms de domaine.");
  }
  const labels = host.split(".");
  if (labels.length < 2) throw new Error("Domaine invalide : un TLD est requis.");
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("Domaine invalide : caractères non autorisés.");
  }
  if (!/^[a-z]{2,63}$/.test(labels.at(-1) ?? "")) throw new Error("TLD invalide.");
  if (labels.includes("localhost") || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error("Les domaines locaux/internes ne sont pas autorisés.");
  }
  if (host === "metadata.google.internal") throw new Error("Domaine non autorisé.");
  return host;
}

export function isSameOrSubdomain(host: string, allowed: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  const base = allowed.toLowerCase().replace(/\.$/, "");
  return normalized === base || normalized.endsWith(`.${base}`);
}
