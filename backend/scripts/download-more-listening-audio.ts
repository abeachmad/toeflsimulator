/**
 * Aggressive TOEFL Listening Audio Downloader
 * Downloads from multiple verified sources to get 50+ audio files
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIO_DIR = path.join(__dirname, '../uploads/audio');

// Ensure directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        if (res.headers.location) {
          downloadFile(res.headers.location, outputPath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(outputPath);
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
    
    request.setTimeout(120000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

// Comprehensive TOEFL Listening Audio Sources
// These URLs are from open-source educational materials and practice sites
const audioSources = [
  // Archive.org TOEFL-Listening Collection - Direct MP3 downloads
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%201.mp3',
    filename: 'archive-org-lecture-1.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%202.mp3',
    filename: 'archive-org-lecture-2.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%203.mp3',
    filename: 'archive-org-lecture-3.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%201.mp3',
    filename: 'archive-org-conversation-1.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%202.mp3',
    filename: 'archive-org-conversation-2.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%203.mp3',
    filename: 'archive-org-conversation-3.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%204.mp3',
    filename: 'archive-org-lecture-4.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%205.mp3',
    filename: 'archive-org-lecture-5.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%204.mp3',
    filename: 'archive-org-conversation-4.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%206.mp3',
    filename: 'archive-org-lecture-6.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%207.mp3',
    filename: 'archive-org-lecture-7.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%205.mp3',
    filename: 'archive-org-conversation-5.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%208.mp3',
    filename: 'archive-org-lecture-8.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%209.mp3',
    filename: 'archive-org-lecture-9.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%206.mp3',
    filename: 'archive-org-conversation-6.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%2010.mp3',
    filename: 'archive-org-lecture-10.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%2011.mp3',
    filename: 'archive-org-lecture-11.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%207.mp3',
    filename: 'archive-org-conversation-7.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Lecture%2012.mp3',
    filename: 'archive-org-lecture-12.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/TOEFL%20Listening%20-%20Conversation%208.mp3',
    filename: 'archive-org-conversation-8.mp3'
  },
  // TOEFL Resources - Listen and Repeat samples
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Campus-Library.mp3',
    filename: 'toefl-resources-campus-library.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Coffee-Shop.mp3',
    filename: 'toefl-resources-coffee-shop.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Post-Office.mp3',
    filename: 'toefl-resources-post-office.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Dining-Hall.mp3',
    filename: 'toefl-resources-dining-hall.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Art-Gallery.mp3',
    filename: 'toefl-resources-art-gallery.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Local-Bookstore.mp3',
    filename: 'toefl-resources-bookstore.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2025/07/ElevenLabs_Library_Tours-2.mp3',
    filename: 'toefl-resources-library-tours.mp3'
  },
  {
    url: 'https://www.toeflresources.com/wp-content/uploads/2023/11/Department-Store.mp3',
    filename: 'toefl-resources-department-store.mp3'
  },
  // TST Prep samples
  {
    url: 'https://tstprep.com/wp-content/uploads/2021/06/Sapir-Whorf-Hypothesis.mp3',
    filename: 'tstprep-sapir-whorf.mp3'
  },
  {
    url: 'https://tstprep.com/wp-content/uploads/2021/06/Biology-Lecture.mp3',
    filename: 'tstprep-biology-lecture.mp3'
  },
  {
    url: 'https://tstprep.com/wp-content/uploads/2021/06/Campus-Conversation.mp3',
    filename: 'tstprep-campus-conversation.mp3'
  },
  {
    url: 'https://tstprep.com/wp-content/uploads/2021/06/History-Lecture.mp3',
    filename: 'tstprep-history-lecture.mp3'
  },
];

async function downloadAll() {
  console.log(`Starting aggressive audio download...`);
  console.log(`Target: ${audioSources.length} audio files\n`);
  
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const source of audioSources) {
    const outputPath = path.join(AUDIO_DIR, source.filename);
    
    if (fs.existsSync(outputPath)) {
      console.log(`⏭  Skip: ${source.filename} (exists)`);
      skipped++;
      continue;
    }
    
    try {
      console.log(`⬇  Downloading: ${source.filename}...`);
      await downloadFile(source.url, outputPath);
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ Success: ${source.filename} (${sizeMB} MB)`);
      downloaded++;
    } catch (error) {
      console.log(`❌ Failed: ${source.filename} - ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }
  
  console.log(`\n=== DOWNLOAD COMPLETE ===`);
  console.log(`✅ Downloaded: ${downloaded} files`);
  console.log(`⏭  Skipped: ${skipped} files (already exist)`);
  console.log(`❌ Failed: ${failed} files`);
  console.log(`\n📁 Audio directory: ${AUDIO_DIR}`);
  console.log(`\n🚀 Next step: Run 'npm run ingest-audio' to process these files`);
}

downloadAll().catch(console.error);
