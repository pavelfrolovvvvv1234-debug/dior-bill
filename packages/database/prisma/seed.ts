import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123!", 12);

  const tiers = await Promise.all([
    prisma.affiliateTier.upsert({
      where: { name: "Starter" },
      update: { percent: 5 },
      create: { name: "Starter", percent: 5, minReferrals: 0, minEarnings: 0 },
    }),
    prisma.affiliateTier.upsert({
      where: { name: "Pro" },
      update: {},
      create: { name: "Pro", percent: 15, minReferrals: 10, minEarnings: 500 },
    }),
    prisma.affiliateTier.upsert({
      where: { name: "VIP" },
      update: {},
      create: { name: "VIP", percent: 25, minReferrals: 50, minEarnings: 5000 },
    }),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dior.cloud" },
    update: {},
    create: {
      email: "admin@dior.cloud",
      passwordHash,
      role: "SUPER_ADMIN",
      referralCode: "DIORADMIN",
      balance: 10000,
      emailVerified: new Date(),
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: "demo@dior.cloud" },
    update: {},
    create: {
      email: "demo@dior.cloud",
      passwordHash: await bcrypt.hash("demo123!", 12),
      referralCode: "DEMODIOR",
      balance: 250,
      credits: 50,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: demo.id },
    update: {},
    create: { userId: demo.id },
  });

  const locations = await Promise.all([
    prisma.location.upsert({
      where: { code: "nl-ams" },
      update: { name: "Netherlands", country: "NL", city: "Amsterdam", flag: "🇳🇱" },
      create: { code: "nl-ams", name: "Netherlands", country: "NL", city: "Amsterdam", flag: "🇳🇱" },
    }),
    prisma.location.upsert({
      where: { code: "de-fra" },
      update: { name: "Germany", country: "DE", city: "Frankfurt", flag: "🇩🇪" },
      create: { code: "de-fra", name: "Germany", country: "DE", city: "Frankfurt", flag: "🇩🇪" },
    }),
    prisma.location.upsert({
      where: { code: "us-nyc" },
      update: { name: "USA", country: "US", city: "New York", flag: "🇺🇸" },
      create: { code: "us-nyc", name: "USA", country: "US", city: "New York", flag: "🇺🇸" },
    }),
    prisma.location.upsert({
      where: { code: "tr-ist" },
      update: { name: "Turkey", country: "TR", city: "Istanbul", flag: "🇹🇷" },
      create: { code: "tr-ist", name: "Turkey", country: "TR", city: "Istanbul", flag: "🇹🇷" },
    }),
    prisma.location.upsert({
      where: { code: "fi-hel" },
      update: {},
      create: { code: "fi-hel", name: "Helsinki", country: "FI", city: "Helsinki", flag: "🇫🇮" },
    }),
  ]);

  for (const loc of locations) {
    const ipv4Total = 256;
    const ipv4Available = 180 + Math.floor(Math.random() * 40);
    await prisma.node.upsert({
      where: { hostname: `node-${loc.code}-01` },
      update: {
        ipv4Total,
        ipv4Available,
        capacityPercent: 35 + Math.random() * 25,
      },
      create: {
        name: `${loc.name} Node 01`,
        hostname: `node-${loc.code}-01`,
        locationId: loc.id,
        type: "compute",
        cpuCores: 64,
        ramGb: 256,
        diskGb: 4000,
        loadPercent: 35 + Math.random() * 20,
        activeVps: 12,
        proxmoxNode: `pve-${loc.code}`,
        ipv4Total,
        ipv4Available,
        capacityPercent: 40,
      },
    });
  }

  const nodes = await prisma.node.findMany();
  for (const n of nodes) {
    const existing = await prisma.ipAddress.count({ where: { nodeId: n.id } });
    if (existing > 0) continue;
    const base = 10 + nodes.indexOf(n);
    const ips = Array.from({ length: 20 }, (_, i) => ({
      address: `185.234.${base}.${i + 10}`,
      nodeId: n.id,
      locationId: n.locationId,
      status: i < 5 ? "assigned" : "available",
    }));
    await prisma.ipAddress.createMany({ data: ips, skipDuplicates: true });
  }

  await prisma.dedicatedInventory.createMany({
    data: [
      {
        sku: "dedi-e3-32",
        name: "E3-1270v6 · 32GB · 2×1TB NVMe",
        cpu: "Intel Xeon E3-1270v6",
        ramGb: 32,
        storage: "2× 1TB NVMe",
        uplink: "1 Gbps unmetered",
        locationId: locations[0].id,
        monthlyPrice: 89,
        stockTotal: 10,
        stockAvail: 7,
      },
      {
        sku: "dedi-e5-128",
        name: "Dual E5-2690v4 · 128GB · 4×2TB NVMe",
        cpu: "2× Intel Xeon E5-2690v4",
        ramGb: 128,
        storage: "4× 2TB NVMe",
        uplink: "10 Gbps · 100TB",
        locationId: locations[1].id,
        monthlyPrice: 299,
        stockTotal: 5,
        stockAvail: 2,
      },
    ],
    skipDuplicates: true,
  });

  const node = await prisma.node.findFirst();
  if (node) {
    const vpsService = await prisma.service.create({
      data: {
        userId: demo.id,
        type: "VPS",
        status: "ACTIVE",
        label: "prod-api-01",
        monthlyPrice: 24.99,
        autoRenew: true,
        renewsAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.vpsInstance.create({
      data: {
        serviceId: vpsService.id,
        nodeId: node.id,
        locationId: node.locationId,
        hostname: "prod-api-01",
        primaryIp: "185.234.10.42",
        os: "debian-12",
        cpuCores: 4,
        ramMb: 8192,
        diskGb: 80,
        bandwidthTb: 2,
        bandwidthUsedGb: 340,
        cpuUsage: 23,
        ramUsage: 61,
        diskUsage: 45,
        uptimeSeconds: BigInt(864000 * 12),
        proxmoxVmid: 1042,
      },
    });
  }

  await prisma.domain.create({
    data: {
      service: {
        create: {
          userId: demo.id,
          type: "DOMAIN",
          status: "ACTIVE",
          label: "dior-demo.net",
          monthlyPrice: 1.5,
          expiresAt: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        },
      },
      domainName: "dior-demo.net",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
      nameservers: ["ns1.dior.cloud", "ns2.dior.cloud"],
    },
  });

  const cdnService = await prisma.service.create({
    data: {
      userId: demo.id,
      type: "CDN",
      status: "ACTIVE",
      label: "cdn.dior-demo.net",
      monthlyPrice: 19,
    },
  });
  const zone = await prisma.cdnZone.create({
    data: {
      serviceId: cdnService.id,
      zoneName: "cdn.dior-demo.net",
      bandwidthGb: 1240,
      requests: BigInt(45000000),
      cacheHitRatio: 94.2,
    },
  });
  for (const loc of locations.slice(0, 2)) {
    await prisma.cdnEdgeRegion.create({
      data: { zoneId: zone.id, locationId: loc.id, requests: BigInt(20000000), bandwidthGb: 620 },
    });
  }

  await prisma.infrastructureFeed.createMany({
    data: [
      {
        type: "node",
        title: "New compute node online — Helsinki",
        description: "We deployed pve-fi-hel-02 with AMD EPYC 9354, expanding capacity in the Nordic region.",
        severity: "info",
        pinned: true,
      },
      {
        type: "network",
        title: "10 Gbps uplink upgrade — Amsterdam",
        description: "AMS-IX peering capacity increased. Lower latency to EU-West workloads.",
        severity: "info",
      },
      {
        type: "ddos",
        title: "Anti-DDoS ruleset v4.2 deployed",
        description: "Improved mitigation for UDP amplification and L7 HTTP floods across all edge POPs.",
        severity: "success",
      },
      {
        type: "stock",
        title: "Dedicated E5 stock replenished — Frankfurt",
        description: "5× Dual E5-2690v4 systems available for instant deployment.",
        severity: "info",
      },
      {
        type: "maintenance",
        title: "Scheduled maintenance — AMS network core",
        description: "Brief packet loss possible 03:00–04:00 UTC. Redundant paths active.",
        severity: "warning",
      },
    ],
  });

  await prisma.invoice.create({
    data: {
      userId: demo.id,
      number: "INV-2505-00001",
      status: "PAID",
      subtotal: 24.99,
      tax: 0,
      total: 24.99,
      amountPaid: 24.99,
      paidAt: new Date(),
      items: {
        create: [{ description: "VPS prod-api-01 — Monthly", unitPrice: 24.99, quantity: 1, total: 24.99 }],
      },
    },
  });

  await prisma.promoCode.upsert({
    where: { code: "DIOR5" },
    update: { active: true },
    create: {
      code: "DIOR5",
      discountType: "fixed",
      discountValue: 5,
      maxUses: 1000,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: "WELCOME10" },
    update: { active: true },
    create: {
      code: "WELCOME10",
      discountType: "percent",
      discountValue: 10,
      maxUses: 500,
    },
  });

  console.log("Seed complete:", { admin: admin.email, demo: demo.email, tiers: tiers.length });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
