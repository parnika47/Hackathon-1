
require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

const properties = [
  {
    id: "17111691",
    name: "Pearl House III",
    address: "Jumeirah Village Circle, Dubai, UAE"
  },
  {
    id: "149775",
    name: "Jebel Ali Apartment",
    address: "Jebel Ali Industrial Area 1, Dubai, UAE"
  },
  {
    id: "171049972",
    name: "Continents Tower",
    address: "Jumeirah Village Circle, Dubai, UAE"
  }
];

const buildingFeatures = {
  pets: "Pets Allowed",
  pool: "Swimming Pool",
  gym: "Gym",
  spa: "Spa / Sauna",
  concierge: "Concierge",
  security: "Security",
  parking: "Private Parking"
};

const nearbyFeatures = {
  metro: ["Metro Stations", "public_transport.subway", 2500],
  tram: ["Tram Stations", "public_transport.tram", 2500],
  bus: ["Bus Stops", "public_transport", 1000],
  dogpark: ["Dog Parks", "leisure.park", 2000],
  vet: ["Veterinary Clinics", "healthcare.veterinary", 2500],
  university: ["Universities", "education.university", 3500],
  library: ["Libraries", "education.library", 2500],
  bar: ["Bars", "catering.bar", 1500],
  nightclub: ["Nightclubs", "entertainment", 2000],
  restaurant: ["Restaurants", "catering.restaurant", 1500],
  cafe: ["Cafes", "catering.cafe", 1500],
  mall: ["Shopping Malls", "commercial.shopping_mall", 3500],
  supermarket: ["Supermarkets", "commercial.supermarket", 1500],
  hospital: ["Hospitals", "healthcare.hospital", 3500],
  pharmacy: ["Pharmacies", "healthcare.pharmacy", 2500],
  clinic: ["Clinics", "healthcare.clinic_or_praxis", 2500]
};

function identifyProperty(link) {
  const parsed = new URL(link);

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Invalid URL protocol.");
  }

  const host = parsed.hostname.toLowerCase();

  if (![
    "bayut.com",
    "dubizzle.com",
    "propertyfinder.ae"
  ].some(domain =>
    host === domain || host.endsWith("." + domain)
  )) {
    throw new Error(
      "Please paste a Bayut, dubizzle or Property Finder URL."
    );
  }

  const known = properties.find(property =>
    parsed.pathname.includes(property.id)
  );

  if (known) return known;

  const slug = parsed.pathname.toLowerCase();

  const areas = [
    ["dubai-marina", "Dubai Marina"],
    ["jumeirah-village-circle", "Jumeirah Village Circle"],
    ["jvc", "Jumeirah Village Circle"],
    ["jebel-ali", "Jebel Ali"],
    ["business-bay", "Business Bay"],
    ["downtown-dubai", "Downtown Dubai"],
    ["dubai-hills", "Dubai Hills Estate"],
    ["palm-jumeirah", "Palm Jumeirah"],
    ["al-barsha", "Al Barsha"],
    ["jumeirah-lake-towers", "Jumeirah Lake Towers"]
  ];

  const area = areas.find(([key]) => slug.includes(key));

  return {
    name: area ? area[1] + " Property" : "Property Analysis",
    address: area ? area[1] + ", Dubai, UAE" : null
  };
}

async function geoRequest(endpoint, params) {
  if (!process.env.GEOAPIFY_API_KEY) {
    throw new Error("GEOAPIFY_API_KEY is missing.");
  }

  const url = new URL(
    "https://api.geoapify.com/" + endpoint
  );

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set(
    "apiKey",
    process.env.GEOAPIFY_API_KEY
  );

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const message = await response.text();
    console.error("Geoapify error:", response.status, message);
    throw new Error("Geoapify HTTP " + response.status);
  }

  return response.json();
}

async function findLocation(address) {
  const data = await geoRequest("v1/geocode/search", {
    text: address,
    filter: "countrycode:ae",
    limit: 1
  });

  const p = data.features?.[0]?.properties;

  if (!p) throw new Error("Location not found");

  return {
    lat: p.lat,
    lon: p.lon,
    label: p.formatted
  };
}

