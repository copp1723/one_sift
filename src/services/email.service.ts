import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { config } from '../config/index.js';
import { AdfParser } from './parsers/adf-parser.js';
import type { IngestLeadInput } from '../types/schemas.js';
import type { HandoffDossier } from '../types/database.js';

export class EmailService {
  private mailgun: any;
  private adfParser: AdfParser;

  constructor() {
    const mg = new (Mailgun as any)(FormData);
    this.mailgun = mg.client({
      username: 'api',
      key: config.MAILGUN_API_KEY,
      url: 'https://api.mailgun.net'
    });
    
    this.adfParser = new AdfParser();
  }

  /**
   * Send handoff email to customer
   */
  async sendHandoffEmail(
    customerEmail: string,
    customerName: string,
    dossier: HandoffDossier
  ): Promise<boolean> {
    try {
      const emailContent = this.generateHandoffEmail(customerName, dossier);
      
      const message = {
        from: `OneSift AI <noreply@${config.MAILGUN_DOMAIN}>`,
        to: customerEmail,
        subject: `Qualified Lead Ready: ${dossier.lead.customerName}`,
        html: emailContent.html,
        text: emailContent.text
      };

      await this.mailgun.messages.create(config.MAILGUN_DOMAIN, message);
      return true;
    } catch (error) {
      console.error('Failed to send handoff email:', error);
      return false;
    }
  }

  /**
   * Parse ADF from email content
   */
  async parseAdfFromEmail(emailBody: string, attachments?: any[]): Promise<IngestLeadInput | null> {
    try {
      // Try to find ADF XML in email body
      const adfMatch = emailBody.match(/<adf[^>]*>([\s\S]*?)<\/adf>/i);
      if (!adfMatch) {
        // Check attachments for ADF files
        if (attachments) {
          for (const attachment of attachments) {
            if (attachment.filename?.toLowerCase().includes('adf') || 
                attachment.contentType?.includes('xml')) {
              const adfContent = attachment.content?.toString();
              if (adfContent) {
                const parsedLead = await this.adfParser.parse(adfContent);
                if (parsedLead) {
                  return this.convertAdfToLeadInput(parsedLead);
                }
              }
            }
          }
        }
        return null;
      }

      // Parse using our ADF parser
      const parsedLead = await this.adfParser.parse(adfMatch[0]);
      if (!parsedLead) {
        return null;
      }

      return this.convertAdfToLeadInput(parsedLead);
    } catch (error) {
      console.error('Error parsing ADF from email:', error);
      return null;
    }
  }

  /**
   * Convert parsed ADF to IngestLeadInput format
   */
  private convertAdfToLeadInput(parsedLead: any): IngestLeadInput {
    return {
      source: 'adf_email',
      customerName: parsedLead.customerName,
      customerEmail: parsedLead.customerEmail,
      customerPhone: parsedLead.customerPhone,
      message: parsedLead.comments,
      metadata: {
        vehicleInterest: parsedLead.vehicleMake && parsedLead.vehicleModel
          ? `${parsedLead.vehicleYear || ''} ${parsedLead.vehicleMake} ${parsedLead.vehicleModel}`.trim()
          : undefined,
        vendor: parsedLead.vendorName,
        provider: parsedLead.providerName,
        address: {
          street: parsedLead.customerAddress,
          city: parsedLead.customerCity,
          state: parsedLead.customerState,
          zip: parsedLead.customerZip
        }
      },
      rawData: { 
        adf: parsedLead.rawXml,
        deduplicationHash: parsedLead.deduplicationHash
      }
    };
  }

  /**
   * Generate handoff email content
   */
  private generateHandoffEmail(_customerName: string, dossier: HandoffDossier): { html: string; text: string } {
    const lead = dossier.lead;
    const conversation = dossier.conversation;
    
    const text = `
Qualified Lead Ready: ${lead.customerName}

We have a promising lead ready for you to connect with now. Below are the details:

1. Lead Identification
   - Name: ${lead.customerName}
   - Contact Details: ${lead.customerEmail ? `Email - ${lead.customerEmail}` : ''}${lead.customerPhone ? ` | Phone - ${lead.customerPhone}` : ''}

2. Conversation Summary
   - Messages Exchanged: ${conversation.messages.length}
   - Sentiment: ${conversation.sentiment}
   - Key Points: ${conversation.keyPoints.join(', ')}

3. Summary
   ${conversation.summary}

4. Recommendations
   ${dossier.recommendations.join('\n   ')}

Best regards,
OneSift AI Assistant
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Qualified Lead Ready</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2>Qualified Lead Ready: ${lead.customerName}</h2>
    
    <p>We have a promising lead ready for you to connect with now. Below are the details:</p>
    
    <h3>1. Lead Identification</h3>
    <ul>
        <li><strong>Name:</strong> ${lead.customerName}</li>
        <li><strong>Contact Details:</strong> ${lead.customerEmail ? `Email - ${lead.customerEmail}` : ''}${lead.customerPhone ? ` | Phone - ${lead.customerPhone}` : ''}</li>
    </ul>
    
    <h3>2. Conversation Summary</h3>
    <ul>
        <li><strong>Messages Exchanged:</strong> ${conversation.messages.length}</li>
        <li><strong>Sentiment:</strong> ${conversation.sentiment}</li>
        <li><strong>Key Points:</strong> ${conversation.keyPoints.join(', ')}</li>
    </ul>
    
    <h3>3. Summary</h3>
    <p>${conversation.summary}</p>
    
    <h3>4. Recommendations</h3>
    <ul>
        ${dossier.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    
    <p><strong>Best regards,</strong><br>OneSift AI Assistant</p>
</body>
</html>
    `.trim();

    return { html, text };
  }

  /**
   * Verify Mailgun webhook signature
   */
  verifyWebhookSignature(timestamp: string, token: string, signature: string): boolean {
    const crypto = require('crypto');
    const value = timestamp + token;
    const hash = crypto
      .createHmac('sha256', config.MAILGUN_WEBHOOK_SIGNING_KEY)
      .update(value)
      .digest('hex');
    
    return hash === signature;
  }
}
