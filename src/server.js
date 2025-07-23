require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const path = require("path");
const { InferenceClient } = require("@huggingface/inference");
const fs = require('fs');

// Helper to format outcome summary
function formatOutcomesSummary(market) {
    if (!Array.isArray(market.outcomes_array) || !Array.isArray(market.outcome_prices)) return '';
    return market.outcomes_array.map((name, i) => {
        const price = market.outcome_prices[i];
        const percent = price !== undefined ? (parseFloat(price) * 100).toFixed(1) + '%' : '?';
        return `${name}: ${percent}`;
    }).join(' | ');
}
console.log(process.env.HUGGINGFACE_API_KEY);
async function interpretCSVWithHuggingFace(prompt) {
    console.log("API key at call time:", process.env.HUGGINGFACE_API_KEY);
    try {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        console.log("blalbablalsba")
        
        if (!apiKey) {
            return 'No Hugging Face API key provided';
        }

        const client = new InferenceClient(apiKey);

        const chatCompletion = await client.chatCompletion({
            provider: "hf-inference",
            model: "HuggingFaceTB/SmolLM3-3B",
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        });

        console.log('Full API response:', JSON.stringify(chatCompletion, null, 2));
        
        if (chatCompletion.choices && chatCompletion.choices[0] && chatCompletion.choices[0].message) {
            return chatCompletion.choices[0].message.content;
        }
        
        return 'No response generated from API';
    } catch (error) {
        console.error('Hugging Face API error:', error);
        return `Error calling Hugging Face API: ${error.message}`;
    }
}

function generateBasicStats(markets) {
    if (!markets || markets.length === 0) {
        return "No markets data available for analysis.";
    }
    
    const totalMarkets = markets.length;
    const totalVolume = markets.reduce((sum, m) => sum + parseFloat(m.volume || 0), 0);
    const avgVolume = totalVolume / totalMarkets;
    
    const highestVolumeMarket = markets.reduce((max, m) => 
        parseFloat(m.volume || 0) > parseFloat(max.volume || 0) ? m : max, markets[0]);
    
    const yesNoMarkets = markets.filter(m => 
        m.outcomes_array && 
        m.outcomes_array.some(o => o.toLowerCase() === 'yes') &&
        m.outcomes_array.some(o => o.toLowerCase() === 'no')
    );
    
    const multiOutcomeMarkets = markets.filter(m => 
        m.outcomes_array && m.outcomes_array.length > 2
    );
    
    return `Market Analysis Summary:
- Total Markets: ${totalMarkets}
- Total Volume: $${totalVolume.toLocaleString()}
- Average Volume: $${avgVolume.toLocaleString()}
- Highest Volume Market: "${highestVolumeMarket.question}" ($${parseFloat(highestVolumeMarket.volume || 0).toLocaleString()})
- Yes/No Markets: ${yesNoMarkets.length}
- Multi-Outcome Markets: ${multiOutcomeMarkets.length}
- Date Range: ${markets[0]?.start_date} to ${markets[0]?.endDate}`;
}

