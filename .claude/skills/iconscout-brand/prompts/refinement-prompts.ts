/**
 * Refinement Prompt Templates
 *
 * Provides iterative refinement patterns for improving generated backgrounds.
 * Use when initial generation doesn't meet requirements.
 *
 * @module refinement-prompts
 */

/**
 * Generic refinement template structure
 */
export interface RefinementParams {
  /** What worked well in previous generation */
  keep: string[];
  /** What needs to change */
  change: string[];
  /** Additional constraints or emphasis */
  emphasize?: string[];
}

/**
 * Build a refinement prompt from structured feedback
 *
 * @param params - Refinement parameters
 * @returns Formatted refinement prompt
 */
export function buildRefinementPrompt(params: RefinementParams): string {
  const { keep, change, emphasize = [] } = params;

  let prompt = 'The previous background needs adjustments. Please regenerate with the following modifications:\n\n';

  if (keep.length > 0) {
    prompt += 'KEEP:\n';
    keep.forEach(item => {
      prompt += `- ${item}\n`;
    });
    prompt += '\n';
  }

  prompt += 'CHANGE:\n';
  change.forEach(item => {
    prompt += `- ${item}\n`;
  });
  prompt += '\n';

  if (emphasize.length > 0) {
    prompt += 'EMPHASIZE:\n';
    emphasize.forEach(item => {
      prompt += `- ${item}\n`;
    });
    prompt += '\n';
  }

  prompt += 'MAINTAIN:\n';
  prompt += '- 1080x1920px resolution\n';
  prompt += '- IconScout brand aesthetic\n';
  prompt += '- Clean center area for asset overlay\n';
  prompt += '- No text, logos, or assets drawn';

  return prompt;
}

/**
 * Refinement: Simplify Complexity
 *
 * Use when background is too busy or has too many elements
 */
export function simplifyComplexityPrompt(specificIssue?: string): string {
  const issue = specificIssue || 'too many competing visual elements';

  return buildRefinementPrompt({
    keep: ['Overall color palette', 'General composition direction'],
    change: [
      `The background is currently ${issue}`,
      'Reduce the number of shapes and patterns by 50%',
      'Use broader gradient strokes instead of many small shapes',
      'Focus visual complexity on the edges/corners only',
      'Keep the center 50% much simpler and cleaner'
    ],
    emphasize: [
      'Simplicity and restraint',
      'Smooth gradients over complex patterns',
      'Clean, uncluttered center area'
    ]
  });
}

/**
 * Refinement: Adjust Color Harmony
 *
 * Use when colors clash with asset or don't harmonize
 */
export interface ColorAdjustmentParams {
  issue: 'too-similar' | 'too-contrasting' | 'wrong-tone';
  assetColors: string[];
  desiredDirection?: string;
}

export function adjustColorHarmonyPrompt(params: ColorAdjustmentParams): string {
  const { issue, assetColors, desiredDirection } = params;

  const issueMap = {
    'too-similar': {
      change: [
        'Background colors are too similar to the asset colors',
        `Asset uses ${assetColors.join(', ')} - avoid these exact colors`,
        'Use complementary colors instead (opposite on color wheel)',
        'Increase color differentiation by at least 30%'
      ],
      emphasize: ['Color contrast with asset', 'Complementary color relationships']
    },
    'too-contrasting': {
      change: [
        'Background colors clash with the asset',
        'Reduce saturation by 20-30%',
        'Use analogous colors (adjacent on color wheel) for harmony',
        'Soften color transitions for smoother blend'
      ],
      emphasize: ['Harmonious color palette', 'Subtle color relationships']
    },
    'wrong-tone': {
      change: [
        'Background tone does not match content mood',
        desiredDirection || 'Adjust to more appropriate color temperature',
        'Ensure colors support rather than compete with asset',
        'Reconsider color psychology for this context'
      ],
      emphasize: ['Appropriate mood and tone', 'Color-emotion alignment']
    }
  };

  const { change, emphasize } = issueMap[issue];

  return buildRefinementPrompt({
    keep: ['Overall composition structure', 'Shape arrangement'],
    change,
    emphasize
  });
}

/**
 * Refinement: Improve Center Area
 *
 * Use when center area is too dark, too light, or unsuitable for overlay
 */
export interface CenterAreaParams {
  issue: 'too-dark' | 'too-light' | 'too-busy' | 'insufficient-contrast';
  assetBrightness?: 'light' | 'dark' | 'mixed';
}

