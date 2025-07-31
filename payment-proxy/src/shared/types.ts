export type Payment = {
  correlationId: string;
  amount: number;
};

export type ProcessedPayment = {
  amount: number;
  processedBy: "default" | "fallback";
  timestamp: number;
};

export type ProcessorsStatus = {
  default: {
    failing: boolean;
    minResponseTime: number;
  };
  fallback: {
    failing: boolean;
    minResponseTime: number;
  };
};

export type MessageType =
  | "CREATE-PAYMENT-REQUEST"
  | "UPDATE-PROCESSORS-STATUS"
  | "GET-PAYMENT-SUMMARY-IN"
  | "GET-PAYMENT-SUMMARY-OUT";

export type PaymentsSummaryParams = {
  from: number;
  to: number;
};

export type MessagePayload = Payment | ProcessorsStatus | PaymentsSummaryParams | unknown;
