# iconscout-brand

AI Art Director skill for IconScout Story Automator background generation. Defines visual brand aesthetic, prompt engineering patterns, and background design guidelines.

---
name: iconscout-brand
description: Acts as AI Art Director for IconScout brand, providing visual style guidelines, prompt templates for background generation, and brand aesthetic rules. Use when generating Instagram story backgrounds, crafting AI prompts for background images, applying IconScout brand style, refining background aesthetics, working with abstract/gradient designs, or ensuring brand consistency in AI-generated backgrounds. Includes system prompts, color theory, and successful prompt patterns.
allowed-tools: Read, Bash, Edit, Write
---

## Quick Reference

### Brand Aesthetic
- **Style**: Modern, clean, vibrant yet professional
- **Backgrounds**: Abstract, gradient-based, organic shapes
- **Colors**: Bold but complementary, enhance asset without competing
- **Patterns**: Geometric patterns, smooth gradients, subtle textures

### Critical Rules
1. **NEVER** draw the asset, logo, or text in the background
2. **ALWAYS** respect Instagram Story safe zones (top 250px, bottom 180px)
3. **CENTER 70%** reserved for asset overlay (756x1344px) - keep relatively clean
4. **OUTPUT** resolution: 1080x1920 pixels (9:16 aspect ratio)
5. **ENHANCE** don't compete - background supports the asset

### AI Model Configuration
- **Model**: Gemini 2.0 Pro (via OpenRouter)
- **Temperature**: 0.7 (creative but controlled)
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model ID**: `google/gemini-2.0-flash-exp:free`

## Usage

### When to Use This Skill

Activate this skill when working on:
- Generating backgrounds for Instagram Stories
- Crafting prompts for AI background generation
- Ensuring brand consistency in visual design
- Refining or iterating on generated backgrounds
- Applying IconScout's visual aesthetic
- Debugging poor background generation results
- Training team members on background design principles

### Trigger Keywords

This skill activates on:
- "generate Instagram story background"
- "IconScout brand guidelines"
- "AI background prompt"
- "refine story background"
- "brand aesthetic"
- "background generation prompt"
- "abstract gradient background"
- "visual style guidelines"

## System Prompt Template

### Core System Prompt

Use this as the base system prompt for ALL background generation:

```
You are an expert background designer for Instagram Stories specializing in the IconScout brand aesthetic.

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
- Ensure the center area has visual interest but remains suitable for overlay
```

### Extended System Prompt (with Color Context)

When asset color analysis is available, extend the system prompt:

```
ASSET COLOR CONTEXT:
The asset that will be overlaid has the following dominant colors: [COLOR_LIST]

COLOR STRATEGY:
- Use complementary or analogous colors to create harmony
- Avoid using the exact same colors as the asset (creates visual confusion)
- Create subtle contrast to make the asset "pop" without jarring transitions
- Consider using one dominant color from the asset as an accent (10-20% of background)
```

## User Prompt Patterns

### Template Structure

User prompts should follow this structure:

```
Create an Instagram Story background with the following characteristics:

ASSET DESCRIPTION: [Brief description of the asset that will be overlaid]
DOMINANT COLORS: [List of asset's main colors]
META DESCRIPTION: [High-level theme or mood]

STYLE REQUIREMENTS:
- [Specific style request: abstract, gradient, geometric, etc.]
- [Color palette preference]
- [Mood/vibe keywords]

CONSTRAINTS:
- 1080x1920 pixels (9:16 aspect ratio)
- Keep center 70% relatively clean for asset overlay
- Avoid critical elements in top 250px and bottom 180px
```

### Working Prompt Templates

#### Template 1: Abstract Gradient
```
Create an abstract gradient background with [COLOR_1] and [COLOR_2] flowing diagonally from top-left to bottom-right. Use smooth color transitions and subtle geometric shapes in the corners. The center should have a gentle gradient suitable for overlaying a [ASSET_TYPE] asset. 1080x1920px, modern and vibrant aesthetic.
```

#### Template 2: Geometric Patterns
```
Design a minimalist background with subtle geometric patterns using [COLOR_PALETTE]. Incorporate small triangular or circular shapes arranged in a clean, non-distracting pattern. Keep the center 70% simpler to accommodate a [ASSET_TYPE] overlay. 1080x1920px, professional yet playful.
```

