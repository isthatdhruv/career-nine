const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000', // Your React app URL
  credentials: true
}));

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

// ============ AI OPTION MATCHING ENDPOINTS ============

// Match a single text response to the closest existing option
app.post('/match/option', async (req, res) => {
    try {
        const { textResponse, options } = req.body;

        if (!textResponse) {
            return res.status(400).json({ error: 'textResponse is required' });
        }
        if (!options || !Array.isArray(options) || options.length === 0) {
            return res.status(400).json({ error: 'options array is required and must not be empty' });
        }

        const optionTexts = options.map(o => `${o.optionId}: ${o.optionText}`).join('\n');

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a matching assistant. Given a student\'s text response and a list of predefined options (each with an ID and text), find the closest matching option. Return ONLY a JSON object with two fields: "optionId" (the ID number of the best match, or -1 if no reasonable match) and "reason" (a brief explanation in 10 words or less).'
                },
                {
                    role: 'user',
                    content: `Student response: "${textResponse}"\n\nAvailable options:\n${optionTexts}`
                }
            ],
            max_tokens: 100,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices[0].message.content.trim();
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            // Fallback: try to extract just the number
            const match = content.match(/-?\d+/);
            parsed = { optionId: match ? parseInt(match[0]) : -1, reason: 'Could not parse AI response' };
        }

        const matchedId = parsed.optionId;
        const matchedOption = options.find(o => o.optionId === matchedId);

        res.json({
            success: true,
            textResponse,
            matchedOptionId: matchedId !== -1 ? matchedId : null,
            matchedOptionText: matchedOption ? matchedOption.optionText : null,
            reason: parsed.reason || null
        });
    } catch (error) {
        console.error('Option Matching Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Matching failed', message: error.message });
    }
});

// Bulk match multiple text responses to options
app.post('/match/options-bulk', async (req, res) => {
    try {
        const { responses } = req.body;
        // responses = [{ textResponse, options: [{ optionId, optionText }] }, ...]

        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ error: 'responses array is required' });
        }

        const results = await Promise.all(
            responses.map(async (item) => {
                try {
                    const optionTexts = item.options.map(o => `${o.optionId}: ${o.optionText}`).join('\n');

                    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model: 'gpt-3.5-turbo',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a matching assistant. Given a student\'s text response and a list of predefined options (each with an ID and text), find the closest matching option. Return ONLY a JSON object with two fields: "optionId" (the ID number of the best match, or -1 if no reasonable match) and "reason" (a brief explanation in 10 words or less).'
                            },
                            {
                                role: 'user',
                                content: `Student response: "${item.textResponse}"\n\nAvailable options:\n${optionTexts}`
                            }
                        ],
                        max_tokens: 100,
                        temperature: 0.1
                    }, {
                        headers: {
                            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    const content = response.data.choices[0].message.content.trim();
                    let parsed;
                    try {
                        parsed = JSON.parse(content);
                    } catch {
                        const match = content.match(/-?\d+/);
                        parsed = { optionId: match ? parseInt(match[0]) : -1, reason: 'Could not parse AI response' };
                    }

                    const matchedId = parsed.optionId;
                    const matchedOption = item.options.find(o => o.optionId === matchedId);

                    return {
                        textResponse: item.textResponse,
                        matchedOptionId: matchedId !== -1 ? matchedId : null,
                        matchedOptionText: matchedOption ? matchedOption.optionText : null,
                        reason: parsed.reason || null
                    };
                } catch (err) {
                    return {
                        textResponse: item.textResponse,
                        matchedOptionId: null,
                        matchedOptionText: null,
                        reason: 'Error: ' + err.message
                    };
                }
            })
        );

        res.json({ success: true, results });
    } catch (error) {
        console.error('Bulk Matching Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Bulk matching failed', message: error.message });
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