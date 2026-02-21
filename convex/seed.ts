import { mutation } from "./_generated/server";

/** Seed centers + test prospects. Run once via dashboard or CLI. */
export const seedDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    /* ── Check if already seeded ──────────────────────────────── */
    const existing = await ctx.db.query("centers").first();
    if (existing) {
      return { status: "already_seeded" };
    }

    /* ── Imaging Centers ──────────────────────────────────────── */
    const centerA = await ctx.db.insert("centers", {
      name: "Bay Imaging Center",
      address: "123 Market St, San Francisco, CA 94105",
      phone: "+14155550101",
      hours: "Mon-Fri 8am-6pm, Sat 9am-1pm",
      discountAmount: 0,
      distanceTier: "close",
      basePrice: 150,
      availableSlots: [
        { date: "2026-02-25", time: "9:00 AM", available: true },
        { date: "2026-02-25", time: "10:30 AM", available: true },
        { date: "2026-02-25", time: "2:00 PM", available: true },
        { date: "2026-02-26", time: "9:00 AM", available: true },
        { date: "2026-02-26", time: "11:00 AM", available: true },
        { date: "2026-02-27", time: "10:00 AM", available: true },
      ],
    });

    const centerB = await ctx.db.insert("centers", {
      name: "Peninsula Radiology",
      address: "456 El Camino Real, San Mateo, CA 94401",
      phone: "+14155550102",
      hours: "Mon-Fri 7am-7pm, Sat 8am-3pm",
      discountAmount: 10,
      distanceTier: "medium",
      basePrice: 150,
      availableSlots: [
        { date: "2026-02-25", time: "8:00 AM", available: true },
        { date: "2026-02-25", time: "10:30 AM", available: true },
        { date: "2026-02-25", time: "1:00 PM", available: true },
        { date: "2026-02-26", time: "9:30 AM", available: true },
        { date: "2026-02-26", time: "3:00 PM", available: true },
        { date: "2026-02-27", time: "11:00 AM", available: true },
      ],
    });

    const centerC = await ctx.db.insert("centers", {
      name: "Valley Diagnostic Imaging",
      address: "789 Stevens Creek Blvd, San Jose, CA 95129",
      phone: "+14155550103",
      hours: "Mon-Sat 7am-8pm",
      discountAmount: 50,
      distanceTier: "far",
      basePrice: 150,
      availableSlots: [
        { date: "2026-02-25", time: "7:30 AM", available: true },
        { date: "2026-02-25", time: "9:00 AM", available: true },
        { date: "2026-02-25", time: "11:00 AM", available: true },
        { date: "2026-02-25", time: "2:30 PM", available: true },
        { date: "2026-02-26", time: "8:00 AM", available: true },
        { date: "2026-02-26", time: "10:00 AM", available: true },
        { date: "2026-02-27", time: "9:00 AM", available: true },
        { date: "2026-02-27", time: "1:00 PM", available: true },
      ],
    });

    /* ── Test Prospects ────────────────────────────────────────── */
    await ctx.db.insert("prospects", {
      name: "John Smith",
      phone: "+14155551234",
      zip: "94105",
      insurance: "Blue Shield",
      status: "pending",
      callAttempts: 0,
      maxAttempts: 3,
    });

    await ctx.db.insert("prospects", {
      name: "Sarah Johnson",
      phone: "+14155555678",
      zip: "94401",
      insurance: "Aetna",
      status: "pending",
      callAttempts: 0,
      maxAttempts: 3,
    });

    await ctx.db.insert("prospects", {
      name: "Michael Chen",
      phone: "+14155559012",
      zip: "95129",
      insurance: "Kaiser",
      status: "pending",
      callAttempts: 0,
      maxAttempts: 3,
    });

    await ctx.db.insert("prospects", {
      name: "Emily Davis",
      phone: "+14155553456",
      zip: "94110",
      insurance: "United Healthcare",
      status: "pending",
      callAttempts: 0,
      maxAttempts: 3,
    });

    await ctx.db.insert("prospects", {
      name: "Robert Wilson",
      phone: "+14155557890",
      zip: "94303",
      insurance: "Cigna",
      status: "pending",
      callAttempts: 0,
      maxAttempts: 3,
    });

    /* ── Human Reps ───────────────────────────────────────────── */
    await ctx.db.insert("humanReps", {
      name: "Mike Torres",
      phone: "+14155559999",
      email: "mike@callflow.dev",
      status: "available",
    });

    await ctx.db.insert("humanReps", {
      name: "Lisa Park",
      phone: "+14155558888",
      email: "lisa@callflow.dev",
      status: "available",
    });

    return {
      status: "seeded",
      centers: { centerA, centerB, centerC },
    };
  },
});
