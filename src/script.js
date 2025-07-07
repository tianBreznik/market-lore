const POLYMARKET_API = "https://api.thegraph.com/subgraphs/name/polymarket/polymarket";

const query = `{
  markets(first: 1000) {
  id
  question
  outcomes {
  id
  name
  price
}
}
}`;

async function fetchMarkets() {
  const response = await fetch(POLYMARKET_API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query })
});
  const data = await response.json();
  return data.data.markets;
}

function renderMarkets(markets) {
  const container = document.getElementById("markets");
  container.innerHTML = "";

  const filtered = markets.filter(m => m.question.toLowerCase().includes("civil war"));

  if (filtered.length === 0) {
  container.innerHTML = "<p>No relevant markets found.</p>";
  return;
}

  filtered.forEach(market => {
    const div = document.createElement("div");
    div.className = "market";

    const title = document.createElement("h2");
    title.textContent = market.question;
    div.appendChild(title);

    market.outcomes.forEach(outcome => {
    const outcomeP = document.createElement("p");
    outcomeP.className = "outcome";
    const percent = (parseFloat(outcome.price) * 100).toFixed(1);
    outcomeP.textContent = `${outcome.name}: ${percent}%`;
    div.appendChild(outcomeP);
});

  container.appendChild(div);
});
}

  // Run on page load
  fetchMarkets().then(renderMarkets).catch(err => {
  console.error("Error fetching data:", err);
  document.getElementById("markets").textContent = "Failed to load data.";
});
