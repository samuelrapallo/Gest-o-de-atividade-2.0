
import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI client using the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  try {
    // Generate content using the multimodal capabilities of gemini-3-flash-preview.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/webm',
              data: base64Audio,
            },
          },
          {
            text: "Por favor, transcreva exatamente o que foi dito neste áudio de observação de tarefa. Retorne apenas o texto transcrito, sem comentários adicionais.",
          },
        ],
      },
    });

    // Access the .text property directly as per modern SDK standards.
    return response.text || "Não foi possível transcrever o áudio.";
  } catch (error) {
    console.error("Erro na transcrição via Gemini:", error);
    throw error;
  }
};

export const getSmartInstructions = async (context: string): Promise<string> => {
  try {
    // Use gemini-3-flash-preview for simple text instructions.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `O usuário está operando um sistema de gestão de tarefas executivas. Com base no contexto: "${context}", forneça instruções curtas e diretas de como proceder.`,
    });
    return response.text || "Siga o fluxo padrão de atualização de status.";
  } catch (error) {
    return "Consulte o manual de operações padrão.";
  }
};
