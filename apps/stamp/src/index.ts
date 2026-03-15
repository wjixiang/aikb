import fs from 'node:fs';

/**
 * Stamp Generator - Generate seal/stamp images as SVG
 */

/** Font family options */
export enum StampFontFamily {
  SimHei = 'SimHei, Microsoft YaHei, STHeiti, sans-serif',
  FangSong = 'FangSong, STSong, sans-serif',
  KaiTi = 'KaiTi, STKaiti, sans-serif',
  SimSun = 'SimSun, STSong, serif',
  MicrosoftYaHei = 'Microsoft YaHei, sans-serif',
}

export interface StampOptions {
  /** Width and height of the stamp */
  size: number;
  /** Center text (company/organization name) */
  centerText: string;
  /** Bottom text (e.g., financial license number) */
  bottomText?: string;
  /** Primary color (hex) */
  color: string;
  /** Border width */
  borderWidth?: number;
  /** Inner border width */
  innerBorderWidth?: number;
  /** Center text font size (absolute or ratio, <1 = ratio, >=1 = absolute px) */
  centerFontSize?: number;
  /** Bottom text font size (absolute or ratio, <1 = ratio, >=1 = absolute px) */
  bottomFontSize?: number;
  /** Show star in center */
  showStar?: boolean;
  /** Star size (as ratio of stamp size) */
  starSizeRatio?: number;
  /** Number of border circles */
  borderCircles?: number;
  /** Show inner thin circle */
  showInnerCircle?: boolean;
  /** Text rotation direction: 1 for clockwise, -1 for counter-clockwise */
  textDirection?: 1 | -1;
  /** Gap between outer border and text */
  textGapRatio?: number;
  /** Font family */
  fontFamily?: StampFontFamily;
}

const DEFAULT_OPTIONS: Required<StampOptions> = {
  size: 400,
  centerText: '',
  bottomText: '',
  color: '#DC0000',
  borderWidth: 8,
  innerBorderWidth: 3,
  centerFontSize: 44,  // 0.11 * 400
  bottomFontSize: 28,  // 0.07 * 400
  showStar: true,
  starSizeRatio: 0.22,
  borderCircles: 2,
  showInnerCircle: true,
  textDirection: 1,
  textGapRatio: 0.18,
  fontFamily: StampFontFamily.SimHei,
};

/**
 * Convert degrees to radians
 */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Generate star points
 */
function generateStarPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 5
): string {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  const vertices: number[] = [];

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    vertices.push(x, y);
    angle += step;
  }

  return vertices.join(' ');
}

/**
 * Generate arc path for text
 */
function generateArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startX = cx + Math.cos(startAngle) * radius;
  const startY = cy + Math.sin(startAngle) * radius;
  const endX = cx + Math.cos(endAngle) * radius;
  const endY = cy + Math.sin(endAngle) * radius;

  const largeArcFlag = (endAngle - startAngle) > Math.PI ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

/**
 * Generate text on arc using SVG
 */
function generateTextOnArc(
  text: string,
  cx: number,
  cy: number,
  radius: number,
  fontSize: number,
  fontFamily: StampFontFamily,
  color: string,
  direction: 1 | -1
): string {
  const charCount = text.length;
  const totalAngle = Math.PI;
  const angleStep = totalAngle / Math.max(charCount - 1, 1);
  const startAngle = direction === 1 ? Math.PI : 0;

  let svg = '';

  for (let i = 0; i < charCount; i++) {
    const angle = startAngle + (i * angleStep) * direction;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    // Calculate rotation: text should be perpendicular to radius
    let rotation = (angle * 180) / Math.PI + 90;
    if (direction === 1) {
      rotation = (angle * 180) / Math.PI - 90;
    }

    // 相对自身再旋转180度
    rotation += 180;

    svg += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="${fontFamily}" fill="${color}" `;
    svg += `text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotation}, ${x}, ${y})">${text[i]}</text>`;
  }

  return svg;
}

