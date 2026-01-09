/**
 * Example: Generate Instagram Story Background
 *
 * Demonstrates complete workflow for generating branded backgrounds
 * using OpenRouter API with IconScout aesthetic guidelines.
 */

import {
  buildSystemPrompt,
  type SystemPromptOptions
} from '../prompts/system-prompts';
import {
  abstractGradientTemplate,
  geometricPatternTemplate,
  recommendTemplate,
  type AssetCharacteristics
} from '../prompts/background-templates';

// Example asset analysis (would come from asset processing pipeline)
const exampleAssetAnalysis: AssetCharacteristics = {
  colorfulness: 'medium',
  complexity: 'simple',
  dominantColors: ['#667EEA', '#764BA2', '#F093FB'],
  theme: 'technology'
};

/**
 * Generate background using OpenRouter API
 */
async function generateBackground(
  systemPrompt: string,
  userPrompt: string
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
        { role: 'user', content: userPrompt }
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
 * Example 1: Manual Template Selection
 */
async function exampleManualTemplate() {
  console.log('=== Example 1: Manual Template Selection ===\n');

  // Build system prompt with asset context
  const systemPromptOptions: SystemPromptOptions = {
    dominantColors: ['#667EEA', '#764BA2'],
    colorfulness: 'medium',
    tone: 'professional'
  };

  const systemPrompt = buildSystemPrompt(systemPromptOptions);

  // Use abstract gradient template
  const userPrompt = abstractGradientTemplate({
    color1: '#4ECDC4',
    color2: '#FF6B6B',
    color3: '#FFE66D',
    direction: 'diagonal-right',
    assetType: 'icon'
  });

  console.log('System Prompt:');
  console.log(systemPrompt);
  console.log('\n---\n');
  console.log('User Prompt:');
  console.log(userPrompt);
  console.log('\n---\n');

  try {
    const result = await generateBackground(systemPrompt, userPrompt);
    console.log('Generated Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Generation failed:', error);
  }

  console.log('\n');
}

/**
 * Example 2: Smart Template Recommendation
 */
async function exampleSmartRecommendation() {
  console.log('=== Example 2: Smart Template Recommendation ===\n');

  // Get template recommendation based on asset characteristics
  const recommendation = recommendTemplate(exampleAssetAnalysis);

  console.log('Asset Characteristics:');
  console.log(JSON.stringify(exampleAssetAnalysis, null, 2));
  console.log('\n---\n');
  console.log('Recommended Template:', recommendation.template);
  console.log('Reasoning:', recommendation.reasoning);
  console.log('\n---\n');

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    dominantColors: exampleAssetAnalysis.dominantColors,
    colorfulness: exampleAssetAnalysis.colorfulness,
    tone: 'neutral'
  });

  // Use recommended template
  let userPrompt: string;
  if (recommendation.template === 'abstractGradient') {
    userPrompt = abstractGradientTemplate(recommendation.suggestedParams);
  } else if (recommendation.template === 'geometricPattern') {
    userPrompt = geometricPatternTemplate(recommendation.suggestedParams);
  } else {
    // Default fallback
    userPrompt = abstractGradientTemplate({
      color1: '#667EEA',
      color2: '#764BA2',
      direction: 'diagonal-right'
    });
  }

  console.log('User Prompt:');
  console.log(userPrompt);
  console.log('\n---\n');

  try {
    const result = await generateBackground(systemPrompt, userPrompt);
    console.log('Generated Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Generation failed:', error);
  }

  console.log('\n');
}

/**
 * Example 3: Colorful Asset (High Colorfulness)
 */
async function exampleColorfulAsset() {
  console.log('=== Example 3: Colorful Asset Background ===\n');

  const colorfulAsset: AssetCharacteristics = {
    colorfulness: 'high',
    complexity: 'moderate',
    dominantColors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'],
    theme: 'creative'
  };

  console.log('Asset Analysis:');
  console.log(`Colorfulness: ${colorfulAsset.colorfulness}`);
  console.log(`Dominant Colors: ${colorfulAsset.dominantColors.join(', ')}`);
  console.log('\n---\n');

  // Build system prompt for colorful asset
  const systemPrompt = buildSystemPrompt({
    dominantColors: colorfulAsset.dominantColors,
    colorfulness: 'high',
    tone: 'playful'
  });

  // Use simple gradient to not compete with colorful asset
  const userPrompt = abstractGradientTemplate({
    color1: '#E8F4F8', // Very light blue (complementary to warm asset)
    color2: '#B8E6F0',
    direction: 'vertical',
    assetType: 'illustration'
  });

  console.log('Strategy: Use subtle, muted background to let colorful asset shine');
  console.log('\n---\n');

  try {
    const result = await generateBackground(systemPrompt, userPrompt);
    console.log('Generated Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Generation failed:', error);
  }

  console.log('\n');
}

