import type { ProcessorsStatus } from "../shared/types";

export async function checkProcessorsStatus(): Promise<ProcessorsStatus> {
  const [defaultResponse, fallbackResponse] = await Promise.allSettled([
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`),
    fetch(`${process.env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`),
  ]);

  const processorsStatus = {
    default: {
      failing: false,
      minResponseTime: 0,
    },
    fallback: {
      failing: false,
      minResponseTime: 0,
    },
  };

  if (defaultResponse.status === "fulfilled" && defaultResponse.value.ok) {
    const body = (await defaultResponse.value.json()) as { failing: boolean; minResponseTime: number };
    processorsStatus.default.failing = body.failing;
    processorsStatus.default.minResponseTime = body.minResponseTime;
  }

  if (fallbackResponse.status === "fulfilled" && fallbackResponse.value.ok) {
    const body = (await fallbackResponse.value.json()) as { failing: boolean; minResponseTime: number };
    processorsStatus.fallback.failing = body.failing;
    processorsStatus.fallback.minResponseTime = body.minResponseTime;
  }

  return processorsStatus;
}