export function improveCenterAreaPrompt(params: CenterAreaParams): string {
  const { issue, assetBrightness = 'mixed' } = params;

  const issueMap = {
    'too-dark': {
      change: [
        'Center area is too dark for proper asset visibility',
        'Lighten the center 70% to medium tones (40-60% brightness)',
        'Create subtle gradient from darker edges to lighter center',
        'Ensure asset will have sufficient contrast when overlaid'
      ],
      emphasize: ['Medium-toned center area', 'Visibility for asset overlay']
    },
    'too-light': {
      change: [
        'Center area is too light, reducing visual impact',
        'Add more color depth to the center 70%',
        'Use medium tones (40-60% brightness) instead of very light tones',
        'Create gentle gradient with more visual interest'
      ],
      emphasize: ['Balanced brightness in center', 'Visual depth']
    },
    'too-busy': {
      change: [
        'Center area has too many visual elements competing with future asset',
        'Simplify center 70% dramatically - remove most shapes and patterns',
        'Use smooth gradient or solid tone in center',
        'Move visual complexity to edges and corners only'
      ],
      emphasize: ['Clean center for asset placement', 'Minimal center composition']
    },
    'insufficient-contrast': {
      change: [
        `Asset will be ${assetBrightness} and needs better contrast`,
        'Adjust center area brightness to complement asset',
        assetBrightness === 'light'
          ? 'Make center area medium to dark tones'
          : 'Make center area medium to light tones',
        'Ensure clear visual separation between background and future asset'
      ],
      emphasize: ['Contrast for asset visibility', 'Strategic brightness levels']
    }
  };

  const { change, emphasize } = issueMap[issue];

  return buildRefinementPrompt({
    keep: ['Color palette', 'Overall style direction'],
    change,
    emphasize
  });
}

/**
 * Refinement: Increase Brand Alignment
 *
 * Use when background is technically correct but doesn't feel "IconScout"
 */
export interface BrandAlignmentParams {
  currentStyle?: string;
  missingQuality: 'modern' | 'vibrant' | 'professional' | 'clean' | 'creative';
}

export function increaseBrandAlignmentPrompt(params: BrandAlignmentParams): string {
  const { currentStyle, missingQuality } = params;

  const qualityMap = {
    modern: [
      'Update design language to feel more contemporary',
      'Use clean geometric shapes with intentional placement',
      'Implement smooth, sophisticated gradients',
      'Remove any dated or overly decorative elements'
    ],
    vibrant: [
      'Increase color saturation by 15-20%',
      'Use bolder, more energetic color combinations',
      'Add dynamic visual flow through color transitions',
      'Create more visual energy while maintaining balance'
    ],
    professional: [
      'Refine composition for more polished appearance',
      'Use more restrained, sophisticated color palette',
      'Ensure precise, intentional placement of all elements',
      'Balance creativity with professional polish'
    ],
    clean: [
      'Simplify composition - remove unnecessary elements',
      'Increase white space and breathing room',
      'Use cleaner, more deliberate shapes',
      'Create sense of spaciousness and clarity'
    ],
    creative: [
      'Add more innovative visual elements',
      'Experiment with unique shape combinations',
      'Use unexpected but harmonious color pairings',
      'Balance creativity with IconScout brand standards'
    ]
  };

  const specificChanges = qualityMap[missingQuality];
  const styleNote = currentStyle ? `Current style is ${currentStyle}. ` : '';

  return buildRefinementPrompt({
    keep: ['Resolution and safe zones', 'Core composition idea'],
    change: [
      `${styleNote}Background needs to feel more ${missingQuality}`,
      ...specificChanges,
      'Align more closely with IconScout brand aesthetic',
      'Reference: Modern, clean, vibrant yet professional'
    ],
    emphasize: [
      `${missingQuality.charAt(0).toUpperCase() + missingQuality.slice(1)} quality`,
      'IconScout brand aesthetic'
    ]
  });
}

/**
 * Refinement: Fix AI Drawing Asset
 *
 * Use when AI mistakenly drew the asset, logo, or text
 */
export interface AvoidAssetParams {
  whatWasDrawn: string;
  assetDescription?: string;
}

export function avoidDrawingAssetPrompt(params: AvoidAssetParams): string {
  const { whatWasDrawn, assetDescription } = params;

  const assetNote = assetDescription
    ? ` The asset (${assetDescription}) will be added later as a separate overlay.`
    : ' The asset will be added later as a separate overlay.';

  return buildRefinementPrompt({
    keep: [],
    change: [
      `CRITICAL: The previous background incorrectly included ${whatWasDrawn}`,
      'Generate ONLY an abstract background - no objects, icons, logos, or text',
      'Use gradients, shapes, and patterns ONLY',
      'Do not represent or suggest the asset in any way',
      `Remove all traces of ${whatWasDrawn} from the design`
    ],
    emphasize: [
      'Pure abstract background only',
      'No representational elements',
      'Background supports but does not contain the asset' + assetNote
    ]
  });
}

