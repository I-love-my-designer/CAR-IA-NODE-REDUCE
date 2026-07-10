

export const removeImageBackground = async (imageSrc: string): Promise<string> => {
  console.log("Starting background removal via Clipdrop proxy...");
  try {
    const response = await fetch('/api/remove-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageSrc }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Failed to remove background');
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("CRITICAL: Error removing background via Clipdrop:", error);
    throw error;
  }
};
