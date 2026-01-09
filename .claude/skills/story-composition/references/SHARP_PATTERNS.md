# Sharp Library Patterns

Best practices for using Sharp in Instagram Story composition.

## Basic Patterns

### Load and Resize
```typescript
const resized = await sharp('input.png')
  .resize(756, 1344, { fit: 'contain' })
  .toBuffer();
```

### Composite Layers
```typescript
await sharp('background.png')
  .composite([
    { input: assetBuffer, top: 288, left: 162 }
  ])
  .toFile('output.png');
```

### Format Conversion
```typescript
// PNG to JPG
await sharp('input.png')
  .jpeg({ quality: 90 })
  .toFile('output.jpg');

// SVG to PNG
await sharp('icon.svg')
  .png()
  .toBuffer();
```

## Performance Optimization

### Reuse Pipelines
```typescript
const pipeline = sharp(inputBuffer);
const thumb = await pipeline.clone().resize(256).toBuffer();
const full = await pipeline.clone().toBuffer();
```

### Stream Processing
```typescript
fs.createReadStream('input.png')
  .pipe(sharp().resize(1080, 1920))
  .pipe(fs.createWriteStream('output.png'));
```

### Concurrent Processing
```typescript
import pLimit from 'p-limit';
const limit = pLimit(5);

await Promise.all(
  files.map(file =>
    limit(() => sharp(file).resize(100).toBuffer())
  )
);
```

## Error Handling

```typescript
try {
  await sharp('input.png').toBuffer();
} catch (error) {
  if (error.message.includes('Input file is missing')) {
    // File not found
  } else if (error.message.includes('unsupported')) {
    // Format not supported
  }
}
```

---

**Documentation**: [sharp.pixelplumbing.com](https://sharp.pixelplumbing.com)
