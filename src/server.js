const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const path = require("path");
const { DeepSeek } = require('deepseek');
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

// Run once on startup
fetchAndSaveMarketsCSV();
// Schedule to run every 24 hours
setInterval(fetchAndSaveMarketsCSV, 24 * 60 * 60 * 1000);

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
