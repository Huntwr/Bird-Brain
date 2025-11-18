// public/js/logBird.js

document.addEventListener("DOMContentLoaded", () => {

  // ============================================================
  // Elements
  // ============================================================
  const identifyBtn = document.getElementById("identifyBtn");
  const surveyBtn = document.getElementById("surveySubmitBtn");
  const birdInput = document.getElementById("bird");
  const speciesSelect = document.getElementById("speciesSelect");

  const loading = document.getElementById("loading");
  const birdResults = document.getElementById("birdResults");

  const colorSelect = document.getElementById("colorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const beakSelect = document.getElementById("beakSelect");

  const identifyModalEl = document.getElementById("identifyModal");
  const modal = identifyModalEl ? new bootstrap.Modal(identifyModalEl) : null;

  const locationInput = document.getElementById("location");
  const latField = document.getElementById("latitude");
  const lngField = document.getElementById("longitude");

  const photoInput = document.getElementById("photo");
  const photoInvalid = document.getElementById("photoInvalid");

  // ============================================================
  // 1. Load species list
  // ============================================================
  async function loadSpeciesList() {
    try {
      const res = await fetch("/api/birds/species");
      const species = await res.json();

      speciesSelect.innerHTML = `<option value="">-- Select Species (optional) --</option>`;

      species.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.comName;
        opt.textContent = s.sciName ? `${s.comName} (${s.sciName})` : s.comName;
        speciesSelect.appendChild(opt);
      });

    } catch (err) {
      console.error("Failed loading species:", err);
      speciesSelect.innerHTML = `<option>Error loading species</option>`;
    }
  }

  loadSpeciesList();

  // ============================================================
  // 2. Species dropdown autofill
  // ============================================================
  speciesSelect.addEventListener("change", () => {
    if (speciesSelect.value) {
      birdInput.value = speciesSelect.value;
    }
  });

  // ============================================================
  // 3. Identify modal open
  // ============================================================
  if (identifyBtn && modal) {
    identifyBtn.addEventListener("click", () => modal.show());
  }

  // ============================================================
  // 4. Survey filter
  // ============================================================
  if (surveyBtn) {
    surveyBtn.addEventListener("click", async () => {
      loading.style.display = "block";
      birdResults.innerHTML = "";

      try {
        const res = await fetch("/api/birds/species");
        const birds = await res.json();

        const matches = filterBirds(birds);
        loading.style.display = "none";
        renderBirdList(matches);

      } catch (err) {
        loading.style.display = "none";
        alert("Failed to load bird list.");
        console.error(err);
      }
    });
  }

  function filterBirds(allBirds) {
    const color = colorSelect?.value.toLowerCase() || "";
    const size = sizeSelect?.value.toLowerCase() || "";
    const beak = beakSelect?.value.toLowerCase() || "";

    return allBirds.filter(bird => {
      const name = bird.comName.toLowerCase();
      if (color && !name.includes(color)) return false;
      if (size && !name.includes(size)) return false;
      if (beak && !name.includes(beak)) return false;
      return true;
    });
  }

  function renderBirdList(list) {
    birdResults.innerHTML = "";

    if (list.length === 0) {
      birdResults.innerHTML = `<p class="text-danger">No birds matched your description.</p>`;
      return;
    }

    list.forEach(bird => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";
      item.textContent = bird.comName;

      item.addEventListener("click", () => {
        birdInput.value = bird.comName;
        modal?.hide();
      });

      birdResults.appendChild(item);
    });
  }

  // ============================================================
  // 5. Required image validation
  // ============================================================
  if (photoInput) {
    photoInput.addEventListener("change", () => {
      if (photoInput.files.length > 0) {
        photoInvalid.style.display = "none";
      }
    });
  }

  // ============================================================
  // 6. Geocode location input
  // ============================================================
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
