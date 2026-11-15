import manifest from "@/app/manifest";
import { manifestResponse } from "@/lib/compat/routes";

export const GET = () => manifestResponse(manifest());
