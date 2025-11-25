// public/js/logBird.js

document.addEventListener("DOMContentLoaded", () => {

  const identifyBtn = document.getElementById("identifyBtn");
  const surveyBtn = document.getElementById("surveySubmitBtn");

  // Your NEW list elements
  const speciesListBox = document.getElementById("speciesListBox");
  const speciesList = document.getElementById("speciesList");
  const speciesSearch = document.getElementById("speciesSearch");
  const birdInput = document.getElementById("bird");
  
  // Store all species for filtering
  let allSpecies = [];

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
      allSpecies = await res.json();

      // Initial render of all species
      renderSpeciesList(allSpecies);

    } catch (err) {
      console.error("Failed loading species:", err);
      speciesList.innerHTML = `<p class="text-danger">Error loading species</p>`;
    }
  }

  // Render species list (with optional filter)
  function renderSpeciesList(speciesToShow) {
    speciesList.innerHTML = ""; // Clear existing

    if (speciesToShow.length === 0) {
      speciesList.innerHTML = `<p class="text-muted p-2">No birds found matching your search.</p>`;
      return;
    }

    speciesToShow.forEach(s => {
      const row = document.createElement("div");
      row.className = "species-item p-2 border-bottom";
      row.style.cursor = "pointer";
      row.style.transition = "background-color 0.2s";
      
      const displayText = s.sciName
        ? `${s.comName} (${s.sciName})`
        : s.comName;
      
      row.textContent = displayText;

      // Hover effect
      row.addEventListener("mouseenter", () => {
        row.style.backgroundColor = "#f0e6df";
      });
      row.addEventListener("mouseleave", () => {
        row.style.backgroundColor = "";
      });

      // When clicked → fill hidden bird input
      row.addEventListener("click", () => {
        birdInput.value = s.comName;
        document.getElementById("selectedBirdDisplay").textContent = s.comName;
        // Highlight selected
        document.querySelectorAll(".species-item").forEach(item => {
          item.style.backgroundColor = "";
          item.style.fontWeight = "";
        });
        row.style.backgroundColor = "#d7ccc8";
        row.style.fontWeight = "600";
      });

      speciesList.appendChild(row);
    });
  }

  // ======================================================
  // 1.5. SEARCH FUNCTIONALITY
  // ======================================================
  if (speciesSearch) {
    speciesSearch.addEventListener("input", (e) => {
      const searchTerm = e.target.value.trim().toLowerCase();
      
      if (searchTerm === "") {
        // Show all species if search is empty
        renderSpeciesList(allSpecies);
      } else {
        // Filter species by search term (searches both common and scientific names)
        const filtered = allSpecies.filter(s => {
          const comName = (s.comName || "").toLowerCase();
          const sciName = (s.sciName || "").toLowerCase();
          return comName.includes(searchTerm) || sciName.includes(searchTerm);
        });
        renderSpeciesList(filtered);
      }
    });
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
  const geocodeBtn = document.getElementById("geocodeBtn");
  const geocodeStatus = document.getElementById("geocodeStatus");
  const logBirdForm = document.querySelector('form[action="/log-bird"]');

  async function geocodeLocation() {
    const text = locationInput.value.trim();
    if (!text) {
      geocodeStatus.textContent = "Please enter a location first.";
      geocodeStatus.style.display = "block";
      geocodeStatus.className = "text-danger";
      return false;
    }

    geocodeStatus.textContent = "Looking up coordinates...";
    geocodeStatus.style.display = "block";
    geocodeStatus.className = "text-info";
    geocodeBtn.disabled = true;

    try {
      const res = await fetch(`/api/geocode?text=${encodeURIComponent(text)}`);
      const data = await res.json();

      // Check for errors in response
      if (data.error) {
        console.error("Geocode error:", data.error, data.details);
        geocodeStatus.textContent = data.error || "Could not find coordinates for this location. Try a more specific address.";
        geocodeStatus.className = "text-warning";
        return false;
      }

      // Check if we got valid coordinates
      if (data.lat && data.lng) {
        latField.value = data.lat;
        lngField.value = data.lng;
        const placeName = data.place_name ? ` (${data.place_name})` : '';
        geocodeStatus.textContent = `✓ Coordinates found: ${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}${placeName}`;
        geocodeStatus.className = "text-success";
        return true;
      } else {
        console.warn("Geocode response missing coordinates:", data);
        geocodeStatus.textContent = "Could not find coordinates for this location. Try a more specific address.";
        geocodeStatus.className = "text-warning";
        return false;
      }
    } catch (err) {
      console.error("Geocode failed:", err);
      geocodeStatus.textContent = "Error looking up coordinates. Please check your connection and try again.";
      geocodeStatus.className = "text-danger";
      return false;
    } finally {
      geocodeBtn.disabled = false;
    }
  }

  // Geocode on button click
  if (geocodeBtn) {
    geocodeBtn.addEventListener("click", geocodeLocation);
  }

  // Also geocode on blur (when user leaves the field)
  if (locationInput) {
    locationInput.addEventListener("blur", async () => {
      const text = locationInput.value.trim();
      if (!text || (latField.value && lngField.value)) return; // Skip if already has coordinates
      await geocodeLocation();
    });
  }

  // Validate coordinates before form submission
  if (logBirdForm) {
    logBirdForm.addEventListener("submit", async (e) => {
      const locationText = locationInput.value.trim();
      
      // If location is provided but no coordinates, try to geocode first
      if (locationText && (!latField.value || !lngField.value)) {
        e.preventDefault();
        const success = await geocodeLocation();
        
        if (success) {
          // Coordinates found, submit the form
          logBirdForm.submit();
        } else {
          // Ask user if they want to proceed without coordinates
          const proceed = confirm("Could not find coordinates for this location. The bird will be saved but won't appear on the map. Do you want to continue?");
          if (proceed) {
            logBirdForm.submit();
          }
        }
      }
    });
  }

});