export type Payment = {
  correlationId: string;
  amount: number;
};

export type ProcessedPayment = {
  amount: number;
  processedBy: string;
  timestamp: Date;
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

export type MessageType = "CREATE-PAYMENT-REQUEST" | "UPDATE-PROCESSORS-STATUS" | "GET-PAYMENT-SUMMARY";

export type MessagePayload = Payment | ProcessorsStatus | unknown;
