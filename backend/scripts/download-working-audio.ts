/**
 * Download TOEFL Listening Audio from Verified Working Sources
 * Focus on confirmed working URLs only
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
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
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
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
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
    
    request.setTimeout(60000, () => {
      request.destroy();
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(new Error('Download timeout'));
    });
  });
}

// Archive.org TOEFL-Listening Collection - VERIFIED MP3 files
const audioSources = [
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F01.Exercise1516.mp3',
    filename: 'archive-org-exercise-1516.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F01.Exercise17.mp3',
    filename: 'archive-org-exercise-17.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F03.Exercise18.mp3',
    filename: 'archive-org-exercise-18.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F04.Exercise19.mp3',
    filename: 'archive-org-exercise-19.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F05.Exercise20.mp3',
    filename: 'archive-org-exercise-20.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F06.Exercise21.mp3',
    filename: 'archive-org-exercise-21.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F07.Exercise22.mp3',
    filename: 'archive-org-exercise-22.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F08.Exercise23.mp3',
    filename: 'archive-org-exercise-23.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F09.Exercise24.mp3',
    filename: 'archive-org-exercise-24.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F10.Exercise25.mp3',
    filename: 'archive-org-exercise-25.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F11.Exercise26.mp3',
    filename: 'archive-org-exercise-26.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F12.Exercise27.mp3',
    filename: 'archive-org-exercise-27.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F13.Exercise28.mp3',
    filename: 'archive-org-exercise-28.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F14.Exercise29.mp3',
    filename: 'archive-org-exercise-29.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%201.mp3',
    filename: 'archive-org-toefl-exercise-1.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%202.mp3',
    filename: 'archive-org-toefl-exercise-2.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%203.mp3',
    filename: 'archive-org-toefl-exercise-3.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%207.mp3',
    filename: 'archive-org-toefl-exercise-7.mp3'
  },
  {
    url: 'https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%20skill%20123.mp3',
    filename: 'archive-org-toefl-exercise-skill-123.mp3'
  },
];

async function downloadAll() {
  console.log(`Starting verified audio download...`);
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
    
    // Small delay between downloads to be polite
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n=== DOWNLOAD COMPLETE ===`);
  console.log(`✅ Downloaded: ${downloaded} files`);
  console.log(`⏭  Skipped: ${skipped} files (already exist)`);
  console.log(`❌ Failed: ${failed} files`);
  console.log(`\n📁 Audio directory: ${AUDIO_DIR}`);
  console.log(`\n🚀 Next step: Run 'npm run ingest-audio' to process these files`);
}

downloadAll().catch(console.error);
