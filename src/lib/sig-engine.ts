export type SigCategory = "frequency" | "timing" | "administration" | "duration" | "custom";

export type SigDefinition = {
  code: string;
  canonicalMeaning: string;
  description: string;
  category: SigCategory;
  aliases: string[];
  routeRestrictions: string[];
  dosageFormRestrictions: string[];
  ambiguous?: boolean;
  approvalStatus: "draft" | "active" | "pending" | "deprecated" | "disabled";
  priority?: number;
};

export type MedicationContext = {
  name: string;
  strength: string;
  dosageForm: "tablet" | "capsule" | "liquid" | "drop" | "inhaler" | "cream" | "sachet" | "patch" | "suppository" | "other";
  route: "oral" | "topical" | "intramuscular" | "intravenous" | "subcutaneous" | "ophthalmic" | "otic" | "nasal" | "rectal" | "vaginal" | "inhalation" | "sublingual" | "buccal" | "other";
  defaultUnit?: string;
};

export type SigParseResult = {
  original: string;
  normalized: string;
  dose: { value: number; unit: string } | null;
  route: string | null;
  frequency: { code: string; label: string; type: string; value: number | null } | null;
  duration: { value: number; unit: string } | null;
  timing: string | null;
  additionalInstructions: string[];
  instructions: string;
  quantity: {
    isFixed: boolean;
    value: number | null;
    unit: string;
    status: "valid" | "manual-review" | "missing-duration" | "warning";
    reason?: string;
  };
  validation: {
    status: "valid" | "warning" | "error" | "requires_clarification";
    message: string;
    requiresVerification: boolean;
  };
  warnings: string[];
  ambiguousTerms: string[];
};

