
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  updateDoc, 
  serverTimestamp,
  addDoc,
  deleteDoc,
  getDocFromServer,
  getDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { CompositingJob } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Compresses a base64 image (typically PNG) to an optimized JPEG format.
 * This reduces document size in Firestore by 90-95% while keeping high visual quality.
 */
export const compressBase64Image = (base64Str: string, maxW = 1200, maxH = 1200, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !base64Str || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous"; // Avoid CORS issues
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if exceeding max dimensions to keep quality but save space
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Force JPEG format to compress significantly (PNG is lossless and huge)
        const compressed = canvas.toDataURL('image/jpeg', quality);
        console.log(`[Compression] Image optimized from ${Math.round(base64Str.length / 1024)}KB to ${Math.round(compressed.length / 1024)}KB (${width}x${height}px)`);
        resolve(compressed);
      } catch (e) {
        console.error("[Compression] Error compressing image:", e);
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      console.warn("[Compression] Failed to load image for compression, keeping original.");
      resolve(base64Str);
    };
    img.src = base64Str;
  });
};

// Connectivity Test as per skill guidelines
export const testFirestoreConnection = async () => {
  try {
    console.log("Checking Firestore connection for database:", firebaseConfig.firestoreDatabaseId);
    // Try to get a non-existent doc to trigger a connection attempt
    await getDocFromServer(doc(db, '_internal_system_', 'health_check'));
    console.log("Firestore connection: OK");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore Error: The client is offline. Please check your network or Firebase configuration.");
    } else {
      console.error("Firestore Health Check Failed:", error);
    }
    return false;
  }
};

testFirestoreConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore [DEBUG] Error Info: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

export const unwrapImageProxy = (urlStr: string): string => {
  if (!urlStr) return '';
  let url = urlStr.trim();
  
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
  
  // Also clean up any trailing corrupted extension appending from regex errors on queries
  if (url.includes('alt=media')) {
    url = url.replace(/alt=media\.[a-zA-Z0-9]+/g, 'alt=media');
    // Normalize alt=media part
    const matches = url.match(/^(https:\/\/firebasestorage\.googleapis\.com\/[^?]+)\?(alt=media).*?$/);
    if (matches) {
      url = `${matches[1]}?${matches[2]}`;
    }
  }
  
  return url;
};

