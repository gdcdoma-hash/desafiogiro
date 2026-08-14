import type { SupabaseClient } from "@supabase/supabase-js";
import { MedalDeliveryAdminWorkspace } from "./MedalDeliveryAdminWorkspace";
import { MedalDeliveriesPanel as MedalDeliveriesPanelBase } from "./MedalDeliveriesPanelBase";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

export function MedalDeliveriesPanel(props: Props) {
  return (
    <>
      <MedalDeliveriesPanelBase {...props} />
      <MedalDeliveryAdminWorkspace {...props} />
    </>
  );
}
