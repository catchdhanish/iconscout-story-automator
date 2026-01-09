/**
 * System Prompt Templates for Background Generation
 *
 * Provides consistent system-level instructions for AI models generating
 * Instagram Story backgrounds following IconScout brand guidelines.
 *
 * @module system-prompts
 */

/**
 * Core system prompt for all background generation
 *
 * Use this as the base system prompt for any background generation task.
 * Enforces brand aesthetic and critical constraints.
 */
export const CORE_SYSTEM_PROMPT = `You are an expert background designer for Instagram Stories specializing in the IconScout brand aesthetic.

BRAND STYLE:
- Modern, clean, vibrant yet professional
- Abstract, gradient-based, or organic shapes
- Bold colors that complement (not compete with) the main asset
- Geometric patterns, smooth gradients, subtle textures

CRITICAL RULES:
- Generate ONLY the background - DO NOT draw the asset, logo, or text
- Respect Instagram Story safe zones: top 250px and bottom 180px should avoid critical visual elements
- The center 70% of the canvas (756x1344 pixels out of 1080x1920) is reserved for the asset overlay
- Design the background to enhance, not compete with, the asset that will be placed on top
- Output resolution: 1080x1920 pixels (9:16 aspect ratio)

VISUAL APPROACH:
- Use abstract shapes and gradients rather than literal objects
- Create depth with layered shapes or gradient transitions
- Balance vibrant colors with clean, uncluttered composition
- Ensure the center area has visual interest but remains suitable for overlay`;

/**
 * Extended system prompt with color context
 *
 * Use when asset color analysis is available. Append to CORE_SYSTEM_PROMPT.
 *
 * @param dominantColors - Array of hex color codes from asset
 * @returns Extended system prompt with color strategy
 */
export function getColorContextPrompt(dominantColors: string[]): string {
  const colorList = dominantColors.join(', ');

  return `

ASSET COLOR CONTEXT:
The asset that will be overlaid has the following dominant colors: ${colorList}

COLOR STRATEGY:
- Use complementary or analogous colors to create harmony
- Avoid using the exact same colors as the asset (creates visual confusion)
- Create subtle contrast to make the asset "pop" without jarring transitions
- Consider using one dominant color from the asset as an accent (10-20% of background)`;
}

/**
 * System prompt emphasizing simplicity
 *
 * Use when previous generations were too complex or busy.
 */
export const SIMPLIFIED_SYSTEM_PROMPT = `${CORE_SYSTEM_PROMPT}

ADDITIONAL EMPHASIS:
- SIMPLICITY IS KEY - fewer elements are better
- Use broad, sweeping gradients rather than many small shapes
- Limit geometric elements to 3-5 shapes maximum
- Keep 50% or more of the canvas in smooth gradients
- Avoid patterns that might distract from the asset overlay`;

/**
 * System prompt for high-contrast assets
 *
 * Use for black/white/grayscale assets that need vibrant backgrounds.
 */
export const HIGH_CONTRAST_SYSTEM_PROMPT = `${CORE_SYSTEM_PROMPT}

ASSET CONTEXT:
The asset is monochromatic (black, white, or grayscale) and will benefit from a vibrant, colorful background.

COLOR APPROACH:
- Use bold, saturated colors confidently
- Experiment with vibrant gradient combinations
- Create visual energy through color rather than complex shapes
- Ensure sufficient contrast between background and asset`;

/**
 * System prompt for colorful assets
 *
 * Use for assets with multiple colors that need harmonious backgrounds.
 */
export const COLORFUL_ASSET_SYSTEM_PROMPT = `${CORE_SYSTEM_PROMPT}

ASSET CONTEXT:
The asset is colorful with multiple distinct colors. The background must harmonize without competing.

COLOR APPROACH:
- Use subtle, muted tones to let the asset shine
- Choose ONE dominant color from the asset and build palette around it
- Reduce saturation by 20-30% compared to asset colors
- Create harmony through analogous or monochromatic palette`;

/**
 * System prompt for professional/corporate content
 *
 * Use for business-oriented or professional content.
 */
export const PROFESSIONAL_SYSTEM_PROMPT = `${CORE_SYSTEM_PROMPT}

AESTHETIC EMPHASIS:
- Prioritize clean, sophisticated design
- Use professional color combinations (blues, grays, subtle gradients)
- Minimize playful elements
- Focus on modern, polished aesthetic
- Geometric patterns should be precise and intentional`;

/**
 * System prompt for playful/creative content
 *
 * Use for fun, energetic, or creative content.
 */
export const PLAYFUL_SYSTEM_PROMPT = `${CORE_SYSTEM_PROMPT}

AESTHETIC EMPHASIS:
- Embrace vibrant, energetic color combinations
- Use organic, flowing shapes alongside geometric elements
- Create dynamic, lively compositions
- Balance playfulness with IconScout's professional standards
- Experiment with bold color transitions`;

/**
 * Complete system prompt builder
 *
 * Constructs a full system prompt based on context.
 *
 * @param options - Prompt configuration options
 * @returns Complete system prompt string
 */
export interface SystemPromptOptions {
  /** Dominant colors from asset (hex codes) */
  dominantColors?: string[];
  /** Asset colorfulness level */
  colorfulness?: 'low' | 'medium' | 'high';
  /** Content tone */
  tone?: 'professional' | 'playful' | 'neutral';
  /** Emphasize simplicity */
  emphasizeSimplicity?: boolean;
}

export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const {
    dominantColors,
    colorfulness = 'medium',
    tone = 'neutral',
    emphasizeSimplicity = false
  } = options;

  // Start with appropriate base prompt
  let systemPrompt: string;

  if (emphasizeSimplicity) {
    systemPrompt = SIMPLIFIED_SYSTEM_PROMPT;
  } else if (tone === 'professional') {
    systemPrompt = PROFESSIONAL_SYSTEM_PROMPT;
  } else if (tone === 'playful') {
    systemPrompt = PLAYFUL_SYSTEM_PROMPT;
  } else if (colorfulness === 'low') {
    systemPrompt = HIGH_CONTRAST_SYSTEM_PROMPT;
  } else if (colorfulness === 'high') {
    systemPrompt = COLORFUL_ASSET_SYSTEM_PROMPT;
  } else {
    systemPrompt = CORE_SYSTEM_PROMPT;
  }

  // Add color context if provided
  if (dominantColors && dominantColors.length > 0) {
    systemPrompt += getColorContextPrompt(dominantColors);
  }

  return systemPrompt;
}

/**
 * Validate system prompt length
 *
 * Ensures system prompt is within reasonable token limits.
 *
 * @param prompt - System prompt to validate
 * @returns Validation result
 */
export function validateSystemPrompt(prompt: string): {
  valid: boolean;
  characterCount: number;
  estimatedTokens: number;
  warnings: string[];
} {
  const characterCount = prompt.length;
  const estimatedTokens = Math.ceil(characterCount / 4); // Rough estimate
  const warnings: string[] = [];

  // Warn if prompt is too long (might hit token limits)
  if (estimatedTokens > 500) {
    warnings.push('System prompt exceeds 500 tokens - consider simplifying');
  }

  // Warn if prompt is very short (might lack necessary context)
  if (estimatedTokens < 100) {
    warnings.push('System prompt is very short - ensure all constraints are included');
  }

  return {
    valid: warnings.length === 0,
    characterCount,
    estimatedTokens,
    warnings
  };
}
