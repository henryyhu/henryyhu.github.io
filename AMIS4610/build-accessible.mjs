import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chapters, units, semesterPlan } from "./course-modern.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(projectRoot, "amis4610.html");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const renderSource = (source) => /^https?:\/\//.test(source)
  ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(source).hostname)} ↗</a>`
  : escapeHtml(source);

const numberedChapters = chapters.map((chapter, index) => {
  const unit = units.find((candidate) => candidate.id === chapter.unit);
  if (!unit) throw new Error(`Missing unit for ${chapter.id}`);
  return { ...chapter, number: index + 1, unitData: unit };
});

for (const chapter of numberedChapters) {
  if (!chapter.sections?.length || !chapter.worked || !chapter.lab?.hint || !chapter.lab?.solution || !chapter.check || !chapter.learningDesign) {
    throw new Error(`Incomplete lesson structure: ${chapter.id}`);
  }
}

const math = (latex, label = "Equation") => `<div class="math" aria-label="${escapeHtml(label)}">\\[${escapeHtml(latex)}\\]</div>`;
const inlineMath = (latex, label = "") => `<span class="inline-math"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>\\(${escapeHtml(latex)}\\)</span>`;

const renderFigure = (chapter) => {
  const figure = chapter.figure;
  let visual = "";

  if (figure.type === "taxonomy") {
    visual = `<div class="taxonomy-visual">${figure.groups.map((group) => `
      <section class="taxonomy-group tone-${escapeHtml(group.tone || "blue")}">
        <h4>${escapeHtml(group.title)}</h4>
        <ul>${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`).join("")}</div>`;
  }

  if (figure.type === "flow") {
    visual = `<div class="flow-visual">${figure.nodes.map((node, index) => `
      <div class="flow-node"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.body)}</small></div>`).join("")}</div>`;
  }

  if (figure.type === "matrix") {
    visual = `<div class="matrix-visual" style="--matrix-cols:${figure.columns.length}">
      <div class="matrix-axis">Actual ↓<br>Predicted →</div>
      ${figure.columns.map((column) => `<div class="matrix-heading">${escapeHtml(column)}</div>`).join("")}
      ${figure.rows.map((row) => `<div class="matrix-row-label">${escapeHtml(row.label)}</div>${row.cells.map((cell) => `<div class="matrix-cell tone-${escapeHtml(cell.tone || "neutral")}"><strong>${escapeHtml(cell.value)}</strong><span>${escapeHtml(cell.note)}</span></div>`).join("")}`).join("")}
    </div>`;
  }

  if (figure.type === "folds") {
    visual = `<div class="fold-visual">
      <div class="fold-dataset">Labeled development dataset</div>
      ${Array.from({ length: figure.folds }, (_, row) => `<div class="fold-row"><span>Round ${row + 1}</span>${Array.from({ length: figure.folds }, (_, column) => `<i class="${row === column ? "is-validation" : "is-training"}">${row === column ? "VALIDATE" : "TRAIN"}</i>`).join("")}</div>`).join("")}
      <p>Average the ${figure.folds} validation results. Keep the final test set locked outside this diagram.</p>
    </div>`;
  }

  if (figure.type === "tree") {
    visual = `<div class="tree-visual">
      <div class="tree-root"><strong>${escapeHtml(figure.root.title)}</strong><span>${escapeHtml(figure.root.body)}</span></div>
      <div class="tree-children">${figure.branches.map((branch) => `<div class="tree-child tone-${escapeHtml(branch.tone || "neutral")}"><small>${escapeHtml(branch.edge)}</small><strong>${escapeHtml(branch.title)}</strong><span>${escapeHtml(branch.body)}</span></div>`).join("")}</div>
    </div>`;
  }

  if (figure.type === "network") {
    visual = `<div class="network-visual">${figure.layers.map((layer, index) => `<div class="network-layer"><h4>${escapeHtml(layer.title)}</h4><div>${layer.nodes.map((node) => `<span>${escapeHtml(node)}</span>`).join("")}</div>${index < figure.layers.length - 1 ? `<i aria-hidden="true">→</i>` : ""}</div>`).join("")}</div>`;
  }

  if (figure.type === "annotated-image") {
    visual = `<div class="annotated-image-visual">
      <div><img src="${escapeHtml(figure.image)}" alt="${escapeHtml(figure.alt)}"><small>${escapeHtml(figure.credit)}</small></div>
      <ol>${figure.callouts.map((callout) => `<li><strong>${escapeHtml(callout.title)}</strong><span>${escapeHtml(callout.body)}</span></li>`).join("")}</ol>
    </div>`;
  }

  if (figure.type === "bridge") {
    visual = `<div class="bridge-visual">${figure.steps.map((step, index) => `<div class="bridge-step tone-${escapeHtml(step.tone || "base")}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(step.value)}</strong><small>${escapeHtml(step.title)}</small></div>`).join("")}</div>`;
  }

  if (figure.type === "comparison") {
    visual = `<div class="comparison-visual"><table>
      <thead><tr>${figure.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${figure.rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>`;
  }

  if (figure.type === "timeline") {
    visual = `<div class="time-visual">${figure.blocks.map((block) => `<section class="tone-${escapeHtml(block.tone || "blue")}"><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.range)}</span><small>${escapeHtml(block.body)}</small></section>`).join("")}</div>`;
  }

  if (figure.type === "orchestration") {
    visual = `<div class="orchestration-visual">
      <section class="orchestration-manager"><small>Coordinator</small><strong>${escapeHtml(figure.manager.title)}</strong><span>${escapeHtml(figure.manager.body)}</span></section>
      <div class="orchestration-arrow"><span>fan out independent work</span>↓</div>
      <div class="orchestration-workers">${figure.workers.map((worker) => `<section><small>Parallel specialist</small><strong>${escapeHtml(worker.title)}</strong><span>${escapeHtml(worker.body)}</span></section>`).join("")}</div>
      <div class="orchestration-arrow"><span>return bounded evidence</span>↓</div>
      <section class="orchestration-synthesis"><small>Fan in</small><strong>${escapeHtml(figure.synthesis.title)}</strong><span>${escapeHtml(figure.synthesis.body)}</span></section>
      <div class="orchestration-arrow"><span>approval boundary</span>↓</div>
      <section class="orchestration-owner"><small>Accountable decision maker</small><strong>${escapeHtml(figure.owner.title)}</strong><span>${escapeHtml(figure.owner.body)}</span></section>
    </div>`;
  }

  return `<figure class="lesson-figure figure-${escapeHtml(figure.type)}" aria-labelledby="figure-${escapeHtml(chapter.id)}">
    <figcaption><p>Explanatory figure</p><h3 id="figure-${escapeHtml(chapter.id)}">${escapeHtml(figure.title)}</h3><span>${escapeHtml(figure.caption)}</span></figcaption>
    ${visual}
  </figure>`;
};

const renderReferenceVisuals = (chapter) => chapter.visuals?.length ? `<section class="reference-visuals" aria-labelledby="visuals-${escapeHtml(chapter.id)}">
  <header><p>Start with the picture</p><h3 id="visuals-${escapeHtml(chapter.id)}">First see what the model is doing.</h3><span>Study these official scikit-learn plots before reading the formulas below. Use each caption as a viewing question.</span></header>
  <div>${chapter.visuals.map((visual) => `<figure><div class="visual-frame"><img src="${escapeHtml(visual.image)}" alt="${escapeHtml(visual.alt)}"></div><figcaption><strong>${escapeHtml(visual.title)}</strong><span>${escapeHtml(visual.caption)}</span><small>Source: scikit-learn example gallery · saved with this course</small></figcaption></figure>`).join("")}</div>
</section>` : "";

const renderSupplements = (chapter) => chapter.supplements?.map((supplement, index) => {
  let visual = "";

  if (supplement.type === "sequence") {
    visual = `<ol class="concept-sequence">${supplement.steps.map((step, stepIndex) => `<li><b>${String(stepIndex + 1).padStart(2, "0")}</b><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.body)}</span><code>${escapeHtml(step.example)}</code></li>`).join("")}</ol>`;
  }

  if (supplement.type === "prompt-comparison") {
    visual = `<div class="prompt-comparison">${supplement.cards.map((card) => `<article><div><small>${escapeHtml(card.label)}</small><h4>${escapeHtml(card.title)}</h4><p>${escapeHtml(card.when)}</p></div><pre><code>${escapeHtml(card.prompt)}</code></pre><section><b>Expected output</b><code>${escapeHtml(card.output)}</code></section></article>`).join("")}</div><p class="supplement-takeaway"><strong>Key distinction</strong>${escapeHtml(supplement.takeaway)}</p>`;
  }

  if (supplement.type === "trace") {
    visual = `<div class="trace-table table-scroll"><table><thead><tr><th scope="col">Stage</th><th scope="col">Model judgment</th><th scope="col">Exact operation</th><th scope="col">Reviewable evidence</th></tr></thead><tbody>${supplement.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.step)}</th><td>${escapeHtml(row.model)}</td><td>${escapeHtml(row.tool)}</td><td>${escapeHtml(row.evidence)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  if (supplement.type === "agent-anatomy") {
    const cards = (items) => items.map((item) => `<section><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></section>`).join("");
    visual = `<div class="agent-anatomy">
      <div class="agent-inputs"><small>What enters the loop</small>${cards(supplement.inputs)}</div>
      <div class="agent-core"><small>Decision engine</small><strong>${escapeHtml(supplement.core.title)}</strong><span>${escapeHtml(supplement.core.body)}</span></div>
      <div class="agent-resources"><small>What extends the model</small>${cards(supplement.resources)}</div>
      <div class="agent-controls"><small>What bounds the loop</small>${cards(supplement.controls)}</div>
      <div class="agent-output"><small>What leaves the loop</small><strong>${escapeHtml(supplement.output.title)}</strong><span>${escapeHtml(supplement.output.body)}</span></div>
    </div>`;
  }

  if (supplement.type === "codex-start") {
    visual = `<div class="codex-start"><ol>${supplement.steps.map((step, stepIndex) => `<li><b>${String(stepIndex + 1).padStart(2, "0")}</b><div><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.body)}</span></div></li>`).join("")}</ol><section><p>Copyable starter prompt</p><pre><code>${escapeHtml(supplement.prompt)}</code></pre></section><ul>${supplement.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>`;
  }

  if (supplement.type === "attention-calculation") {
    visual = `<div class="attention-calculation">
      <div class="attention-published">
        <figure><img src="${escapeHtml(supplement.image)}" alt="${escapeHtml(supplement.alt)}"><figcaption>${escapeHtml(supplement.credit)}</figcaption></figure>
        <div class="attention-vocabulary">${supplement.vocabulary.map((item) => `<section><b>${escapeHtml(item.symbol)}</b><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></div></section>`).join("")}</div>
      </div>
      <section class="attention-formula"><p>The complete operation</p>${math(supplement.formula, "Scaled dot-product attention")}</section>
      <div class="attention-table table-scroll"><table>
        <caption>Toy self-attention inputs and calculations for the query token bank</caption>
        <thead><tr><th scope="col">Token</th><th scope="col">Query</th><th scope="col">Key</th><th scope="col">Value</th><th scope="col">Dot score</th><th scope="col">Scaled score</th><th scope="col">Softmax weight</th></tr></thead>
        <tbody>${supplement.rows.map((row) => `<tr><th scope="row">${escapeHtml(row.token)}</th><td>${row.query ? inlineMath(row.query) : `<span aria-label="No additional query in this walkthrough">—</span>`}</td><td>${inlineMath(row.key)}</td><td>${inlineMath(row.value)}</td><td>${inlineMath(row.dot)}</td><td>${inlineMath(row.scaled)}</td><td><strong>${escapeHtml(row.weight)}</strong></td></tr>`).join("")}</tbody>
      </table></div>
      <ol class="attention-steps">${supplement.steps.map((step) => `<li><h4>${escapeHtml(step.title)}</h4>${math(step.latex, step.title)}<p>${escapeHtml(step.body)}</p></li>`).join("")}</ol>
      <p class="attention-takeaway"><strong>What changes in a real model?</strong>${escapeHtml(supplement.takeaway)}</p>
    </div>`;
  }

  const optional = chapter.learningDesign.optionalSupplements?.includes(index);
  if (optional) {
    return `<details class="lesson-supplement optional-deep-dive supplement-${escapeHtml(supplement.type)}" id="supplement-${escapeHtml(chapter.id)}-${index + 1}"><summary><span>Optional technical deep dive</span><strong>${escapeHtml(supplement.title)}</strong></summary><div class="optional-deep-body"><p class="optional-intro">${escapeHtml(supplement.intro)}</p>${visual}</div></details>`;
  }
  return `<section class="lesson-supplement supplement-${escapeHtml(supplement.type)}" id="supplement-${escapeHtml(chapter.id)}-${index + 1}" aria-labelledby="supplement-title-${escapeHtml(chapter.id)}-${index + 1}"><header><p>Visual example</p><h3 id="supplement-title-${escapeHtml(chapter.id)}-${index + 1}">${escapeHtml(supplement.title)}</h3><span>${escapeHtml(supplement.intro)}</span></header>${visual}</section>`;
}).join("") || "";

