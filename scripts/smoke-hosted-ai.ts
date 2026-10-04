import "dotenv/config";
import { chatJsonWithHosted } from "../src/server/ai/clients";
import { runAnalysis } from "../src/server/ai/provider";

async function main() {
  const ping = await chatJsonWithHosted({
    system: 'Return ONLY JSON with keys ok (boolean) and vendor (string).',
    user: "Respond with ok true.",
    temperature: 0,
  });
  console.log(
    JSON.stringify(
      {
        ping: {
          endpointId: ping.endpointId,
          model: ping.model,
          contentPreview: ping.content.slice(0, 160),
        },
      },
      null,
      2,
    ),
  );

  const analysis = await runAnalysis({
    originalScope:
      "Landing page with hero, features, contact form. Includes two revision rounds. Does not include blog or SEO.",
    clientMessage:
      "Can we also add SEO pages and a blog before launch? Make it feel premium somehow.",
  });
  console.log(
    JSON.stringify(
      {
        analysis: {
          source: analysis.source,
          sourceDetail: analysis.sourceDetail,
          primaryOutcome: analysis.primaryOutcome,
          included: analysis.included.length,
          additional: analysis.additional.length,
          unclear: analysis.unclear.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