export const SIG_DEFINITIONS: SigDefinition[] = [
  { code: "OD", canonicalMeaning: "Once daily", description: "Once daily, only in explicitly configured unambiguous contexts.", category: "frequency", aliases: ["OD"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], ambiguous: true, approvalStatus: "pending", priority: 40 },
  { code: "BD", canonicalMeaning: "Twice daily", description: "Twice daily.", category: "frequency", aliases: ["BID", "BD"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 90 },
  { code: "BID", canonicalMeaning: "Twice daily", description: "Twice daily.", category: "frequency", aliases: ["BD", "BID"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 90 },
  { code: "TDS", canonicalMeaning: "Three times daily", description: "Three times daily.", category: "frequency", aliases: ["TDS", "TID"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 95 },
  { code: "TID", canonicalMeaning: "Three times daily", description: "Three times daily.", category: "frequency", aliases: ["TDS", "TID"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 95 },
  { code: "QID", canonicalMeaning: "Four times daily", description: "Four times daily.", category: "frequency", aliases: ["QID"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 85 },
  { code: "Q6H", canonicalMeaning: "Every 6 hours", description: "Every 6 hours.", category: "frequency", aliases: ["Q6H"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 80 },
  { code: "Q8H", canonicalMeaning: "Every 8 hours", description: "Every 8 hours.", category: "frequency", aliases: ["Q8H"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 80 },
  { code: "HS", canonicalMeaning: "At bedtime", description: "At bedtime.", category: "frequency", aliases: ["HS"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 75 },
  { code: "STAT", canonicalMeaning: "Immediately", description: "Immediately.", category: "frequency", aliases: ["STAT"], routeRestrictions: ["oral", "intramuscular", "intravenous", "subcutaneous"], dosageFormRestrictions: ["tablet", "capsule", "liquid", "drop"], approvalStatus: "active", priority: 70 },
  { code: "PRN", canonicalMeaning: "As needed", description: "As needed; requires indication and limits.", category: "frequency", aliases: ["PRN"], routeRestrictions: ["oral", "topical", "nasal", "ophthalmic", "otic"], dosageFormRestrictions: ["tablet", "capsule", "liquid", "drop", "cream"], approvalStatus: "active", priority: 82 },
  { code: "PO", canonicalMeaning: "By mouth", description: "By mouth.", category: "administration", aliases: ["PO"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 88 },
  { code: "IM", canonicalMeaning: "Intramuscular", description: "Intramuscular administration.", category: "administration", aliases: ["IM"], routeRestrictions: ["intramuscular"], dosageFormRestrictions: ["liquid", "other"], approvalStatus: "active", priority: 88 },
  { code: "IV", canonicalMeaning: "Intravenous", description: "Intravenous administration.", category: "administration", aliases: ["IV"], routeRestrictions: ["intravenous"], dosageFormRestrictions: ["liquid", "other"], approvalStatus: "active", priority: 88 },
  { code: "SC", canonicalMeaning: "Subcutaneous", description: "Subcutaneous administration.", category: "administration", aliases: ["SC"], routeRestrictions: ["subcutaneous"], dosageFormRestrictions: ["liquid", "other"], approvalStatus: "active", priority: 84 },
  { code: "SL", canonicalMeaning: "Sublingual", description: "Sublingual administration.", category: "administration", aliases: ["SL"], routeRestrictions: ["sublingual"], dosageFormRestrictions: ["tablet", "capsule"], approvalStatus: "active", priority: 84 },
  { code: "AC", canonicalMeaning: "Before meals", description: "Before meals.", category: "timing", aliases: ["AC"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 60 },
  { code: "PC", canonicalMeaning: "After meals", description: "After meals.", category: "timing", aliases: ["PC"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid"], approvalStatus: "active", priority: 60 },
  { code: "X 5/7", canonicalMeaning: "For five days", description: "For five days.", category: "duration", aliases: ["X 5/7"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid", "drop"], approvalStatus: "active", priority: 65 },
  { code: "X 7/7", canonicalMeaning: "For seven days", description: "For seven days.", category: "duration", aliases: ["X 7/7"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid", "drop"], approvalStatus: "active", priority: 65 },
  { code: "X 14/7", canonicalMeaning: "For fourteen days", description: "For fourteen days.", category: "duration", aliases: ["X 14/7"], routeRestrictions: ["oral"], dosageFormRestrictions: ["tablet", "capsule", "liquid", "drop"], approvalStatus: "active", priority: 65 }
];

const frequencyMap: Record<string, { code: string; label: string; type: string; value: number | null }> = {
  OD: { code: "OD", label: "Once daily", type: "times_per_day", value: 1 },
  BD: { code: "BD", label: "Twice daily", type: "times_per_day", value: 2 },
  BID: { code: "BID", label: "Twice daily", type: "times_per_day", value: 2 },
  TDS: { code: "TDS", label: "Three times daily", type: "times_per_day", value: 3 },
  TID: { code: "TID", label: "Three times daily", type: "times_per_day", value: 3 },
  QID: { code: "QID", label: "Four times daily", type: "times_per_day", value: 4 },
  Q6H: { code: "Q6H", label: "Every 6 hours", type: "every_n_hours", value: 6 },
  Q8H: { code: "Q8H", label: "Every 8 hours", type: "every_n_hours", value: 8 },
  HS: { code: "HS", label: "At bedtime", type: "timing", value: null },
  STAT: { code: "STAT", label: "Immediately", type: "stat", value: 1 },
  PRN: { code: "PRN", label: "As needed", type: "prn", value: null }
};

const durationMap: Record<string, number> = {
  "5/7": 5,
  "7/7": 7,
  "14/7": 14,
  "21/7": 21,
  "30/7": 30,
  "X 5/7": 5,
  "X 7/7": 7,
  "X 14/7": 14,
  "X 21/7": 21,
  "X 30/7": 30
};

export function normalizeSigInput(input: string): string {
  return input
    .trim()
    .replace(/[×]/g, "X")
    .replace(/\s+/g, " ")
    .replace(/\s*X\s*/g, " X ")
    .toUpperCase();
}

export function searchSigDefinitions(query: string, medication?: Partial<MedicationContext>): SigDefinition[] {
  const normalizedQuery = normalizeSigInput(query || "").trim();
  const items = SIG_DEFINITIONS.filter((definition) => {
    const matchesText = !normalizedQuery || definition.code.startsWith(normalizedQuery) || definition.aliases.some((alias) => alias.toUpperCase().startsWith(normalizedQuery)) || definition.canonicalMeaning.toLowerCase().includes(normalizedQuery.toLowerCase());
    const matchesForm = !medication?.dosageForm || definition.dosageFormRestrictions.length === 0 || definition.dosageFormRestrictions.includes(medication.dosageForm);
    const matchesRoute = !medication?.route || definition.routeRestrictions.length === 0 || definition.routeRestrictions.includes(medication.route);
    return matchesText && matchesForm && matchesRoute;
  });

  return items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).slice(0, 6);
}

function parseNumericToken(token: string): number | null {
  const cleaned = token.trim().replace(/[^0-9./]/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("/")) {
    const [numerator, denominator] = cleaned.split("/");
    const left = Number(numerator);
    const right = Number(denominator);
    if (Number.isFinite(left) && Number.isFinite(right) && right !== 0) return left / right;
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatDoseValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = Number(value.toFixed(2));
  return fixed % 1 === 0 ? String(fixed) : fixed.toString();
}

export function parseSigInput(rawInput: string, medication: MedicationContext): SigParseResult {
  const original = rawInput.trim();
  const normalized = normalizeSigInput(original);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let dose: { value: number; unit: string } | null = null;
  let route: string | null = medication.route ?? null;
  let timing: string | null = null;
  let duration: { value: number; unit: string } | null = null;
  let additionalInstructions: string[] = [];
  let warnings: string[] = [];
  let ambiguousTerms: string[] = [];

  const firstToken = tokens[0] ?? "";
  const firstIsDose = parseNumericToken(firstToken) !== null && !/^[A-Z]+$/.test(firstToken);
  if (firstIsDose) {
    dose = { value: parseNumericToken(firstToken) ?? 0, unit: medication.defaultUnit ?? "tablet" };
  }

  if (firstToken.endsWith("ML") || firstToken.endsWith("L")) {
    const liquidValue = parseNumericToken(firstToken.replace(/ML|L/g, ""));
    if (liquidValue !== null) {
      dose = { value: liquidValue, unit: firstToken.endsWith("ML") ? "mL" : "L" };
    }
  }

  const codeTokens = tokens.filter((token) => token.length >= 2 && /^[A-Z0-9/]+$/.test(token));
  const frequencyCode = codeTokens.find((token) => token in frequencyMap) ?? null;
  const frequency = frequencyCode ? frequencyMap[frequencyCode] : null;

  if (frequencyCode === "OD") {
    ambiguousTerms.push("OD");
    warnings.push("OD is ambiguous and requires configured context before finalizing.");
  }

  const routeToken = codeTokens.find((token) => ["PO", "IM", "IV", "SC", "SL", "AC", "PC"].includes(token));
  if (routeToken === "PO") route = "oral";
  if (routeToken === "IM") route = "intramuscular";
  if (routeToken === "IV") route = "intravenous";
  if (routeToken === "SC") route = "subcutaneous";
  if (routeToken === "SL") route = "sublingual";
  if (routeToken === "AC") timing = "Before meals";
  if (routeToken === "PC") timing = "After meals";

  const xIndex = tokens.findIndex((token) => token === "X");
  if (xIndex >= 0 && tokens[xIndex + 1]) {
    const durationValue = parseNumericToken(tokens[xIndex + 1]);
    if (durationValue !== null) {
      duration = { value: durationValue, unit: "days" };
    }
  }

  const explicitDashTokens = tokens.filter((token) => token.includes("/") && token.includes("7") || token.includes("5") || token.includes("14") || token.includes("21") || token.includes("30"));
  const explicitDuration = explicitDashTokens.find((token) => durationMap[token.toUpperCase()] !== undefined);
  if (explicitDuration) {
    duration = { value: durationMap[explicitDuration.toUpperCase()], unit: "days" };
  }

  if (!frequency) {
    warnings.push("No supported dosing frequency was recognized in the supplied SIG.");
  }

  const unitFromToken = tokens.find((token) => ["TABLET", "TABLETS", "CAPSULE", "CAPSULES", "ML", "DROP", "DROPS", "PUFF", "PUFFS", "PATCH", "SACHET"].includes(token));
  if (unitFromToken && dose) {
    dose.unit = unitFromToken.toLowerCase().replace(/S$/, "") === "tablet" ? "tablet" : unitFromToken.toLowerCase().replace(/S$/, "");
  }

  if (dose && medication.defaultUnit && dose.unit === "tablet" && medication.defaultUnit) {
    dose.unit = medication.defaultUnit;
  }

  const finalRoute = route && medication.dosageForm === "drop" && route !== "ophthalmic" ? "ophthalmic" : route;
  const quantityValue = frequency && duration && dose ? dose.value * (frequency.value ?? 0) * duration.value : null;

  const quantity = (() => {
    if (!dose || !frequency) {
      return {
        isFixed: false,
        value: null,
        unit: dose?.unit ?? medication.defaultUnit ?? "dose",
        status: "warning" as const,
        reason: "Dose and frequency are required before quantity can be estimated."
      };
    }

    if (frequency.type === "prn") {
      return {
        isFixed: false,
        value: null,
        unit: dose.unit,
        status: "manual-review" as const,
        reason: "PRN instructions require indication-specific limits and pharmacist review."
      };
    }

    if (!duration) {
      return {
        isFixed: false,
        value: null,
        unit: dose.unit,
        status: "missing-duration" as const,
        reason: "Duration has not been specified."
      };
    }

    return {
      isFixed: true,
      value: quantityValue,
      unit: dose.unit,
      status: "valid" as const
    };
  })();

  const routeLabel = finalRoute === "oral" ? "by mouth" : finalRoute === "topical" ? "topically" : finalRoute === "intramuscular" ? "intramuscularly" : finalRoute === "intravenous" ? "intravenously" : finalRoute === "subcutaneous" ? "subcutaneously" : finalRoute === "ophthalmic" ? "into the eye" : finalRoute === "otic" ? "into the ear" : finalRoute === "nasal" ? "into the nose" : finalRoute === "rectal" ? "rectally" : finalRoute === "vaginal" ? "vaginally" : finalRoute === "inhalation" ? "by inhalation" : finalRoute === "sublingual" ? "under the tongue" : finalRoute === "buccal" ? "between the cheek and gum" : "as directed";

  const canonicalFrequency = frequency?.label ?? "custom schedule";
  const durationText = duration ? ` for ${duration.value} ${duration.unit}` : "";
  const doseText = dose ? `${formatDoseValue(dose.value)} ${dose.unit}` : "1 dose";
  const timingText = timing ? ` ${timing.toLowerCase()}` : "";
  const instructions = `Take ${doseText} ${routeLabel} ${canonicalFrequency.toLowerCase()}${durationText}.`;

  const validationStatus = (() => {
    if (ambiguousTerms.length > 0) {
      return {
        status: "requires_clarification" as const,
        message: "Ambiguous terminology detected. Confirm the approved meaning before finalizing the prescription.",
        requiresVerification: true
      };
    }

    if (frequency === null || dose === null) {
      return {
        status: "error" as const,
        message: "The SIG does not contain a valid dose or frequency.",
        requiresVerification: true
      };
    }

    if (warnings.length > 0) {
      return {
        status: "warning" as const,
        message: warnings[0],
        requiresVerification: true
      };
    }

    return {
      status: "valid" as const,
      message: "Structured SIG is valid and ready for pharmacist verification.",
      requiresVerification: true
    };
  })();

  return {
    original,
    normalized,
    dose,
    route: finalRoute,
    frequency,
    duration,
    timing,
    additionalInstructions,
    instructions,
    quantity,
    validation: validationStatus,
    warnings,
    ambiguousTerms
  };
}

export function buildSigPreview(input: string, medication: MedicationContext): SigParseResult {
  return parseSigInput(input, medication);
}

export function calculateQuantityFromParts({
  doseValue,
  doseUnit,
  frequencyValue,
  durationValue
}: {
  doseValue: number;
  doseUnit: string;
  frequencyValue: number | null;
  durationValue: number | null;
}) {
  if (frequencyValue === null || durationValue === null) {
    return {
      isFixed: false,
      value: null,
      unit: doseUnit,
      status: "missing-duration" as const,
      reason: "Duration is required for fixed-schedule quantity calculation."
    };
  }

  return {
    isFixed: true,
    value: doseValue * frequencyValue * durationValue,
    unit: doseUnit,
    status: "valid" as const
  };
}

export const SIG_TEMPLATE_LIBRARY = [
  {
    name: "Standard Adult BD",
    description: "Take 1 tablet by mouth twice daily.",
    structuredInstructions: { dose: 1, unit: "tablet", route: "oral", frequency: "BD", duration: "5 days" }
  },
  {
    name: "Standard Oral TDS",
    description: "Take 1 tablet by mouth three times daily.",
    structuredInstructions: { dose: 1, unit: "tablet", route: "oral", frequency: "TDS", duration: "5 days" }
  },
  {
    name: "Oral Suspension TDS",
    description: "Take 5 mL by mouth three times daily.",
    structuredInstructions: { dose: 5, unit: "mL", route: "oral", frequency: "TDS", duration: "5 days" }
  }
];
