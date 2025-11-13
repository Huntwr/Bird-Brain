// added: JS for survey-based Identify Bird feature
document.addEventListener("DOMContentLoaded", () => {

  const identifyBtn = document.getElementById("identifyBtn");
  const surveyBtn = document.getElementById("surveySubmitBtn");
  const birdInput = document.getElementById("bird");

  const loading = document.getElementById("loading");
  const birdResults = document.getElementById("birdResults");

  const colorSelect = document.getElementById("colorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const beakSelect = document.getElementById("beakSelect");

  const modal = new bootstrap.Modal(document.getElementById("identifyModal"));

  // Open modal
  identifyBtn.addEventListener("click", () => {
    modal.show();
  });

  // Handle survey submission
  surveyBtn.addEventListener("click", async () => {

    loading.style.display = "block";
    birdResults.innerHTML = "";

    try {
      const res = await fetch("/api/bird-list");
      const birds = await res.json();   // full taxonomy list

      const matches = filterBirds(birds);

      loading.style.display = "none";
      renderBirdList(matches);

    } catch (err) {
      loading.style.display = "none";
      alert("Failed to load bird list.");
      console.error(err);
    }
  });

  // Filter logic
  function filterBirds(allBirds) {
    const color = colorSelect.value;
    const size = sizeSelect.value;
    const beak = beakSelect.value;

    return allBirds.filter(bird => {
      const name = bird.comName.toLowerCase();

      // very simple but works:
      if (color && !name.includes(color)) return false;
      if (size && !name.includes(size)) return false;
      if (beak && !name.includes(beak)) return false;

      return true;
    });
  }

  // Display results
  function renderBirdList(birds) {
    birdResults.innerHTML = "";

    if (birds.length === 0) {
      birdResults.innerHTML = `<p class="text-muted">No birds matched your description.</p>`;
      return;
    }

    birds.forEach(bird => {
      const item = document.createElement("button");
      item.className = "list-group-item list-group-item-action";
      item.textContent = bird.comName;

      item.addEventListener("click", () => {
        birdInput.value = bird.comName;
        modal.hide();
      });

      birdResults.appendChild(item);
    });
  }

});
