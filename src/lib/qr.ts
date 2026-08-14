export interface QRParseResult {
  isValid: boolean;
  locationId: string | null;
  rawText: string;
}

/**
 * Parses scanned QR text.
 * Expected format: WAREHOUSE_LOCATION:<location_id> (e.g. WAREHOUSE_LOCATION:K1-B02)
 */
export const parseQRPayload = (text: string): QRParseResult => {
  const cleanText = text.trim();
  const PREFIX = 'WAREHOUSE_LOCATION:';

  if (cleanText.startsWith(PREFIX)) {
    const locationId = cleanText.substring(PREFIX.length).trim();
    return {
      isValid: true,
      locationId,
      rawText: cleanText
    };
  }

  // Fallback: If it's a warehouse location ID pattern directly (e.g. K1-B02 or K4-D1)
  const directPattern = /^[kK]\d-[a-zA-Z0-9]+$/;
  if (directPattern.test(cleanText)) {
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