#### Template 3: Organic Shapes
```
Generate a vibrant background with organic blob shapes in [COLOR_1], [COLOR_2], and [COLOR_3]. Use smooth, flowing forms that create visual interest without overwhelming. Position larger shapes near the edges, keeping the center area cleaner for asset placement. 1080x1920px, modern and dynamic.
```

#### Template 4: Gradient with Texture
```
Create a smooth gradient background transitioning from [COLOR_1] to [COLOR_2] vertically. Add a subtle noise texture (10-15% opacity) for depth. Include minimal geometric accents in the corners that fade toward the center. 1080x1920px, clean and contemporary.
```

### Effective Keywords

**Style Keywords** (use 2-3 per prompt):
- `minimalist` - Clean, simple composition
- `vibrant` - Bold, energetic colors
- `abstract` - Non-representational shapes
- `gradient` - Smooth color transitions
- `organic` - Flowing, natural shapes
- `geometric` - Clean angles and patterns
- `modern` - Contemporary design language
- `dynamic` - Movement and energy
- `professional` - Polished, refined aesthetic
- `playful` - Light, friendly vibe

**Avoid Keywords** (these often produce poor results):
- `realistic`, `photographic`, `detailed`
- `busy`, `complex`, `intricate`
- `text`, `typography`, `words`
- `logo`, `branding`, `icon` (in background context)
- `collage`, `montage`, `composite`

## Color Theory Guidelines

### Color Harmony Strategies

#### Complementary Colors
Use colors opposite on the color wheel for vibrant contrast:
- Blue backgrounds for orange/warm assets
- Purple backgrounds for yellow assets
- Red backgrounds for green assets

#### Analogous Colors
Use adjacent colors for harmonious, cohesive designs:
- Blue-purple-pink for cool assets
- Orange-yellow-red for warm assets
- Green-blue-teal for nature-themed assets

#### Triadic Colors
Use three evenly-spaced colors for balanced variety:
- Red, blue, yellow
- Orange, green, purple
- Pink, teal, yellow-green

### Asset Color Integration

**High Contrast Assets** (black, white, grayscale):
- Use bold, saturated backgrounds
- Experiment with vibrant gradients
- More freedom with color choices

**Colorful Assets**:
- Identify 2-3 dominant colors
- Use complementary or analogous palette
- Avoid matching asset colors exactly
- Create subtle differentiation

**Monochromatic Assets** (single color family):
- Use contrasting background color
- OR use same family with different saturation/brightness
- Add neutral accents (white, gray) for balance

## Background Generation Workflow

### Step 1: Asset Analysis

Before generating background, analyze the asset:

```typescript
interface AssetAnalysis {
  type: string;              // 'icon', 'illustration', 'photo', etc.
  dominantColors: string[];  // Hex codes of main colors
  colorfulness: 'low' | 'medium' | 'high';
  theme: string;             // General theme/mood
  visualComplexity: 'simple' | 'moderate' | 'complex';
}
```

### Step 2: Prompt Construction

Build prompt using:
1. System prompt (from templates above)
2. Asset description
3. Dominant colors
4. Style keywords (2-3)
5. Technical constraints (1080x1920, safe zones)

### Step 3: Generation

Send to OpenRouter API:

```typescript
{
  model: 'google/gemini-2.0-flash-exp:free',
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_PROMPT }
  ],
  temperature: 0.7,
  max_tokens: 1024
}
```

### Step 4: Validation

Check generated background:
- [ ] Dimensions are 1080x1920px
- [ ] No text, logos, or assets drawn
- [ ] Safe zones (top 250px, bottom 180px) clear of critical elements
- [ ] Center area suitable for asset overlay
- [ ] Colors complement asset
- [ ] Overall aesthetic matches IconScout brand

### Step 5: Refinement (if needed)

If background doesn't meet criteria, use refinement prompt:

```
The previous background was [ISSUE]. Please regenerate with the following adjustments:

KEEP:
- [Elements that worked well]

CHANGE:
- [Specific modifications needed]

MAINTAIN:
- 1080x1920px resolution
- IconScout brand aesthetic
- Clean center area for asset overlay
```

## Common Issues & Solutions

### Issue: Background Too Busy

**Problem**: Too many shapes/patterns compete with asset

**Solution**:
```
Simplify the background composition. Use broader gradient strokes and fewer geometric elements. Focus visual complexity on the edges/corners, keeping the center 50% much simpler.
```

