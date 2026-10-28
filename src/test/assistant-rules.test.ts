import { describe, expect, it } from "vitest";
import {
  detectIntent,
  extractOrderNumber,
  extractPhone,
  productTokens,
} from "@/lib/assistant-rules";

describe("assistant rules", () => {
  it("detects intents in French", () => {
    expect(detectIntent("Où est ma commande ?")).toBe("order");
    expect(detectIntent("Vous avez de la whey en stock ?")).toBe("stock");
    expect(detectIntent("C'est quoi les frais de livraison ?")).toBe("delivery");
    expect(detectIntent("Je peux payer en espèces ?")).toBe("payment");
    expect(detectIntent("Je veux parler à un humain")).toBe("handoff");
    expect(detectIntent("Bonjour")).toBe("greeting");
  });

  it("detects intents in English and Arabic", () => {
    expect(detectIntent("Where is my order?")).toBe("order");
    expect(detectIntent("Is creatine available?")).toBe("stock");
    expect(detectIntent("كم مدة التوصيل؟")).toBe("delivery");
    expect(detectIntent("السلام عليكم")).toBe("greeting");
  });

  it("prioritizes medical safety over everything", () => {
    expect(detectIntent("Quel dosage de créatine pour la santé ?")).toBe("medical");
    expect(detectIntent("I have a health problem with my order")).toBe("medical");
  });

  it("extracts order numbers in every format", () => {
    expect(extractOrderNumber("Ma commande PS-2026-00042")).toBe("PS-2026-00042");
    expect(extractOrderNumber("commande #12345")).toBe("12345");
    expect(extractOrderNumber("2026-00007 toujours rien")).toBe("PS-2026-00007");
    expect(extractOrderNumber("bonjour")).toBeNull();
  });

  it("extracts Moroccan phone numbers", () => {
    expect(extractPhone("06 12 34 56 78")).toBe("06 12 34 56 78");
    expect(extractPhone("+212661234567")).toBe("+212661234567");
    expect(extractPhone("aucun numéro ici")).toBeNull();
  });

  it("extracts product tokens for stock search", () => {
    const tokens = productTokens("Vous avez de la créatineApplied en stock ?");
    expect(tokens).toContain("creatineapplied");
    expect(tokens).not.toContain("vous");
  });
});