async function fetchAndSaveMarketsCSV() {
    try {
        // Calculate date 14 days from now
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(fourteenDaysFromNow.getMonth() + 3);
        const endDateMax = fourteenDaysFromNow.toISOString().split('T')[0];
        // Calculate date 5 months before now
        const fiveMonthsAgo = new Date();
        fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 3);
        const startDateMin = fiveMonthsAgo.toISOString().split('T')[0];
        // Calculate date 1 month before now for end_date_min
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const endDateMin = oneMonthAgo.toISOString().split('T')[0];
        const url = `https://gamma-api.polymarket.com/markets?order=volume&ascending=false&active=true&closed=false&limit=150&volume_num_min=10000&liquidity_num_min=1000&end_date_max=${endDateMax}&start_date_min=${startDateMin}&end_date_min=${endDateMin}`;
        const response = await fetch(url);
        const markets = await response.json();
        if (!Array.isArray(markets)) return;
        markets.forEach(market => {
            try {
                market.outcome_prices = JSON.parse(market.outcomePrices);
            } catch (e) {
                market.outcome_prices = [];
            }
            try {
                market.outcomes_array = JSON.parse(market.outcomes);
            } catch (e) {
                market.outcomes_array = [];
            }
            market.start_date = market.startDate || market.startDateIso || '';
        });
        // CSV header
        const header = ['id','question','start_date','end_date','volume','liquidity','outcomes_summary','closed'];
        const rows = [header.join(',')];
        markets.forEach(market => {
            const row = [
                market.id,
                '"' + (market.question || '').replace(/"/g, '""') + '"',
                market.start_date,
                market.endDate || '',
                market.volume || '',
                market.liquidity || '',
                '"' + formatOutcomesSummary(market).replace(/"/g, '""') + '"',
                market.closed !== undefined ? market.closed : ''
            ];
            rows.push(row.join(','));
        });
        fs.writeFileSync('markets.csv', rows.join('\n'), 'utf8');
        console.log('markets.csv updated');

    } catch (err) {
        console.error('Error generating CSV:', err);
    }
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const PREDICTIONS_DIR = path.join(__dirname, 'predictions');
if (!fs.existsSync(PREDICTIONS_DIR)) {
    fs.mkdirSync(PREDICTIONS_DIR);
}

app.get("/api/markets", async (req, res) => {
    try {
        // Calculate date 14 days from now
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(fourteenDaysFromNow.getMonth() + 2);
        const endDateMax = fourteenDaysFromNow.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        
        // Calculate date 5 months before now
        const fiveMonthsAgo = new Date();
        fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
        const startDateMin = fiveMonthsAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD

        // Calculate date 1 month before now for end_date_min
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 2);
        const endDateMin = oneMonthAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD

        const url = `https://gamma-api.polymarket.com/markets?order=volume&ascending=false&active=true&closed=false&limit=150&volume_num_min=10000&liquidity_num_min=1000&end_date_max=${endDateMax}&start_date_min=${startDateMin}&end_date_min=${endDateMin}`;
        const response = await fetch(url);
        const markets = await response.json();
        console.log("Raw markets from API:", markets);
        console.log("Type of markets:", typeof markets);
        console.log("Is markets.markets defined?", markets.markets !== undefined);
        console.log("Is markets an array?", Array.isArray(markets));
        console.log("Is markets.markets an array?", Array.isArray(markets.markets));
        if (Array.isArray(markets)) {
            markets.forEach(market => {
                try {
                    market.outcome_prices = JSON.parse(market.outcomePrices);
                } catch (e) {
                    market.outcome_prices = [];
                }
                try {
                    market.outcomes_array = JSON.parse(market.outcomes);
                } catch (e) {
                    market.outcomes_array = [];
                }
                market.start_date = market.startDate || market.startDateIso || null;
            });
            // Filter to only markets with both 'Yes' and 'No' outcomes
            // const yesNoMarkets = markets.filter(market => {
            //     if (!Array.isArray(market.outcomes_array)) return false;
            //     const lowerOutcomes = market.outcomes_array.map(o => o && o.toLowerCase());
            //     return lowerOutcomes.includes('yes') && lowerOutcomes.includes('no');
            // });
            // res.json(yesNoMarkets);
            // return;
        }
        res.json(markets);
    } catch (err) {
        console.error("Error fetching markets:", err);
        res.status(500).json({ error: "Could not retrieve markets" });
    }
});

console.log("glbasd");
app.get("/api/hf-response", async (req, res) => {
    console.log("hf-response endpoint called", req.query);
    try {
        // Determine date to serve
        let dateStr = req.query.date;
        if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
        }
        const predictionPath = path.join(PREDICTIONS_DIR, `${dateStr}.json`);
        // If file exists, serve it
        if (fs.existsSync(predictionPath)) {
            const data = JSON.parse(fs.readFileSync(predictionPath, 'utf8'));
            return res.json(data);
        }
        // Otherwise, generate for today only
        if (dateStr !== new Date().toISOString().split('T')[0]) {
            return res.status(404).json({ error: 'No prediction for this date.' });
        }
        // Read the CSV file and truncate if necessary
        let csvContent = fs.readFileSync('markets.csv', 'utf8');
        console.log(`Original CSV content length: ${csvContent.length} characters`);
        
        // Truncate CSV content to stay within token limits
        // Estimate tokens: roughly 4 characters per token, so 60k tokens = ~240k characters
        const maxChars = 240000; // Conservative limit for 60k tokens
        if (csvContent.length > maxChars) {
            console.log(`CSV content too large (${csvContent.length} chars), truncating to ${maxChars} chars`);
            
            // Parse CSV to prioritize markets
            const lines = csvContent.split('\n');
            const header = lines[0];
            const dataLines = lines.slice(1).filter(line => line.trim());
            
            // Parse data lines to extract volume and date info
            const marketData = dataLines.map(line => {
                const parts = line.split(',');
                if (parts.length >= 6) {
                    const volume = parseFloat(parts[4]) || 0;
                    const endDate = parts[3];
                    const question = parts[1];
                    return { line, volume, endDate, question };
                }
                return { line, volume: 0, endDate: '', question: '' };
            });
            
            // Sort by volume (highest first) and recency
            marketData.sort((a, b) => {
                // First by volume (descending)
                if (b.volume !== a.volume) {
                    return b.volume - a.volume;
                }
                // Then by end date (most recent first)
                return new Date(b.endDate) - new Date(a.endDate);
            });
            
            // Calculate how many lines we can keep
            const headerLength = header.length + 1; // +1 for newline
            const availableChars = maxChars - headerLength;
            const avgLineLength = marketData.reduce((sum, item) => sum + item.line.length + 1, 0) / marketData.length;
            const maxLines = Math.floor(availableChars / avgLineLength);
            
            // Take the top N most relevant markets
            const topMarkets = marketData.slice(0, maxLines);
            const truncatedLines = topMarkets.map(item => item.line);
            csvContent = header + '\n' + truncatedLines.join('\n');
            
            console.log(`Truncated to ${maxLines} highest-volume markets (${csvContent.length} chars total)`);
            console.log(`Top markets by volume: ${topMarkets.slice(0, 3).map(item => `"${item.question.substring(0, 50)}..." ($${item.volume.toLocaleString()})`).join(', ')}`);
        } else {
            console.log(`CSV content within limits (${csvContent.length} chars), no truncation needed`);
        }

        // Find previous date's anxiety score (as a two-digit number)
        let previousAnxietyScore = null;
        try {
            const files = fs.readdirSync(PREDICTIONS_DIR)
                .filter(f => f.endsWith('.json'))
                .map(f => f.replace('.json', ''))
                .sort();
            const prevDate = files.filter(d => d < dateStr).pop();
            if (prevDate) {
                const prevData = JSON.parse(fs.readFileSync(path.join(PREDICTIONS_DIR, prevDate + '.json'), 'utf8'));
                let score = prevData.anxietyScore;
                if (typeof score === 'number' && !isNaN(score)) {
                    previousAnxietyScore = Math.round(score * 100);
                    if (previousAnxietyScore > 100) previousAnxietyScore = 100;
                    if (previousAnxietyScore < 0) previousAnxietyScore = 0;
                }
            }
        } catch (e) {
            console.log('Could not read previous anxiety score:', e);
        }

        // Build the prompt
        let previousScoreText = '';
        if (previousAnxietyScore !== null && !isNaN(previousAnxietyScore)) {
            previousScoreText = `The previous day's anxiety score was ${previousAnxietyScore}. `;
        }
        const prompt = `${previousScoreText}Based on this Polymarket prediction markets data, write an immersed engaging story about what's happening in the prediction markets world. 
        Approach this with a balanced, thoughtful perspective - like someone who's curious about market trends but maintains a calm, measured outlook on the world.

${csvContent}

Do not mention anything about your process or analysing the data, just output the story/essay/blog post.

IMPORTANT: Your anxiety score should reflect YOUR OWN emotional state based on how you interpret these predictions. Consider:
- If the previous day's anxiety was high (like 95), you should feel more calm and balanced, recognizing that markets often overreact
- If the previous day's anxiety was low (like 10), you should feel optimistic and confident about the future
- When interpreting predictions: look for positive developments, technological progress, and signs of human resilience
- Give less weight to negative interpretations - markets can be volatile and don't always reflect reality
- Focus on the bigger picture: humanity has faced challenges before and adapted
- Your anxiety score represents how calm and optimistic YOU feel after analyzing all this data

Remember: Be mellow and measured in your tone. Don't catastrophize or jump to worst-case scenarios. Look for silver linings and reasons for hope.

At the very end, on a new line, output exactly: Anxiety Score: XX% (where XX is your anxiety level between 0 and 100). Do not use any other phrasing for the anxiety score. Do not use any other words or sentences after the 'Anxiety Score: XX%' line. It must be the very last line.

Make it engaging and story-like, like an essay or an amateur blog post, but with a calm, thoughtful tone that balances curiosity with optimism.`;

        // Call Hugging Face with the prompt
        console.log("will call");
        const response = await interpretCSVWithHuggingFace(prompt);
        
        // Robust filtering function to remove thinking sections
        function filterThinkingSections(text) {
            let filtered = text;
            
            // Log original response for debugging
            console.log('Before filtering - response starts with:', filtered.substring(0, 100));
            console.log('Original response length:', filtered.length);
            
            // Pattern 1: Standard <think>...</think> tags
            const thinkPattern = /<think>[\s\S]*?<\/think>/gi;
            if (thinkPattern.test(filtered)) {
                console.log('Found <think>...</think> pattern');
                filtered = filtered.replace(thinkPattern, '');
            }
            
            // Pattern 2: Remove everything from start up to and including </think> (robust, case-insensitive)
            console.log('DEBUG: Checking for </think> tag...');
            console.log('DEBUG: Response contains </think>?', filtered.includes('</think>'));
            console.log('DEBUG: Response contains </THINK>?', filtered.includes('</THINK>'));
            
            const thinkEndMatch = filtered.toLowerCase().match(/<\/think\s*>/);
            console.log('DEBUG: thinkEndMatch result:', thinkEndMatch);
            
            if (thinkEndMatch) {
                const thinkEndIndex = filtered.toLowerCase().indexOf(thinkEndMatch[0]) + thinkEndMatch[0].length;
                console.log('DEBUG: thinkEndIndex:', thinkEndIndex);
                filtered = filtered.substring(thinkEndIndex).trim();
                console.log('Filtered out <think> section. New response starts:', filtered.substring(0, 100));
            } else {
                console.log('DEBUG: No </think> tag found in response');
            }
            
            // Pattern 3: Thinking sections with different formatting
            const thinkingPatterns = [
                /<thinking>[\s\S]*?<\/thinking>/gi,
                /<reasoning>[\s\S]*?<\/reasoning>/gi,
                /<analysis>[\s\S]*?<\/analysis>/gi,
                /<process>[\s\S]*?<\/process>/gi,
                /<plan>[\s\S]*?<\/plan>/gi,
                /<step>[\s\S]*?<\/step>/gi,
                /<thought>[\s\S]*?<\/thought>/gi
            ];
            
            thinkingPatterns.forEach((pattern, index) => {
                if (pattern.test(filtered)) {
                    console.log(`Found thinking pattern ${index + 1}`);
                    filtered = filtered.replace(pattern, '');
                }
            });
            
            // Pattern 4: Remove common prefixes that indicate thinking
            const thinkingPrefixes = [
                /^[\s]*Let me analyze[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*I'll start by[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*First, let me[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*Let me think[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*I need to[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*Based on the data[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi
            ];
            
            thinkingPrefixes.forEach((prefix, index) => {
                if (prefix.test(filtered)) {
                    console.log(`Found thinking prefix ${index + 1}`);
                    filtered = filtered.replace(prefix, '');
                }
            });
            
            // Pattern 5: Remove markdown formatting that might wrap thinking sections
            filtered = filtered.replace(/^\*\*.*?\*\*\s*/gm, '');
            filtered = filtered.replace(/^#+\s*.*?\n/gm, '');
            
            // Pattern 6: Remove any remaining thinking indicators at the start
            const thinkingStartIndicators = [
                /^[\s]*Thinking:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*Analysis:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*Process:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
                /^[\s]*Let me[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi
            ];
            
            thinkingStartIndicators.forEach((indicator, index) => {
                if (indicator.test(filtered)) {
                    console.log(`Found thinking indicator ${index + 1}`);
                    filtered = filtered.replace(indicator, '');
                }
            });
            
            // Clean up any extra whitespace
            filtered = filtered.trim();
            
            console.log('After filtering - filtered starts with:', filtered.substring(0, 100));
            console.log('Filtered response length:', filtered.length);
            
            return filtered;
        }
        
        // Apply robust filtering
        let filtered = filterThinkingSections(response);
        
        // Additional cleanup and logging
        console.log('Filtered response:', filtered);
        console.log('Contains "Anxiety Score:"?', filtered.includes('Anxiety Score:'));
        console.log('Contains "anxiety score:"?', filtered.includes('anxiety score:'));
        console.log('Contains "ANXIETY SCORE:"?', filtered.includes('ANXIETY SCORE:'));
        
        // Remove any remaining markdown formatting
        filtered = filtered.replace(/\*\*/g, '');
        // Extract anxiety score - find various patterns
        let anxietyScore = null;
        // Try 'Anxiety Score: <value>'
        let anxietyMatch = filtered.match(/Anxiety Score:\s*([\d.]+)(?:%|\/100)?/i);
        if (!anxietyMatch) {
            // Try 'anxiety score is <value>%'
            anxietyMatch = filtered.match(/anxiety score is\s*([\d.]+)%/i);
        }
        if (!anxietyMatch) {
            // Try 'anxiety score\s*([\d.]+)\/100'
            anxietyMatch = filtered.match(/anxiety score\s*([\d.]+)\/100/i);
        }
        if (!anxietyMatch) {
            // Try 'anxiety is\s*([\d.]+)%'
            anxietyMatch = filtered.match(/anxiety is\s*([\d.]+)%/i);
        }
        if (anxietyMatch) {
            let rawScore = anxietyMatch[1].trim();
            if (rawScore.includes('/')) {
                // Handle fractions like "98/100"
                const parts = rawScore.split('/');
                const numerator = parseFloat(parts[0]);
                const denominator = parseFloat(parts[1]);
                anxietyScore = numerator / denominator;
            } else if (rawScore.includes('%')) {
                // Handle percentages like "98%"
                const number = parseFloat(rawScore.replace('%', ''));
                anxietyScore = number / 100;
            } else {
                // Handle plain numbers
                anxietyScore = parseFloat(rawScore);
            }
            console.log('Converted anxiety score to float:', anxietyScore);
        } else {
            // Fallback: extract the last number between 0 and 100 in the text
            const allNumbers = Array.from(filtered.matchAll(/([0-9]{1,3}(?:\.[0-9]+)?)/g)).map(m => parseFloat(m[1])).filter(n => n >= 0 && n <= 100);
            if (allNumbers.length > 0) {
                anxietyScore = allNumbers[allNumbers.length - 1];
                console.log('Fallback: extracted last plausible anxiety score:', anxietyScore);
            } else {
                console.log('No anxiety score found in text');
            }
        }
        // Remove anxiety score line only (not everything after it)
        filtered = filtered.replace(/Anxiety Score: \d+(?:%|\/100)?\s*$/i, '');
        // Also remove any stray anxiety score mentions
        filtered = filtered.replace(/Anxiety Score:? ?\d+(?:%|\/100)?/gi, '');
        console.log('Final anxiety score:', anxietyScore);
        console.log('Final filtered response length:', filtered.length);
        // Save to file (filtered only)
        fs.writeFileSync(predictionPath, JSON.stringify({ response: filtered, anxietyScore, date: dateStr }), 'utf8');
        res.json({ response: filtered, anxietyScore, date: dateStr });
    } catch (err) {
        // Fallback: basic stats
        try {
            const csvContent = fs.readFileSync('markets.csv', 'utf8');
            const markets = [];
            const lines = csvContent.split('\n').slice(1); // skip header
            for (const line of lines) {
                const [id, question, start_date, end_date, volume, liquidity, outcomes_summary, closed] = line.split(/,(?=(?:[^"]*\"[^"]*\")*[^"]*$)/);
                if (!id) continue;
                markets.push({
                    id, question: question?.replace(/^"|"$/g, ''), start_date, end_date, volume, liquidity, outcomes_summary, closed
                });
            }
            const response = generateBasicStats(markets);
            res.json({ response });
        } catch (e) {
            res.json({ response: "No analysis available." });
        }
    }
});

// Endpoint to list available prediction dates
app.get("/api/hf-dates", (req, res) => {
    try {
        const files = fs.readdirSync(PREDICTIONS_DIR);
        const dates = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
            .sort();
        res.json({ dates });
    } catch (err) {
        res.status(500).json({ error: 'Could not list prediction dates.' });
    }
});

// Run once on startup
fetchAndSaveMarketsCSV();
// Schedule to run every 24 hours
setInterval(fetchAndSaveMarketsCSV, 24 * 60 * 60 * 1000);

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
