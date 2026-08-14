import type { SupabaseClient } from "@supabase/supabase-js";
import { InventoryReservationReconciliationPanel } from "./InventoryReservationReconciliationPanel";
import { MedalDemandSummaryPanel } from "./MedalDemandSummaryPanel";
import { MedalDeliveryAdminWorkspace } from "./MedalDeliveryAdminWorkspace";
import { MedalDeliveryBatchReconciliationPanel } from "./MedalDeliveryBatchReconciliationPanel";
import { MedalDeliveriesPanel as MedalDeliveriesPanelBase } from "./MedalDeliveriesPanelBase";
import { MedalDeliveryVisibilityPanel } from "./MedalDeliveryVisibilityPanel";
import { MedalOrdersPanel } from "./MedalOrdersPanel";
import { MedalPurchasePlanningPanel } from "./MedalPurchasePlanningPanel";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

export function MedalDeliveriesPanel(props: Props) {
  return (
    <>
      <MedalDeliveriesPanelBase {...props} />
      <MedalDemandSummaryPanel supabase={props.supabase} />
      <MedalPurchasePlanningPanel supabase={props.supabase} />
      <MedalOrdersPanel {...props} />
      <InventoryReservationReconciliationPanel {...props} />
      <MedalDeliveryVisibilityPanel supabase={props.supabase} />
      <MedalDeliveryBatchReconciliationPanel {...props} />
      <MedalDeliveryAdminWorkspace {...props} />
    </>
  );
}
