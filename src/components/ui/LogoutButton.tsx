"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={() => {
        sessionStorage.removeItem("public_auth");
        window.location.reload();
      }}
      className="text-[10px] uppercase font-bold tracking-widest text-indigo-200 hover:text-white transition-colors"
    >
      Cerrar Sesión
    </button>
  );
}
