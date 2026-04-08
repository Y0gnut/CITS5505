/* ==========================================================
   Tutorial Page Script
   Handles tutorial interactions and live CSS playground behavior.
   ========================================================== */

(function () {
  "use strict";

  /**
   * Writes the given CSS text into the injected playground style element so
   * rules are immediately applied to the live preview target element.
   * @param {string} cssText - Raw CSS text typed by the user.
   */
  function applyPlaygroundCss(cssText) {
    const styleElement = document.getElementById("css-playground-style");
    const statusElement = document.getElementById("css-playground-status");

    if (!styleElement || !statusElement) {
      return;
    }

    // Add !important to every declaration so playground CSS can override
    // the theme's !important rules (e.g. .page-content h4 colour override).
    const boostedCss = cssText.replace(
      /([a-zA-Z-]+)\s*:\s*([^;!{}]+?)\s*;/g,
      "$1: $2 !important;"
    );
    styleElement.textContent = boostedCss;
    statusElement.textContent = "Styles applied successfully.";
    statusElement.classList.remove("text-warning", "text-danger", "text-light-subtle");
    statusElement.classList.add("text-success");
  }

  /**
   * Checks that the CSS string has balanced curly braces. Updates the status
   * element with a warning message when an imbalance is detected.
   * @param {string} cssText - The CSS input string to validate.
   * @returns {boolean} True if braces are balanced, false otherwise.
   */
  function validateCssInput(cssText) {
    const statusElement = document.getElementById("css-playground-status");
    if (!statusElement) {
      return true;
    }

    const openCount = (cssText.match(/\{/g) || []).length;
    const closeCount = (cssText.match(/\}/g) || []).length;

    if (openCount !== closeCount) {
      statusElement.textContent = "Warning: unmatched curly braces detected.";
      statusElement.classList.remove("text-success", "text-danger", "text-light-subtle");
      statusElement.classList.add("text-warning");
      return false;
    }

    return true;
  }

  /**
   * Sets up IntersectionObserver-driven fade-and-slide reveal for all
   * .tutorial-block elements. Falls back to immediate full visibility on
   * browsers that do not support IntersectionObserver.
   */
  function setupScrollReveal() {
    const blocks = document.querySelectorAll(".tutorial-block");

    if (!("IntersectionObserver" in window) || blocks.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.15,
      }
    );

    blocks.forEach((block) => {
      block.classList.add("opacity-0");
      block.style.transform = "translateY(16px)";
      block.style.transition = "opacity 0.35s ease, transform 0.35s ease";
      observer.observe(block);
    });

    document.addEventListener("transitionend", function (event) {
      if (!event.target.classList.contains("tutorial-block")) {
        return;
      }

      if (event.target.classList.contains("is-visible")) {
        event.target.style.transform = "translateY(0)";
        event.target.classList.remove("opacity-0");
      }
    });
  }

  $(function () {
    // Keep footer year current.
    $(".current-year").text(new Date().getFullYear());

    // Initialize Prism highlighting when available.
    if (window.Prism && typeof window.Prism.highlightAll === "function") {
      window.Prism.highlightAll();
    }

    // Inject a dedicated style element for live playground updates.
    if (!document.getElementById("css-playground-style")) {
      const styleElement = document.createElement("style");
      styleElement.id = "css-playground-style";
      document.head.appendChild(styleElement);
    }

    const $cssInput = $("#css-playground-input");
    const statusElement = document.getElementById("css-playground-status");

    if ($cssInput.length > 0) {
      if (statusElement) {
        statusElement.textContent = "Type CSS rules to begin.";
        statusElement.classList.add("text-light-subtle");
      }

      const initialCss = $cssInput.val();
      if (typeof initialCss === "string") {
        applyPlaygroundCss(initialCss);
      }

      $cssInput.on("input", function () {
        const cssText = $(this).val();

        if (typeof cssText !== "string") {
          return;
        }

        const isValidShape = validateCssInput(cssText);
        if (!isValidShape) {
          return;
        }

        applyPlaygroundCss(cssText);
      });
    }

    // HTML live preview playground — sandboxed iframe prevents script execution
    var $htmlInput = $("#html-playground-input");
    var htmlFrame = document.getElementById("html-playground-preview");

    if ($htmlInput.length > 0 && htmlFrame) {
      function updateHtmlPreview(markup) {
        htmlFrame.srcdoc =
          "<!doctype html><html><head><style>" +
          "body{font-family:system-ui,sans-serif;padding:0.75rem;font-size:0.9rem;" +
          "color:#1a1a2e;line-height:1.6;margin:0;}a{color:#1a6fc4;}" +
          "h1,h2,h3,h4,h5,h6{margin:0.5rem 0;}p{margin:0.4rem 0;}" +
          "</style></head><body>" +
          markup +
          "</body></html>";
      }

      updateHtmlPreview($htmlInput.val());

      $htmlInput.on("input", function () {
        updateHtmlPreview($(this).val());
      });
    }

    setupScrollReveal();

    // Apply reveal state styles after observer setup.
    $(".tutorial-block").on("transitionend", function () {
      if ($(this).hasClass("is-visible")) {
        $(this).css({ opacity: 1, transform: "translateY(0)" });
      }
    });

    // Fallback reveal for browsers that do not support IntersectionObserver.
    if (!("IntersectionObserver" in window)) {
      $(".tutorial-block").css({ opacity: 1, transform: "translateY(0)" });
    }

    // Toggle visibility class on visible sections.
    const observerFallback = new MutationObserver(function () {
      document.querySelectorAll(".tutorial-block.is-visible").forEach((node) => {
        node.style.opacity = "1";
        node.style.transform = "translateY(0)";
      });
    });

    observerFallback.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  });
})();
