/* ==========================================================
   Quiz Page Script
   Implements AJAX loading, dynamic rendering, validation,
   scoring, rewards API call, and localStorage attempt history.
   ========================================================== */

(function () {
  "use strict";

  const PASS_THRESHOLD = 50;
  const ATTEMPT_KEY = "quizAttempts";

  let questions = [];
  let hasStartedAnswering = false;
  let beforeUnloadAttached = false;

  const $loadingState = $("#quiz-loading-state");
  const $errorState = $("#quiz-error-state");
  const $quizForm = $("#quiz-form");
  const $questionsContainer = $("#questions-container");
  const $resultsPanel = $("#results-panel");
  const $resultsSummary = $("#results-summary");
  const $resultsStatus = $("#results-status");
  const $rewardPanel = $("#reward-panel");
  const $rewardText = $("#reward-text");
  const $historyPanel = $("#history-panel");
  const $historyTableBody = $("#history-table-body");
  const $clearHistoryBtn = $("#clear-history-btn");

  /**
   * Browser-native warning callback for accidental tab close/navigation.
   * Sets returnValue to an empty string to trigger the native browser leave dialog.
   * @param {BeforeUnloadEvent} event - The beforeunload event object.
   */
  function onBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  /**
   * Attaches the beforeunload warning listener exactly once using a boolean
   * flag to prevent duplicate registrations.
   */
  function attachBeforeUnload() {
    if (beforeUnloadAttached) {
      return;
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    beforeUnloadAttached = true;
  }

  /**
   * Removes the beforeunload warning listener after successful form submission.
   * No-op if the listener is not currently attached.
   */
  function detachBeforeUnload() {
    if (!beforeUnloadAttached) {
      return;
    }

    window.removeEventListener("beforeunload", onBeforeUnload);
    beforeUnloadAttached = false;
  }

  /**
   * Returns a new array with elements in randomized order using the
   * Fisher-Yates (Knuth) shuffle algorithm. Does not mutate the source.
   * @param {Array} source - The original array to shuffle.
   * @returns {Array} A shuffled copy of the source array.
   */
  function shuffleArray(source) {
    const array = source.slice();
    for (let index = array.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temp = array[index];
      array[index] = array[randomIndex];
      array[randomIndex] = temp;
    }
    return array;
  }

  /**
   * Validates that loaded JSON data is a non-empty array of correctly shaped
   * question objects, each with id, topic, question, options (4 items), and answer.
   * @param {*} data - The parsed JSON value to validate.
   * @returns {boolean} True only if data matches the expected schema.
   */
  function isValidQuestionData(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    return data.every(function (item) {
      return (
        typeof item.category === "string" &&
        typeof item.question === "string" &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        typeof item.answer === "string"
      );
    });
  }

  /**
   * Builds and inserts all question card elements into the DOM using
   * createElement/appendChild only — no innerHTML or template strings.
   */
  function renderQuestions() {
    $questionsContainer.empty();

    questions.forEach(function (question, index) {
      const wrapper = document.createElement("article");
      wrapper.className = "quiz-question p-3 rounded border border-secondary-subtle";
      wrapper.setAttribute("data-question-index", String(index));

      const headerRow = document.createElement("div");
      headerRow.className = "d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2";

      const numberText = document.createElement("p");
      numberText.className = "mb-0 fw-semibold";
      numberText.textContent = "Question " + (index + 1);

      const topicBadge = document.createElement("span");
      topicBadge.className = "badge text-bg-warning";
      topicBadge.textContent = question.category;

      headerRow.appendChild(numberText);
      headerRow.appendChild(topicBadge);

      const questionText = document.createElement("h2");
      questionText.className = "h5 mb-3";
      questionText.textContent = question.question;

      const optionsGroup = document.createElement("div");
      optionsGroup.className = "vstack gap-2";

      question.options.forEach(function (optionText, optionIndex) {
        const optionId = "q" + index + "_opt" + optionIndex;
        const label = document.createElement("label");
        label.className = "quiz-option p-2 rounded border border-secondary-subtle d-flex align-items-start gap-2";
        label.setAttribute("for", optionId);

        const input = document.createElement("input");
        input.type = "radio";
        input.className = "form-check-input mt-1";
        input.name = "question-" + index;
        input.id = optionId;
        input.value = optionText;
        input.required = true;

        const text = document.createElement("span");
        text.textContent = optionText;

        label.appendChild(input);
        label.appendChild(text);
        optionsGroup.appendChild(label);
      });

      wrapper.appendChild(headerRow);
      wrapper.appendChild(questionText);
      wrapper.appendChild(optionsGroup);
      $questionsContainer[0].appendChild(wrapper);
    });
  }

  /**
   * Returns the user's currently selected answer index for each question.
   * @returns {Array<number|null>} Array of selected option indices (0–3) or
   *   null for each unanswered question.
   */
  function getUserAnswers() {
    return questions.map(function (_, index) {
      const selected = document.querySelector("input[name='question-" + index + "']:checked");
      return selected ? selected.value : null;
    });
  }

  /**
   * Adds a red border to all unanswered question cards and smoothly scrolls
   * to the first unanswered one.
   * @param {Array<number|null>} answers - The answers array from getUserAnswers().
   * @returns {Element|null} The first unanswered question node, or null if all answered.
   */
  function highlightUnanswered(answers) {
    const questionNodes = document.querySelectorAll(".quiz-question");
    let firstUnanswered = null;

    questionNodes.forEach(function (node, index) {
      node.classList.remove("border-danger");

      if (answers[index] === null) {
        node.classList.add("border-danger");
        if (!firstUnanswered) {
          firstUnanswered = node;
        }
      }
    });

    if (firstUnanswered) {
      firstUnanswered.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return firstUnanswered;
  }

  /**
   * Applies correct/incorrect visual feedback to every option label and
   * disables all radio inputs to prevent further interaction after submission.
   * @param {Array<number|null>} answers - The answers array from getUserAnswers().
   */
  function markAnswerFeedback(answers) {
    questions.forEach(function (question, index) {
      const wrapper = document.querySelector(".quiz-question[data-question-index='" + index + "']");
      if (!wrapper) {
        return;
      }

      const labels = wrapper.querySelectorAll("label.quiz-option");
      labels.forEach(function (label, optionIndex) {
        label.classList.remove("border-success", "border-danger", "bg-success-subtle", "bg-danger-subtle");

        if (question.options[optionIndex] === question.answer) {
          label.classList.add("border-success", "bg-success-subtle");
        }

        if (answers[index] === question.options[optionIndex] && question.options[optionIndex] !== question.answer) {
          label.classList.add("border-danger", "bg-danger-subtle");
        }
      });

      const inputs = wrapper.querySelectorAll("input[type='radio']");
      inputs.forEach(function (input) {
        input.disabled = true;
      });
    });
  }

  /**
   * Reads the saved attempt history array from localStorage.
   * Returns an empty array on any error (private mode, quota exceeded, corrupt data).
   * @returns {Array<Object>} Previously saved attempts, newest first.
   */
  function readAttempts() {
    try {
      const raw = localStorage.getItem(ATTEMPT_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Persists the given attempts array to localStorage inside a try/catch so
   * private browsing mode or storage quota errors are handled gracefully.
   * @param {Array<Object>} attempts - The attempts array to persist.
   */
  function writeAttempts(attempts) {
    try {
      localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts));
    } catch (error) {
      // Storage can fail in private mode or quota limits; fail quietly.
    }
  }

  /**
   * Reads attempt history from localStorage and rebuilds the history table rows.
   * Displays an empty-state row if no attempts have been saved yet.
   */
  function renderAttemptHistory() {
    const attempts = readAttempts();
    $historyTableBody.empty();

    if (attempts.length === 0) {
      $historyPanel.removeClass("d-none");
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.className = "text-center";
      emptyCell.textContent = "No previous attempts saved.";
      emptyRow.appendChild(emptyCell);
      $historyTableBody[0].appendChild(emptyRow);
      return;
    }

    attempts.forEach(function (attempt) {
      const row = document.createElement("tr");

      const datetimeCell = document.createElement("td");
      datetimeCell.textContent = attempt.datetime;

      const scoreCell = document.createElement("td");
      scoreCell.textContent = String(attempt.score) + "/" + String(attempt.total);

      const percentageCell = document.createElement("td");
      percentageCell.textContent = String(attempt.percentage) + "%";

      const resultCell = document.createElement("td");
      resultCell.textContent = attempt.passed ? "Pass" : "Fail";
      resultCell.className = attempt.passed ? "text-success" : "text-danger";

      row.appendChild(datetimeCell);
      row.appendChild(scoreCell);
      row.appendChild(percentageCell);
      row.appendChild(resultCell);
      $historyTableBody[0].appendChild(row);
    });

    $historyPanel.removeClass("d-none");
  }

  /**
   * Prepends a new attempt record to the saved history and writes it back
   * to localStorage via writeAttempts().
   * @param {{score: number, total: number, percentage: number, passed: boolean}} result
   *   The grading result to record.
   */
  function saveAttempt(result) {
    const attempts = readAttempts();
    attempts.unshift({
      score: result.score,
      total: result.total,
      percentage: result.percentage,
      passed: result.passed,
      datetime: new Date().toLocaleString(),
    });
    writeAttempts(attempts);
  }

  /**
   * Calls the Advice Slip public API and renders a motivational message in the
   * reward panel. Only called on a passing score. Validates the API response
   * shape before inserting any text into the DOM.
   */
  function fetchRewardAdvice() {
    $.ajax({
      url: "https://api.adviceslip.com/advice",
      method: "GET",
      dataType: "json",
      cache: false,
    })
      .done(function (response) {
        const hasShape =
          response &&
          typeof response === "object" &&
          response.slip &&
          typeof response.slip === "object" &&
          typeof response.slip.advice === "string";

        if (!hasShape) {
          $rewardPanel.addClass("d-none");
          return;
        }

        $rewardText.text(response.slip.advice);
        $rewardPanel.removeClass("d-none");
      })
      .fail(function () {
        $rewardPanel.addClass("d-none");
      });
  }

  /**
   * Validates that all questions are answered, calculates the final score and
   * percentage, applies per-option feedback, updates the results panel, and
   * disables the submit button to prevent re-submission.
   * @returns {{score: number, total: number, percentage: number, passed: boolean}|null}
   *   The result object, or null if any question is still unanswered.
   */
  function gradeQuiz() {
    const answers = getUserAnswers();
    const firstUnanswered = highlightUnanswered(answers);

    if (firstUnanswered) {
      return null;
    }

    let score = 0;
    questions.forEach(function (question, index) {
      if (answers[index] === question.answer) {
        score += 1;
      }
    });
    // Disable submit button to prevent re-grading after results are shown.
    $quizForm.find("[type='submit']").prop("disabled", true);

    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= PASS_THRESHOLD;

    markAnswerFeedback(answers);

    $resultsSummary.text(
      "Score: " +
        String(score) +
        " out of " +
        String(questions.length) +
        " (" +
        String(percentage) +
        "%)."
    );
    $resultsStatus
      .text(passed ? "Status: Pass" : "Status: Fail")
      .removeClass("text-success text-danger")
      .addClass(passed ? "text-success" : "text-danger");

    $resultsPanel.removeClass("d-none");

    return {
      score: score,
      total: questions.length,
      percentage: percentage,
      passed: passed,
    };
  }

  /**
   * Hides the loading indicator and shows a user-friendly error message
   * when question data cannot be fetched or is malformed.
   */
  function showLoadError() {
    $loadingState.addClass("d-none");
    $quizForm.addClass("d-none");
    $errorState
      .removeClass("d-none")
      .text("Sorry, we could not load the quiz questions right now. Please refresh the page and try again.");
  }

  /**
   * Fetches data/questions.json via jQuery AJAX, validates the response schema,
   * shuffles the questions array, and renders them into the quiz form.
   * Displays an error state on network failure or invalid data.
   */
  function loadQuestions() {
    $.ajax({
      url: "data/questions.json",
      method: "GET",
      dataType: "json",
      cache: false,
    })
      .done(function (data) {
        if (!isValidQuestionData(data)) {
          showLoadError();
          return;
        }

        questions = shuffleArray(data).slice(0, 10);
        renderQuestions();
        $loadingState.addClass("d-none");
        $quizForm.removeClass("d-none");
      })
      .fail(function () {
        showLoadError();
      });
  }

  $(function () {
    $(".current-year").text(new Date().getFullYear());

    $("#threshold-pct").text(String(PASS_THRESHOLD));
    $("#threshold-count").text(String(Math.ceil(PASS_THRESHOLD / 100 * 10)));

    loadQuestions();
    renderAttemptHistory();

    // Once any answer is selected, activate leave-page protection.
    $questionsContainer.on("change", "input[type='radio']", function () {
      if (!hasStartedAnswering) {
        hasStartedAnswering = true;
        attachBeforeUnload();
      }

      const questionNode = this.closest(".quiz-question");
      if (questionNode) {
        questionNode.classList.remove("border-danger");
      }
    });

    // Validate completion, compute score, save attempt, and optionally fetch reward.
    $quizForm.on("submit", function (event) {
      event.preventDefault();

      const result = gradeQuiz();
      if (!result) {
        return;
      }

      detachBeforeUnload();
      saveAttempt(result);
      renderAttemptHistory();

      if (result.passed) {
        fetchRewardAdvice();
      } else {
        $rewardPanel.addClass("d-none");
      }
    });

    // Clear attempt history with safe localStorage write.
    $clearHistoryBtn.on("click", function () {
      try {
        localStorage.removeItem(ATTEMPT_KEY);
      } catch (error) {
        // Ignore storage clear errors and refresh UI from safe read function.
      }
      renderAttemptHistory();
    });
  });
})();
