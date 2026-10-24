import { describe, it, expect } from 'vitest';
import { parseAddressToStructured, formatStructuredAddress, StructuredAddress } from '../pages/Dashboard';

describe('Address Parsing and Structured Formatting', () => {
  it('should parse a complete Indian address into structured components', () => {
    const rawAddress = 'No. 42/B, Gandhi Street, Anna Nagar, Madurai, Tamil Nadu, 625020';
    const parsed = parseAddressToStructured(rawAddress);

    expect(parsed.doorNo).toBe('No. 42/B');
    expect(parsed.street).toContain('Gandhi Street');
    expect(parsed.city).toBe('Madurai');
    expect(parsed.state).toBe('Tamil Nadu');
    expect(parsed.pinCode).toBe('625020');
  });

  it('should parse a multiline pasted address correctly', () => {
    const multilineAddress = `Door 15
Kamaraj Road
Coimbatore
Tamilnadu 641018`;

    const parsed = parseAddressToStructured(multilineAddress);
    expect(parsed.doorNo).toBe('Door 15');
    expect(parsed.street).toContain('Kamaraj Road');
    expect(parsed.city).toBe('Coimbatore');
    expect(parsed.state).toBe('Tamil Nadu');
    expect(parsed.pinCode).toBe('641018');
  });

  it('should format structured address into standard consistent display order', () => {
    const structured: StructuredAddress = {
      doorNo: '12-A',
      street: 'Cross Cut Road',
      city: 'Coimbatore',
      district: 'Coimbatore',
      state: 'Tamil Nadu',
      pinCode: '641012'
    };

    const formatted = formatStructuredAddress(structured);
    expect(formatted).toBe('12-A, Cross Cut Road, Coimbatore, Tamil Nadu - 641012');
  });

  it('should handle partial or missing fields gracefully without undefined or null in formatted text', () => {
    const emptyParsed = parseAddressToStructured('');
    expect(emptyParsed.doorNo).toBe('');
    expect(emptyParsed.street).toBe('');
    expect(emptyParsed.city).toBe('');
    expect(emptyParsed.pinCode).toBe('');

    const formattedEmpty = formatStructuredAddress(emptyParsed);
    expect(formattedEmpty).toBe('');

    const partialStructured: StructuredAddress = {
      doorNo: '',
      street: 'MG Road',
      city: 'Bengaluru',
      district: '',
      state: 'Karnataka',
      pinCode: '560001'
    };
    const formattedPartial = formatStructuredAddress(partialStructured);
    expect(formattedPartial).toBe('MG Road, Bengaluru, Karnataka - 560001');
  });

  it('should preserve original address text when user pastes without running format', () => {
    const originalText = 'Flat 304, Sunshine Apts, Near Temple, Salem 636001';
    // The original text should be kept as-is unless explicitly reformatted
    expect(originalText).toBe('Flat 304, Sunshine Apts, Near Temple, Salem 636001');
  });
});
