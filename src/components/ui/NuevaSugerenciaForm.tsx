// src/components/ui/NuevaSugerenciaForm.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TipoSugerencia, Urgencia } from "@/types";

interface Props {
    comunaId: number;
    userId: string;
    tipos: TipoSugerencia[];
}

const URGENCIAS: Urgencia[] = ["BAJA", "MEDIA", "ALTA"];

export default function NuevaSugerenciaForm({ comunaId, userId, tipos }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");

    const [form, setForm] = useState({
        tipo_sugerencia: tipos[0]?.nombre ?? "",
        urgencia: "MEDIA" as Urgencia,
        descripcion: "",
        nombre_contacto: "",
        telefono_contacto: "",
        direccion_raw: "",
    });

    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<{ url: string, type: string, name: string }[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            if (files.length + selectedFiles.length > 5) {
                setError("Máximo 5 archivos permitidos.");
                return;
            }

            const newFiles = [...files, ...selectedFiles];
            setFiles(newFiles);

            const newPreviews = selectedFiles.map(file => ({
                url: file.type.startsWith('image/') ? URL.createObjectURL(file) : "",
                type: file.type,
                name: file.name
            }));
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);

        const newPreviews = [...previews];
        if (newPreviews[index].url) URL.revokeObjectURL(newPreviews[index].url);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    function set(key: string, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const skipNextFetch = useRef(false);

    // Debounced suggestions
    const [debouncedDireccion, setDebouncedDireccion] = useState(form.direccion_raw);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDireccion(form.direccion_raw);
        }, 500);
        return () => clearTimeout(timer);
    }, [form.direccion_raw]);

    const fetchController = useRef<AbortController | null>(null);

    useEffect(() => {
        if (debouncedDireccion.length > 3 && !skipNextFetch.current) {
            fetchSuggestions(debouncedDireccion);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
            skipNextFetch.current = false;
        }
        return () => {
            if (fetchController.current) fetchController.current.abort();
        };
    }, [debouncedDireccion]);

    async function fetchSuggestions(q: string) {
        if (fetchController.current) fetchController.current.abort();
        fetchController.current = new AbortController();

        try {
            const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&suggestions=true`, {
                signal: fetchController.current.signal
            });
            const data = await res.json();
            setSuggestions(data);
            setShowSuggestions(data.length > 0);
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.error("Error fetching suggestions:", err);
            }
        }
    }

    function handleSelectSuggestion(s: any) {
        setShowSuggestions(false);
        setSuggestions([]);
        skipNextFetch.current = true;

        setForm((prev) => ({
            ...prev,
            direccion_raw: s.direccion,
        }));
        setDebouncedDireccion(s.direccion);

        if (s.coordenadas && s.coordenadas.x && s.coordenadas.y) {
            setGeoStatus("ok");
        } else {
            geocodeAddress(s.direccion);
        }
    }

    async function geocodeAddress(address: string) {
        setGeoStatus("loading");
        try {
            const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
            if (!res.ok) throw new Error("API fail");
            const data = await res.json();
            if (data.lat && data.lng) {
                setGeoStatus("ok");
                return { lat: data.lat as number, lng: data.lng as number, normalizada: data.normalizada as string };
            }
        } catch (err) {
            console.error("[geocode] error:", err);
        }
        setGeoStatus("fail");
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (geoStatus !== "ok") {
            setError("Por favor seleccione una dirección válida de la lista de sugerencias.");
            return;
        }

        setLoading(true);
        setError("");

        const geo = await geocodeAddress(form.direccion_raw);
        if (!geo) {
            setError("No se pudo validar la dirección final. Por favor intente nuevamente seleccionando de la lista.");
            setLoading(false);
            return;
        }

        const supabase = createClient();
        const { data: sugerenciaData, error: insertError } = await supabase.from("sugerencias").insert({
            tipo_sugerencia: form.tipo_sugerencia,
            urgencia: form.urgencia,
            descripcion: form.descripcion,
            nombre_contacto: form.nombre_contacto,
            telefono_contacto: form.telefono_contacto,
            direccion_raw: form.direccion_raw,
            direccion_normalizada: geo.normalizada,
            lat: geo.lat,
            lng: geo.lng,
            estado: "nuevo",
            comuna_id: comunaId,
            creado_por_user_id: userId,
        }).select().single();

        if (insertError) {
            setError("Error al guardar la sugerencia: " + insertError.message);
            setLoading(false);
            return;
        }

        // Upload files if any
        if (files.length > 0) {
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${sugerenciaData.id}/${fileName}`;
                
                let tipo: 'foto' | 'pdf' | 'documento' = 'documento';
                if (file.type.startsWith('image/')) tipo = 'foto';
                else if (file.type === 'application/pdf') tipo = 'pdf';

                const { error: uploadError } = await supabase.storage
                    .from('reclamos-documentos')
                    .upload(filePath, file);

                if (!uploadError) {
                    await supabase.from('reclamo_archivos').insert({
                        sugerencia_id: sugerenciaData.id,
                        tipo: tipo,
                        storage_path: filePath
                    });
                } else {
                    console.error("Error uploading file:", uploadError);
                    if (uploadError.message.includes("Bucket not found")) {
                        setError("Error: El contenedor 'reclamos-documentos' no existe en Supabase. Por favor ejecute el script SQL proporcionado.");
                        setLoading(false);
                        return;
                    }
                }
            }
        }

        router.push("/panel/sugerencias"); // Redirect to suggests list
        router.refresh();
    }

    function handleDireccionChange(val: string) {
        setForm(prev => ({ ...prev, direccion_raw: val }));
        if (geoStatus !== "idle") setGeoStatus("idle");
    }

    return (
        <form onSubmit={handleSubmit} className="lla-card p-8 space-y-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Tipo de sugerencia</label>
                    <select
                        required
                        value={form.tipo_sugerencia}
                        onChange={(e) => set("tipo_sugerencia", e.target.value)}
                        className="lla-input w-full px-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer"
                    >
                        {tipos.map((t) => (
                            <option key={t.id} value={t.nombre} className="bg-black text-white">{t.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Importancia / Urgencia</label>
                    <div className="flex gap-2">
                        {URGENCIAS.map((u) => (
                            <button
                                key={u}
                                type="button"
                                onClick={() => set("urgencia", u)}
                                className={`flex-1 py-3 rounded-lg text-xs font-black tracking-tighter transition-all transform active:scale-95 ${form.urgencia === u
                                    ? urgenciaStyle(u)
                                    : "bg-black border border-card-border text-muted hover:border-muted/50"
                                    }`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Descripción de la idea o sugerencia</label>
                <textarea
                    required
                    rows={4}
                    value={form.descripcion}
                    onChange={(e) => set("descripcion", e.target.value)}
                    placeholder="Describa su propuesta, idea o sugerencia de mejora..."
                    className="lla-input w-full px-4 py-3 text-sm focus:outline-none resize-none"
                />
            </div>

            <div className="space-y-2 group relative">
                <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1 group-focus-within:text-primary transition-colors">Ubicación (Opcional o CABA Only)</label>
                <div className="relative">
                    <input
                        required
                        type="text"
                        value={form.direccion_raw}
                        onChange={(e) => handleDireccionChange(e.target.value)}
                        placeholder="Ej: Corrientes 1234"
                        autoComplete="off"
                        className="lla-input w-full px-4 py-3 text-sm focus:outline-none pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {(geoStatus === "loading" || loading) && <span className="animate-pulse text-primary text-lg">●</span>}
                        {geoStatus === "ok" && <span className="text-green-500 font-bold">✓</span>}
                        {geoStatus === "fail" && <span className="text-red-500 font-bold">!</span>}
                    </div>
                </div>

                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-black border border-card-border rounded-lg shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {suggestions.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleSelectSuggestion(s)}
                                className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted hover:text-white hover:bg-primary/20 border-b border-white/5 last:border-none transition-colors"
                            >
                                {s.direccion}
                            </button>
                        ))}
                    </div>
                )}

                {geoStatus !== "ok" && !showSuggestions && debouncedDireccion.length > 3 && (
                    <p className="text-[10px] text-primary mt-1 uppercase font-black tracking-[0.1em] animate-pulse">Por favor seleccione una dirección de la lista para validar.</p>
                )}
            </div>

            <div className="space-y-4 border-t border-card-border pt-8">
                <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Documentos o Fotos (Máximo 5)</label>
                <div className="flex flex-wrap gap-4">
                    {previews.map((preview, i) => (
                        <div key={i} className="relative w-24 h-24 border border-card-border rounded-lg overflow-hidden group bg-black/40 flex flex-col items-center justify-center p-2">
                            {preview.url ? (
                                <img src={preview.url} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center">
                                    <div className="text-2xl">📄</div>
                                    <div className="text-[8px] text-muted truncate w-20 px-1">{preview.name}</div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-xs"
                            >
                                Eliminar
                            </button>
                        </div>
                    ))}
                    {files.length < 5 && (
                        <label className="w-24 h-24 border-2 border-dashed border-card-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors text-muted hover:text-primary">
                            <span className="text-2xl">+</span>
                            <span className="text-[8px] font-bold uppercase text-center px-1">Subir Foto/PDF/Doc</span>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*,.pdf,.doc,.docx"
                                multiple
                                onChange={handleFileChange}
                            />
                        </label>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-card-border pt-8">
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Nombre del contacto (Opcional)</label>
                    <input
                        type="text"
                        value={form.nombre_contacto}
                        onChange={(e) => set("nombre_contacto", e.target.value)}
                        className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest ml-1">Teléfono del contacto (Opcional)</label>
                    <input
                        type="tel"
                        value={form.telefono_contacto}
                        onChange={(e) => set("telefono_contacto", e.target.value)}
                        placeholder="11-1234-5678"
                        className="lla-input w-full px-4 py-3 text-sm focus:outline-none"
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-lg">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-tight">{error}</p>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                    type="submit"
                    disabled={loading || geoStatus !== "ok"}
                    className={`flex-1 py-4 uppercase tracking-[0.2em] text-xs font-black shadow-lg transition-all ${loading || geoStatus !== "ok"
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        : "lla-btn-primary shadow-primary/20"
                        }`}
                >
                    {loading ? "Procesando..." : "Ingresar Sugerencia"}
                </button>
                <a
                    href="/panel"
                    className="lla-card px-8 py-4 text-muted hover:text-white hover:border-muted transition-all text-center uppercase tracking-widest text-[10px] font-bold"
                >
                    Volver
                </a>
            </div>
        </form>
    );
}

function urgenciaStyle(u: string) {
    if (u === "ALTA") return "bg-red-600 text-white border-red-600 shadow-lg shadow-red-900/40";
    if (u === "MEDIA") return "bg-yellow-500 text-white border-yellow-500 shadow-lg shadow-yellow-900/40";
    return "bg-green-600 text-white border-green-600 shadow-lg shadow-green-900/40";
}
