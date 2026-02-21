/** SMS provider interface — swap implementations via env var */
export interface SmsProvider {
  send(to: string, body: string): Promise<SmsResult>;
}

export interface SmsResult {
  success: boolean;
  messageId: string | null;
  error?: string;
}
