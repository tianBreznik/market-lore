# MarketLore - GitHub Pages

This directory contains the static website files for MarketLore, deployed via GitHub Pages.

## 📊 Available Pages

### Main Dashboard
- **URL**: `https://tianbreznik.github.io/market-lore/marketlore.html`
- **Description**: Interactive dashboard showing real-time market data and AI predictions
- **Features**:
  - Current anxiety score display
  - Market statistics
  - Top markets by volume
  - System status indicators
  - Auto-refresh every 5 minutes

### System Status
- **URL**: `https://tianbreznik.github.io/market-lore/status.html`
- **Description**: System status page showing operational information
- **Features**:
  - Real-time system status
  - Auto-update schedule information
  - Quick links to related resources

## 🔄 How It Works

1. **Data Source**: The static site loads market data directly from the `markets.csv` file in the main repository
2. **Predictions**: Latest predictions are saved as JSON files in `src/predictions/` and accessed via GitHub's raw content URLs
3. **Auto-Update**: The automation scripts update both the data and generate new prediction files
4. **Static Hosting**: GitHub Pages serves the static HTML/CSS/JS files

## 📁 File Structure

```
docs/
├── index.html          # Your personal portfolio (existing)
├── marketlore.html     # MarketLore dashboard (new)
├── status.html         # System status page (new)
├── prediction-summary.json  # Latest prediction data (auto-generated)
└── README.md           # This file
```

## 🚀 Deployment

The site is automatically deployed when changes are pushed to the `main` branch. GitHub Pages serves files from the `docs/` directory.

### Manual Deployment Steps:
1. Ensure all files are in the `docs/` directory
2. Commit and push changes to the `main` branch
3. GitHub Pages will automatically rebuild and deploy

## 🔧 Configuration

### GitHub Pages Settings
- **Source**: Deploy from a branch
- **Branch**: `main`
- **Folder**: `/docs`
- **Custom domain**: Configured via `CNAME` file

### Auto-Update Integration
The automation scripts automatically:
- Save latest predictions to `src/predictions/latest.json`
- Generate status pages
- Update the static site data

## 📈 Features

### Real-time Data
- Market data from Polymarket API
- AI predictions from Hugging Face
- Auto-refreshing dashboard

### Responsive Design
- Mobile-friendly layout
- Modern gradient design
- Interactive elements

### Error Handling
- Fallback data when API is unavailable
- Graceful error messages
- Loading states

## 🔗 Links

- **Main Dashboard**: [marketlore.html](marketlore.html)
- **System Status**: [status.html](status.html)
- **GitHub Repository**: [market-lore](https://github.com/tianBreznik/market-lore)
- **Polymarket**: [polymarket.com](https://polymarket.com)

## 🛠️ Development

To modify the static site:

1. Edit the HTML files in the `docs/` directory
2. Test locally by opening the HTML files in a browser
3. Commit and push changes
4. GitHub Pages will automatically deploy the updates

### Local Testing
```bash
# Open the dashboard locally
open docs/marketlore.html

# Open the status page locally
open docs/status.html
```

## 📊 Data Flow

```
Polymarket API → Node.js Server → markets.csv → GitHub Pages
     ↓
Hugging Face AI → Predictions → JSON Files → Static Site
     ↓
Auto-Update Scripts → Commit/Push → GitHub Pages Deploy
```

The static site provides a public-facing interface for your MarketLore project while keeping the core automation and AI processing running on your local server. 