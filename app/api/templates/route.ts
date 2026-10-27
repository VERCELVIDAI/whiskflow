import { getTemplates } from "@/lib/templates";

export async function GET() {
  return Response.json({ templates: getTemplates() });
}
