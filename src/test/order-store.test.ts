// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderStore } from "@/lib/order-store.server";

let store: OrderStore;

const draft = (overrides: Partial<Parameters<OrderStore["createOrder"]>[0]> = {}) => ({
  customerName: "Yassine El Amrani",
  customerPhone: "0612345678",
  customerPhoneNorm: "0612345678",
  customerEmail: "yassine@example.com",
  city: "Kénitra",
  address: "12 rue Mohamed V",
  notes: null,
  subtotal: 2058,
  shipping: 0,
  total: 2058,
  items: [
    {
      productSlug: "iso-100",
      productTitle: "ISO 100 1.37kg",
      variant: "Chocolat",
      quantity: 2,
      unitPrice: 1029,
    },
  ],
  ...overrides,
});

beforeEach(() => {
  store = new OrderStore(":memory:");
});

afterEach(() => {
  store.close();
});

describe("order store", () => {
  it("creates a numbered order with items and a creation event", () => {
    const order = store.createOrder(draft());
    expect(order.orderNumber).toMatch(/^PS-\d{4}-00001$/);
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("unpaid");
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.lineTotal).toBe(2058);
    expect(order.events[0]?.type).toBe("created");
  });

  it("increments order numbers and filters/searches the list", () => {
    const first = store.createOrder(draft());
    const second = store.createOrder(
      draft({
        customerName: "Salma Bennani",
        customerPhone: "0700000000",
        customerPhoneNorm: "0700000000",
      }),
    );
    expect(first.orderNumber).not.toBe(second.orderNumber);
    expect(store.listOrders({ q: "Salma" })).toHaveLength(1);
    expect(store.listOrders({ status: "pending" })).toHaveLength(2);
    expect(store.listOrders({ status: "delivered" })).toHaveLength(0);
  });

  it("only returns tracking data when the phone matches", () => {
    const order = store.createOrder(draft());
    expect(store.tracking(order.orderNumber, "0612345678")?.orderNumber).toBe(order.orderNumber);
    expect(store.tracking(order.orderNumber, "+212 612 34 56 78")?.orderNumber).toBe(
      order.orderNumber,
    );
    expect(store.tracking(order.orderNumber, "0699999999")).toBeNull();
    expect(store.tracking("PS-0000-00000", "0612345678")).toBeNull();
  });

  it("aggregates customers by normalized phone", () => {
    store.createOrder(draft());
    store.createOrder(draft({ customerName: "Yassine El A.", total: 1000, subtotal: 1000 }));
    const customers = store.listCustomers("");
    expect(customers).toHaveLength(1);
    expect(customers[0]?.ordersCount).toBe(2);
    expect(customers[0]?.totalSpent).toBe(3058);
    expect(store.getCustomer("0612345678")?.orders).toHaveLength(2);
  });

  it("marks a delivered order as paid and records the transition", () => {
    const order = store.createOrder(draft());
    const updated = store.updateStatus(order.id, "delivered", "admin-1");
    expect(updated.status).toBe("delivered");
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.events.some((event) => event.type === "status")).toBe(true);
  });

  it("creates one invoice per order and pays it", () => {
    const order = store.createOrder(draft());
    const invoice = store.createInvoice(order.id, "admin-1");
    expect(invoice.number).toMatch(/^FAC-\d{4}-00001$/);
    expect(store.createInvoice(order.id, "admin-1").number).toBe(invoice.number);

    const paid = store.setInvoiceStatus(invoice.id, "paid", "admin-1");
    expect(paid.status).toBe("paid");
    expect(store.getOrder(order.id)?.paymentStatus).toBe("paid");
  });

  it("logs outbound WhatsApp messages for an order", () => {
    const order = store.createOrder(draft());
    store.recordWhatsApp({
      phone: order.customerPhone,
      orderId: order.id,
      template: "status_confirmed",
      body: "Bonjour",
    });
    const detail = store.getOrder(order.id);
    expect(detail?.messages[0]?.template).toBe("status_confirmed");
    expect(detail?.events.some((event) => event.type === "whatsapp")).toBe(true);
  });

  it("computes revenue excluding cancelled orders", () => {
    const first = store.createOrder(draft({ total: 2000, subtotal: 2000 }));
    store.createOrder(
      draft({
        customerName: "Salma",
        customerPhoneNorm: "0700000000",
        total: 1500,
        subtotal: 1500,
      }),
    );
    store.updateStatus(first.id, "cancelled", "admin-1");
    const stats = store.stats();
    expect(stats.ordersCount).toBe(2);
    expect(stats.revenue).toBe(1500);
    expect(stats.customersCount).toBe(2);
    expect(stats.statusCounts.cancelled).toBe(1);
  });
});
