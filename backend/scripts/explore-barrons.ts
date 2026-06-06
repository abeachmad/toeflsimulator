/**
 * Explore Barron's TOEFL collection on Archive.org for more audio files
 */

import https from 'https';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

const collections = [
  {
    name: "Barron's TOEFL iBT 13th Edition (10 Audio CDs)",
    id: "barronstoeflibt10000phdp"
  },
  {
    name: "Barron's TOEFL iBT 2006-2007",
    id: "barronstoeflibti00shar"
  },
  {
    name: "Barron's Practice Exercises for TOEFL",
    id: "isbn_9780764145667"
  }
];

async function exploreCollection(collectionId: string, collectionName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Collection: ${collectionName}`);
  console.log(`ID: ${collectionId}`);
  console.log(`URL: https://archive.org/details/${collectionId}`);
  console.log('='.repeat(80));
  
  try {
    const metadataUrl = `https://archive.org/metadata/${collectionId}`;
    console.log(`Fetching metadata...\n`);
    
    const metadata = await fetchJson(metadataUrl);
    
    if (metadata.files) {
      // Filter for audio files
      const audioFiles = metadata.files.filter((f: any) => 
        f.name?.endsWith('.mp3') || 
        f.name?.endsWith('.m4a') || 
        f.name?.endsWith('.wav') ||
        f.name?.endsWith('.ogg') ||
        f.format === 'VBR MP3' ||
        f.format === 'MP3' ||
        f.format === 'Ogg Vorbis'
      );
      
      console.log(`Total files: ${metadata.files.length}`);
      console.log(`Audio files found: ${audioFiles.length}\n`);
      
      if (audioFiles.length > 0) {
        audioFiles.forEach((file: any, index: number) => {
          const sizeMB = (parseInt(file.size || '0') / 1024 / 1024).toFixed(2);
          console.log(`${index + 1}. ${file.name}`);
          console.log(`   Format: ${file.format || 'Unknown'}`);
          console.log(`   Size: ${sizeMB} MB`);
          console.log(`   URL: https://archive.org/download/${collectionId}/${encodeURIComponent(file.name)}`);
          console.log('');
        });
        
        // Generate download array
        console.log('\n--- Download Script Array ---\n');
        audioFiles.slice(0, 20).forEach((file: any, index: number) => {
          const filename = file.name
            .replace(/[^a-zA-Z0-9.-]/g, '-')
            .toLowerCase()
            .replace(/--+/g, '-');
          console.log(`  {`);
          console.log(`    url: 'https://archive.org/download/${collectionId}/${encodeURIComponent(file.name)}',`);
          console.log(`    filename: 'barrons-${index + 1}-${filename}'`);
          console.log(`  },`);
        });
      } else {
        console.log('No audio files found in this collection.\n');
      }
    } else {
      console.log('No files found in metadata\n');
    }
    
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}\n`);
  }
}

async function exploreAll() {
  console.log('\n🔍 Exploring Barrons TOEFL Collections on Archive.org\n');
  
  for (const collection of collections) {
    await exploreCollection(collection.id, collection.name);
  }
  
  console.log('\n='.repeat(80));
  console.log('Exploration complete!');
  console.log('='.repeat(80));
}

exploreAll().catch(console.error);
