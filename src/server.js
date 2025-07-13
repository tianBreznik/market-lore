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

async function interpretCSVWithHuggingFace(csvContent) {
    try {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        
        if (!apiKey) {
            return 'No Hugging Face API key provided';
        }

        const client = new InferenceClient(apiKey);
        
        const prompt = `Based on this Polymarket prediction markets data, write an immersed engaging story about what's happening in the prediction markets world, 
        with some naivete about the severity of the impplications of the predictions about the state of the world. As if you are anxious about it and could easily believe conspiracy theories.

${csvContent}

Do not mention anything about your process or analysing the data, just output the story/essay/blog post.
Also output an "anxiety score" between 0 and 100, based on how scared or anxious your own extrapolations from the data make you feel.

Make it engaging and story-like, like an essay or an amateur blog post, opinionated and full of implications,not just a dry analysis.`;

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
        
        // Send CSV to Hugging Face for interpretation
        try {
            // const csvContent = rows.join('\n');
            // if (process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== 'hf_...') {
            //     const huggingFaceResponse = await interpretCSVWithHuggingFace(csvContent);
            //     console.log('Hugging Face interpretation:', huggingFaceResponse);
            // } else {
            //     console.log('Hugging Face analysis skipped - no valid API key provided');
            //     const basicStats = generateBasicStats(markets);
            //     console.log('Basic market analysis:', basicStats);
            // }
            console.log('Hugging Face analysis skipped (temporarily disabled for debugging).');
        } catch (huggingFaceErr) {
            console.error('Error calling Hugging Face:', huggingFaceErr);
            // const basicStats = generateBasicStats(markets);
            // console.log('Basic market analysis (fallback):', basicStats);
        }
    } catch (err) {
        console.error('Error generating CSV:', err);
    }
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

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

app.get("/api/hf-response", async (req, res) => {
    try {
        // Read the CSV file
        const csvContent = fs.readFileSync('markets.csv', 'utf8');
        // Try Hugging Face analysis (enabled)
        const response = await interpretCSVWithHuggingFace(csvContent);
        res.json({ response });
    } catch (err) {
        // Fallback: basic stats
        try {
            const csvContent = fs.readFileSync('markets.csv', 'utf8');
            const markets = [];
            const lines = csvContent.split('\n').slice(1); // skip header
            for (const line of lines) {
                const [id, question, start_date, end_date, volume, liquidity, outcomes_summary, closed] = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
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

// Run once on startup
fetchAndSaveMarketsCSV();
// Schedule to run every 24 hours
setInterval(fetchAndSaveMarketsCSV, 24 * 60 * 60 * 1000);

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