/**
 * Example 4: Monochromatic Asset (Low Colorfulness)
 */
async function exampleMonochromaticAsset() {
  console.log('=== Example 4: Monochromatic Asset Background ===\n');

  const monoAsset: AssetCharacteristics = {
    colorfulness: 'low',
    complexity: 'simple',
    dominantColors: ['#333333', '#666666'], // Grayscale
    theme: 'professional'
  };

  console.log('Asset Analysis:');
  console.log(`Colorfulness: ${monoAsset.colorfulness}`);
  console.log(`Dominant Colors: ${monoAsset.dominantColors.join(', ')}`);
  console.log('\n---\n');

  // Build system prompt for monochromatic asset
  const systemPrompt = buildSystemPrompt({
    colorfulness: 'low',
    tone: 'professional'
  });

  // Use vibrant background since asset is grayscale
  const userPrompt = geometricPatternTemplate({
    colors: ['#667EEA', '#764BA2', '#F093FB'],
    shapes: 'circles',
    density: 'moderate',
    assetType: 'icon'
  });

  console.log('Strategy: Use vibrant, colorful background to energize monochrome asset');
  console.log('\n---\n');

  try {
    const result = await generateBackground(systemPrompt, userPrompt);
    console.log('Generated Background Description:');
    console.log(result);
  } catch (error) {
    console.error('Generation failed:', error);
  }

  console.log('\n');
}

/**
 * Example 5: Complete Workflow with Validation
 */
async function exampleCompleteWorkflow() {
  console.log('=== Example 5: Complete Workflow with Validation ===\n');

  // Step 1: Asset Analysis
  console.log('Step 1: Analyzing asset...');
  const asset: AssetCharacteristics = {
    colorfulness: 'medium',
    complexity: 'simple',
    dominantColors: ['#FF6B6B', '#4ECDC4'],
    theme: 'technology'
  };
  console.log(`✓ Asset analyzed: ${asset.colorfulness} colorfulness, ${asset.complexity} complexity\n`);

  // Step 2: Get Template Recommendation
  console.log('Step 2: Getting template recommendation...');
  const recommendation = recommendTemplate(asset);
  console.log(`✓ Recommended: ${recommendation.template}`);
  console.log(`  Reasoning: ${recommendation.reasoning}\n`);

  // Step 3: Build Prompts
  console.log('Step 3: Building prompts...');
  const systemPrompt = buildSystemPrompt({
    dominantColors: asset.dominantColors,
    colorfulness: asset.colorfulness,
    tone: 'neutral'
  });

  const userPrompt = abstractGradientTemplate({
    color1: '#764BA2',
    color2: '#667EEA',
    direction: 'diagonal-right',
    assetType: 'icon'
  });
  console.log(`✓ Prompts constructed\n`);

  // Step 4: Generate Background
  console.log('Step 4: Generating background...');
  try {
    const result = await generateBackground(systemPrompt, userPrompt);
    console.log('✓ Background generated successfully\n');
    console.log('Generated Description:');
    console.log(result);
    console.log('\n');

    // Step 5: Validation (manual in this example)
    console.log('Step 5: Validation checklist:');
    console.log('  [ ] Dimensions are 1080x1920px');
    console.log('  [ ] No text, logos, or assets drawn');
    console.log('  [ ] Safe zones clear (top 250px, bottom 180px)');
    console.log('  [ ] Center area suitable for asset overlay');
    console.log('  [ ] Colors complement asset');
    console.log('  [ ] IconScout brand aesthetic maintained');
    console.log('\n✓ Complete! Background ready for composition.');
  } catch (error) {
    console.error('✗ Generation failed:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=================================================');
  console.log('Instagram Story Background Generation Examples');
  console.log('=================================================\n');

  // Run examples (comment out as needed)
  await exampleManualTemplate();
  await exampleSmartRecommendation();
  await exampleColorfulAsset();
  await exampleMonochromaticAsset();
  await exampleCompleteWorkflow();

  console.log('=================================================');
  console.log('All examples completed');
  console.log('=================================================');
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  generateBackground,
  exampleManualTemplate,
  exampleSmartRecommendation,
  exampleColorfulAsset,
  exampleMonochromaticAsset,
  exampleCompleteWorkflow
};
