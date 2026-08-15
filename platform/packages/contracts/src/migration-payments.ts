import {
  normalizeLegacyHeader,
  type LegacyMigrationSnapshot,
  type LegacySheetSnapshot,
} from "./migration";

export type LegacyPaymentCategory =
  "PENDING" | "SETTLED" | "CANCELLED" | "EXEMPT" | "UNKNOWN";

export type LegacyPaymentIssueCode =
  | "MISSING_PAYMENT_HEADER"
  | "MISSING_PAYMENT_BATCH_ID"
  | "INVALID_PAYMENT_AMOUNT"
  | "UNKNOWN_PAYMENT_STATUS"
  | "EXEMPT_PAYMENT_REQUIRES_MAPPING";

export type LegacyPaymentIssue = {
  code: LegacyPaymentIssueCode;
  field: string;
  count: number;
};

export type LegacyPaymentPreflightReport = {
  ok: boolean;
  rows: number;
  categories: Record<LegacyPaymentCategory, number>;
  issues: LegacyPaymentIssue[];
  ignoredSensitiveFields: readonly string[];
};

type PaymentField = {
  field: string;
  aliases: readonly string[];
};

const paymentFields = {
  status: {
    field: "STATUS_PAGAMENTO",
    aliases: [
      "Status_Pagamento",
      "status_pagamento",
      "Status Pagamento",
      "pagamento_status",
    ],
  },
  batchId: {
    field: "ID_LOTE_PAGAMENTO",
    aliases: ["id_lote_pagamento"],
  },
  batchName: {
    field: "NOME_LOTE_PAGAMENTO",
    aliases: ["nome_lote_pagamento"],
  },
  amount: {
    field: "VALOR_UNITARIO_PAGAMENTO",
    aliases: ["valor_unitario_pagamento"],
  },
} as const satisfies Record<string, PaymentField>;

export const ignoredLegacyPaymentFields = [
  "chave_pix_lote",
  "validade_pix_lote",
] as const;

const settledStatuses = new Set([
  "APROVADO",
  "APROVADA",
  "PAGO",
  "PAGA",
  "QUITADO",
  "QUITADA",
  "CONFIRMADO",
  "CONFIRMADA",
  "CONCLUIDO",
  "CONCLUIDA",
]);

const cancelledStatuses = new Set(["CANCELADO", "CANCELADA"]);
const exemptStatuses = new Set(["ISENTO", "ISENTA"]);
const pendingStatuses = new Set([
  "",
  "PENDENTE",
  "AGUARDANDOPAGAMENTO",
  "NAOPAGO",
  "NAOPAGA",
]);

function normalizeLegacyStatus(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function classifyLegacyPaymentStatus(
  value: string,
): LegacyPaymentCategory {
  const normalized = normalizeLegacyStatus(value.trim());
  if (pendingStatuses.has(normalized)) return "PENDING";
  if (settledStatuses.has(normalized)) return "SETTLED";
  if (cancelledStatuses.has(normalized)) return "CANCELLED";
  if (exemptStatuses.has(normalized)) return "EXEMPT";
  return "UNKNOWN";
}

function findFieldIndex(
  sheet: LegacySheetSnapshot,
  field: PaymentField,
): number {
  const normalizedHeaders = sheet.headers.map(normalizeLegacyHeader);
  return (
    field.aliases
      .map(normalizeLegacyHeader)
      .map((alias) => normalizedHeaders.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

function emptyCategories(): Record<LegacyPaymentCategory, number> {
  return {
    PENDING: 0,
    SETTLED: 0,
    CANCELLED: 0,
    EXEMPT: 0,
    UNKNOWN: 0,
  };
}

function isValidLegacyAmount(value: string): boolean {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return false;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateLegacyPaymentSnapshot(
  snapshot: LegacyMigrationSnapshot,
): LegacyPaymentPreflightReport {
  const sheet = snapshot.dgmbDesafios;
  const categories = emptyCategories();
  const issues: LegacyPaymentIssue[] = [];

  if (!sheet) {
    return {
      ok: false,
      rows: 0,
      categories,
      issues: [
        {
          code: "MISSING_PAYMENT_HEADER",
          field: "dgmbDesafios",
          count: 1,
        },
      ],
      ignoredSensitiveFields: ignoredLegacyPaymentFields,
    };
  }

  const indexes = {
    status: findFieldIndex(sheet, paymentFields.status),
    batchId: findFieldIndex(sheet, paymentFields.batchId),
    batchName: findFieldIndex(sheet, paymentFields.batchName),
    amount: findFieldIndex(sheet, paymentFields.amount),
  };

  for (const [key, index] of Object.entries(indexes)) {
    if (index >= 0) continue;
    const field = paymentFields[key as keyof typeof paymentFields];
    issues.push({
      code: "MISSING_PAYMENT_HEADER",
      field: field.field,
      count: 1,
    });
  }

  if (indexes.status >= 0) {
    for (const row of sheet.rows) {
      const category = classifyLegacyPaymentStatus(row[indexes.status] ?? "");
      categories[category] += 1;
    }
    if (categories.UNKNOWN > 0) {
      issues.push({
        code: "UNKNOWN_PAYMENT_STATUS",
        field: paymentFields.status.field,
        count: categories.UNKNOWN,
      });
    }
    if (categories.EXEMPT > 0) {
      issues.push({
        code: "EXEMPT_PAYMENT_REQUIRES_MAPPING",
        field: paymentFields.status.field,
        count: categories.EXEMPT,
      });
    }
  }

  if (indexes.batchId >= 0) {
    const missingBatchIds = sheet.rows.filter(
      (row) => !(row[indexes.batchId] ?? "").trim(),
    ).length;
    if (missingBatchIds > 0) {
      issues.push({
        code: "MISSING_PAYMENT_BATCH_ID",
        field: paymentFields.batchId.field,
        count: missingBatchIds,
      });
    }
  }

  if (indexes.amount >= 0) {
    const invalidAmounts = sheet.rows.filter(
      (row) => !isValidLegacyAmount(row[indexes.amount] ?? ""),
    ).length;
    if (invalidAmounts > 0) {
      issues.push({
        code: "INVALID_PAYMENT_AMOUNT",
        field: paymentFields.amount.field,
        count: invalidAmounts,
      });
    }
  }

  return {
    ok: issues.length === 0,
    rows: sheet.rows.length,
    categories,
    issues,
    ignoredSensitiveFields: ignoredLegacyPaymentFields,
  };
}
