/**
 * Prisma Database Seed File
 *
 * Populates the database with sample assets and versions for testing.
 * Run with: npx prisma db seed
 */

import { PrismaClient, Status } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (optional - comment out if you want to preserve data)
  console.log('Clearing existing data...');
  await prisma.version.deleteMany();
  await prisma.asset.deleteMany();

  // Sample Asset 1: Business Card Template - Draft
  const asset1 = await prisma.asset.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      date: '2026-01-20',
      assetUrl: '/uploads/550e8400-e29b-41d4-a716-446655440001.png',
      metaDescription: 'Modern minimalist business card template with clean typography',
      status: Status.Draft,
      assetVisionDescription: 'A professional business card design featuring a minimalist layout with bold typography and subtle geometric elements',
      dominantColors: ['#2C3E50', '#ECF0F1', '#3498DB'],
      activeVersion: 1,
      textOverlayEnabled: true,
      versions: {
        create: [
          {
            version: 1,
            promptUsed: 'Create an Instagram Story background with abstract geometric shapes and a gradient from dark blue to light blue. Modern, clean design with center area clear for overlay.',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440001/background_v1.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440001/preview-v1.png',
            previewGeneratedAt: new Date('2026-01-20T10:30:00Z'),
            previewGenerationTimeMs: 1250,
            previewGenerationFailed: false,
          },
        ],
      },
    },
  });

  console.log(`✅ Created asset: ${asset1.metaDescription}`);

  // Sample Asset 2: Logo Design - Ready
  const asset2 = await prisma.asset.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      date: '2026-01-21',
      assetUrl: '/uploads/550e8400-e29b-41d4-a716-446655440002.png',
      metaDescription: 'Abstract geometric logo with vibrant gradient colors',
      status: Status.Ready,
      assetVisionDescription: 'A modern abstract logo featuring interlocking geometric shapes with a vibrant gradient from purple to orange',
      dominantColors: ['#9B59B6', '#E74C3C', '#F39C12'],
      activeVersion: 2,
      textOverlayContent: 'Get this exclusive premium asset for free (today only!) - link in bio',
      textOverlayEnabled: true,
      versions: {
        create: [
          {
            version: 1,
            promptUsed: 'Create an Instagram Story background with flowing organic shapes and warm gradient. Bold colors that complement purple and orange tones.',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440002/background_v1.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440002/preview-v1.png',
            previewGeneratedAt: new Date('2026-01-20T11:00:00Z'),
            previewGenerationTimeMs: 1420,
          },
          {
            version: 2,
            promptUsed: 'Create an Instagram Story background with abstract shapes and warm gradient from deep purple to vibrant orange. Modern, energetic design.',
            refinementPrompt: 'Make the gradient more vibrant and add subtle texture',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440002/background_v2.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440002/preview-v2.png',
            previewGeneratedAt: new Date('2026-01-20T11:15:00Z'),
            previewGenerationTimeMs: 1580,
          },
        ],
      },
    },
  });

  console.log(`✅ Created asset: ${asset2.metaDescription}`);

  // Sample Asset 3: Social Media Icon Set - Scheduled
  const asset3 = await prisma.asset.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      date: '2026-01-22',
      assetUrl: '/uploads/550e8400-e29b-41d4-a716-446655440003.png',
      metaDescription: 'Colorful social media icon set with flat design style',
      status: Status.Scheduled,
      assetVisionDescription: 'A collection of flat-design social media icons featuring Facebook, Instagram, Twitter, and LinkedIn with vibrant colors',
      dominantColors: ['#1877F2', '#E4405F', '#1DA1F2', '#0A66C2'],
      activeVersion: 1,
      blotatoPostId: 'blot_test_12345',
      scheduledTime: new Date('2026-01-22T14:00:00Z'),
      scheduledAt: new Date('2026-01-20T12:00:00Z'),
      textOverlayContent: 'Get this exclusive premium asset for free (today only!) - link in bio',
      textOverlayEnabled: true,
      textOverlayAnalytics: {
        position_tier_used: 1,
        shadow_type: 'dark',
        lines_count: 2,
        applied_at: '2026-01-20T12:00:00Z',
        render_time_ms: 45,
        brightness_samples: [180, 185, 190, 175, 182, 188, 192, 178, 184],
        avg_brightness: 183.7,
      },
      versions: {
        create: [
          {
            version: 1,
            promptUsed: 'Create an Instagram Story background with abstract digital patterns and bright primary colors. Tech-inspired design with clean center area.',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440003/story-v1.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440003/preview-v1.png',
            previewGeneratedAt: new Date('2026-01-20T11:45:00Z'),
            previewGenerationTimeMs: 1390,
            textOverlayApplied: true,
            textOverlayContent: 'Get this exclusive premium asset for free (today only!) - link in bio',
            textOverlayPosition: {
              tier: 1,
              y: 1560,
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Created asset: ${asset3.metaDescription}`);

  // Sample Asset 4: Illustration Pack - Published
  const asset4 = await prisma.asset.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      date: '2026-01-19',
      assetUrl: '/uploads/550e8400-e29b-41d4-a716-446655440004.png',
      metaDescription: 'Hand-drawn illustration pack with organic shapes and pastel colors',
      status: Status.Published,
      assetVisionDescription: 'A whimsical illustration collection featuring hand-drawn organic shapes, leaves, and abstract elements in soft pastel tones',
      dominantColors: ['#FFB6C1', '#98D8C8', '#F7DC6F'],
      activeVersion: 1,
      blotatoPostId: 'blot_published_67890',
      scheduledTime: new Date('2026-01-19T16:00:00Z'),
      scheduledAt: new Date('2026-01-19T10:00:00Z'),
      publishedAt: new Date('2026-01-19T16:00:05Z'),
      verifiedAt: new Date('2026-01-19T16:10:00Z'),
      textOverlayEnabled: true,
      versions: {
        create: [
          {
            version: 1,
            promptUsed: 'Create an Instagram Story background with soft organic shapes and pastel gradient. Dreamy, artistic design with gentle colors.',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440004/story-v1.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440004/preview-v1.png',
            previewGeneratedAt: new Date('2026-01-19T10:15:00Z'),
            previewGenerationTimeMs: 1520,
            textOverlayApplied: true,
            textOverlayPosition: {
              tier: 2,
              y: 1520,
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Created asset: ${asset4.metaDescription}`);

  // Sample Asset 5: Failed Asset (with error)
  const asset5 = await prisma.asset.create({
    data: {
      id: '550e8400-e29b-41d4-a716-446655440005',
      date: '2026-01-20',
      assetUrl: '/uploads/550e8400-e29b-41d4-a716-446655440005.png',
      metaDescription: 'Typography poster with bold headline and minimalist layout',
      status: Status.Failed,
      assetVisionDescription: 'A bold typography poster featuring large display text with minimalist black and white design',
      dominantColors: ['#000000', '#FFFFFF'],
      activeVersion: 1,
      error: {
        message: 'Failed to schedule post via Blotato API',
        details: 'Network timeout after 3 retry attempts. Blotato API returned 503 Service Unavailable.',
        failed_at: '2026-01-20T13:30:00Z',
        retry_count: 3,
      },
      versions: {
        create: [
          {
            version: 1,
            promptUsed: 'Create an Instagram Story background with stark contrast and bold geometric shapes. Monochromatic design with dramatic visual impact.',
            filePath: '/uploads/550e8400-e29b-41d4-a716-446655440005/background_v1.png',
            previewFilePath: '/uploads/550e8400-e29b-41d4-a716-446655440005/preview-v1.png',
            previewGeneratedAt: new Date('2026-01-20T13:00:00Z'),
            previewGenerationTimeMs: 1210,
          },
        ],
      },
    },
  });

  console.log(`✅ Created asset: ${asset5.metaDescription}`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nSummary:');
  console.log(`  - Total assets: 5`);
  console.log(`  - Draft: 1`);
  console.log(`  - Ready: 1`);
  console.log(`  - Scheduled: 1`);
  console.log(`  - Published: 1`);
  console.log(`  - Failed: 1`);
  console.log(`  - Total versions: 6\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