/**
 * Generate a stamp image as SVG
 */
export function generateStamp(options: StampOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    size, centerText, bottomText, color, borderWidth, innerBorderWidth,
    centerFontSize, bottomFontSize, showStar, starSizeRatio, borderCircles,
    showInnerCircle, textDirection, textGapRatio, fontFamily
  } = opts;

  const cx = size / 2;
  const cy = size / 2;
  const mainRadius = size / 2 - borderWidth / 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
`;

  // Draw border circles
  for (let i = 0; i < borderCircles; i++) {
    const radius = mainRadius - (i * innerBorderWidth);
    svg += `  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${borderWidth}"/>\n`;
  }

  // Draw inner thin circle
  if (showInnerCircle) {
    const innerRadius = mainRadius - (borderCircles - 1) * innerBorderWidth - borderWidth - 4;
    svg += `  <circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="none" stroke="${color}" stroke-width="1.5"/>\n`;
  }

  // Draw star
  if (showStar) {
    const starOuterRadius = mainRadius * starSizeRatio;
    const starInnerRadius = starOuterRadius * 0.4;
    const starPoints = generateStarPoints(cx, cy, starOuterRadius, starInnerRadius, 5);
    svg += `  <polygon points="${starPoints}" fill="${color}"/>\n`;
  }

  // Draw center text on arc
  if (centerText) {
    // If < 1, treat as ratio; otherwise as absolute size
    const centerTextSize = centerFontSize < 1 ? size * centerFontSize : centerFontSize;
    const textRadius = mainRadius * (1 - textGapRatio) - centerTextSize;
    svg += `  <g>\n`;
    svg += generateTextOnArc(centerText, cx, cy, textRadius, centerTextSize, fontFamily, color, textDirection);
    svg += `  </g>\n`;
  }

  // Draw bottom text (horizontal)
  if (bottomText) {
    const bottomTextSize = bottomFontSize < 1 ? size * bottomFontSize : bottomFontSize;
    const bottomY = cy + mainRadius * 0.55;
    svg += `  <text x="${cx}" y="${bottomY}" font-size="${bottomTextSize}" font-family="${fontFamily}" fill="${color}" `;
    svg += `text-anchor="middle" dominant-baseline="middle" font-weight="bold">${bottomText}</text>\n`;
  }

  svg += `</svg>`;

  return svg;
}

/**
 * Generate a simple circular stamp
 */
export function generateSimpleStamp(
  text: string,
  options: Partial<StampOptions> = {}
): string {
  return generateStamp({
    size: options.size ?? 300,
    centerText: text,
    color: options.color ?? '#DC0000',
    showStar: options.showStar ?? false,
    ...options,
  });
}

/**
 * Generate a official-looking stamp
 */
export function generateOfficialStamp(
  centerText: string,
  bottomText: string,
  options: Partial<StampOptions> = {}
): string {
  return generateStamp({
    size: options.size ?? 300,
    centerText,
    bottomText,
    color: options.color ?? '#DC0000',
    showStar: true,
    showInnerCircle: options.showInnerCircle ?? true,
    textDirection: 1,
    ...options,
  });
}

/**
 * Generate stamp as PNG buffer using canvas (for export)
 */
