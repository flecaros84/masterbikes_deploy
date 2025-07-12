function loadComponent(selector, file) {
    console.log(`→ Cargando componente '${selector}' desde '${file}'`);
    fetch(file)
        .then(res => {
            console.log(`   ${file}: HTTP ${res.status}`);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            return res.text();
        })
        .then(html => {
            const el = document.querySelector(selector);
            if (!el) throw new Error(`Selector '${selector}' no existe en el DOM`);
            el.innerHTML = html;
            console.log(`   Inyectado en '${selector}'`);
        })
        .catch(err => console.error(`❌ Error al cargar ${file}:`, err));
}

document.addEventListener("DOMContentLoaded", () => {
    // Ruta relativa (funciona si pages/catalogo.html carga ../components/…)
    loadComponent("header", "../components/topbar.html");
    loadComponent("footer", "../components/footer.html");

    // Como prueba, también intenta rutas absolutas (si /components está en la raíz del servidor)
    //loadComponent("header", "/components/topbar.html");
    //loadComponent("footer", "/components/footer.html");
});

