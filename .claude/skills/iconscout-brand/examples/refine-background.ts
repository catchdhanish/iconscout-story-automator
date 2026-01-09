/**
 * Example: Refine Instagram Story Background
 *
 * Demonstrates iterative refinement workflow when initial generation
 * doesn't meet requirements.
 */

import {
  buildRefinementPrompt,
  simplifyComplexityPrompt,
  adjustColorHarmonyPrompt,
  improveCenterAreaPrompt,
  increaseBrandAlignmentPrompt,
  avoidDrawingAssetPrompt,
  adjustEnergyLevelPrompt,
  multiIssueRefinementPrompt
} from '../prompts/refinement-prompts';
import { buildSystemPrompt } from '../prompts/system-prompts';

/**
 * Simulate API call (same as generate-background.ts)
 */
async function regenerateBackground(
  systemPrompt: string,
  refinementPrompt: string
): Promise<string> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://iconscout.com',
      'X-Title': 'IconScout Story Automator'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: refinementPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Example 1: Simplify Overly Complex Background
 */
async function exampleSimplifyComplexity() {
  console.log('=== Example 1: Simplify Overly Complex Background ===\n');

  console.log('Issue: First generation had too many shapes and patterns\n');

  const refinementPrompt = simplifyComplexityPrompt(
    'too many geometric shapes competing for attention'
  );

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt({
    emphasizeSimplicity: true
  });

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 2: Adjust Color Harmony
 */
async function exampleAdjustColors() {
  console.log('=== Example 2: Adjust Color Harmony ===\n');

  console.log('Issue: Background colors too similar to asset\n');

  const refinementPrompt = adjustColorHarmonyPrompt({
    issue: 'too-similar',
    assetColors: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
    desiredDirection: 'Use cooler tones with purple/blue palette'
  });

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt({
    dominantColors: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
    colorfulness: 'high'
  });

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 3: Improve Center Area Visibility
 */
async function exampleImproveCenterArea() {
  console.log('=== Example 3: Improve Center Area Visibility ===\n');

  console.log('Issue: Center area too dark for light-colored asset\n');

  const refinementPrompt = improveCenterAreaPrompt({
    issue: 'too-dark',
    assetBrightness: 'light'
  });

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt();

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 4: Increase Brand Alignment
 */
async function exampleIncreaseBrandAlignment() {
  console.log('=== Example 4: Increase Brand Alignment ===\n');

  console.log('Issue: Background lacks "modern" quality\n');

  const refinementPrompt = increaseBrandAlignmentPrompt({
    currentStyle: 'abstract gradient',
    missingQuality: 'modern'
  });

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt({
    tone: 'professional'
  });

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 5: Fix AI Drawing the Asset
 */
async function exampleAvoidAsset() {
  console.log('=== Example 5: Fix AI Drawing the Asset ===\n');

  console.log('Issue: AI incorrectly drew a logo in the background\n');

  const refinementPrompt = avoidDrawingAssetPrompt({
    whatWasDrawn: 'a logo icon in the center',
    assetDescription: 'technology icon'
  });

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt();

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 6: Adjust Energy Level
 */
async function exampleAdjustEnergy() {
  console.log('=== Example 6: Adjust Energy Level ===\n');

  console.log('Issue: Background too energetic for professional content\n');

  const refinementPrompt = adjustEnergyLevelPrompt({
    currentEnergy: 'too-energetic',
    desiredEnergy: 'moderate',
    reason: 'Content is professional/business-oriented'
  });

  console.log('Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt({
    tone: 'professional'
  });

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 7: Multi-Issue Refinement
 */
async function exampleMultiIssue() {
  console.log('=== Example 7: Multi-Issue Refinement ===\n');

  console.log('Issues:');
  console.log('  - Too complex (many shapes)');
  console.log('  - Colors too similar to asset');
  console.log('  - Center area too dark');
  console.log('  - Missing "vibrant" brand quality\n');

  const refinementPrompt = multiIssueRefinementPrompt({
    complexity: 'too many competing shapes',
    color: {
      issue: 'too-similar',
      assetColors: ['#667EEA', '#764BA2']
    },
    centerArea: {
      issue: 'too-dark',
      assetBrightness: 'light'
    },
    brand: {
      missingQuality: 'vibrant'
    }
  });

  console.log('Multi-Issue Refinement Prompt:');
  console.log(refinementPrompt);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt({
    emphasizeSimplicity: true,
    tone: 'playful'
  });

  try {
    const result = await regenerateBackground(systemPrompt, refinementPrompt);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Example 8: Iterative Refinement Workflow
 */
async function exampleIterativeWorkflow() {
  console.log('=== Example 8: Iterative Refinement Workflow ===\n');

  console.log('Iteration 1: Initial generation');
  console.log('  Result: Too complex, colors clash\n');

  // First refinement: Simplify
  console.log('Iteration 2: Simplify complexity');
  const refinement1 = simplifyComplexityPrompt();
  console.log('  Refinement applied: Reduce complexity');
  console.log(`  Status: Better, but colors still don't harmonize\n`);

  // Second refinement: Adjust colors
  console.log('Iteration 3: Adjust color harmony');
  const refinement2 = adjustColorHarmonyPrompt({
    issue: 'too-contrasting',
    assetColors: ['#FF6B6B', '#4ECDC4']
  });
  console.log('  Refinement applied: Harmonize colors');
  console.log('  Status: Good! Colors work well now\n');

  console.log('✓ Final result: Simplified, harmonious background\n');

  console.log('Key Takeaway:');
  console.log('  Iterative refinement often yields better results than');
  console.log('  trying to fix all issues at once. Start with major issues,');
  console.log('  then refine details.\n');
}

/**
 * Example 9: Custom Refinement with buildRefinementPrompt
 */
async function exampleCustomRefinement() {
  console.log('=== Example 9: Custom Refinement ===\n');

  console.log('Issue: Unique situation not covered by templates\n');

  const customRefinement = buildRefinementPrompt({
    keep: [
      'The diagonal gradient direction',
      'The overall color temperature (cool tones)',
      'The soft, organic shapes in corners'
    ],
    change: [
      'The gradient needs more contrast - increase saturation by 25%',
      'Add a subtle radial highlight in the center area',
      'Reduce the size of corner shapes by 30%',
      'Make the transition between shapes smoother'
    ],
    emphasize: [
      'Increased color saturation for vibrancy',
      'Balanced composition with subtle center highlight',
      'Smooth, professional transitions'
    ]
  });

  console.log('Custom Refinement Prompt:');
  console.log(customRefinement);
  console.log('\n---\n');

  const systemPrompt = buildSystemPrompt();

  try {
    const result = await regenerateBackground(systemPrompt, customRefinement);
    console.log('Refined Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Refinement failed:', error);
  }

  console.log('\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('=================================================');
  console.log('Instagram Story Background Refinement Examples');
  console.log('=================================================\n');

  // Run examples (comment out as needed)
  await exampleSimplifyComplexity();
  await exampleAdjustColors();
  await exampleImproveCenterArea();
  await exampleIncreaseBrandAlignment();
  await exampleAvoidAsset();
  await exampleAdjustEnergy();
  await exampleMultiIssue();
  exampleIterativeWorkflow(); // No API call
  await exampleCustomRefinement();

  console.log('=================================================');
  console.log('All refinement examples completed');
  console.log('=================================================');
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  regenerateBackground,
  exampleSimplifyComplexity,
  exampleAdjustColors,
  exampleImproveCenterArea,
  exampleIncreaseBrandAlignment,
  exampleAvoidAsset,
  exampleAdjustEnergy,
  exampleMultiIssue,
  exampleIterativeWorkflow,
  exampleCustomRefinement
};
