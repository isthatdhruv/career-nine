import axios from "axios";
const API_URL = "http://localhost:5000/translate";

export const translateQuestion = async (text: string, targetLanguage: string) => {
  try {
    const response = await axios.post(`${API_URL}/question`, {
      text,
      targetLanguage
    });
    return response.data.translated;
  } catch (error) {
    console.error("Error translating text:", error);
    throw error;
  }
};

export const translateOption = async (text: String, targetLanguage: string) => {
  try {
    
    const response = await axios.post(`${API_URL}/option`, {
      text,
      targetLanguage
    });
    console.log(response);
    return response.data.translated;
  } catch (error) {
    console.error("Error translating text:", error);
    throw error;
  }
};

export const translateAll = async (question: string, options: Array<string>, targetLanguage: string) => {
  try {
    const response = await axios.post(`${API_URL}/all`, {
      question,
      options,
      targetLanguage
    });
    return response.data;
  } catch (error) {
    console.error("Error translating all:", error);
    throw error;
  }
};