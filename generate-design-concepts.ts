import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'upload', 'design-concepts');

async function generateDesignConcepts() {
  const zai = await ZAI.create();

  const concepts = [
    {
      prompt: 'Modern dark mobile app UI for time management, dark background #0a0a0a, indigo purple accents #6366f1, clean minimal design, calendar interface with time slots, professional, high quality, screenshot style',
      size: '1344x768' as const,
      name: 'main-interface'
    },
    {
      prompt: 'Dark calendar app UI, week view time grid, dark background, indigo accents, modern minimalist, clean typography, professional time management app, high quality screenshot',
      size: '1344x768' as const,
      name: 'week-view'
    },
    {
      prompt: 'Mobile app time slot cards, dark theme, category icons (work, study, sport, leisure), gradient accents, modern card design, clean UI, high quality app screenshot',
      size: '1024x1024' as const,
      name: 'slot-cards'
    },
    {
      prompt: 'Dark mobile app dashboard, statistics cards with gradient progress bars, time analytics, indigo purple color scheme, modern minimalist design, high quality app interface',
      size: '1344x768' as const,
      name: 'statistics'
    },
    {
      prompt: 'Dark mobile app header, sticky navigation, blurred background, modern clean design, indigo purple brand colors, professional time management app, high quality screenshot',
      size: '1440x720' as const,
      name: 'header-navigation'
    }
  ];

  console.log('🎨 Generating design concepts...\n');

  for (let i = 0; i < concepts.length; i++) {
    try {
      const concept = concepts[i];
      console.log(`Generating ${i + 1}/${concepts.length}: ${concept.name}...`);

      const response = await zai.images.generations.create({
        prompt: concept.prompt,
        size: concept.size
      });

      const imageBase64 = response.data[0].base64;
      const buffer = Buffer.from(imageBase64, 'base64');

      const filename = `concept_${i + 1}_${concept.name}.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, buffer);

      console.log(`✅ Saved: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      console.error(`❌ Failed to generate concept ${i + 1}:`, error.message);
    }
  }

  console.log('\n✨ Design concepts generation complete!');
  console.log(`📁 Location: ${outputDir}`);
}

generateDesignConcepts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
