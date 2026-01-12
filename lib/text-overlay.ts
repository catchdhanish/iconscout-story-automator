import path from 'path';

/**
 * Configuration for text overlay SVG generation
 */
export interface TextOverlayOptions {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  shadowColor: string;
  maxWidth?: number;
}

/**
 * Escapes XML entities in text for safe SVG inclusion
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wraps text into multiple lines with soft hyphen support
 *
 * @param text - Text to wrap
 * @param maxCharsPerLine - Maximum characters per line (default: 28)
 * @returns Array of text lines (max 3 lines)
 */
export function wrapTextWithHyphens(text: string, maxCharsPerLine: number = 28): string[] {
  if (!text) return [''];

  const lines: string[] = [];
  let currentLine = '';
  const words = text.split(/\s+/);

  for (const word of words) {
    // Check if word contains soft hyphens
    const hasSoftHyphens = word.includes('\u00AD');

    if (hasSoftHyphens) {
      // Split by soft hyphens and process each segment
      const segments = word.split('\u00AD');
      let processedWord = '';

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;

        // Try to add segment to processed word
        const testWord = processedWord + segment;

        if ((currentLine + ' ' + testWord).trim().length <= maxCharsPerLine || !currentLine) {
          processedWord = testWord;
          if (!isLastSegment) {
            processedWord += '-'; // Add hyphen for visible break
          }
        } else {
          // Need to wrap here
          if (currentLine) {
            lines.push(currentLine.trim());
            if (lines.length >= 3) return lines;
            currentLine = '';
          }
          processedWord = segment;
          if (!isLastSegment) {
            processedWord += '-';
          }
        }
      }

      // Add processed word to current line
      if (currentLine && (currentLine + ' ' + processedWord).length <= maxCharsPerLine) {
        currentLine += ' ' + processedWord;
      } else if (!currentLine) {
        currentLine = processedWord;
      } else {
        lines.push(currentLine.trim());
        if (lines.length >= 3) return lines;
        currentLine = processedWord;
      }
    } else {
      // Regular word processing
      const testLine = currentLine ? currentLine + ' ' + word : word;

      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else if (word.length > maxCharsPerLine) {
        // Word is too long, need to break it
        if (currentLine) {
          lines.push(currentLine.trim());
          if (lines.length >= 3) return lines;
          currentLine = '';
        }

        // Break long word into chunks
        let remaining = word;
        while (remaining.length > 0 && lines.length < 3) {
          const chunk = remaining.slice(0, maxCharsPerLine);
          if (!currentLine) {
            currentLine = chunk;
          } else {
            lines.push(currentLine.trim());
            if (lines.length >= 3) return lines;
            currentLine = chunk;
          }
          remaining = remaining.slice(maxCharsPerLine);
        }
      } else {
        // Start new line
        if (currentLine) {
          lines.push(currentLine.trim());
          if (lines.length >= 3) return lines;
        }
        currentLine = word;
      }
    }
  }

  // Add remaining text
  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines.slice(0, 3); // Ensure max 3 lines
}

/**
 * Generates SVG markup for text overlay with DM Sans font
 *
 * @param options - Text overlay configuration
 * @returns SVG markup as string
 */
export function generateTextSVG(options: TextOverlayOptions): string {
  const {
    text,
    x,
    y,
    fontSize,
    fontWeight,
    color,
    shadowColor,
    maxWidth = 900
  } = options;

  // Calculate characters per line based on font size and max width
  // Average character width is approximately 0.52em for DM Sans
  const maxCharsPerLine = Math.floor((maxWidth / fontSize) / 0.52);

  // Wrap text into lines
  const lines = wrapTextWithHyphens(text, maxCharsPerLine);

  // Calculate line height (1.3x font size)
  const lineHeight = fontSize * 1.3;

  // Calculate total text block height
  const totalHeight = lines.length * lineHeight;

  // Get absolute path to font file
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'DMSans-Variable.woff2');
  const fontUrl = `file://${fontPath}`;

  // Generate font-face declaration
  const fontFaceDeclaration = `
    <style type="text/css">
      @font-face {
        font-family: 'DM Sans';
        src: url('${fontUrl}') format('woff2-variations');
        font-weight: 100 1000;
      }
    </style>`;

  // Generate filter for adaptive shadow
  const filterId = 'textShadow';
  const filterDeclaration = `
    <filter id="${filterId}">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${shadowColor}"/>
    </filter>`;

  // Generate tspan elements for each line
  const tspans = lines.map((line, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
  }).join('\n      ');

  // Generate complete SVG
  const svg = `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${fontFaceDeclaration}
    ${filterDeclaration}
  </defs>
  <text
    x="${x}"
    y="${y}"
    font-family="DM Sans"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="middle"
    letter-spacing="-0.02em"
    filter="url(#${filterId})"
  >
      ${tspans}
  </text>
</svg>`;

  return svg;
}

/**
 * Returns default text overlay configuration
 *
 * @returns Default configuration object
 */
export function getDefaultTextConfig(): Omit<TextOverlayOptions, 'shadowColor'> {
  const defaultText = process.env.DEFAULT_TEXT_OVERLAY_CONTENT ||
    'Get this exclusive premium asset for free (today only!) - link in bio';

  return {
    text: defaultText,
    x: 540,
    y: 1520,
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 900
  };
}
