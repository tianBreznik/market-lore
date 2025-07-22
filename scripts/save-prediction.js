#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Save the latest prediction to a JSON file for the static website
 */
function savePredictionForStaticSite(predictionData) {
    try {
        // Create predictions directory if it doesn't exist
        const predictionsDir = path.join(__dirname, '..', 'src', 'predictions');
        if (!fs.existsSync(predictionsDir)) {
            fs.mkdirSync(predictionsDir, { recursive: true });
        }

        // Save latest prediction
        const latestPath = path.join(predictionsDir, 'latest.json');
        const latestData = {
            anxietyScore: predictionData.anxietyScore,
            date: predictionData.date,
            response: predictionData.response,
            timestamp: new Date().toISOString(),
            source: 'MarketLore AI'
        };

        fs.writeFileSync(latestPath, JSON.stringify(latestData, null, 2));
        console.log(`✅ Saved latest prediction to ${latestPath}`);

        // Also save with date for historical tracking
        const datePath = path.join(predictionsDir, `${predictionData.date}.json`);
        fs.writeFileSync(datePath, JSON.stringify(latestData, null, 2));
        console.log(`✅ Saved dated prediction to ${datePath}`);

        // Create a summary file for the static site
        const summaryPath = path.join(__dirname, '..', 'docs', 'prediction-summary.json');
        const summaryData = {
            latest: latestData,
            totalPredictions: fs.readdirSync(predictionsDir).filter(f => f.endsWith('.json')).length,
            lastUpdated: new Date().toISOString()
        };

        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        console.log(`✅ Saved prediction summary to ${summaryPath}`);

        return true;
    } catch (error) {
        console.error('❌ Error saving prediction for static site:', error);
        return false;
    }
}

/**
 * Generate a simple HTML status page for the static site
 */
function generateStatusPage() {
    try {
        const statusHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MarketLore Status</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 15px; border-radius: 5px; margin: 10px 0; }
        .online { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .offline { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .metric-label { font-weight: bold; }
        .metric-value { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 MarketLore System Status</h1>
        <p>Real-time status of the MarketLore AI prediction system</p>
        
        <div class="status online">
            <h3>🟢 System Online</h3>
            <p>MarketLore is currently running and processing market data</p>
        </div>

        <div class="metric">
            <span class="metric-label">Last Update:</span>
            <span class="metric-value" id="last-update">${new Date().toLocaleString()}</span>
        </div>
        
        <div class="metric">
            <span class="metric-label">Auto-Update Schedule:</span>
            <span class="metric-value">Daily at 9 AM, Hourly data fetch</span>
        </div>
        
        <div class="metric">
            <span class="metric-label">Data Source:</span>
            <span class="metric-value">Polymarket API</span>
        </div>
        
        <div class="metric">
            <span class="metric-label">AI Model:</span>
            <span class="metric-value">Hugging Face SmolLM3-3B</span>
        </div>
        
        <div class="metric">
            <span class="metric-label">GitHub Repository:</span>
            <span class="metric-value"><a href="https://github.com/tianBreznik/market-lore">market-lore</a></span>
        </div>

        <hr style="margin: 30px 0;">
        
        <h3>📈 Quick Links</h3>
        <ul>
            <li><a href="marketlore.html">📊 MarketLore Dashboard</a></li>
            <li><a href="https://github.com/tianBreznik/market-lore">🔗 GitHub Repository</a></li>
            <li><a href="https://polymarket.com">🎯 Polymarket</a></li>
        </ul>
    </div>

    <script>
        // Auto-refresh the last update time
        setInterval(() => {
            document.getElementById('last-update').textContent = new Date().toLocaleString();
        }, 60000); // Update every minute
    </script>
</body>
</html>`;

        const statusPath = path.join(__dirname, '..', 'docs', 'status.html');
        fs.writeFileSync(statusPath, statusHTML);
        console.log(`✅ Generated status page at ${statusPath}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error generating status page:', error);
        return false;
    }
}

// Export functions for use in other scripts
module.exports = {
    savePredictionForStaticSite,
    generateStatusPage
};

// If run directly, generate the status page
if (require.main === module) {
    generateStatusPage();
} 