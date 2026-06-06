/**
 * Explore Archive.org TOEFL-Listening collection metadata
 * to find actual downloadable MP3 files
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

async function exploreArchiveOrg() {
  console.log('🔍 Exploring Archive.org TOEFL-Listening collection...\n');
  
  try {
    // Get metadata for the TOEFL-Listening collection
    const metadataUrl = 'https://archive.org/metadata/TOEFL-Listening';
    console.log(`Fetching metadata from: ${metadataUrl}\n`);
    
    const metadata = await fetchJson(metadataUrl);
    
    console.log('Collection Info:');
    console.log(`  Title: ${metadata.metadata?.title || 'N/A'}`);
    console.log(`  Identifier: ${metadata.metadata?.identifier || 'N/A'}`);
    console.log(`  Description: ${metadata.metadata?.description || 'N/A'}`);
    console.log('');
    
    if (metadata.files) {
      console.log(`Found ${metadata.files.length} files in collection:\n`);
      
      // Filter for audio files
      const audioFiles = metadata.files.filter((f: any) => 
        f.name?.endsWith('.mp3') || 
        f.name?.endsWith('.m4a') || 
        f.name?.endsWith('.wav') ||
        f.format === 'VBR MP3' ||
        f.format === 'MP3'
      );
      
      console.log(`Audio files found: ${audioFiles.length}\n`);
      
      audioFiles.forEach((file: any, index: number) => {
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   Format: ${file.format}`);
        console.log(`   Size: ${(parseInt(file.size || '0') / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   URL: https://archive.org/download/TOEFL-Listening/${encodeURIComponent(file.name)}`);
        console.log('');
      });
      
      // Generate TypeScript array for download script
      console.log('\n=== COPY THIS TO download-working-audio.ts ===\n');
      console.log('const audioSources = [');
      audioFiles.forEach((file: any, index: number) => {
        const filename = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        console.log(`  {`);
        console.log(`    url: 'https://archive.org/download/TOEFL-Listening/${encodeURIComponent(file.name)}',`);
        console.log(`    filename: 'archive-org-${index + 1}-${filename}'`);
        console.log(`  },`);
      });
      console.log('];');
      
    } else {
      console.log('❌ No files found in metadata');
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  }
}

exploreArchiveOrg().catch(console.error);
