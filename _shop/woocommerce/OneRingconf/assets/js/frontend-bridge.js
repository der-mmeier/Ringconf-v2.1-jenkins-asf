(function () {
  "use strict";

  function runtime() {
    var runtimeElement = document.querySelector("script.asf-ringconf-runtime[type=\"application/json\"]");
    if (!runtimeElement || !runtimeElement.textContent) {
      return {};
    }

    try {
      return JSON.parse(runtimeElement.textContent);
    } catch (error) {
      dispatch("asf-ringconf:cart-error", {
        message: "invalid-runtime-json",
        error: error
      });
      return {};
    }
  }

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, {detail: detail || {}}));
  }

  function normalizePresetId(value) {
    if (typeof value !== "string") {
      return "";
    }
    var id = value.trim().toUpperCase();
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}(?:-\d+)?$/.test(id) ? id : "";
  }

  window.addEventListener("oneringconf:add-to-cart", function (event) {
    var presetId = normalizePresetId(event && event.detail ? event.detail.presetId : "");
    var config = runtime();
    var url = config.cartAddUrl || "";
    var nonce = config.restNonce || "";

    if (!presetId || !url) {
      dispatch("asf-ringconf:cart-error", {
        presetId: presetId,
        message: "missing-preset-or-endpoint"
      });
      return;
    }

    fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-WP-Nonce": nonce
      },
      body: JSON.stringify({presetId: presetId})
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          throw payload;
        }
        dispatch("asf-ringconf:cart-success", payload);
      });
    }).catch(function (error) {
      dispatch("asf-ringconf:cart-error", {
        presetId: presetId,
        error: error
      });
    });
  });
}());