export async function generateStampAsPng(options: StampOptions): Promise<Buffer> {
  const svgString = generateStamp(options);

  // Dynamic import canvas
  const { createCanvas, loadImage } = await import('canvas');
  const size = options.size ?? DEFAULT_OPTIONS.size;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Create image from SVG
  const img = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`);

  ctx.drawImage(img, 0, 0);

  return canvas.toBuffer('image/png');
}

/**
 * Save SVG to file
 */
export function saveSvg(svg: string, filepath: string): void {
  fs.writeFileSync(filepath, svg, 'utf8');
}

// CLI
const args = process.argv.slice(2);

if (args.length > 0 && args[0] === '--help') {
  console.log(`
Stamp Generator CLI (SVG)

Usage:
  pnpm start [options]

Options:
  --center <text>       Center text (organization name) - supports Chinese
  --bottom <text>      Bottom text (license number, etc.)
  --size <number>      Image size (default: 400)
  --color <hex>        Hex color (default: DC0000)
  --border-width <n>   Outer circle border width (default: 8)
  --font <name>        Font family (e.g., FangSong, SimHei, KaiTi)
  --center-font-size <n>   Center text font size (absolute or ratio, e.g., 44 or 0.11)
  --bottom-font-size <n>  Bottom text font size (absolute or ratio, e.g., 28 or 0.07)
  --output <path>       Output file path (default: stamp.svg)
  --no-star            Hide the star in center
  --no-inner-circle   Hide the inner thin circle

Example:
  pnpm start --center "北京科技有限公司" --bottom "110101" --output ./stamp.svg
  pnpm start --center "COMPANY LTD" --bottom "123456" --output ./stamp.svg
`);
  process.exit(0);
}

const parseArgs = () => {
  const result: Partial<StampOptions> = {
    size: 400,
    color: '#DC0000',
    borderWidth: 8,
    showStar: true,
    showInnerCircle: true,
    fontFamily: StampFontFamily.SimHei,
    centerFontSize: 44,
    bottomFontSize: 28,
  };
  let centerText = '';
  let bottomText = '';
  let outputPath = 'stamp.svg';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--center':
        centerText = next || '';
        i++;
        break;
      case '--bottom':
        bottomText = next || '';
        i++;
        break;
      case '--size':
        result.size = parseInt(next || '400', 10);
        i++;
        break;
      case '--color':
        result.color = (next || '#DC0000').startsWith('#') ? next : `#${next}`;
        i++;
        break;
      case '--border-width':
        result.borderWidth = parseInt(next || '8', 10);
        i++;
        break;
      case '--font':
        const fontName = next?.toLowerCase() || 'simhei';
        const fontMap: Record<string, StampFontFamily> = {
          'simhei': StampFontFamily.SimHei,
          'fangsong': StampFontFamily.FangSong,
          'kaiti': StampFontFamily.KaiTi,
          'simsun': StampFontFamily.SimSun,
          'microsoftyahei': StampFontFamily.MicrosoftYaHei,
        };
        result.fontFamily = fontMap[fontName] || StampFontFamily.SimHei;
        i++;
        break;
      case '--center-font-size':
        result.centerFontSize = parseFloat(next || '44');
        i++;
        break;
      case '--bottom-font-size':
        result.bottomFontSize = parseFloat(next || '28');
        i++;
        break;
      case '--output':
        outputPath = next || 'stamp.svg';
        i++;
        break;
      case '--no-star':
        result.showStar = false;
        break;
      case '--no-inner-circle':
        result.showInnerCircle = false;
        break;
    }
  }

  return { centerText, bottomText, outputPath, options: result };
};

if (args.length > 0) {
  const { centerText, bottomText, outputPath, options } = parseArgs();

  if (!centerText && !bottomText) {
    console.error('Error: Please provide --center or --bottom text');
    console.log('Run: pnpm start --help');
    process.exit(1);
  }

  const isPng = outputPath.toLowerCase().endsWith('.png');

  if (isPng) {
    try {
      const pngBuffer = await generateStampAsPng({
        ...options,
        centerText,
        bottomText,
      } as StampOptions);
      fs.writeFileSync(outputPath, pngBuffer);
      console.log(`Stamp saved to: ${outputPath}`);
    } catch (error) {
      console.error('Error generating PNG:', error);
      process.exit(1);
    }
  } else {
    const svgString = generateOfficialStamp(centerText, bottomText, options);
    saveSvg(svgString, outputPath);
    console.log(`Stamp saved to: ${outputPath}`);
  }
}
