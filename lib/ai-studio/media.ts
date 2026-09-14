import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function isPublicIPv4(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
// Pin DNS resolution to the verified public address. Redirects are revalidated; no credentials forwarded.
export async function downloadReference(
  source: string,
  redirects = 0,
): Promise<Buffer> {
  const url = new URL(source);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    redirects > 3
  )
    throw new Error(
      "Referência precisa ser uma imagem HTTPS pública. Você também pode fazer upload.",
    );
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicIPv4(item.address))
  )
    throw new Error("Endereço de imagem não permitido.");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        family: 4,
        autoSelectFamily: false,
        lookup: (_host, _options, callback) =>
          callback(null, addresses[0].address, 4),
        headers: { Accept: "image/jpeg,image/png,image/webp" },
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
          res.headers.location
        ) {
          res.resume();
          downloadReference(
            new URL(res.headers.location, url).href,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if (
          res.statusCode !== 200 ||
          Number(res.headers["content-length"] || 0) > 8 * 1024 * 1024
        ) {
          res.resume();
          reject(
            new Error(
              "Não foi possível importar a foto. Faça upload do arquivo.",
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        res.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > 8 * 1024 * 1024)
            req.destroy(new Error("Imagem acima de 8 MB."));
          else chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    const timeout = setTimeout(
      () => req.destroy(new Error("Tempo de download excedido.")),
      20_000,
    );
    req.on("close", () => clearTimeout(timeout));
    req.on("error", reject);
    req.end();
  });
}