async function findPlaces(location, category, radius) {
  const data = await geoRequest("v2/places", {
    categories: category,
    filter:
      `circle:${location.lon},${location.lat},${radius}`,
    bias:
      `proximity:${location.lon},${location.lat}`,
    limit: 10
  });

  return data.features || [];
}

async function checkFeature(id, location) {
  if (buildingFeatures[id]) {
    return {
      name: buildingFeatures[id],
      status: "unknown",
      evidence: "Building facility not verified."
    };
  }

  const [name, category, radius] = nearbyFeatures[id];

  if (!location) {
    return {
      name,
      status: "unknown",
      evidence: "Location unavailable."
    };
  }

  try {
    const places = await findPlaces(location, category, radius);

    if (!places.length) {
      return {
        name,
        status: "unknown",
        evidence:
          `No mapped match found within ${radius} m.`
      };
    }

    const p = places[0].properties;
    const coords = places[0].geometry?.coordinates;

    if (!coords) {
      throw new Error("Missing place coordinates");
    }

    const placeName = p.name || p.address_line1 || name;

    const distance = Number.isFinite(p.distance)
      ? Math.round(p.distance)
      : null;

    return {
      name,
      status: "matched",
      evidence:
        placeName +
        (distance !== null
          ? ` — approximately ${distance} m away.`
          : ".") +
        (id === "metro"
          ? " Check the Red/Green Line on the map."
          : ""),
      evidenceUrl:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(`${coords[1]},${coords[0]}`)
    };

  } catch (error) {
    console.log("Feature error:", id, error.message);

    return {
      name,
      status: "unknown",
      evidence: "Nearby data unavailable for this feature."
    };
  }
}

async function generateSummary(property, results, matched, total) {
  const matches = results
    .filter(r => r.status === "matched")
    .map(r => r.name);

  const fallback =
    `${property.name} matches ${matched} of ${total} ` +
    `selected lifestyle features based on available mapped data. ` +
    (matches.length
      ? `Matches include ${matches.join(", ")}.`
      : "No selected features could be verified yet.");

  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + process.env.OPENAI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 180,
          messages: [
            {
              role: "system",
              content:
                "You are LiverFriendly AI. Summarize the " +
                "property lifestyle analysis in 70 words. " +
                "Only mention verified evidence. " +
                "Never invent nearby amenities or metro lines."
            },
            {
              role: "user",
              content: JSON.stringify({
                property: property.name,
                matched,
                total,
                results
              })
            }
          ]
        }),
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!response.ok) return fallback;

    const data = await response.json();

    return data.choices?.[0]?.message?.content || fallback;

  } catch {
    return fallback;
  }
}

app.post("/api/analyze", async (req, res) => {
  try {
    const { url, selected } = req.body || {};

    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "Please paste a property URL."
      });
    }

    const property = identifyProperty(url);

    if (!Array.isArray(selected) || !selected.length ||
        selected.length > 25 ||
        new Set(selected).size !== selected.length ||
        selected.some(id =>
          typeof id !== "string" ||
          !(id in buildingFeatures || id in nearbyFeatures)
        )) {
      return res.status(400).json({
        error: "Please select valid lifestyle features."
      });
    }

    let location = null;

    if (property.address) {
      try {
        location = await findLocation(property.address);
      } catch (error) {
        console.log("Location error:", error.message);
      }
    }

    const results = await Promise.all(
      selected.map(id => checkFeature(id, location))
    );

    const matched = results.filter(
      r => r.status === "matched"
    ).length;

    const unknown = results.filter(
      r => r.status === "unknown"
    ).length;

    const total = results.length;

    const summary = await generateSummary(
      property, results, matched, total
    );

    res.json({
      propertyName: property.name,
      location:
        location?.label ||
        property.address ||
        "Location not identified",
      matched,
      unknown,
      total,
      percentage: Math.round(matched / total * 100),
      features: results,
      summary,
      dataStatus: location
        ? "Nearby evidence from Geoapify. Location and distances are approximate."
        : "Location not verified. Match score is incomplete."
    });

  } catch (error) {
    console.error("FULL ERROR:", error);

    res.status(500).json({
      error: error.message || "Unknown server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `LiverFriendly running at http://localhost:${PORT}`
  );
});
