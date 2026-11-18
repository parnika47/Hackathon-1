
const categories = {
  "🚇 Transport": {
    metro: "Metro Stations",
    tram: "Tram Stations",
    bus: "Bus Stops"
  },
  "🐾 Pet Friendly": {
    pets: "Pets Allowed",
    dogpark: "Dog Parks",
    vet: "Veterinary Clinics"
  },
  "🎓 Student Friendly": {
    university: "Universities",
    library: "Libraries"
  },
  "💎 Luxury": {
    pool: "Swimming Pool",
    gym: "Gym",
    spa: "Spa / Sauna",
    concierge: "Concierge",
    security: "Security",
    parking: "Private Parking"
  },
  "🌙 Nightlife": {
    bar: "Bars",
    nightclub: "Nightclubs"
  },
  "🍽️ Food & Dining": {
    restaurant: "Restaurants",
    cafe: "Cafes"
  },
  "🛍️ Shopping": {
    mall: "Shopping Malls",
    supermarket: "Supermarkets"
  },
  "🏥 Healthcare": {
    hospital: "Hospitals",
    pharmacy: "Pharmacies",
    clinic: "Clinics"
  }
};

const featureBox = document.getElementById("features");

for (const [category, options] of Object.entries(categories)) {
  const details = document.createElement("details");
  details.className = "category";

  const summary = document.createElement("summary");
  summary.textContent = category;

  const optionsBox = document.createElement("div");
  optionsBox.className = "options";

  for (const [id, name] of Object.entries(options)) {
    const label = document.createElement("label");
    const input = document.createElement("input");

    input.type = "checkbox";
    input.value = id;
    input.addEventListener("change", updateCount);

    label.append(input, " " + name);
    optionsBox.appendChild(label);
  }

  details.append(summary, optionsBox);
  featureBox.appendChild(details);
}

function selectedFeatures() {
  return [...document.querySelectorAll(".options input:checked")]
    .map(input => input.value);
}

function updateCount() {
  document.getElementById("selectedCount").textContent =
    selectedFeatures().length + " features selected";
}

document.getElementById("clear").onclick = () => {
  document.querySelectorAll(".options input").forEach(input => {
    input.checked = false;
  });
  updateCount();
};

document.getElementById("analyze").onclick = async () => {
  const url = document.getElementById("url").value.trim();
  const selected = selectedFeatures();
  const errorBox = document.getElementById("error");
  const button = document.getElementById("analyze");

  errorBox.textContent = "";

  if (!url) {
    errorBox.textContent = "Please paste a property URL.";
    return;
  }

  if (!selected.length) {
    errorBox.textContent = "Select at least one feature.";
    return;
  }

  button.disabled = true;
  button.textContent = "✨ Analyzing...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url, selected })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    document.getElementById("propertyName").textContent =
      data.propertyName;

    document.getElementById("propertyLocation").textContent =
      data.location;

    document.getElementById("score").textContent =
      `${data.matched}/${data.total}`;

    document.getElementById("scoreDetail").textContent =
      data.unknown === data.total
        ? "Insufficient verified data"
        : `${data.percentage}% matched`;

    document.getElementById("scoreNote").textContent =
      `${data.unknown} unverified feature(s)`;

    document.getElementById("summary").textContent =
      data.summary;

    document.getElementById("dataStatus").textContent =
      data.dataStatus;

    const breakdown = document.getElementById("breakdown");
    breakdown.replaceChildren();

    for (const feature of data.features) {
      const card = document.createElement("div");
      card.className = "result-item";

      const title = document.createElement("strong");
      title.textContent =
        (feature.status === "matched" ? "✅ " : "❔ ") +
        feature.name + " — " + feature.status;

      const evidence = document.createElement("p");
      evidence.textContent = feature.evidence;

      card.append(title, evidence);

      if (feature.evidenceUrl) {
        const link = document.createElement("a");
        link.href = feature.evidenceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "📍 View on Map / Evidence";
        card.appendChild(link);
      }

      breakdown.appendChild(card);
    }

    document.getElementById("results").classList.remove("hidden");

    document.getElementById("results").scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "✨ Analyze My Property";
  }
};
