import { AdfParser } from '../../../src/services/parsers/adf-parser.js';

describe('AdfParser', () => {
  let parser: AdfParser;

  beforeEach(() => {
    parser = new AdfParser();
  });

  describe('parse', () => {
    it('should parse valid ADF XML correctly', async () => {
      const validAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>2024-06-03T10:30:00Z</requestdate>
            <vehicle>
              <year>2023</year>
              <make>Toyota</make>
              <model>Camry</model>
              <trim>XLE</trim>
              <stock>ABC123</stock>
              <vin>1HGBH41JXMN109186</vin>
            </vehicle>
            <customer>
              <contact>
                <name part="first">John</name>
                <name part="last">Doe</name>
                <email>john.doe@example.com</email>
                <phone type="voice">555-1234</phone>
                <address>
                  <street>123 Main St</street>
                  <city>Anytown</city>
                  <regioncode>CA</regioncode>
                  <postalcode>12345</postalcode>
                </address>
              </contact>
            </customer>
            <vendor>
              <vendorname>ABC Motors</vendorname>
            </vendor>
            <provider>
              <name>Cars.com</name>
            </provider>
            <comments>Interested in financing options</comments>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(validAdf);

      expect(result).toBeDefined();
      expect(result?.customerName).toBe('John Doe');
      expect(result?.customerFirstName).toBe('John');
      expect(result?.customerLastName).toBe('Doe');
      expect(result?.customerEmail).toBe('john.doe@example.com');
      expect(result?.customerPhone).toBe('555-1234');
      expect(result?.vehicleYear).toBe(2023);
      expect(result?.vehicleMake).toBe('Toyota');
      expect(result?.vehicleModel).toBe('Camry');
      expect(result?.vehicleTrim).toBe('XLE');
      expect(result?.vehicleStock).toBe('ABC123');
      expect(result?.vehicleVin).toBe('1HGBH41JXMN109186');
      expect(result?.vendorName).toBe('ABC Motors');
      expect(result?.providerName).toBe('Cars.com');
      expect(result?.comments).toBe('Interested in financing options');
      expect(result?.customerAddress).toBe('123 Main St');
      expect(result?.customerCity).toBe('Anytown');
      expect(result?.customerState).toBe('CA');
      expect(result?.customerZip).toBe('12345');
      expect(result?.deduplicationHash).toBeDefined();
      expect(result?.rawXml).toBe(validAdf);
    });

    it('should handle simple name format', async () => {
      const simpleNameAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>2024-06-03T10:30:00Z</requestdate>
            <customer>
              <contact>
                <name>Jane Smith</name>
                <email>jane@example.com</email>
              </contact>
            </customer>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(simpleNameAdf);

      expect(result).toBeDefined();
      expect(result?.customerName).toBe('Jane Smith');
      expect(result?.customerFirstName).toBe('Jane');
      expect(result?.customerLastName).toBe('Smith');
      expect(result?.customerEmail).toBe('jane@example.com');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>2024-06-03T10:30:00Z</requestdate>
            <customer>
              <contact>
                <name>Test User</name>
              </contact>
            </customer>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(minimalAdf);

      expect(result).toBeDefined();
      expect(result?.customerName).toBe('Test User');
      expect(result?.customerEmail).toBeUndefined();
      expect(result?.customerPhone).toBeUndefined();
      expect(result?.vehicleYear).toBeUndefined();
      expect(result?.deduplicationHash).toBeDefined();
    });

    it('should handle array of phone numbers', async () => {
      const multiPhoneAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>2024-06-03T10:30:00Z</requestdate>
            <customer>
              <contact>
                <name>Phone User</name>
                <phone type="voice">555-1111</phone>
                <phone type="fax">555-2222</phone>
              </contact>
            </customer>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(multiPhoneAdf);

      expect(result).toBeDefined();
      expect(result?.customerPhone).toBe('555-1111'); // Should prefer voice type
    });

    it('should return null for empty XML', async () => {
      const result = await parser.parse('');
      expect(result).toBeNull();
    });

    it('should return null for invalid XML structure', async () => {
      const invalidAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <invalid>
          <notprospect>test</notprospect>
        </invalid>
      `;

      const result = await parser.parse(invalidAdf);
      expect(result).toBeNull();
    });

    it('should handle malformed XML gracefully', async () => {
      const malformedAdf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <customer>
              <name>Broken XML
            </customer>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(malformedAdf);
      expect(result).toBeNull();
    });

    it('should generate consistent deduplication hash', async () => {
      const adf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>2024-06-03T10:30:00Z</requestdate>
            <customer>
              <contact>
                <name>Hash Test</name>
                <email>hash@test.com</email>
                <phone>555-0000</phone>
              </contact>
            </customer>
            <vendor>
              <vendorname>Test Vendor</vendorname>
            </vendor>
          </prospect>
        </adf>
      `;

      const result1 = await parser.parse(adf);
      const result2 = await parser.parse(adf);

      expect(result1?.deduplicationHash).toBe(result2?.deduplicationHash);
      expect(result1?.deduplicationHash).toBeDefined();
      expect(result1?.deduplicationHash.length).toBe(64); // SHA-256 hex length
    });

    it('should parse date correctly', async () => {
      const adf = `
        <?xml version="1.0" encoding="UTF-8"?>
        <adf>
          <prospect>
            <requestdate>06/03/2024</requestdate>
            <customer>
              <contact>
                <name>Date Test</name>
              </contact>
            </customer>
          </prospect>
        </adf>
      `;

      const result = await parser.parse(adf);

      expect(result).toBeDefined();
      expect(result?.requestDate).toBeInstanceOf(Date);
      expect(result?.requestDate.getFullYear()).toBe(2024);
      expect(result?.requestDate.getMonth()).toBe(5); // June (0-indexed)
      expect(result?.requestDate.getDate()).toBe(3);
    });
  });
});
