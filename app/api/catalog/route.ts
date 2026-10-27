import { authMode } from "@/lib/auth";
import { getProviderCatalog } from "@/lib/providers/models";
import { storageMode } from "@/lib/storage";

export async function GET() {
  return Response.json({
    catalog: getProviderCatalog(authMode()),
    storageMode: storageMode(),
    authMode: authMode(),
  });
}
