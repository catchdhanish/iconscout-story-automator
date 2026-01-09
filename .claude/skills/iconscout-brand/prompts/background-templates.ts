/**
 * User Prompt Templates for Background Generation
 *
 * Provides proven prompt patterns for generating Instagram Story backgrounds.
 * These templates have been tested and produce consistent, high-quality results.
 *
 * @module background-templates
 */

/**
 * Template 1: Abstract Gradient
 *
 * Best for: Clean, modern backgrounds with smooth color transitions
 * Works well with: Most asset types
 */
export interface AbstractGradientParams {
  color1: string;
  color2: string;
  color3?: string;
  direction?: 'horizontal' | 'vertical' | 'diagonal-left' | 'diagonal-right' | 'radial';
  assetType?: string;
}

export function abstractGradientTemplate(params: AbstractGradientParams): string {
  const { color1, color2, color3, direction = 'diagonal-right', assetType = 'icon' } = params;

  const directionMap = {
    'horizontal': 'from left to right',
    'vertical': 'from top to bottom',
    'diagonal-left': 'diagonally from bottom-right to top-left',
    'diagonal-right': 'diagonally from top-left to bottom-right',
    'radial': 'radially from center outward'
  };

  const colorPhrase = color3
    ? `${color1}, ${color2}, and ${color3}`
    : `${color1} and ${color2}`;

  return `Create an abstract gradient background with ${colorPhrase} flowing ${directionMap[direction]}. Use smooth color transitions and subtle geometric shapes in the corners. The center should have a gentle gradient suitable for overlaying a ${assetType} asset. 1080x1920px, modern and vibrant aesthetic.`;
}

/**
 * Template 2: Geometric Patterns
 *
 * Best for: Structured, professional backgrounds
 * Works well with: Icons, simple illustrations
 */
export interface GeometricPatternParams {
  colors: string[];
  shapes?: 'triangles' | 'circles' | 'squares' | 'mixed';
  density?: 'sparse' | 'moderate' | 'dense';
  assetType?: string;
}

export function geometricPatternTemplate(params: GeometricPatternParams): string {
  const { colors, shapes = 'mixed', density = 'moderate', assetType = 'icon' } = params;

  const colorPhrase = colors.join(', ');
  const densityMap = {
    'sparse': 'minimal and well-spaced',
    'moderate': 'moderately distributed',
    'dense': 'densely arranged but not overwhelming'
  };

  const shapePhrase = shapes === 'mixed'
    ? 'geometric shapes (triangles, circles, and small polygons)'
    : `${shapes}`;

  return `Design a minimalist background with subtle geometric patterns using ${colorPhrase}. Incorporate ${densityMap[density]} ${shapePhrase} arranged in a clean, non-distracting pattern. Keep the center 70% simpler to accommodate a ${assetType} overlay. 1080x1920px, professional yet playful.`;
}

/**
 * Template 3: Organic Shapes
 *
 * Best for: Dynamic, creative backgrounds
 * Works well with: Colorful assets, illustrations
 */
export interface OrganicShapesParams {
  colors: string[];
  shapeCount?: number;
  energy?: 'calm' | 'moderate' | 'dynamic';
  assetType?: string;
}

export function organicShapesTemplate(params: OrganicShapesParams): string {
  const { colors, shapeCount = 3, energy = 'moderate', assetType = 'illustration' } = params;

  const colorPhrase = colors.join(', ');
  const energyMap = {
    'calm': 'gentle, flowing forms with soft edges',
    'moderate': 'smooth, flowing forms',
    'dynamic': 'bold, energetic shapes with sweeping curves'
  };

  return `Generate a vibrant background with ${shapeCount} organic blob shapes in ${colorPhrase}. Use ${energyMap[energy]} that create visual interest without overwhelming. Position larger shapes near the edges, keeping the center area cleaner for asset placement. 1080x1920px, modern and dynamic.`;
}

/**
 * Template 4: Gradient with Texture
 *
 * Best for: Subtle, sophisticated backgrounds
 * Works well with: Professional content, minimal assets
 */
export interface GradientTextureParams {
  color1: string;
  color2: string;
  textureIntensity?: 'subtle' | 'moderate' | 'prominent';
  accentColor?: string;
  assetType?: string;
}

export function gradientTextureTemplate(params: GradientTextureParams): string {
  const {
    color1,
    color2,
    textureIntensity = 'subtle',
    accentColor,
    assetType = 'icon'
  } = params;

  const textureMap = {
    'subtle': '5-10% opacity',
    'moderate': '10-15% opacity',
    'prominent': '15-20% opacity'
  };

  const accentPhrase = accentColor
    ? ` Include minimal geometric accents in ${accentColor} in the corners that fade toward the center.`
    : ' Include minimal geometric accents in the corners that fade toward the center.';

  return `Create a smooth gradient background transitioning from ${color1} to ${color2} vertically. Add a subtle noise texture (${textureMap[textureIntensity]}) for depth.${accentPhrase} 1080x1920px, clean and contemporary.`;
}

/**
 * Template 5: Dual-Tone Split
 *
 * Best for: Bold, statement backgrounds
 * Works well with: High-contrast assets, icons
 */
