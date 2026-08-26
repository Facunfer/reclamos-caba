"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/public/logout", { method: "POST" });
        window.location.href = "/public/login";
      }}
      className="text-[10px] uppercase font-bold tracking-widest text-indigo-200 hover:text-white transition-colors"
    >
      Cerrar Sesión
    </button>
  );
}
