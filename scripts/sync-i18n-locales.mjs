import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../apps/web/src/lib/i18n/locales");

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function listKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...listKeys(value, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function missingKeys(source, target) {
  return listKeys(source).filter((key) => {
    const parts = key.split(".");
    let cur = target;
    for (const part of parts) {
      if (!cur || typeof cur !== "object" || !(part in cur)) return true;
      cur = cur[part];
    }
    return false;
  });
}

const esPatch = {
  controlNav: { settings: "Ajustes" },
  controlStatistics: {
    title: "Estadísticas",
    description: "Cifras clave de facturación, crecimiento y soporte",
    kpi: {
      revenue30: "Ingresos · 30 días",
      revenue7Hint: "{amount} en los últimos 7 días",
      netCredited30: "Neto acreditado · 30 días",
      paidTopUpsHint: "{count} recargas pagadas",
      newUsers30: "Usuarios nuevos · 30 días",
      newUsersWeekHint: "{count} esta semana",
      newServices30: "Servicios nuevos · 30 días",
      activeServicesHint: "{count} activos",
    },
    comparison: {
      title: "Comparación por período",
      description: "Métricas principales por rango de tiempo",
      metric: "Métrica",
      period24h: "Últimas 24 horas",
      period7d: "Últimos 7 días",
      period30d: "Últimos 30 días",
      periodAll: "Todo el tiempo",
      period24hShort: "24h",
      period7dShort: "7d",
      period30dShort: "30d",
      periodAllShort: "Todo",
      topUps: "Recargas",
      topUpsPaid: "pagadas",
      grossVolume: "Volumen bruto",
      netCredited: "Neto acreditado",
      newUsers: "Usuarios nuevos",
      newServices: "Servicios nuevos",
      invoicesPaid: "Facturas pagadas",
      invoiceVolume: "Volumen de facturas",
      tickets: "Tickets",
      ticketsOpened: "abiertos",
    },
    attention: {
      title: "Requiere atención",
      description: "Últimos 30 días — clic para abrir",
      empty: "Nada requiere atención en los últimos 30 días.",
      manualReview: "Revisión manual",
      pendingTopUps: "Recargas pendientes",
      failedPayments: "Pagos fallidos",
      ticketsOpened: "Tickets abiertos",
      view: "Ver →",
    },
    allTime: {
      title: "Resumen histórico",
      description: "Recargas y crecimiento de la plataforma desde el inicio",
      totalTopUps: "Total de recargas",
      grossVolume: "Volumen bruto",
      usersRegistered: "Usuarios registrados",
      servicesCreated: "Servicios creados",
    },
    updated: "Actualizado {date}",
  },
  controlLogs: {
    title: "Registros",
    description: "Historial de acciones del panel de control",
    recentEvents: "Eventos recientes",
  },
  dashboard: {
    noServicesHint: "Aún no hay servicios — elige un plan abajo para empezar",
    myServices: "Mis servicios",
    myServicesDesc: "Infraestructura activa en tu cuenta",
    addService: "Añadir servicio",
    addServiceDesc: "Elige una línea de producto y configura tu plan",
    browseAllPlans: "Ver todos los planes",
    catalogBulletproof: "Bulletproof",
    catalogStandard: "Estándar",
    catalogConfigure: "Configurar",
    colName: "Nombre",
    tags: {
      instantDeploy: "Despliegue instantáneo",
      offshore: "Offshore",
      bareMetal: "Bare metal",
      abuseReview: "Revisión de abuso",
      registration: "Registro",
      dns: "DNS",
      kvm: "KVM",
      multiRegion: "Multi-región",
      sla: "SLA 99.9%",
      ddosReady: "Anti-DDoS",
      hiCpu: "Hi-CPU",
      nvme: "NVMe",
    },
  },
  domains: {
    exactAvailableTitle: "{domain} está disponible",
    exactAvailableDesc: "Este dominio está libre — puedes registrarlo ahora.",
    exactTakenTitle: "{domain} no está disponible",
    exactTakenDesc: "Esta extensión ya está registrada. Revisa otros TLD abajo.",
    registerNow: "Comprar",
    otherExtensions: "Otras extensiones",
    registerSuccessTitle: "Dominio registrado",
    registerSuccessDesc: "{domain} ya está en tu cuenta.",
    registerFailed: "Error al registrar",
    insufficientBalance:
      "Necesitas {required} en tu saldo (disponible: {available}). Recarga primero.",
    addFunds: "Añadir fondos",
    balanceHint:
      "Saldo disponible: {balance}. El registro de dominios se cobra al instante desde facturación.",
    findTitle: "Encuentra tu dominio",
    findDesc: "Introduce un nombre con o sin extensión",
    searchPlaceholder: "Introduce un dominio, p. ej. mybrand.com",
    search: "Buscar",
    searching: "Buscando…",
    searchHint:
      "Escribe mybrand para comprobar extensiones populares, o mybrand.io para un TLD concreto.",
    available: "Disponible",
    taken: "Ocupado",
    yearRegistration: "Registro de 1 año",
    premium: "premium",
    notInCatalog: "no en catálogo",
    resultsFor: "Resultados para {name}",
    availableExtensions: "{count} extensión(es) disponible(s) en nuestro catálogo",
    noAvailableExtensions: "No hay extensiones disponibles en nuestro catálogo",
    allExtensions: "Todas las extensiones admitidas",
    annualPricing: "Precio anual por TLD",
    invalidDomain: "Introduce un dominio válido — solo letras, números y guiones.",
    noExtensions: "No se encontraron extensiones admitidas para este nombre.",
    checkFailed: "No se pudo comprobar la disponibilidad",
  },
  auth: {
    or: "o",
    referralInvite:
      "Llegaste desde un enlace de referido — tu referidor se vinculará automáticamente",
    referralCodeOptional: "Código de referido (opcional)",
    emailRequired: "Introduce tu dirección de email",
    emailInvalid: "Introduce un email válido con dominio real (p. ej. name@company.com)",
    passwordTooWeak:
      "Elige una contraseña más fuerte — mínimo 8 caracteres con mayúsculas, minúsculas y un número",
    passwordStrengthTitle: "Fortaleza de la contraseña",
    passwordStrength: {
      weak: "Débil",
      fair: "Regular",
      good: "Buena",
      strong: "Fuerte",
    },
    passwordRule: {
      length: "Al menos 8 caracteres",
      lower: "Letra minúscula",
      upper: "Letra mayúscula",
      number: "Número",
      special: "Carácter especial (recomendado)",
    },
  },
  billing: {
    invoiceDetail: {
      paid: "Pagado",
      due: "Vence",
      subtotal: "Subtotal",
      tax: "Impuesto",
      total: "Total",
      balanceDue: "Saldo pendiente",
      notes: "Notas",
      paidOn: "Pagado el {date}",
      payAmount: "Pagar {amount}",
    },
  },
};

const zhPatch = {
  controlNav: { settings: "设置" },
  controlStatistics: {
    title: "统计",
    description: "账单、增长与支持的关键数据",
    kpi: {
      revenue30: "收入 · 30 天",
      revenue7Hint: "近 7 天 {amount}",
      netCredited30: "净入账 · 30 天",
      paidTopUpsHint: "{count} 笔已支付充值",
      newUsers30: "新用户 · 30 天",
      newUsersWeekHint: "本周 {count}",
      newServices30: "新服务 · 30 天",
      activeServicesHint: "{count} 个活跃",
    },
    comparison: {
      title: "周期对比",
      description: "各时间范围的核心指标",
      metric: "指标",
      period24h: "最近 24 小时",
      period7d: "最近 7 天",
      period30d: "最近 30 天",
      periodAll: "全部时间",
      period24hShort: "24h",
      period7dShort: "7d",
      period30dShort: "30d",
      periodAllShort: "全部",
      topUps: "充值",
      topUpsPaid: "已支付",
      grossVolume: "总交易额",
      netCredited: "净入账",
      newUsers: "新用户",
      newServices: "新服务",
      invoicesPaid: "已付发票",
      invoiceVolume: "发票金额",
      tickets: "工单",
      ticketsOpened: "已打开",
    },
    attention: {
      title: "需要关注",
      description: "最近 30 天 — 点击打开",
      empty: "最近 30 天无需处理的事项。",
      manualReview: "人工审核",
      pendingTopUps: "待处理充值",
      failedPayments: "失败付款",
      ticketsOpened: "新开工单",
      view: "查看 →",
    },
    allTime: {
      title: "历史概览",
      description: "自上线以来的充值与平台增长",
      totalTopUps: "充值总数",
      grossVolume: "总交易额",
      usersRegistered: "注册用户",
      servicesCreated: "创建的服务",
    },
    updated: "更新于 {date}",
  },
  controlLogs: {
    title: "日志",
    description: "控制面板操作历史",
    recentEvents: "最近事件",
  },
  dashboard: {
    noServicesHint: "暂无服务 — 请在下方选择套餐开始",
    myServices: "我的服务",
    myServicesDesc: "您账户上的活跃基础设施",
    addService: "添加服务",
    addServiceDesc: "选择产品线并配置套餐",
    browseAllPlans: "浏览全部套餐",
    catalogBulletproof: "Bulletproof",
    catalogStandard: "标准",
    catalogConfigure: "配置",
    colName: "名称",
    tags: {
      instantDeploy: "即时部署",
      offshore: "离岸",
      bareMetal: "裸金属",
      abuseReview: "Abuse 审核",
      registration: "注册",
      dns: "DNS",
      kvm: "KVM",
      multiRegion: "多区域",
      sla: "99.9% SLA",
      ddosReady: "DDoS 防护",
      hiCpu: "高主频",
      nvme: "NVMe",
    },
  },
  auth: {
    or: "或",
    referralInvite: "您通过推荐链接访问 — 推荐人将自动关联",
    referralCodeOptional: "推荐码（可选）",
    emailRequired: "请输入邮箱地址",
    emailInvalid: "请输入有效邮箱及真实域名（例如 name@company.com）",
    passwordTooWeak: "请使用更强密码 — 至少 8 位，含大小写字母和数字",
    passwordStrengthTitle: "密码强度",
    passwordStrength: {
      weak: "弱",
      fair: "一般",
      good: "良好",
      strong: "强",
    },
    passwordRule: {
      length: "至少 8 个字符",
      lower: "小写字母",
      upper: "大写字母",
      number: "数字",
      special: "特殊字符（推荐）",
    },
  },
  billing: {
    invoiceDetail: {
      paid: "已支付",
      due: "到期",
      subtotal: "小计",
      tax: "税费",
      total: "合计",
      balanceDue: "待付余额",
      notes: "备注",
      paidOn: "已于 {date} 支付",
      payAmount: "支付 {amount}",
    },
  },
};

const enPatch = {
  dashboard: {
    tags: {
      instantDeploy: "Instant deploy",
      offshore: "Offshore",
      bareMetal: "Bare metal",
      abuseReview: "Abuse review",
      registration: "Registration",
      dns: "DNS",
      kvm: "KVM",
      multiRegion: "Multi-region",
      sla: "99.9% SLA",
      ddosReady: "DDoS ready",
      hiCpu: "Hi-CPU",
      nvme: "NVMe",
    },
  },
  billing: {
    invoiceDetail: {
      paid: "Paid",
      due: "Due",
      subtotal: "Subtotal",
      tax: "Tax",
      total: "Total",
      balanceDue: "Balance due",
      notes: "Notes",
      paidOn: "Paid on {date}",
      payAmount: "Pay {amount}",
    },
  },
};

const ruPatch = {
  dashboard: {
    tags: {
      instantDeploy: "Мгновенная выдача",
      offshore: "Офшор",
      bareMetal: "Bare metal",
      abuseReview: "Abuse review",
      registration: "Регистрация",
      dns: "DNS",
      kvm: "KVM",
      multiRegion: "Мультирегион",
      sla: "SLA 99.9%",
      ddosReady: "DDoS ready",
      hiCpu: "Hi-CPU",
      nvme: "NVMe",
    },
  },
  billing: {
    invoiceDetail: {
      paid: "Оплачено",
      due: "Срок",
      subtotal: "Подытог",
      tax: "Налог",
      total: "Итого",
      balanceDue: "К оплате",
      notes: "Примечания",
      paidOn: "Оплачен {date}",
      payAmount: "Оплатить {amount}",
    },
  },
};

const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
const ru = JSON.parse(fs.readFileSync(path.join(localesDir, "ru.json"), "utf8"));
const es = JSON.parse(fs.readFileSync(path.join(localesDir, "es.json"), "utf8"));
const zh = JSON.parse(fs.readFileSync(path.join(localesDir, "zh.json"), "utf8"));

deepMerge(en, enPatch);
deepMerge(ru, ruPatch);
deepMerge(es, esPatch);
deepMerge(zh, zhPatch);

for (const [name, data] of [
  ["en", en],
  ["ru", ru],
  ["es", es],
  ["zh", zh],
]) {
  const missing = missingKeys(en, data);
  if (missing.length) {
    console.error(`${name} still missing ${missing.length} keys:`);
    console.error(missing.join("\n"));
    process.exit(1);
  }
}

fs.writeFileSync(path.join(localesDir, "en.json"), `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(path.join(localesDir, "ru.json"), `${JSON.stringify(ru, null, 2)}\n`);
fs.writeFileSync(path.join(localesDir, "es.json"), `${JSON.stringify(es, null, 2)}\n`);
fs.writeFileSync(path.join(localesDir, "zh.json"), `${JSON.stringify(zh, null, 2)}\n`);

console.log("Locales synced — all keys present in en, ru, es, zh.");
