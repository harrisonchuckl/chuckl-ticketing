import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/surveys/:id", async (req, res) => {
  const id = String(req.params.id);
  const survey = await prisma.crmSurvey.findFirst({
    where: { id },
    include: { questions: true },
  });

  if (!survey) return res.status(404).send("Survey not found");

  const now = new Date();
  if (survey.status === "CLOSED" || (survey.endsAt && survey.endsAt < now)) {
    return res.status(410).send("Survey closed");
  }

  const questionsHtml = survey.questions
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((q) => {
      const name = `q_${q.id}`;
      if (q.type === "rating" || q.type === "nps") {
        const max = q.type === "nps" ? 10 : 5;
        return `<label><div>${q.prompt}</div><input name="${name}" type="number" min="0" max="${max}" /></label>`;
      }
      if (q.type === "mc") {
        const options = Array.isArray(q.optionsJson) ? q.optionsJson : [];
        return `<fieldset><legend>${q.prompt}</legend>${options
          .map((opt) => `<label><input type="radio" name="${name}" value="${opt}" /> ${opt}</label>`)
          .join("<br/>")}</fieldset>`;
      }
      return `<label><div>${q.prompt}</div><textarea name="${name}"></textarea></label>`;
    })
    .join("<div style=\"margin:12px 0;\"></div>");

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${survey.name}</title>
  <style>
    body{font-family:system-ui, sans-serif;max-width:720px;margin:40px auto;padding:0 16px;}
    label, fieldset{display:block;margin:12px 0;}
    input, textarea{width:100%;padding:8px;}
    button{padding:10px 16px;}
  </style>
</head>
<body>
  <h1>${survey.name}</h1>
  <form method="POST" action="/public/surveys/${survey.id}/submit">
    ${questionsHtml}
    <button type="submit">Submit</button>
  </form>
</body>
</html>`);
});

router.post("/surveys/:id/submit", async (req, res) => {
  const id = String(req.params.id);
  const survey = await prisma.crmSurvey.findFirst({ where: { id } });
  if (!survey) return res.status(404).send("Survey not found");

  const answers = Object.entries(req.body || {}).reduce((acc: any, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

  await prisma.crmSurveyResponse.create({
    data: {
      surveyId: id,
      answersJson: answers,
    },
  });

  res.send("Thank you for your feedback.");
});

export default router;
