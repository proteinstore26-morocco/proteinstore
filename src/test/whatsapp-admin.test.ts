import { describe, expect, it } from "vitest";
import {
  buildInvoiceMessage,
  buildPaymentMessage,
  buildStatusMessage,
  waUrlTo,
} from "@/lib/whatsapp";

const order = { orderNumber: "PS-2026-00042", customerName: "Yassine El Amrani", total: 2307 };

describe("admin WhatsApp messages", () => {
  it("personalises the confirmation with the order number and total", () => {
    const message = buildStatusMessage(order, "confirmed");
    expect(message).toContain("Bonjour Yassine");
    expect(message).toContain("PS-2026-00042");
    expect(message).toContain("confirmée");
  });

  it("covers shipping, delivery and cancellation", () => {
    expect(buildStatusMessage(order, "shipped")).toContain("en route");
    expect(buildStatusMessage(order, "delivered")).toContain("livrée");
    expect(buildStatusMessage(order, "cancelled")).toContain("annulée");
  });

  it("builds invoice and payment messages", () => {
    expect(
      buildInvoiceMessage({
        customerName: order.customerName,
        invoiceNumber: "FAC-2026-00007",
        orderNumber: order.orderNumber,
        total: order.total,
      }),
    ).toContain("FAC-2026-00007");
    expect(buildPaymentMessage(order)).toContain("réception du paiement");
  });

  it("targets the customer's international number", () => {
    expect(waUrlTo("0612345678", "Bonjour")).toBe("https://wa.me/212612345678?text=Bonjour");
  });
});