### Issue: Colors Clash with Asset

**Problem**: Background colors don't harmonize with asset

**Solution**:
```
Analyze asset dominant colors again. Use complementary color strategy:
- If asset is warm (red/orange/yellow), use cool background (blue/teal/purple)
- If asset is cool (blue/green/purple), use warm background (orange/pink/yellow)
- Adjust saturation: if asset is highly saturated, reduce background saturation by 20-30%
```

### Issue: Center Area Too Dark/Light

**Problem**: Asset overlay doesn't have enough contrast

**Solution**:
```
Request medium-toned center area with subtle gradient. Avoid pure white or pure black in center 70%. Aim for 40-60% brightness in center region to ensure asset visibility regardless of asset brightness.
```

### Issue: Background Looks Generic

**Problem**: Doesn't reflect IconScout brand personality

**Solution**:
```
Emphasize brand keywords in prompt:
- "modern and professional yet approachable"
- "clean geometric patterns with organic flow"
- "vibrant colors with intentional restraint"
- "abstract shapes that suggest creativity without literal representation"
```

### Issue: AI Drew the Asset

**Problem**: Background includes logo, icon, or asset itself

**Solution**:
```
Strengthen system prompt constraints:
- Add "You must generate ONLY abstract backgrounds. Do not include any recognizable objects, icons, logos, or illustrations."
- Remove any descriptive language about the asset from user prompt
- Use only color and mood keywords, not object descriptions
```

## Integration with story-composition

This skill works in tandem with `story-composition` skill:

1. **iconscout-brand**: Generates the background image
2. **story-composition**: Layers the asset onto background using safe zones

### Workflow Integration

```typescript
// 1. Generate background (iconscout-brand)
const backgroundPrompt = constructBackgroundPrompt(assetAnalysis);
const backgroundPath = await generateBackground(backgroundPrompt);

// 2. Compose story (story-composition)
const result = await composeStory(
  backgroundPath,
  assetPath,
  outputPath
);
```

### Cross-Skill References

- For technical composition: See `../story-composition/SKILL.md`
- For safe zone mathematics: See `../story-composition/lib/safe-zones.ts`
- For Instagram specs: See `../story-composition/references/INSTAGRAM_SPECS.md`

## Examples

See detailed examples in `examples/`:
- `generate-background.ts` - Full background generation workflow
- `refine-background.ts` - Iterative refinement process

## References

Comprehensive documentation in `references/`:
- `BRAND_GUIDELINES.md` - Complete IconScout visual identity guide
- `PROMPT_LIBRARY.md` - Library of successful prompts with results
- `COLOR_THEORY.md` - Advanced color palette strategies

## Best Practices

### DO:
✅ Start with asset color analysis
✅ Use 2-3 style keywords per prompt
✅ Emphasize "abstract" and "gradient" for best results
✅ Specify 1080x1920px in every prompt
✅ Test backgrounds with actual asset overlays
✅ Iterate if first result doesn't meet standards
✅ Keep prompt library updated with successful patterns

### DON'T:
❌ Describe the asset in detail (triggers AI to draw it)
❌ Use "realistic" or "photographic" style keywords
❌ Request complex scenes or literal objects
❌ Forget to specify safe zone requirements
❌ Accept backgrounds that compete with asset
❌ Use overly complex prompts (keep focused)
❌ Rely on single generation (iterate as needed)

## API Configuration

### OpenRouter Setup

```typescript
const OPENROUTER_CONFIG = {
  baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemini-2.0-flash-exp:free',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://iconscout.com',
    'X-Title': 'IconScout Story Automator'
  },
  temperature: 0.7,
  max_tokens: 1024
};
```

### Environment Variables

Required in `.env`:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

### API Key Reference

For local development, the OpenRouter API key is:
```
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
```

**Important**:
- For production deployment, set this as an environment variable in your hosting platform (Vercel, Netlify, etc.)
- Never commit this key to git repositories
- Key is stored in `.env` file locally (git-ignored)

## Skill Metadata

**Version**: 1.0.0
**Last Updated**: January 2026
**Maintained By**: IconScout Story Automator Team
**Related Skills**: story-composition, scheduling-instagram-stories

---

**For technical composition implementation**: See `../story-composition/`
**For API scheduling**: See `../scheduling-instagram-stories/`
