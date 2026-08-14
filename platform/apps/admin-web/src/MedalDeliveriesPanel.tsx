import type { SupabaseClient } from "@supabase/supabase-js";
import { MedalDemandSummaryPanel } from "./MedalDemandSummaryPanel";
import { MedalDeliveryAdminWorkspace } from "./MedalDeliveryAdminWorkspace";
import { MedalDeliveryBatchReconciliationPanel } from "./MedalDeliveryBatchReconciliationPanel";
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
      <MedalDemandSummaryPanel supabase={props.supabase} />
      <MedalDeliveryVisibilityPanel supabase={props.supabase} />
      <MedalDeliveryBatchReconciliationPanel {...props} />
      <MedalDeliveryAdminWorkspace {...props} />
    </>
  );
}
