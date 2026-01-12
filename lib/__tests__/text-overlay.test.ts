import { describe, it, expect } from '@jest/globals';
import { wrapTextWithHyphens, generateTextSVG, getDefaultTextConfig } from '../text-overlay';

describe('text-overlay', () => {
  describe('wrapTextWithHyphens', () => {
    it('should wrap text at approximately 28 characters per line', () => {
      const text = 'This is a long piece of text that should be wrapped into multiple lines';
      const lines = wrapTextWithHyphens(text, 28);

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.every(line => line.length <= 35)).toBe(true); // Allow some flexibility
    });

    it('should respect soft hyphens for manual word breaking', () => {
      const text = 'Super\u00ADcali\u00ADfragi\u00ADlistic\u00ADexpi\u00ADali\u00ADdocious is a very long word';
      const lines = wrapTextWithHyphens(text, 28);

      // Should break at soft hyphens when needed
      expect(lines.length).toBeGreaterThan(1);
      // Soft hyphens should be removed or converted
      expect(lines.join('')).not.toContain('\u00AD');
    });

    it('should limit output to maximum 3 lines', () => {
      const text = 'This is a very long text that goes on and on and on and should definitely need more than three lines if we keep adding more and more words to it';
      const lines = wrapTextWithHyphens(text, 28);

      expect(lines.length).toBeLessThanOrEqual(3);
    });

    it('should handle short text without wrapping', () => {
      const text = 'Short text';
      const lines = wrapTextWithHyphens(text, 28);

      expect(lines).toEqual(['Short text']);
    });

    it('should handle empty text', () => {
      const lines = wrapTextWithHyphens('', 28);

      expect(lines).toEqual(['']);
    });

    it('should break long words that exceed maxCharsPerLine', () => {
      const text = 'Supercalifragilisticexpialidocious';
      const lines = wrapTextWithHyphens(text, 28);

      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe('generateTextSVG', () => {
    it('should include DM Sans font reference', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('@font-face');
      expect(svg).toContain('DM Sans');
      expect(svg).toContain('DMSans-Variable.woff2');
    });

    it('should include adaptive shadow via filter parameter', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('<filter');
      expect(svg).toContain('feDropShadow');
      expect(svg).toContain('rgba(0,0,0,0.3)');
    });

    it('should wrap long text into multiple lines', () => {
      const longText = 'This is a very long text that should be wrapped into multiple lines for proper display';
      const svg = generateTextSVG({
        text: longText,
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      // Should contain multiple tspan elements for multiple lines
      const tspanCount = (svg.match(/<tspan/g) || []).length;
      expect(tspanCount).toBeGreaterThan(1);
    });

    it('should use correct text styling properties', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('text-anchor="middle"');
      expect(svg).toContain('font-size="42"');
      expect(svg).toContain('font-weight="700"');
      expect(svg).toContain('letter-spacing="-0.02em"');
      expect(svg).toContain('font-family="DM Sans"');
    });

    it('should escape XML entities in text', () => {
      const svg = generateTextSVG({
        text: 'Text with <special> & "characters"',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('&lt;special&gt;');
      expect(svg).toContain('&amp;');
      expect(svg).toContain('&quot;');
    });

    it('should calculate line height as 1.3x font size', () => {
      const longText = 'This is a long text that will wrap into multiple lines';
      const svg = generateTextSVG({
        text: longText,
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      // Line height should be 42 * 1.3 = 54.6
      // Check for dy attribute in tspan (only present after first line)
      const tspanCount = (svg.match(/<tspan/g) || []).length;
      if (tspanCount > 1) {
        expect(svg).toContain('dy="54.6"');
      } else {
        // If only one line, no dy needed
        expect(tspanCount).toBe(1);
      }
    });

    it('should handle custom color', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FF5733',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('fill="#FF5733"');
    });

    it('should respect max 3 lines limit', () => {
      const longText = 'This is a very long text that goes on and on and on and should definitely need more than three lines if we keep adding more and more words to it';
      const svg = generateTextSVG({
        text: longText,
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      const tspanCount = (svg.match(/<tspan/g) || []).length;
      expect(tspanCount).toBeLessThanOrEqual(3);
    });

    it('should use fontWeight parameter instead of hardcoded value', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '900',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('font-weight="900"');
      expect(svg).not.toContain('font-weight="600"');
    });

    it('should use x and y position parameters', () => {
      const svg = generateTextSVG({
        text: 'Test text',
        x: 400,
        y: 1200,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.3)',
        maxWidth: 900
      });

      expect(svg).toContain('x="400"');
      expect(svg).toContain('y="1200"');
    });
  });

  describe('getDefaultTextConfig', () => {
    it('should return correct default configuration', () => {
      const config = getDefaultTextConfig();

      expect(config).toHaveProperty('text');
      expect(config).toHaveProperty('x', 540);
      expect(config).toHaveProperty('y', 1520);
      expect(config).toHaveProperty('fontSize', 42);
      expect(config).toHaveProperty('fontWeight', '700');
      expect(config).toHaveProperty('color', '#FFFFFF');
      expect(config).toHaveProperty('maxWidth', 900);
      expect(typeof config.text).toBe('string');
    });

    it('should use DEFAULT_TEXT_OVERLAY_CONTENT env var for default text', () => {
      const config = getDefaultTextConfig();

      // Default text should come from env var or fallback
      expect(config.text.length).toBeGreaterThan(0);
      // Default should match spec
      if (!process.env.DEFAULT_TEXT_OVERLAY_CONTENT) {
        expect(config.text).toBe('Get this exclusive premium asset for free (today only!) - link in bio');
      }
    });

    it('should not include shadowColor in default config', () => {
      const config = getDefaultTextConfig();

      expect(config).not.toHaveProperty('shadowColor');
    });
  });
});
