/* ==========================================================
   CV Page Script
   Implements heading animation, print download, skill animations,
   and motivational quote loading via AJAX.
   ========================================================== */

(function () {
  "use strict";

  /**
   * Animates a typing effect by appending characters one at a time to an element.
   * @param {HTMLElement} element    - Target element to type text into.
   * @param {string}      text       - Full string to type out character by character.
   * @param {number}      speed      - Delay in milliseconds between each character.
   * @param {Function}    [callback] - Optional function called when typing completes.
   */
  function typeText(element, text, speed, callback) {
    let index = 0;
    element.textContent = "";

    function tick() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index += 1;
        window.setTimeout(tick, speed);
      } else if (typeof callback === "function") {
        callback();
      }
    }

    tick();
  }

  /**
   * Reads data-text attributes from the CV hero heading and subtitle, then
   * chains two typeText() calls: name first at 45 ms/char, subtitle second
   * at 20 ms/char. Removes the blinking cursor class between sequences.
   */
  function startTypingSequence() {
    const nameNode = document.getElementById("cv-typing-name");
    const titleNode = document.getElementById("cv-typing-title");

    if (!nameNode || !titleNode) {
      return;
    }

    const fullName = nameNode.getAttribute("data-text") || "";
    const fullTitle = titleNode.getAttribute("data-text") || "";

    typeText(nameNode, fullName, 45, function () {
      nameNode.classList.remove("typing-cursor");
      typeText(titleNode, fullTitle, 20);
    });
  }

  /**
   * Sets up IntersectionObserver-driven animated width expansion for all
   * .skill-value progress bar elements. Each bar expands from 0% to its
   * data-skill-value when it scrolls into view. Falls back to immediate
   * width assignment on browsers without IntersectionObserver support.
   */
  function setupSkillAnimation() {
    const skillBars = document.querySelectorAll(".skill-value");
    if (skillBars.length === 0) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      skillBars.forEach(function (bar) {
        const value = bar.getAttribute("data-skill-value") || "0";
        bar.style.width = value + "%";
        bar.setAttribute("aria-valuenow", value);
      });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, currentObserver) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          const bar = entry.target;
          const value = bar.getAttribute("data-skill-value") || "0";
          bar.style.width = value + "%";
          bar.setAttribute("aria-valuenow", value);
          currentObserver.unobserve(bar);
        });
      },
      {
        threshold: 0.35,
      }
    );

    skillBars.forEach(function (bar) {
      bar.style.width = "0%";
      observer.observe(bar);
    });
  }

  /**
   * Fetches a random advice from the Advice Slip API and renders it as a
   * motivational quote. Validates the response shape before updating the DOM.
   * Silently hides the quote card if the request fails.
   */
  function loadMotivationalQuote() {
    const quoteNode = document.getElementById("motivation-quote");
    const authorNode = document.getElementById("motivation-author");

    if (!quoteNode || !authorNode) {
      return;
    }

    $.ajax({
      url: "https://api.adviceslip.com/advice",
      method: "GET",
      cache: false,
    })
      .done(function (response) {
        const isValid =
          response &&
          typeof response === "object" &&
          response.slip &&
          typeof response.slip.advice === "string";

        if (!isValid) {
          $(quoteNode).closest(".quote-box").hide();
          return;
        }

        quoteNode.textContent = '"' + response.slip.advice + '"';
        authorNode.textContent = "— Daily Wisdom";
      })
      .fail(function () {
        $(quoteNode).closest(".quote-box").hide();
      });
  }

  $(function () {
    // Keep footer copyright year current.
    $(".current-year").text(new Date().getFullYear());

    // Download CV PDF — no click handler needed, <a download> handles it natively.
    // (The #download-cv-btn is now an <a> tag with href/download attributes.)

    startTypingSequence();
    setupSkillAnimation();
    loadMotivationalQuote();
  });
})();
