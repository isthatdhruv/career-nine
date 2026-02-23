import axios from "axios";
const API_URL = "http://localhost:5000/translate";

export const translateQuestion = async (text: string, targetLanguage: string, sourceLanguage?: string) => {
  try {
    const response = await axios.post(`${API_URL}/question`, {
      question: text, // Changed from 'text' to 'question'
      targetLanguage,
      sourceLanguage
    });
    return response.data.translated;
  } catch (error) {
    console.error("Error translating question:", error);
    throw error;
  }
};

export const translateOption = async (text: string, targetLanguage: string, sourceLanguage?: string) => {
  try {
    const response = await axios.post(`${API_URL}/option`, {
      option: text, // Changed from 'text' to 'option'
      targetLanguage,
      sourceLanguage
    });
    console.log(response);
    return response.data.translated;
  } catch (error) {
    console.error("Error translating option:", error);
    throw error;
  }
};

export const translateAll = async (question: string, options: Array<string>, targetLanguage: string, sourceLanguage?: string) => {
  try {
    const response = await axios.post(`${API_URL}/all`, {
      question,
      options,
      targetLanguage,
      sourceLanguage
    });
    return response.data;
  } catch (error) {
    console.error("Error translating all:", error);
    throw error;
  }
};

const MATCH_API_URL = "http://localhost:5000/match";

export const matchTextToOption = async (textResponse: string, options: Array<{ optionId: number; optionText: string }>) => {
  try {
    const response = await axios.post(`${MATCH_API_URL}/option`, {
      textResponse,
      options
    });
    return response.data;
  } catch (error) {
    console.error("Error matching text to option:", error);
    throw error;
  }
};

export const matchTextToOptionsBulk = async (responses: Array<{ textResponse: string; options: Array<{ optionId: number; optionText: string }> }>) => {
  try {
    const response = await axios.post(`${MATCH_API_URL}/options-bulk`, {
      responses
    });
    return response.data;
  } catch (error) {
    console.error("Error bulk matching text to options:", error);
    throw error;
  }
};