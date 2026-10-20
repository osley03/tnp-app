import { supabase } from "@/integrations/supabase/client";
export type GatewayReply = { configured?: boolean; enabled?: boolean; mode?: "test" | "live" | null; checkoutUrl?: string; status?: string; message?: string };
export async function gateway(action: string, paymentId?: string, method?: string): Promise<GatewayReply> {
  const { data, error } = await supabase.functions.invoke("payment-gateway", { body: { action, paymentId, method } });
  if (error) {
    let message = "Online payments are not configured or could not be reached. No payment is confirmed. Contact TNP support.";
    if ("context" in error && error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === "string") message = response.error;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