export interface DualToneSplitParams {
  color1: string;
  color2: string;
  splitDirection?: 'horizontal' | 'vertical' | 'diagonal';
  blendWidth?: 'sharp' | 'soft' | 'gradient';
  assetType?: string;
}

export function dualToneSplitTemplate(params: DualToneSplitParams): string {
  const {
    color1,
    color2,
    splitDirection = 'diagonal',
    blendWidth = 'soft',
    assetType = 'icon'
  } = params;

  const directionMap = {
    'horizontal': 'horizontally (left and right)',
    'vertical': 'vertically (top and bottom)',
    'diagonal': 'diagonally from top-right to bottom-left'
  };

  const blendMap = {
    'sharp': 'clean, crisp transition',
    'soft': 'soft, blended transition',
    'gradient': 'wide gradient transition zone'
  };

  return `Design a dual-tone background split ${directionMap[splitDirection]} using ${color1} and ${color2}. Create a ${blendMap[blendWidth]} between the two colors at the center. Keep the overall composition clean and modern, suitable for overlaying a ${assetType}. 1080x1920px, bold yet balanced.`;
}

/**
 * Template 6: Radial Focus
 *
 * Best for: Drawing attention to center area
 * Works well with: Central assets, logos
 */
export interface RadialFocusParams {
  centerColor: string;
  edgeColor: string;
  intensity?: 'subtle' | 'moderate' | 'strong';
  assetType?: string;
}

export function radialFocusTemplate(params: RadialFocusParams): string {
  const { centerColor, edgeColor, intensity = 'moderate', assetType = 'logo' } = params;

  const intensityMap = {
    'subtle': 'gentle, barely noticeable',
    'moderate': 'noticeable but not overwhelming',
    'strong': 'bold, dramatic'
  };

  return `Create a radial gradient background that transitions from ${centerColor} at the center to ${edgeColor} at the edges. The transition should be ${intensityMap[intensity]}, creating a natural focal point for the ${assetType} overlay. Add subtle circular accents that echo the radial structure. 1080x1920px, focused and intentional.`;
}

/**
 * Smart template selector
 *
 * Recommends template based on asset characteristics
 *
 * @param assetCharacteristics - Asset analysis data
 * @returns Recommended template name and reasoning
 */
export interface AssetCharacteristics {
  colorfulness: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  dominantColors: string[];
  theme?: string;
}

export function recommendTemplate(
  characteristics: AssetCharacteristics
): { template: string; reasoning: string; suggestedParams: any } {
  const { colorfulness, complexity, dominantColors } = characteristics;

  // High colorfulness → Simple background
  if (colorfulness === 'high') {
    return {
      template: 'abstractGradient',
      reasoning:
        'Asset is colorful, so a simple gradient will provide clean backdrop without competing',
      suggestedParams: {
        color1: getComplementaryColor(dominantColors[0]),
        color2: getComplementaryColor(dominantColors[1] || dominantColors[0]),
        direction: 'diagonal-right'
      }
    };
  }

  // Low colorfulness → Vibrant background
  if (colorfulness === 'low') {
    return {
      template: 'organicShapes',
      reasoning: 'Asset is monochromatic, so vibrant organic shapes add visual energy',
      suggestedParams: {
        colors: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
        shapeCount: 3,
        energy: 'moderate'
      }
    };
  }

  // Complex asset → Clean background
  if (complexity === 'complex') {
    return {
      template: 'gradientTexture',
      reasoning: 'Asset is complex, so a subtle textured gradient provides sophistication',
      suggestedParams: {
        color1: dominantColors[0] || '#667EEA',
        color2: dominantColors[1] || '#764BA2',
        textureIntensity: 'subtle'
      }
    };
  }

  // Simple asset → Geometric patterns
  if (complexity === 'simple') {
    return {
      template: 'geometricPattern',
      reasoning: 'Asset is simple, so geometric patterns add visual interest',
      suggestedParams: {
        colors: [dominantColors[0] || '#667EEA', dominantColors[1] || '#764BA2'],
        shapes: 'mixed',
        density: 'moderate'
      }
    };
  }

  // Default: Abstract gradient (safest choice)
  return {
    template: 'abstractGradient',
    reasoning: 'Default choice - works well with most assets',
    suggestedParams: {
      color1: dominantColors[0] || '#667EEA',
      color2: dominantColors[1] || '#764BA2',
      direction: 'diagonal-right'
    }
  };
}

/**
 * Helper: Get complementary color (simplified)
 *
 * Returns a complementary color for the given hex color
 */
function getComplementaryColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Invert for complementary (simplified approach)
  const compR = (255 - r).toString(16).padStart(2, '0');
  const compG = (255 - g).toString(16).padStart(2, '0');
  const compB = (255 - b).toString(16).padStart(2, '0');

  return `#${compR}${compG}${compB}`;
}

/**
 * Batch template generator
 *
 * Generates multiple prompt variations for A/B testing
 */
export function generatePromptVariations(
  baseParams: any,
  variationCount: number = 3
): string[] {
  const templates = [
    abstractGradientTemplate,
    geometricPatternTemplate,
    organicShapesTemplate,
    gradientTextureTemplate
  ];

  return templates.slice(0, variationCount).map((template, index) => {
    return template(baseParams);
  });
}
