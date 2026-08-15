// ==============================================================================
// QR Code Parser & Resolver for UUID Warehouse Locations
// ==============================================================================

export interface QRParseResult {
  isValid: boolean;
  locationId: string | null;
  rawText: string;
}

/**
 * Parses scanned QR text.
 * Expected format: WAREHOUSE_LOCATION:<UUID> (e.g. WAREHOUSE_LOCATION:c1111111-1111-1111-1111-000000000a01)
 * Fallbacks: Raw UUID, or legacy code formats.
 */
export const parseQRPayload = (text: string): QRParseResult => {
  const cleanText = text.trim();
  const PREFIX = 'WAREHOUSE_LOCATION:';

  if (cleanText.startsWith(PREFIX)) {
    const locationId = cleanText.substring(PREFIX.length).trim();
    return {
      isValid: Boolean(locationId),
      locationId,
      rawText: cleanText
    };
  }

  // UUID Format detection
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(cleanText)) {
    return {
      isValid: true,
      locationId: cleanText,
      rawText: cleanText
    };
  }

  // Legacy code pattern fallback (e.g. K1-B02)
  const legacyPattern = /^[kK]\d-[a-zA-Z0-9]+$/;
  if (legacyPattern.test(cleanText)) {
    return {
      isValid: true,
      locationId: cleanText.toUpperCase(),
      rawText: cleanText
    };
  }

  return {
    isValid: false,
    locationId: null,
    rawText: cleanText
  };
};