const renderOrangePractice = (chapter) => {
  const guide = chapter.orangePractice;
  if (!guide) return "";
  const action = (kind) => kind === "Video" ? "Watch official video ↗" : kind === "Tutorial" ? "Open tutorial ↗" : "Open widget guide ↗";
  return `<section class="orange-practice" id="orange-${escapeHtml(chapter.id)}" aria-labelledby="orange-title-${escapeHtml(chapter.id)}">
    <header><p>Hands-on Orange workflow</p><h3 id="orange-title-${escapeHtml(chapter.id)}">Learn this lesson with Orange</h3><span>${escapeHtml(guide.goal)}</span></header>
    <div class="orange-workflow"><div><small>Recommended widget chain</small><code>${escapeHtml(guide.workflow)}</code></div><p>${escapeHtml(guide.note)}</p></div>
    <div class="orange-resources">${guide.resources.map((resource) => `<article class="orange-resource ${resource.kind === "Video" ? "is-video" : ""}"><div><small>${escapeHtml(resource.kind)} · Official Orange resource</small><h4>${escapeHtml(resource.title)}</h4><p>${escapeHtml(resource.body)}</p></div><a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${action(resource.kind)}</a></article>`).join("")}</div>
  </section>`;
};

const renderSection = (chapter, section, index) => {
  const number = String(index + 1).padStart(2, "0");
  const content = `
    <p class="plain-language">${escapeHtml(section.plain)}</p>
    ${section.details.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    ${section.bullets ? `<ul class="teaching-list">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${section.equation ? `<figure class="equation"><figcaption>${escapeHtml(section.equation.caption)}</figcaption>${math(section.equation.latex, section.equation.caption)}</figure>` : ""}`;
  if (chapter.learningDesign.optionalSections?.includes(index)) {
    return `<details class="lesson-section optional-deep-dive" id="${escapeHtml(chapter.id)}-section-${index + 1}"><summary><span>${number} · Optional technical detail</span><strong>${escapeHtml(section.title)}</strong><small>${escapeHtml(section.label)}</small></summary><div class="optional-deep-body">${content}</div></details>`;
  }
  return `<section class="lesson-section" id="${escapeHtml(chapter.id)}-section-${index + 1}">
    <p class="section-kicker">${number} · ${escapeHtml(section.label)}</p>
    <h3>${escapeHtml(section.title)}</h3>${content}
  </section>`;
};

const renderTable = (table, caption) => `<div class="table-scroll"><table>
  <caption>${escapeHtml(caption)}</caption>
  <thead><tr>${table.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
  <tbody>${table.rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
</table></div>`;

const renderWorked = (chapter) => `<section class="worked-example" aria-labelledby="worked-${escapeHtml(chapter.id)}">
  <header><p>Fully worked example</p><h3 id="worked-${escapeHtml(chapter.id)}">${escapeHtml(chapter.worked.title)}</h3><span>${escapeHtml(chapter.worked.intro)}</span></header>
  ${renderTable(chapter.worked.table, chapter.worked.title)}
  <div class="worked-steps">${chapter.worked.steps.map((step, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><div><h4>${escapeHtml(step.title)}</h4>${step.math ? math(step.math, step.title) : ""}<strong>${escapeHtml(step.answer)}</strong><p><b>Why:</b> ${escapeHtml(step.why)}</p></div></article>`).join("")}</div>
  <p class="worked-takeaway"><strong>What this example teaches</strong>${escapeHtml(chapter.worked.takeaway)}</p>
</section>`;

const renderLab = (chapter) => {
  const title = chapter.lab.title.replace(/^Practice lab:\s*/i, "");
  return `<section class="practice-lab" aria-labelledby="lab-${escapeHtml(chapter.id)}">
    <header><p>Comprehensive questions</p><h3 id="lab-${escapeHtml(chapter.id)}">${escapeHtml(title)}</h3><span>${escapeHtml(chapter.lab.scenario)}</span></header>
    ${chapter.lab.table ? renderTable(chapter.lab.table, `${title} data`) : ""}
    <div class="lab-tasks"><h4>Work through the questions</h4><p>Write a short response before opening the hint or answer.</p><ol>${chapter.lab.tasks.map((task, index) => `<li><label for="response-${escapeHtml(chapter.id)}-${index + 1}"><strong>${escapeHtml(task)}</strong><textarea id="response-${escapeHtml(chapter.id)}-${index + 1}" rows="3" placeholder="Write your response…"></textarea></label></li>`).join("")}</ol></div>
    <details class="lab-hint"><summary>Show a hint</summary><p>${escapeHtml(chapter.lab.hint)}</p></details>
    <details class="lab-solution"><summary>Show the answer and explanation</summary><div><h4>${escapeHtml(chapter.lab.solution.summary)}</h4><ol>${chapter.lab.solution.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div></details>
  </section>`;
};

const renderCheck = (chapter) => `<form class="knowledge-check" aria-labelledby="check-${escapeHtml(chapter.id)}" data-knowledge-check data-answer="${chapter.check.correct}">
  <div><p>Check your understanding</p><h3 id="check-${escapeHtml(chapter.id)}">${escapeHtml(chapter.check.question)}</h3></div>
  <ol class="check-options">${chapter.check.options.map((option, index) => `<li data-option="${index}"><label><input type="radio" name="check-${escapeHtml(chapter.id)}" value="${index}"><span>${String.fromCharCode(65 + index)}</span><b>${escapeHtml(option)}</b></label></li>`).join("")}</ol>
  <button type="button" data-check-answer>Check answer</button>
  <p class="check-answer" data-check-feedback data-explanation="${escapeHtml(chapter.check.explanation)}" hidden><strong>Correct answer: ${String.fromCharCode(65 + chapter.check.correct)}.</strong> ${escapeHtml(chapter.check.explanation)}</p>
</form>`;

const renderStudyGuide = (chapter) => {
  const guide = chapter.learningDesign;
  return `<section class="study-guide" aria-label="Required and optional learning guide">
    <header><p>How to study this lesson</p><h3>Learn the essentials, produce one useful artifact, then choose whether to go deeper.</h3></header>
    <div class="study-priorities">
      <article class="is-required"><span>Required</span><h4>Must know</h4><ul>${guide.mustKnow.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>
      <article class="is-applied"><span>Applied</span><h4>What you will produce</h4><p>${escapeHtml(guide.apply)}</p></article>
      <details class="is-optional"><summary><span>Optional</span><strong>Technical deep dive</strong></summary><p>${escapeHtml(guide.optional)}</p></details>
    </div>
  </section>`;
};

const renderChapter = (chapter) => {
  const orangeSearch = chapter.orangePractice ? [chapter.orangePractice.goal, chapter.orangePractice.workflow, chapter.orangePractice.note, ...chapter.orangePractice.resources.flatMap((resource) => [resource.title, resource.body])] : [];
  const searchText = [chapter.title, chapter.subtitle, chapter.why, ...chapter.terms, ...chapter.sections.flatMap((section) => [section.title, section.plain, ...section.details]), ...orangeSearch].join(" ").toLowerCase();
  return `<article class="chapter" id="${escapeHtml(chapter.id)}" data-chapter="${chapter.number}" data-unit="${escapeHtml(chapter.unit)}" data-search="${escapeHtml(searchText)}" style="--accent:${escapeHtml(chapter.unitData.accent)}">
    <header class="chapter-header">
      <p>Lesson ${String(chapter.number).padStart(2, "0")} · Unit ${escapeHtml(chapter.unitData.number)}</p>
      <h2>${escapeHtml(chapter.title)}</h2>
      <span>${escapeHtml(chapter.subtitle)}</span>
      <div class="chapter-meta"><b>${escapeHtml(chapter.learningDesign.week)}</b><b>${escapeHtml(chapter.learningDesign.role)}</b><b>${escapeHtml(chapter.duration)}</b><b>${escapeHtml(chapter.level)}</b></div>
    </header>
    <div class="chapter-body">
      <section class="lesson-start">
        <div class="why-lesson"><p>Why this lesson is important</p><h3>${escapeHtml(chapter.why)}</h3></div>
        ${renderStudyGuide(chapter)}
        <div class="lesson-prep"><div><p>Before you begin</p><ul>${chapter.prerequisites.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div><p>By the end, you can</p><ul>${chapter.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
        <nav class="lesson-outline" aria-label="Lesson ${chapter.number} outline"><p>Lesson outline</p><ol>${chapter.sections.map((section, index) => `<li><a href="#${escapeHtml(chapter.id)}-section-${index + 1}"><span>${chapter.learningDesign.optionalSections?.includes(index) ? "OPT" : String(index + 1).padStart(2, "0")}</span>${escapeHtml(section.title)}</a></li>`).join("")}${chapter.orangePractice ? `<li><a href="#orange-${escapeHtml(chapter.id)}"><span>O</span>Learn with Orange</a></li>` : ""}${chapter.supplements?.length ? `<li><a href="#supplement-${escapeHtml(chapter.id)}-1"><span>${chapter.learningDesign.optionalSupplements?.includes(0) ? "OPT" : "V"}</span>${chapter.learningDesign.optionalSupplements?.includes(0) ? "Optional visual walkthrough" : "Visual examples and walkthroughs"}</a></li>` : ""}<li><a href="#worked-${escapeHtml(chapter.id)}"><span>W</span>Fully worked example</a></li><li><a href="#lab-${escapeHtml(chapter.id)}"><span>Q</span>Comprehensive questions</a></li></ol></nav>
      </section>
      ${renderReferenceVisuals(chapter)}
      ${chapter.sections.map((section, index) => renderSection(chapter, section, index)).join("")}
      ${renderFigure(chapter)}
      ${renderOrangePractice(chapter)}
      ${renderSupplements(chapter)}
      ${renderWorked(chapter)}
      ${renderLab(chapter)}
      ${renderCheck(chapter)}
      ${chapter.video ? `<section class="video-support"><div><p>Optional video support</p><h3>${escapeHtml(chapter.video.title)}</h3><span>${escapeHtml(chapter.video.channel)}</span></div><p>${escapeHtml(chapter.video.why)}</p><a href="${escapeHtml(chapter.video.url)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></section>` : ""}
      <footer class="chapter-footer"><div><p>Key terms</p><ul>${chapter.terms.map((term) => `<li>${escapeHtml(term)}</li>`).join("")}</ul></div><div><p>Reference material used</p><ul>${chapter.source.map((source) => `<li>${renderSource(source)}</li>`).join("")}</ul></div><a href="#course-map">Return to course map ↑</a></footer>
    </div>
  </article>`;
};

const renderUnitDivider = (unit) => {
  const members = numberedChapters.filter((chapter) => chapter.unit === unit.id);
  return `<section class="unit-divider" id="unit-${escapeHtml(unit.id)}" data-unit-divider="${escapeHtml(unit.id)}" style="--accent:${escapeHtml(unit.accent)}">
    <span>${escapeHtml(unit.number)}</span><div><p>${members.length} lessons</p><h2>${escapeHtml(unit.title)}</h2><strong>${escapeHtml(unit.description)}</strong></div>
  </section>`;
};

const courseContent = units.map((unit) => `${renderUnitDivider(unit)}${numberedChapters.filter((chapter) => chapter.unit === unit.id).map(renderChapter).join("")}`).join("");

const sidebar = units.map((unit) => `<section><h3><span>${escapeHtml(unit.number)}</span>${escapeHtml(unit.title)}</h3><ol>${numberedChapters.filter((chapter) => chapter.unit === unit.id).map((chapter) => `<li><a href="#${escapeHtml(chapter.id)}" data-nav="${chapter.number}"><b>${String(chapter.number).padStart(2, "0")}</b><span>${escapeHtml(chapter.title)}</span></a></li>`).join("")}</ol></section>`).join("");

const mapCards = units.map((unit) => {
  const members = numberedChapters.filter((chapter) => chapter.unit === unit.id);
  return `<article class="unit-card" style="--accent:${escapeHtml(unit.accent)}"><p>Unit ${escapeHtml(unit.number)}</p><h3>${escapeHtml(unit.title)}</h3><span>${escapeHtml(unit.description)}</span><ol>${members.map((chapter) => `<li><a href="#${escapeHtml(chapter.id)}"><b>${String(chapter.number).padStart(2, "0")}</b>${escapeHtml(chapter.title)}</a></li>`).join("")}</ol></article>`;
}).join("");

const semesterRoute = [...new Set(semesterPlan.map((item) => item.phase))].map((phase, phaseIndex) => {
  const weeks = semesterPlan.filter((item) => item.phase === phase);
  return `<article class="semester-phase"><header><span>Phase ${String(phaseIndex + 1).padStart(2, "0")}</span><h3>${escapeHtml(phase)}</h3></header><ol>${weeks.map((item) => {
    const links = item.lessons.map((id) => {
      const chapter = numberedChapters.find((candidate) => candidate.id === id);
      if (!chapter) throw new Error(`Unknown semester-plan lesson: ${id}`);
      return `<a href="#${escapeHtml(chapter.id)}">Lesson ${chapter.number}</a>`;
    }).join(" ");
    return `<li><span>Week ${String(item.week).padStart(2, "0")}</span><div><h4>${escapeHtml(item.title)}</h4><nav aria-label="Week ${item.week} lessons">${links}</nav><p><b>Student output</b>${escapeHtml(item.deliverable)}</p></div></li>`;
  }).join("")}</ol></article>`;
}).join("");

const css = String.raw`
:root {
  --paper: #fbfaf7;
  --paper-2: #f3f0e9;
  --ink: #233137;
  --muted: #5e6b70;
  --line: #d9d8d2;
  --navy: #17252c;
  --blue: #2f6f8f;
  --blue-soft: #e9f2f6;
  --gold: #9a6824;
  --gold-soft: #f6efe2;
  --green: #39745f;
  --green-soft: #eaf3ef;
  --purple: #6d5c9e;
  --purple-soft: #f0edf7;
  --red: #a8494f;
  --red-soft: #f8eaeb;
  --heading: "Iowan Old Style", Charter, "Palatino Linotype", Palatino, Georgia, serif;
  --body: "Avenir Next", Avenir, Aptos, "Segoe UI", system-ui, sans-serif;
  --mono: "SFMono-Regular", Consolas, monospace;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; color: var(--ink); background: #e9e7e1; font-family: var(--body); font-size: 17px; line-height: 1.72; text-rendering: optimizeLegibility; }
a { color: var(--blue); text-underline-offset: 3px; }
a:hover { color: #194f69; }
button, input { font: inherit; }
:focus-visible { outline: 3px solid #d79b44; outline-offset: 3px; }
.skip-link { position: fixed; z-index: 999; top: 8px; left: 8px; transform: translateY(-160%); padding: 8px 12px; color: var(--ink); background: white; }
.skip-link:focus { transform: translateY(0); }
.topbar { position: sticky; z-index: 100; top: 0; min-height: 64px; color: white; background: rgba(23,37,44,.98); border-bottom: 1px solid rgba(255,255,255,.12); }
.topbar-inner { max-width: 1560px; min-height: 64px; margin: 0 auto; padding: 9px 25px; display: grid; grid-template-columns: auto minmax(260px,520px) auto; gap: 25px; align-items: center; }
.brand { color: white; font-weight: 700; text-decoration: none; letter-spacing: -.01em; white-space: nowrap; }
.brand span { margin-right: 8px; color: #9fcce0; font: 750 .72rem/1 var(--mono); }
.search label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.search input { width: 100%; height: 39px; padding: 6px 12px; color: white; border: 1px solid rgba(255,255,255,.24); border-radius: 4px; background: rgba(255,255,255,.08); font-size: .8rem; }
.search input::placeholder { color: #c5d0d5; }
.menu-button { display: none; padding: 6px 10px; color: white; border: 1px solid rgba(255,255,255,.25); background: transparent; }
.hero { min-height: 450px; padding: clamp(70px,9vw,125px) clamp(28px,8vw,120px); color: white; background: linear-gradient(120deg,#17252c,#273b44); border-bottom: 8px solid #2f6f8f; }
.hero-inner { max-width: 1120px; margin: 0 auto; }
.eyebrow, .section-kicker { margin: 0; color: #317596; font-size: .67rem; font-weight: 780; letter-spacing: .11em; text-transform: uppercase; }
.hero .eyebrow { color: #9fcce0; }
.hero h1 { max-width: 950px; margin: 13px 0 22px; font-family: var(--heading); font-size: clamp(3.6rem,7.2vw,6.7rem); font-weight: 600; line-height: .94; letter-spacing: -.055em; }
.hero h1 span { display: block; color: #b9dbe8; }
.hero > .hero-inner > p:last-of-type { max-width: 850px; margin: 0; color: #d8e0e3; font-size: clamp(1.05rem,2vw,1.35rem); line-height: 1.55; }
.hero-route { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 30px; color: #aebec5; font-size: .72rem; font-weight: 700; }
.hero-route i { color: #80b8ce; font-style: normal; }
.course-map { max-width: 1240px; margin: 0 auto; padding: 92px 30px 110px; }
.course-map > header { max-width: 820px; }
.course-map h2 { margin: 8px 0 18px; font-family: var(--heading); font-size: clamp(2.7rem,5vw,4.5rem); font-weight: 600; line-height: 1; letter-spacing: -.045em; }
.course-map > header > p:last-child { color: var(--muted); font-size: 1.03rem; }
.semester-route { margin-top: 52px; }
.semester-route > header { max-width: 780px; margin-bottom: 22px; }
.semester-route > header h3, .reference-map > header h3 { margin: 8px 0 0; font-family: var(--heading); font-size: clamp(1.65rem,3vw,2.45rem); font-weight: 600; line-height: 1.12; letter-spacing: -.025em; }
.semester-phases { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 15px; align-items: start; }
.semester-phase { border-top: 5px solid var(--blue); background: white; box-shadow: 0 10px 28px rgba(30,42,48,.05); }
.semester-phase:nth-child(2) { border-top-color: var(--green); }
.semester-phase:nth-child(3) { border-top-color: var(--purple); }
.semester-phase > header { padding: 20px 21px 16px; border-bottom: 1px solid var(--line); }
.semester-phase > header span { color: var(--blue); font: 760 .59rem/1 var(--mono); letter-spacing: .05em; text-transform: uppercase; }
.semester-phase:nth-child(2) > header span { color: var(--green); }
.semester-phase:nth-child(3) > header span { color: var(--purple); }
.semester-phase > header h3 { margin: 7px 0 0; font-family: var(--heading); font-size: 1.35rem; font-weight: 600; }
.semester-phase ol { margin: 0; padding: 0; list-style: none; }
.semester-phase li { display: grid; grid-template-columns: 58px minmax(0,1fr); gap: 11px; padding: 16px 19px 17px; border-bottom: 1px solid #ebe9e4; }
.semester-phase li:last-child { border-bottom: 0; }
.semester-phase li > span { padding-top: 3px; color: #7a8589; font: 720 .56rem/1.4 var(--mono); text-transform: uppercase; }
.semester-phase h4 { margin: 0; color: #30434b; font-size: .76rem; line-height: 1.38; }
.semester-phase nav { margin-top: 3px; color: #8a9498; font-size: .58rem; }
.semester-phase nav a { font-weight: 750; text-decoration: none; }
.semester-phase nav a + a:before { content: "+"; margin-right: 4px; color: #929b9e; }
.semester-phase p { margin: 9px 0 0; color: var(--muted); font-size: .63rem; line-height: 1.45; }
.semester-phase p b { display: block; margin-bottom: 2px; color: #7a8589; font-size: .52rem; letter-spacing: .06em; text-transform: uppercase; }
.lesson-method { display: grid; grid-template-columns: repeat(5,1fr); gap: 1px; margin: 42px 0 68px; background: #d8d8d2; border: 1px solid #d8d8d2; }
.lesson-method div { min-height: 132px; padding: 20px; background: #fff; }
.lesson-method span { color: var(--blue); font: 750 .63rem/1 var(--mono); }
.lesson-method strong { display: block; margin-top: 17px; font-family: var(--heading); font-size: 1.02rem; }
.lesson-method small { display: block; margin-top: 5px; color: var(--muted); font-size: .68rem; line-height: 1.45; }
.reference-map > header { max-width: 780px; margin-bottom: 22px; }
.reference-map > header > span { display: block; max-width: 720px; margin-top: 9px; color: var(--muted); font-size: .76rem; line-height: 1.55; }
.unit-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }
.unit-card { padding: 30px 31px 32px; border-top: 5px solid var(--accent); background: white; box-shadow: 0 10px 28px rgba(30,42,48,.055); }
.unit-card > p { margin: 0; color: var(--accent); font-size: .64rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.unit-card h3 { margin: 8px 0 9px; font-family: var(--heading); font-size: 1.75rem; font-weight: 600; }
.unit-card > span { display: block; color: var(--muted); font-size: .78rem; line-height: 1.55; }
.unit-card ol { list-style: none; margin: 22px 0 0; padding: 0; border-top: 1px solid var(--line); }
.unit-card li + li { border-top: 1px solid #ebe9e4; }
.unit-card a { display: grid; grid-template-columns: 34px 1fr; gap: 8px; padding: 9px 0; color: #35464d; font-size: .72rem; text-decoration: none; }
.unit-card a b { color: var(--accent); font: 750 .61rem/1.7 var(--mono); }
.book { max-width: 1620px; margin: 0 auto; display: grid; grid-template-columns: 310px minmax(0,1fr); background: white; box-shadow: 0 0 0 1px #d4d3ce; }
.sidebar { min-width: 0; background: #f0eee8; border-right: 1px solid var(--line); }
.sidebar-inner { position: sticky; top: 64px; max-height: calc(100vh - 64px); overflow-y: auto; padding: 35px 24px 50px; }
.sidebar h2 { margin: 0 0 27px; font-family: var(--heading); font-size: 1.45rem; font-weight: 600; }
.sidebar section + section { margin-top: 28px; }
.sidebar h3 { display: flex; align-items: baseline; gap: 8px; margin: 0 6px 8px; color: #657176; font-size: .63rem; letter-spacing: .07em; text-transform: uppercase; }
.sidebar h3 span { color: var(--blue); font: 760 .61rem/1 var(--mono); }
.sidebar ol { list-style: none; margin: 0; padding: 0; }
.sidebar a { display: grid; grid-template-columns: 28px 1fr; gap: 7px; padding: 7px 8px; color: #4c5a60; border-left: 3px solid transparent; font-size: .69rem; line-height: 1.35; text-decoration: none; }
.sidebar a b { color: #879095; font: 700 .58rem/1.6 var(--mono); }
.sidebar a:hover, .sidebar a.is-current { color: #21343d; border-left-color: var(--blue); background: white; }
.main { min-width: 0; }
.unit-divider { min-height: 310px; display: grid; grid-template-columns: 110px minmax(0,1fr); gap: 34px; align-items: center; padding: clamp(58px,8vw,100px); color: white; background: #203038; border-bottom: 7px solid var(--accent); scroll-margin-top: 64px; }
.unit-divider[hidden] { display: none; }
.unit-divider > span { color: var(--accent); font-family: var(--heading); font-size: 5.5rem; line-height: 1; }
.unit-divider p { margin: 0; color: color-mix(in srgb,var(--accent) 55%,white); font-size: .64rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; }
.unit-divider h2 { margin: 8px 0 13px; font-family: var(--heading); font-size: clamp(3rem,5.5vw,5rem); font-weight: 600; line-height: .95; letter-spacing: -.045em; }
.unit-divider strong { display: block; max-width: 780px; color: #cbd5d9; font-size: .9rem; font-weight: 450; line-height: 1.6; }
.chapter { --accent: var(--blue); scroll-margin-top: 64px; border-bottom: 16px solid #e9e7e1; }
.chapter[hidden] { display: none; }
.chapter-header { min-height: 370px; padding: 76px clamp(35px,7vw,105px) 64px; background: linear-gradient(135deg,#fff,#f4f1eb); border-bottom: 1px solid var(--line); }
.chapter-header > p { margin: 0; color: var(--accent); font-size: .67rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.chapter-header h2 { max-width: 970px; margin: 14px 0 16px; font-family: var(--heading); font-size: clamp(3rem,5.7vw,5.4rem); font-weight: 600; line-height: .94; letter-spacing: -.055em; }
.chapter-header > span { display: block; max-width: 820px; color: #55646a; font-family: var(--heading); font-size: clamp(1.05rem,1.8vw,1.35rem); line-height: 1.5; }
.chapter-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 25px; }
.chapter-meta b { color: #718086; font-size: .63rem; font-weight: 700; }
.chapter-body { padding: 0 clamp(35px,7vw,105px) 110px; }
.lesson-start, .lesson-section, .lesson-figure, .worked-example, .practice-lab, .knowledge-check, .video-support, .chapter-footer { max-width: 980px; }
.lesson-start { margin-top: 62px; }
.why-lesson { padding: 0 0 34px; border-bottom: 1px solid var(--line); }
.why-lesson > p, .lesson-prep p, .lesson-outline > p, .worked-example header > p, .practice-lab header > p, .knowledge-check > div > p, .video-support > div > p, .chapter-footer p, .lesson-figure figcaption > p { margin: 0; color: var(--accent); font-size: .63rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.why-lesson h3 { max-width: 890px; margin: 9px 0 0; color: #33434a; font-family: var(--heading); font-size: clamp(1.35rem,2.4vw,1.85rem); font-weight: 500; line-height: 1.45; }
.study-guide { margin: 32px 0 0; border: 1px solid #d5d8d5; background: #faf9f5; }
.study-guide > header { padding: 20px 23px 18px; border-bottom: 1px solid #dedfdc; }
.study-guide > header p { margin: 0; color: var(--accent); font-size: .59rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.study-guide > header h3 { max-width: 760px; margin: 6px 0 0; font-family: var(--heading); font-size: 1.18rem; font-weight: 600; line-height: 1.35; }
.study-priorities { display: grid; grid-template-columns: 1.25fr 1fr .85fr; }
.study-priorities > * { min-width: 0; margin: 0; padding: 21px 22px 23px; border-right: 1px solid #dedfdc; }
.study-priorities > *:last-child { border-right: 0; }
.study-priorities span { color: #64747a; font-size: .54rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.study-priorities h4, .study-priorities summary strong { display: block; margin: 6px 0 0; color: #2d4149; font-family: var(--heading); font-size: .96rem; }
.study-priorities ul { margin: 12px 0 0; padding-left: 18px; }
.study-priorities li, .study-priorities p { margin: 6px 0; color: var(--muted); font-size: .67rem; line-height: 1.5; }
.study-priorities .is-required { border-top: 4px solid var(--blue); }
.study-priorities .is-applied { border-top: 4px solid var(--green); background: #f3f8f5; }
.study-priorities .is-optional { border-top: 4px solid var(--gold); background: #faf6ec; }
.study-priorities summary { cursor: pointer; list-style-position: outside; }
.study-priorities .is-optional p { margin-top: 14px; }
.lesson-prep { display: grid; grid-template-columns: .8fr 1.2fr; gap: 48px; padding: 32px 0 36px; }
.lesson-prep ul { margin: 12px 0 0; padding-left: 19px; }
.lesson-prep li { margin: 7px 0; color: var(--muted); font-size: .76rem; }
.lesson-outline { padding: 21px 24px 24px; background: var(--paper-2); border: 1px solid var(--line); }
.lesson-outline ol { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px 26px; }
.lesson-outline a { display: grid; grid-template-columns: 27px 1fr; gap: 7px; padding: 8px 0; color: #46565d; border-bottom: 1px solid #ddd9d1; font-size: .69rem; text-decoration: none; }
.lesson-outline a span { color: var(--accent); font: 750 .59rem/1.7 var(--mono); }
.lesson-section { margin-top: 92px; scroll-margin-top: 86px; }
.lesson-section h3 { max-width: 850px; margin: 8px 0 25px; font-family: var(--heading); font-size: clamp(2.15rem,4vw,3.35rem); font-weight: 600; line-height: 1.03; letter-spacing: -.04em; }
.lesson-section > p:not(.section-kicker) { max-width: 760px; margin: 0 0 1.15em; color: #46565d; }
.lesson-section .plain-language { max-width: 800px; color: #253941 !important; font-family: var(--heading); font-size: 1.22rem; line-height: 1.6; }
.optional-deep-dive { border: 1px solid #ddcfb1; background: #fcfaf3; }
.optional-deep-dive > summary { display: grid; grid-template-columns: 175px minmax(0,1fr); gap: 5px 22px; align-items: baseline; padding: 22px 24px; cursor: pointer; }
.optional-deep-dive > summary span { color: #8a642a; font-size: .58rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.optional-deep-dive > summary strong { color: #34454c; font-family: var(--heading); font-size: clamp(1.35rem,2.4vw,1.9rem); line-height: 1.18; }
.optional-deep-dive > summary small { grid-column: 2; color: #7a8589; font-size: .59rem; text-transform: uppercase; letter-spacing: .05em; }
.optional-deep-dive[open] > summary { border-bottom: 1px solid #ddcfb1; }
.optional-deep-body { padding: 25px 25px 30px; }
.optional-deep-body > p { max-width: 760px; color: #4b5a60; }
.optional-deep-body > .plain-language { color: #253941; font-family: var(--heading); font-size: 1.15rem; line-height: 1.6; }
.optional-deep-body .optional-intro { margin: 0 0 25px; color: var(--muted); font-size: .72rem; }
.teaching-list { max-width: 790px; margin: 27px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.teaching-list li { padding: 12px 10px 12px 26px; border-bottom: 1px solid var(--line); color: #4c5b61; font-size: .78rem; position: relative; }
.teaching-list li:before { content: "•"; position: absolute; left: 8px; color: var(--accent); }
.equation { max-width: 820px; margin: 34px 0 0; padding: 17px 20px 15px; border-top: 1px solid #c8d5da; border-bottom: 1px solid #c8d5da; background: #f5f8f9; }
.equation figcaption { color: var(--accent); font-size: .62rem; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.math { min-width: 0; overflow-x: auto; color: #203841; font-size: .92rem; }
.math mjx-container[jax="CHTML"][display="true"] { margin: .45em 0 !important; text-align: left !important; }
.lesson-figure { margin-top: 100px; border: 1px solid #d4dadd; background: white; box-shadow: 0 14px 32px rgba(35,53,61,.055); }
.lesson-figure figcaption { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(260px,.85fr); gap: 8px 35px; align-items: end; padding: 27px 29px 24px; border-bottom: 1px solid #dce1e3; }
.lesson-figure figcaption > p { grid-column: 1 / -1; }
.lesson-figure figcaption h3 { margin: 0; font-family: var(--heading); font-size: clamp(1.55rem,2.8vw,2.3rem); font-weight: 600; line-height: 1.08; }
.lesson-figure figcaption span { color: var(--muted); font-size: .69rem; line-height: 1.5; }
.reference-visuals { margin-top: 100px; }
.reference-visuals > header { display: grid; grid-template-columns: minmax(0,1fr) minmax(260px,.8fr); gap: 8px 34px; align-items: end; padding-bottom: 23px; border-bottom: 1px solid var(--line); }
.reference-visuals > header > p { grid-column: 1 / -1; }
.reference-visuals > header h3 { margin: 0; font-family: var(--heading); font-size: clamp(1.8rem,3vw,2.6rem); font-weight: 600; line-height: 1.05; }
.reference-visuals > header span { color: var(--muted); font-size: .7rem; line-height: 1.5; }
.reference-visuals > div { display: grid; grid-template-columns: minmax(0,1fr); gap: 34px; margin-top: 24px; }
.reference-visuals figure { display: flex; flex-direction: column; min-width: 0; margin: 0; background: white; border: 1px solid #d6dde0; }
.reference-visuals .visual-frame { display: grid; place-items: center; min-height: 420px; padding: 26px; background: #fff; }
.reference-visuals img { display: block; width: 100%; height: auto; object-fit: contain; }
.reference-visuals figcaption { display: grid; gap: 7px; padding: 17px 18px 19px; border-top: 1px solid #e1e5e6; }
.reference-visuals figcaption strong { font-family: var(--heading); font-size: 1rem; }
.reference-visuals figcaption span { color: var(--muted); font-size: .67rem; line-height: 1.5; }
.reference-visuals figcaption small { color: #7a8589; font-size: .57rem; font-weight: 700; letter-spacing: .015em; }
.orange-practice { margin-top: 100px; border-top: 5px solid #e87b25; }
.orange-practice > header { display: grid; grid-template-columns: minmax(0,1fr) minmax(280px,.85fr); gap: 8px 34px; align-items: end; padding: 27px 0 24px; }
.orange-practice > header > p { grid-column: 1 / -1; margin: 0; color: #c95f16; font-size: .63rem; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.orange-practice > header h3 { margin: 0; font-family: var(--heading); font-size: clamp(2rem,3.5vw,3rem); font-weight: 600; line-height: 1.04; letter-spacing: -.03em; }
.orange-practice > header span { color: var(--muted); font-size: .71rem; line-height: 1.6; }
.orange-workflow { display: grid; grid-template-columns: minmax(0,1.05fr) minmax(280px,.95fr); gap: 1px; background: #e8d4c4; border: 1px solid #e8d4c4; }
.orange-workflow > div { display: grid; gap: 9px; align-content: center; min-width: 0; padding: 22px 23px; background: #fff7ef; }
.orange-workflow small { color: #a95219; font-size: .57rem; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.orange-workflow code { color: #4a3a31; font: 750 .65rem/1.6 var(--mono); white-space: normal; overflow-wrap: anywhere; }
.orange-workflow > p { margin: 0; padding: 22px 23px; color: #5f5149; background: #fffdf9; font-size: .65rem; line-height: 1.6; }
.orange-resources { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 16px; margin-top: 18px; }
.orange-resource { display: grid; grid-template-rows: 1fr auto; min-width: 0; background: white; border: 1px solid #d8dcde; border-top: 4px solid #e87b25; }
.orange-resource.is-video { border-top-color: #c7473c; }
.orange-resource > div { padding: 21px 20px 18px; }
.orange-resource small { color: #a75a25; font-size: .53rem; font-weight: 850; letter-spacing: .065em; text-transform: uppercase; }
.orange-resource.is-video small { color: #a43d36; }
.orange-resource h4 { margin: 8px 0 10px; font-family: var(--heading); font-size: 1.05rem; line-height: 1.15; }
.orange-resource p { margin: 0; color: var(--muted); font-size: .64rem; line-height: 1.55; }
.orange-resource > a { display: flex; align-items: center; justify-content: space-between; min-height: 49px; padding: 12px 20px; color: #a95219; background: #fff7ef; border-top: 1px solid #eadbce; font-size: .61rem; font-weight: 850; text-decoration: none; }
.orange-resource.is-video > a { color: #9b3933; background: #fff3f2; border-top-color: #edd5d3; }
.orange-resource > a:hover, .orange-resource > a:focus-visible { color: white; background: #c95f16; outline: 0; }
.orange-resource.is-video > a:hover, .orange-resource.is-video > a:focus-visible { background: #a43d36; }
.lesson-supplement { margin-top: 92px; }
.lesson-supplement > header { display: grid; grid-template-columns: minmax(0,1fr) minmax(280px,.8fr); gap: 8px 34px; align-items: end; padding-bottom: 23px; border-bottom: 1px solid var(--line); }
.lesson-supplement > header > p { grid-column: 1 / -1; margin: 0; color: var(--accent); font-size: .63rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.lesson-supplement > header h3 { margin: 0; font-family: var(--heading); font-size: clamp(1.9rem,3.2vw,2.75rem); font-weight: 600; line-height: 1.06; letter-spacing: -.025em; }
.lesson-supplement > header span { color: var(--muted); font-size: .69rem; line-height: 1.6; }
.concept-sequence { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 24px 0 0; padding: 0; background: white; border: 1px solid #d6dde0; list-style: none; }
.concept-sequence li { display: grid; align-content: start; gap: 8px; min-height: 205px; padding: 23px 20px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.concept-sequence li:nth-child(3n) { border-right: 0; }
.concept-sequence li:nth-last-child(-n+3) { border-bottom: 0; }
.concept-sequence li b { color: var(--accent); font-size: .61rem; letter-spacing: .08em; }
.concept-sequence li strong { font-family: var(--heading); font-size: 1rem; }
.concept-sequence li span { color: var(--muted); font-size: .66rem; line-height: 1.5; }
.concept-sequence li code { align-self: end; margin-top: 10px; padding: 9px 10px; color: #33434a; background: #f1f4f5; border-left: 3px solid var(--accent); font: 650 .57rem/1.5 var(--mono); white-space: normal; }
.attention-calculation { margin-top: 24px; }
.attention-published { display: grid; grid-template-columns: minmax(280px,.72fr) minmax(0,1fr); gap: 24px; padding: 25px; background: white; border: 1px solid #d6dde0; }
.attention-published > figure { display: grid; justify-items: center; gap: 12px; margin: 0; padding: 18px; background: #f8f9f9; border: 1px solid #e0e5e7; }
.attention-published img { display: block; width: 100%; max-width: 390px; height: auto; }
.attention-published figcaption { justify-self: stretch; color: #7a8589; font-size: .55rem; font-weight: 700; line-height: 1.45; text-align: right; }
.attention-vocabulary { display: grid; align-content: center; gap: 13px; }
.attention-vocabulary section { display: grid; grid-template-columns: 58px 1fr; gap: 14px; align-items: center; padding: 17px 18px; background: #f4f7f8; border-left: 4px solid var(--accent); }
.attention-vocabulary b { display: grid; place-items: center; width: 50px; height: 50px; color: white; background: var(--accent); border-radius: 50%; font: 800 .86rem/1 var(--mono); }
.attention-vocabulary section:nth-child(2) { border-left-color: var(--purple); }
.attention-vocabulary section:nth-child(2) b { background: var(--purple); }
.attention-vocabulary section:nth-child(3) { border-left-color: var(--green); }
.attention-vocabulary section:nth-child(3) b { background: var(--green); }
.attention-vocabulary div { display: grid; gap: 4px; }
.attention-vocabulary strong { font-family: var(--heading); font-size: .91rem; }
.attention-vocabulary span { color: var(--muted); font-size: .63rem; line-height: 1.5; }
.attention-formula { display: grid; grid-template-columns: 170px minmax(0,1fr); gap: 22px; align-items: center; margin-top: 18px; padding: 18px 20px; color: #eff5f7; background: var(--navy); }
.attention-formula > p { margin: 0; color: #b6c9d0; font-size: .58rem; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.attention-formula .math { color: white; font-size: 1rem; }
.attention-table { margin-top: 20px; }
.attention-table table { min-width: 920px; }
.attention-table th, .attention-table td { text-align: center; }
.attention-table th:first-child { text-align: left; }
.attention-table td:last-child strong { color: var(--accent); font-size: .8rem; }
.inline-math { white-space: nowrap; }
.attention-steps { display: grid; grid-template-columns: 1fr 1fr; margin: 22px 0 0; padding: 0; background: white; border: 1px solid #d6dde0; list-style: none; }
.attention-steps li { min-width: 0; padding: 21px 22px 23px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.attention-steps li:nth-child(2n) { border-right: 0; }
.attention-steps li:nth-last-child(-n+2) { border-bottom: 0; }
.attention-steps h4 { margin: 0; color: var(--accent); font-family: var(--heading); font-size: .94rem; }
.attention-steps .math { margin-top: 10px; font-size: .78rem; }
.attention-steps p { margin: 8px 0 0; color: var(--muted); font-size: .63rem; line-height: 1.55; }
.attention-takeaway { display: grid; grid-template-columns: 210px 1fr; gap: 18px; margin: 18px 0 0; padding: 18px 20px; color: #40534b; background: var(--green-soft); border-left: 4px solid var(--green); font-size: .66rem; line-height: 1.55; }
.prompt-comparison { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; margin-top: 24px; }
.prompt-comparison article { display: grid; grid-template-rows: auto 1fr auto; min-width: 0; background: white; border: 1px solid #d6dde0; }
.prompt-comparison article > div { min-height: 146px; padding: 21px 20px 17px; border-bottom: 1px solid var(--line); }
.prompt-comparison small { color: var(--accent); font-size: .58rem; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.prompt-comparison h4 { margin: 5px 0 8px; font-family: var(--heading); font-size: 1.18rem; }
.prompt-comparison p { margin: 0; color: var(--muted); font-size: .63rem; line-height: 1.5; }
.prompt-comparison pre, .codex-start pre { min-width: 0; margin: 0; padding: 19px 18px; overflow-x: auto; color: #e9eef0; background: #20292d; font: 500 .57rem/1.6 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
.prompt-comparison article > section { display: grid; gap: 6px; padding: 15px 18px 18px; background: #f1f5f2; border-top: 1px solid #d6e1dc; }
.prompt-comparison article > section b { color: #477260; font-size: .58rem; text-transform: uppercase; letter-spacing: .05em; }
.prompt-comparison article > section code { color: #35453f; font: 650 .57rem/1.45 var(--mono); overflow-wrap: anywhere; }
.supplement-takeaway { display: grid; grid-template-columns: 160px 1fr; gap: 20px; margin: 18px 0 0; padding: 17px 20px; color: #42535a; background: var(--gold-soft); border-left: 4px solid var(--gold); font-size: .67rem; }
.trace-table { margin-top: 24px; }
.trace-table table { min-width: 820px; }
.trace-table th:first-child { width: 110px; }
.agent-anatomy { display: grid; grid-template-columns: .8fr 1.05fr 1fr; grid-template-areas: "inputs core resources" "controls controls output"; gap: 18px; margin-top: 24px; padding: 24px; background: #eef1f2; border: 1px solid #d6dde0; }
.agent-anatomy > div { display: grid; align-content: start; gap: 10px; }
.agent-anatomy > div > small { color: #6d7b80; font-size: .55rem; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
.agent-anatomy section, .agent-core, .agent-output { display: grid; gap: 5px; padding: 16px; background: white; border: 1px solid #cad5d9; }
.agent-anatomy strong { font-family: var(--heading); font-size: .84rem; }
.agent-anatomy span { color: var(--muted); font-size: .61rem; line-height: 1.5; }
.agent-inputs { grid-area: inputs; }
.agent-core { grid-area: core; place-content: center; min-height: 180px; text-align: center; background: var(--purple-soft) !important; border: 2px solid #a99bcf !important; }
.agent-resources { grid-area: resources; }
.agent-controls { grid-area: controls; grid-template-columns: repeat(3,minmax(0,1fr)); }
.agent-controls > small { grid-column: 1 / -1; }
.agent-controls section { border-top: 3px solid var(--gold); }
.agent-output { grid-area: output; place-content: center; text-align: center; background: var(--green-soft) !important; border: 2px solid #90bca9 !important; }
.codex-start { display: grid; grid-template-columns: minmax(0,1fr) minmax(320px,.9fr); gap: 20px; margin-top: 24px; }
.codex-start > ol { display: grid; grid-template-columns: 1fr 1fr; margin: 0; padding: 0; background: white; border: 1px solid #d6dde0; list-style: none; }
.codex-start > ol li { display: grid; grid-template-columns: 38px 1fr; gap: 10px; min-height: 112px; padding: 17px 15px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.codex-start > ol li:nth-child(2n) { border-right: 0; }
.codex-start > ol li:nth-last-child(-n+2) { border-bottom: 0; }
.codex-start > ol b { color: var(--accent); font-size: .59rem; }
.codex-start > ol div { display: grid; align-content: start; gap: 5px; }
.codex-start > ol strong { font-family: var(--heading); font-size: .82rem; }
.codex-start > ol span { color: var(--muted); font-size: .61rem; line-height: 1.5; }
.codex-start > section { min-width: 0; background: #20292d; }
.codex-start > section > p { margin: 0; padding: 14px 18px; color: #b8c8ce; border-bottom: 1px solid #455158; font-size: .58rem; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.codex-start > ul { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.codex-start > ul li { padding: 13px 15px; color: #4b5c63; background: #f1f4f5; border-left: 3px solid var(--accent); font-size: .62rem; line-height: 1.5; }
.orchestration-visual { display: grid; justify-items: center; gap: 0; padding: 34px 28px 40px; background: #f3f4f2; }
.orchestration-visual section { display: grid; gap: 5px; width: min(100%,620px); padding: 17px 19px; text-align: center; background: white; border: 1px solid #cbd5d9; }
.orchestration-visual section small { color: var(--accent); font-size: .55rem; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.orchestration-visual section strong { font-family: var(--heading); font-size: .9rem; }
.orchestration-visual section span { color: var(--muted); font-size: .61rem; line-height: 1.5; }
.orchestration-manager { border-top: 4px solid var(--accent) !important; }
.orchestration-workers { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; width: 100%; }
.orchestration-workers section { width: auto; min-height: 112px; border-top: 4px solid #8b7bb4; }
.orchestration-synthesis { border-top: 4px solid var(--gold) !important; }
.orchestration-owner { max-width: 440px; background: var(--green-soft) !important; border: 2px solid #90bca9 !important; }
.orchestration-arrow { display: grid; justify-items: center; gap: 0; padding: 5px 0; color: var(--accent); font-size: 1.2rem; font-weight: 900; line-height: 1; }
.orchestration-arrow span { color: #78868b; font-size: .51rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.taxonomy-visual { display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); gap: 1px; background: #dce1e3; }
.taxonomy-group { min-height: 170px; padding: 22px; background: #f7f9f9; border-top: 5px solid var(--blue); }
.taxonomy-group.tone-purple { border-top-color: var(--purple); background: var(--purple-soft); }
.taxonomy-group.tone-green { border-top-color: var(--green); background: var(--green-soft); }
.taxonomy-group.tone-gold { border-top-color: var(--gold); background: var(--gold-soft); }
.taxonomy-group h4 { margin: 0; font-family: var(--heading); font-size: 1rem; }
.taxonomy-group ul { margin: 13px 0 0; padding-left: 18px; }
.taxonomy-group li { margin: 7px 0; color: var(--muted); font-size: .68rem; }
.flow-visual { display: grid; grid-template-columns: repeat(auto-fit,minmax(145px,1fr)); gap: 25px; padding: 34px 28px 38px; background-image: linear-gradient(#eef1f2 1px,transparent 1px); background-size: 100% 35px; }
.flow-node { position: relative; min-height: 145px; padding: 17px; background: rgba(255,255,255,.96); border: 1px solid #cdd7db; }
.flow-node:not(:last-child):after { content: "→"; position: absolute; right: -20px; top: 48%; color: var(--accent); font-weight: 900; }
.flow-node span, .bridge-step > span { color: #8a969b; font: 750 .56rem/1 var(--mono); }
.flow-node strong, .flow-node small { display: block; }
.flow-node strong { margin-top: 22px; font-family: var(--heading); font-size: .96rem; }
.flow-node small { margin-top: 7px; color: var(--muted); font-size: .63rem; line-height: 1.4; }
.matrix-visual { display: grid; grid-template-columns: minmax(155px,.7fr) repeat(var(--matrix-cols),minmax(145px,1fr)); gap: 1px; margin: 28px; background: #d4dcdf; border: 1px solid #d4dcdf; }
.matrix-axis, .matrix-heading, .matrix-row-label { display: grid; align-items: center; min-height: 58px; padding: 12px; background: #f2f5f6; color: #59686e; font-size: .62rem; font-weight: 750; }
.matrix-heading { justify-items: center; text-align: center; }
.matrix-cell { display: grid; place-items: center; align-content: center; min-height: 125px; padding: 15px; background: #e8f0f3; text-align: center; }
.matrix-cell.tone-good { background: #dcefe7; }
.matrix-cell.tone-warn { background: #f5ead8; }
.matrix-cell.tone-risk { background: #f5dddf; }
.matrix-cell strong { font-size: 1.4rem; }
.matrix-cell span { margin-top: 6px; color: #59686e; font-size: .61rem; }
.fold-visual { padding: 31px; }
.fold-dataset { padding: 8px; color: #536269; background: #eff2f3; border: 1px solid #d3dadd; text-align: center; font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.fold-row { display: grid; grid-template-columns: 70px repeat(5,1fr); gap: 4px; margin-top: 8px; align-items: center; }
.fold-row > span { color: #69777c; font-size: .6rem; }
.fold-row i { padding: 9px 3px; color: #41616f; background: #dcebf1; font: 750 .55rem/1 var(--mono); text-align: center; font-style: normal; }
.fold-row i.is-validation { color: #754e16; background: #f4d69e; }
.fold-visual > p { margin: 18px 0 0 70px; color: var(--muted); font-size: .65rem; }
.tree-visual { max-width: 780px; margin: 0 auto; padding: 36px 30px 42px; text-align: center; }
.tree-root, .tree-child { padding: 17px; border: 1px solid #afc1c8; background: #eef5f7; }
.tree-root { position: relative; max-width: 430px; margin: 0 auto 66px; }
.tree-root:after { content: ""; position: absolute; left: 50%; bottom: -67px; width: 1px; height: 66px; background: #8ea0a8; }
.tree-root strong, .tree-root span, .tree-child strong, .tree-child span, .tree-child small { display: block; }
.tree-root span, .tree-child span { margin-top: 5px; color: var(--muted); font-size: .63rem; }
.tree-children { position: relative; display: grid; grid-template-columns: repeat(2,1fr); gap: 70px; }
.tree-children:before { content: ""; position: absolute; top: -34px; left: 25%; right: 25%; height: 1px; background: #8ea0a8; }
.tree-child { position: relative; min-height: 125px; }
.tree-child:before { content: ""; position: absolute; left: 50%; top: -34px; width: 1px; height: 33px; background: #8ea0a8; }
.tree-child.tone-risk { background: var(--red-soft); border-color: #d7a9ad; }
.tree-child.tone-good { background: var(--green-soft); border-color: #a7cbbd; }
.tree-child small { color: #65747a; font-size: .56rem; font-weight: 800; text-transform: uppercase; }
.tree-child strong { margin-top: 8px; }
.network-visual { display: flex; gap: 45px; align-items: stretch; justify-content: center; padding: 38px 30px 44px; }
.network-layer { position: relative; min-width: 175px; text-align: center; }
.network-layer h4 { margin: 0 0 14px; color: #617077; font-size: .62rem; text-transform: uppercase; letter-spacing: .07em; }
.network-layer > div { display: grid; gap: 13px; }
.network-layer span { padding: 14px 12px; background: #ecf3f6; border: 1px solid #b8ccd4; border-radius: 999px; font-size: .67rem; }
.network-layer:nth-child(2) span { background: var(--purple-soft); border-color: #c6bce1; }
.network-layer:last-child span { background: var(--green-soft); border-color: #a7cbbd; }
.network-layer > i { position: absolute; right: -32px; top: 53%; color: var(--accent); font-style: normal; font-weight: 900; }
.annotated-image-visual { background: white; }
.annotated-image-visual > div { display: grid; gap: 9px; justify-items: center; padding: 30px 34px 24px; }
.annotated-image-visual img { display: block; width: 100%; height: auto; max-width: 1100px; }
.annotated-image-visual small { justify-self: end; color: #7a8589; font-size: .55rem; font-weight: 700; }
.annotated-image-visual ol { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); margin: 0; padding: 0; border-top: 1px solid var(--line); list-style: none; }
.annotated-image-visual li { display: grid; align-content: start; gap: 7px; padding: 20px 18px 24px; border-right: 1px solid var(--line); }
.annotated-image-visual li:last-child { border-right: 0; }
.annotated-image-visual li strong { color: var(--accent); font-family: var(--heading); font-size: .82rem; }
.annotated-image-visual li span { color: var(--muted); font-size: .64rem; line-height: 1.55; }
.bridge-visual { display: grid; grid-template-columns: repeat(auto-fit,minmax(120px,1fr)); gap: 24px; padding: 35px 27px 40px; background-image: linear-gradient(#eef1f2 1px,transparent 1px); background-size: 100% 36px; }
.bridge-step { position: relative; min-height: 130px; padding: 15px; background: white; border-top: 5px solid var(--blue); box-shadow: 0 5px 15px rgba(35,53,61,.09); }
.bridge-step:not(:last-child):after { content: "→"; position: absolute; right: -20px; top: 43%; color: #78878d; font-weight: 900; }
.bridge-step.tone-good { border-top-color: var(--green); }
.bridge-step.tone-risk { border-top-color: var(--red); }
.bridge-step.tone-dark { color: white; border-top-color: var(--navy); background: var(--navy); }
.bridge-step strong, .bridge-step small { display: block; }
.bridge-step strong { margin-top: 20px; font-size: .92rem; }
.bridge-step small { margin-top: 5px; color: var(--muted); font-size: .59rem; line-height: 1.35; }
.bridge-step.tone-dark small { color: #c5d0d4; }
.comparison-visual { overflow-x: auto; padding: 25px 28px 30px; }
.comparison-visual table { min-width: 760px; border: 1px solid #d7dddf; }
.comparison-visual th, .comparison-visual td { padding: 14px 15px; }
.time-visual { display: grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap: 10px; padding: 30px; background: #f5f7f7; }
.time-visual section { min-height: 155px; padding: 18px; border-top: 6px solid var(--blue); background: white; box-shadow: 0 5px 15px rgba(35,53,61,.07); }
.time-visual section.tone-gold { border-top-color: var(--gold); }
.time-visual section.tone-green { border-top-color: var(--green); }
.time-visual section.tone-purple { border-top-color: var(--purple); }
.time-visual strong, .time-visual span, .time-visual small { display: block; }
.time-visual strong { font-family: var(--heading); font-size: 1rem; }
.time-visual span { margin-top: 19px; color: var(--accent); font: 800 .65rem/1.2 var(--mono); }
.time-visual small { margin-top: 8px; color: var(--muted); font-size: .63rem; line-height: 1.45; }
.worked-example { margin-top: 105px; border-top: 5px solid var(--accent); }
.worked-example > header { padding: 27px 0 24px; }
.worked-example header h3, .practice-lab header h3, .knowledge-check h3 { margin: 8px 0 12px; font-family: var(--heading); font-size: clamp(2rem,3.7vw,3.1rem); font-weight: 600; line-height: 1.05; letter-spacing: -.035em; }
.worked-example header > span, .practice-lab header > span { display: block; max-width: 820px; color: var(--muted); font-size: .83rem; }
.table-scroll { overflow-x: auto; border-top: 1px solid #bfc5c7; border-bottom: 1px solid #bfc5c7; }
table { width: 100%; min-width: 680px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
th, td { padding: 11px 12px; border-bottom: 1px solid #e2e2dd; color: #4c5a60; font-size: .68rem; line-height: 1.45; text-align: left; vertical-align: top; }
thead th { color: #5b676c; background: #f1f1ed; font-size: .57rem; letter-spacing: .05em; text-transform: uppercase; }
tbody th { color: #2d414a; font-weight: 750; }
tbody tr:last-child > * { border-bottom: 0; }
.worked-steps { margin-top: 30px; border-top: 1px solid var(--line); }
.worked-steps article { display: grid; grid-template-columns: 42px minmax(0,1fr); gap: 17px; padding: 21px 0; border-bottom: 1px solid var(--line); }
.worked-steps article > span { color: var(--accent); font: 750 .6rem/1.6 var(--mono); }
.worked-steps h4 { margin: 0 0 5px; font-family: var(--heading); font-size: 1rem; }
.worked-steps article div > strong { color: #27424d; font-size: .76rem; }
.worked-steps p { margin: 5px 0 0; color: var(--muted); font-size: .7rem; }
.worked-steps p b { color: var(--accent); }
.worked-takeaway { display: grid; grid-template-columns: 170px 1fr; gap: 20px; margin: 26px 0 0; padding: 18px 20px; background: #f1f5f6; border-left: 4px solid var(--accent); color: #4d5d63; font-size: .74rem; }
.worked-takeaway strong { color: var(--accent); font-size: .6rem; letter-spacing: .07em; text-transform: uppercase; }
.practice-lab { margin-top: 105px; border: 1px solid #ccd9de; background: #f7fafb; }
.practice-lab > header { padding: 29px 30px 27px; border-bottom: 1px solid #d5e0e4; }
.practice-lab > .table-scroll { margin: 0 30px 4px; }
.lab-tasks { padding: 25px 30px; }
.lab-tasks h4, .lab-solution h4 { margin: 0; font-family: var(--heading); font-size: 1.15rem; }
.lab-tasks > p { margin: 6px 0 0; color: var(--muted); font-size: .68rem; }
.lab-tasks ol { margin: 13px 0 0; padding-left: 23px; }
.lab-tasks li { margin: 15px 0 22px; color: #4c5d64; font-size: .76rem; }
.lab-tasks label, .lab-tasks label strong { display: block; }
.lab-tasks label strong { font-weight: 700; line-height: 1.45; }
.lab-tasks textarea { width: 100%; min-height: 74px; margin-top: 9px; padding: 11px 12px; color: var(--ink); background: white; border: 1px solid #cbd6da; border-radius: 2px; font: 500 .72rem/1.45 var(--body); resize: vertical; }
.lab-tasks textarea:focus { outline: 3px solid rgba(47,111,143,.18); border-color: var(--blue); }
.lab-hint, .lab-solution { margin: 0 30px 18px; border: 1px solid; }
.lab-hint { background: var(--gold-soft); border-color: #dfc99f; }
.lab-solution { margin-bottom: 30px; background: var(--green-soft); border-color: #b9d5ca; }
.lab-hint summary, .lab-solution summary { padding: 15px 17px; cursor: pointer; font-size: .68rem; font-weight: 850; letter-spacing: .04em; }
.lab-hint summary { color: #785724; }
.lab-solution summary { color: #2f6651; }
.lab-hint[open] summary, .lab-solution[open] summary { border-bottom: 1px solid currentColor; }
.lab-hint p { margin: 0; padding: 17px; color: #685b48; font-size: .72rem; }
.lab-solution > div { padding: 19px 20px 21px; }
.lab-solution h4 { color: #2d5143; line-height: 1.4; }
.lab-solution ol { margin: 16px 0 0; padding-left: 23px; }
.lab-solution li { margin: 9px 0; color: #405c51; font-size: .75rem; }
.knowledge-check { margin-top: 85px; padding: 26px 28px; border-top: 4px solid var(--accent); background: var(--paper-2); }
.knowledge-check h3 { max-width: 850px; font-size: clamp(1.55rem,2.7vw,2.2rem); }
.check-options { list-style: none; margin: 22px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
.check-options li { color: #536269; border: 1px solid #d5d3cc; background: white; font-size: .72rem; }
.check-options label { display: grid; grid-template-columns: auto 30px 1fr; gap: 9px; align-items: center; min-height: 54px; padding: 10px 12px; cursor: pointer; }
.check-options input { width: 16px; height: 16px; accent-color: var(--accent); }
.check-options label b { font-weight: 600; }
.check-options li span { display: grid; place-items: center; width: 26px; height: 26px; color: var(--accent); background: #eef1f2; border-radius: 50%; font: 750 .61rem/1 var(--mono); }
.check-options li.is-correct { border-color: #8eb9a8; background: var(--green-soft); }
.check-options li.is-correct span { color: white; background: var(--green); }
.check-options li.is-incorrect { border-color: #d6a3a7; background: var(--red-soft); }
.knowledge-check > button { margin-top: 15px; padding: 10px 15px; color: white; background: var(--accent); border: 0; font: 800 .65rem/1 var(--body); cursor: pointer; }
.knowledge-check > button:focus { outline: 3px solid rgba(47,111,143,.25); outline-offset: 2px; }
.check-answer { margin: 15px 0 0; padding: 14px 16px; color: #42584f; background: #deeee7; font-size: .72rem; }
.check-answer.is-error { color: #77353a; background: var(--red-soft); }
.video-support { display: grid; grid-template-columns: 1fr 1.1fr auto; gap: 27px; align-items: center; margin-top: 70px; padding: 23px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.video-support h3 { margin: 5px 0 0; font-family: var(--heading); font-size: 1.1rem; }
.video-support > div > span { color: var(--muted); font-size: .63rem; }
.video-support > p { margin: 0; color: var(--muted); font-size: .68rem; }
.video-support > a { padding: 8px 10px; color: white; background: var(--accent); font-size: .64rem; font-weight: 750; text-decoration: none; white-space: nowrap; }
.chapter-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 35px; margin-top: 75px; padding-top: 25px; border-top: 1px solid var(--line); }
.chapter-footer ul { list-style: none; margin: 11px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px 10px; }
.chapter-footer li { color: #6a767b; font-size: .61rem; }
.chapter-footer > a { grid-column: 1 / -1; padding-top: 13px; border-top: 1px solid #e1dfda; text-align: right; font-size: .65rem; font-weight: 750; text-decoration: none; }
.empty-state { display: none; padding: 90px 30px; text-align: center; }
.empty-state.is-visible { display: block; }
.empty-state h2 { font-family: var(--heading); font-size: 2.5rem; }
.site-footer { padding: 42px clamp(28px,7vw,105px); color: white; background: var(--navy); }
.site-footer div { max-width: 1250px; margin: 0 auto; display: flex; justify-content: space-between; gap: 30px; }
.site-footer strong { font-family: var(--heading); font-size: 1.2rem; }
.site-footer p { max-width: 750px; margin: 0; color: #bac7cc; font-size: .69rem; }
@media (max-width: 1120px) {
  .book { grid-template-columns: 270px minmax(0,1fr); }
  .lesson-method { grid-template-columns: repeat(3,1fr); }
  .lesson-method div:nth-child(4), .lesson-method div:nth-child(5) { border-top: 1px solid var(--line); }
  .semester-phases { grid-template-columns: 1fr 1fr; }
  .semester-phase:last-child { grid-column: 1 / -1; }
}
@media (max-width: 820px) {
  body { font-size: 16px; }
  .topbar-inner { grid-template-columns: 1fr auto; padding: 9px 15px; }
  .search { grid-column: 1 / -1; grid-row: 2; }
  .menu-button { display: block; }
  .unit-grid { grid-template-columns: 1fr; }
  .semester-phases, .study-priorities { grid-template-columns: 1fr; }
  .semester-phase:last-child { grid-column: auto; }
  .study-priorities > * { border-right: 0; border-bottom: 1px solid #dedfdc; }
  .study-priorities > *:last-child { border-bottom: 0; }
  .lesson-method { grid-template-columns: 1fr; }
  .book { grid-template-columns: 1fr; }
  .sidebar { display: none; position: fixed; z-index: 90; inset: 112px 0 0; overflow-y: auto; background: rgba(240,238,232,.98); }
  .sidebar.is-open { display: block; }
  .sidebar-inner { position: static; max-height: none; }
  .unit-divider { grid-template-columns: 70px 1fr; padding: 55px 26px; }
  .unit-divider > span { font-size: 4rem; }
  .chapter-header, .chapter-body { padding-left: 25px; padding-right: 25px; }
  .lesson-prep, .lesson-outline ol, .lesson-figure figcaption, .reference-visuals > header, .reference-visuals > div, .orange-practice > header, .orange-workflow, .lesson-supplement > header, .check-options, .chapter-footer, .video-support { grid-template-columns: 1fr; }
  .reference-visuals .visual-frame { min-height: 0; padding: 14px; }
  .concept-sequence { grid-template-columns: 1fr 1fr; }
  .concept-sequence li:nth-child(3n) { border-right: 1px solid var(--line); }
  .concept-sequence li:nth-child(2n) { border-right: 0; }
  .concept-sequence li:nth-last-child(-n+3) { border-bottom: 1px solid var(--line); }
  .concept-sequence li:nth-last-child(-n+2) { border-bottom: 0; }
  .attention-published, .attention-formula { grid-template-columns: 1fr; }
  .attention-published img { max-width: 470px; }
  .attention-steps { grid-template-columns: 1fr; }
  .attention-steps li, .attention-steps li:nth-child(2n) { border-right: 0; border-bottom: 1px solid var(--line); }
  .attention-steps li:last-child { border-bottom: 0; }
  .attention-takeaway { grid-template-columns: 1fr; gap: 5px; }
  .prompt-comparison, .codex-start { grid-template-columns: 1fr; }
  .prompt-comparison article > div { min-height: 0; }
  .supplement-takeaway { grid-template-columns: 1fr; gap: 4px; }
  .agent-anatomy { grid-template-columns: 1fr 1fr; grid-template-areas: "inputs core" "resources output" "controls controls"; }
  .codex-start > ul { grid-template-columns: 1fr; }
  .orchestration-workers { grid-template-columns: 1fr; }
  .flow-visual, .bridge-visual { grid-template-columns: 1fr; }
  .flow-node:not(:last-child):after, .bridge-step:not(:last-child):after { content: "↓"; right: 50%; top: auto; bottom: -25px; transform: translateX(50%); }
  .matrix-visual { min-width: 640px; }
  .figure-matrix { overflow-x: auto; }
  .network-visual { flex-direction: column; }
  .network-layer > i { right: 50%; top: auto; bottom: -34px; transform: translateX(50%) rotate(90deg); }
  .annotated-image-visual ol { grid-template-columns: 1fr 1fr; }
  .annotated-image-visual li:nth-child(2) { border-right: 0; }
  .annotated-image-visual li:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .worked-takeaway { grid-template-columns: 1fr; gap: 5px; }
  .practice-lab > .table-scroll, .lab-hint, .lab-solution { margin-left: 20px; margin-right: 20px; }
  .video-support > a { justify-self: start; }
  .site-footer div { flex-direction: column; }
}
@media (max-width: 540px) {
  .hero { min-height: 0; padding-left: 24px; padding-right: 24px; }
  .hero h1 { font-size: 3.6rem; }
  .course-map { padding-left: 20px; padding-right: 20px; }
  .unit-divider { grid-template-columns: 1fr; }
  .chapter-header h2 { font-size: 3.1rem; }
  .semester-phase li { grid-template-columns: 1fr; gap: 4px; }
  .optional-deep-dive > summary { grid-template-columns: 1fr; }
  .optional-deep-dive > summary small { grid-column: 1; }
  .concept-sequence { grid-template-columns: 1fr; }
  .concept-sequence li, .concept-sequence li:nth-child(2n), .concept-sequence li:nth-child(3n) { min-height: 0; border-right: 0; border-bottom: 1px solid var(--line); }
  .concept-sequence li:last-child { border-bottom: 0; }
  .agent-anatomy { grid-template-columns: 1fr; grid-template-areas: "inputs" "core" "resources" "controls" "output"; padding: 14px; }
  .agent-controls { grid-template-columns: 1fr; }
  .codex-start > ol { grid-template-columns: 1fr; }
  .codex-start > ol li, .codex-start > ol li:nth-child(2n) { border-right: 0; border-bottom: 1px solid var(--line); }
  .codex-start > ol li:last-child { border-bottom: 0; }
  .annotated-image-visual > div { padding: 16px 12px; }
  .annotated-image-visual ol { grid-template-columns: 1fr; }
  .annotated-image-visual li, .annotated-image-visual li:nth-child(2) { border-right: 0; border-bottom: 1px solid var(--line); }
  .annotated-image-visual li:last-child { border-bottom: 0; }
  .tree-children { gap: 22px; }
  .fold-row { grid-template-columns: 54px repeat(5,minmax(48px,1fr)); }
  .fold-visual { overflow-x: auto; }
  .fold-visual > * { min-width: 540px; }
}
@media print {
  .topbar, .sidebar, .site-footer, .video-support { display: none !important; }
  body, .book { background: white; box-shadow: none; }
  .book { display: block; }
  .hero { min-height: 0; padding: 30px 0; color: #000; background: white; border-bottom: 2px solid #000; }
  .hero h1, .hero > .hero-inner > p:last-of-type { color: #000; }
  .course-map { padding: 30px 0; }
  .chapter { break-before: page; border: 0; }
  .chapter-header, .chapter-body { padding-left: 0; padding-right: 0; }
  .practice-lab, .lesson-figure, .orange-practice, .worked-example { break-inside: avoid; }
}
`;

const script = `
(() => {
  const search = document.getElementById("course-search");
  const chapters = [...document.querySelectorAll("[data-chapter]")];
  const unitDividers = [...document.querySelectorAll("[data-unit-divider]")];
  const empty = document.getElementById("empty-state");
  const menuButton = document.querySelector("[data-menu-toggle]");
  const sidebar = document.querySelector(".sidebar");

  const applySearch = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    chapters.forEach((chapter) => {
      const match = !query || chapter.dataset.search.includes(query);
      chapter.hidden = !match;
      if (match) visible += 1;
    });
    unitDividers.forEach((divider) => {
      divider.hidden = !chapters.some((chapter) => chapter.dataset.unit === divider.dataset.unitDivider && !chapter.hidden);
    });
    empty.classList.toggle("is-visible", visible === 0);
  };

  search.addEventListener("input", applySearch);
  menuButton?.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest("a") && window.innerWidth <= 820) {
      sidebar.classList.remove("is-open");
      menuButton?.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll("[data-knowledge-check]").forEach((form) => {
    const button = form.querySelector("[data-check-answer]");
    const feedback = form.querySelector("[data-check-feedback]");
    button?.addEventListener("click", () => {
      const selected = form.querySelector("input[type=radio]:checked");
      form.querySelectorAll("[data-option]").forEach((option) => option.classList.remove("is-correct", "is-incorrect"));
      feedback.classList.remove("is-error");
      feedback.hidden = false;
      if (!selected) {
        feedback.innerHTML = "<strong>Select an answer first.</strong> Then check your reasoning.";
        feedback.classList.add("is-error");
        return;
      }
      const correct = Number(form.dataset.answer);
      const chosen = Number(selected.value);
      form.querySelector('[data-option="' + correct + '"]')?.classList.add("is-correct");
      if (chosen !== correct) {
        form.querySelector('[data-option="' + chosen + '"]')?.classList.add("is-incorrect");
        feedback.classList.add("is-error");
      }
      const prefix = chosen === correct ? "<strong>Correct.</strong> " : "<strong>Not quite.</strong> ";
      feedback.innerHTML = prefix;
      feedback.append(document.createTextNode(feedback.dataset.explanation));
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      const number = active.target.dataset.chapter;
      document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("is-current", link.dataset.nav === number));
    }, { rootMargin: "-20% 0px -65%", threshold: [0, .15, .4] });
    chapters.forEach((chapter) => observer.observe(chapter));
  }
})();`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An accessible, slide-grounded study reference for AMIS 4610: AI for Business Analytics.">
  <meta name="theme-color" content="#17252c">
  <title>AMIS 4610 · AI for Business Analytics</title>
  <script>
    window.MathJax = { tex: { inlineMath: [["\\\\(", "\\\\)"]], displayMath: [["\\\\[", "\\\\]"]], processEscapes: true }, chtml: { scale: .98 }, options: { enableMenu: false } };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js"></script>
  <style>${css}</style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to lesson content</a>
  <header class="topbar"><div class="topbar-inner">
    <a class="brand" href="#top"><span>AMIS 4610</span>AI for Business Analytics</a>
    <div class="search"><label for="course-search">Search the course</label><input id="course-search" type="search" placeholder="Search a concept, example, formula, or case…" autocomplete="off"></div>
    <button class="menu-button" type="button" data-menu-toggle aria-expanded="false">Contents</button>
  </div></header>
  <div id="top">
    <section class="hero"><div class="hero-inner">
      <p class="eyebrow">Slide-grounded course reference · Spring 2026</p>
      <h1>AI for <span>Business Analytics</span></h1>
      <p>A 15-week applied course for information-systems students: first learn how data-driven AI predicts business outcomes, then learn how language models become useful—and governable—business systems. Eighteen reference lessons support the teaching schedule, with required ideas, student artifacts, and optional technical deep dives clearly separated.</p>
      <div class="hero-route"><span>Data</span><i>→</i><span>Prediction</span><i>→</i><span>Language</span><i>→</i><span>Reasoning</span><i>→</i><span>Agents</span><i>→</i><span>Governance</span></div>
    </div></section>
    <section class="course-map" id="course-map"><header><p class="eyebrow">Course map</p><h2>15 teaching weeks. 18 reference lessons.</h2><p>Follow the weekly route for the semester. Use the fuller lesson library when you need another explanation, figure, Orange tutorial, worked example, or optional technical extension.</p></header>
      <section class="semester-route" aria-labelledby="semester-route-title"><header><p class="eyebrow">Recommended teaching route</p><h3 id="semester-route-title">Every week ends with something students can show, explain, or evaluate.</h3></header><div class="semester-phases">${semesterRoute}</div></section>
      <div class="lesson-method"><div><span>01</span><strong>Plain English</strong><small>What the idea means before notation appears.</small></div><div><span>02</span><strong>Mechanics</strong><small>Definitions, formulas, and assumptions.</small></div><div><span>03</span><strong>Explanatory figures</strong><small>Model behavior you can see before interpreting metrics.</small></div><div><span>04</span><strong>Worked example</strong><small>All inputs, calculations, and interpretation.</small></div><div><span>05</span><strong>Questions + feedback</strong><small>Write responses, reveal a hint, then compare with the answer.</small></div></div>
      <section class="reference-map" aria-labelledby="reference-map-title"><header><p class="eyebrow">Detailed reference</p><h3 id="reference-map-title">Browse the complete lesson library by course part.</h3><span>Lessons that share a teaching week remain separate here so each topic has enough explanation, figures, examples, and practice.</span></header><div class="unit-grid">${mapCards}</div></section>
    </section>
    <div class="book">
      <aside class="sidebar" aria-label="Course contents"><div class="sidebar-inner"><h2>Course contents</h2>${sidebar}</div></aside>
      <main class="main" id="main">${courseContent}<section class="empty-state" id="empty-state"><h2>No lesson matched that search.</h2><p>Try a broader term such as “classification,” “sentiment,” “RAG,” “agents,” or “evaluation.”</p></section></main>
    </div>
  </div>
  <footer class="site-footer"><div><strong>AMIS 4610 · AI for Business Analytics</strong><p>Course reference by Yuheng Hu. The sequence and cases are grounded in the provided Spring 2026 materials, with expanded explanations, examples, figures, labs, solutions, and current primary documentation for agentic AI.</p></div></footer>
  <script>${script}</script>
</body>
</html>`;

await writeFile(outputPath, html, "utf8");
console.log(`Wrote ${outputPath}`);
