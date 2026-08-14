import type { SupabaseClient } from "@supabase/supabase-js";
import { InventoryPanel as InventoryPanelBase } from "./InventoryPanelBase";
import { InventoryReservationReconciliationPanel } from "./InventoryReservationReconciliationPanel";
import { MedalDemandSummaryPanel } from "./MedalDemandSummaryPanel";
import { MedalOrdersPanel } from "./MedalOrdersPanel";
import { MedalPurchasePlanningPanel } from "./MedalPurchasePlanningPanel";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

export function InventoryPanel(props: Props) {
  return (
    <>
      <InventoryPanelBase {...props} />
      <MedalDemandSummaryPanel supabase={props.supabase} />
      <MedalPurchasePlanningPanel supabase={props.supabase} />
      <MedalOrdersPanel {...props} />
      <InventoryReservationReconciliationPanel {...props} />
    </>
  );
}
