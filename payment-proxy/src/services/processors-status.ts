import { db } from "../db";

export async function checkProcessorsStatus(): Promise<void> {
  const [defaultResponse, fallbackResponse] = await Promise.allSettled([
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`),
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`),
  ]);

  let defaultFailing = true;
  let defaultMinResponseTime = 0;
  let fallbackFailing = true;
  let fallbackMinResponseTime = 0;

  if (defaultResponse.status === "fulfilled" && defaultResponse.value.ok) {
    const body = (await defaultResponse.value.json()) as { failing: boolean; minResponseTime: number };
    defaultFailing = body.failing;
    defaultMinResponseTime = body.minResponseTime ?? 0;
  }

  if (fallbackResponse.status === "fulfilled" && fallbackResponse.value.ok) {
    const body = (await fallbackResponse.value.json()) as { failing: boolean; minResponseTime: number };
    fallbackFailing = body.failing;
    fallbackMinResponseTime = body.minResponseTime ?? 0;
  }

  const updateServiceStatusSql = db.prepare(
    "UPDATE serviceStatus SET defaultFailing = $defaultFailing, defaultMinResponseTime = $defaultMinResponseTime, fallbackFailing = $fallbackFailing, fallbackMinResponseTime = $fallbackMinResponseTime WHERE id = 1"
  );

  updateServiceStatusSql.run({
    $defaultFailing: defaultFailing,
    $defaultMinResponseTime: defaultMinResponseTime,
    $fallbackFailing: fallbackFailing,
    $fallbackMinResponseTime: fallbackMinResponseTime,
  });

  console.info("Services health status updated");
}
