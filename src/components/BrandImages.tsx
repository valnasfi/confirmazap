import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { useBiz } from "@/components/AppShell";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

const BUCKET = "business-assets";
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_ORIGINAL_MB = 15;

type Kind = "logo" | "banner";

const SPEC = {
  logo: { column: "logo_url", title: "Logo", hint: "Quadrada, de preferência 512 × 512. PNG com fundo transparente funciona bem.", maxW: 512, maxH: 512, mime: "image/webp" },
  banner: { column: "banner_url", title: "Banner da área superior", hint: "Horizontal, de preferência 1600 × 500. Fica atrás do nome do seu negócio.", maxW: 1920, maxH: 1080, mime: "image/jpeg" },
} as const;

// Mensagens técnicas do Supabase viram um aviso que o profissional entende.
function friendly(message: string) {
  return /bucket not found|row-level security|permission denied|does not exist|schema cache/i.test(message)
    ? "O armazenamento de imagens ainda não foi configurado no Supabase. Rode o SQL das imagens e tente de novo."
    : message;
}

// Reduz a imagem no navegador antes de enviar: foto de celular chega a vários MB.
async function shrink(file: File, kind: Kind): Promise<Blob> {
  const { maxW, maxH, mime } = SPEC[kind];
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler essa imagem. Tente outro arquivo."));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não consegue processar imagens.");
    if (mime === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } // JPG não tem transparência
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.85));
    if (!blob) throw new Error("Não foi possível processar a imagem.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Apaga o arquivo antigo a partir do endereço público guardado no negócio.
async function removeByUrl(url: string) {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  await supabase.storage.from(BUCKET).remove([path]);
}

export function BrandImages() {
  const { business, reload } = useBiz();
  const [busy, setBusy] = useState<Kind | null>(null);

  const send = async (kind: Kind, file: File) => {
    if (!ACCEPT.includes(file.type)) { toast.error("Use uma imagem PNG, JPG ou WebP."); return; }
    if (file.size > MAX_ORIGINAL_MB * 1024 * 1024) { toast.error(`A imagem é muito grande (máximo ${MAX_ORIGINAL_MB} MB).`); return; }
    const { column } = SPEC[kind];
    setBusy(kind);
    try {
      const blob = await shrink(file, kind);
      const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
      const path = `${business.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const oldUrl = business[column];
      const { error: dbErr } = await supabase.from("businesses").update({ [column]: data.publicUrl }).eq("id", business.id);
      if (dbErr) { await supabase.storage.from(BUCKET).remove([path]); throw new Error(dbErr.message); }
      if (oldUrl) await removeByUrl(oldUrl);
      toast.success(kind === "logo" ? "Logo atualizada" : "Banner atualizado");
      reload();
    } catch (e) {
      toast.error(friendly((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: Kind) => {
    const { column } = SPEC[kind];
    const oldUrl = business[column];
    if (!oldUrl || !window.confirm("Remover esta imagem?")) return;
    setBusy(kind);
    try {
      const { error } = await supabase.from("businesses").update({ [column]: null }).eq("id", business.id);
      if (error) throw new Error(error.message);
      await removeByUrl(oldUrl);
      toast.success("Imagem removida");
      reload();
    } catch (e) {
      toast.error(friendly((e as Error).message));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold">Identidade visual</h2>
      <p className="mt-1 text-sm text-muted-foreground">Aparecem na sua página de agendamento. A imagem é reduzida automaticamente antes do envio, então pode escolher a foto original.</p>
      <div className="mt-5 space-y-6">
        <Uploader kind="logo" url={business.logo_url} busy={busy === "logo"} disabled={busy !== null} onPick={(f) => send("logo", f)} onRemove={() => remove("logo")} />
        <Uploader kind="banner" url={business.banner_url ?? null} busy={busy === "banner"} disabled={busy !== null} onPick={(f) => send("banner", f)} onRemove={() => remove("banner")} />
      </div>
    </section>
  );
}

function Uploader({ kind, url, busy, disabled, onPick, onRemove }: {
  kind: Kind; url: string | null; busy: boolean; disabled: boolean; onPick: (f: File) => void; onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const spec = SPEC[kind];
  const box = kind === "logo" ? "h-24 w-24" : "h-24 w-full max-w-md sm:w-80";
  return (
    <div>
      <p className="text-sm font-medium">{spec.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {url ? (
          <img src={url} alt={spec.title} className={`${box} rounded-xl border bg-white object-cover`} />
        ) : (
          <div className={`${box} grid place-items-center rounded-xl border border-dashed text-xs text-muted-foreground`}>Sem imagem</div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={ref}
            type="file"
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }}
          />
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => ref.current?.click()}>
            <ImageUp className="mr-2 h-4 w-4" />{busy ? "Enviando…" : url ? "Trocar" : "Escolher imagem"}
          </Button>
          {url && <Button type="button" variant="ghost" disabled={disabled} onClick={onRemove}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{spec.hint}</p>
    </div>
  );
}
