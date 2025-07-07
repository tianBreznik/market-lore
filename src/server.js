const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const path = require("path");
const { DeepSeek } = require('deepseek');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get("/api/markets", async (req, res) => {
    try {
        const url = "https://gamma-api.polymarket.com/markets?order=volume&ascending=false&active=true&limit=150&start_date_min=2025-01-01T00%3A00%3A00Z";
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