/**
 * Refinement: Adjust Energy Level
 *
 * Use when background energy doesn't match content mood
 */
export interface EnergyLevelParams {
  currentEnergy: 'too-calm' | 'too-energetic';
  desiredEnergy: 'calm' | 'moderate' | 'energetic';
  reason?: string;
}

export function adjustEnergyLevelPrompt(params: EnergyLevelParams): string {
  const { currentEnergy, desiredEnergy, reason } = params;

  const adjustmentMap = {
    'too-calm': {
      calm: [], // No change needed
      moderate: [
        'Add more dynamic elements - flowing shapes or gradient movement',
        'Increase color vibrancy by 10-15%',
        'Introduce subtle motion through diagonal lines or curves',
        'Create more visual flow between elements'
      ],
      energetic: [
        'Significantly increase visual dynamism',
        'Use bold, sweeping shapes with strong directionality',
        'Increase color saturation and contrast by 20-30%',
        'Add energetic diagonal elements and flowing curves',
        'Create strong sense of movement and vitality'
      ]
    },
    'too-energetic': {
      calm: [
        'Dramatically reduce visual complexity',
        'Use gentler, more muted color palette',
        'Replace dynamic shapes with soft, flowing forms',
        'Slow down visual rhythm - create sense of tranquility',
        'Remove sharp angles and high-contrast elements'
      ],
      moderate: [
        'Reduce visual energy by 30-40%',
        'Soften color transitions and reduce saturation',
        'Replace bold shapes with more subtle forms',
        'Create more balanced, harmonious composition',
        'Maintain interest while reducing intensity'
      ],
      energetic: [] // No change needed
    }
  };

  const changes = adjustmentMap[currentEnergy][desiredEnergy];

  if (changes.length === 0) {
    throw new Error(
      `No adjustment needed - current energy (${currentEnergy}) already matches desired energy (${desiredEnergy})`
    );
  }

  const reasonNote = reason ? ` ${reason}` : '';

  return buildRefinementPrompt({
    keep: ['Resolution and safe zones', 'General color family'],
    change: [
      `Background energy is currently ${currentEnergy.replace('too-', '')}, but needs to be ${desiredEnergy}.${reasonNote}`,
      ...changes
    ],
    emphasize: [`${desiredEnergy.charAt(0).toUpperCase() + desiredEnergy.slice(1)} energy level`]
  });
}

/**
 * Multi-issue refinement
 *
 * Combines multiple refinement needs into single prompt
 */
export function multiIssueRefinementPrompt(issues: {
  complexity?: string;
  color?: ColorAdjustmentParams;
  centerArea?: CenterAreaParams;
  brand?: BrandAlignmentParams;
  energy?: EnergyLevelParams;
}): string {
  const allChanges: string[] = [];
  const allEmphases: string[] = [];
  const keep = ['Overall composition concept', 'Resolution (1080x1920px)'];

  // Collect changes from each issue
  if (issues.complexity) {
    allChanges.push(
      'Simplify visual complexity - reduce element count by 40-50%',
      'Focus detail on edges, simplify center area'
    );
    allEmphases.push('Simplicity and clarity');
  }

  if (issues.color) {
    const colorIssue = issues.color.issue;
    allChanges.push(
      `Adjust color harmony - current issue: ${colorIssue}`,
      colorIssue === 'too-similar'
        ? 'Use complementary colors to asset'
        : 'Reduce saturation for better harmony'
    );
    allEmphases.push('Harmonious color palette');
  }

  if (issues.centerArea) {
    allChanges.push(
      `Improve center area - current issue: ${issues.centerArea.issue}`,
      'Optimize center 70% for asset overlay visibility'
    );
    allEmphases.push('Clean, suitable center for asset');
  }

  if (issues.brand) {
    allChanges.push(
      `Strengthen ${issues.brand.missingQuality} quality`,
      'Align more closely with IconScout brand aesthetic'
    );
    allEmphases.push('IconScout brand consistency');
  }

  if (issues.energy) {
    allChanges.push(
      `Adjust energy level from ${issues.energy.currentEnergy} to ${issues.energy.desiredEnergy}`,
      'Match visual energy to content mood'
    );
    allEmphases.push('Appropriate energy level');
  }

  return buildRefinementPrompt({
    keep,
    change: allChanges,
    emphasize: allEmphases
  });
}
