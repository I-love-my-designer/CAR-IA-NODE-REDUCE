
import { GoogleGenAI } from "@google/genai";

const handleApiError = (error: any) => {
  if (error?.message?.includes("Requested entity was not found.")) {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      aistudio.openSelectKey();
    }
  }
};

// --- GEMINI SERVICE LOGIC ---
export const processLLM = async (prompt: string, systemInstruction?: string, images?: string[], negativePrompt?: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parts: any[] = [{ text: prompt }];
    
    if (images && images.length > 0) {
      images.forEach(img => {
        if (img) {
          const base64Data = img.split(',')[1] || img;
          const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
          parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        }
      });
    }

    const finalSystemInstruction = `
      ${systemInstruction || "You are a professional creative director and prompt engineer."}
      IMPORTANT - NEGATIVE CONSTRAINTS:
      The user has specified the following items to AVOID: ${negativePrompt || "None"}
      INTEGRATION RULE: Append "Negative prompt: ${negativePrompt || ""}" at the end.
    `.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { systemInstruction: finalSystemInstruction }
    });
    return response.text || "";
  } catch (error) {
    handleApiError(error);
    return "Erreur lors du traitement LLM";
  }
};

export const generateImage = async (
  prompt: string, 
  config: { aspectRatio?: string, customAspectRatio?: string, resolution?: string, model?: string, negative?: string, imageCount?: number, images?: { ref?: string[], original?: string[], style?: string[] } } = {}
): Promise<string[]> => {
  const { 
    aspectRatio = '1:1', 
    customAspectRatio, 
    resolution = '1K', 
    model = 'gemini-2.5-flash-image', 
    negative = '',
    imageCount = 1,
    images = {}
  } = config;
  
  const finalRatio = customAspectRatio || aspectRatio;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Prepare prompt with explicit labels for images if they exist
    let enrichedPrompt = prompt;
    const parts: any[] = [];
    let totalPayloadSize = 0;

    let logoCounter = 1;
    const addImagePart = (img: string, label: string) => {
      if (!img) return;
      const base64Data = img.split(',')[1] || img;
      const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
      totalPayloadSize += base64Data.length;
      
      const partLabel = label === 'original' ? `BACKGROUND_IMAGE` : `LOGO_IMAGE_${logoCounter++}`;
      parts.push({ text: `\n[${partLabel}]\n` });
      parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
    };

    if (images.original && images.original.length > 0) {
      images.original.forEach(img => addImagePart(img, 'original'));
    }

    if (images.ref && images.ref.length > 0) {
      images.ref.forEach(img => addImagePart(img, 'ref'));
    }

    if (images.style && images.style.length > 0) {
      images.style.forEach(img => addImagePart(img, 'style'));
    }

    console.log(`Image Generation Payload: ${parts.length / 2} images, ~${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB`);
    
    parts.push({ text: enrichedPrompt + (negative ? `\n\n[NEGATIVE PROMPT: ${negative}]` : "") });
    
    if (model.includes('imagen')) {
        const response = await ai.models.generateImages({
            model: model,
            prompt: negative ? `${prompt}\n\n[NEGATIVE PROMPT: ${negative}]` : prompt,
            config: { 
              numberOfImages: imageCount, 
              aspectRatio: finalRatio as any
            }
        });
        return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
    } else {
        const finalModel = model; 
        
        const imageConfig: any = { 
          aspectRatio: finalRatio
        };
        
        // Only include imageSize for models that support it (3.1 flash and 3.0 pro image previews)
        if (model.includes('preview')) {
          imageConfig.imageSize = resolution;
        }

        const genConfig: any = { 
          imageConfig,
          systemInstruction: "You are a professional creative assistant. Generate or edit images based on the user's prompt and provided images."
        };

        const tasks = Array.from({ length: imageCount }).map(() => 
          ai.models.generateContent({
            model: finalModel,
            contents: [{ role: "user", parts }],
            config: genConfig
          })
        );

        const results = await Promise.all(tasks);
        const generatedImages: string[] = [];
        for (const response of results) {
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) generatedImages.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
            }
          }
        }
        return generatedImages;
    }
  } catch (error) {
    handleApiError(error);
    return [];
  }
};
