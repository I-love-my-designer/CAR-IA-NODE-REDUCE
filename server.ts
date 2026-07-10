import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Image URL proxy to bypass CORS
  app.get('/api/image-proxy', async (req, res) => {
    try {
      const { url: rawUrl } = req.query;
      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).send('URL is required');
      }
      
      let url = rawUrl.trim();
      
      // Recursively extract target url if there is a proxy nested inside
      let foundNested = true;
      let iterations = 0;
      while (foundNested && iterations < 5) {
        foundNested = false;
        if (url.includes('api/image-proxy')) {
          const index = url.indexOf('url=');
          if (index !== -1) {
            let extracted = url.substring(index + 4);
            try {
              const decoded = decodeURIComponent(extracted);
              url = decoded;
              foundNested = true;
            } catch (e) {
              url = extracted;
              foundNested = true;
            }
          } else {
            break;
          }
        }
        iterations++;
      }
      
      // Clean up trailing extension appends from regex errors
      if (url.includes('alt=media')) {
        url = url.replace(/alt=media\.[a-zA-Z0-9]+/g, 'alt=media');
        const matches = url.match(/^(https:\/\/firebasestorage\.googleapis\.com\/[^?]+)\?(alt=media).*?$/);
        if (matches) {
          url = `${matches[1]}?${matches[2]}`;
        }
      }
      
      // Safety check: only allow Google APIs / Firebase Storage URLs
      if (!url.startsWith('https://firebasestorage.googleapis.com/') && !url.startsWith('https://googleapis.com/')) {
        return res.status(403).send('Only Firebase Storage URL proxying is allowed');
      }

      console.log('--- Image Proxy Request ---');
      console.log('Proxying URL:', url);
      
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10s timeout
      });
      
      const contentType = response.headers['content-type'] || 'image/png';
      console.log('Proxy success! Content-Type:', contentType, 'Bytes:', response.data.length);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(response.data));
    } catch (e: any) {
      console.error('Proxy error for URL:', req.query.url);
      if (e.response) {
        console.error('Status:', e.response.status);
        console.error('Headers:', e.response.headers);
        const bodyText = Buffer.isBuffer(e.response.data) ? e.response.data.toString('utf8') : String(e.response.data);
        console.error('Body (first 500 chars):', bodyText.substring(0, 500));
        res.status(e.response.status).send(`Failed to fetch image: GCS/Firebase returned ${e.response.status} - ${bodyText.substring(0, 200)}`);
      } else {
        console.error('No response received:', e.message);
        res.status(500).send('Failed to fetch image: ' + e.message);
      }
    }
  });

  // Clipdrop Background Removal Proxy
  app.post('/api/remove-background', async (req, res) => {
    try {
      const { image } = req.body; // Expecting base64 or URL
      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const apiKey = process.env.CLIPDROP_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'CLIPDROP_API_KEY not configured' });
      }

      let imageBuffer: Buffer;

      if (image.startsWith('data:')) {
        const base64Data = image.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const response = await axios.get(image, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      }

      const formData = new FormData();
      formData.append('image_file', imageBuffer, { filename: 'image.png' });

      console.log('Calling Clipdrop API...');
      const clipdropResponse = await axios.post('https://clipdrop-api.co/remove-background/v1', formData, {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': apiKey,
        },
        responseType: 'arraybuffer',
      });

      const resultBase64 = Buffer.from(clipdropResponse.data).toString('base64');
      res.json({ result: `data:image/png;base64,${resultBase64}` });
    } catch (error: any) {
      console.error('Clipdrop API Error:', error.response?.data?.toString() || error.message);
      res.status(error.response?.status || 500).json({ 
        error: 'Failed to remove background via Clipdrop',
        details: error.response?.data?.toString() || error.message 
      });
    }
  });

  // Gemini Sublimation API for Image Composition
  app.post('/api/sublimation', async (req, res) => {
    try {
      const { imageA, imageB, imageC, rotation = 0 } = req.body;

      if (!imageA || !imageB || !imageC) {
        return res.status(400).json({ error: "Champs obligatoires manquants : imageA, imageB, ou imageC sont vides." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "La clé API Gemini n'est pas configurée sur le serveur. Veuillez l'ajouter dans Settings > Secrets." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const getCleanBase64 = (str: string): string => {
        if (!str) return '';
        if (str.startsWith('data:')) {
          const parts = str.split(';base64,');
          if (parts.length > 1) {
            return parts[1];
          }
        }
        return str;
      };

      const getMimeType = (str: string, defaultType: string = 'image/png'): string => {
        if (!str) return defaultType;
        if (str.startsWith('data:')) {
          const m = str.match(/data:([^;]+);/);
          if (m && m[1]) {
            return m[1];
          }
        }
        return defaultType;
      };

      const getBase64Image = async (str: string): Promise<{ data: string; mimeType: string }> => {
        if (!str) {
          throw new Error("L'image est vide");
        }

        let targetStr = str.trim();

        // If it's a proxy url, extract the real url
        if (targetStr.includes('api/image-proxy')) {
          try {
            let foundNested = true;
            let iterations = 0;
            while (foundNested && iterations < 5) {
              foundNested = false;
              if (targetStr.includes('api/image-proxy')) {
                const decoded = decodeURIComponent(targetStr);
                const index = decoded.indexOf('url=');
                if (index !== -1) {
                  targetStr = decoded.substring(index + 4);
                  foundNested = true;
                }
              }
              iterations++;
            }
            if (targetStr.includes('alt=media')) {
              targetStr = targetStr.replace(/alt=media\.[a-zA-Z0-9]+/g, 'alt=media');
              const matches = targetStr.match(/^(https:\/\/firebasestorage\.googleapis\.com\/[^?]+)\?(alt=media).*?$/);
              if (matches) {
                targetStr = `${matches[1]}?${matches[2]}`;
              }
            }
          } catch (e) {
            console.warn('[getBase64Image] Error parsing proxy URL, proceeding with original:', e);
          }
        }

        // If it is already a base64 Data URL or string data
        if (targetStr.startsWith('data:')) {
          const parts = targetStr.split(';base64,');
          const mType = getMimeType(targetStr);
          if (parts.length > 1) {
            return { data: parts[1], mimeType: mType };
          }
          return { data: targetStr, mimeType: mType };
        }

        // If it is a web URL, download it and convert to base64
        if (targetStr.startsWith('http://') || targetStr.startsWith('https://')) {
          console.log(`[getBase64Image] Downloading remote URL: ${targetStr}`);
          try {
            const response = await axios.get(targetStr, {
              responseType: 'arraybuffer',
              timeout: 15000 // 15 seconds
            });
            const buffer = Buffer.from(response.data);
            const base64 = buffer.toString('base64');
            const mimeType = response.headers['content-type'] || 'image/png';
            return { data: base64, mimeType };
          } catch (fetchErr: any) {
            console.error(`[getBase64Image] Failed to download URL ${targetStr}:`, fetchErr.message || fetchErr);
            throw new Error(`Erreur de téléchargement de l'image de décoration à l'adresse URL ${targetStr}: ${fetchErr.message}`);
          }
        }

        // If it starts with /
        if (targetStr.startsWith('/')) {
          const localUrl = `http://localhost:${PORT}${targetStr}`;
          console.log(`[getBase64Image] Fetching fallback local URL: ${localUrl}`);
          try {
            const response = await axios.get(localUrl, {
              responseType: 'arraybuffer',
              timeout: 10000
            });
            const buffer = Buffer.from(response.data);
            return { data: buffer.toString('base64'), mimeType: response.headers['content-type'] || 'image/png' };
          } catch (localErr: any) {
            console.error(`[getBase64Image] Failed to fetch local asset ${localUrl}:`, localErr.message);
            throw new Error(`Erreur de chargement local de l'image : ${targetStr}`);
          }
        }

        // If it is raw base64 string, clean it
        const cleanedStr = getCleanBase64(targetStr);
        const mType = getMimeType(targetStr);
        return { data: cleanedStr, mimeType: mType };
      };

      const resolvedA = await getBase64Image(imageA);
      const resolvedB = await getBase64Image(imageB);
      const resolvedC = await getBase64Image(imageC);

      const cleanA = resolvedA.data;
      const mimeA = resolvedA.mimeType;

      const cleanB = resolvedB.data;
      const mimeB = resolvedB.mimeType;

      const cleanC = resolvedC.data;
      const mimeC = resolvedC.mimeType;

      const promptText = `Fusionner de manière hyperréaliste le véhicule détouré (Image 2: Vehicle) sur le décor d'arrière-plan (Image 1: Background) en utilisant l'image de référence (Image 3: Composition) pour son emplacement exact et son angle de rotation de ${rotation} degrés. Tu dois recréer des ombres de contact très douces sous les pneus, harmoniser les reflets et les sources de lumière ambiantes sur la carrosserie pour qu'on ne distingue plus le montage.`;

      console.log('Calling Gemini (gemini-2.5-flash-image) for Sublimation...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: cleanA, mimeType: mimeA } },
            { inlineData: { data: cleanB, mimeType: mimeB } },
            { inlineData: { data: cleanC, mimeType: mimeC } },
            { text: promptText }
          ]
        }
      });

      let responseBase64 = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            responseBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (!responseBase64) {
        throw new Error("L'API Gemini n'a renvoyé aucune image compilée.");
      }

      console.log('Gemini Sublimation Success!');
      res.json({ imageFinal: responseBase64 });
    } catch (error: any) {
      console.error('Gemini Sublimation Error:', error.message || error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
