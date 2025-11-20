// public/js/logBird.js

document.addEventListener("DOMContentLoaded", () => {

  const identifyBtn = document.getElementById("identifyBtn");
  const surveyBtn = document.getElementById("surveySubmitBtn");

  // Your NEW list elements
  const speciesListBox = document.getElementById("speciesListBox");
  const speciesList = document.getElementById("speciesList");
  const birdInput = document.getElementById("bird");

  const loading = document.getElementById("loading");
  const birdResults = document.getElementById("birdResults");

  const colorSelect = document.getElementById("colorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const beakSelect = document.getElementById("beakSelect");

  const identifyModalEl = document.getElementById("identifyModal");
const modal = {
  show() {
    document.getElementById("identifyModal").style.display = "flex";
  },
  hide() {
    document.getElementById("identifyModal").style.display = "none";
  }
};
  const locationInput = document.getElementById("location");
  const latField = document.getElementById("latitude");
  const lngField = document.getElementById("longitude");

  const photoInput = document.getElementById("photo");
  const photoInvalid = document.getElementById("photoInvalid");

  // ======================================================
  // 1. LOAD SPECIES LIST INTO SCROLLABLE BOX
  // ======================================================
  async function loadSpeciesList() {
    try {
      const res = await fetch("/api/birds/species");
      const species = await res.json();

      speciesList.innerHTML = ""; // Clear loading text

      species.forEach(s => {
        const row = document.createElement("div");
        row.className = "p-2 border-bottom";
        row.style.cursor = "pointer";
        row.textContent = s.sciName
          ? `${s.comName} (${s.sciName})`
          : s.comName;

        // When clicked → fill hidden bird input
row.addEventListener("click", () => {
  birdInput.value = s.comName;
  document.getElementById("selectedBirdDisplay").textContent = s.comName;
});

        speciesList.appendChild(row);
      });

    } catch (err) {
      console.error("Failed loading species:", err);
      speciesList.innerHTML = `<p class="text-danger">Error loading species</p>`;
    }
  }
  loadSpeciesList();

  // ======================================================
  // 2. OPEN IDENTIFY MODAL
  // ======================================================
  if (identifyBtn && modal) {
    identifyBtn.addEventListener("click", () => modal.show());
  }

  // ======================================================
  // 3. GEMINI AI IDENTIFY BIRDS
  // ======================================================
  surveyBtn.addEventListener("click", async () => {
    loading.style.display = "block";
    birdResults.innerHTML = "";

    const color = colorSelect.value;
    const size = sizeSelect.value;
    const beak = beakSelect.value;
    const location = locationInput?.value || "";

    try {
      const res = await fetch("/api/ai-identify-bird", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color, size, beak, location })
      });

      const data = await res.json();
      loading.style.display = "none";

      if (data.error) {
        birdResults.innerHTML = `<p class="text-danger">AI failed to identify bird.</p>`;
        return;
      }

      // Gemini returns a string like “American Robin, Bald Eagle, …”
      const birds = data.birds || data.bird.split(",").map(b => b.trim());

// Show caption
document.getElementById("possibleBirdsHeader").style.display = "block";

// Create list items
birds.forEach(name => {
  const li = document.createElement("li");
  li.textContent = name;

  li.addEventListener("click", () => {
    birdInput.value = name;
    document.getElementById("identifyModal").style.display = "none"; // close modal
  });

  birdResults.appendChild(li);
});
    } catch (err) {
      loading.style.display = "none";
      console.error(err);
      birdResults.innerHTML = `<p class="text-danger">Failed to identify bird.</p>`;
    }
  });

  // ======================================================
  // 4. REQUIRED IMAGE VALIDATION
  // ======================================================
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      if (photoInput.files.length > 0) {
        photoInvalid.style.display = "none";
      }
    });
  }

  // ======================================================
  // 5. GEOCODE LOCATION → LAT/LNG
  // ======================================================
  if (locationInput) {
    locationInput.addEventListener("blur", async () => {
      const text = locationInput.value.trim();
      if (!text) return;

      try {
        const res = await fetch(`/api/geocode?text=${encodeURIComponent(text)}`);
        const data = await res.json();

        if (data.lat && data.lng) {
          latField.value = data.lat;
          lngField.value = data.lng;
        }

      } catch (err) {
        console.error("Geocode failed:", err);
      }
    });
  }

});