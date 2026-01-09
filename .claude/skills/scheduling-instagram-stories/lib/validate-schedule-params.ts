/**
 * Validation Utility for Blotato API Scheduling Parameters
 *
 * Validates all parameters before submitting to Blotato API to catch errors early
 * and provide clear error messages to users.
 *
 * @module validate-schedule-params
 */

export interface ScheduleParams {
  accountId: string;
  scheduledTime?: string;
  mediaUrls: string[];
  content: {
    text: string;
    platform: string;
  };
  target: {
    targetType: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Comprehensive validation of scheduling parameters
 *
 * @param params - Schedule parameters to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = await validateScheduleParams({
 *   accountId: 'acc_123',
 *   scheduledTime: '2024-01-15T03:30:00Z',
 *   mediaUrls: ['https://example.com/story.png'],
 *   content: { text: 'Freebie of the Day', platform: 'instagram' },
 *   target: { targetType: 'story' }
 * });
 *
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export async function validateScheduleParams(
  params: Partial<ScheduleParams>
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check required fields
  if (!params.accountId) {
    errors.push({
      field: 'accountId',
      message: 'Account ID is required',
      severity: 'error'
    });
  }

  if (!params.content) {
    errors.push({
      field: 'content',
      message: 'Content object is required',
      severity: 'error'
    });
  } else {
    if (!params.content.text) {
      errors.push({
        field: 'content.text',
        message: 'Content text is required',
        severity: 'error'
      });
    }

    if (!params.content.platform) {
      errors.push({
        field: 'content.platform',
        message: 'Platform is required',
        severity: 'error'
      });
    } else if (params.content.platform !== 'instagram') {
      warnings.push({
        field: 'content.platform',
        message: `Platform '${params.content.platform}' may not be supported for stories. Expected 'instagram'.`,
        severity: 'warning'
      });
    }
  }

  if (!params.target) {
    errors.push({
      field: 'target',
      message: 'Target object is required',
      severity: 'error'
    });
  } else if (!params.target.targetType) {
    errors.push({
      field: 'target.targetType',
      message: 'Target type is required',
      severity: 'error'
    });
  } else if (params.target.targetType !== 'story') {
    warnings.push({
      field: 'target.targetType',
      message: `Target type '${params.target.targetType}' may not be correct. Expected 'story'.`,
      severity: 'warning'
    });
  }

  if (!params.mediaUrls || params.mediaUrls.length === 0) {
    errors.push({
      field: 'mediaUrls',
      message: 'At least one media URL is required',
      severity: 'error'
    });
  }

  // Validate scheduled time if present
  if (params.scheduledTime) {
    const timeValidation = validateScheduledTime(params.scheduledTime);
    if (!timeValidation.valid) {
      errors.push(...timeValidation.errors);
    }
    warnings.push(...timeValidation.warnings);
  } else {
    warnings.push({
      field: 'scheduledTime',
      message: 'No scheduled time provided - post will be published immediately',
      severity: 'warning'
    });
  }

  // Validate media URLs
  if (params.mediaUrls && params.mediaUrls.length > 0) {
    for (let i = 0; i < params.mediaUrls.length; i++) {
      const urlValidation = await validateMediaUrl(params.mediaUrls[i]);
      if (!urlValidation.valid) {
        errors.push({
          field: `mediaUrls[${i}]`,
          message: urlValidation.error!,
          severity: 'error'
        });
      }
      warnings.push(...urlValidation.warnings.map(w => ({
        field: `mediaUrls[${i}]`,
        message: w,
        severity: 'warning' as const
      })));
    }
  }

  // Check API key configuration
  const apiKeyCheck = checkApiKeyConfiguration();
  if (!apiKeyCheck.valid) {
    errors.push({
      field: 'environment',
      message: apiKeyCheck.error!,
      severity: 'error'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate scheduled time format and value
 */
function validateScheduledTime(scheduledTime: string): {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check ISO 8601 format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!iso8601Regex.test(scheduledTime)) {
    errors.push({
      field: 'scheduledTime',
      message: 'Scheduled time must be in ISO 8601 UTC format (e.g., 2024-01-15T03:30:00Z)',
      severity: 'error'
    });
    return { valid: false, errors, warnings };
  }

  // Parse date
  const scheduledDate = new Date(scheduledTime);
  if (isNaN(scheduledDate.getTime())) {
    errors.push({
      field: 'scheduledTime',
      message: 'Scheduled time is not a valid date',
      severity: 'error'
    });
    return { valid: false, errors, warnings };
  }

  // Check if in future
  const now = new Date();
  if (scheduledDate <= now) {
    errors.push({
      field: 'scheduledTime',
      message: `Scheduled time must be in the future (got: ${scheduledTime}, now: ${now.toISOString()})`,
      severity: 'error'
    });
  }

  // Check if too far in future (warn if more than 1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (scheduledDate > oneYearFromNow) {
    warnings.push({
      field: 'scheduledTime',
      message: 'Scheduled time is more than 1 year in the future. Verify this is correct.',
      severity: 'warning'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate media URL accessibility and format
 */
async function validateMediaUrl(url: string): Promise<{
  valid: boolean;
  error?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];

  // Check URL format
  try {
    const parsedUrl = new URL(url);

    // Check HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return {
        valid: false,
        error: `Media URL must use HTTPS protocol (got: ${parsedUrl.protocol})`,
        warnings
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
      warnings
    };
  }

  // Check accessibility with HEAD request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        valid: false,
        error: `Media URL not accessible (HTTP ${response.status})`,
        warnings
      };
    }

    // Check Content-Type
    const contentType = response.headers.get('Content-Type');
    if (contentType && !contentType.startsWith('image/')) {
      return {
        valid: false,
        error: `Media URL must point to an image (got Content-Type: ${contentType})`,
        warnings
      };
    }

    // Check file size if available
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      if (sizeMB > 30) {
        warnings.push(`Media file is large (${sizeMB.toFixed(1)}MB). Instagram Story limit is 30MB.`);
      }
    }

    return { valid: true, warnings };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        valid: false,
        error: 'Media URL request timeout (5 seconds)',
        warnings
      };
    }

    return {
      valid: false,
      error: `Failed to access media URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warnings
    };
  }
}

/**
 * Check API key configuration in environment
 */
function checkApiKeyConfiguration(): { valid: boolean; error?: string } {
  const apiKey = process.env.BLOTATO_API_KEY;

  if (!apiKey) {
    return {
      valid: false,
      error: 'BLOTATO_API_KEY environment variable not set'
    };
  }

  if (apiKey.length < 10) {
    return {
      valid: false,
      error: `BLOTATO_API_KEY appears invalid (too short: ${apiKey.length} characters)`
    };
  }

  return { valid: true };
}

/**
 * Quick validation for status before scheduling
 * (Used in API routes to check item eligibility)
 */
export function validateItemStatus(status: string): {
  valid: boolean;
  error?: string;
} {
  if (status !== 'Ready') {
    return {
      valid: false,
      error: `Item status must be "Ready" to schedule (current: ${status})`
    };
  }

  return { valid: true };
}

/**
 * Format validation result for user display
 */
export function formatValidationResult(result: ValidationResult): string {
  const messages: string[] = [];

  if (result.errors.length > 0) {
    messages.push('Validation Errors:');
    result.errors.forEach(err => {
      messages.push(`  - ${err.field}: ${err.message}`);
    });
  }

  if (result.warnings.length > 0) {
    messages.push('Warnings:');
    result.warnings.forEach(warn => {
      messages.push(`  - ${warn.field}: ${warn.message}`);
    });
  }

  return messages.join('\n');
}
