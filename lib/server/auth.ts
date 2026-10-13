import { validateInitData, type TelegramUser } from "./telegram";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Resolves the Telegram user from the `Authorization: tma <initData>` header.
 *
 * For local browser testing outside Telegram, set TELEGRAM_DEV_USER_ID in
 * development. It is ignored in production builds.
 */
function resolveUser(request: Request): TelegramUser | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, initData] = header.split(" ");

  if (scheme === "tma" && initData) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN must be set");
    return validateInitData(initData, botToken);
  }

  const devId = Number(process.env.TELEGRAM_DEV_USER_ID);
  if (process.env.NODE_ENV !== "production" && devId) {
    return { id: devId, first_name: "Dev" };
  }
  return null;
}

/** Wraps a route handler with auth + uniform JSON error responses. */
export function withUser<Ctx>(
  handler: (request: Request, user: TelegramUser, ctx: Ctx) => Promise<Response>,
) {
  return async (request: Request, ctx: Ctx) => {
    try {
      const user = resolveUser(request);
      if (!user) throw new HttpError(401, "Unauthorized");
      return await handler(request, user, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}