export const resolveBackgroundUrl = (bgId: string): string => {
  if (!bgId) return '';
  
  const bgIdClean = bgId.trim();
  
  const isWebUrlOrProxy = bgIdClean.startsWith('/') || 
                          bgIdClean.startsWith('http://') || 
                          bgIdClean.startsWith('https://') || 
                          bgIdClean.startsWith('data:') || 
                          bgIdClean.includes('api/image-proxy') ||
                          bgIdClean.includes('firebasestorage.googleapis.com');

  if (isWebUrlOrProxy) {
    const unwrapped = unwrapImageProxy(bgIdClean);
    if (unwrapped.startsWith('https://firebasestorage.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(unwrapped)}`;
    }
    return unwrapped;
  }
  
  const trimmed = bgIdClean;
  if (trimmed === 'Aucun' || trimmed === 'PWA_BG' || trimmed === 'TEST_BG') {
    return '';
  }
  
  let pathStr = trimmed;
  let bucket = "gen-lang-client-0870404092.firebasestorage.app";
  
  if (trimmed.startsWith('gs://')) {
    const sansGs = trimmed.substring(5);
    const firstSlash = sansGs.indexOf('/');
    if (firstSlash !== -1) {
      bucket = sansGs.substring(0, firstSlash);
      pathStr = sansGs.substring(firstSlash + 1);
    }
  } else if (trimmed.toLowerCase().startsWith('environments/')) {
    pathStr = trimmed;
  } else {
    let cleanName = trimmed;
    if (!cleanName.toLowerCase().endsWith('.jpg') && !cleanName.toLowerCase().endsWith('.png')) {
      cleanName += '.jpg';
    }
    pathStr = `ENVIRONMENTS/${cleanName}`;
  }

  // Auto-append extension to pathStr only if clean path has no suffix
  const cleanPathNoQuery = pathStr.split('?')[0];
  if (!/\.[a-zA-Z0-9]+$/.test(cleanPathNoQuery)) {
    pathStr = cleanPathNoQuery + '.jpg';
  }
  
  const encodedPath = encodeURIComponent(pathStr);
  const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
  return `/api/image-proxy?url=${encodeURIComponent(firebaseUrl)}`;
};

export const resolveLogoUrl = (logoIdStr: string): string => {
  if (!logoIdStr) return '';
  
  const logoIdClean = logoIdStr.trim();
  
  const isWebUrlOrProxy = logoIdClean.startsWith('/') || 
                          logoIdClean.startsWith('http://') || 
                          logoIdClean.startsWith('https://') || 
                          logoIdClean.startsWith('data:') || 
                          logoIdClean.includes('api/image-proxy') ||
                          logoIdClean.includes('firebasestorage.googleapis.com');

  if (isWebUrlOrProxy) {
    const unwrapped = unwrapImageProxy(logoIdClean);
    if (unwrapped.startsWith('https://firebasestorage.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(unwrapped)}`;
    }
    return unwrapped;
  }
  
  const trimmed = logoIdClean;
  let pathStr = trimmed;
  let bucket = "gen-lang-client-0870404092.firebasestorage.app";
  if (trimmed.startsWith('gs://')) {
    const sansGs = trimmed.substring(5);
    const firstSlash = sansGs.indexOf('/');
    if (firstSlash !== -1) {
      bucket = sansGs.substring(0, firstSlash);
      pathStr = sansGs.substring(firstSlash + 1);
    }
  }

  const cleanPathNoQuery = pathStr.split('?')[0];
  if (!/\.[a-zA-Z0-9]+$/.test(cleanPathNoQuery)) {
    pathStr = cleanPathNoQuery + '.png';
  }

  const encodedPath = encodeURIComponent(pathStr);
  const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
  return `/api/image-proxy?url=${encodeURIComponent(firebaseUrl)}`;
};

export const resolveLogoUrlAsync = async (logoIdStr: string): Promise<string> => {
  if (!logoIdStr) return '';
  
  const logoIdClean = logoIdStr.trim();
  
  const isWebUrlOrProxy = logoIdClean.startsWith('/') || 
                          logoIdClean.startsWith('http://') || 
                          logoIdClean.startsWith('https://') || 
                          logoIdClean.startsWith('data:') || 
                          logoIdClean.includes('api/image-proxy') ||
                          logoIdClean.includes('firebasestorage.googleapis.com');

  if (isWebUrlOrProxy) {
    const unwrapped = unwrapImageProxy(logoIdClean);
    if (unwrapped.startsWith('https://firebasestorage.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(unwrapped)}`;
    }
    return unwrapped;
  }
  
  const trimmed = logoIdClean;
  let pathStr = trimmed;
  let bucket = "gen-lang-client-0870404092.firebasestorage.app";
  if (trimmed.startsWith('gs://')) {
    const sansGs = trimmed.substring(5);
    const firstSlash = sansGs.indexOf('/');
    if (firstSlash !== -1) {
      bucket = sansGs.substring(0, firstSlash);
      pathStr = sansGs.substring(firstSlash + 1);
    }
  }

  const cleanPathNoQuery = pathStr.split('?')[0];
  if (!/\.[a-zA-Z0-9]+$/.test(cleanPathNoQuery)) {
    pathStr = cleanPathNoQuery + '.png';
  }

  try {
    const fileRef = ref(storage, pathStr);
    const downloadUrl = await getDownloadURL(fileRef);
    return `/api/image-proxy?url=${encodeURIComponent(downloadUrl)}`;
  } catch (error) {
    console.warn(`[resolveLogoUrlAsync] Firebase Storage token resolution failed for ${pathStr}, falling back to static URL:`, error);
    const encodedPath = encodeURIComponent(pathStr);
    const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    return `/api/image-proxy?url=${encodeURIComponent(firebaseUrl)}`;
  }
};

export const resolveBackgroundUrlAsync = async (bgId: string): Promise<string> => {
  if (!bgId) return '';
  
  const bgIdClean = bgId.trim();
  
  const isWebUrlOrProxy = bgIdClean.startsWith('/') || 
                          bgIdClean.startsWith('http://') || 
                          bgIdClean.startsWith('https://') || 
                          bgIdClean.startsWith('data:') || 
                          bgIdClean.includes('api/image-proxy') ||
                          bgIdClean.includes('firebasestorage.googleapis.com');

  if (isWebUrlOrProxy) {
    const unwrapped = unwrapImageProxy(bgIdClean);
    if (unwrapped.startsWith('https://firebasestorage.googleapis.com/')) {
      return `/api/image-proxy?url=${encodeURIComponent(unwrapped)}`;
    }
    return unwrapped;
  }
  
  const trimmed = bgIdClean;
  if (trimmed === 'Aucun' || trimmed === 'PWA_BG' || trimmed === 'TEST_BG') {
    return '';
  }
  
  let pathStr = trimmed;
  let bucket = "gen-lang-client-0870404092.firebasestorage.app";
  
  if (trimmed.startsWith('gs://')) {
    const sansGs = trimmed.substring(5);
    const firstSlash = sansGs.indexOf('/');
    if (firstSlash !== -1) {
      bucket = sansGs.substring(0, firstSlash);
      pathStr = sansGs.substring(firstSlash + 1);
    }
  } else if (trimmed.toLowerCase().startsWith('environments/')) {
    pathStr = trimmed;
  } else {
    let cleanName = trimmed;
    if (!cleanName.toLowerCase().endsWith('.jpg') && !cleanName.toLowerCase().endsWith('.png')) {
      cleanName += '.jpg';
    }
    pathStr = `ENVIRONMENTS/${cleanName}`;
  }

  const cleanPathNoQuery = pathStr.split('?')[0];
  if (!/\.[a-zA-Z0-9]+$/.test(cleanPathNoQuery)) {
    pathStr = cleanPathNoQuery + '.jpg';
  }

  try {
    const fileRef = ref(storage, pathStr);
    const downloadUrl = await getDownloadURL(fileRef);
    return `/api/image-proxy?url=${encodeURIComponent(downloadUrl)}`;
  } catch (error) {
    console.warn(`[resolveBackgroundUrlAsync] Firebase Storage token resolution failed for ${pathStr}, falling back to static URL:`, error);
    const encodedPath = encodeURIComponent(pathStr);
    const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
    return `/api/image-proxy?url=${encodeURIComponent(firebaseUrl)}`;
  }
};

export const subscribeToJobs = (callback: (jobs: CompositingJob[]) => void, onError?: (error: Error) => void) => {
  const path = 'exports';
  // Bounded to the 20 most recent jobs. Without a limit this read the ENTIRE
  // 'exports' collection on every load — a major source of Firestore read spikes.
  const jobsQuery = query(collection(db, path), orderBy('createdAt', 'desc'), limit(20));
  
  return onSnapshot(jobsQuery, (snapshot) => {
    const jobs = snapshot.docs.map(doc => {
      const data = doc.data();
      const rawBgId = data.backgroundId || '';
      const bgId = rawBgId ? rawBgId : (data.imageA ? 'PWA_BG' : 'Aucun');
      const imageA = data.imageA || (rawBgId ? resolveBackgroundUrl(rawBgId) : '');
      
      return {
        id: doc.id,
        status: data.status === 'failed' ? 'error' : (data.status || 'pending'),
        vehicleImage: data.imageB || '',
        backgroundId: bgId,
        roughComposite: data.imageC || '',
        rotation: data.rotation || 0,
        imageA: imageA,
        imageB: data.imageB || '',
        imageC: data.imageC || '',
        finalResult: data.imageFinal || '',
        
        // PWA custom layout properties
        vehicleScale: data.vehicleScale !== undefined ? Number(data.vehicleScale) : undefined,
        vehicleX: data.vehicleX !== undefined ? Number(data.vehicleX) : undefined,
        vehicleY: data.vehicleY !== undefined ? Number(data.vehicleY) : undefined,
        vehicleRotation: data.vehicleRotation !== undefined ? Number(data.vehicleRotation) : undefined,
        
        logo: data.logo !== undefined ? Boolean(data.logo) : undefined,
        logoId: data.logoId || '',
        logoSize: data.logoSize || '',
        logoPosition: data.logoPosition || '',
        logoColor: data.logoColor || '',
        
        text: data.text !== undefined ? Boolean(data.text) : undefined,
        textValue: data.textValue || '',
        textFontSize: data.textFontSize || '',
        textFontFamily: data.textFontFamily || '',
        textPosition: data.textPosition || '',
        textColor: data.textColor || '',
        fontWeight: data.fontWeight || '',

        createdAt: data.createdAt,
        updatedAt: data.updatedAt || data.createdAt,
      };
    }) as unknown as CompositingJob[];
    callback(jobs);
  }, (error) => {
    console.error("Firestore listen error for path:", path, error);
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    } else {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  });
};

export const updateJobStatus = async (jobId: string, status: CompositingJob['status'], extraData: Partial<CompositingJob> = {}) => {
  const path = `exports/${jobId}`;
  try {
    const jobRef = doc(db, 'exports', jobId);
    const mappedStatus = status === 'error' ? 'failed' : status;
    
    const updatePayload: any = {
      status: mappedStatus,
      updatedAt: serverTimestamp()
    };
    
    // Map finalResult to imageFinal to store the output of manual studio processing if needed
    if (extraData.finalResult) {
      // Compress the final output image to a beautiful JPEG (high resolution 1200px limit, visually flawless but drastically smaller)
      console.log("[updateJobStatus] Compressing final output image...");
      updatePayload.imageFinal = await compressBase64Image(extraData.finalResult, 1200, 1200, 0.85);
    }
    
    // To strictly guarantee that the document stays well within the 1,048,576 bytes limit:
    // When a job becomes completed or failed, we can retrieve the document and optimize (shrink) existing large source base64 images
    // e.g. converting imageA, imageB, imageC to small 400px thumbnails. They remain visually traceable but use 98% less database weight!
    if (mappedStatus === 'completed' || mappedStatus === 'failed') {
      try {
        const docSnap = await getDoc(jobRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          if (docData.imageA && docData.imageA.startsWith('data:image') && docData.imageA.length > 50000) {
            console.log("[updateJobStatus] Optimizing original background image in history...");
            updatePayload.imageA = await compressBase64Image(docData.imageA, 400, 400, 0.75);
          }
          if (docData.imageB && docData.imageB.startsWith('data:image') && docData.imageB.length > 50000) {
            console.log("[updateJobStatus] Optimizing original vehicle image in history...");
            updatePayload.imageB = await compressBase64Image(docData.imageB, 400, 400, 0.75);
          }
          if (docData.imageC && docData.imageC.startsWith('data:image') && docData.imageC.length > 50000) {
            console.log("[updateJobStatus] Optimizing original composite image in history...");
            updatePayload.imageC = await compressBase64Image(docData.imageC, 400, 400, 0.75);
          }
        }
      } catch (readError) {
        console.warn("[updateJobStatus] Could not optimize source images due to read error, skipping:", readError);
      }
    }
    
    await updateDoc(jobRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteJob = async (jobId: string) => {
  const path = `exports/${jobId}`;
  try {
    const jobRef = doc(db, 'exports', jobId);
    await deleteDoc(jobRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const createTestJob = async (data: Partial<CompositingJob>) => {
  const path = 'exports';
  try {
    await addDoc(collection(db, path), {
      status: 'pending',
      imageA: 'https://images.unsplash.com/photo-1542362567-b05200f90641?q=80&w=600',
      imageB: data.vehicleImage || 'https://images.unsplash.com/photo-1542362567-b05200f90641?q=80&w=200&auto=format&fit=crop',
      imageC: data.roughComposite || '',
      rotation: data.rotation || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};
