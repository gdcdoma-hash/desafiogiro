import type { SupabaseClient } from "@supabase/supabase-js";
import { InventoryPanel as InventoryPanelBase } from "./InventoryPanelBase";
import { MedalOrdersPanel } from "./MedalOrdersPanel";

type Props = {
  supabase: SupabaseClient;
  canManage: boolean;
};

export function InventoryPanel(props: Props) {
  return (
    <>
      <InventoryPanelBase {...props} />
      <MedalOrdersPanel {...props} />
    </>
  );
}
