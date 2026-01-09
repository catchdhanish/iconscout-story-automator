# Instagram Story Specifications

Complete technical specifications for Instagram Stories.

## Canvas Dimensions

- **Width**: 1080 pixels
- **Height**: 1920 pixels
- **Aspect Ratio**: 9:16 (portrait)
- **Minimum Resolution**: 1080x1920
- **Maximum Resolution**: 1920x3840 (for higher quality)
- **Recommended**: 1080x1920 for standard quality

## File Requirements

- **Format**: PNG (recommended), JPG, or WebP
- **Max File Size**: 30MB
- **Color Space**: sRGB
- **Bit Depth**: 8-bit per channel

## Safe Zones

### Top Safe Zone (250px)
- **Purpose**: Profile UI overlay
- **Content**: Profile picture, account name, timestamp, menu button
- **Percentage**: 13% of canvas height
- **Recommendation**: Avoid placing critical text or logos here

### Bottom Safe Zone (180px)
- **Purpose**: Interaction buttons
- **Content**: Reply button, share button, swipe-up indicator
- **Percentage**: 9% of canvas height
- **Recommendation**: Avoid placing critical CTAs here

### Asset Safe Zone (Center 70%)
- **Dimensions**: 756x1344 pixels
- **Position**: Centered at (162, 288)
- **Purpose**: Main content area safe from UI overlays
- **Percentage**: 70% of canvas in both dimensions

## Duration Limits

- **Image Stories**: Display for 5 seconds (user-controlled)
- **Video Stories**: Up to 60 seconds (auto-advances)

## Best Practices

1. Use 1080x1920 resolution for optimal quality
2. Keep important content within center 70%
3. Test on actual device to verify safe zones
4. Use PNG for images with transparency
5. Optimize file size for faster uploads

---

**Source**: Instagram Platform Guidelines
**Last Updated**: January 2026
