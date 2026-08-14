import type { SupabaseClient } from "@supabase/supabase-js";
import { MedalDeliveryAdminWorkspace } from "./MedalDeliveryAdminWorkspace";
import { MedalDeliveriesPanel as MedalDeliveriesPanelBase } from "./MedalDeliveriesPanelBase";
import { MedalDeliveryVisibilityPanel } from "./MedalDeliveryVisibilityPanel";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

export function MedalDeliveriesPanel(props: Props) {
  return (
    <>
      <MedalDeliveriesPanelBase {...props} />
      <MedalDeliveryVisibilityPanel supabase={props.supabase} />
      <MedalDeliveryAdminWorkspace {...props} />
    </>
  );
}
