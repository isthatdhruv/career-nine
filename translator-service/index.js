const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const cors = require('cors');
app.use(cors());

// Middleware to parse JSON
app.use(express.json());

// ChatGPT translation function
async function translateWithChatGPT(text, targetLanguage, sourceLanguage = 'English') {
    try {
        const prompt = `Translate the following text to ${targetLanguage} in a natural, human-readable way. Only return the translated text, no explanations , no boilerplate: Text: "${text}"`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a professional translator. Translate text naturally and maintain the original meaning and tone. When Translating in Hindi, use semi-formal to formal language and avoid slangs , also keep in mind to translate words that people generally use of urdu in hindi such as Important to avasyak in hindi , but generally it is used as zaruri '
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.3
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('ChatGPT Translation Error:', error.response?.data || error.message);
        throw new Error('Translation service unavailable');
    }
}

// Basic route
app.get('/', (req, res) => {
    res.send('Translator Service Backend is running!');
});

// Endpoint to translate a question
app.post('/translate/question', async (req, res) => {
    try {
        const { question, targetLanguage, sourceLanguage } = req.body;

        if (!question) {
            return res.status(400).json({
                error: 'Question text is required'
            });
        }

        if (!targetLanguage) {
            return res.status(400).json({
                error: 'Target language is required'
            });
        }

        const translatedQuestion = await translateWithChatGPT(
            question,
            targetLanguage,
            sourceLanguage
        );

        res.json({
            success: true,
            original: question,
            translated: translatedQuestion,
            targetLanguage,
            sourceLanguage: sourceLanguage || 'English'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Translation failed',
            message: error.message
        });
    }
});

// Endpoint to translate an option
app.post('/translate/option', async (req, res) => {
    try {
        const { option, targetLanguage, sourceLanguage } = req.body;

        if (!option) {
            return res.status(400).json({
                error: 'Option text is required'
            });
        }

        if (!targetLanguage) {
            return res.status(400).json({
                error: 'Target language is required'
            });
        }

        const translatedOption = await translateWithChatGPT(
            option,
            targetLanguage,
            sourceLanguage
        );

        res.json({
            success: true,
            original: option,
            translated: translatedOption,
            targetLanguage,
            sourceLanguage: sourceLanguage || 'English'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Translation failed',
            message: error.message
        });
    }
});

// Endpoint to translate all (question + options)
app.post('/translate/all', async (req, res) => {
    try {
        const { question, options, targetLanguage, sourceLanguage } = req.body;

        if (!question) {
            return res.status(400).json({
                error: 'Question text is required'
            });
        }

        if (!options || !Array.isArray(options)) {
            return res.status(400).json({
                error: 'Options array is required'
            });
        }

        if (!targetLanguage) {
            return res.status(400).json({
                error: 'Target language is required'
            });
        }

        // Translate question
        const translatedQuestion = await translateWithChatGPT(
            question,
            targetLanguage,
            sourceLanguage
        );

        // Translate all options
        const translatedOptions = await Promise.all(
            options.map(option => translateWithChatGPT(
                option,
                targetLanguage,
                sourceLanguage
            ))
        );

        res.json({
            success: true,
            original: {
                question,
                options
            },
            translated: {
                question: translatedQuestion,
                options: translatedOptions
            },
            targetLanguage,
            sourceLanguage: sourceLanguage || 'English'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Translation failed',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});