// Cloudflare Workers AI: бесплатно 10 000 нейронов в день, без карты, обновляется ежедневно.
// FLUX.2 [klein] принимает фото прямо в запросе (multipart), без публичного хостинга.
// console: dash.cloudflare.com -> Workers AI -> Use REST API -> создать токен (Workers AI Edit).
const CF_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export const hasCloudflare = Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);

export async function generateFacePortrait(selfieBuffer: Buffer, prompt: string): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) {
    throw new Error("CF_ACCOUNT_ID/CF_API_TOKEN не заданы");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`;
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("input_image_0", new Blob([new Uint8Array(selfieBuffer)]), "selfie.jpg");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    result?: { image?: string };
    success?: boolean;
    errors?: unknown[];
  };

  if (!data.result?.image) {
    throw new Error(`неожиданный ответ Cloudflare: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return Buffer.from(data.result.image, "base64");
}
