/* ==========================================================
   Page Transition Script
   Provides smooth fade + slide-up transitions when navigating
   between the four pages of the CITS5505 web application.

   Entry: The .page-content element animates in via the
          CSS slideUpFadeIn keyframe defined in style.css.

   Exit:  Internal link clicks trigger a dark overlay fade-in
          (via #page-transition-overlay), then navigate after
          the transition duration completes.

   Safety net: If navigation is cancelled by a beforeunload
          dialog (e.g. on the quiz page with unsaved answers),
          the overlay automatically fades back out so the user
          is never left looking at a permanently black screen.
   ========================================================== */

(function () {
  "use strict";

  /**
   * The full-viewport overlay element. Added as first child of <body>
   * in every HTML page; style.css keeps it opacity:0 by default.
   * @type {HTMLElement|null}
   */
  const overlay = document.getElementById("page-transition-overlay");

  /**
   * The main content wrapper (.page-content on <main>).
   * The CSS slideUpFadeIn animation plays once on page arrival.
   * Resetting the inline animation style forces it to replay
   * even when the browser returns to the page via the back button.
   * @type {HTMLElement|null}
   */
  const content = document.querySelector(".page-content");

  // ── Entrance animation reset ─────────────────────────────────────
  // Briefly suppress the CSS animation in the current frame and
  // re-enable it in the next frame, forcing the browser to restart
  // the keyframe from the beginning on every page arrival.
  if (content) {
    content.style.animation = "none";
    requestAnimationFrame(function () {
      content.style.animation = "";
    });
  }

  // ── Exit transition — intercept internal link navigation ─────────
  if (!overlay) {
    // Overlay element missing: skip transition setup and navigate normally.
    return;
  }

  /**
   * Duration in milliseconds that matches the CSS transition on
   * #page-transition-overlay (transition: opacity 0.35s ease).
   * Navigation fires after this delay so the curtain is fully opaque.
   * @type {number}
   */
  const TRANSITION_MS = 350;

  /**
   * How long after the attempted navigation to auto-dismiss the overlay
   * if the page did NOT actually navigate (e.g., beforeunload cancelled).
   * @type {number}
   */
  const SAFETY_NET_MS = 600;

  /**
   * Intercepts a click on an internal page link, fades the overlay to
   * opaque, then navigates after TRANSITION_MS. A safety-net timeout
   * removes the overlay in case navigation was cancelled (e.g. by a
   * beforeunload dialog on the quiz page).
   *
   * @param {MouseEvent} event - The click event on the anchor element.
   */
  function handleInternalLink(event) {
    // Middle-click / Ctrl+click / Cmd+click: open in new tab — skip transition.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {
      return;
    }

    event.preventDefault();

    const destination = this.getAttribute("href");

    // Show the exit curtain.
    overlay.classList.add("fade-in");

    // Navigate once the overlay has finished fading in.
    const navTimer = setTimeout(function () {
      window.location.href = destination;
    }, TRANSITION_MS);

    // Safety net: if beforeunload was triggered and the user chose to stay,
    // window.location.href assignment does nothing and the page stays put.
    // Clear the curtain after a short additional delay so the user isn't
    // trapped behind a dark overlay.
    setTimeout(function () {
      // If we're still on this page (navigation didn't happen), hide overlay.
      overlay.classList.remove("fade-in");
      // Also clear the navigation timer to prevent a delayed navigate.
      clearTimeout(navTimer);
    }, TRANSITION_MS + SAFETY_NET_MS);
  }

  // FIX 3: Attach the interceptor only to qualifying anchors that are NOT
  // inside the navbar/header. Navbar links must navigate instantly so the
  // user always has a reliable, zero-delay way to move between pages.
  document.querySelectorAll("a[href]").forEach(function (link) {
    // Skip any link that lives inside a nav, .navbar, or header element.
    if (link.closest("nav, .navbar, header")) { return; }

    const href = link.getAttribute("href");

    // Skip: missing href, external URLs, same-page anchors, mailto/tel links.
    if (!href) { return; }
    if (href.startsWith("http://") || href.startsWith("https://")) { return; }
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) { return; }

    // Only intercept links that target sister HTML pages or directory roots.
    if (!href.endsWith(".html") && !href.endsWith("/")) { return; }

    link.addEventListener("click", handleInternalLink);
  });
})();
