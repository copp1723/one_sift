import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';

// XML Parser Configuration
const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: '$',
  textNodeName: '_',
  parseAttributeValue: false,
  parseTagValue: true,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
  allowBooleanAttributes: true,
  processEntities: true,
  htmlEntities: true,
  ignoreNameSpace: false,
  removeNSPrefix: false
};

export interface ParsedAdfLead {
  // Customer info
  customerName: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  
  // Vehicle info (if present)
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleTrim?: string;
  vehicleStock?: string;
  vehicleVin?: string;
  
  // Additional info
  comments?: string;
  vendorName?: string;
  providerName?: string;
  requestDate: Date;
  
  // Metadata
  deduplicationHash: string;
  rawXml: string;
}

export class AdfParser {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser(XML_PARSER_OPTIONS);
  }

  /**
   * Parse ADF XML and extract lead data
   */
  async parse(xmlContent: string): Promise<ParsedAdfLead | null> {
    try {
      // Validate XML content
      if (!xmlContent?.trim()) {
        throw new Error('Empty XML content provided');
      }

      // Parse XML
      const parsedXml = this.xmlParser.parse(xmlContent);
      
      // Basic validation - check structure exists
      if (!parsedXml?.adf?.prospect) {
        console.error('Invalid ADF structure: missing prospect element');
        return null;
      }

      const prospect = parsedXml.adf.prospect;
      
      // Extract lead data
      const lead = this.extractLeadData(prospect);
      
      // Add metadata
      lead.rawXml = xmlContent;
      lead.deduplicationHash = this.generateHash(lead);
      
      return lead;
    } catch (error) {
      console.error('ADF parsing error:', error);
      return null;
    }
  }

  /**
   * Extract lead data from prospect node
   */
  private extractLeadData(prospect: any): ParsedAdfLead {
    const lead: Partial<ParsedAdfLead> = {};

    // Extract request date
    lead.requestDate = this.parseDate(prospect.requestdate) || new Date();

    // Extract customer info
    if (prospect.customer?.contact) {
      const contact = prospect.customer.contact;
      
      // Name
      const nameInfo = this.extractName(contact.name);
      lead.customerName = nameInfo.fullName;
      lead.customerFirstName = nameInfo.firstName;
      lead.customerLastName = nameInfo.lastName;

      // Contact info
      lead.customerEmail = this.extractEmail(contact);
      lead.customerPhone = this.extractPhone(contact);

      // Address
      if (contact.address) {
        lead.customerAddress = contact.address.street || undefined;
        lead.customerCity = contact.address.city || undefined;
        lead.customerState = contact.address.regioncode || undefined;
        lead.customerZip = contact.address.postalcode || undefined;
      }
    }

    // Extract vehicle info
    if (prospect.vehicle) {
      const vehicle = prospect.vehicle;
      lead.vehicleYear = vehicle.year ? parseInt(vehicle.year, 10) : undefined;
      lead.vehicleMake = vehicle.make || undefined;
      lead.vehicleModel = vehicle.model || undefined;
      lead.vehicleTrim = vehicle.trim || undefined;
      lead.vehicleStock = vehicle.stock || undefined;
      lead.vehicleVin = vehicle.vin || undefined;
    }

    // Additional info
    lead.comments = prospect.comments || prospect.customer?.comments || undefined;
    lead.vendorName = prospect.vendor?.vendorname || undefined;
    lead.providerName = prospect.provider?.name || undefined;

    return lead as ParsedAdfLead;
  }

  /**
   * Extract name from various ADF formats
   */
  private extractName(nameData: any): { fullName: string; firstName?: string; lastName?: string } {
    if (!nameData) {
      return { fullName: 'Unknown' };
    }

    // Simple string
    if (typeof nameData === 'string') {
      const parts = nameData.trim().split(/\s+/);
      return {
        fullName: nameData.trim(),
        firstName: parts[0],
        lastName: parts.slice(1).join(' ') || undefined
      };
    }

    // Structured with parts
    let firstName = '';
    let lastName = '';

    // Handle <name part="first">John</name> format
    if (Array.isArray(nameData)) {
      nameData.forEach((part: any) => {
        if (part.$ && part._) {
          if (part.$.part === 'first') firstName = part._;
          if (part.$.part === 'last') lastName = part._;
        }
      });
    }

    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    return {
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined
    };
  }

  /**
   * Extract email from contact
   */
  private extractEmail(contact: any): string | undefined {
    if (!contact.email) return undefined;

    if (typeof contact.email === 'string') {
      return contact.email;
    }

    if (contact.email._) {
      return contact.email._;
    }

    return undefined;
  }

  /**
   * Extract phone from contact
   */
  private extractPhone(contact: any): string | undefined {
    if (!contact.phone) return undefined;

    // Simple string
    if (typeof contact.phone === 'string') {
      return contact.phone;
    }

    // Object with value
    if (contact.phone._) {
      return contact.phone._;
    }

    // Array of phones
    if (Array.isArray(contact.phone)) {
      // Prefer voice type or first available
      const voicePhone = contact.phone.find((p: any) => p.$?.type === 'voice');
      return voicePhone?._ || contact.phone[0]?._ || undefined;
    }

    return undefined;
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    // Try standard parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try MM/DD/YYYY format
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, month, day, year] = match;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }

    return null;
  }

  /**
   * Generate deduplication hash
   */
  private generateHash(lead: Partial<ParsedAdfLead>): string {
    const parts = [
      lead.requestDate?.toISOString().split('T')[0],
      lead.customerName?.toLowerCase(),
      lead.customerEmail?.toLowerCase(),
      lead.customerPhone?.replace(/\D/g, ''),
      lead.vendorName?.toLowerCase()
    ].filter(Boolean);

    return createHash('sha256').update(parts.join('|')).digest('hex');
  }
}
