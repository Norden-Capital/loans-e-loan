import robots from "@/app/robots";
import { robotsResponse } from "@/lib/compat/routes";

export const GET = () => robotsResponse(robots());
