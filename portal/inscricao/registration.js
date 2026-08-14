(() => {
  const config = window.PORTAL_GIRO_REGISTRATION_CONFIG ?? {};
  const loadingState = document.querySelector("#loading-state");
  const form = document.querySelector("#registration-form");
  const offerSelect = document.querySelector("#offer");
  const goalSelect = document.querySelector("#goal");
  const summary = document.querySelector("#selection-summary");
  const result = document.querySelector("#result");
  const submitButton = document.querySelector("#submit-button");
  const referral = document.querySelector("#referral");

  let catalog = [];

  const setNotice = (message, type = "") => {
    result.hidden = false;
    result.className = `notice ${type}`.trim();
    result.textContent = message;
  };

  const headers = () => ({
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.publishableKey}`,
    "Content-Type": "application/json",
  });

  const formatMoney = (value) =>
    Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const normalizePhone = (value) => {
    const digits = value.replace(/\D/g, "");
    const brazilian = digits.startsWith("55") ? digits : `55${digits}`;
    return `+${brazilian}`;
  };

  const groupedOffers = () => {
    const map = new Map();
    for (const item of catalog) {
      if (!map.has(item.offer_id)) map.set(item.offer_id, item);
    }
    return [...map.values()];
  };

  const goalsForOffer = (offerId) =>
    catalog
      .filter((item) => item.offer_id === offerId)
      .sort((a, b) => Number(a.display_order) - Number(b.display_order));

  const refreshSummary = () => {
    const offer = catalog.find((item) => item.offer_id === offerSelect.value);
    const goal = catalog.find(
      (item) =>
        item.offer_id === offerSelect.value && item.goal_id === goalSelect.value,
    );

    if (!offer || !goal) {
      summary.textContent = "Selecione uma opção e uma meta.";
      return;
    }

    summary.textContent = `${offer.challenge_name} · ${offer.offer_name} · ${goal.goal_label} · ${formatMoney(offer.price)}`;
  };

  const populateGoals = () => {
    goalSelect.innerHTML = "";
    const goals = goalsForOffer(offerSelect.value);
    for (const item of goals) {
      const option = document.createElement("option");
      option.value = item.goal_id;
      option.textContent = item.goal_label;
      goalSelect.append(option);
    }
    refreshSummary();
  };

  const populateOffers = () => {
    offerSelect.innerHTML = "";
    for (const item of groupedOffers()) {
      const option = document.createElement("option");
      option.value = item.offer_id;
      option.textContent = `${item.challenge_name} — ${item.offer_name} (${formatMoney(item.price)})`;
      offerSelect.append(option);
    }
    populateGoals();
  };

  const loadCatalog = async () => {
    if (!config.supabaseUrl || !config.publishableKey) {
      loadingState.textContent =
        "A página de inscrição ainda está sendo conectada ao ambiente do Portal Giro.";
      loadingState.classList.add("error");
      return;
    }

    try {
      const response = await fetch(
        `${config.supabaseUrl}/rest/v1/public_registration_catalog?select=*&order=reference_year.desc,reference_month.desc,display_order.asc`,
        { headers: headers() },
      );
      if (!response.ok) throw new Error("catalog");
      catalog = await response.json();

      if (!catalog.length) {
        loadingState.textContent =
          "Não há inscrições abertas neste momento. Consulte novamente mais tarde.";
        return;
      }

      populateOffers();
      loadingState.hidden = true;
      form.hidden = false;
    } catch {
      loadingState.textContent =
        "Não foi possível carregar as inscrições disponíveis agora.";
      loadingState.classList.add("error");
    }
  };

  offerSelect.addEventListener("change", populateGoals);
  goalSelect.addEventListener("change", refreshSummary);

  const refFromUrl = new URLSearchParams(window.location.search).get("ref");
  if (refFromUrl) referral.value = refFromUrl;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";

    const payload = {
      target_offer_id: offerSelect.value,
      target_goal_id: goalSelect.value,
      participant_full_name: document.querySelector("#full-name").value.trim(),
      participant_phone_e164: normalizePhone(
        document.querySelector("#phone").value,
      ),
      participant_city: document.querySelector("#city").value.trim(),
      participant_state_code: document
        .querySelector("#state")
        .value.trim()
        .toUpperCase(),
      target_referral_code: referral.value.trim() || null,
    };

    try {
      const response = await fetch(
        `${config.supabaseUrl}/rest/v1/rpc/submit_public_registration_request`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const duplicate = String(error.message ?? "").toLowerCase().includes("pendente");
        setNotice(
          duplicate
            ? "Já existe uma pré-inscrição pendente para este celular nesta opção."
            : "Não foi possível enviar sua pré-inscrição. Confira os dados e tente novamente.",
          "error",
        );
        return;
      }

      form.reset();
      if (refFromUrl) referral.value = refFromUrl;
      populateOffers();
      setNotice(
        "Pré-inscrição recebida. A organização continuará o atendimento para pagamento e confirmação da inscrição.",
        "success",
      );
    } catch {
      setNotice(
        "Não foi possível se comunicar com o Portal Giro agora. Tente novamente em alguns instantes.",
        "error",
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar pré-inscrição";
    }
  });

  void loadCatalog();
})();
