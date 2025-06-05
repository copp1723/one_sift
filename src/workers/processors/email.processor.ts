/**
 * Email Job Processor
 * Handles email sending jobs
 */

import { Job } from 'bullmq';
import { sendHandoffEmail } from '../../services/email.service.js';
import { createLogger } from '../../utils/logger.js';
import { ExternalServiceError } from '../../utils/errors.js';

const logger = createLogger('email-processor');

export interface EmailJobData {
  type: 'handoff' | 'notification' | 'welcome';
  customerId: string;
  to: string;
  subject?: string;
  data: Record<string, any>;
}

export async function processEmailJob(job: Job<EmailJobData>) {
  const { type, customerId, to, data } = job.data;
  
  logger.info(`Processing ${type} email`, {
    jobId: job.id,
    customerId,
    to
  });

  try {
    switch (type) {
      case 'handoff':
        const success = await sendHandoffEmail(
          data.leadId,
          data.customerName,
          data.leadName,
          data.leadPhone,
          data.conversation,
          data.handoffReason
        );
        
        if (!success) {
          throw new ExternalServiceError('Mailgun', 'Failed to send handoff email');
        }
        
        return { success: true, emailType: type };
      
      case 'notification':
      case 'welcome':
        // Implement other email types as needed
        logger.warn(`Email type ${type} not yet implemented`);
        return { success: false, reason: 'Not implemented' };
      
      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  } catch (error) {
    logger.error(`Failed to process ${type} email`, {
      jobId: job.id,
      customerId,
      error
    });
    throw error;
  }
}