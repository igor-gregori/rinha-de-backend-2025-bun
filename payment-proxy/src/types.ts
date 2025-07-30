export type Payment = {
  correlationId: string;
  amount: number;
  processedBy?: string;
};
